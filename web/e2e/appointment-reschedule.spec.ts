import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';
import { mockEvaluateCelebrants } from './helpers/mockCelebrantRpc';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  priest?: { id: string; full_name: string; email: string } | null;
};

const REASON = 'The church hall is closed for repairs on the original date.';
const PRIEST = MOCK_USERS.priest;
const CHURCH_ADMIN = MOCK_USERS.church_admin;
// The mock priest has a weekly day of rest on Monday (day_of_week 1); 2026-10-26 is a Monday
const DAY_OFF_DATE = '2026-10-26';
const FREE_DATE = '2026-10-28';
const NEW_TIME = '09:30';

/**
 * Stateful appointments REST mock plus a mocked reschedule_appointment RPC (database functions
 * cannot run in mocked e2e). The RPC payload is recorded and the mock applies the move the way
 * the function does (status stays approved). Notifications and the change-history row are written
 * inside the database function, so here we assert the browser never writes notifications or
 * appointments directly.
 */
async function mockRescheduling(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<Record<string, unknown>> = [];
  const directWrites: string[] = [];

  page.on('request', (request) => {
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    if (isWrite && /\/rest\/v1\/(notifications|appointments)/.test(request.url())) {
      directWrites.push(`${request.method()} ${request.url()}`);
    }
  });

  await mockEvaluateCelebrants(page, () => state);

  await page.route('**/rest/v1/appointments*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${state.length - 1}/${state.length}` },
      body: JSON.stringify(state),
    });
  });

  await page.route('**/rest/v1/rpc/reschedule_appointment', async (route) => {
    const payload = route.request().postDataJSON() as {
      p_appointment_id: string;
      p_new_date: string;
      p_new_time: string;
      p_reason: string;
      p_new_priest_id: string | null;
    };
    rpcCalls.push(payload);
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) {
      target.appointment_date = payload.p_new_date;
      target.appointment_time = `${payload.p_new_time}:00`;
      const newPriest = Object.values(MOCK_USERS).find((u) => u.id === payload.p_new_priest_id);
      if (newPriest) {
        target.priest_id = newPriest.id;
        target.priest = { id: newPriest.id, full_name: newPriest.full_name, email: newPriest.email };
      }
    }
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls, directWrites, state };
}

const assignedToPriest = (): MockAppointment => ({
  ...MOCK_APPOINTMENTS[0],
  priest_id: PRIEST.id,
  priest: { id: PRIEST.id, full_name: PRIEST.full_name, email: PRIEST.email },
});

async function openReschedule(page: Page) {
  await page.goto('/appointments');
  const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Reschedule/ }).click();
  return { row, dialog };
}

test.describe('Appointment editing: office reschedules an approved appointment', () => {
  test('rescheduling onto the celebrant day off shows the warning, can be overridden and saved', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockRescheduling(page, [assignedToPriest(), MOCK_APPOINTMENTS[1]]);
    const { row, dialog } = await openReschedule(page);

    await expect(dialog.getByLabel('New date')).toHaveAttribute('min', /^\d{4}-\d{2}-\d{2}$/);

    // A non-day-off date: the assigned celebrant is checked at the new slot and has nothing against him
    await dialog.getByLabel('New date').fill(FREE_DATE);
    await dialog.getByLabel('New time').fill(NEW_TIME);
    await expect(dialog.getByTestId('celebrant-conflict-warning')).toHaveCount(0);
    await expect(dialog.getByText(`No conflicts found for ${PRIEST.full_name}.`)).toBeVisible();

    // The celebrant's weekly day of rest: the warning appears but stays overridable
    await dialog.getByLabel('New date').fill(DAY_OFF_DATE);
    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/rest|day off/i);
    await expect(warning).toContainText('You can still save');

    // Reason is required
    const save = dialog.getByRole('button', { name: 'Reschedule', exact: true }).last();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    expect(rpcCalls).toHaveLength(0);

    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await save.click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([
      {
        p_appointment_id: 'apt-1',
        p_new_date: DAY_OFF_DATE,
        p_new_time: NEW_TIME,
        p_reason: REASON,
        p_new_priest_id: null,
      },
    ]);
    await expect(row).toContainText(/Oct(ober)? 26/);
    // The browser writes nothing itself (the function updates, notifies and logs history)
    expect(directWrites).toEqual([]);
  });

  test('switches the celebrant in the same save', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockRescheduling(page, [assignedToPriest(), MOCK_APPOINTMENTS[1]]);
    const { dialog } = await openReschedule(page);

    await dialog.getByLabel('New date').fill(FREE_DATE);
    const picker = dialog.getByRole('radiogroup', { name: 'Presiding celebrant' });
    // The current celebrant is selectable here (meaning keep) and starts selected
    await expect(picker.getByRole('radio', { name: /current celebrant/ })).toBeEnabled();
    await expect(picker.getByRole('radio', { name: /current celebrant/ })).toBeChecked();

    await picker.getByRole('radio', { name: new RegExp(CHURCH_ADMIN.full_name) }).click();
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([
      {
        p_appointment_id: 'apt-1',
        p_new_date: FREE_DATE,
        p_new_time: '10:00',
        p_reason: REASON,
        p_new_priest_id: CHURCH_ADMIN.id,
      },
    ]);
  });

  test('blocks past dates in the form and never calls the rpc', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockRescheduling(page, [assignedToPriest(), MOCK_APPOINTMENTS[1]]);
    const { dialog } = await openReschedule(page);

    await dialog.getByLabel('New date').fill('2020-01-05');
    await expect(dialog.getByRole('alert')).toContainText('Past dates cannot be selected');
    // No celebrant check is offered for an impossible slot
    await expect(dialog.getByRole('radiogroup', { name: 'Presiding celebrant' })).toHaveCount(0);

    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert').first()).toContainText('Past dates cannot be selected');
    expect(rpcCalls).toHaveLength(0);
  });
});

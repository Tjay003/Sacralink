import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';
import { mockEvaluateCelebrants } from './helpers/mockCelebrantRpc';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  priest?: { id: string; full_name: string; email: string } | null;
};

const REASON = 'Fr. Juan is available and the previous celebrant has a retreat.';
const PRIEST = MOCK_USERS.priest;
const CHURCH_ADMIN = MOCK_USERS.church_admin;
const PRIEST_OPTION = new RegExp(PRIEST.full_name.replace('Fr. ', ''));

/**
 * Stateful appointments REST mock plus a mocked change_appointment_celebrant RPC (database
 * functions cannot run in mocked e2e). The RPC payload is recorded and the mock applies the
 * celebrant change the way the function does. Notification creation (new priest assigned, old
 * priest removed, parishioner NOT notified) happens inside the database function, so here we
 * assert the browser itself never writes notifications or updates the appointment directly.
 */
async function mockCelebrantEditing(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<Record<string, unknown>> = [];
  const directWrites: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    if (isWrite && /\/rest\/v1\/(notifications|appointments)/.test(url)) {
      directWrites.push(`${request.method()} ${url}`);
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

  await page.route('**/rest/v1/rpc/change_appointment_celebrant', async (route) => {
    const payload = route.request().postDataJSON() as {
      p_appointment_id: string;
      p_new_priest_id: string;
      p_reason: string;
    };
    rpcCalls.push(payload);
    const target = state.find((a) => a.id === payload.p_appointment_id);
    const newPriest = Object.values(MOCK_USERS).find((u) => u.id === payload.p_new_priest_id);
    if (target && newPriest) {
      target.priest_id = newPriest.id;
      target.priest = { id: newPriest.id, full_name: newPriest.full_name, email: newPriest.email };
    }
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls, directWrites, state };
}

const unassigned = (): MockAppointment => ({ ...MOCK_APPOINTMENTS[0] });
const assignedToChurchAdmin = (): MockAppointment => ({
  ...MOCK_APPOINTMENTS[0],
  priest_id: CHURCH_ADMIN.id,
  priest: { id: CHURCH_ADMIN.id, full_name: CHURCH_ADMIN.full_name, email: CHURCH_ADMIN.email },
});

test.describe('Appointment editing: office assigns or changes the celebrant', () => {
  test('changes an assigned celebrant with a reason and sends the rpc payload', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockCelebrantEditing(page, [assignedToChurchAdmin(), MOCK_APPOINTMENTS[1]]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByText(CHURCH_ADMIN.full_name)).toBeVisible();
    // The old direct assign path is gone from approved rows
    await expect(row.getByRole('button', { name: /Assign celebrant/ })).toHaveCount(0);

    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Change celebrant/ }).click();

    const picker = dialog.getByRole('radiogroup', { name: 'Presiding celebrant' });
    // The current celebrant cannot be re-selected
    await expect(picker.getByRole('radio', { name: /current celebrant/ })).toBeDisabled();

    // Saving without picking a celebrant is blocked
    await dialog.getByLabel('Reason for the change').fill(REASON);
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('choose a celebrant');
    expect(rpcCalls).toHaveLength(0);

    // Picking a celebrant but leaving the reason blank is blocked inline
    await picker.getByRole('radio', { name: PRIEST_OPTION }).click();
    await dialog.getByLabel('Reason for the change').fill('  ');
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    expect(rpcCalls).toHaveLength(0);

    await dialog.getByLabel('Reason for the change').fill(REASON);
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_new_priest_id: PRIEST.id, p_reason: REASON }]);
    await expect(row.getByText(PRIEST.full_name)).toBeVisible();
    // Notifications are created inside the database function; the browser writes nothing itself
    expect(directWrites).toEqual([]);
  });

  test('assigns a celebrant to an unassigned approved appointment (label reads Assign celebrant)', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockCelebrantEditing(page, [unassigned(), MOCK_APPOINTMENTS[1]]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByText('Not assigned')).toBeVisible();
    await expect(row.getByRole('button', { name: /Assign celebrant/ })).toHaveCount(0);

    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: /Change celebrant/ })).toHaveCount(0);
    await dialog.getByRole('radio', { name: /Assign celebrant/ }).click();

    const picker = dialog.getByRole('radiogroup', { name: 'Presiding celebrant' });
    await picker.getByRole('radio', { name: PRIEST_OPTION }).click();
    await dialog.getByLabel('Reason for the assignment').fill(REASON);
    await dialog.getByRole('button', { name: 'Assign celebrant', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_new_priest_id: PRIEST.id, p_reason: REASON }]);
    await expect(row.getByText(PRIEST.full_name)).toBeVisible();
    expect(directWrites).toEqual([]);
  });

  test('shows a conflict warning for a priest on retreat but still lets the office save', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    // 2026-11-12 falls inside the priest's "Diocesan Clergy Annual Retreat" blackout
    const retreatDay: MockAppointment = { ...assignedToChurchAdmin(), appointment_date: '2026-11-12' };
    const { rpcCalls } = await mockCelebrantEditing(page, [retreatDay, MOCK_APPOINTMENTS[1]]);
    await page.goto('/appointments');

    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Change celebrant/ }).click();

    const picker = dialog.getByRole('radiogroup', { name: 'Presiding celebrant' });
    await expect(dialog.getByTestId('celebrant-conflict-warning')).toHaveCount(0);
    await picker.getByRole('radio', { name: PRIEST_OPTION }).click();

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/retreat/i);
    await expect(warning).toContainText('You can still save');

    // Non-blocking: the save button stays enabled and the override goes through
    const save = dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last();
    await expect(save).toBeEnabled();
    await dialog.getByLabel('Reason for the change').fill(REASON);
    await save.click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_new_priest_id: PRIEST.id, p_reason: REASON }]);
  });

  test('mobile cards reach Assign celebrant through Edit and have no direct assign button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockCelebrantEditing(page, [unassigned(), MOCK_APPOINTMENTS[1]]);
    await page.goto('/appointments');

    await expect(page.getByRole('button', { name: /Assign celebrant/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Assign celebrant/ }).click();
    await dialog.getByRole('radiogroup', { name: 'Presiding celebrant' }).getByRole('radio', { name: PRIEST_OPTION }).click();
    await dialog.getByLabel('Reason for the assignment').fill(REASON);
    await dialog.getByRole('button', { name: 'Assign celebrant', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toHaveLength(1);
  });

  test('the approve modal is offered only for pending requests', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockCelebrantEditing(page, [assignedToChurchAdmin(), MOCK_APPOINTMENTS[1]]);
    await page.goto('/appointments');

    const table = page.locator('table');
    await expect(table.locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);

    await table.locator('tr', { hasText: 'Wedding' }).getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Approve Sacramental Appointment' })).toBeVisible();
  });
});

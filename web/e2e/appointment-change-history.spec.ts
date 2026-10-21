import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  cancellation_reason?: string | null;
  profile?: { id: string; full_name: string; email: string; phone_number: string | null };
};

interface MockChange {
  id: string;
  appointment_id: string;
  action: 'cancel' | 'restore' | 'reschedule' | 'change_celebrant' | 'mark_celebrated';
  reason: string | null;
  before_values: Record<string, unknown>;
  after_values: Record<string, unknown>;
  changed_by: string;
  created_at: string;
}

const CANCEL_REASON = 'The family requested to move the rite to another parish.';
const RESTORE_REASON = 'The cancellation was entered by mistake.';
const PRIEST = MOCK_USERS.priest;
const OFFICE = MOCK_USERS.church_admin;

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Mocks the appointment_changes REST table the way PostgREST answers it: filtered by
 * appointment_id and ordered newest first. Every request is recorded so a test can assert that
 * nothing was fetched. Row-level security itself is not exercised in mocked e2e (see the
 * Resolution of ticket 07 for the policy verification).
 */
async function mockHistory(page: Page, rows: MockChange[]) {
  const requests: string[] = [];
  await page.route('**/rest/v1/appointment_changes*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const idFilter = url.searchParams.get('appointment_id');
    const matching = rows
      .filter((r) => !idFilter || idFilter === `eq.${r.appointment_id}`)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(matching.length - 1, 0)}/${matching.length}` },
      body: JSON.stringify(matching),
    });
  });
  return { requests, rows };
}

async function mockStatefulAppointments(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  await page.route('**/rest/v1/appointments*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const params = new URL(route.request().url()).searchParams;
    const priestFilter = params.get('priest_id');
    const statusFilter = params.get('status');
    const allowed = statusFilter?.startsWith('in.(') ? statusFilter.slice(4, -1).split(',') : null;
    const rows = state.filter(
      (a) => (!allowed || allowed.includes(a.status)) && (!priestFilter || priestFilter === `eq.${a.priest_id}`)
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  });
  return state;
}

test.describe('Appointment editing: change history', () => {
  test('office sees the cancel and the restore, newest first, in the appointment details', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const state = await mockStatefulAppointments(page, MOCK_APPOINTMENTS.slice(0, 1));
    const { rows } = await mockHistory(page, []);
    let tick = 0;
    const stamp = () => new Date(Date.UTC(2026, 5, 1, 9, tick++)).toISOString();

    await page.route('**/rest/v1/rpc/cancel_appointment', async (route) => {
      const payload = route.request().postDataJSON() as { p_appointment_id: string; p_reason: string };
      rows.push({
        id: `chg-${rows.length + 1}`,
        appointment_id: payload.p_appointment_id,
        action: 'cancel',
        reason: payload.p_reason,
        before_values: { status: 'approved' },
        after_values: { status: 'cancelled' },
        changed_by: OFFICE.id,
        created_at: stamp(),
      });
      state[0].status = 'cancelled';
      return route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/rest/v1/rpc/restore_appointment', async (route) => {
      const payload = route.request().postDataJSON() as { p_appointment_id: string; p_reason: string };
      rows.push({
        id: `chg-${rows.length + 1}`,
        appointment_id: payload.p_appointment_id,
        action: 'restore',
        reason: payload.p_reason,
        before_values: { status: 'cancelled' },
        after_values: { status: 'approved' },
        changed_by: OFFICE.id,
        created_at: stamp(),
      });
      state[0].status = 'approved';
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/appointments');
    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    const edit = row.getByRole('button', { name: 'Edit', exact: true });

    // Nothing has happened yet: an empty state, not an error
    await edit.click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Change history' })).toBeVisible();
    await expect(dialog.getByText('No changes yet')).toBeVisible();
    await expect(dialog.getByText('could not be loaded')).toHaveCount(0);

    await dialog.getByLabel('Reason for cancelling').fill(CANCEL_REASON);
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    await edit.click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason for restoring').fill(RESTORE_REASON);
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    await edit.click();
    dialog = page.getByRole('dialog');
    const history = dialog.locator('section', { has: page.getByRole('heading', { name: 'Change history' }) });
    const items = history.locator('> ol > li');
    await expect(items).toHaveCount(2);

    // Newest first: the restore, then the cancel
    await expect(items.nth(0)).toContainText('Restored');
    await expect(items.nth(0)).toContainText('Cancelled → Approved');
    await expect(items.nth(0)).toContainText(RESTORE_REASON);
    await expect(items.nth(0)).toContainText(OFFICE.full_name);
    await expect(items.nth(1)).toContainText('Cancelled');
    await expect(items.nth(1)).toContainText('Approved → Cancelled');
    await expect(items.nth(1)).toContainText(CANCEL_REASON);
  });

  test('an unedited appointment shows the empty state in the details', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockStatefulAppointments(page, MOCK_APPOINTMENTS.slice(0, 1));
    await mockHistory(page, []);
    await page.goto('/appointments');

    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('No changes yet')).toBeVisible();
  });

  test('a failed history load shows a calm message with a retry, not an alarm', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockStatefulAppointments(page, MOCK_APPOINTMENTS.slice(0, 1));
    await page.route('**/rest/v1/appointment_changes*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) })
    );
    await page.goto('/appointments');

    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('The change history could not be loaded right now.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(dialog.getByText('No changes yet')).toHaveCount(0);
  });

  test('the celebrant sees the history, with celebrant names and Celebrated labels, in their details', async ({ page }) => {
    await authenticateAs(page, 'priest');
    const approved: MockAppointment = {
      ...MOCK_APPOINTMENTS[0],
      id: 'apt-own',
      priest_id: PRIEST.id,
      status: 'approved',
      appointment_date: dateKey(0),
      appointment_time: '00:00:00',
      profile: { id: 'user-id-parishioner-6', full_name: 'Started Family', email: 'user6@gmail.com', phone_number: null },
    };
    await mockStatefulAppointments(page, [approved]);
    await mockHistory(page, [
      {
        id: 'chg-1',
        appointment_id: 'apt-own',
        action: 'change_celebrant',
        reason: 'The previous celebrant is unavailable.',
        before_values: { priest_id: null },
        after_values: { priest_id: PRIEST.id },
        changed_by: OFFICE.id,
        created_at: '2026-06-01T09:00:00.000Z',
      },
      {
        id: 'chg-2',
        appointment_id: 'apt-own',
        action: 'mark_celebrated',
        reason: 'Celebrated with the whole family present.',
        before_values: { status: 'approved' },
        after_values: { status: 'completed' },
        changed_by: PRIEST.id,
        created_at: '2026-06-02T09:00:00.000Z',
      },
    ]);
    await page.goto('/dashboard');

    const timeline = page.getByRole('heading', { name: "Today's celebrations" }).locator('xpath=ancestor::section[1]');
    await timeline.locator('div.px-5.py-4', { hasText: 'Started Family' }).getByRole('button', { name: 'Details' }).click();

    const dialog = page.getByRole('dialog');
    const history = dialog.locator('section', { has: page.getByRole('heading', { name: 'Change history' }) });
    const items = history.locator('> ol > li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Marked celebrated');
    await expect(items.nth(0)).toContainText('Approved → Celebrated');
    await expect(items.nth(0)).toContainText('Note: Celebrated with the whole family present.');
    await expect(items.nth(0)).toContainText(PRIEST.full_name);
    await expect(items.nth(1)).toContainText('Celebrant changed');
    await expect(items.nth(1)).toContainText(`Unassigned → ${PRIEST.full_name}`);
    await expect(items.nth(1)).toContainText('Reason: The previous celebrant is unavailable.');
    await expect(items.nth(1)).toContainText(OFFICE.full_name);
  });

  test('the celebrant attention-queue details also show the history', async ({ page }) => {
    await authenticateAs(page, 'priest');
    const pending: MockAppointment = {
      ...MOCK_APPOINTMENTS[0],
      id: 'apt-queue',
      priest_id: PRIEST.id,
      status: 'approved',
      appointment_date: dateKey(3),
      appointment_time: '15:00:00',
      profile: { id: 'user-id-parishioner-6', full_name: 'Queue Family', email: 'user6@gmail.com', phone_number: null },
    };
    await mockStatefulAppointments(page, [pending]);
    await mockHistory(page, [
      {
        id: 'chg-1',
        appointment_id: pending.id,
        action: 'reschedule',
        reason: 'Church hall double-booked.',
        before_values: { appointment_date: '2026-10-20', appointment_time: '14:00:00', priest_id: PRIEST.id },
        after_values: { appointment_date: '2026-10-25', appointment_time: '15:00:00', priest_id: PRIEST.id },
        changed_by: OFFICE.id,
        created_at: '2026-06-01T09:00:00.000Z',
      },
    ]);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /View details/ }).first().click();
    const dialog = page.getByRole('dialog');
    const items = dialog.locator('section', { has: page.getByRole('heading', { name: 'Change history' }) }).locator('> ol > li');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('Rescheduled');
    await expect(items.first()).toContainText('Tue, Oct 20, 2026, 2:00 PM → Sun, Oct 25, 2026, 3:00 PM');
    await expect(items.first()).toContainText(`${PRIEST.full_name} → ${PRIEST.full_name}`);
  });

  test('parishioners never render the section and no history is requested', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await mockStatefulAppointments(page, MOCK_APPOINTMENTS.slice(0, 2));
    const { requests } = await mockHistory(page, [
      {
        id: 'chg-1',
        appointment_id: 'apt-1',
        action: 'cancel',
        reason: 'Should never be shown',
        before_values: { status: 'approved' },
        after_values: { status: 'cancelled' },
        changed_by: OFFICE.id,
        created_at: '2026-06-01T09:00:00.000Z',
      },
    ]);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/appointments$/);

    await expect(page.getByRole('heading', { name: 'Change history' })).toHaveCount(0);
    await expect(page.getByText('Should never be shown')).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});

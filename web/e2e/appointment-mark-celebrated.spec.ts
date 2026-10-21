import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  profile?: { id: string; full_name: string; email: string; phone_number: string | null };
};

const PRIEST = MOCK_USERS.priest;
const NOTE = 'Celebrated with the whole family present.';
const REJECTION = 'Only the parish office or the celebrant of this appointment can mark it celebrated';

/** YYYY-MM-DD for today plus an offset, in the browser's local calendar */
function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const ownAppointment = (overrides: Partial<MockAppointment> & { id: string; parishioner: string }): MockAppointment => {
  const { parishioner, ...rest } = overrides;
  return {
    ...MOCK_APPOINTMENTS[0],
    priest_id: PRIEST.id,
    profile: { id: 'user-id-parishioner-6', full_name: parishioner, email: 'user6@gmail.com', phone_number: null },
    ...rest,
  };
};

/**
 * Stateful appointments REST mock that honours the priest_id and status=in.(...) filters the
 * dashboard sends, plus a mark_appointment_celebrated RPC mock that records its payload.
 * Database functions cannot run in mocked e2e, so a rejection is simulated with `rejectWith`.
 */
async function mockAppointments(page: Page, initial: MockAppointment[], rejectWith?: string) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<Record<string, unknown>> = [];

  await page.route('**/rest/v1/appointments*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const params = new URL(route.request().url()).searchParams;
    const statusFilter = params.get('status');
    const priestFilter = params.get('priest_id');
    const allowed = statusFilter?.startsWith('in.(') ? statusFilter.slice(4, -1).split(',') : null;
    const rows = state.filter(
      (a) =>
        (!allowed || allowed.includes(a.status)) &&
        (!priestFilter || priestFilter === `eq.${a.priest_id}`)
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  });

  await page.route('**/rest/v1/rpc/mark_appointment_celebrated', async (route) => {
    const payload = route.request().postDataJSON() as { p_appointment_id: string; p_note: string | null };
    rpcCalls.push(payload);
    if (rejectWith) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: '42501', message: rejectWith, details: null, hint: null }),
      });
    }
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) target.status = 'completed';
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls };
}

const queueOf = (page: Page) =>
  page
    .getByRole('heading', { name: 'Needs celebrant attention' })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

const statTile = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');

const celebratedBefore = ownAppointment({
  id: 'apt-done',
  parishioner: 'Done Family',
  status: 'completed',
  appointment_date: dateKey(-5),
  appointment_time: '09:00:00',
});
const pastApproved = ownAppointment({
  id: 'apt-past',
  parishioner: 'Past Family',
  status: 'approved',
  appointment_date: dateKey(-1),
  appointment_time: '09:00:00',
});
const upcomingApproved = ownAppointment({
  id: 'apt-future',
  parishioner: 'Future Family',
  status: 'approved',
  appointment_date: dateKey(7),
  appointment_time: '09:00:00',
});

test.describe('Mark celebrated: priest attention queue', () => {
  test('lists past approved appointments as "Not yet marked celebrated" and marks one', async ({ page }) => {
    await authenticateAs(page, 'priest');
    const { rpcCalls } = await mockAppointments(page, [celebratedBefore, pastApproved, upcomingApproved]);
    await page.goto('/dashboard');

    const queue = queueOf(page);
    const pastRow = queue.locator('div.px-5.py-4', { hasText: 'Past Family' });
    await expect(pastRow.getByText('Not yet marked celebrated', { exact: true })).toBeVisible();
    await expect(pastRow.getByRole('button', { name: 'Mark celebrated', exact: true })).toBeVisible();

    // A future appointment is never offered for marking
    const futureRow = queue.locator('div.px-5.py-4', { hasText: 'Future Family' });
    await expect(futureRow).toBeVisible();
    await expect(futureRow.getByText('Not yet marked celebrated')).toHaveCount(0);
    await expect(futureRow.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);

    await expect(statTile(page, 'Celebrated this year')).toContainText('1');

    await pastRow.getByRole('button', { name: 'Mark celebrated', exact: true }).click();

    // No note box for the priest: the RPC carries a null note
    await expect.poll(() => rpcCalls).toEqual([{ p_appointment_id: 'apt-past', p_note: null }]);
    await expect(queue.locator('div.px-5.py-4', { hasText: 'Past Family' })).toHaveCount(0);
    await expect(futureRow).toBeVisible();
    await expect(statTile(page, 'Celebrated this year')).toContainText('2');
  });

  test('shows the error and keeps the item when the database rejects the mark', async ({ page }) => {
    await authenticateAs(page, 'priest');
    // The row looks like the priest's own in the UI, but the function refuses (it belongs to another priest)
    const { rpcCalls } = await mockAppointments(page, [pastApproved], REJECTION);
    await page.goto('/dashboard');

    const queue = queueOf(page);
    const pastRow = queue.locator('div.px-5.py-4', { hasText: 'Past Family' });
    await pastRow.getByRole('button', { name: 'Mark celebrated', exact: true }).click();

    await expect(queue.getByRole('alert')).toContainText(REJECTION);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-past', p_note: null }]);
    await expect(pastRow.getByText('Not yet marked celebrated', { exact: true })).toBeVisible();
    await expect(statTile(page, 'Celebrated this year')).toContainText('0');
  });
});

test.describe('Mark celebrated: priest timeline', () => {
  const started = ownAppointment({
    id: 'apt-started',
    parishioner: 'Started Family',
    service_type: 'Funeral',
    status: 'approved',
    appointment_date: dateKey(0),
    appointment_time: '00:00:00',
  });
  const notStarted = ownAppointment({
    id: 'apt-later',
    parishioner: 'Later Family',
    service_type: 'Anointing',
    status: 'approved',
    appointment_date: dateKey(0),
    appointment_time: '23:59:00',
  });

  test('the button only appears once the start time has passed, and marking updates badge and count', async ({ page }) => {
    await authenticateAs(page, 'priest');
    const { rpcCalls } = await mockAppointments(page, [celebratedBefore, started, notStarted]);
    await page.goto('/dashboard');

    const timeline = page
      .getByRole('heading', { name: "Today's celebrations" })
      .locator('xpath=ancestor::section[1]');
    const startedRow = timeline.locator('div.px-5.py-4', { hasText: 'Started Family' });
    const laterRow = timeline.locator('div.px-5.py-4', { hasText: 'Later Family' });

    await expect(startedRow.getByRole('button', { name: 'Mark celebrated', exact: true })).toBeVisible();
    await expect(laterRow).toBeVisible();
    await expect(laterRow.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
    await expect(startedRow.getByText('Celebrated', { exact: true })).toHaveCount(0);
    await expect(statTile(page, 'Celebrated this year')).toContainText('1');
    await expect(statTile(page, 'Presiding today')).toContainText('2');

    await startedRow.getByRole('button', { name: 'Mark celebrated', exact: true }).click();

    await expect.poll(() => rpcCalls).toEqual([{ p_appointment_id: 'apt-started', p_note: null }]);
    await expect(startedRow.getByText('Celebrated', { exact: true })).toBeVisible();
    await expect(startedRow.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
    await expect(statTile(page, 'Celebrated this year')).toContainText('2');
    await expect(statTile(page, 'Presiding today')).toContainText('1 celebrated, 1 still to come');
    // Also gone from the attention queue
    await expect(queueOf(page).locator('div.px-5.py-4', { hasText: 'Started Family' })).toHaveCount(0);
  });

  test('sample rows never offer Mark celebrated', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointments(page, []);
    await page.goto('/dashboard');

    await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
  });

  test('priests get no Edit action on the appointments page', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointments(page, [pastApproved]);
    await page.goto('/appointments');

    await expect(page.locator('table').locator('tr', { hasText: 'Baptism' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  });
});

test.describe('Mark celebrated: office Edit modal', () => {
  const baptism = ownAppointment({
    id: 'apt-1',
    parishioner: 'Office Family',
    status: 'approved',
    appointment_date: dateKey(-2),
    appointment_time: '09:00:00',
  });

  test('the note is optional: marking with no note sends null', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockAppointments(page, [baptism]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');

    const radio = dialog.getByRole('radio', { name: /Mark celebrated/ });
    await expect(radio).toBeEnabled();
    await radio.click();
    await expect(dialog.getByLabel('Note (optional)')).toBeVisible();

    await dialog.getByRole('button', { name: 'Mark celebrated', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_note: null }]);
    await expect(row.getByText('Celebrated', { exact: true })).toBeVisible();
    // A Celebrated row keeps Edit so the office can restore it
    await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1);
  });

  test('a typed note is sent trimmed', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockAppointments(page, [baptism]);
    await page.goto('/appointments');

    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Mark celebrated/ }).click();
    await dialog.getByLabel('Note (optional)').fill(`  ${NOTE}  `);
    await dialog.getByRole('button', { name: 'Mark celebrated', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_note: NOTE }]);
  });
});

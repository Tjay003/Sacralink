import { test, expect, type Page } from '@playwright/test';
import {
  capture,
  clientAs,
  createApprovedAppointment,
  isoDate,
  loginAs,
  openEdit,
  resetAppointmentData,
  serviceClient,
  type Role,
} from './support';

/**
 * Real end-to-end: the change history is visible to the office and to the appointment's celebrant,
 * and to nobody else (database RLS, not only hidden in the UI).
 */

const RESCHEDULE_REASON = 'The parish hall is unavailable on the original date.';
const CANCEL_REASON = 'The family asked to postpone because of illness.';
const RESTORE_REASON = 'The family recovered and wants to proceed.';

const db = serviceClient();

/** Reschedule, cancel then restore through the real database functions, as the office. */
async function editThreeTimes(id: string) {
  const admin = await clientAs('church_admin');
  const rescheduled = await admin.rpc('reschedule_appointment', {
    p_appointment_id: id,
    p_new_date: isoDate(21),
    p_new_time: '09:30:00',
    p_reason: RESCHEDULE_REASON,
  });
  if (rescheduled.error) throw rescheduled.error;
  const cancelled = await admin.rpc('cancel_appointment', { p_appointment_id: id, p_reason: CANCEL_REASON });
  if (cancelled.error) throw cancelled.error;
  const restored = await admin.rpc('restore_appointment', { p_appointment_id: id, p_reason: RESTORE_REASON });
  if (restored.error) throw restored.error;
}

function historyOf(page: Page) {
  return page.getByRole('dialog').getByRole('region', { name: 'Change history' });
}

/** Asserts the three entries, newest first, with their reasons and who made the change. */
async function expectThreeEntries(page: Page) {
  const entries = historyOf(page).locator('ol > li');
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(0)).toContainText('Restored');
  await expect(entries.nth(0)).toContainText(RESTORE_REASON);
  await expect(entries.nth(0)).toContainText('Cancelled → Approved');
  await expect(entries.nth(1)).toContainText('Cancelled');
  await expect(entries.nth(1)).toContainText(CANCEL_REASON);
  await expect(entries.nth(1)).toContainText('Approved → Cancelled');
  await expect(entries.nth(2)).toContainText('Rescheduled');
  await expect(entries.nth(2)).toContainText(RESCHEDULE_REASON);
  await expect(entries.nth(2)).toContainText('Date and time');
  for (let i = 0; i < 3; i += 1) {
    await expect(entries.nth(i)).toContainText('Local Church Admin');
  }
}

async function visibleChangeRows(role: Role, id: string) {
  const client = await clientAs(role);
  const { data, error } = await client.from('appointment_changes').select('id').eq('appointment_id', id);
  if (error) throw error;
  return data;
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Change history visibility', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('office sees the full history, newest first, in the Edit modal', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await editThreeTimes(id);
    await loginAs(page, 'church_admin');

    await openEdit(page);
    await expectThreeEntries(page);
    await historyOf(page).scrollIntoViewIfNeeded();
    await capture(page, 'change-history-office-modal');
  });

  test('an appointment with no edits shows an empty state, not an error', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');

    await openEdit(page);
    await expect(historyOf(page)).toContainText('No changes yet');
    await expect(historyOf(page).locator('ol > li')).toHaveCount(0);
    await expect(historyOf(page)).not.toContainText('could not be loaded');
  });

  test('the celebrant sees the same history from his dashboard details views', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await editThreeTimes(id);
    await loginAs(page, 'priest');

    // Upcoming sacramental ministry > Details
    const upcoming = page.locator('section').filter({ hasText: 'Upcoming sacramental ministry' });
    await upcoming.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog')).toContainText('Sacramental Document Inspection');
    await expectThreeEntries(page);
    await historyOf(page).scrollIntoViewIfNeeded();
    await capture(page, 'change-history-celebrant-modal', false);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Needs celebrant attention > the parishioner's name opens the details
    const queue = page
      .getByRole('heading', { name: 'Needs celebrant attention' })
      .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
    await queue.getByRole('button', { name: 'Local Parishioner' }).click();
    await expect(page.getByRole('dialog')).toContainText('Celebrant ministry & sacramental details');
    await expectThreeEntries(page);
  });

  test('the parishioner never sees the history: no UI, no request, and no rows through the database', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await editThreeTimes(id);

    const historyRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('appointment_changes')) historyRequests.push(request.url());
    });
    await loginAs(page, 'parishioner');
    await expect(page.getByRole('heading', { name: 'Baptism' })).toBeVisible();
    await expect(page.getByText('Change history')).toHaveCount(0);

    await page.goto('/appointments');
    await expect(page.locator('table').getByText('Baptism')).toBeVisible();
    await expect(page.getByText('Change history')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    expect(historyRequests).toEqual([]);

    // Database level: RLS returns the three rows to the office and the celebrant only
    expect(await visibleChangeRows('church_admin', id)).toHaveLength(3);
    expect(await visibleChangeRows('priest', id)).toHaveLength(3);
    expect(await visibleChangeRows('parishioner', id)).toHaveLength(0);
    expect(await visibleChangeRows('priest2', id)).toHaveLength(0);
    expect(await visibleChangeRows('other_admin', id)).toHaveLength(0);
    const { data: all } = await db.from('appointment_changes').select('id').eq('appointment_id', id);
    expect(all).toHaveLength(3);
  });
});

import { test, expect, type Page } from '@playwright/test';
import {
  USERS,
  clientAs,
  createApprovedAppointment,
  getSeed,
  isoDate,
  loginAs,
  resetAppointmentData,
  serviceClient,
} from './support';

/**
 * Real end-to-end: browser -> local Vite app -> local Supabase (Auth, RLS, database functions).
 * Nothing is mocked, so these cover the change history rows, notifications and the lockdown.
 */

const REASON = 'The parish hall is unavailable on the original date.';

const db = serviceClient();

async function appointment(id: string) {
  const { data, error } = await db.from('appointments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
async function history(id: string) {
  const { data, error } = await db.from('appointment_changes').select('*').eq('appointment_id', id).order('created_at');
  if (error) throw error;
  return data;
}
async function notificationsFor(userId: string) {
  const { data, error } = await db.from('notifications').select('*').eq('user_id', userId);
  if (error) throw error;
  return data;
}

async function openEdit(page: Page) {
  await page.goto('/appointments');
  const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  return { row, dialog: page.getByRole('dialog') };
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Appointment editing against the local database', () => {
  test('office cancels an approved appointment: status, history and notifications', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment();
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Cancel appointment/ }).click();
    await dialog.getByLabel('Reason for cancelling').fill(REASON);
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('cancelled');
    expect(apt.cancellation_reason).toBe(REASON);

    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'cancel', reason: REASON, changed_by: seed.ids.church_admin });

    expect((await notificationsFor(seed.ids.parishioner)).length).toBeGreaterThan(0);
    expect((await notificationsFor(seed.ids.priest)).length).toBeGreaterThan(0);
  });

  test('office reschedules in place: still approved, original date kept, history written', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    const originalDate = isoDate(14);
    const newDate = isoDate(21);
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(newDate);
    await dialog.getByLabel('New time').fill('09:30');
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('approved');
    expect(apt.appointment_date).toBe(newDate);
    expect(apt.appointment_time).toBe('09:30:00');
    expect(apt.rescheduled_from_date).toBe(originalDate);
    expect(apt.reschedule_reason).toBe(REASON);

    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'reschedule', reason: REASON });

    expect((await notificationsFor(seed.ids.parishioner)).length).toBeGreaterThan(0);
  });

  test('office changes the celebrant: new and old priest are both notified', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ celebrant: 'priest' });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Change celebrant/ }).click();
    await dialog
      .getByRole('radiogroup', { name: 'Presiding celebrant' })
      .getByRole('radio', { name: new RegExp(USERS.priest2.fullName) })
      .click();
    await dialog.getByLabel('Reason for the change').fill(REASON);
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).priest_id).toBe(seed.ids.priest2);
    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'change_celebrant', reason: REASON });

    expect((await notificationsFor(seed.ids.priest2)).length).toBeGreaterThan(0);
    expect((await notificationsFor(seed.ids.priest)).length).toBeGreaterThan(0);
  });

  test('office marks a past appointment celebrated, then restores it to approved', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: -2 });
    await loginAs(page, 'church_admin');

    let { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Mark celebrated/ }).click();
    await dialog.getByLabel('Note (optional)').fill('Went well.');
    await dialog.getByRole('button', { name: 'Mark celebrated', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await appointment(id)).status).toBe('completed');

    ({ dialog } = await openEdit(page));
    await dialog.getByRole('radio', { name: /Restore to approved/ }).click();
    await dialog.getByLabel('Reason for restoring').fill(REASON);
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).status).toBe('approved');
    expect((await history(id)).map((r) => r.action)).toEqual(['mark_celebrated', 'restore']);
  });
});

test.describe('Database-enforced permissions', () => {
  test('church staff can no longer UPDATE appointments directly', async () => {
    const id = await createApprovedAppointment();
    const admin = await clientAs('church_admin');
    await admin.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    expect((await appointment(id)).status).toBe('approved');
  });

  test('a parishioner cannot call the edit functions', async () => {
    const id = await createApprovedAppointment();
    const parishioner = await clientAs('parishioner');
    const { error } = await parishioner.rpc('cancel_appointment', { p_appointment_id: id, p_reason: REASON });
    expect(error).not.toBeNull();
    expect((await appointment(id)).status).toBe('approved');
  });

  test('an admin from another parish cannot edit this parish appointment', async () => {
    const id = await createApprovedAppointment();
    const other = await clientAs('other_admin');
    const { error } = await other.rpc('cancel_appointment', { p_appointment_id: id, p_reason: REASON });
    expect(error).not.toBeNull();
    expect((await appointment(id)).status).toBe('approved');
  });

  test('a priest can mark only his own appointment celebrated', async () => {
    const mine = await createApprovedAppointment({ daysFromToday: -1, celebrant: 'priest' });
    const notMine = await createApprovedAppointment({ daysFromToday: -1, celebrant: 'priest2' });
    const priest = await clientAs('priest');

    const denied = await priest.rpc('mark_appointment_celebrated', { p_appointment_id: notMine, p_note: null });
    expect(denied.error).not.toBeNull();
    expect((await appointment(notMine)).status).toBe('approved');

    const allowed = await priest.rpc('mark_appointment_celebrated', { p_appointment_id: mine, p_note: null });
    expect(allowed.error).toBeNull();
    expect((await appointment(mine)).status).toBe('completed');
  });

  test('a reason is required to cancel', async () => {
    const id = await createApprovedAppointment();
    const admin = await clientAs('church_admin');
    const { error } = await admin.rpc('cancel_appointment', { p_appointment_id: id, p_reason: '   ' });
    expect(error).not.toBeNull();
    expect((await appointment(id)).status).toBe('approved');
  });
});

import { test, expect } from '@playwright/test';
import {
  capture,
  clientAs,
  createApprovedAppointment,
  createPendingAppointment,
  getSeed,
  loginAs,
  openEdit,
  resetAppointmentData,
  serviceClient,
} from './support';

/**
 * Real end-to-end: approving and rejecting a pending request goes through the database functions,
 * writes the change history and notifications, and the approve modal handles pending requests only.
 */

const NOTE = 'Please bring the original PSA birth certificate three days before.';

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
  const { data, error } = await db.from('notifications').select('type,title').eq('user_id', userId);
  if (error) throw error;
  return data;
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Office approves and rejects pending requests', () => {
  test('approve with a celebrant and a note: status, celebrant, history and both notifications', async ({ page }) => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await row.getByRole('button', { name: 'Approve', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Approve Sacramental Appointment');
    await dialog.locator('#celebrant-select').selectOption(seed.ids.priest2);
    await dialog.locator('#admin-feedback').fill(NOTE);
    await capture(page, 'approve-modal-pending-request');
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('approved');
    expect(apt.priest_id).toBe(seed.ids.priest2);
    expect(apt.admin_feedback).toBe(NOTE);

    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'approve', reason: NOTE, changed_by: seed.ids.church_admin });
    expect(rows[0].before_values.status).toBe('pending');
    expect(rows[0].after_values.status).toBe('approved');
    expect(rows[0].after_values.priest_id).toBe(seed.ids.priest2);

    expect(await notificationsFor(seed.ids.parishioner)).toEqual([{ type: 'appointment_approved', title: 'Appointment Approved' }]);
    expect(await notificationsFor(seed.ids.priest2)).toEqual([{ type: 'appointment', title: 'New Sacramental Assignment' }]);
    expect(await notificationsFor(seed.ids.priest)).toHaveLength(0);

    // The row now offers Edit, never Approve again
    await expect(row.getByText('Approved', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  });

  test('approve without a celebrant or a note leaves the appointment unassigned', async ({ page }) => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('approved');
    expect(apt.priest_id).toBeNull();
    expect(apt.admin_feedback).toBeNull();
    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'approve', reason: null });
    expect(await notificationsFor(seed.ids.parishioner)).toHaveLength(1);
    expect((await notificationsFor(seed.ids.priest)).length + (await notificationsFor(seed.ids.priest2)).length).toBe(0);
  });

  test('reject a pending request: status, history and the parishioner is told', async ({ page }) => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await row.getByRole('button', { name: 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Reject Appointment?');
    await dialog.getByRole('button', { name: 'Yes, Reject' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(row.getByText('Rejected', { exact: true })).toBeVisible();
    expect((await appointment(id)).status).toBe('rejected');
    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'reject', changed_by: seed.ids.church_admin });
    expect(rows[0].before_values.status).toBe('pending');
    expect(rows[0].after_values.status).toBe('rejected');
    expect(await notificationsFor(seed.ids.parishioner)).toEqual([{ type: 'appointment_rejected', title: 'Appointment Rejected' }]);
    expect(await notificationsFor(seed.ids.priest)).toHaveLength(0);
  });

  test('the approve modal handles pending requests only: other rows offer Edit or nothing', async ({ page }) => {
    await createPendingAppointment({ daysFromToday: 14, serviceType: 'Baptism' });
    await createApprovedAppointment({ daysFromToday: 15, serviceType: 'Wedding' });
    const rejected = await createPendingAppointment({ daysFromToday: 16, serviceType: 'Funeral' });
    const celebrated = await createApprovedAppointment({ daysFromToday: 17, serviceType: 'Confirmation' });
    const cancelled = await createApprovedAppointment({ daysFromToday: 18, serviceType: 'Blessing' });
    await db.from('appointments').update({ status: 'rejected' }).eq('id', rejected);
    await db.from('appointments').update({ status: 'completed' }).eq('id', celebrated);
    await db.from('appointments').update({ status: 'cancelled', cancellation_reason: 'Closed.' }).eq('id', cancelled);
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    const table = page.locator('table');
    await expect(table.locator('tbody tr')).toHaveCount(5);
    await expect(table.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(1);
    await expect(table.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(1);
    await expect(table.locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    await expect(table.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(3);
    await expect(table.locator('tr', { hasText: 'Funeral' }).getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);

    // Editing an approved appointment never opens the approve modal or its celebrant select
    const { dialog } = await openEdit(page, 'Matrimony');
    await expect(dialog).toContainText('Edit appointment');
    await expect(dialog).not.toContainText('Approve Sacramental Appointment');
    await expect(dialog.locator('#celebrant-select')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Approve Appointment' })).toHaveCount(0);
  });

  test('the database refuses to approve or reject anything that is not pending', async () => {
    const seed = await getSeed();
    const approved = await createApprovedAppointment({ daysFromToday: 14 });
    const rejected = await createPendingAppointment({ daysFromToday: 15 });
    const cancelled = await createApprovedAppointment({ daysFromToday: 16 });
    const celebrated = await createApprovedAppointment({ daysFromToday: 17 });
    await db.from('appointments').update({ status: 'rejected' }).eq('id', rejected);
    await db.from('appointments').update({ status: 'cancelled' }).eq('id', cancelled);
    await db.from('appointments').update({ status: 'completed' }).eq('id', celebrated);
    const admin = await clientAs('church_admin');

    for (const id of [approved, rejected, cancelled, celebrated]) {
      const approve = await admin.rpc('approve_appointment', { p_appointment_id: id, p_priest_id: seed.ids.priest2, p_admin_feedback: null });
      expect(approve.error).not.toBeNull();
      const reject = await admin.rpc('reject_appointment', { p_appointment_id: id, p_admin_feedback: null });
      expect(reject.error).not.toBeNull();
    }
    expect((await appointment(approved)).status).toBe('approved');
    expect((await appointment(approved)).priest_id).toBe(seed.ids.priest);
    expect((await appointment(rejected)).status).toBe('rejected');
    expect((await appointment(cancelled)).status).toBe('cancelled');
    expect((await appointment(celebrated)).status).toBe('completed');

    // And the edit functions refuse a request that is still pending
    const pending = await createPendingAppointment({ daysFromToday: 20 });
    const attempts = [
      admin.rpc('cancel_appointment', { p_appointment_id: pending, p_reason: 'Not yet approved' }),
      admin.rpc('reschedule_appointment', { p_appointment_id: pending, p_new_date: '2099-01-02', p_new_time: '09:00:00', p_reason: 'Not yet approved' }),
      admin.rpc('change_appointment_celebrant', { p_appointment_id: pending, p_new_priest_id: seed.ids.priest2, p_reason: 'Not yet approved' }),
      admin.rpc('mark_appointment_celebrated', { p_appointment_id: pending, p_note: null }),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result.error).not.toBeNull();
    }
    expect((await appointment(pending)).status).toBe('pending');
    expect(await history(pending)).toHaveLength(0);
  });

  test('a parishioner, and an admin from another parish, cannot approve or reject the request', async () => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 14 });

    for (const role of ['parishioner', 'other_admin'] as const) {
      const client = await clientAs(role);
      const approve = await client.rpc('approve_appointment', { p_appointment_id: id, p_priest_id: null, p_admin_feedback: null });
      expect(approve.error).not.toBeNull();
      const reject = await client.rpc('reject_appointment', { p_appointment_id: id, p_admin_feedback: null });
      expect(reject.error).not.toBeNull();
    }

    // The parishioner keeps the direct write on his own pending request, but cannot approve it that way
    const parishioner = await clientAs('parishioner');
    await parishioner.from('appointments').update({ status: 'approved', priest_id: seed.ids.priest }).eq('id', id);
    const unchanged = await appointment(id);
    expect(unchanged.status).toBe('pending');
    expect(unchanged.priest_id).toBeNull();

    const edited = await parishioner.from('appointments').update({ notes: 'Please use the side chapel.' }).eq('id', id).select('id');
    expect(edited.error).toBeNull();
    expect(edited.data).toHaveLength(1);
    expect((await appointment(id)).notes).toBe('Please use the side chapel.');
    expect(await history(id)).toHaveLength(0);
  });
});

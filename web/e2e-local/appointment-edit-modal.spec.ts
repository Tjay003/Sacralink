import { test, expect, type Locator } from '@playwright/test';
import {
  USERS,
  capture,
  clientAs,
  createApprovedAppointment,
  getSeed,
  isoDate,
  loginAs,
  openEdit,
  resetAppointmentData,
  serviceClient,
} from './support';

/**
 * Real end-to-end: the Edit modal is one modal. The office picks an action, and only that action's
 * fields plus the reason box appear (spec decision 9). Cancelled and Celebrated appointments offer
 * Restore only. Every screenshot here feeds the visual review.
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

function actionPicker(dialog: Locator) {
  return dialog.getByRole('radiogroup', { name: 'Edit action' });
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Edit modal shows only the chosen action', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('an approved appointment offers four actions, each revealing only its own fields', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');
    const { dialog } = await openEdit(page);

    const radios = actionPicker(dialog).getByRole('radio');
    await expect(radios).toHaveCount(4);
    for (const name of [/Cancel appointment/, /Change celebrant/, /Reschedule/, /Mark celebrated/]) {
      await expect(actionPicker(dialog).getByRole('radio', { name })).toBeEnabled();
    }
    await expect(actionPicker(dialog).getByRole('radio', { name: /Restore/ })).toHaveCount(0);

    const newDate = dialog.getByLabel('New date');
    const picker = dialog.getByRole('radiogroup', { name: 'Presiding celebrant' });

    // Cancel is the default
    await expect(actionPicker(dialog).getByRole('radio', { name: /Cancel appointment/ })).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByLabel('Reason for cancelling')).toBeVisible();
    await expect(newDate).toHaveCount(0);
    await expect(picker).toHaveCount(0);
    await capture(page, 'edit-modal-cancel');

    await actionPicker(dialog).getByRole('radio', { name: /Change celebrant/ }).click();
    await expect(picker).toBeVisible();
    await expect(dialog.getByLabel('Reason for the change')).toBeVisible();
    await expect(newDate).toHaveCount(0);
    await expect(dialog.getByLabel('Reason for cancelling')).toHaveCount(0);
    await expect(picker.getByRole('radio', { name: new RegExp(`${USERS.priest.fullName}.*current celebrant`) })).toBeDisabled();
    await capture(page, 'edit-modal-change-celebrant');

    await actionPicker(dialog).getByRole('radio', { name: /Reschedule/ }).click();
    await expect(newDate).toHaveValue(isoDate(14));
    await expect(dialog.getByLabel('New time')).toHaveValue('10:00');
    await expect(picker).toBeVisible();
    await expect(dialog.getByLabel('Reason for rescheduling')).toBeVisible();
    await expect(dialog.getByLabel('Reason for the change')).toHaveCount(0);
    await capture(page, 'edit-modal-reschedule');

    await actionPicker(dialog).getByRole('radio', { name: /Mark celebrated/ }).click();
    await expect(dialog.getByLabel('Note (optional)')).toBeVisible();
    await expect(newDate).toHaveCount(0);
    await expect(picker).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Mark celebrated', exact: true })).toBeVisible();
    await capture(page, 'edit-modal-mark-celebrated');

    // The change history sits under every action
    await expect(dialog.getByRole('region', { name: 'Change history' })).toBeVisible();
  });

  test('a Cancelled appointment offers only Restore', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    const admin = await clientAs('church_admin');
    const { error } = await admin.rpc('cancel_appointment', { p_appointment_id: id, p_reason: REASON });
    expect(error).toBeNull();
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    const radios = actionPicker(dialog).getByRole('radio');
    await expect(radios).toHaveCount(1);
    await expect(radios.first()).toContainText('Restore to approved');
    await expect(radios.first()).toHaveAttribute('aria-checked', 'true');
    await expect(dialog.getByLabel('Reason for restoring')).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Change history' })).toContainText(REASON);
    await capture(page, 'edit-modal-restore');
  });

  test('a Celebrated appointment offers only Restore', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: -2 });
    const admin = await clientAs('church_admin');
    const { error } = await admin.rpc('mark_appointment_celebrated', { p_appointment_id: id, p_note: null });
    expect(error).toBeNull();
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await expect(actionPicker(dialog).getByRole('radio')).toHaveCount(1);
    await expect(actionPicker(dialog).getByRole('radio').first()).toContainText('Restore to approved');
  });

  test('blank reasons and a missing celebrant are refused before anything is saved', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');
    const { dialog } = await openEdit(page);
    const save = (name: string) => dialog.getByRole('button', { name, exact: true }).last();

    await save('Cancel appointment').click();
    await expect(dialog.getByText('Please enter a reason before saving.')).toBeVisible();

    await actionPicker(dialog).getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(isoDate(21));
    await save('Reschedule').click();
    await expect(dialog.getByText('Please enter a reason before saving.')).toBeVisible();

    await actionPicker(dialog).getByRole('radio', { name: /Change celebrant/ }).click();
    await save('Change celebrant').click();
    await expect(dialog.getByText('Please choose a celebrant before saving.')).toBeVisible();

    const unchanged = await appointment(id);
    expect(unchanged.status).toBe('approved');
    expect(unchanged.appointment_date).toBe(isoDate(14));
    expect(await history(id)).toHaveLength(0);
  });

  test('reschedule rejects a past date and an unchanged slot, in the UI and in the database', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');
    const { dialog } = await openEdit(page);
    await actionPicker(dialog).getByRole('radio', { name: /Reschedule/ }).click();

    await expect(dialog.getByLabel('New date')).toHaveAttribute('min', new Date().toISOString().split('T')[0]);

    await dialog.getByLabel('New date').fill(isoDate(-3));
    await expect(dialog.getByText('Past dates cannot be selected. Choose today or a later date.')).toBeVisible();
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog.getByText('Past dates cannot be selected. Please choose today or a later date.')).toBeVisible();

    await dialog.getByLabel('New date').fill(isoDate(14));
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog.getByText('Choose a different date, time or celebrant to reschedule.')).toBeVisible();

    const admin = await clientAs('church_admin');
    const past = await admin.rpc('reschedule_appointment', {
      p_appointment_id: id,
      p_new_date: isoDate(-3),
      p_new_time: '09:00:00',
      p_reason: REASON,
    });
    expect(past.error).not.toBeNull();
    expect((await appointment(id)).appointment_date).toBe(isoDate(14));
    expect(await history(id)).toHaveLength(0);
  });

  test('an appointment without a celebrant offers Assign celebrant; assigning notifies only the new priest', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ daysFromToday: 14, celebrant: null });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await expect(actionPicker(dialog).getByRole('radio', { name: /Change celebrant/ })).toHaveCount(0);
    await actionPicker(dialog).getByRole('radio', { name: /Assign celebrant/ }).click();
    await dialog
      .getByRole('radiogroup', { name: 'Presiding celebrant' })
      .getByRole('radio', { name: new RegExp(USERS.priest2.fullName) })
      .click();
    await dialog.getByLabel('Reason for the assignment').fill(REASON);
    await dialog.getByRole('button', { name: 'Assign celebrant', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).priest_id).toBe(seed.ids.priest2);
    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'change_celebrant', reason: REASON });
    expect(rows[0].before_values.priest_id).toBeNull();
    expect(rows[0].after_values.priest_id).toBe(seed.ids.priest2);

    const { data: notifications } = await db.from('notifications').select('user_id,title');
    expect(notifications).toEqual([{ user_id: seed.ids.priest2, title: 'New Sacramental Assignment' }]);
  });
});

test.describe('Edit modal on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the Edit button on the mobile card opens a modal that fits the screen', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    await loginAs(page, 'church_admin');
    await page.goto('/appointments');

    await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Edit appointment');
    await actionPicker(dialog).getByRole('radio', { name: /Reschedule/ }).tap();
    await expect(dialog.getByLabel('New date')).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await capture(page, 'edit-modal-reschedule-mobile-390');
  });
});

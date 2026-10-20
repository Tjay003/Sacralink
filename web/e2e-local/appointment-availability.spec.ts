import { test, expect, type Locator } from '@playwright/test';
import {
  USERS,
  addLeave,
  addWeeklyDayOff,
  capture,
  createApprovedAppointment,
  dayOfWeek,
  firstWeekdayOffset,
  getSeed,
  isoDate,
  loginAs,
  openEdit,
  resetAppointmentData,
  resetPriestAvailability,
  serviceClient,
} from './support';

/**
 * Real end-to-end: the Edit modal re-runs the celebrant availability check (day off, leave, double
 * booking, Canon 905) against rows seeded in the local priest_availability and appointments tables.
 * A conflict is only a warning: the office can see it and still save.
 */

const REASON = 'The parish hall is unavailable on the original date.';
const DAY_OFF_REASON = 'Fr. Local Priest keeps this weekday as his weekly day off';
const LEAVE_REASON = 'Diocesan clergy retreat in Baguio';

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
async function notificationTitles(userId: string) {
  const { data, error } = await db.from('notifications').select('title').eq('user_id', userId);
  if (error) throw error;
  return data.map((n) => n.title as string);
}

/** First offset at or after `fromDays` that falls on a Sunday. */
function firstSundayOffset(fromDays: number): number {
  let offset = fromDays;
  while (dayOfWeek(isoDate(offset)) !== 0) offset += 1;
  return offset;
}

function celebrantRadio(dialog: Locator, fullName: string) {
  return dialog.getByRole('radiogroup', { name: 'Presiding celebrant' }).getByRole('radio', { name: new RegExp(fullName) });
}

test.beforeEach(async () => {
  await resetAppointmentData();
  await resetPriestAvailability();
});

test.afterAll(async () => {
  await resetPriestAvailability();
});

test.describe('Availability conflicts are warnings the office can override', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('reschedule onto the celebrant weekly day off: warning shown, override saves', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    const dayOffDate = isoDate(firstWeekdayOffset(22));
    await addWeeklyDayOff('priest', dayOfWeek(dayOffDate), DAY_OFF_REASON);
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(dayOffDate);

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Scheduling conflict');
    await expect(warning).toContainText(DAY_OFF_REASON);
    await expect(warning).toContainText('You can still save this change');
    await expect(celebrantRadio(dialog, USERS.priest.fullName)).toContainText('Day Off');
    await warning.scrollIntoViewIfNeeded();
    await capture(page, 'edit-modal-reschedule-conflict');

    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('approved');
    expect(apt.appointment_date).toBe(dayOffDate);
    expect(apt.priest_id).toBe((await getSeed()).ids.priest);
    expect((await history(id)).map((r) => r.action)).toEqual(['reschedule']);
  });

  test('reschedule into a leave period warns, a free date clears it, and the override saves', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await addLeave('priest', isoDate(20), isoDate(24), LEAVE_REASON);
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    const warning = dialog.getByTestId('celebrant-conflict-warning');

    await dialog.getByLabel('New date').fill(isoDate(22));
    await expect(warning).toContainText(LEAVE_REASON);
    await expect(celebrantRadio(dialog, USERS.priest.fullName)).toContainText('On Retreat');

    await dialog.getByLabel('New date').fill(isoDate(30));
    await expect(warning).toHaveCount(0);
    await expect(dialog.getByText(`No conflicts found for ${USERS.priest.fullName}.`)).toBeVisible();

    await dialog.getByLabel('New date').fill(isoDate(23));
    await expect(warning).toContainText(LEAVE_REASON);
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).appointment_date).toBe(isoDate(23));
  });

  test('reschedule onto a double booking: time collision, then a softer notice, then override saves', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14, time: '09:00:00' });
    const targetOffset = firstWeekdayOffset(22);
    const target = isoDate(targetOffset);
    await createApprovedAppointment({ daysFromToday: targetOffset, time: '10:00:00', serviceType: 'Confirmation' });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(target);
    await dialog.getByLabel('New time').fill('10:00');

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Scheduling conflict');
    await expect(warning).toContainText('Temporal Conflict');
    await expect(warning).toContainText('Confirmation');
    await expect(celebrantRadio(dialog, USERS.priest.fullName)).toContainText('Time Collision');

    // A different time on the same day is no collision, only the daily Canon 905 count
    await dialog.getByLabel('New time').fill('11:00');
    await expect(warning).toContainText('Liturgical schedule notice');
    await expect(warning).toContainText('1/2 Canon 905 threshold');
    await expect(warning).not.toContainText('Temporal Conflict');

    await dialog.getByLabel('New time').fill('10:00');
    await expect(warning).toContainText('Temporal Conflict');
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.appointment_date).toBe(target);
    expect(apt.appointment_time).toBe('10:00:00');
    const { data: sameSlot } = await db
      .from('appointments')
      .select('id')
      .eq('priest_id', (await getSeed()).ids.priest)
      .eq('appointment_date', target)
      .eq('appointment_time', '10:00:00');
    expect(sameSlot).toHaveLength(2);
  });

  test('Canon 905 weekday limit: two celebrations already scheduled, the override still saves', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    const targetOffset = firstWeekdayOffset(22);
    const target = isoDate(targetOffset);
    await createApprovedAppointment({ daysFromToday: targetOffset, time: '07:00:00', serviceType: 'Confirmation' });
    await createApprovedAppointment({ daysFromToday: targetOffset, time: '16:00:00', serviceType: 'Blessing' });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(target);
    await dialog.getByLabel('New time').fill('12:00');

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Canon 905 Admonition');
    await expect(warning).toContainText('weekday (maximum 2 allowed by Canon 905 §1)');
    await expect(celebrantRadio(dialog, USERS.priest.fullName)).toContainText('Canon 905 Limit (2/2)');

    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.appointment_date).toBe(target);
    expect(apt.appointment_time).toBe('12:00:00');
  });

  test('Canon 905 Sunday limit is three: two already scheduled is only a notice', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    const sundayOffset = firstSundayOffset(22);
    await createApprovedAppointment({ daysFromToday: sundayOffset, time: '07:00:00', serviceType: 'Confirmation' });
    await createApprovedAppointment({ daysFromToday: sundayOffset, time: '16:00:00', serviceType: 'Blessing' });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(isoDate(sundayOffset));
    await dialog.getByLabel('New time').fill('12:00');

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Liturgical schedule notice');
    await expect(warning).toContainText('2/3 Canon 905 threshold');
    await expect(celebrantRadio(dialog, USERS.priest.fullName)).toContainText('2 scheduled');
  });

  test('change celebrant to a priest on leave: warning shown, override saves and both priests are notified', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ daysFromToday: 14, celebrant: 'priest' });
    await addLeave('priest2', isoDate(10), isoDate(16), LEAVE_REASON);
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Change celebrant/ }).click();
    await celebrantRadio(dialog, USERS.priest2.fullName).click();

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText(USERS.priest2.fullName);
    await expect(warning).toContainText(LEAVE_REASON);
    await expect(warning).toContainText('You can still save this change');
    await expect(celebrantRadio(dialog, USERS.priest2.fullName)).toContainText('On Retreat');

    await dialog.getByLabel('Reason for the change').fill(REASON);
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).priest_id).toBe(seed.ids.priest2);
    expect((await history(id)).map((r) => r.action)).toEqual(['change_celebrant']);
    expect(await notificationTitles(seed.ids.priest2)).toContain('New Sacramental Assignment');
    expect(await notificationTitles(seed.ids.priest)).toContain('Celebrant Assignment Removed');
  });

  test('change celebrant to a priest who is already presiding at that time: time collision warning, override saves', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ daysFromToday: 14, time: '10:00:00', celebrant: 'priest' });
    await createApprovedAppointment({ daysFromToday: 14, time: '10:00:00', celebrant: 'priest2', serviceType: 'Confirmation' });
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Change celebrant/ }).click();
    await celebrantRadio(dialog, USERS.priest2.fullName).click();

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Temporal Conflict');
    await expect(celebrantRadio(dialog, USERS.priest2.fullName)).toContainText('Time Collision');

    await dialog.getByLabel('Reason for the change').fill(REASON);
    await dialog.getByRole('button', { name: 'Change celebrant', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    expect((await appointment(id)).priest_id).toBe(seed.ids.priest2);
  });

  test('reschedule and switch celebrant in one save: the free priest clears the warning', async ({ page }) => {
    const seed = await getSeed();
    const id = await createApprovedAppointment({ daysFromToday: 14, celebrant: 'priest' });
    const dayOffDate = isoDate(firstWeekdayOffset(22));
    await addWeeklyDayOff('priest', dayOfWeek(dayOffDate), DAY_OFF_REASON);
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(dayOffDate);

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText(DAY_OFF_REASON);

    await celebrantRadio(dialog, USERS.priest2.fullName).click();
    await expect(warning).toHaveCount(0);
    await expect(dialog.getByText(`No conflicts found for ${USERS.priest2.fullName}.`)).toBeVisible();

    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.appointment_date).toBe(dayOffDate);
    expect(apt.priest_id).toBe(seed.ids.priest2);

    const rows = await history(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'reschedule', reason: REASON });
    expect(rows[0].before_values.priest_id).toBe(seed.ids.priest);
    expect(rows[0].after_values.priest_id).toBe(seed.ids.priest2);

    expect(await notificationTitles(seed.ids.priest2)).toContain('New Sacramental Assignment');
    expect(await notificationTitles(seed.ids.priest)).toContain('Celebrant Assignment Removed');
    expect(await notificationTitles(seed.ids.parishioner)).toContain('Appointment Rescheduled');
  });
});

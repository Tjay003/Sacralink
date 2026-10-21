import { test, expect, type Page } from '@playwright/test';
import {
  addLeave,
  addWeeklyDayOff,
  capture,
  clientAs,
  createApprovedAppointment,
  createPendingAppointment,
  dayOfWeek,
  firstWeekdayOffset,
  getSeed,
  isoDate,
  loginAs,
  resetAppointmentData,
  resetMassSchedules,
  resetPriestAvailability,
  serviceClient,
} from './support';

/**
 * Real end-to-end for the optional priest request at booking (ticket 15): the parishioner may ask for a
 * specific priest of the parish, the request is a preference (appointments.requested_priest_id) and never
 * the assignment (priest_id), an unavailable priest only produces a non-blocking warning that never says why,
 * and the office approval pre-selects the request and tells the parishioner when someone else presides.
 */

const LEAVE_REASON = 'Confidential medical leave';
const ANY_PRIEST = 'Any available priest';
const REQUESTED_PRIEST = 'Rev. Fr. Local Priest';
const WARNING_TEXT = 'is not available at this time';

const db = serviceClient();

/** A weekday (never a Sunday, so Canon 905 allows two) far enough ahead to be bookable. */
function weekdayDate(fromDays = 21): string {
  return isoDate(firstWeekdayOffset(fromDays));
}

async function openBooking(page: Page, churchId: string) {
  await page.goto(`/churches/${churchId}/book`);
  await expect(page.getByLabel(/Preferred Date/i)).toBeVisible();
}

async function fillSlot(page: Page, date: string, time: string) {
  await page.getByLabel(/Preferred Date/i).fill(date);
  await page.getByLabel(/Preferred Time/i).fill(time);
}

async function bookedAppointments() {
  const { data, error } = await db.from('appointments').select('*');
  if (error) throw error;
  return data ?? [];
}

async function appointment(id: string) {
  const { data, error } = await db.from('appointments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function notificationsFor(userId: string) {
  const { data, error } = await db.from('notifications').select('type,title,message').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

test.beforeEach(async () => {
  await resetAppointmentData();
  await resetPriestAvailability();
  await resetMassSchedules();
});

test.afterAll(async () => {
  await resetAppointmentData();
  await resetPriestAvailability();
  await resetMassSchedules();
});

test.describe('Preferred priest select on the booking form', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('lists the parish priests, defaults to Any available priest and saves the request', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);

    const select = page.getByLabel(/Preferred priest/i);
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('');
    await expect(select.locator('option')).toHaveText([ANY_PRIEST, 'Rev. Fr. Local Priest', 'Rev. Fr. Second Priest']);

    await fillSlot(page, date, '10:00');
    await select.selectOption(seed.ids.priest);
    await expect(page.getByTestId('preferred-priest-warning')).toHaveCount(0);
    await capture(page, 'booking-preferred-priest');
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByText('Request Sent!')).toBeVisible({ timeout: 15000 });

    const rows = await bookedAppointments();
    expect(rows).toHaveLength(1);
    expect(rows[0].requested_priest_id).toBe(seed.ids.priest);
    // A request is a preference: the celebrant is still assigned only at approval
    expect(rows[0].priest_id).toBeNull();
    expect(rows[0].status).toBe('pending');
  });

  test('leaving the default saves no request', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, weekdayDate(), '10:00');
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByText('Request Sent!')).toBeVisible({ timeout: 15000 });

    const rows = await bookedAppointments();
    expect(rows).toHaveLength(1);
    expect(rows[0].requested_priest_id).toBeNull();
    expect(rows[0].priest_id).toBeNull();
  });

  test('a priest on leave shows a non-blocking warning without the reason, and the request still submits', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addLeave('priest', date, date, LEAVE_REASON);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    await page.getByLabel(/Preferred priest/i).selectOption(seed.ids.priest);
    const warning = page.getByTestId('preferred-priest-warning');
    await expect(warning).toBeVisible({ timeout: 15000 });
    await expect(warning).toContainText(`${REQUESTED_PRIEST} ${WARNING_TEXT}`);
    await expect(page.locator('body')).not.toContainText(LEAVE_REASON);
    await expect(page.locator('body')).not.toContainText(/leave|retreat|day off|Canon/i);
    await capture(page, 'booking-preferred-priest-warning');

    // The warning never blocks: the pool still has the second priest, so the slot stays bookable
    const submit = page.getByRole('button', { name: /Submit Request/i });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('Request Sent!')).toBeVisible({ timeout: 15000 });
    const rows = await bookedAppointments();
    expect(rows).toHaveLength(1);
    expect(rows[0].requested_priest_id).toBe(seed.ids.priest);
  });

  test('a weekly day off warns for that priest only, and switching to Any available priest clears the warning', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addWeeklyDayOff('priest', dayOfWeek(date), 'Private family obligation');
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const select = page.getByLabel(/Preferred priest/i);
    await select.selectOption(seed.ids.priest2);
    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTestId('preferred-priest-warning')).toHaveCount(0);

    await select.selectOption(seed.ids.priest);
    await expect(page.getByTestId('preferred-priest-warning')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Private family obligation');

    await select.selectOption('');
    await expect(page.getByTestId('preferred-priest-warning')).toHaveCount(0);
  });

  test('a parish without priests does not show the select', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.otherChurchId);
    await fillSlot(page, weekdayDate(), '10:00');
    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
    await expect(page.getByLabel(/Preferred priest/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByText('Request Sent!')).toBeVisible({ timeout: 15000 });
    const rows = await bookedAppointments();
    expect(rows).toHaveLength(1);
    expect(rows[0].requested_priest_id).toBeNull();
  });
});

test.describe('The database guards the request', () => {
  test('a parishioner cannot request a priest of another parish', async () => {
    const seed = await getSeed();
    const parishioner = await clientAs('parishioner');
    const { error } = await parishioner.from('appointments').insert({
      user_id: seed.ids.parishioner,
      church_id: seed.otherChurchId,
      service_type: 'Baptism',
      appointment_date: weekdayDate(),
      appointment_time: '10:00:00',
      status: 'pending',
      requested_priest_id: seed.ids.priest,
    });
    expect(error).not.toBeNull();
    expect(await bookedAppointments()).toHaveLength(0);
  });

  test('a booking that names no priest, like the mobile app sends, still saves', async () => {
    const seed = await getSeed();
    const parishioner = await clientAs('parishioner');
    const { data, error } = await parishioner
      .from('appointments')
      .insert({
        user_id: seed.ids.parishioner,
        church_id: seed.churchId,
        service_type: 'Baptism',
        appointment_date: weekdayDate(),
        appointment_time: '10:00:00',
        status: 'pending',
      })
      .select('id,requested_priest_id')
      .single();
    expect(error).toBeNull();
    expect(data?.requested_priest_id).toBeNull();
  });

  test('deleting the profile of the requested priest clears the request and keeps the appointment', async () => {
    const seed = await getSeed();
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: 'temporary-requested-priest@local.test',
      password: 'LocalTest#123',
      email_confirm: true,
    });
    if (createErr) throw createErr;
    const tempId = created.user.id;
    try {
      const { error: profileErr } = await db.from('profiles').upsert({
        id: tempId,
        email: 'temporary-requested-priest@local.test',
        full_name: 'Temporary Requested Priest',
        role: 'priest',
        is_priest: true,
        church_id: seed.churchId,
        assigned_church_id: seed.churchId,
      });
      if (profileErr) throw profileErr;
      const { data: row, error: insertErr } = await db
        .from('appointments')
        .insert({
          user_id: seed.ids.parishioner,
          church_id: seed.churchId,
          service_type: 'Baptism',
          appointment_date: weekdayDate(),
          appointment_time: '10:00:00',
          status: 'pending',
          requested_priest_id: tempId,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      await db.from('profiles').delete().eq('id', tempId);
      const after = await appointment(row.id);
      expect(after.requested_priest_id).toBeNull();
    } finally {
      await db.auth.admin.deleteUser(tempId);
    }
  });
});

test.describe('Office approval honours the request', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('the approval modal pre-selects and labels the requested priest', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ daysFromToday: 21, requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Approve Sacramental Appointment');
    await expect(dialog.getByTestId('requested-priest-banner')).toContainText('Fr. Local Priest');
    await expect(dialog.locator('#celebrant-select')).toHaveValue(seed.ids.priest);
    await expect(dialog.locator('#celebrant-select option:checked')).toContainText('Requested');
    await capture(page, 'approve-modal-requested-priest');
  });

  test('approving the requested priest does not mention a substitution', async ({ page }) => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 21, requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#celebrant-select')).toHaveValue(seed.ids.priest);
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.priest_id).toBe(seed.ids.priest);
    expect(apt.requested_priest_id).toBe(seed.ids.priest);
    const [note] = await notificationsFor(seed.ids.parishioner);
    expect(note.type).toBe('appointment_approved');
    expect(note.message).toBe('Your Baptism appointment has been approved!');
  });

  test('approving a different priest tells the parishioner the requested priest could not be assigned', async ({ page }) => {
    const seed = await getSeed();
    const id = await createPendingAppointment({ daysFromToday: 21, requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#celebrant-select').selectOption(seed.ids.priest2);
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();
    await expect(dialog).toHaveCount(0);

    const apt = await appointment(id);
    expect(apt.status).toBe('approved');
    expect(apt.priest_id).toBe(seed.ids.priest2);
    expect(apt.requested_priest_id).toBe(seed.ids.priest);

    const notes = await notificationsFor(seed.ids.parishioner);
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('appointment_approved');
    expect(notes[0].message).toContain('Your Baptism appointment has been approved!');
    expect(notes[0].message).toContain('Fr. Local Priest');
    expect(notes[0].message).toContain('could not be assigned');
    expect(notes[0].message).toContain('Fr. Second Priest');
    // The substitute is notified of the assignment as before, the requested priest is not
    expect(await notificationsFor(seed.ids.priest2)).toHaveLength(1);
    expect(await notificationsFor(seed.ids.priest)).toHaveLength(0);
  });

  test('approving without any celebrant also tells the parishioner the request could not be assigned', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ daysFromToday: 21, requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#celebrant-select').selectOption('');
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();
    await expect(dialog).toHaveCount(0);

    const [note] = await notificationsFor(seed.ids.parishioner);
    expect(note.message).toContain('could not be assigned');
  });

  test('an unavailable requested priest is pre-selected but the office must resolve the conflict', async ({ page }) => {
    const date = isoDate(firstWeekdayOffset(21));
    await addLeave('priest', date, date, LEAVE_REASON);
    await createPendingAppointment({ daysFromToday: firstWeekdayOffset(21), requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('requested-priest-banner')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Approve Appointment' })).toBeDisabled({ timeout: 15000 });
  });
});

test.describe('The request is visible to the office, the priest and the parishioner', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('office appointments table shows who was requested', async ({ page }) => {
    await createPendingAppointment({ daysFromToday: 21, requestedPriest: 'priest' });
    await createPendingAppointment({ daysFromToday: 22, serviceType: 'Wedding' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    const requested = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(requested.getByTestId('requested-priest')).toContainText('Requested: Fr. Local Priest');
    const none = page.locator('table').locator('tr', { hasText: 'Holy Matrimony' });
    await expect(none.getByTestId('requested-priest')).toHaveCount(0);
    await capture(page, 'office-appointments-requested-priest');
  });

  test('a different celebrant on an approved appointment still shows the original request', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 21, celebrant: 'priest2', requestedPriest: 'priest' });
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row).toContainText('Fr. Second Priest');
    await expect(row.getByTestId('requested-priest')).toContainText('Requested: Fr. Local Priest');
  });

  test('the parishioner sees the requested priest on their appointment card', async ({ page }) => {
    await createPendingAppointment({ daysFromToday: 7, requestedPriest: 'priest2' });
    await loginAs(page, 'parishioner');

    await expect(page.getByTestId('requested-priest')).toContainText('Requested: Fr. Second Priest');
    await capture(page, 'parishioner-card-requested-priest');
  });

  test('the requested priest sees the request in the celebration details', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 0, time: '23:59:00', celebrant: 'priest', requestedPriest: 'priest' });
    await loginAs(page, 'priest');

    const row = page.locator('div.grid').filter({ hasText: 'Baptism' }).filter({ has: page.getByRole('button', { name: 'Details', exact: true }) });
    await expect(row.getByTestId('requested-priest')).toContainText('Requested: Fr. Local Priest');
    await row.getByRole('button', { name: 'Details', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('requested-priest')).toContainText('Requested: Fr. Local Priest');
    await capture(page, 'priest-details-requested-priest');
  });
});

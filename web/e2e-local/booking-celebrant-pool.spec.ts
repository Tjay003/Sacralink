import { test, expect, type Page } from '@playwright/test';
import {
  PASSWORD,
  addLeave,
  addMass,
  addWeeklyDayOff,
  clientAs,
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
 * Real end-to-end for the booking celebrant pool check (ticket 05): the booking form asks
 * check_parish_slot whether a slot is taken and whether any priest of the parish could preside, and the
 * two smart alternative cards are built from the same answer. The parishioner never picks a priest and
 * never sees why a priest is away.
 */

const LEAVE_REASON = 'Confidential medical leave';
const DAY_OFF_REASON = 'Private family obligation';
const UNAVAILABLE_MESSAGE = 'No celebrant is available at this time';
const TAKEN_MESSAGE = 'already booked by another parishioner';
/** Upper bound the recommender promises for check_parish_slot calls per availability check. */
const MAX_RPC_CALLS_PER_CHECK = 135;

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

/** Both seeded priests of Local Test Parish keep this weekday as their weekly day off. */
async function bothPriestsOffOn(date: string) {
  await addWeeklyDayOff('priest', dayOfWeek(date), DAY_OFF_REASON);
  await addWeeklyDayOff('priest2', dayOfWeek(date), DAY_OFF_REASON);
}

/** A priest of Other Test Parish, created for one test; `cleanup` removes the priest and the leave again. */
async function createPriestAtOtherParish(email: string) {
  const seed = await getSeed();
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const { error: profileErr } = await db.from('profiles').upsert({
    id,
    email,
    full_name: 'Temporary Other Priest',
    role: 'priest',
    is_priest: true,
    church_id: seed.otherChurchId,
    assigned_church_id: seed.otherChurchId,
  });
  if (profileErr) throw profileErr;
  return {
    /** Weekly day off (0 = Sunday ... 6 = Saturday). */
    async dayOff(dayOfWeekOff: number) {
      const { error: offErr } = await db
        .from('priest_availability')
        .insert({ priest_id: id, church_id: seed.otherChurchId, day_of_week: dayOfWeekOff, reason: DAY_OFF_REASON });
      if (offErr) throw offErr;
    },
    /** Leave from `start` to `end`, inclusive. */
    async leave(start: string, end: string) {
      const { error: leaveErr } = await db
        .from('priest_availability')
        .insert({ priest_id: id, church_id: seed.otherChurchId, blackout_start: start, blackout_end: end, reason: LEAVE_REASON });
      if (leaveErr) throw leaveErr;
    },
    async cleanup() {
      await db.from('priest_availability').delete().eq('priest_id', id);
      await db.auth.admin.deleteUser(id);
    },
  };
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

test.describe('Priest availability decides whether a parish slot is bookable', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('weekly day off of the only priests makes the slot unavailable, without the reason', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await bothPriestsOffOn(date);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(UNAVAILABLE_MESSAGE);
    await expect(section).not.toContainText(DAY_OFF_REASON);
    await expect(page.getByRole('button', { name: /Slot Unavailable/i })).toBeDisabled();
  });

  test('blackout leave of the only priests makes the slot unavailable, without the reason', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addLeave('priest', date, date, LEAVE_REASON);
    await addLeave('priest2', date, date, LEAVE_REASON);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(UNAVAILABLE_MESSAGE);
    await expect(section).not.toContainText(LEAVE_REASON);
  });

  test('the slot stays available while a second priest is eligible', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addWeeklyDayOff('priest', dayOfWeek(date), DAY_OFF_REASON);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTestId('smart-recommendations-section')).toHaveCount(0);
  });

  test('a recurring Mass at the same time takes every priest, so the slot is unavailable', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addMass(dayOfWeek(date), '10:00:00', 'priest');
    await addMass(dayOfWeek(date), '10:00:00', 'priest2');
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(UNAVAILABLE_MESSAGE);
  });

  test('a recurring Mass for only one priest leaves the other priest, so the slot is available', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addMass(dayOfWeek(date), '10:00:00', 'priest');
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
  });

  test('recurring Masses count toward the Canon 905 weekday limit of every priest', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    const dow = dayOfWeek(date);
    await addMass(dow, '05:00:00', 'priest');
    await addMass(dow, '06:00:00', 'priest');
    await addMass(dow, '05:30:00', 'priest2');
    await addMass(dow, '06:30:00', 'priest2');
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(UNAVAILABLE_MESSAGE);
  });
});

test.describe('Slots held by other parishioners', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('a pending request of another user is detected although row level security hides it', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    const { error } = await db.from('appointments').insert({
      user_id: seed.ids.church_admin,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: date,
      appointment_time: '10:00:00',
      status: 'pending',
    });
    if (error) throw error;

    const parishioner = await clientAs('parishioner');
    const { data: visible } = await parishioner.from('appointments').select('id').eq('appointment_date', date);
    expect(visible).toEqual([]);

    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(TAKEN_MESSAGE);
  });

  test('a cancelled request frees the slot again', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    const { error } = await db.from('appointments').insert({
      user_id: seed.ids.church_admin,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: date,
      appointment_time: '10:00:00',
      status: 'cancelled',
    });
    if (error) throw error;
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
  });
});

test.describe('Parishes without priests behave as before', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('an empty pool never blocks a slot, even when another parish has every priest away', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await bothPriestsOffOn(date);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.otherChurchId);
    await fillSlot(page, date, '10:00');

    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTestId('smart-recommendations-section')).toHaveCount(0);
  });

  test('an empty pool still reports a slot taken by someone else', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    const { error } = await db.from('appointments').insert({
      user_id: seed.ids.church_admin,
      church_id: seed.otherChurchId,
      service_type: 'Baptism',
      appointment_date: date,
      appointment_time: '10:00:00',
      status: 'approved',
    });
    if (error) throw error;
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.otherChurchId);
    await fillSlot(page, date, '10:00');

    const section = page.getByTestId('smart-recommendations-section');
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section).toContainText(TAKEN_MESSAGE);
  });
});

test.describe('Smart alternative cards', () => {
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('both cards render and Select This Slot fills the date and time', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await bothPriestsOffOn(date);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const sameChurch = page.getByTestId('recommendation-card-same-church');
    const nearby = page.getByTestId('recommendation-card-nearby-church');
    await expect(sameChurch).toBeVisible({ timeout: 15000 });
    await expect(nearby).toBeVisible();
    await expect(sameChurch).toContainText('Local Test Parish');
    await expect(nearby).toContainText('Other Test Parish');

    await sameChurch.getByRole('button', { name: /Select This Slot/i }).click();

    const dateInput = page.getByLabel(/Preferred Date/i);
    await expect(dateInput).not.toHaveValue(date);
    await expect(page.getByLabel(/Preferred Time/i)).toHaveValue('08:00');
    await expect(page.getByTestId('smart-recommendations-section')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled();
  });

  test('Select This Parish moves the booking to the nearby parish with the same date and time', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await bothPriestsOffOn(date);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    const nearby = page.getByTestId('recommendation-card-nearby-church');
    await expect(nearby).toBeVisible({ timeout: 15000 });
    await nearby.getByRole('button', { name: /Select This Parish/i }).click();

    await expect(page).toHaveURL(new RegExp(`/churches/${seed.otherChurchId}/book`));
    await expect(page.getByLabel(/Preferred Date/i)).toHaveValue(date);
    await expect(page.getByLabel(/Preferred Time/i)).toHaveValue('10:00');
    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
  });

  test('the nearby card skips a slot where the other parish has no eligible priest', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await bothPriestsOffOn(date);
    const otherPriest = await createPriestAtOtherParish('temporary-other-priest@local.test');
    try {
      await otherPriest.dayOff(dayOfWeek(date));
      await loginAs(page, 'parishioner');
      await openBooking(page, seed.churchId);
      await fillSlot(page, date, '10:00');

      const nearby = page.getByTestId('recommendation-card-nearby-church');
      await expect(nearby).toBeVisible({ timeout: 15000 });
      await expect(nearby).toContainText('Other Test Parish');
      await nearby.getByRole('button', { name: /Select This Parish/i }).click();
      await expect(page).toHaveURL(new RegExp(`/churches/${seed.otherChurchId}/book`));
      await expect(page.getByLabel(/Preferred Date/i)).not.toHaveValue(date);
      await expect(page.getByRole('button', { name: /Submit Request/i })).toBeEnabled({ timeout: 15000 });
    } finally {
      await otherPriest.cleanup();
    }
  });
});

test.describe('Privacy and cost', () => {
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('no leave reason, email or phone reaches the page or the network responses', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    await addLeave('priest', date, date, LEAVE_REASON);
    await addWeeklyDayOff('priest2', dayOfWeek(date), DAY_OFF_REASON);
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/rest/v1/rpc/')) return;
      try {
        bodies.push(await response.text());
      } catch {
        // The body is gone when the page navigates away; nothing to inspect.
      }
    });
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, date, '10:00');

    await expect(page.getByTestId('smart-recommendations-section')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('recommendation-card-same-church')).toBeVisible();

    const pageText = await page.locator('body').innerText();
    const everything = `${pageText}\n${bodies.join('\n')}`;
    for (const secret of [LEAVE_REASON, DAY_OFF_REASON, 'priest@local.test', 'priest2@local.test', '"reason"', '"email"', '"phone"']) {
      expect(everything).not.toContain(secret);
    }
    expect(bodies.some((body) => body.includes('has_eligible_priest'))).toBe(true);
  });

  test('scanning for alternatives stays within the call cap when nothing is open', async ({ page }) => {
    const seed = await getSeed();
    const date = weekdayDate();
    const horizonEnd = isoDate(firstWeekdayOffset(21) + 60);
    await addLeave('priest', date, horizonEnd, LEAVE_REASON);
    await addLeave('priest2', date, horizonEnd, LEAVE_REASON);
    const otherPriest = await createPriestAtOtherParish('temporary-capped-priest@local.test');
    try {
      await otherPriest.leave(date, horizonEnd);
      let calls = 0;
      page.on('request', (request) => {
        if (request.url().includes('/rest/v1/rpc/check_parish_slot')) calls += 1;
      });
      await loginAs(page, 'parishioner');
      await openBooking(page, seed.churchId);
      await fillSlot(page, date, '10:00');

      await expect(page.getByTestId('smart-recommendations-section')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/Checking\.\.\./)).toHaveCount(0, { timeout: 30000 });
      expect(calls).toBeGreaterThan(1);
      expect(calls).toBeLessThanOrEqual(MAX_RPC_CALLS_PER_CHECK);
      await expect(page.getByTestId('recommendation-card-same-church')).toHaveCount(0);
    } finally {
      await otherPriest.cleanup();
    }
  });
});

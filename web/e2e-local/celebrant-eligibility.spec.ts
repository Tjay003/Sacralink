import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  LOCAL_URL,
  PASSWORD,
  USERS,
  addLeave,
  addMass,
  addWeeklyDayOff,
  clientAs,
  createApprovedAppointment,
  createPendingAppointment,
  dayOfWeek,
  firstWeekdayOffset,
  getSeed,
  isoDate,
  loginAs,
  openEdit,
  resetAppointmentData,
  resetMassSchedules,
  resetPriestAvailability,
  serviceClient,
} from './support';

/**
 * Real end-to-end for the celebrant eligibility foundation (migration 054): the SQL layer that the
 * approval modal, the public clergy roster and the booking pool check all read. Calls the RPCs as the
 * roles that may call them and proves what each role is not allowed to see or run.
 */

const LEAVE_REASON = 'Medical leave: do not disclose';
const DAY_OFF_REASON = 'Personal retreat day, confidential';

const db = serviceClient();

interface Evaluation {
  priest_id: string;
  eligible: boolean;
  status: string;
  badge_text: string;
  badge_variant: string;
  warnings: string[];
  daily_count: number;
}

/** First offset at or after `fromDays` that falls on a Sunday. */
function firstSundayOffset(fromDays: number): number {
  let offset = fromDays;
  while (dayOfWeek(isoDate(offset)) !== 0) offset += 1;
  return offset;
}

async function evaluate(date: string, time: string, excludeAppointmentId: string | null = null) {
  const seed = await getSeed();
  const admin = await clientAs('church_admin');
  const { data, error } = await admin.rpc('evaluate_parish_celebrants', {
    p_church_id: seed.churchId,
    p_date: date,
    p_time: time,
    p_exclude_appointment_id: excludeAppointmentId,
  });
  if (error) throw error;
  const rows = data as Evaluation[];
  return {
    rows,
    of: (role: 'priest' | 'priest2') => rows.find((r) => r.priest_id === seed.ids[role])!,
  };
}

async function checkSlot(churchId: string, date: string, time: string) {
  const parishioner = await clientAs('parishioner');
  const { data, error } = await parishioner.rpc('check_parish_slot', { p_church_id: churchId, p_date: date, p_time: time });
  if (error) throw error;
  return (data as { slot_taken: boolean; has_eligible_priest: boolean }[])[0];
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

test.describe('Schema', () => {
  test('mass_schedules.presiding_priest_id is nullable and cleared when the priest is deleted', async () => {
    const seed = await getSeed();
    await addMass(0, '08:00:00');
    const { data: unassigned } = await db.from('mass_schedules').select('presiding_priest_id').eq('church_id', seed.churchId);
    expect(unassigned).toEqual([{ presiding_priest_id: null }]);

    const { data: created, error } = await db.auth.admin.createUser({
      email: 'temporary-priest@local.test',
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    try {
      await db.from('profiles').upsert({
        id: created.user.id,
        email: 'temporary-priest@local.test',
        full_name: 'Temporary Priest',
        role: 'priest',
        is_priest: true,
        church_id: seed.churchId,
        assigned_church_id: seed.churchId,
      });
      const { error: massErr } = await db
        .from('mass_schedules')
        .update({ presiding_priest_id: created.user.id })
        .eq('church_id', seed.churchId);
      if (massErr) throw massErr;
    } finally {
      await db.auth.admin.deleteUser(created.user.id);
    }

    const { data: afterDelete } = await db.from('mass_schedules').select('presiding_priest_id').eq('church_id', seed.churchId);
    expect(afterDelete).toEqual([{ presiding_priest_id: null }]);
  });
});

test.describe('Who can call what', () => {
  const anon = () => createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  test('anon cannot execute evaluate_parish_celebrants or check_parish_slot', async () => {
    const seed = await getSeed();
    const date = isoDate(14);
    const evaluation = await anon().rpc('evaluate_parish_celebrants', { p_church_id: seed.churchId, p_date: date, p_time: '10:00:00' });
    expect(evaluation.error?.code).toBe('42501');
    expect(evaluation.data).toBeNull();

    const slot = await anon().rpc('check_parish_slot', { p_church_id: seed.churchId, p_date: date, p_time: '10:00:00' });
    expect(slot.error?.code).toBe('42501');
    expect(slot.data).toBeNull();
  });

  test('authenticated users can execute all three RPCs', async () => {
    const seed = await getSeed();
    const parishioner = await clientAs('parishioner');
    const date = isoDate(14);
    for (const [name, args] of [
      ['get_parish_clergy', { p_church_id: seed.churchId }],
      ['evaluate_parish_celebrants', { p_church_id: seed.churchId, p_date: date, p_time: '10:00:00' }],
      ['check_parish_slot', { p_church_id: seed.churchId, p_date: date, p_time: '10:00:00' }],
    ] as const) {
      const { error } = await parishioner.rpc(name, args);
      expect(error, name).toBeNull();
    }
  });

  test('anon cannot read leave reasons from the table', async () => {
    await addLeave('priest', isoDate(10), isoDate(12), LEAVE_REASON);
    await addWeeklyDayOff('priest2', 3, DAY_OFF_REASON);
    const { data, error } = await anon().from('priest_availability').select('reason');
    expect(data ?? []).toEqual([]);
    if (error) expect(error.code).toBe('42501');
  });

  test('the roster is public and never contains leave reasons, emails or phone numbers', async () => {
    const seed = await getSeed();
    await addLeave('priest', isoDate(-1), isoDate(1), LEAVE_REASON);
    await db.from('profiles').update({ phone_number: '+639170000000' }).eq('id', seed.ids.priest);

    const { data, error } = await anon().rpc('get_parish_clergy', { p_church_id: seed.churchId });
    expect(error).toBeNull();
    const rows = data as Record<string, unknown>[];
    expect(rows.map((r) => r.name).sort()).toEqual(['Local Priest', 'Second Priest']);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['designation', 'name', 'priest_id', 'status', 'title']);
    }
    const body = JSON.stringify(rows);
    expect(body).not.toContain(LEAVE_REASON);
    expect(body).not.toContain('@local.test');
    expect(body).not.toContain('+639170000000');

    await db.from('profiles').update({ phone_number: null }).eq('id', seed.ids.priest);
  });

  test('evaluate_parish_celebrants never returns the leave reason', async () => {
    const date = isoDate(firstWeekdayOffset(14));
    await addWeeklyDayOff('priest', dayOfWeek(date), DAY_OFF_REASON);
    await addLeave('priest2', date, date, LEAVE_REASON);
    const { rows } = await evaluate(date, '10:00:00');
    const body = JSON.stringify(rows);
    expect(body).not.toContain(DAY_OFF_REASON);
    expect(body).not.toContain(LEAVE_REASON);
  });
});

test.describe('Priest-to-parish rule', () => {
  test('a priest belongs by assigned_church_id or church_id; an admin flagged is_priest counts; a plain church admin does not', async () => {
    const seed = await getSeed();
    const date = isoDate(firstWeekdayOffset(14));
    const members = async () => {
      const { rows } = await evaluate(date, '10:00:00');
      return rows.map((r) => r.priest_id).sort();
    };
    expect(await members()).toEqual([seed.ids.priest, seed.ids.priest2].sort());

    try {
      await db.from('profiles').update({ assigned_church_id: null }).eq('id', seed.ids.priest);
      expect(await members()).toEqual([seed.ids.priest, seed.ids.priest2].sort());
      await db.from('profiles').update({ assigned_church_id: seed.churchId, church_id: null }).eq('id', seed.ids.priest);
      expect(await members()).toEqual([seed.ids.priest, seed.ids.priest2].sort());

      await db.from('profiles').update({ is_priest: true, role: 'admin', church_id: seed.churchId }).eq('id', seed.ids.church_admin);
      expect(await members()).toEqual([seed.ids.church_admin, seed.ids.priest, seed.ids.priest2].sort());
    } finally {
      await db.from('profiles').update({ assigned_church_id: seed.churchId, church_id: seed.churchId }).eq('id', seed.ids.priest);
      await db.from('profiles').update({ is_priest: false, role: 'church_admin' }).eq('id', seed.ids.church_admin);
    }
    expect(await members()).toEqual([seed.ids.priest, seed.ids.priest2].sort());
  });
});

test.describe('Day off and leave', () => {
  test('a weekly day off makes the priest ineligible that weekday only', async () => {
    const date = isoDate(firstWeekdayOffset(14));
    await addWeeklyDayOff('priest', dayOfWeek(date), DAY_OFF_REASON);

    const onDayOff = (await evaluate(date, '10:00:00')).of('priest');
    expect(onDayOff).toMatchObject({ eligible: false, status: 'blackout', badge_text: 'Day Off', badge_variant: 'destructive' });
    expect(onDayOff.warnings).toHaveLength(1);
    expect(onDayOff.warnings[0]).toContain('weekly day off');

    const nextDay = isoDate(firstWeekdayOffset(14) + 1);
    expect((await evaluate(nextDay, '10:00:00')).of('priest').eligible).toBe(true);
    expect((await evaluate(date, '10:00:00')).of('priest2').eligible).toBe(true);
  });

  test('a blackout period is inclusive of its first and last day', async () => {
    await addLeave('priest', isoDate(20), isoDate(22), LEAVE_REASON);
    for (const offset of [20, 21, 22]) {
      const result = (await evaluate(isoDate(offset), '10:00:00')).of('priest');
      expect(result, `day ${offset}`).toMatchObject({ eligible: false, status: 'blackout', badge_text: 'Unavailable / Leave' });
    }
    for (const offset of [19, 23]) {
      expect((await evaluate(isoDate(offset), '10:00:00')).of('priest').eligible, `day ${offset}`).toBe(true);
    }
  });

  test('dashboard day off and leave change the clergy roster status for today', async () => {
    const seed = await getSeed();
    const roster = async () => {
      const { data, error } = await createClient(LOCAL_URL, ANON_KEY).rpc('get_parish_clergy', { p_church_id: seed.churchId });
      if (error) throw error;
      return Object.fromEntries((data as { priest_id: string; status: string }[]).map((r) => [r.priest_id, r.status]));
    };
    expect(await roster()).toEqual({ [seed.ids.priest]: 'available', [seed.ids.priest2]: 'available' });

    await addLeave('priest', isoDate(-1), isoDate(1), LEAVE_REASON);
    expect(await roster()).toEqual({ [seed.ids.priest]: 'on_leave', [seed.ids.priest2]: 'available' });

    await resetPriestAvailability();
    const todayManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).getDay();
    await addWeeklyDayOff('priest2', todayManila, DAY_OFF_REASON);
    expect(await roster()).toEqual({ [seed.ids.priest]: 'available', [seed.ids.priest2]: 'on_leave' });
  });

  test('a leave period changes whether the parish slot has an eligible priest', async () => {
    const seed = await getSeed();
    const date = isoDate(firstWeekdayOffset(14));
    expect(await checkSlot(seed.churchId, date, '10:00:00')).toMatchObject({ slot_taken: false, has_eligible_priest: true });

    await addLeave('priest', date, date, LEAVE_REASON);
    expect((await checkSlot(seed.churchId, date, '10:00:00')).has_eligible_priest).toBe(true);

    await addLeave('priest2', date, date, LEAVE_REASON);
    expect(await checkSlot(seed.churchId, date, '10:00:00')).toMatchObject({ slot_taken: false, has_eligible_priest: false });
  });
});

test.describe('Time collision', () => {
  test('an appointment at the same time collides, a different time does not', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await createApprovedAppointment({ daysFromToday: offset, time: '10:00:00', celebrant: 'priest', serviceType: 'Confirmation' });

    const collision = (await evaluate(date, '10:00:00')).of('priest');
    expect(collision).toMatchObject({ eligible: false, status: 'busy', badge_text: 'Time Collision', daily_count: 1 });
    expect(collision.warnings[0]).toContain('Temporal Conflict');
    expect(collision.warnings[0]).toContain('Confirmation');
    expect(collision.warnings[0]).toContain('10:00 AM');

    const later = (await evaluate(date, '11:00:00')).of('priest');
    expect(later).toMatchObject({ eligible: true, badge_text: '1 scheduled', badge_variant: 'warning', daily_count: 1 });
    expect(later.warnings).toEqual([expect.stringContaining('1/2 Canon 905 threshold')]);
  });

  test('a recurring Mass at the same time collides with an appointment slot', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await addMass(dayOfWeek(date), '07:30:00', 'priest');

    const collision = (await evaluate(date, '07:30:00')).of('priest');
    expect(collision).toMatchObject({ eligible: false, status: 'busy', badge_text: 'Time Collision', daily_count: 1 });
    expect(collision.warnings[0]).toContain('Mass');
    expect(collision.warnings[0]).toContain('7:30 AM');
    expect((await evaluate(date, '07:30:00')).of('priest2').eligible).toBe(true);
    expect((await evaluate(date, '09:00:00')).of('priest').eligible).toBe(true);
  });

  test('a Mass on another weekday, or with no presiding priest, does not count', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await addMass((dayOfWeek(date) + 1) % 7, '07:30:00', 'priest');
    await addMass(dayOfWeek(date), '07:30:00');

    const result = (await evaluate(date, '07:30:00')).of('priest');
    expect(result).toMatchObject({ eligible: true, daily_count: 0, badge_text: 'Available (0 commitments)', badge_variant: 'success' });
    expect(result.warnings).toEqual([]);
  });

  test('cancelled and rejected appointments and the excluded appointment do not count', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    const mine = await createApprovedAppointment({ daysFromToday: offset, time: '10:00:00', celebrant: 'priest' });
    const cancelled = await createApprovedAppointment({ daysFromToday: offset, time: '12:00:00', celebrant: 'priest' });
    await db.from('appointments').update({ status: 'cancelled' }).eq('id', cancelled);
    const rejected = await createApprovedAppointment({ daysFromToday: offset, time: '13:00:00', celebrant: 'priest' });
    await db.from('appointments').update({ status: 'rejected' }).eq('id', rejected);

    expect((await evaluate(date, '10:00:00')).of('priest')).toMatchObject({ eligible: false, daily_count: 1 });
    expect((await evaluate(date, '10:00:00', mine)).of('priest')).toMatchObject({ eligible: true, daily_count: 0 });
  });
});

test.describe('Canon 905 with Masses', () => {
  test('weekday: one appointment and one Mass reach the limit of two', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await createApprovedAppointment({ daysFromToday: offset, time: '16:00:00', celebrant: 'priest', serviceType: 'Blessing' });
    expect((await evaluate(date, '12:00:00')).of('priest')).toMatchObject({ eligible: true, daily_count: 1 });

    await addMass(dayOfWeek(date), '06:00:00', 'priest');
    const limited = (await evaluate(date, '12:00:00')).of('priest');
    expect(limited).toMatchObject({
      eligible: false,
      status: 'canon_limit',
      badge_text: 'Canon 905 Limit (2/2)',
      badge_variant: 'destructive',
      daily_count: 2,
    });
    expect(limited.warnings[0]).toContain('Canon 905 Admonition');
    expect(limited.warnings[0]).toContain('weekday (maximum 2 allowed by Canon 905');
  });

  test('weekday: two Masses alone reach the limit', async () => {
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await addMass(dayOfWeek(date), '06:00:00', 'priest');
    await addMass(dayOfWeek(date), '18:00:00', 'priest');
    expect((await evaluate(date, '12:00:00')).of('priest')).toMatchObject({ eligible: false, status: 'canon_limit', daily_count: 2 });
  });

  test('Sunday: the limit is three, so two Masses are only a notice and three reach the limit', async () => {
    const offset = firstSundayOffset(14);
    const date = isoDate(offset);
    await addMass(0, '06:00:00', 'priest');
    await addMass(0, '08:00:00', 'priest');

    const notice = (await evaluate(date, '12:00:00')).of('priest');
    expect(notice).toMatchObject({ eligible: true, badge_text: '2 scheduled', badge_variant: 'warning', daily_count: 2 });
    expect(notice.warnings).toEqual([expect.stringContaining('2/3 Canon 905 threshold')]);

    await createApprovedAppointment({ daysFromToday: offset, time: '16:00:00', celebrant: 'priest', serviceType: 'Wedding' });
    const limited = (await evaluate(date, '12:00:00')).of('priest');
    expect(limited).toMatchObject({ eligible: false, badge_text: 'Canon 905 Limit (3/3)', daily_count: 3 });
    expect(limited.warnings[0]).toContain('Sunday (maximum 3 allowed by Canon 905');
  });

  test('a priest with several Masses on Sunday does not affect the other priest', async () => {
    const date = isoDate(firstSundayOffset(14));
    await addMass(0, '06:00:00', 'priest');
    await addMass(0, '08:00:00', 'priest');
    await addMass(0, '10:00:00', 'priest');
    const { of } = await evaluate(date, '12:00:00');
    expect(of('priest').eligible).toBe(false);
    expect(of('priest2')).toMatchObject({ eligible: true, daily_count: 0 });
  });
});

test.describe('Roster status: in Mass', () => {
  test('a priest is in Mass during the hour a presiding Mass starts, and available afterwards', async () => {
    const seed = await getSeed();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
    await addMass(now.getDay(), hhmm, 'priest');

    const roster = async () => {
      const { data, error } = await createClient(LOCAL_URL, ANON_KEY).rpc('get_parish_clergy', { p_church_id: seed.churchId });
      if (error) throw error;
      return Object.fromEntries((data as { priest_id: string; status: string }[]).map((r) => [r.priest_id, r.status]));
    };
    expect(await roster()).toEqual({ [seed.ids.priest]: 'in_mass', [seed.ids.priest2]: 'available' });

    await resetMassSchedules();
    await addMass((now.getDay() + 1) % 7, hhmm, 'priest');
    expect(await roster()).toEqual({ [seed.ids.priest]: 'available', [seed.ids.priest2]: 'available' });
  });

  test('leave outranks in Mass', async () => {
    const seed = await getSeed();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    await addMass(now.getDay(), `${pad(now.getHours())}:${pad(now.getMinutes())}:00`, 'priest');
    await addWeeklyDayOff('priest', now.getDay(), DAY_OFF_REASON);
    const { data } = await createClient(LOCAL_URL, ANON_KEY).rpc('get_parish_clergy', { p_church_id: seed.churchId });
    expect((data as { priest_id: string; status: string }[]).find((r) => r.priest_id === seed.ids.priest)?.status).toBe('on_leave');
  });
});

test.describe('Empty pool and slot check', () => {
  test('a parish with no priests has no priest constraint', async () => {
    const seed = await getSeed();
    const date = isoDate(firstWeekdayOffset(14));
    const admin = await clientAs('other_admin');

    const { data: pool, error } = await admin.rpc('evaluate_parish_celebrants', { p_church_id: seed.otherChurchId, p_date: date, p_time: '10:00:00' });
    expect(error).toBeNull();
    expect(pool).toEqual([]);

    expect(await checkSlot(seed.otherChurchId, date, '10:00:00')).toMatchObject({ slot_taken: false, has_eligible_priest: true });

    const { data: roster } = await createClient(LOCAL_URL, ANON_KEY).rpc('get_parish_clergy', { p_church_id: seed.otherChurchId });
    expect(roster).toEqual([]);
  });

  test('the slot is taken by a pending or approved request for any parishioner, not by cancelled or rejected ones', async () => {
    const seed = await getSeed();
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    expect((await checkSlot(seed.churchId, date, '09:00:00')).slot_taken).toBe(false);

    const pending = await createPendingAppointment({ daysFromToday: offset, time: '09:00:00' });
    expect((await checkSlot(seed.churchId, date, '09:00:00')).slot_taken).toBe(true);
    expect((await checkSlot(seed.churchId, date, '09:30:00')).slot_taken).toBe(false);
    expect((await checkSlot(seed.otherChurchId, date, '09:00:00')).slot_taken).toBe(false);

    await db.from('appointments').update({ status: 'cancelled' }).eq('id', pending);
    expect((await checkSlot(seed.churchId, date, '09:00:00')).slot_taken).toBe(false);
    await db.from('appointments').update({ status: 'rejected' }).eq('id', pending);
    expect((await checkSlot(seed.churchId, date, '09:00:00')).slot_taken).toBe(false);
  });

  test('a parishioner cannot see other bookings directly but the slot check still reports them', async () => {
    const seed = await getSeed();
    const offset = firstWeekdayOffset(14);
    await createApprovedAppointment({ daysFromToday: offset, time: '15:00:00' });
    const { data: other } = await db.from('appointments').select('user_id').eq('church_id', seed.churchId);
    expect(other).toHaveLength(1);

    const stranger = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: noAccess } = await stranger.from('appointments').select('id');
    expect(noAccess ?? []).toEqual([]);

    expect((await checkSlot(seed.churchId, isoDate(offset), '15:00:00')).slot_taken).toBe(true);
  });

  test('every priest booked at the slot leaves no eligible priest while the slot itself is free', async () => {
    const seed = await getSeed();
    const offset = firstWeekdayOffset(14);
    const date = isoDate(offset);
    await addMass(dayOfWeek(date), '09:00:00', 'priest');
    await addMass(dayOfWeek(date), '09:00:00', 'priest2');
    expect(await checkSlot(seed.churchId, date, '09:00:00')).toMatchObject({ slot_taken: false, has_eligible_priest: false });
    expect(await checkSlot(seed.churchId, date, '10:00:00')).toMatchObject({ slot_taken: false, has_eligible_priest: true });
  });
});

test.describe('Masses count in the approval modal', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('the Edit modal flags a priest whose recurring Mass sits at the new time', async ({ page }) => {
    await createApprovedAppointment({ daysFromToday: 14, time: '09:00:00' });
    const targetOffset = firstWeekdayOffset(22);
    const target = isoDate(targetOffset);
    await addMass(dayOfWeek(target), '10:00:00', 'priest');
    await loginAs(page, 'church_admin');

    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(target);
    await dialog.getByLabel('New time').fill('10:00');

    const warning = dialog.getByTestId('celebrant-conflict-warning');
    await expect(warning).toContainText('Scheduling conflict');
    await expect(warning).toContainText('Temporal Conflict');
    await expect(warning).toContainText('Mass');
    await expect(dialog.getByRole('radiogroup', { name: 'Presiding celebrant' }).getByRole('radio', { name: /Local Priest/ })).toContainText(
      'Time Collision'
    );
  });

  test('the Approve modal shows the Canon 905 limit reached through recurring Masses and recommends the free priest', async ({ page }) => {
    const seed = await getSeed();
    const offset = firstWeekdayOffset(14);
    await createPendingAppointment({ daysFromToday: offset, time: '12:00:00' });
    await addMass(dayOfWeek(isoDate(offset)), '06:00:00', 'priest');
    await addMass(dayOfWeek(isoDate(offset)), '18:00:00', 'priest');
    await loginAs(page, 'church_admin');

    await page.goto('/appointments');
    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const select = dialog.locator('#celebrant-select');
    await expect(select.locator(`option[value="${seed.ids.priest}"]`)).toHaveText(/Canon 905 Limit \(2\/2\)/);
    await expect(select.locator(`option[value="${seed.ids.priest2}"]`)).toHaveText(/Available \(0 commitments\)/);
    await expect(dialog).toContainText('Recommended Celebrant');
    await expect(dialog).toContainText(USERS.priest2.fullName);
  });
});

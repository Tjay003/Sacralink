import { supabase } from '../supabase';
import type { Database } from '../../types/database';

export type PriestAvailability = Database['public']['Tables']['priest_availability']['Row'];
export type PriestAvailabilityInsert = Database['public']['Tables']['priest_availability']['Insert'];
export type PriestAvailabilityUpdate = Database['public']['Tables']['priest_availability']['Update'];

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface PriestAvailabilityData {
  recurringDayOff: number | null; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday, null = none
  dayOffRecord: PriestAvailability | null;
  blackoutPeriods: PriestAvailability[];
  allRecords: PriestAvailability[];
}

export interface PriestAvailabilityCheckResult {
  available: boolean;
  reason?: string;
}

/**
 * Normalizes any error object (including PostgREST error objects) into a standard Error
 */
function toError(err: unknown): Error {
  if (!err) return new Error('An unknown error occurred.');
  if (err instanceof Error) return err;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const msg = typeof obj.message === 'string' ? obj.message : '';
    const code = typeof obj.code === 'string' ? obj.code : '';
    if (code === 'PGRST204' || msg.includes('day_of_week') || msg.includes('schema cache')) {
      return new Error(
        'Database update required: The "priest_availability" table needs migration 042. Please run 042_create_priest_availability.sql in the Supabase SQL Editor.'
      );
    }
    if (msg) return new Error(msg);
  }
  return new Error(String(err));
}

/**
 * Fetches Father's recurring weekly day-off and upcoming/current blackout leave periods.
 *
 * @param priestId - Profile ID of the priest
 * @returns Object containing recurring day off and list of blackout periods
 */
export async function getPriestAvailability(
  priestId: string
): Promise<{ data: PriestAvailabilityData | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('priest_availability')
      .select('*')
      .eq('priest_id', priestId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allRecords: PriestAvailability[] = data || [];

    // Recurring day off record (day_of_week is 0-6)
    const dayOffRecord = allRecords.find(
      (r) => r.day_of_week !== null && r.day_of_week !== undefined
    ) || null;

    const recurringDayOff = dayOffRecord?.day_of_week ?? null;

    // Blackout periods (retreats, study leave, sick leaves)
    const blackoutPeriods = allRecords
      .filter((r) => Boolean(r.blackout_start && r.blackout_end))
      .sort((a, b) => {
        const startA = a.blackout_start || '';
        const startB = b.blackout_start || '';
        return startA.localeCompare(startB);
      });

    return {
      data: {
        recurringDayOff,
        dayOffRecord,
        blackoutPeriods,
        allRecords,
      },
      error: null,
    };
  } catch (err: unknown) {
    console.error('Error in getPriestAvailability:', err);
    return { data: null, error: toError(err) };
  }
}

/**
 * Sets or removes Father's recurring weekly day-off.
 * Passing dayOfWeek = null clears Father's recurring day off.
 *
 * Overloads support both (priestId, churchId, dayOfWeek) and (priestId, dayOfWeek).
 */
export async function upsertDayOff(
  priestId: string,
  churchId: string | null,
  dayOfWeek: number | null
): Promise<{ data: PriestAvailability | null; error: Error | null }>;
export async function upsertDayOff(
  priestId: string,
  dayOfWeek: number | null
): Promise<{ data: PriestAvailability | null; error: Error | null }>;
export async function upsertDayOff(
  priestId: string,
  arg2: string | number | null,
  arg3?: number | null
): Promise<{ data: PriestAvailability | null; error: Error | null }> {
  try {
    let churchId: string | null = null;
    let dayOfWeek: number | null = null;

    if (typeof arg2 === 'number' || (arg2 === null && arg3 === undefined)) {
      dayOfWeek = arg2;
    } else {
      churchId = arg2;
      dayOfWeek = arg3 ?? null;
    }

    if (dayOfWeek !== null && (dayOfWeek < 0 || dayOfWeek > 6)) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday).');
    }

    // Look for existing recurring day off records for this priest
    const { data: existing, error: fetchErr } = await supabase
      .from('priest_availability')
      .select('*')
      .eq('priest_id', priestId)
      .not('day_of_week', 'is', null);

    if (fetchErr) throw fetchErr;

    // Case 1: Priest wants to clear their day off
    if (dayOfWeek === null) {
      if (existing && existing.length > 0) {
        const ids = existing.map((r) => r.id);
        const { error: deleteErr } = await supabase
          .from('priest_availability')
          .delete()
          .in('id', ids);
        if (deleteErr) throw deleteErr;
      }
      return { data: null, error: null };
    }

    // Case 2: Update existing day off record
    if (existing && existing.length > 0) {
      const primaryRecord = existing[0];
      const { data: updated, error: updateErr } = await supabase
        .from('priest_availability')
        .update({
          day_of_week: dayOfWeek,
          church_id: churchId ?? primaryRecord.church_id,
          reason: 'Canonical Weekly Day Off',
          updated_at: new Date().toISOString(),
        })
        .eq('id', primaryRecord.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Clean up duplicates if multiple existed
      if (existing.length > 1) {
        const extraIds = existing.slice(1).map((r) => r.id);
        await supabase.from('priest_availability').delete().in('id', extraIds);
      }

      return { data: updated, error: null };
    }

    // Case 3: Insert new day off record
    const { data: inserted, error: insertErr } = await supabase
      .from('priest_availability')
      .insert({
        priest_id: priestId,
        church_id: churchId,
        day_of_week: dayOfWeek,
        reason: 'Canonical Weekly Day Off',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    return { data: inserted, error: null };
  } catch (err: unknown) {
    console.error('Error in upsertDayOff:', err);
    return { data: null, error: toError(err) };
  }
}

/**
 * Adds a blackout period (e.g., diocesan retreat, sick leave, canonical study leave).
 *
 * Overloads support both:
 * - addBlackoutPeriod(priestId, churchId, start, end, reason)
 * - addBlackoutPeriod(priestId, start, end, reason)
 */
export async function addBlackoutPeriod(
  priestId: string,
  churchId: string | null,
  start: string,
  end: string,
  reason: string
): Promise<{ data: PriestAvailability | null; error: Error | null }>;
export async function addBlackoutPeriod(
  priestId: string,
  start: string,
  end: string,
  reason: string
): Promise<{ data: PriestAvailability | null; error: Error | null }>;
export async function addBlackoutPeriod(
  priestId: string,
  arg2: string | null,
  arg3: string,
  arg4?: string,
  arg5?: string
): Promise<{ data: PriestAvailability | null; error: Error | null }> {
  try {
    let churchId: string | null = null;
    let start: string;
    let end: string;
    let reason = 'Clergy Retreat / Leave';

    const isDatePattern = /^\d{4}-\d{2}-\d{2}/;
    if (arg2 && isDatePattern.test(arg2)) {
      start = arg2;
      end = arg3;
      reason = arg4 || 'Clergy Retreat / Leave';
    } else {
      churchId = arg2;
      start = arg3;
      end = arg4 || arg3;
      reason = arg5 || 'Clergy Retreat / Leave';
    }

    const cleanStart = start.includes('T') ? start.split('T')[0] : start.trim();
    const cleanEnd = end.includes('T') ? end.split('T')[0] : end.trim();

    if (cleanStart > cleanEnd) {
      throw new Error('Blackout start date cannot be after end date.');
    }

    const { data, error } = await supabase
      .from('priest_availability')
      .insert({
        priest_id: priestId,
        church_id: churchId,
        blackout_start: cleanStart,
        blackout_end: cleanEnd,
        reason: reason.trim() || 'Clergy Retreat / Leave',
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err: unknown) {
    console.error('Error in addBlackoutPeriod:', err);
    return { data: null, error: toError(err) };
  }
}

/**
 * Removes a blackout period record by ID.
 *
 * @param id - UUID of the priest_availability record
 */
export async function deleteBlackoutPeriod(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('priest_availability')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    console.error('Error in deleteBlackoutPeriod:', err);
    return { success: false, error: toError(err) };
  }
}

/**
 * Checks whether a priest is canonically available on a given date string (YYYY-MM-DD or ISO).
 * Evaluates:
 * 1. Father's recurring weekly day-off (via DayOfWeek index 0-6).
 * 2. Active blackout dates (blackout_start <= date <= blackout_end).
 * 3. Legacy single-day blocked dates (available_date and is_blocked).
 *
 * @param priestId - Profile ID of the celebrant
 * @param dateStr - Date string formatted as YYYY-MM-DD or ISO string
 * @returns { available: boolean, reason?: string }
 */
export async function checkPriestIsAvailable(
  priestId: string,
  dateStr: string
): Promise<PriestAvailabilityCheckResult> {
  try {
    if (!priestId || !dateStr) {
      return { available: true };
    }

    const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
    const parts = cleanDateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return { available: true };
    }

    const [year, month, day] = parts;
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    const { data: records, error } = await supabase
      .from('priest_availability')
      .select('*')
      .eq('priest_id', priestId);

    if (error) {
      console.warn('⚠️ Error checking priest availability:', error);
      return { available: true };
    }

    if (!records || records.length === 0) {
      return { available: true };
    }

    // 1. Check recurring weekly day-off
    const dayOffMatch = records.find((r) => r.day_of_week === dayOfWeek);
    if (dayOffMatch) {
      return {
        available: false,
        reason:
          dayOffMatch.reason ||
          `Father is on his weekly day off (${DAY_NAMES[dayOfWeek]}).`,
      };
    }

    // 2. Check active blackout leave / retreat period
    const blackoutMatch = records.find((r) => {
      if (!r.blackout_start || !r.blackout_end) return false;
      return cleanDateStr >= r.blackout_start && cleanDateStr <= r.blackout_end;
    });

    if (blackoutMatch) {
      return {
        available: false,
        reason: blackoutMatch.reason || 'Father is away on clergy leave or retreat.',
      };
    }

    // 3. Backward-compatible check for legacy single-day blocked dates
    const legacyMatch = records.find(
      (r) => r.available_date === cleanDateStr && r.is_blocked === true
    );
    if (legacyMatch) {
      return {
        available: false,
        reason: legacyMatch.notes || 'Father is marked unavailable on this date.',
      };
    }

    return { available: true };
  } catch (err: unknown) {
    console.error('Error in checkPriestIsAvailable:', err);
    return { available: true };
  }
}

export type ParishClergyStatus = 'available' | 'in_mass' | 'on_leave';

export interface ParishClergyMember {
  priestId: string;
  /** Display name without honorific; render it after `title`. */
  name: string;
  /** Honorific, e.g. "Rev. Fr.". */
  title: string;
  /** Role in the parish, e.g. "Priest" or "Parish Administrator". */
  designation: string;
  /** Computed for today; day off and leave both read as on_leave and never expose the reason. */
  status: ParishClergyStatus;
}

export type ParishCelebrantStatus = 'available' | 'busy' | 'blackout' | 'canon_limit';

export interface ParishCelebrantEligibility {
  priestId: string;
  eligible: boolean;
  status: ParishCelebrantStatus;
  badgeText: string;
  badgeVariant: 'success' | 'warning' | 'destructive';
  warnings: string[];
  /** Appointments plus recurring Masses the priest presides at on that day. */
  dailyCount: number;
}

export interface ParishSlotCheck {
  /** A pending or approved request already holds this parish, date and time. */
  slotTaken: boolean;
  /** True when at least one priest of the parish is eligible, and also when the parish has no priests. */
  hasEligiblePriest: boolean;
  /** Priests assigned to the parish; 0 means there is no priest constraint. */
  priestCount: number;
}

/** Date part of a YYYY-MM-DD or ISO string. */
function toDateParam(dateStr: string): string {
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
}

/** Blank times become null so the database skips the time collision check. */
function toTimeParam(timeStr: string | null | undefined): string | null {
  const trimmed = (timeStr || '').trim();
  return trimmed || null;
}

/**
 * The parish roster with each priest's status for today, from the get_parish_clergy function.
 * Callable while logged out. Contains no leave reason, email or phone number.
 */
export async function getParishClergy(
  churchId: string
): Promise<{ data: ParishClergyMember[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_parish_clergy', { p_church_id: churchId });
    if (error) throw error;
    return {
      data: (data || []).map((row) => ({
        priestId: row.priest_id,
        name: row.name,
        title: row.title,
        designation: row.designation,
        status: row.status as ParishClergyStatus,
      })),
      error: null,
    };
  } catch (err: unknown) {
    console.error('Error in getParishClergy:', err);
    return { data: [], error: toError(err) };
  }
}

/**
 * Eligibility of every priest of the parish for one slot, from the evaluate_parish_celebrants function:
 * day off and leave, time collision, and the Canon 905 limit counting appointments and recurring Masses.
 * An empty list means the parish has no priests. `excludeAppointmentId` leaves the appointment being
 * edited out of the priest's own load.
 */
export async function evaluateParishPool(
  churchId: string,
  dateStr: string,
  timeStr: string | null | undefined,
  excludeAppointmentId?: string | null
): Promise<{ data: ParishCelebrantEligibility[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('evaluate_parish_celebrants', {
      p_church_id: churchId,
      p_date: toDateParam(dateStr),
      p_time: toTimeParam(timeStr),
      p_exclude_appointment_id: excludeAppointmentId ?? null,
    });
    if (error) throw error;
    return {
      data: (data || []).map((row) => ({
        priestId: row.priest_id,
        eligible: row.eligible,
        status: row.status as ParishCelebrantStatus,
        badgeText: row.badge_text,
        badgeVariant: row.badge_variant as ParishCelebrantEligibility['badgeVariant'],
        warnings: row.warnings,
        dailyCount: row.daily_count,
      })),
      error: null,
    };
  } catch (err: unknown) {
    console.error('Error in evaluateParishPool:', err);
    return { data: [], error: toError(err) };
  }
}

/**
 * Whether a parish slot is already taken and whether at least one priest could preside, from the
 * check_parish_slot function. It sees every parishioner's bookings, which row level security hides
 * from the browser. Requires a logged-in user.
 */
export async function checkParishSlot(
  churchId: string,
  dateStr: string,
  timeStr: string
): Promise<{ data: ParishSlotCheck | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('check_parish_slot', {
      p_church_id: churchId,
      p_date: toDateParam(dateStr),
      p_time: timeStr.trim(),
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('check_parish_slot returned no row.');
    return {
      data: {
        slotTaken: row.slot_taken,
        hasEligiblePriest: row.has_eligible_priest,
        priestCount: row.priest_count,
      },
      error: null,
    };
  } catch (err: unknown) {
    console.error('Error in checkParishSlot:', err);
    return { data: null, error: toError(err) };
  }
}

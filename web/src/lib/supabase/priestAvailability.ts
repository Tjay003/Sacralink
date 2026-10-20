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

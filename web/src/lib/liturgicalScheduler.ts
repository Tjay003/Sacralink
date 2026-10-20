import { supabase } from './supabase';
import { checkPriestIsAvailable } from './supabase/priestAvailability';
import { formatAppointmentTime } from './supabase/appointments';
import type { Profile } from '../types/database';

export const CANON_905_LIMITS = {
  WEEKDAY: 2,
  SUNDAY: 3,
} as const;

export interface CelebrantEvaluation {
  eligible: boolean;
  status: 'available' | 'busy' | 'blackout' | 'canon_limit';
  badgeText: string;
  badgeVariant: 'success' | 'warning' | 'destructive';
  warnings: string[];
  dailyCount: number;
}

export interface ParishCelebrantsEvaluation {
  evaluations: Record<string, CelebrantEvaluation>;
  recommendedPriestId: string | null;
  recommendedPriest: Profile | null;
}

/**
 * Normalizes time string into HH:mm (e.g. "09:00:00" -> "09:00", "9:00" -> "09:00").
 */
export function normalizeTime(t: string | null | undefined): string {
  if (!t) return '';
  const trimmed = t.trim().toUpperCase();
  const isPM = trimmed.includes('PM');
  const isAM = trimmed.includes('AM');
  const timeOnly = trimmed.replace(/\s*[AP]M\s*/i, '');
  const parts = timeOnly.split(':');
  if (parts.length < 2) return trimmed;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0').slice(0, 2);

  if (isNaN(hours)) return trimmed;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Checks whether the given date is a Sunday.
 * Uses local calendar parsing to avoid timezone offset shifts.
 */
export function isSundayDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = cleanDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return false;
  }
  const [year, month, day] = parts;
  const targetDate = new Date(year, month - 1, day);
  return targetDate.getDay() === 0;
}

/**
 * Returns the maximum permitted Masses/sacraments under Canon 905 (§1 & §2).
 * - Weekdays (Monday through Saturday): 2 Masses (bination)
 * - Sundays and Holy Days of Obligation: 3 Masses (trination)
 */
export function getMaxCanonMasses(dateStr: string): number {
  return isSundayDate(dateStr) ? CANON_905_LIMITS.SUNDAY : CANON_905_LIMITS.WEEKDAY;
}

/**
 * Evaluates whether a priest can be assigned to an appointment on a specific date and time,
 * adhering to Canon 905 Mass frequency limits, temporal collision avoidance, and clergy availability.
 *
 * @param priestId - ID of the celebrant profile
 * @param appointmentDate - Date of the sacrament (YYYY-MM-DD or ISO)
 * @param appointmentTime - Scheduled time of the sacrament
 * @param churchId - Church where the sacrament takes place
 * @param currentAppointmentId - Optional current appointment ID to exclude from self-collision
 */
export async function evaluateCelebrantAssignment(
  priestId: string,
  appointmentDate: string,
  appointmentTime: string,
  _churchId?: string,
  currentAppointmentId?: string
): Promise<CelebrantEvaluation> {
  if (!priestId || !appointmentDate) {
    return {
      eligible: true,
      status: 'available',
      badgeText: 'Available',
      badgeVariant: 'success',
      warnings: [],
      dailyCount: 0,
    };
  }

  const cleanDateStr = appointmentDate.includes('T') ? appointmentDate.split('T')[0] : appointmentDate.trim();
  const isSunday = isSundayDate(cleanDateStr);
  const maxDailyAllowed = getMaxCanonMasses(cleanDateStr);
  const warnings: string[] = [];

  try {
    // 1. Check weekly day-off and retreat blackout periods
    const availability = await checkPriestIsAvailable(priestId, cleanDateStr);
    const isBlackoutOrDayOff = !availability.available;

    if (isBlackoutOrDayOff) {
      warnings.push(
        availability.reason ||
          'Father is unavailable on this date due to scheduled leave or canonical weekly day off.'
      );
    }

    // 2. Query appointments for this priest on the given date (excluding cancelled/rejected and current)
    let query = supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, service_type, status')
      .eq('priest_id', priestId)
      .eq('appointment_date', cleanDateStr)
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    if (currentAppointmentId) {
      query = query.neq('id', currentAppointmentId);
    }

    const { data: rawAppts, error: apptsError } = await query;

    if (apptsError) {
      console.warn('⚠️ Non-fatal error querying priest appointments:', apptsError);
    }

    const activeAppts = (rawAppts || []).filter(
      (a) =>
        a.status !== 'cancelled' &&
        a.status !== 'rejected' &&
        (!currentAppointmentId || a.id !== currentAppointmentId)
    );

    const dailyCount = activeAppts.length;

    // a) Exact temporal collision at appointment_time
    const targetNormTime = normalizeTime(appointmentTime);
    const timeConflictAppt = targetNormTime
      ? activeAppts.find((a) => normalizeTime(a.appointment_time) === targetNormTime)
      : undefined;

    const hasTimeConflict = Boolean(timeConflictAppt);
    if (hasTimeConflict) {
      const formattedHour = formatAppointmentTime(appointmentTime);
      warnings.push(
        `Temporal Conflict: Father is already presiding another liturgy (${timeConflictAppt?.service_type || 'Sacrament'}) at ${formattedHour}.`
      );
    }

    // b) Total count against Canon 905 limits
    const hasCanonLimitConflict = dailyCount >= maxDailyAllowed;
    if (hasCanonLimitConflict) {
      warnings.push(
        `Canon 905 Admonition: Father already has ${dailyCount} liturgical celebration${
          dailyCount > 1 ? 's' : ''
        } scheduled on this ${
          isSunday ? 'Sunday (maximum 3 allowed by Canon 905 §2)' : 'weekday (maximum 2 allowed by Canon 905 §1)'
        }.`
      );
    } else if (dailyCount > 0) {
      warnings.push(
        `Father already has ${dailyCount} liturgical celebration${
          dailyCount > 1 ? 's' : ''
        } scheduled on this day (${dailyCount}/${maxDailyAllowed} Canon 905 threshold).`
      );
    }

    // Determine status & badges
    let status: 'available' | 'busy' | 'blackout' | 'canon_limit' = 'available';
    let badgeText = 'Available';
    let badgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    const eligible = !isBlackoutOrDayOff && !hasTimeConflict && !hasCanonLimitConflict;

    if (isBlackoutOrDayOff) {
      status = 'blackout';
      badgeVariant = 'destructive';
      const reasonLower = (availability.reason || '').toLowerCase();
      if (reasonLower.includes('day off')) {
        badgeText = 'Day Off';
      } else if (reasonLower.includes('retreat')) {
        badgeText = 'On Retreat';
      } else {
        badgeText = 'Unavailable / Leave';
      }
    } else if (hasTimeConflict) {
      status = 'busy';
      badgeVariant = 'destructive';
      badgeText = 'Time Collision';
    } else if (hasCanonLimitConflict) {
      status = 'canon_limit';
      badgeVariant = 'destructive';
      badgeText = `Canon 905 Limit (${dailyCount}/${maxDailyAllowed})`;
    } else if (dailyCount > 0) {
      status = 'available';
      badgeVariant = 'warning';
      badgeText = `${dailyCount} scheduled`;
    } else {
      status = 'available';
      badgeVariant = 'success';
      badgeText = 'Available (0 commitments)';
    }

    return {
      eligible,
      status,
      badgeText,
      badgeVariant,
      warnings,
      dailyCount,
    };
  } catch (err) {
    console.error('Error evaluating celebrant assignment:', err);
    return {
      eligible: true,
      status: 'available',
      badgeText: 'Available',
      badgeVariant: 'success',
      warnings: [],
      dailyCount: 0,
    };
  }
}

/**
 * Evaluates all priests in the parish celebrant pool in parallel.
 * Identifies the best recommended alternative celebrant (eligible with the lightest liturgical load).
 */
export async function evaluateParishCelebrants(
  priests: Profile[],
  appointmentDate: string,
  appointmentTime: string,
  _churchId?: string,
  currentAppointmentId?: string
): Promise<ParishCelebrantsEvaluation> {
  const evaluations: Record<string, CelebrantEvaluation> = {};

  if (!priests || priests.length === 0) {
    return {
      evaluations: {},
      recommendedPriestId: null,
      recommendedPriest: null,
    };
  }

  await Promise.all(
    priests.map(async (priest) => {
      evaluations[priest.id] = await evaluateCelebrantAssignment(
        priest.id,
        appointmentDate,
        appointmentTime,
        _churchId,
        currentAppointmentId
      );
    })
  );

  // Eligible priests sorted by lowest dailyCount (least loaded first)
  const eligiblePriests = priests
    .filter((p) => evaluations[p.id]?.eligible)
    .sort((a, b) => (evaluations[a.id]?.dailyCount ?? 0) - (evaluations[b.id]?.dailyCount ?? 0));

  const recommendedPriest = eligiblePriests.length > 0 ? eligiblePriests[0] : null;

  return {
    evaluations,
    recommendedPriestId: recommendedPriest ? recommendedPriest.id : null,
    recommendedPriest,
  };
}

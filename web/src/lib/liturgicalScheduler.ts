import { supabase } from './supabase';
import { evaluateParishPool, type ParishCelebrantEligibility } from './supabase/priestAvailability';
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

/** Result for a priest with nothing against him (also the fallback when the evaluation cannot run). */
function availableEvaluation(): CelebrantEvaluation {
  return {
    eligible: true,
    status: 'available',
    badgeText: 'Available',
    badgeVariant: 'success',
    warnings: [],
    dailyCount: 0,
  };
}

function toCelebrantEvaluation(row: ParishCelebrantEligibility): CelebrantEvaluation {
  return {
    eligible: row.eligible,
    status: row.status,
    badgeText: row.badgeText,
    badgeVariant: row.badgeVariant,
    warnings: row.warnings,
    dailyCount: row.dailyCount,
  };
}

/**
 * Evaluates one parish slot for every priest of the parish. The computation lives in the
 * evaluate_parish_celebrants database function (day off, leave, time collision and Canon 905, counting
 * appointments and recurring Masses); this only maps the result.
 */
async function evaluateParishSlot(
  churchId: string,
  appointmentDate: string,
  appointmentTime: string,
  currentAppointmentId?: string
): Promise<Record<string, CelebrantEvaluation>> {
  const { data, error } = await evaluateParishPool(churchId, appointmentDate, appointmentTime, currentAppointmentId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.priestId, toCelebrantEvaluation(row)]));
}

/** The parish a priest belongs to, for callers that do not pass one. */
async function resolvePriestChurchId(priestId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('assigned_church_id, church_id')
    .eq('id', priestId)
    .maybeSingle();
  return data?.assigned_church_id ?? data?.church_id ?? null;
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
  churchId?: string,
  currentAppointmentId?: string
): Promise<CelebrantEvaluation> {
  if (!priestId || !appointmentDate) {
    return availableEvaluation();
  }

  try {
    const parishId = churchId || (await resolvePriestChurchId(priestId));
    if (!parishId) {
      return availableEvaluation();
    }
    const evaluations = await evaluateParishSlot(parishId, appointmentDate, appointmentTime, currentAppointmentId);
    return evaluations[priestId] ?? availableEvaluation();
  } catch (err) {
    console.error('Error evaluating celebrant assignment:', err);
    return availableEvaluation();
  }
}

/**
 * Evaluates all priests in the parish celebrant pool with a single database call.
 * Identifies the best recommended alternative celebrant (eligible with the lightest liturgical load).
 * Only priests of the parish are evaluated and can be recommended; other profiles in the list
 * (for example a church administrator who is not a priest) get no evaluation.
 */
export async function evaluateParishCelebrants(
  priests: Profile[],
  appointmentDate: string,
  appointmentTime: string,
  churchId?: string,
  currentAppointmentId?: string
): Promise<ParishCelebrantsEvaluation> {
  const empty: ParishCelebrantsEvaluation = {
    evaluations: {},
    recommendedPriestId: null,
    recommendedPriest: null,
  };

  if (!priests || priests.length === 0) {
    return empty;
  }

  const parishId = churchId || priests[0].assigned_church_id || priests[0].church_id;
  if (!parishId) {
    return empty;
  }

  let poolEvaluations: Record<string, CelebrantEvaluation>;
  try {
    poolEvaluations = await evaluateParishSlot(parishId, appointmentDate, appointmentTime, currentAppointmentId);
  } catch (err) {
    console.error('Error evaluating parish celebrants:', err);
    return empty;
  }
  const evaluations: Record<string, CelebrantEvaluation> = {};
  for (const priest of priests) {
    if (poolEvaluations[priest.id]) {
      evaluations[priest.id] = poolEvaluations[priest.id];
    }
  }

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

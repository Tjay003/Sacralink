import type { Page } from '@playwright/test';
import { MOCK_PRIEST_AVAILABILITY, MOCK_USERS } from './mockAuth';

export interface MockSlotAppointment {
  id: string;
  priest_id?: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string;
}

interface EvaluationRow {
  priest_id: string;
  eligible: boolean;
  status: string;
  badge_text: string;
  badge_variant: string;
  warnings: string[];
  daily_count: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function hhmm(time: string): string {
  return time.slice(0, 5);
}

function prettyTime(time: string): string {
  const [h, m] = hhmm(time).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * The evaluate_parish_celebrants database function (migration 054) cannot run in mocked e2e, so this
 * mirrors its rules for the one mock priest: weekly day off and leave from MOCK_PRIEST_AVAILABILITY,
 * exact time collision and the Canon 905 limit over the appointments the spec is serving. The
 * mock parish has no recurring Masses.
 */
export function evaluateMockPriest(
  appointments: MockSlotAppointment[],
  date: string,
  time: string | null,
  excludeAppointmentId: string | null
): EvaluationRow {
  const priestId = MOCK_USERS.priest.id;
  const dow = dayOfWeek(date);
  const isSunday = dow === 0;
  const max = isSunday ? 3 : 2;

  const commitments = appointments.filter(
    (a) =>
      a.priest_id === priestId &&
      a.appointment_date === date &&
      a.status !== 'cancelled' &&
      a.status !== 'rejected' &&
      a.id !== excludeAppointmentId
  );
  const n = commitments.length;
  const clash = time ? commitments.find((a) => hhmm(a.appointment_time) === hhmm(time)) : undefined;
  const dayOff = MOCK_PRIEST_AVAILABILITY.some((r) => r.day_of_week === dow);
  const onLeave = MOCK_PRIEST_AVAILABILITY.some(
    (r) => r.blackout_start && r.blackout_end && date >= r.blackout_start && date <= r.blackout_end
  );
  const canon = n >= max;

  const warnings: string[] = [];
  if (dayOff) warnings.push(`Father is on his weekly day off (${WEEKDAYS[dow]}).`);
  else if (onLeave) warnings.push('Father is away on clergy leave or retreat.');
  if (clash && time) {
    warnings.push(`Temporal Conflict: Father is already presiding another liturgy (${clash.service_type}) at ${prettyTime(time)}.`);
  }
  if (canon) {
    warnings.push(
      `Canon 905 Admonition: Father already has ${n} liturgical celebration${n > 1 ? 's' : ''} scheduled on this ${
        isSunday ? 'Sunday (maximum 3 allowed by Canon 905 §2)' : 'weekday (maximum 2 allowed by Canon 905 §1)'
      }.`
    );
  } else if (n > 0) {
    warnings.push(`Father already has ${n} liturgical celebration${n > 1 ? 's' : ''} scheduled on this day (${n}/${max} Canon 905 threshold).`);
  }

  const blocked = dayOff || onLeave || Boolean(clash) || canon;
  let badgeText = 'Available (0 commitments)';
  if (dayOff) badgeText = 'Day Off';
  else if (onLeave) badgeText = 'Unavailable / Leave';
  else if (clash) badgeText = 'Time Collision';
  else if (canon) badgeText = `Canon 905 Limit (${n}/${max})`;
  else if (n > 0) badgeText = `${n} scheduled`;

  return {
    priest_id: priestId,
    eligible: !blocked,
    status: dayOff || onLeave ? 'blackout' : clash ? 'busy' : canon ? 'canon_limit' : 'available',
    badge_text: badgeText,
    badge_variant: blocked ? 'destructive' : n > 0 ? 'warning' : 'success',
    warnings,
    daily_count: n,
  };
}

/** Serves evaluate_parish_celebrants for a spec from the appointments it currently holds. */
export async function mockEvaluateCelebrants(page: Page, getAppointments: () => MockSlotAppointment[]) {
  await page.route('**/rest/v1/rpc/evaluate_parish_celebrants', async (route) => {
    const payload = route.request().postDataJSON() as {
      p_date: string;
      p_time: string | null;
      p_exclude_appointment_id: string | null;
    };
    const row = evaluateMockPriest(getAppointments(), payload.p_date, payload.p_time, payload.p_exclude_appointment_id);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) });
  });
}

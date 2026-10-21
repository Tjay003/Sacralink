import { format } from 'date-fns';

/** The slice of an appointment the "Rescheduled from ..." notice depends on. */
export interface RescheduledNoticeSource {
    status: string;
    appointment_date: string;
    rescheduled_from_date?: string | null;
    reschedule_reason?: string | null;
}

export interface RescheduledNoticeData {
    /** Previous date, already formatted for display (e.g. "Oct 18, 2026") */
    fromLabel: string;
    reason: string | null;
}

function toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Decides whether an appointment carries the amber "Rescheduled from ..." notice, and with what.
 * Shown only for approved appointments that have been rescheduled and whose current (new) date
 * has not passed yet. The change history keeps the permanent record; this is display only and
 * never alters the appointment status.
 */
export function getRescheduledNotice(
    appointment: RescheduledNoticeSource,
    today: string = toLocalDateKey(new Date())
): RescheduledNoticeData | null {
    const from = appointment.rescheduled_from_date;
    if (!from) return null;
    if (appointment.status !== 'approved') return null;
    // Dates are YYYY-MM-DD strings, so lexical order is chronological order
    if (appointment.appointment_date.slice(0, 10) < today) return null;

    const [y, m, d] = from.slice(0, 10).split('-').map(Number);
    const fromDate = new Date(y, m - 1, d);
    if (isNaN(fromDate.getTime())) return null;

    const reason = appointment.reschedule_reason?.trim() || null;
    return { fromLabel: format(fromDate, 'MMM d, yyyy'), reason };
}

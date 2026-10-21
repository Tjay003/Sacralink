import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { History, Loader2 } from 'lucide-react';
import {
    fetchAppointmentChanges,
    formatAppointmentTime,
    type AppointmentChange,
    type AppointmentChangeAction,
} from '../../lib/supabase/appointments';

interface AppointmentChangeHistoryProps {
    appointmentId: string;
    /** Changing this value reloads the history (for example the appointment's updated_at after an edit). */
    refreshKey?: string | number | null;
    className?: string;
}

const ACTION_LABELS: Record<AppointmentChangeAction, string> = {
    cancel: 'Cancelled',
    change_celebrant: 'Celebrant changed',
    reschedule: 'Rescheduled',
    mark_celebrated: 'Marked celebrated',
    restore: 'Restored',
    approve: 'Approved',
    reject: 'Rejected',
};

/** Status labels as shown to staff. The database value `completed` is displayed as "Celebrated". */
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    rescheduled: 'Rescheduled',
    completed: 'Celebrated',
    cancelled: 'Cancelled',
};

interface ChangeDetail {
    label: string;
    before: string;
    after: string;
}

function formatStatus(value: unknown): string {
    return typeof value === 'string' ? STATUS_LABELS[value] ?? value : 'Unknown';
}

function formatDate(value: unknown): string {
    if (typeof value !== 'string') return 'Unknown date';
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return value;
    return format(new Date(year, month - 1, day), 'EEE, MMM d, yyyy');
}

function formatCelebrant(change: AppointmentChange, value: unknown): string {
    if (typeof value !== 'string' || !value) return 'Unassigned';
    return change.celebrant_names[value] ?? 'A celebrant';
}

/** Turns one change into the before → after lines shown under its heading. */
function describeChange(change: AppointmentChange): ChangeDetail[] {
    const { before_values: before, after_values: after } = change;
    switch (change.action) {
        case 'change_celebrant':
            return [{ label: 'Celebrant', before: formatCelebrant(change, before.priest_id), after: formatCelebrant(change, after.priest_id) }];
        case 'reschedule': {
            const details: ChangeDetail[] = [
                {
                    label: 'Date and time',
                    before: `${formatDate(before.appointment_date)}, ${formatAppointmentTime(String(before.appointment_time ?? ''))}`,
                    after: `${formatDate(after.appointment_date)}, ${formatAppointmentTime(String(after.appointment_time ?? ''))}`,
                },
            ];
            if ('priest_id' in before || 'priest_id' in after) {
                details.push({ label: 'Celebrant', before: formatCelebrant(change, before.priest_id), after: formatCelebrant(change, after.priest_id) });
            }
            return details;
        }
        case 'approve': {
            const details: ChangeDetail[] = [{ label: 'Status', before: formatStatus(before.status), after: formatStatus(after.status) }];
            if ('priest_id' in after) {
                details.push({ label: 'Celebrant', before: formatCelebrant(change, before.priest_id), after: formatCelebrant(change, after.priest_id) });
            }
            return details;
        }
        default:
            return [{ label: 'Status', before: formatStatus(before.status), after: formatStatus(after.status) }];
    }
}

function formatWhen(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, 'MMM d, yyyy, h:mm a');
}

/**
 * Newest-first list of an appointment's Appointment Changes: action, reason or note, before → after,
 * who and when. Only the parish office and the appointment's celebrant can read these rows (RLS), so
 * render it for those roles only; for anyone else the fetch would simply return nothing.
 */
export default function AppointmentChangeHistory({ appointmentId, refreshKey = null, className = '' }: AppointmentChangeHistoryProps) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ key: string; changes: AppointmentChange[]; failed: boolean } | null>(null);
    const requestKey = `${appointmentId}|${refreshKey ?? ''}|${attempt}`;

    useEffect(() => {
        let cancelled = false;
        fetchAppointmentChanges(appointmentId)
            .then(({ data, error }) => {
                if (!cancelled) setResult({ key: requestKey, changes: error ? [] : data, failed: Boolean(error) });
            })
            .catch(() => {
                if (!cancelled) setResult({ key: requestKey, changes: [], failed: true });
            });
        return () => {
            cancelled = true;
        };
    }, [appointmentId, requestKey]);

    // Loading until the response for the current request has arrived
    const loading = result?.key !== requestKey;
    const failed = !loading && result.failed;
    const changes = !loading ? result.changes : [];

    const headingId = `change-history-${appointmentId}`;

    return (
        <section aria-labelledby={headingId} className={`space-y-3 ${className}`}>
            <h4 id={headingId} className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Change history
            </h4>

            {loading ? (
                <p role="status" className="flex items-center gap-2 text-xs text-muted py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading change history...
                </p>
            ) : failed ? (
                <div className="rounded-xl border border-border bg-secondary-50/50 p-3.5 text-xs text-muted flex items-center justify-between gap-3">
                    <span>The change history could not be loaded right now.</span>
                    <button
                        type="button"
                        onClick={() => setAttempt((n) => n + 1)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold shrink-0 cursor-pointer"
                    >
                        Try again
                    </button>
                </div>
            ) : changes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary-50/50 p-4 text-center">
                    <p className="text-sm font-medium text-foreground">No changes yet</p>
                    <p className="text-xs text-muted mt-0.5">Edits to this appointment will be listed here.</p>
                </div>
            ) : (
                <ol className="space-y-2.5">
                    {changes.map((change) => (
                        <li key={change.id} className="rounded-xl border border-border bg-white p-3.5 shadow-2xs space-y-1.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className="text-sm font-bold text-foreground">{ACTION_LABELS[change.action] ?? change.action}</span>
                                <span className="text-[11px] text-muted">
                                    {change.changed_by_name} · <time dateTime={change.created_at}>{formatWhen(change.created_at)}</time>
                                </span>
                            </div>
                            <ul className="space-y-0.5">
                                {describeChange(change).map((detail) => (
                                    <li key={detail.label} className="text-xs text-secondary-700">
                                        <span className="text-muted">{detail.label}: </span>
                                        <span className="font-medium">{detail.before}</span>
                                        <span> → </span>
                                        <span className="font-medium">{detail.after}</span>
                                    </li>
                                ))}
                            </ul>
                            {change.reason && (
                                <p className="text-xs text-secondary-600 bg-secondary-50/60 border border-border/50 rounded-lg p-2">
                                    <span className="font-semibold">{change.action === 'mark_celebrated' || change.action === 'approve' || change.action === 'reject' ? 'Note: ' : 'Reason: '}</span>
                                    {change.reason}
                                </p>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Church, ShieldAlert } from 'lucide-react';
import { getUserReviewSummary, type UserReviewSummary } from '../../lib/supabase/profiles';
import { UserName } from '../ui/UserName';
import DeletionRequestActions from './DeletionRequestActions';

interface ReviewSummaryPanelProps {
    subjectUserId: string;
    /** On a user deletion request, shows the Super Admin decision buttons under the summary. */
    decision?: {
        ticketId: string;
        ticketStatus: string | null | undefined;
        /** Called after a decision so the ticket list and thread reload. */
        onChanged: () => void | Promise<void>;
    };
}

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    church_admin: 'Church Admin',
    priest: 'Priest',
    volunteer: 'Volunteer',
    user: 'Parishioner',
};

function relativeDate(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

function exactDate(iso: string): string {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function humanize(action: string): string {
    const text = action.replace(/_/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Evidence panel on a deletion request or a "Report a person" ticket, for the Super Admin only. Reads
 * get_user_review_summary (counts and recent activity, never message text, amounts or file URLs).
 */
export default function ReviewSummaryPanel({ subjectUserId, decision }: ReviewSummaryPanelProps) {
    const [summary, setSummary] = useState<UserReviewSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getUserReviewSummary(subjectUserId)
            .then((result) => {
                if (!cancelled) setSummary(result);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            });
        return () => {
            cancelled = true;
        };
    }, [subjectUserId, reloadKey]);

    const stale = Boolean(summary?.deleted_at || summary?.suspended_at);

    const stats = summary
        ? [
              { label: 'Appointments', total: summary.counts.appointments, extra: summary.counts.appointments_cancelled, extraLabel: 'cancelled' },
              { label: 'Donations', total: summary.counts.donations, extra: summary.counts.donations_rejected, extraLabel: 'rejected' },
              { label: 'Messages sent', total: summary.counts.messages_sent, extra: 0, extraLabel: '' },
              { label: 'Tickets raised', total: summary.counts.tickets_raised, extra: 0, extraLabel: '' },
          ]
        : [];

    return (
        <div className="mb-6 space-y-3 p-3.5 rounded-xl border border-border/80 bg-secondary-50/50" data-testid="review-summary-panel">
            <span className="text-[11px] font-bold text-secondary-500 uppercase tracking-wider">REVIEW</span>

            {error && <p className="text-xs text-destructive">{error}</p>}
            {!error && !summary && <p className="text-xs text-muted">Loading review summary...</p>}

            {summary && (
                <div className="space-y-3 text-xs">
                    {summary.deleted_at && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 font-semibold">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>This account is already deleted. The numbers below are no longer current.</span>
                        </div>
                    )}
                    {!summary.deleted_at && summary.suspended_at && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-700 font-semibold">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>This account is suspended since {exactDate(summary.suspended_at)}.</span>
                        </div>
                    )}

                    <div className="space-y-1 text-secondary-600">
                        <p className="font-bold text-foreground text-sm">
                            <UserName name={summary.full_name} deletedAt={summary.deleted_at} />
                        </p>
                        <p>
                            {ROLE_LABELS[summary.role] || summary.role}
                            {summary.is_priest && summary.role !== 'priest' ? ' (Priest)' : ''}
                        </p>
                        <p className="flex items-center gap-1.5 min-w-0">
                            <Church className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                            {summary.church_id ? (
                                <Link to={`/churches/${summary.church_id}`} className="truncate text-primary hover:underline">
                                    {summary.church_name || 'Parish'}
                                </Link>
                            ) : (
                                <span>No parish</span>
                            )}
                        </p>
                        <p>
                            <span className="text-secondary-400">Joined: </span>
                            {summary.created_at ? <span title={exactDate(summary.created_at)}>{relativeDate(summary.created_at)}</span> : 'Unknown'}
                        </p>
                        <p>
                            <span className="text-secondary-400">Last sign-in: </span>
                            {summary.last_sign_in_at ? (
                                <span title={exactDate(summary.last_sign_in_at)}>{relativeDate(summary.last_sign_in_at)}</span>
                            ) : (
                                'Never signed in'
                            )}
                        </p>
                    </div>

                    <dl className={`grid grid-cols-2 gap-2 ${stale ? 'opacity-50' : ''}`}>
                        {stats.map((stat) => (
                            <div key={stat.label} className="rounded-lg border border-border bg-white p-2">
                                <dt className="text-secondary-400">{stat.label}</dt>
                                <dd className="font-bold text-foreground text-sm">{stat.total}</dd>
                                {stat.extra > 0 && (
                                    <dd className="text-secondary-500">
                                        {stat.extra} {stat.extraLabel}
                                    </dd>
                                )}
                            </div>
                        ))}
                    </dl>

                    <div className={stale ? 'opacity-50' : ''}>
                        <p className="font-semibold text-secondary-700 mb-1">Recent activity</p>
                        {summary.recent_activity.length === 0 ? (
                            <p className="text-muted">
                                No recorded activity yet. Activity recording is limited, so an empty list does not prove the person did nothing.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {summary.recent_activity.map((entry, index) => (
                                    <li key={`${entry.created_at}-${index}`} className="flex justify-between gap-2 text-secondary-600">
                                        <span className="truncate">{humanize(entry.action)}</span>
                                        <span className="shrink-0 text-secondary-400" title={exactDate(entry.created_at)}>
                                            {relativeDate(entry.created_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <Link to={`/users?user=${summary.user_id}`} className="inline-block font-semibold text-primary hover:underline">
                        Open in Users
                    </Link>

                    {decision && (
                        <DeletionRequestActions
                            ticketId={decision.ticketId}
                            ticketStatus={decision.ticketStatus}
                            summary={summary}
                            onChanged={async () => {
                                setReloadKey((key) => key + 1);
                                await decision.onChanged();
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

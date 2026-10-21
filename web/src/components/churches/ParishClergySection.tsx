import { Calendar, Cross } from 'lucide-react';
import { celebrantLabel } from '../../hooks/useParishClergy';
import type { ParishClergyMember, ParishClergyStatus } from '../../lib/supabase/priestAvailability';

interface ParishClergySectionProps {
    clergy: ParishClergyMember[];
    /** Opens the booking flow for the parish. Omit to hide the "Book with Father" shortcut. */
    onBook?: () => void;
}

const STATUS_BADGES: Record<ParishClergyStatus, { label: string; className: string; dotClassName: string }> = {
    available: {
        label: 'Available',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotClassName: 'bg-emerald-500',
    },
    in_mass: {
        label: 'In Mass',
        className: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dotClassName: 'bg-amber-500',
    },
    on_leave: {
        label: 'On Leave',
        className: 'bg-secondary-100 text-secondary-700 border-border',
        dotClassName: 'bg-secondary-400',
    },
};

/**
 * ParishClergySection - the priests of a parish with today's status, for every visitor of the church page.
 * Renders nothing when the parish has no priests. It only ever receives what get_parish_clergy returns
 * (name, title, designation, status), so no leave reason, email or phone number can appear here.
 */
export default function ParishClergySection({ clergy, onBook }: ParishClergySectionProps) {
    if (clergy.length === 0) return null;

    return (
        <section data-testid="parish-clergy-section" className="card p-6 bg-white border border-border/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-foreground">Parish Clergy</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    {clergy.length} {clergy.length === 1 ? 'priest' : 'priests'}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clergy.map((member) => {
                    const badge = STATUS_BADGES[member.status];
                    return (
                        <div
                            key={member.priestId}
                            data-testid="clergy-card"
                            className="bg-white border border-border rounded-2xl p-4 shadow-2xs flex flex-col gap-3"
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                    <Cross className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <p className="text-sm font-bold text-foreground leading-snug break-words">{celebrantLabel(member)}</p>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="text-xs text-muted">{member.designation}</span>
                                        <span
                                            data-testid="clergy-status"
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClassName}`} aria-hidden="true" />
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {onBook && (
                                <button
                                    type="button"
                                    onClick={onBook}
                                    className="w-full bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                                >
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <span>Book with Father</span>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

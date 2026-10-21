import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText,
    Calendar,
    ChevronRight,
    Loader2,
    CheckCircle2,
    MessageSquare,
    Clock,
    User,
    Mail,
    Phone,
    Church,
    ShieldCheck,
    AlertCircle,
    Gem,
    type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { getSacramentMeta } from '../../lib/sacramentMeta';
import { supabase } from '../../lib/supabase';
import {
    getAppointments,
    formatAppointmentTime,
    hasAppointmentStarted,
    markAppointmentCelebrated,
    APPOINTMENT_CELEBRATED_EVENT,
    type HydratedAppointment,
    type AppointmentStatus,
} from '../../lib/supabase/appointments';
import { useAuth } from '../../contexts/AuthContext';
import DocumentViewerModal from '../documents/DocumentViewerModal';
import Modal from '../ui/Modal';
import RescheduledNotice from '../appointments/RescheduledNotice';
import AppointmentChangeHistory from '../appointments/AppointmentChangeHistory';

export interface CelebrantAttentionWidgetProps {
    priestId?: string;
    churchId?: string;
    className?: string;
}

export type CelebrantAttentionCategory =
    | 'prenuptial_inquiry'
    | 'pastoral_counseling'
    | 'document_verification'
    | 'pending_confirmation'
    | 'not_marked_celebrated';

export interface CelebrantAttentionItem {
    id: string;
    appointment: HydratedAppointment;
    category: CelebrantAttentionCategory;
    title: string;
    description: string;
    dateLabel: string;
    timeLabel: string;
    hasDocuments: boolean;
    documentCount: number;
    /** Required documents configured by the parish for this sacrament (0 = none) */
    requiredDocumentCount: number;
    isDueSoon: boolean;
    tagLabel: string;
    tagStyle: string;
    iconStyle: string;
    icon: LucideIcon;
    actionLabel: string;
}

const DUE_SOON_DAYS = 14;

/**
 * A past, still-approved appointment the priest presided at but has not yet marked Celebrated.
 * The queue only ever holds the priest's own appointments (it is queried by priest_id).
 */
function isNotYetMarkedCelebrated(appointment: HydratedAppointment, priestId: string, now: Date): boolean {
    return (
        appointment.status === 'approved' &&
        Boolean(priestId) &&
        appointment.priest_id === priestId &&
        hasAppointmentStarted(appointment, now)
    );
}

function daysUntil(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDocumentProgress(item: CelebrantAttentionItem): string {
    if (item.requiredDocumentCount > 0) {
        return `${Math.min(item.documentCount, item.requiredDocumentCount)} of ${item.requiredDocumentCount} documents`;
    }
    if (item.documentCount > 0) {
        return `${item.documentCount} document${item.documentCount === 1 ? '' : 's'} uploaded`;
    }
    return 'No documents needed';
}

/**
 * Format service names reverently according to Catholic terminology.
 */
function formatSacramentTitle(type: string): string {
    const clean = (type || '').toLowerCase().replace(/_/g, ' ').trim();
    if (clean.includes('baptism')) return 'Baptism';
    if (clean.includes('wedding') || clean.includes('marriage') || clean.includes('matrimony')) return 'Holy Matrimony';
    if (clean.includes('prenup') || clean.includes('canonical')) return 'Pre-Nuptial Inquiry';
    if (clean.includes('counseling') || clean.includes('spiritual')) return 'Pastoral Counseling';
    if (clean.includes('confession') || clean.includes('reconcil')) return 'Reconciliation';
    if (clean.includes('funeral') || clean.includes('burial')) return 'Funeral Mass';
    if (clean.includes('confirmation')) return 'Confirmation';
    if (clean.includes('mass') || clean.includes('intent')) return 'Mass Intention';
    if (clean.includes('anointing')) return 'Anointing of the Sick';
    if (clean.includes('blessing')) return 'Blessing';
    return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Parse YYYY-MM-DD cleanly without timezone jitter.
 */
function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            return format(date, 'EEE, MMM d, yyyy');
        }
        return dateStr;
    } catch {
        return dateStr;
    }
}

/** Re-labels a queue item as "Not yet marked celebrated", replacing its preparation/review framing. */
function asNotYetMarkedCelebrated(item: CelebrantAttentionItem): CelebrantAttentionItem {
    return {
        ...item,
        category: 'not_marked_celebrated',
        description: `${formatSacramentTitle(item.appointment.service_type)} has taken place. Record that you celebrated it.`,
        isDueSoon: false,
        tagLabel: 'Not yet marked celebrated',
        tagStyle: 'bg-amber-50 text-amber-800 border-amber-200',
        iconStyle: 'bg-amber-50 text-amber-600 border-amber-200',
        icon: CheckCircle2,
        actionLabel: 'Mark celebrated',
    };
}

export default function CelebrantAttentionWidget({
    priestId,
    churchId,
    className = '',
}: CelebrantAttentionWidgetProps) {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    // Priest identity resolution: prop priestId -> profile id -> auth user id
    const effectivePriestId = useMemo(() => {
        return priestId || profile?.id || user?.id || '';
    }, [priestId, profile?.id, user?.id]);

    const [loading, setLoading] = useState(true);
    const [queueItems, setQueueItems] = useState<CelebrantAttentionItem[]>([]);

    // Modals state
    const [activeDocApptId, setActiveDocApptId] = useState<string | null>(null);
    const [activeDetailItem, setActiveDetailItem] = useState<CelebrantAttentionItem | null>(null);

    // "Mark celebrated" state: which item is saving and the last error
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [markError, setMarkError] = useState<string | null>(null);

    // Ticks every minute so an appointment moves into "Not yet marked celebrated" once it starts
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    const displayItems = useMemo(() => {
        const items = queueItems.map((item) =>
            isNotYetMarkedCelebrated(item.appointment, effectivePriestId, now) ? asNotYetMarkedCelebrated(item) : item
        );
        // Past celebrations waiting to be recorded come first (stable within each group)
        return [
            ...items.filter((i) => i.category === 'not_marked_celebrated'),
            ...items.filter((i) => i.category !== 'not_marked_celebrated'),
        ];
    }, [queueItems, effectivePriestId, now]);

    const loadData = useCallback(async () => {
        if (!effectivePriestId) {
            setLoading(false);
            setQueueItems([]);
            return;
        }

        try {
            setLoading(true);

            // Query active appointments assigned to Father
            const { data: apptsData, error: apptsErr } = await getAppointments({
                priestId: effectivePriestId,
                churchId: churchId && churchId !== 'all' ? churchId : undefined,
                statusIn: (['pending', 'approved', 'confirmed'] as unknown) as AppointmentStatus[],
                orderBy: 'appointment_date',
                ascending: true,
                limit: 20,
            });

            if (apptsErr) {
                console.error('Error querying celebrant appointments:', apptsErr);
                setQueueItems([]);
                return;
            }

            const appts = apptsData || [];
            const apptIds = appts.map((a) => a.id);

            // Fetch attached document counts
            const docsCountMap: Record<string, number> = {};
            if (apptIds.length > 0) {
                const { data: docsData, error: docsErr } = await supabase
                    .from('appointment_documents')
                    .select('id, appointment_id')
                    .in('appointment_id', apptIds);

                if (!docsErr && docsData) {
                    for (const doc of docsData) {
                        docsCountMap[doc.appointment_id] = (docsCountMap[doc.appointment_id] || 0) + 1;
                    }
                }
            }

            // Required document counts per service, for "3 of 6 documents"
            const requiredCountMap: Record<string, number> = {};
            const churchIds = Array.from(new Set(appts.map((a) => a.church_id).filter(Boolean)));
            if (churchIds.length > 0) {
                const { data: reqData, error: reqErr } = await supabase
                    .from('sacrament_requirements')
                    .select('service_type_id, is_required')
                    .in('church_id', churchIds);

                if (!reqErr && reqData) {
                    for (const req of reqData) {
                        if (req.is_required === false || !req.service_type_id) continue;
                        requiredCountMap[req.service_type_id] = (requiredCountMap[req.service_type_id] || 0) + 1;
                    }
                }
            }

            // Triage each appointment into Father's Celebrant Attention Queue
            const triageList: CelebrantAttentionItem[] = [];

            for (const appt of appts) {
                const applicantName = appt.profile?.full_name?.trim() || 'Parishioner';
                const serviceClean = (appt.service_type || '').toLowerCase();
                const notesClean = (appt.notes || '').toLowerCase();
                const feedbackClean = (appt.admin_feedback || '').toLowerCase();
                const docCount = docsCountMap[appt.id] || 0;
                const hasDocs = docCount > 0;
                const base = {
                    id: appt.id,
                    appointment: appt,
                    title: applicantName,
                    dateLabel: formatDisplayDate(appt.appointment_date),
                    timeLabel: formatAppointmentTime(appt.appointment_time),
                    hasDocuments: hasDocs,
                    documentCount: docCount,
                    requiredDocumentCount: (appt.service_type_id && requiredCountMap[appt.service_type_id]) || 0,
                    isDueSoon: daysUntil(appt.appointment_date) <= DUE_SOON_DAYS,
                };

                // 1. Pre-Nuptial Inquiries / Canonical Examinations
                const isPrenup =
                    serviceClean.includes('prenup') ||
                    serviceClean.includes('pre-nuptial') ||
                    serviceClean.includes('inquiry') ||
                    ((appt.service_kind === 'wedding' || serviceClean.includes('wed')) &&
                        (/\b(interview|inquiry|canonical|exam|pre-cana)\b/i.test(notesClean) ||
                            /\b(interview|inquiry|canonical|exam|pre-cana)\b/i.test(feedbackClean)));

                if (isPrenup) {
                    triageList.push({
                        ...base,
                        category: 'prenuptial_inquiry',
                        description: 'Canonical interview needed before the banns are published',
                        tagLabel: 'Pre-nuptial inquiry',
                        tagStyle: 'bg-amber-50 text-amber-800 border-amber-200',
                        iconStyle: 'bg-amber-50 text-amber-600 border-amber-200',
                        icon: Gem,
                        actionLabel: hasDocs ? 'Review documents' : 'Review request',
                    });
                    continue;
                }

                // 2. Pastoral Counseling / Spiritual Guidance
                const isCounseling =
                    serviceClean.includes('counseling') ||
                    serviceClean.includes('confess') ||
                    serviceClean.includes('spiritual') ||
                    serviceClean.includes('direction') ||
                    /\b(spiritual direction|counseling|pastoral care)\b/i.test(notesClean);

                if (isCounseling) {
                    triageList.push({
                        ...base,
                        category: 'pastoral_counseling',
                        description: appt.notes?.trim() || 'Requested a pastoral counseling session',
                        tagLabel: 'Pastoral counseling',
                        tagStyle: 'bg-blue-50 text-primary border-blue-200',
                        iconStyle: 'bg-blue-50 text-primary border-blue-200',
                        icon: MessageSquare,
                        actionLabel: 'Review request',
                    });
                    continue;
                }

                // 3. Document / Requirement Verification
                if (hasDocs) {
                    triageList.push({
                        ...base,
                        category: 'document_verification',
                        description: `${docCount} document${docCount === 1 ? '' : 's'} uploaded for your clearance`,
                        tagLabel: 'Documents to review',
                        tagStyle: 'bg-secondary-50 text-secondary-700 border-secondary-200',
                        iconStyle: 'bg-white text-secondary-600 border-border',
                        icon: getSacramentMeta(appt.service_type).icon,
                        actionLabel: 'Review documents',
                    });
                    continue;
                }

                // 4. Pending Liturgical Acceptance / Confirmation
                if (appt.status === 'pending') {
                    triageList.push({
                        ...base,
                        category: 'pending_confirmation',
                        description: `${formatSacramentTitle(appt.service_type)} awaiting your confirmation as celebrant`,
                        tagLabel: 'Celebrant request',
                        tagStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        iconStyle: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                        icon: Calendar,
                        actionLabel: 'Review request',
                    });
                    continue;
                }

                // 5. Approved sacrament with ceremony preparation
                triageList.push({
                    ...base,
                    category: 'document_verification',
                    description: `${formatSacramentTitle(appt.service_type)} scheduled · ceremony preparation`,
                    tagLabel: 'Liturgical rites',
                    tagStyle: 'bg-secondary-50 text-secondary-700 border-secondary-200',
                    iconStyle: 'bg-white text-secondary-600 border-border',
                    icon: getSacramentMeta(appt.service_type).icon,
                    actionLabel: 'View details',
                });
            }

            setQueueItems(triageList);
        } catch (error) {
            console.error('Error loading celebrant attention queue:', error);
            setQueueItems([]);
        } finally {
            setLoading(false);
        }
    }, [effectivePriestId, churchId]);

    // Realtime subscription to appointments and documents
    useEffect(() => {
        void loadData();

        if (!effectivePriestId) return;

        // Listen for realtime updates on appointments table
        const apptChannel = supabase
            .channel(`celebrant-attention-appts-${effectivePriestId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments',
                    filter: `priest_id=eq.${effectivePriestId}`,
                },
                () => {
                    void loadData();
                }
            )
            .subscribe();

        // Listen for realtime updates on documents table
        const docsChannel = supabase
            .channel(`celebrant-attention-docs-${effectivePriestId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointment_documents',
                },
                () => {
                    void loadData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(apptChannel);
            supabase.removeChannel(docsChannel);
        };
    }, [effectivePriestId, loadData]);

    // Another widget (the priest timeline) marked an appointment Celebrated: drop it from the queue
    useEffect(() => {
        const handleCelebrated = () => void loadData();
        window.addEventListener(APPOINTMENT_CELEBRATED_EVENT, handleCelebrated);
        return () => window.removeEventListener(APPOINTMENT_CELEBRATED_EVENT, handleCelebrated);
    }, [loadData]);

    const handleMarkCelebrated = async (item: CelebrantAttentionItem) => {
        setMarkingId(item.id);
        setMarkError(null);
        try {
            const { success, error } = await markAppointmentCelebrated(item.appointment.id);
            if (!success) {
                setMarkError(error?.message || 'Could not mark this celebration. Please try again.');
                return;
            }
            setQueueItems((current) => current.filter((i) => i.id !== item.id));
            setActiveDetailItem((current) => (current?.id === item.id ? null : current));
        } catch (err) {
            setMarkError(err instanceof Error ? err.message : 'Could not mark this celebration. Please try again.');
        } finally {
            setMarkingId(null);
        }
    };

    // Quick action: navigate to messaging thread with parishioner
    const handleMessageApplicant = (userId: string) => {
        if (!userId) return;
        navigate(`/messages?user=${userId}`);
    };

    // Full-height skeleton loading state matching bento box
    if (loading && queueItems.length === 0) {
        return (
            <div
                className={`bg-white border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full min-h-[260px] sm:min-h-[280px] animate-pulse ${className}`}
            >
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/80">
                    <div className="space-y-1.5">
                        <div className="h-5 bg-secondary-100 rounded w-48" />
                        <div className="h-3.5 bg-secondary-100 rounded w-72" />
                    </div>
                    <div className="h-6 bg-secondary-100 rounded-full w-20 shrink-0" />
                </div>
                <div className="my-auto py-6 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-secondary-100 mb-3" />
                    <div className="h-4 bg-secondary-100 rounded w-44 mb-2" />
                    <div className="h-3 bg-secondary-100 rounded w-64" />
                </div>
                <div className="pt-4 border-t border-border/70 flex items-center justify-between">
                    <div className="h-4 bg-secondary-100 rounded w-36" />
                    <div className="h-3 bg-secondary-100 rounded w-16" />
                </div>
            </div>
        );
    }

    // Full-sized bento box card when queue is clear (matches Church Admin reference)
    if (!loading && displayItems.length === 0) {
        return (
            <div
                className={`bg-white border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full min-h-[260px] sm:min-h-[280px] transition-all ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/80">
                    <div>
                        <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground tracking-tight">
                            Needs celebrant attention
                        </h3>
                        <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-0.5">
                            Canonical interviews, pastoral requests and documents for your review
                        </p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        All clear
                    </span>
                </div>

                {/* Center Content */}
                <div className="my-auto py-5 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                        Your celebrant queue is clear
                    </h4>
                    <p className="text-xs text-secondary-500 max-w-xs mx-auto mt-1 leading-relaxed">
                        No pending canonical interviews, pastoral requests or documents requiring your review.
                    </p>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-border/70 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/appointments')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                        <span>View celebrant schedule</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadData()}
                        className="text-[11px] font-semibold text-secondary-400 hover:text-secondary-600 transition-colors cursor-pointer"
                        title="Refresh queue"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    // Active triage queue for Father
    return (
        <div
            className={`bg-white border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between h-full min-h-[260px] sm:min-h-[280px] ${className}`}
        >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border/70 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">
                        Needs celebrant attention
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                        Canonical interviews, pastoral requests and documents for your review
                    </p>
                </div>

                {loading ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-600 text-xs font-semibold shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Checking...
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                        {displayItems.length} open
                    </span>
                )}
            </div>

            {markError && (
                <p role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {markError}
                </p>
            )}

            {/* Queue List */}
            <div className="divide-y divide-border/70 flex-1">
                {displayItems.map((item) => {
                    const Icon = item.icon;
                    const isWedding = item.category === 'prenuptial_inquiry';

                    return (
                        <div
                            key={item.id}
                            className="px-5 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-secondary-50/50 transition-colors"
                        >
                            <div className="flex items-start gap-3.5 min-w-0">
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${item.iconStyle}`}
                                >
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${item.tagStyle}`}>
                                            {item.tagLabel}
                                        </span>
                                        {item.isDueSoon && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                                Due soon
                                            </span>
                                        )}
                                        {item.appointment.status === 'pending' && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                Pending confirmation
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveDetailItem(item)}
                                        className="block text-left text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                                    >
                                        {item.title}
                                    </button>
                                    <p className="text-xs text-muted leading-relaxed line-clamp-2">
                                        {item.description}
                                    </p>
                                    <div className="space-y-0.5 pt-0.5 text-[11px] text-muted">
                                        <p className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3 text-secondary-400 shrink-0" />
                                            {isWedding ? 'Wedding on ' : ''}
                                            {item.dateLabel} · {item.timeLabel}
                                        </p>
                                        <RescheduledNotice appointment={item.appointment} className="mt-1" />
                                        <p className="flex items-center gap-1.5">
                                            <FileText className="w-3 h-3 text-secondary-400 shrink-0" />
                                            {formatDocumentProgress(item)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                                {item.category === 'not_marked_celebrated' ? (
                                    <button
                                        type="button"
                                        disabled={markingId === item.id}
                                        onClick={() => void handleMarkCelebrated(item)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {markingId === item.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        Mark celebrated
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            item.hasDocuments
                                                ? setActiveDocApptId(item.appointment.id)
                                                : setActiveDetailItem(item)
                                        }
                                        className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                    >
                                        {item.hasDocuments ? 'Review documents' : item.actionLabel}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleMessageApplicant(item.appointment.user_id)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-secondary-600 hover:text-foreground hover:bg-secondary-50 transition-colors cursor-pointer"
                                    title="Message parishioner"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Message
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 1. Document Viewer Modal */}
            {activeDocApptId && (
                <DocumentViewerModal
                    appointmentId={activeDocApptId}
                    isOpen={Boolean(activeDocApptId)}
                    onClose={() => setActiveDocApptId(null)}
                />
            )}

            {/* 2. Celebrant Appointment Details Modal */}
            {activeDetailItem && (
                <Modal
                    isOpen={Boolean(activeDetailItem)}
                    onClose={() => setActiveDetailItem(null)}
                    size="lg"
                    title={
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${activeDetailItem.iconStyle}`}
                            >
                                <activeDetailItem.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-foreground">
                                    {activeDetailItem.title}
                                </h3>
                                <p className="text-xs text-secondary-500">
                                    Celebrant ministry & sacramental details
                                </p>
                            </div>
                        </div>
                    }
                    footer={
                        <div className="flex items-center justify-between w-full gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const uid = activeDetailItem.appointment.user_id;
                                    setActiveDetailItem(null);
                                    handleMessageApplicant(uid);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                            >
                                <MessageSquare className="w-3.5 h-3.5 text-secondary-500" />
                                <span>Message Parishioner</span>
                            </button>

                            <div className="flex items-center gap-2">
                                {activeDetailItem.hasDocuments && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const apptId = activeDetailItem.appointment.id;
                                            setActiveDetailItem(null);
                                            setActiveDocApptId(apptId);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Review Documents</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setActiveDetailItem(null)}
                                    className="px-4 py-2 rounded-xl border border-secondary-200 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        {/* Summary Pill Header */}
                        <div className="rounded-xl border border-border bg-secondary-50/50 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase border ${activeDetailItem.tagStyle}`}>
                                    {activeDetailItem.tagLabel}
                                </span>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                                        activeDetailItem.appointment.status === 'approved'
                                            ? 'bg-blue-50 text-primary border-blue-200'
                                            : activeDetailItem.appointment.status === 'completed'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                >
                                    {activeDetailItem.appointment.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-secondary-400 block font-medium">Parishioner</span>
                                    <span className="font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                                        <User className="w-3.5 h-3.5 text-secondary-400" />
                                        {activeDetailItem.appointment.profile?.full_name || 'N/A'}
                                    </span>
                                    {activeDetailItem.appointment.profile?.email && (
                                        <span className="text-secondary-500 flex items-center gap-1 mt-1 text-[11px]">
                                            <Mail className="w-3 h-3 text-secondary-400" />
                                            {activeDetailItem.appointment.profile.email}
                                        </span>
                                    )}
                                    {activeDetailItem.appointment.profile?.phone_number && (
                                        <span className="text-secondary-500 flex items-center gap-1 mt-0.5 text-[11px]">
                                            <Phone className="w-3 h-3 text-secondary-400" />
                                            {activeDetailItem.appointment.profile.phone_number}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-secondary-400 block font-medium">Ceremony Schedule</span>
                                    <span className="font-bold text-foreground text-sm flex items-center gap-1 mt-0.5">
                                        <Calendar className="w-3.5 h-3.5 text-secondary-400" />
                                        {activeDetailItem.dateLabel}
                                    </span>
                                    <span className="text-secondary-500 flex items-center gap-1 mt-1 text-[11px]">
                                        <Clock className="w-3 h-3 text-secondary-400" />
                                        {activeDetailItem.timeLabel}
                                    </span>
                                    {activeDetailItem.appointment.church?.name && (
                                        <span className="text-secondary-500 flex items-center gap-1 mt-0.5 text-[11px]">
                                            <Church className="w-3 h-3 text-secondary-400" />
                                            {activeDetailItem.appointment.church.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Parishioner Notes */}
                        {activeDetailItem.appointment.notes && (
                            <div className="rounded-xl border border-border p-3.5 bg-white">
                                <span className="text-xs font-bold text-foreground block mb-1">
                                    Notes & Intentions from Parishioner
                                </span>
                                <p className="text-xs text-secondary-600 leading-relaxed italic bg-secondary-50/60 p-2.5 rounded-lg border border-border/50">
                                    "{activeDetailItem.appointment.notes}"
                                </p>
                            </div>
                        )}

                        {/* Administrative / Celebrant Feedback */}
                        {activeDetailItem.appointment.admin_feedback && (
                            <div className="rounded-xl border border-amber-200 p-3.5 bg-amber-50/40">
                                <span className="text-xs font-bold text-amber-900 block mb-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                    Canonical / Office Feedback
                                </span>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    {activeDetailItem.appointment.admin_feedback}
                                </p>
                            </div>
                        )}

                        {/* Documents Status */}
                        <div className="rounded-xl border border-border p-3.5 bg-white flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">
                                        Submitted Sacrament Documents
                                    </p>
                                    <p className="text-[11px] text-secondary-500">
                                        {activeDetailItem.hasDocuments
                                            ? `${activeDetailItem.documentCount} file${activeDetailItem.documentCount === 1 ? '' : 's'} uploaded and ready for inspection`
                                            : 'No documents attached to this appointment yet'}
                                    </p>
                                </div>
                            </div>

                            {activeDetailItem.hasDocuments && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const apptId = activeDetailItem.appointment.id;
                                        setActiveDetailItem(null);
                                        setActiveDocApptId(apptId);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-700 text-white font-semibold text-xs shadow-2xs transition-colors shrink-0 cursor-pointer"
                                >
                                    Open Viewer
                                </button>
                            )}
                        </div>

                        {/* Change history: the celebrant can read their appointment's edits (RLS) */}
                        <AppointmentChangeHistory
                            appointmentId={activeDetailItem.appointment.id}
                            refreshKey={activeDetailItem.appointment.updated_at ?? activeDetailItem.appointment.status}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}

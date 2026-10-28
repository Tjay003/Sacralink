import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/ui/Modal';
import CelebrantAttentionWidget from '../../components/dashboard/CelebrantAttentionWidget';
import ChurchAnnouncementsWidget from '../../components/dashboard/ChurchAnnouncementsWidget';
import PriestAvailabilityModal from '../../components/dashboard/PriestAvailabilityModal';
import {
    getAppointments,
    subscribeToAppointments,
    formatAppointmentTime,
    hasAppointmentStarted,
    markAppointmentCelebrated,
    APPOINTMENT_CELEBRATED_EVENT,
    type HydratedAppointment,
} from '../../lib/supabase/appointments';
import { getAppointmentDocuments, downloadDocument } from '../../lib/supabase/documents';
import {
    getPriestAvailability,
    checkPriestIsAvailable,
    DAY_NAMES,
    type PriestAvailabilityData,
} from '../../lib/supabase/priestAvailability';
import { getLiturgicalSeason, type LiturgicalSeasonInfo } from '../../lib/liturgy';
import {
    getSacramentMeta,
    SACRAMENT_FILTER_KEYS,
    type SacramentKey,
} from '../../lib/sacramentMeta';
import { format } from 'date-fns';
import RescheduledNotice from '../../components/appointments/RescheduledNotice';
import RequestedPriestNote from '../../components/appointments/RequestedPriestNote';
import AppointmentChangeHistory from '../../components/appointments/AppointmentChangeHistory';
import {
    Calendar,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    FileText,
    Flame,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Search,
    ShieldCheck,
    Building2,
    Users,
    AlertCircle,
    type LucideIcon,
} from 'lucide-react';
import { UserName } from '../../components/ui/UserName';
import { StatusBadge } from '../../components/ui/StatusBadge';

export interface PriestDashboardProps {
    churchId?: string | null;
}

interface DocumentItem {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    file_size: number | null;
    uploaded_at: string | null;
    sacrament_requirements: {
        requirement_name: string;
    } | null;
}

type SacramentFilter = SacramentKey | 'all';

const SEASON_DOTS: Record<LiturgicalSeasonInfo['liturgicalColor'], string> = {
    green: 'bg-emerald-500',
    purple: 'bg-violet-500',
    red: 'bg-red-500',
    white: 'bg-white ring-1 ring-amber-300',
    rose: 'bg-pink-400',
};

/** Parse YYYY-MM-DD as a local date (no timezone jitter). */
function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function minutesOfDay(time: string | null | undefined): number {
    const [h, m] = (time || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function formatCountdown(minutes: number): string {
    if (minutes <= 0) return 'starting now';
    if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `in ${hours} hr${rest ? ` ${rest} min` : ''}`;
}

function formatDateRange(start: string | null, end: string | null): string {
    if (!start) return '';
    const s = parseLocalDate(start);
    const e = end ? parseLocalDate(end) : s;
    if (s.getFullYear() !== e.getFullYear()) return `${format(s, 'MMM d, yyyy')} to ${format(e, 'MMM d, yyyy')}`;
    if (s.getMonth() !== e.getMonth()) return `${format(s, 'MMM d')} to ${format(e, 'MMM d, yyyy')}`;
    if (s.getDate() === e.getDate()) return format(s, 'MMM d, yyyy');
    return `${format(s, 'MMM d')} to ${format(e, 'd, yyyy')}`;
}

function getGreeting(hour: number): string {
    if (hour < 12) return 'Magandang umaga';
    if (hour < 18) return 'Magandang hapon';
    return 'Magandang gabi';
}

export default function PriestDashboard({ churchId }: PriestDashboardProps) {
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const [appointments, setAppointments] = useState<HydratedAppointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Uploaded vs required document counts for "Documents pending" flags
    const [uploadedDocCounts, setUploadedDocCounts] = useState<Record<string, number>>({});
    const [requiredDocCounts, setRequiredDocCounts] = useState<Record<string, number>>({});

    // Availability state
    const [availability, setAvailability] = useState<PriestAvailabilityData | null>(null);
    const [todayAvailable, setTodayAvailable] = useState<boolean>(true);
    const [todayUnavailableReason, setTodayUnavailableReason] = useState<string | null>(null);
    const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);

    // Filter and Search states
    const [sacramentFilter, setSacramentFilter] = useState<SacramentFilter>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Document modal states
    const [selectedAppointment, setSelectedAppointment] = useState<HydratedAppointment | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [docError, setDocError] = useState<string | null>(null);

    const priestId = profile?.id || user?.id;

    // "Mark celebrated" on the timeline: which row is saving and the last error
    const [celebratingId, setCelebratingId] = useState<string | null>(null);
    const [celebrateError, setCelebrateError] = useState<string | null>(null);

    // Ticks every minute so "Next · in 50 minutes" stays current
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    const todayStr = toDateKey(now);
    const season = useMemo(() => getLiturgicalSeason(parseLocalDate(todayStr)), [todayStr]);
    const seasonDot = SEASON_DOTS[season.liturgicalColor];

    const [fetchedChurchName, setFetchedChurchName] = useState<string | null>(null);

    // Effective Church Identity resolution
    const effectiveChurchId = useMemo(() => {
        return churchId || profile?.assigned_church_id || profile?.church_id || appointments.find((a) => a.church_id)?.church_id || null;
    }, [churchId, profile?.assigned_church_id, profile?.church_id, appointments]);

    // Fetch parish church details when effectiveChurchId is available but church name is not yet in appointments
    useEffect(() => {
        if (!effectiveChurchId) return;

        const fromAppointment = appointments.find((a) => a.church?.id === effectiveChurchId && a.church?.name)?.church?.name;
        if (fromAppointment) {
            setFetchedChurchName(fromAppointment);
            return;
        }

        let isMounted = true;
        const fetchChurchDetails = async () => {
            try {
                const { data, error: churchErr } = await supabase
                    .from('churches')
                    .select('name')
                    .eq('id', effectiveChurchId)
                    .maybeSingle();

                if (!churchErr && isMounted && data?.name) {
                    setFetchedChurchName(data.name);
                }
            } catch (err) {
                console.error('Error fetching church name for priest dashboard:', err);
            }
        };

        void fetchChurchDetails();

        return () => {
            isMounted = false;
        };
    }, [effectiveChurchId, appointments]);

    const effectiveChurchName = useMemo(() => {
        return (
            appointments.find((a) => a.church?.id === effectiveChurchId && a.church?.name)?.church?.name ||
            fetchedChurchName ||
            appointments.find((a) => a.church?.name)?.church?.name ||
            (profile as unknown as { church_name?: string })?.church_name ||
            undefined
        );
    }, [appointments, effectiveChurchId, fetchedChurchName, profile]);

    const fetchDocumentProgress = useCallback(async (appts: HydratedAppointment[]) => {
        const pending = appts.filter((a) => a.status === 'approved');
        if (pending.length === 0) {
            setUploadedDocCounts({});
            setRequiredDocCounts({});
            return;
        }

        try {
            const churchIds = Array.from(new Set(pending.map((a) => a.church_id).filter(Boolean)));
            const [docsRes, reqsRes] = await Promise.all([
                supabase
                    .from('appointment_documents')
                    .select('appointment_id')
                    .in('appointment_id', pending.map((a) => a.id)),
                supabase
                    .from('sacrament_requirements')
                    .select('service_type_id, is_required')
                    .in('church_id', churchIds),
            ]);

            const uploaded: Record<string, number> = {};
            for (const doc of docsRes.data || []) {
                uploaded[doc.appointment_id] = (uploaded[doc.appointment_id] || 0) + 1;
            }

            const required: Record<string, number> = {};
            for (const req of reqsRes.data || []) {
                if (req.is_required === false || !req.service_type_id) continue;
                required[req.service_type_id] = (required[req.service_type_id] || 0) + 1;
            }

            setUploadedDocCounts(uploaded);
            setRequiredDocCounts(required);
        } catch (err) {
            console.error('Error loading document progress:', err);
        }
    }, []);

    const fetchPriestAppointments = useCallback(async () => {
        if (!priestId) return;

        try {
            setError(null);
            const { data, error: fetchErr } = await getAppointments({
                priestId,
                statusIn: ['approved', 'completed'],
                orderBy: 'appointment_date',
                ascending: true,
            });

            if (fetchErr) throw fetchErr;
            setAppointments(data || []);
            void fetchDocumentProgress(data || []);
        } catch (err: unknown) {
            console.error('Error fetching priest appointments:', err);
            setError(err instanceof Error ? err.message : 'Unable to load liturgical appointments.');
        } finally {
            setLoading(false);
        }
    }, [priestId, fetchDocumentProgress]);

    const fetchAvailability = useCallback(async () => {
        if (!priestId) return;

        try {
            const [availRes, todayRes] = await Promise.all([
                getPriestAvailability(priestId),
                checkPriestIsAvailable(priestId, todayStr),
            ]);

            if (availRes.data) {
                setAvailability(availRes.data);
            }
            setTodayAvailable(todayRes.available);
            setTodayUnavailableReason(todayRes.reason || null);
        } catch (err) {
            console.error('Error loading priest availability:', err);
        }
    }, [priestId, todayStr]);

    useEffect(() => {
        void fetchPriestAppointments();
        void fetchAvailability();

        if (!priestId) return;

        const unsubscribe = subscribeToAppointments({ priestId }, () => {
            void fetchPriestAppointments();
        });

        // Marking an appointment Celebrated elsewhere on the page (the attention queue) refreshes the timeline and stats
        const handleCelebrated = () => void fetchPriestAppointments();
        window.addEventListener(APPOINTMENT_CELEBRATED_EVENT, handleCelebrated);

        return () => {
            unsubscribe();
            window.removeEventListener(APPOINTMENT_CELEBRATED_EVENT, handleCelebrated);
        };
    }, [priestId, churchId, fetchPriestAppointments, fetchAvailability]);

    // Mark one of the priest's own celebrations Celebrated; the badge and the yearly count update at once
    const handleMarkCelebrated = async (appointment: HydratedAppointment) => {
        setCelebratingId(appointment.id);
        setCelebrateError(null);
        try {
            const { success, error: markErr } = await markAppointmentCelebrated(appointment.id);
            if (!success) {
                setCelebrateError(markErr?.message || 'Could not mark this celebration. Please try again.');
                return;
            }
            setAppointments((current) =>
                current.map((a) => (a.id === appointment.id ? { ...a, status: 'completed' } : a))
            );
        } catch (err: unknown) {
            setCelebrateError(err instanceof Error ? err.message : 'Could not mark this celebration. Please try again.');
        } finally {
            setCelebratingId(null);
        }
    };

    // Open Document Inspection Modal
    const handleOpenDocModal = async (appointment: HydratedAppointment) => {
        setSelectedAppointment(appointment);
        setLoadingDocs(true);
        setDocError(null);
        setDocuments([]);

        try {
            const docs = await getAppointmentDocuments(appointment.id);
            setDocuments((docs as unknown as DocumentItem[]) || []);
        } catch (err: unknown) {
            console.error('Error loading documents:', err);
            setDocError(err instanceof Error ? err.message : 'Failed to load submitted documents.');
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleCloseDocModal = () => {
        setSelectedAppointment(null);
        setDocuments([]);
        setDocError(null);
    };

    const handleDownloadFile = async (fileUrl: string, fileName: string) => {
        try {
            await downloadDocument(fileUrl, fileName);
        } catch {
            window.open(fileUrl, '_blank');
        }
    };

    // "Fr. Anselmo" from "Anselmo Dizon" or "Fr. Anselmo Dizon"
    const clergyFirstName = useMemo(() => {
        const rawName = (profile?.full_name || '').trim().replace(/^(fr\.|father|rev\.|reverend)\s+/i, '');
        const firstName = rawName.split(/\s+/)[0];
        return firstName ? `Fr. ${firstName}` : 'Father';
    }, [profile?.full_name]);

    // ---- Availability helpers --------------------------------------------------
    const upcomingLeave = useMemo(() => {
        return (availability?.blackoutPeriods || []).filter((p) => (p.blackout_end || '') >= todayStr);
    }, [availability, todayStr]);

    const isOnDayOff = useCallback(
        (dateStr: string) => {
            if (!availability) return false;
            if (availability.recurringDayOff !== null && parseLocalDate(dateStr).getDay() === availability.recurringDayOff) {
                return true;
            }
            return availability.blackoutPeriods.some(
                (p) => p.blackout_start && p.blackout_end && dateStr >= p.blackout_start && dateStr <= p.blackout_end
            );
        },
        [availability]
    );

    const isDocumentsPending = useCallback(
        (appt: HydratedAppointment) => {
            const required = (appt.service_type_id && requiredDocCounts[appt.service_type_id]) || 0;
            return required > 0 && (uploadedDocCounts[appt.id] || 0) < required;
        },
        [requiredDocCounts, uploadedDocCounts]
    );

    // ---- Today -----------------------------------------------------------------
    const todayCelebrations = useMemo(() => {
        return appointments
            .filter((a) => a.appointment_date === todayStr)
            .sort((a, b) => minutesOfDay(a.appointment_time) - minutesOfDay(b.appointment_time));
    }, [appointments, todayStr]);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nextCelebration = todayCelebrations.find(
        (a) => a.status === 'approved' && minutesOfDay(a.appointment_time) >= nowMinutes
    );
    const celebratedTodayCount = todayCelebrations.filter((a) => a.status === 'completed').length;
    const remainingTodayCount = todayCelebrations.filter((a) => a.status === 'approved').length;

    // ---- Stats -----------------------------------------------------------------
    const weekEnd = useMemo(() => {
        const end = parseLocalDate(todayStr);
        end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
        return end;
    }, [todayStr]);
    const weekEndStr = toDateKey(weekEnd);

    const thisWeekCount = useMemo(() => {
        return appointments.filter((a) => a.appointment_date >= todayStr && a.appointment_date <= weekEndStr).length;
    }, [appointments, todayStr, weekEndStr]);

    const celebratedThisYearCount = useMemo(() => {
        const year = todayStr.slice(0, 4);
        return appointments.filter((a) => a.status === 'completed' && a.appointment_date.startsWith(year)).length;
    }, [appointments, todayStr]);

    // ---- Upcoming ministry -----------------------------------------------------
    const upcomingAppointments = useMemo(() => {
        return appointments
            .filter((a) => a.status === 'approved' && a.appointment_date > todayStr)
            .sort(
                (a, b) =>
                    a.appointment_date.localeCompare(b.appointment_date) ||
                    minutesOfDay(a.appointment_time) - minutesOfDay(b.appointment_time)
            );
    }, [appointments, todayStr]);

    const sacramentCounts = useMemo(() => {
        const counts = Object.fromEntries(SACRAMENT_FILTER_KEYS.map((key) => [key, 0])) as Record<SacramentKey, number>;
        for (const appt of upcomingAppointments) {
            const key = getSacramentMeta(appt.service_type).key;
            if (key in counts) counts[key] += 1;
        }
        return counts;
    }, [upcomingAppointments]);

    const filteredUpcoming = useMemo(() => {
        const term = searchQuery.toLowerCase().trim();
        return upcomingAppointments.filter((appt) => {
            const meta = getSacramentMeta(appt.service_type);
            if (sacramentFilter !== 'all' && meta.key !== sacramentFilter) return false;
            if (!term) return true;
            return [appt.profile?.full_name, appt.service_type, meta.title, appt.notes, appt.church?.name]
                .some((field) => (field || '').toLowerCase().includes(term));
        });
    }, [upcomingAppointments, sacramentFilter, searchQuery]);

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleContact = (appt: HydratedAppointment) => {
        if (appt.profile?.phone_number) {
            window.location.href = `tel:${appt.profile.phone_number}`;
        } else {
            navigate(`/messages?user=${appt.user_id}`);
        }
    };

    const SelectedIcon = selectedAppointment ? getSacramentMeta(selectedAppointment.service_type).icon : FileText;

    return (
        <div className="space-y-6">
            {/* Clergy Welcome Header */}
            <section className="relative rounded-3xl bg-gradient-to-r from-blue-100/70 via-white/80 via-40% to-amber-100/80 border border-amber-200/60 shadow-sm p-6 sm:p-7 lg:p-8 overflow-hidden">
                {/* Faith Blue and Sacred Gold ambient glows (2x richness) */}
                <div className="absolute -top-14 -left-14 w-80 h-80 bg-blue-200/60 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -top-14 -right-14 w-96 h-96 bg-amber-200/70 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${seasonDot}`} />
                                {season.label}
                            </span>
                            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase">
                                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${seasonDot}`} />
                                {season.colorName} vestments
                            </span>
                        </div>

                        <p className="text-sm font-medium text-secondary-500">{format(now, 'EEEE, MMMM d, yyyy')}</p>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-bold text-foreground tracking-tight leading-tight">
                            {getGreeting(now.getHours())}, {clergyFirstName}
                        </h1>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            {effectiveChurchName && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-primary border border-blue-200/80 text-xs font-semibold">
                                    Priest · {effectiveChurchName}
                                </span>
                            )}
                            {todayAvailable ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    Available
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-semibold">
                                    <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    {todayUnavailableReason || 'Day off / Leave'}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setAvailabilityModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98] self-start lg:self-center shrink-0 cursor-pointer"
                    >
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        Set availability and leave
                    </button>
                </div>
            </section>

            {/* Admin circulars */}

            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatTile
                    label="Presiding today"
                    value={todayCelebrations.length}
                    caption={
                        todayCelebrations.length === 0
                            ? 'No celebrations today'
                            : `${celebratedTodayCount} celebrated, ${remainingTodayCount} still to come`
                    }
                    icon={Flame}
                    iconClass="bg-amber-50 text-amber-600 border-amber-200"
                />
                <StatTile
                    label="This week"
                    value={thisWeekCount}
                    caption={`Celebrations through ${format(weekEnd, 'EEE, MMM d')}`}
                    icon={Calendar}
                    iconClass="bg-blue-50 text-primary border-blue-200"
                />
                <StatTile
                    label="Celebrated this year"
                    value={celebratedThisYearCount}
                    caption="Baptisms, weddings, funerals and anointings"
                    icon={CheckCircle2}
                    iconClass="bg-emerald-50 text-emerald-600 border-emerald-200"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-6 flex flex-col">
                    {/* Today's celebrations */}
                    <section className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
                        <div className="px-5 pt-5 pb-4 border-b border-border/70 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-foreground">Today's celebrations</h2>
                                <p className="text-xs text-muted mt-0.5">
                                    {format(now, 'EEEE, MMMM d')} · {todayCelebrations.length}{' '}
                                    {todayCelebrations.length === 1 ? 'celebration' : 'celebrations'}
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center text-muted">
                                <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-2" />
                                <p className="text-sm">Loading today's schedule...</p>
                            </div>
                        ) : error ? (
                            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-center text-red-700">
                                <AlertCircle className="w-7 h-7 mx-auto text-red-600 mb-2" />
                                <p className="font-semibold text-sm">{error}</p>
                                <button
                                    type="button"
                                    onClick={fetchPriestAppointments}
                                    className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/70">
                                {celebrateError && (
                                    <p role="alert" className="mx-5 my-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                                        {celebrateError}
                                    </p>
                                )}
                                {todayCelebrations.length === 0 && (
                                    <div className="px-5 py-10 text-center">
                                        <Clock className="w-8 h-8 mx-auto text-secondary-300 mb-2" />
                                        <p className="text-sm font-semibold text-foreground">No celebrations scheduled today</p>
                                        <p className="text-xs text-muted mt-1">Approved appointments assigned to you will appear here.</p>
                                    </div>
                                )}
                                {todayCelebrations.map((appt) => {
                                    const meta = getSacramentMeta(appt.service_type);
                                    const TypeIcon = meta.icon;
                                    const [clock, period] = formatAppointmentTime(appt.appointment_time).split(' ');
                                    const isNext = appt.id === nextCelebration?.id;
                                    const derivedStatus =
                                        appt.status === 'completed'
                                            ? null
                                            : isNext
                                            ? {
                                                  label: `Next · ${formatCountdown(minutesOfDay(appt.appointment_time) - nowMinutes)}`,
                                                  className: 'bg-blue-50 text-primary border-blue-200',
                                              }
                                            : minutesOfDay(appt.appointment_time) < nowMinutes
                                            ? { label: 'Earlier today', className: 'bg-amber-50 text-amber-800 border-amber-200' }
                                            : { label: 'Later today', className: 'bg-secondary-50 text-secondary-700 border-secondary-200' };

                                    return (
                                        <div
                                            key={appt.id}
                                            className={`px-5 py-4 grid grid-cols-[56px_1fr] sm:grid-cols-[64px_1fr_auto] gap-x-4 gap-y-3 ${
                                                isNext ? 'bg-blue-50/40' : ''
                                            }`}
                                        >
                                            <div>
                                                <p className="font-serif text-2xl font-bold text-foreground leading-none">{clock}</p>
                                                <p className="text-[10px] font-bold text-muted mt-1">{period}</p>
                                            </div>

                                            <div className="min-w-0 space-y-1.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-secondary-700">
                                                        <TypeIcon className="w-3 h-3" />
                                                        {meta.chipLabel}
                                                    </span>
                                                    {derivedStatus ? (
                                                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${derivedStatus.className}`}>
                                                            {derivedStatus.label}
                                                        </span>
                                                    ) : (
                                                        <StatusBadge domain="appointment" status={appt.status} size="sm" />
                                                    )}
                                                    <RescheduledNotice appointment={appt} />
                                                    <RequestedPriestNote appointment={appt} />
                                                </div>
                                                <h3 className="text-sm font-bold text-foreground">
                                                    {meta.title} · <UserName name={appt.profile?.full_name} deletedAt={appt.profile?.deleted_at} fallback="Parishioner" />
                                                </h3>
                                                <p className="text-xs text-muted flex items-center gap-1.5">
                                                    <MapPin className="w-3 h-3 shrink-0" />
                                                    {appt.church?.name || effectiveChurchName || 'Assigned parish'}
                                                </p>
                                                {appt.notes && (
                                                    <div className="max-w-sm rounded-lg border border-border bg-secondary-50/70 px-3 py-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                                            {meta.noteLabel}
                                                        </p>
                                                        <p className="text-xs text-secondary-700 leading-relaxed mt-0.5">{appt.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-start-2 sm:col-start-3 flex flex-wrap items-start gap-1">
                                                {appt.status === 'approved' &&
                                                    appt.priest_id === priestId &&
                                                    hasAppointmentStarted(appt, now) && (
                                                        <button
                                                            type="button"
                                                            disabled={celebratingId === appt.id}
                                                            onClick={() => void handleMarkCelebrated(appt)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Mark celebrated
                                                        </button>
                                                    )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDocModal(appt)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Details
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleContact(appt)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-secondary-600 hover:text-foreground hover:bg-secondary-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                                    title={appt.profile?.phone_number ? `Call ${appt.profile.phone_number}` : 'Message parishioner'}
                                                >
                                                    <Phone className="w-3.5 h-3.5" />
                                                    Contact
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Celebrant Attention Queue */}
                    <CelebrantAttentionWidget
                        priestId={priestId}
                        churchId={effectiveChurchId || undefined}
                        className="flex-1"
                    />
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Availability and rota */}
                    <section className="rounded-2xl border border-border bg-white p-5 shadow-xs space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-blue-50 text-primary border border-blue-100">
                                    <CalendarDays className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Availability and rota</h3>
                                    <p className="text-xs text-muted">Day off, retreats and leave</p>
                                </div>
                            </div>
                            {todayAvailable ? (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                    Available
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                    {todayUnavailableReason || 'Day off / Leave'}
                                </span>
                            )}
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-1">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                <Clock className="w-3.5 h-3.5" />
                                Weekly day off
                            </p>
                            <p className="font-serif text-lg font-bold text-foreground">
                                {availability?.recurringDayOff !== null && availability?.recurringDayOff !== undefined
                                    ? `Every ${DAY_NAMES[availability.recurringDayOff]}`
                                    : 'No weekly day off set'}
                            </p>
                            <p className="text-xs text-secondary-600 leading-relaxed">
                                Reserved for personal prayer and rest. The parish scheduler marks you unavailable on this day.
                            </p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                                Retreats and leave · {upcomingLeave.length} scheduled
                            </p>
                            {upcomingLeave.length === 0 ? (
                                <p className="p-3 text-center rounded-xl border border-dashed border-border bg-secondary-50/40 text-xs text-muted">
                                    No upcoming leave or retreat periods scheduled.
                                </p>
                            ) : (
                                <div className="divide-y divide-border/70">
                                    {upcomingLeave.slice(0, 3).map((period) => {
                                        const LeaveIcon: LucideIcon = /conference|meeting|assembly|seminar/i.test(period.reason || '')
                                            ? Users
                                            : Flame;
                                        return (
                                            <div key={period.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                                                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                                                    <LeaveIcon className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">
                                                        {period.reason || 'Clergy retreat'}
                                                    </p>
                                                    <p className="text-xs text-muted">
                                                        {formatDateRange(period.blackout_start, period.blackout_end)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setAvailabilityModalOpen(true)}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                        >
                            <Pencil className="w-3.5 h-3.5 text-secondary-500" />
                            Update availability and leave
                        </button>
                    </section>

                    {/* Parish Bulletin */}
                    <ChurchAnnouncementsWidget
                        churchId={effectiveChurchId}
                        churchName={effectiveChurchName}
                        variant="list"
                    />
                </div>
            </div>

            {/* Upcoming sacramental ministry */}
            <section className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
                <div className="px-5 pt-5 pb-4 space-y-4 border-b border-border/70">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-foreground">Upcoming sacramental ministry</h2>
                            <p className="text-xs text-muted mt-0.5">Celebrations where you are the presiding celebrant</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-blue-200 shrink-0">
                            {filteredUpcoming.length} of {upcomingAppointments.length}
                        </span>
                    </div>

                    <div className="relative max-w-sm">
                        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, sacrament or notes"
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by sacrament">
                        {(['all', ...SACRAMENT_FILTER_KEYS] as SacramentFilter[]).map((key) => {
                            const active = sacramentFilter === key;
                            const count = key === 'all' ? upcomingAppointments.length : sacramentCounts[key];
                            const label = key === 'all' ? 'All' : getSacramentMeta(key).chipLabel;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setSacramentFilter(key)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                        active
                                            ? 'border-primary bg-blue-50 text-primary'
                                            : 'border-border bg-white text-secondary-700 hover:bg-secondary-50'
                                    }`}
                                >
                                    {label}
                                    <span className={`text-[10px] ${active ? 'text-primary' : 'text-muted'}`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-muted">
                        <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-2" />
                        <p className="text-sm">Loading upcoming celebrations...</p>
                    </div>
                ) : filteredUpcoming.length === 0 ? (
                    <div className="p-10 text-center space-y-1">
                        <Calendar className="w-10 h-10 text-secondary-200 mx-auto mb-2" />
                        <h4 className="font-semibold text-foreground text-sm">No upcoming celebrations</h4>
                        <p className="text-xs text-muted max-w-sm mx-auto">
                            {searchQuery || sacramentFilter !== 'all'
                                ? 'Nothing matches your search or filter.'
                                : 'You have no assigned celebrations after today.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/70">
                        {filteredUpcoming.map((appt) => {
                            const meta = getSacramentMeta(appt.service_type);
                            const TypeIcon = meta.icon;
                            const date = parseLocalDate(appt.appointment_date);
                            const docsPending = isDocumentsPending(appt);

                            return (
                                <div key={appt.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-11 shrink-0 rounded-lg border border-border bg-white text-center py-1">
                                            <p className="text-sm font-bold text-foreground leading-tight">{format(date, 'd')}</p>
                                            <p className="text-[10px] font-bold uppercase text-muted">{format(date, 'MMM')}</p>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {meta.title} · <UserName name={appt.profile?.full_name} deletedAt={appt.profile?.deleted_at} fallback="Parishioner" />
                                            </p>
                                            <p className="text-xs text-muted truncate">
                                                {format(date, 'EEE')} · {formatAppointmentTime(appt.appointment_time)} ·{' '}
                                                {appt.church?.name || effectiveChurchName || 'Assigned parish'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end pl-[60px] sm:pl-0">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-secondary-700">
                                            <TypeIcon className="w-3 h-3" />
                                            {meta.chipLabel}
                                        </span>
                                        {docsPending ? (
                                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                Documents pending
                                            </span>
                                        ) : (
                                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                Confirmed
                                            </span>
                                        )}
                                        <RescheduledNotice appointment={appt} />
                                        {isOnDayOff(appt.appointment_date) && (
                                            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                On your day off
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDocModal(appt)}
                                            className="ml-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary-50 shadow-2xs transition-colors cursor-pointer"
                                        >
                                            Details
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Availability Management Modal */}
            <PriestAvailabilityModal
                isOpen={availabilityModalOpen}
                onClose={() => setAvailabilityModalOpen(false)}
                priestId={priestId || ''}
                churchId={effectiveChurchId}
                onAvailabilityUpdated={fetchAvailability}
            />

            {/* Celebrant Document Inspection Modal */}
            {selectedAppointment && (
                <Modal
                    isOpen={Boolean(selectedAppointment)}
                    onClose={handleCloseDocModal}
                    size="3xl"
                    title={
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    Sacramental Document Inspection
                                </h3>
                                <p className="text-xs text-muted">
                                    Presiding celebrant verification of submitted requirements
                                </p>
                            </div>
                        </div>
                    }
                    footer={
                        <button
                            type="button"
                            onClick={handleCloseDocModal}
                            className="px-5 py-2.5 rounded-xl border border-secondary-200 bg-white hover:bg-secondary-50 text-foreground font-semibold text-sm transition-colors shadow-xs cursor-pointer"
                        >
                            Close
                        </button>
                    }
                >
                    <div className="space-y-5">
                        {/* Ceremony Summary Card */}
                        <div className="rounded-2xl border border-border bg-secondary-50/50 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-white border border-border shadow-2xs text-primary">
                                        <SelectedIcon className="w-4 h-4" />
                                    </span>
                                    <h4 className="text-base font-bold text-foreground capitalize">
                                        {selectedAppointment.service_type}
                                    </h4>
                                </div>
                                <StatusBadge domain="appointment" status={selectedAppointment.status} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-secondary-700">
                                <div>
                                    <span className="text-muted block">Parishioner</span>
                                    <span className="font-semibold text-foreground text-sm">
                                        <UserName name={selectedAppointment.profile?.full_name} deletedAt={selectedAppointment.profile?.deleted_at} fallback="N/A" />
                                    </span>
                                    {selectedAppointment.profile?.email && (
                                        <p className="text-muted flex items-center gap-1 mt-0.5">
                                            <Mail className="w-3 h-3" />
                                            {selectedAppointment.profile.email}
                                        </p>
                                    )}
                                    {selectedAppointment.profile?.phone_number && (
                                        <p className="text-muted flex items-center gap-1 mt-0.5">
                                            <Phone className="w-3 h-3" />
                                            {selectedAppointment.profile.phone_number}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <span className="text-muted block">Schedule & Location</span>
                                    <span className="font-semibold text-foreground">
                                        {format(parseLocalDate(selectedAppointment.appointment_date), 'EEEE, MMMM d, yyyy')}
                                    </span>
                                    <p className="text-muted flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {formatAppointmentTime(selectedAppointment.appointment_time)}
                                    </p>
                                    <p className="text-muted flex items-center gap-1 mt-0.5">
                                        <Building2 className="w-3 h-3" />
                                        {selectedAppointment.church?.name || 'Assigned Parish'}
                                    </p>
                                </div>
                            </div>

                            {selectedAppointment.requested_priest_id && (
                                <div className="pt-2 border-t border-border">
                                    <span className="text-muted text-xs block mb-0.5">Parishioner&apos;s Priest Request:</span>
                                    <RequestedPriestNote appointment={selectedAppointment} />
                                </div>
                            )}

                            {selectedAppointment.notes && (
                                <div className="pt-2 border-t border-border">
                                    <span className="text-muted text-xs block mb-0.5">Special Intentions / Notes:</span>
                                    <p className="text-xs text-foreground italic bg-white p-2.5 rounded-xl border border-border">
                                        "{selectedAppointment.notes}"
                                    </p>
                                </div>
                            )}

                            {selectedAppointment.admin_feedback && (
                                <div className="pt-2 border-t border-border">
                                    <span className="text-muted text-xs block mb-0.5">Parish Office Feedback:</span>
                                    <p className="text-xs text-foreground bg-white p-2.5 rounded-xl border border-border">
                                        {selectedAppointment.admin_feedback}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Documents List */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Submitted Sacrament Certificates & Requirements
                            </h4>

                            {loadingDocs ? (
                                <div className="py-8 text-center text-muted">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2" />
                                    <p className="text-xs">Loading documents...</p>
                                </div>
                            ) : docError ? (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                                    {docError}
                                </div>
                            ) : documents.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-secondary-50/50 p-6 text-center text-muted">
                                    <FileText className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-foreground">
                                        No Documents Uploaded
                                    </p>
                                    <p className="text-xs text-muted mt-1">
                                        No prerequisite certificates have been attached to this ceremony yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="rounded-xl border border-border bg-white p-3.5 shadow-2xs hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="p-2 rounded-lg bg-primary-50 text-primary shrink-0 mt-0.5">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className="text-sm font-bold text-foreground truncate">
                                                        {doc.sacrament_requirements?.requirement_name || 'Sacramental Document'}
                                                    </h5>
                                                    <p className="text-xs text-muted truncate">
                                                        {doc.file_name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                                                        <span>{formatFileSize(doc.file_size)}</span>
                                                        {doc.uploaded_at && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <a
                                                    href={doc.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg border border-secondary-200 bg-secondary-50 hover:bg-white text-secondary-700 transition-colors"
                                                    title="View in new tab"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadFile(doc.file_url, doc.file_name)}
                                                    className="p-2 rounded-lg bg-primary hover:bg-primary-700 text-white transition-colors shadow-2xs cursor-pointer"
                                                    title="Download file"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Change history: the celebrant can read their appointment's edits (RLS) */}
                        <AppointmentChangeHistory
                            appointmentId={selectedAppointment.id}
                            refreshKey={selectedAppointment.updated_at ?? selectedAppointment.status}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}

interface StatTileProps {
    label: string;
    value: number;
    caption: string;
    icon: LucideIcon;
    iconClass: string;
    gradient?: string;
}

// Dynamic hover treatment matching icon accent (amber for presiding, blue for this week, emerald for celebrated)
function StatTile({ label, value, caption, icon: Icon, iconClass, gradient }: StatTileProps) {
    const hoverGradient = gradient || (() => {
        if (iconClass.includes('amber') || iconClass.includes('yellow')) {
            return 'from-amber-500 to-amber-600';
        }
        if (iconClass.includes('emerald') || iconClass.includes('green')) {
            return 'from-emerald-600 to-teal-600';
        }
        return 'from-blue-600 to-blue-500';
    })();

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className={"absolute inset-0 bg-gradient-to-br " + hoverGradient + " opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"} />
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-secondary-600 group-hover:text-white/90 transition-colors duration-300">
                        {label}
                    </p>
                    <div className={`p-2 rounded-lg border transition-all duration-300 group-hover:bg-white/20 group-hover:text-white group-hover:border-transparent ${iconClass}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                </div>
                <p className="font-serif text-3xl font-bold text-foreground mt-1 group-hover:text-white transition-colors duration-300">
                    {value}
                </p>
                <p className="text-xs text-muted mt-1 group-hover:text-white/80 transition-colors duration-300">{caption}</p>
            </div>
        </div>
    );
}

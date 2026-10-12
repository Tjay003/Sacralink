import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SystemAnnouncementsBanner } from '../../components/announcements';
import Modal from '../../components/ui/Modal';
import {
    getAppointments,
    subscribeToAppointments,
    formatAppointmentTime,
    type HydratedAppointment,
} from '../../lib/supabase/appointments';
import { getAppointmentDocuments, downloadDocument } from '../../lib/supabase/documents';
import { format } from 'date-fns';
import {
    Calendar,
    Clock,
    User,
    Phone,
    Mail,
    FileText,
    CheckCircle2,
    Sparkles,
    Filter,
    Search,
    Eye,
    Download,
    Building2,
    Flame,
    Heart,
    Cross,
    BookOpen,
    ShieldCheck,
    Droplets,
    AlertCircle,
} from 'lucide-react';

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

const LITURGICAL_QUOTES = [
    { text: "The harvest is plentiful, but the laborers are few; therefore pray earnestly to the Lord of the harvest to send out laborers into his harvest.", source: "Matthew 9:37-38" },
    { text: "You are a priest forever according to the order of Melchizedek.", source: "Psalm 110:4" },
    { text: "Feed my lambs... Tend my sheep... Feed my sheep.", source: "John 21:15-17" },
    { text: "The priesthood is the love of the heart of Jesus.", source: "St. John Vianney" },
    { text: "I will give you shepherds after my own heart, who will feed you with knowledge and understanding.", source: "Jeremiah 3:15" },
    { text: "Serve the Lord with gladness! Come into his presence with singing!", source: "Psalm 100:2" },
    { text: "As each has received a gift, use it to serve one another, as good stewards of God's varied grace.", source: "1 Peter 4:10" },
];

export default function PriestDashboard({ churchId }: PriestDashboardProps) {
    const { profile, user } = useAuth();
    const [appointments, setAppointments] = useState<HydratedAppointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter and Search states
    const [sacramentFilter, setSacramentFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Document modal states
    const [selectedAppointment, setSelectedAppointment] = useState<HydratedAppointment | null>(null);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [docError, setDocError] = useState<string | null>(null);

    const priestId = profile?.id || user?.id;

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
        } catch (err: unknown) {
            console.error('Error fetching priest appointments:', err);
            setError(err instanceof Error ? err.message : 'Unable to load liturgical appointments.');
        } finally {
            setLoading(false);
        }
    }, [priestId]);

    useEffect(() => {
        fetchPriestAppointments();

        if (!priestId) return;

        const unsubscribe = subscribeToAppointments({ priestId }, () => {
            fetchPriestAppointments();
        });

        return () => {
            unsubscribe();
        };
    }, [priestId, churchId, fetchPriestAppointments]);

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

    // Calculate today's date formatted
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDisplayDate = format(now, 'EEEE, MMMM d, yyyy');

    // Daily quote rotation
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const liturgicalQuote = LITURGICAL_QUOTES[dayOfYear % LITURGICAL_QUOTES.length];

    // Format Clergy Title
    const clergyGreeting = useMemo(() => {
        const rawName = (profile?.full_name || 'Father').trim();
        if (/^(fr\.|father|rev\.|reverend)\s+/i.test(rawName)) {
            return rawName;
        }
        return `Fr. ${rawName}`;
    }, [profile?.full_name]);

    // Stat counts
    const todayAppointments = useMemo(() => {
        return appointments.filter(
            (a) => a.appointment_date === todayStr && a.status === 'approved'
        );
    }, [appointments, todayStr]);

    const upcomingCount = useMemo(() => {
        return appointments.filter((a) => a.status === 'approved').length;
    }, [appointments]);

    const completedCount = useMemo(() => {
        return appointments.filter((a) => a.status === 'completed').length;
    }, [appointments]);

    // Filtered sacraments list
    const filteredAppointments = useMemo(() => {
        return appointments.filter((appt) => {
            // Status filter
            if (statusFilter !== 'all' && appt.status !== statusFilter) {
                return false;
            }

            // Sacrament type filter
            if (sacramentFilter !== 'all' && appt.service_type?.toLowerCase() !== sacramentFilter.toLowerCase()) {
                return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const term = searchQuery.toLowerCase().trim();
                const parishionerName = appt.profile?.full_name?.toLowerCase() || '';
                const sacrament = appt.service_type?.toLowerCase() || '';
                const notes = appt.notes?.toLowerCase() || '';
                const churchName = appt.church?.name?.toLowerCase() || '';
                if (!parishionerName.includes(term) && !sacrament.includes(term) && !notes.includes(term) && !churchName.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [appointments, statusFilter, sacramentFilter, searchQuery]);

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getSacramentIcon = (serviceType: string) => {
        const type = serviceType.toLowerCase();
        if (type.includes('bapt')) return <Droplets className="w-4 h-4 text-blue-600" />;
        if (type.includes('wed') || type.includes('matrim')) return <Heart className="w-4 h-4 text-rose-600" />;
        if (type.includes('fun') || type.includes('burial')) return <Cross className="w-4 h-4 text-slate-600" />;
        if (type.includes('confir')) return <Flame className="w-4 h-4 text-amber-600" />;
        if (type.includes('mass') || type.includes('intent')) return <BookOpen className="w-4 h-4 text-purple-600" />;
        if (type.includes('confess') || type.includes('reconcil')) return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
        return <Sparkles className="w-4 h-4 text-amber-600" />;
    };

    return (
        <div className="space-y-6">
            {/* System Announcements Banner */}
            <SystemAnnouncementsBanner />

            {/* Clergy Welcome Header */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white shadow-sm">
                <div className="relative z-10 max-w-3xl space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-amber-200 backdrop-blur-sm border border-white/20">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        Liturgical Celebrant Ministry • {todayDisplayDate}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Welcome, {clergyGreeting}
                    </h1>

                    <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-2xl">
                        May your priestly ministry bring grace and peace to the faithful under your care today.
                    </p>

                    {/* Liturgical Quote Card */}
                    <div className="mt-4 rounded-xl bg-black/20 p-4 border border-white/10 backdrop-blur-sm">
                        <p className="text-xs sm:text-sm italic text-amber-100 leading-relaxed">
                            "{liturgicalQuote.text}"
                        </p>
                        <p className="text-xs font-semibold text-amber-300 text-right mt-1.5">
                            — {liturgicalQuote.source}
                        </p>
                    </div>
                </div>

                {/* Subtle Liturgical Background Motif */}
                <div className="pointer-events-none absolute -right-8 -bottom-10 opacity-10">
                    <ChurchIconLarge className="w-64 h-64 text-white" />
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Today's Presided Ceremonies */}
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-muted">
                                Today's Ceremonies
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
                                {todayAppointments.length}
                            </h3>
                            <p className="text-xs text-muted mt-1">
                                {todayAppointments.length === 1 ? '1 celebration scheduled' : `${todayAppointments.length} celebrations scheduled`}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-200">
                            <Flame className="w-6 h-6 text-amber-600" />
                        </div>
                    </div>
                </div>

                {/* Upcoming Sacraments */}
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-muted">
                                Upcoming Sacraments
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
                                {upcomingCount}
                            </h3>
                            <p className="text-xs text-muted mt-1">
                                Future assigned liturgies
                            </p>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-3.5 border border-blue-200">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>

                {/* Completed Celebrations */}
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-muted">
                                Completed Celebrations
                            </p>
                            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
                                {completedCount}
                            </h3>
                            <p className="text-xs text-muted mt-1">
                                Sacraments celebrated
                            </p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Liturgical Schedule Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                            <Flame className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-bold text-foreground">
                            Today's Liturgical Schedule
                        </h2>
                    </div>
                    <span className="text-xs text-muted font-medium">
                        {todayDisplayDate}
                    </span>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-border bg-white p-8 text-center text-muted shadow-sm">
                        <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-2" />
                        <p className="text-sm">Loading today's schedule...</p>
                    </div>
                ) : todayAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-gradient-to-r from-amber-50/50 via-white to-blue-50/30 p-6 text-center shadow-sm">
                        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3 border border-amber-200">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                            No Presided Liturgies Scheduled for Today
                        </h3>
                        <p className="text-xs sm:text-sm text-muted max-w-md mx-auto mt-1">
                            Your celebrant schedule is clear today. A blessed time for prayer, personal study, and pastoral presence in the parish.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {todayAppointments.map((appt) => (
                            <div
                                key={appt.id}
                                className="rounded-2xl border-2 border-amber-300 bg-amber-50/30 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-xs">
                                                {getSacramentIcon(appt.service_type)}
                                                <span className="capitalize">{appt.service_type}</span>
                                            </span>
                                            <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-900">
                                                Today
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200">
                                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                                            {formatAppointmentTime(appt.appointment_time)}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-base font-bold text-foreground">
                                            {appt.profile?.full_name || 'Parishioner'}
                                        </h4>
                                        <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                                            <Building2 className="w-3.5 h-3.5 text-muted" />
                                            {appt.church?.name || 'Assigned Parish'}
                                        </p>
                                    </div>

                                    {appt.notes && (
                                        <div className="rounded-xl bg-white/80 p-2.5 border border-amber-200/70 text-xs text-secondary-700 italic">
                                            "{appt.notes}"
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-amber-200 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs text-muted">
                                        {appt.profile?.phone_number && (
                                            <a
                                                href={`tel:${appt.profile.phone_number}`}
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                                title="Call parishioner"
                                            >
                                                <Phone className="w-3 h-3" />
                                                {appt.profile.phone_number}
                                            </a>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenDocModal(appt)}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors shadow-xs"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        Review Requirements
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming Assigned Sacraments List Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-100 text-primary">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">
                                Presided Sacramental Schedule
                            </h2>
                            <p className="text-xs text-muted">
                                Liturgies where you are the assigned presiding celebrant
                            </p>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="inline-flex rounded-xl bg-secondary-100 p-1 text-xs font-medium self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`rounded-lg px-3 py-1.5 transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-white text-foreground shadow-xs font-semibold'
                                    : 'text-muted hover:text-foreground'
                            }`}
                        >
                            All ({appointments.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('approved')}
                            className={`rounded-lg px-3 py-1.5 transition-all ${
                                statusFilter === 'approved'
                                    ? 'bg-white text-primary shadow-xs font-semibold'
                                    : 'text-muted hover:text-foreground'
                            }`}
                        >
                            Upcoming ({upcomingCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('completed')}
                            className={`rounded-lg px-3 py-1.5 transition-all ${
                                statusFilter === 'completed'
                                    ? 'bg-white text-emerald-600 shadow-xs font-semibold'
                                    : 'text-muted hover:text-foreground'
                            }`}
                        >
                            Completed ({completedCount})
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Search */}
                    <div className="relative sm:col-span-2">
                        <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by parishioner, sacrament, notes, or church..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                        />
                    </div>

                    {/* Sacrament Type Filter */}
                    <div className="relative">
                        <Filter className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                            value={sacramentFilter}
                            onChange={(e) => setSacramentFilter(e.target.value)}
                            aria-label="Filter by Sacrament Type"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs capitalize"
                        >
                            <option value="all">All Sacraments</option>
                            <option value="baptism">Baptism</option>
                            <option value="wedding">Holy Matrimony / Wedding</option>
                            <option value="funeral">Funeral Mass</option>
                            <option value="confirmation">Confirmation</option>
                            <option value="confession">Confession / Reconciliation</option>
                            <option value="mass_intention">Mass Intention</option>
                            <option value="counseling">Pastoral Counseling</option>
                            <option value="anointing">Anointing of the Sick</option>
                        </select>
                    </div>
                </div>

                {/* Sacraments Card List */}
                {loading ? (
                    <div className="rounded-2xl border border-border bg-white p-12 text-center text-muted shadow-sm">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
                        <p className="text-sm font-medium">Loading assigned sacraments...</p>
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 shadow-sm">
                        <AlertCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                        <p className="font-semibold text-sm">{error}</p>
                        <button
                            type="button"
                            onClick={fetchPriestAppointments}
                            className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-white p-12 text-center text-muted shadow-sm space-y-2">
                        <Calendar className="w-12 h-12 text-secondary-200 mx-auto mb-2" />
                        <h4 className="font-semibold text-foreground text-base">
                            No Sacraments Found
                        </h4>
                        <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto">
                            {searchQuery || sacramentFilter !== 'all' || statusFilter !== 'all'
                                ? 'No assignments match your selected search or filter criteria.'
                                : 'You have no assigned liturgical appointments at this time.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAppointments.map((appt) => {
                            const isToday = appt.appointment_date === todayStr;
                            const isCompleted = appt.status === 'completed';

                            return (
                                <div
                                    key={appt.id}
                                    className={`rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                                        isToday ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-border'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {/* Date and Sacrament Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Date badge */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 text-center rounded-xl border border-border overflow-hidden shadow-xs bg-white">
                                                    <div className={`text-[10px] font-bold uppercase py-0.5 ${
                                                        isToday ? 'bg-amber-500 text-white' : 'bg-primary text-white'
                                                    }`}>
                                                        {format(new Date(appt.appointment_date), 'MMM')}
                                                    </div>
                                                    <div className="text-base font-bold text-foreground py-0.5">
                                                        {format(new Date(appt.appointment_date), 'dd')}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="p-1 rounded-md bg-secondary-100">
                                                            {getSacramentIcon(appt.service_type)}
                                                        </span>
                                                        <span className="text-xs font-bold text-foreground capitalize">
                                                            {appt.service_type}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {formatAppointmentTime(appt.appointment_time)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize border ${
                                                isCompleted
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : isToday
                                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                                {isToday ? 'Today' : appt.status}
                                            </span>
                                        </div>

                                        {/* Parishioner Info */}
                                        <div className="pt-2 border-t border-secondary-100 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-muted shrink-0" />
                                                <span className="text-sm font-semibold text-foreground truncate">
                                                    {appt.profile?.full_name || 'Parishioner'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-xs text-muted">
                                                <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
                                                <span className="truncate">
                                                    {appt.church?.name || 'Assigned Parish'}
                                                </span>
                                            </div>

                                            {appt.profile?.phone_number && (
                                                <div className="flex items-center gap-2 text-xs text-muted">
                                                    <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                                                    <a
                                                        href={`tel:${appt.profile.phone_number}`}
                                                        className="text-primary hover:underline truncate"
                                                    >
                                                        {appt.profile.phone_number}
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pastoral Notes / Intentions */}
                                        {appt.notes && (
                                            <div className="rounded-xl bg-secondary-50 p-2.5 border border-secondary-200 text-xs text-secondary-700 line-clamp-2">
                                                <span className="font-semibold text-secondary-900">Notes: </span>
                                                {appt.notes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action button */}
                                    <div className="mt-4 pt-3 border-t border-secondary-100 flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-muted">
                                            {format(new Date(appt.appointment_date), 'EEE, MMM d, yyyy')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDocModal(appt)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-secondary-200 bg-white hover:bg-secondary-50 text-foreground text-xs font-semibold transition-colors shadow-2xs"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-primary" />
                                            View Documents
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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
                            className="px-5 py-2.5 rounded-xl border border-secondary-200 bg-white hover:bg-secondary-50 text-foreground font-semibold text-sm transition-colors shadow-xs"
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
                                    <span className="p-1 rounded-md bg-white border border-border shadow-2xs">
                                        {getSacramentIcon(selectedAppointment.service_type)}
                                    </span>
                                    <h4 className="text-base font-bold text-foreground capitalize">
                                        {selectedAppointment.service_type}
                                    </h4>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                                    selectedAppointment.status === 'completed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-primary border-blue-200'
                                }`}>
                                    {selectedAppointment.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-secondary-700">
                                <div>
                                    <span className="text-muted block">Parishioner</span>
                                    <span className="font-semibold text-foreground text-sm">
                                        {selectedAppointment.profile?.full_name || 'N/A'}
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
                                        {format(new Date(selectedAppointment.appointment_date), 'EEEE, MMMM d, yyyy')}
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
                                                    className="p-2 rounded-lg bg-primary hover:bg-primary-700 text-white transition-colors shadow-2xs"
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
                    </div>
                </Modal>
            )}
        </div>
    );
}

function ChurchIconLarge(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2" />
            <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" />
            <path d="M18 22V5l-6-3-6 3v17" />
            <path d="M12 7v5" />
            <path d="M10 9h4" />
        </svg>
    );
}

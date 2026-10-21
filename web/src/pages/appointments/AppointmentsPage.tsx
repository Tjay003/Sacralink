import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    CheckCircle,
    XCircle,
    Building2,
    FileText,
    Search,
    X,
    ChevronDown,
    Cross,
    Download,
    Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    getAppointments,
    approveAppointment,
    rejectAppointment,
    subscribeToAppointments,
    formatAppointmentTime as formatTime,
    type HydratedAppointment as Appointment,
    type AppointmentStatus,
} from '../../lib/supabase/appointments';
import { isFuneralService } from '../../lib/supabase/serviceTypes';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import DocumentViewerModal from '../../components/documents/DocumentViewerModal';
import ApproveAppointmentModal from '../../components/appointments/ApproveAppointmentModal';
import RequestedPriestNote from '../../components/appointments/RequestedPriestNote';
import EditAppointmentModal from '../../components/appointments/EditAppointmentModal';
import RescheduledNotice from '../../components/appointments/RescheduledNotice';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/common/Pagination';

function getCurrentWeekDays(): { dateStr: string; dayName: string; dayNum: number }[] {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const dayNum = d.getDate();
        return { dateStr, dayName, dayNum };
    });
}

function formatSacramentTitle(type: string): string {
    const map: Record<string, string> = {
        baptism: 'Baptism',
        wedding: 'Matrimony',
        matrimony: 'Matrimony',
        funeral: 'Funeral / Burial',
        burial: 'Funeral / Burial',
        confirmation: 'Confirmation',
        mass_intention: 'Mass Intention',
        anointing: 'Anointing of the Sick',
        confession: 'Confession',
        counseling: 'Counseling',
        house_blessing: 'House Blessing',
    };
    if (map[type.toLowerCase()]) {
        return map[type.toLowerCase()];
    }
    return type
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function getCandidateDisplay(appointment: Appointment): string {
    if (appointment.notes) {
        const trimmed = appointment.notes.trim();
        const candidateMatch = trimmed.match(
            /(?:candidate|name|for|child|deceased|deceased person|couple):\s*([^,\n.]+)/i
        );
        if (candidateMatch && candidateMatch[1].trim()) {
            return candidateMatch[1].trim();
        }
        if (
            trimmed.length > 0 &&
            trimmed.length <= 35 &&
            !trimmed.includes('\n') &&
            !trimmed.toLowerCase().startsWith('http')
        ) {
            return trimmed;
        }
    }
    return appointment.profile?.full_name || 'Parishioner';
}

function formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '—';
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function formatCelebrantDisplay(priest: { full_name: string | null } | null | undefined): string {
    if (!priest || !priest.full_name) return 'Not assigned';
    const trimmed = priest.full_name.trim();
    if (trimmed.toLowerCase().startsWith('fr.') || trimmed.toLowerCase().startsWith('father ')) {
        return trimmed;
    }
    return `Fr. ${trimmed}`;
}

export default function AppointmentsPage() {
    const { profile } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterSacrament, setFilterSacrament] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewingDocumentsFor, setViewingDocumentsFor] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Dynamic week days
    const currentWeekDays = useMemo(() => getCurrentWeekDays(), []);
    const [weekDayCounts, setWeekDayCounts] = useState<Record<string, number>>({});
    const [statusCounts, setStatusCounts] = useState({
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
    });

    // Church filter — admin/super_admin only
    const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'admin';
    const isChurchStaff =
        profile?.role === 'church_admin' || profile?.role === 'volunteer' || profile?.role === 'priest';
    const { churches } = useChurches();
    const [selectedChurchId, setSelectedChurchId] = useState<string>('all');

    const userChurchId = profile?.assigned_church_id || profile?.church_id || null;

    // Effective church for display badge and scoping
    const effectiveChurchId = isChurchStaff
        ? userChurchId
        : selectedChurchId === 'all'
            ? null
            : selectedChurchId;

    const activeChurchName = isChurchStaff
        ? churches.find((c) => c.id === userChurchId)?.name || 'Your Church'
        : selectedChurchId === 'all'
            ? 'All Churches'
            : churches.find((c) => c.id === selectedChurchId)?.name || 'Unknown';

    // Export notice placeholder state
    const [showExportNotice, setShowExportNotice] = useState(false);

    const handleExport = () => {
        setShowExportNotice(true);
        setTimeout(() => setShowExportNotice(false), 3500);
    };

    // Approve modal state with priest assignment & feedback
    const [approvingAppointment, setApprovingAppointment] = useState<Appointment | null>(null);
    const [isApproving, setIsApproving] = useState(false);

    // Edit modal state (approved appointments, parish office only)
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

    // Confirmation modal state (for rejection)
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        appointmentId: string;
        newStatus: 'approved' | 'rejected';
        serviceType: string;
    } | null>(null);

    const openConfirmModal = (id: string, newStatus: 'approved' | 'rejected', serviceType: string) => {
        setConfirmModal({ open: true, appointmentId: id, newStatus, serviceType });
    };

    const closeConfirmModal = () => setConfirmModal(null);

    const handleConfirm = async () => {
        if (!confirmModal) return;
        await handleStatusUpdate(confirmModal.appointmentId, confirmModal.newStatus);
        closeConfirmModal();
    };

    const handleApproveConfirm = async (priestId: string | null, adminFeedback: string | null) => {
        // Approving is for pending requests only; approved appointments are changed through Edit
        if (!approvingAppointment || approvingAppointment.status !== 'pending') return;
        try {
            setIsApproving(true);
            const { success, error: updateErr } = await approveAppointment(
                approvingAppointment.id,
                priestId,
                adminFeedback
            );

            if (!success || updateErr) throw updateErr;

            await fetchAppointments();
            void fetchMetaCounts();
            setApprovingAppointment(null);
        } catch (err) {
            console.error('Error saving appointment:', err);
            alert('Failed to save appointment changes');
        } finally {
            setIsApproving(false);
        }
    };

    const canManageAppointments =
        profile?.role === 'admin' ||
        profile?.role === 'super_admin' ||
        profile?.role === 'church_admin' ||
        profile?.role === 'volunteer' ||
        profile?.role === 'priest';

    // Only the parish office may edit an approved appointment (priests and volunteers cannot)
    const canEditAppointments =
        profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'church_admin';

    const fetchMetaCounts = useCallback(async () => {
        try {
            const startOfWeek = currentWeekDays[0].dateStr;
            const endOfWeek = currentWeekDays[6].dateStr;

            // Fetch live status counts
            let statusQuery = supabase.from('appointments').select('status');
            if (effectiveChurchId) {
                statusQuery = statusQuery.eq('church_id', effectiveChurchId);
            }
            const { data: statusData } = await statusQuery;
            if (statusData) {
                const pending = statusData.filter((d) => d.status === 'pending').length;
                const approved = statusData.filter((d) => d.status === 'approved').length;
                const rejected = statusData.filter((d) => d.status === 'rejected').length;
                const cancelled = statusData.filter((d) => d.status === 'cancelled').length;
                setStatusCounts({
                    all: statusData.length,
                    pending,
                    approved,
                    rejected,
                    cancelled,
                });
            }

            // Fetch live week day counts
            let weekQuery = supabase
                .from('appointments')
                .select('appointment_date')
                .gte('appointment_date', startOfWeek)
                .lte('appointment_date', endOfWeek);
            if (effectiveChurchId) {
                weekQuery = weekQuery.eq('church_id', effectiveChurchId);
            }
            const { data: weekData } = await weekQuery;
            if (weekData) {
                const counts: Record<string, number> = {};
                currentWeekDays.forEach((d) => {
                    counts[d.dateStr] = 0;
                });
                weekData.forEach((row) => {
                    if (row.appointment_date && counts[row.appointment_date] !== undefined) {
                        counts[row.appointment_date] += 1;
                    }
                });
                setWeekDayCounts(counts);
            }
        } catch (err) {
            console.warn('Non-fatal error loading appointments meta counts:', err);
        }
    }, [currentWeekDays, effectiveChurchId]);

    const fetchAppointments = useCallback(async () => {
        try {
            setLoading(true);
            const { data, count, error: fetchErr } = await getAppointments({
                churchId: effectiveChurchId,
                status: filterStatus !== 'all' ? (filterStatus as AppointmentStatus) : undefined,
                serviceType: filterSacrament !== 'all' ? filterSacrament : undefined,
                dateFrom: filterDateFrom || undefined,
                dateTo: filterDateTo || undefined,
                searchQuery: searchQuery.trim() || undefined,
                page: currentPage,
                pageSize: pageSize,
                orderBy: 'appointment_date',
                ascending: false,
            });
            if (fetchErr) throw fetchErr;
            setAppointments(data || []);
            setTotalCount(count ?? (data?.length || 0));
        } catch (err) {
            console.error('Error fetching appointments:', err);
            setError('Failed to load appointments.');
        } finally {
            setLoading(false);
        }
    }, [effectiveChurchId, filterStatus, filterSacrament, filterDateFrom, filterDateTo, searchQuery, currentPage, pageSize]);

    useEffect(() => {
        void fetchAppointments();
        void fetchMetaCounts();
        const unsubscribe = subscribeToAppointments(
            effectiveChurchId ? { churchId: effectiveChurchId } : undefined,
            () => {
                void fetchAppointments();
                void fetchMetaCounts();
            }
        );
        return () => {
            unsubscribe();
        };
    }, [fetchAppointments, fetchMetaCounts, effectiveChurchId]);

    const handleStatusUpdate = async (id: string, newStatus: AppointmentStatus) => {
        try {
            const appointment = appointments.find((app) => app.id === id);
            if (!appointment) return;

            const { success, error: updateErr } =
                newStatus === 'rejected' ? await rejectAppointment(id) : await approveAppointment(id);

            if (!success || updateErr) throw updateErr;

            // Optimistic local state update
            setAppointments((prev) =>
                prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
            );
            void fetchMetaCounts();
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status');
        }
    };

    const resetToPage1 = () => setCurrentPage(1);

    const handleSelectDay = (dateStr: string) => {
        if (selectedDayDate === dateStr) {
            setSelectedDayDate(null);
            setFilterDateFrom('');
            setFilterDateTo('');
        } else {
            setSelectedDayDate(dateStr);
            setFilterDateFrom(dateStr);
            setFilterDateTo(dateStr);
        }
        resetToPage1();
    };

    const activeFilterCount = [
        filterStatus !== 'all',
        filterSacrament !== 'all',
        selectedDayDate !== null,
        searchQuery !== '',
        isAdminRole && selectedChurchId !== 'all',
    ].filter(Boolean).length;

    const clearAllFilters = () => {
        setFilterStatus('all');
        setFilterSacrament('all');
        setSelectedDayDate(null);
        setFilterDateFrom('');
        setFilterDateTo('');
        setSearchQuery('');
        if (isAdminRole) setSelectedChurchId('all');
        setCurrentPage(1);
    };

    const statusTabs = [
        { id: 'all', label: 'All', count: statusCounts.all },
        { id: 'pending', label: 'Pending', count: statusCounts.pending },
        { id: 'approved', label: 'Approved', count: statusCounts.approved },
        { id: 'rejected', label: 'Rejected', count: statusCounts.rejected },
        { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
    ];

    if (loading && appointments.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
                <div>
                    <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                        Appointments
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-1">
                        {!canManageAppointments
                            ? `Sacramental requests · ${totalCount} in total`
                            : effectiveChurchId && activeChurchName !== 'All Churches'
                                ? `Sacramental requests from ${activeChurchName} · ${totalCount} in total`
                                : `Sacramental requests from every parish · ${totalCount} in total`}
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {/* Church Selector — super_admin & admin only */}
                    {isAdminRole && (
                        <div className="relative min-w-[200px] sm:min-w-[240px]">
                            <select
                                value={selectedChurchId}
                                onChange={(e) => {
                                    setSelectedChurchId(e.target.value);
                                    resetToPage1();
                                }}
                                aria-label="Filter by parish"
                                className="w-full bg-white hover:bg-secondary-50 text-foreground border border-border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer appearance-none pr-8"
                            >
                                <option value="all">All parishes</option>
                                {churches.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-500 pointer-events-none" />
                        </div>
                    )}

                    {/* Church Staff assigned parish badge */}
                    {isChurchStaff && (
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-secondary-800 border border-border rounded-xl text-xs sm:text-sm font-semibold shadow-xs">
                            <Building2 className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate max-w-[200px]" title={activeChurchName}>
                                {activeChurchName}
                            </span>
                        </div>
                    )}

                    {/* Export Button */}
                    <button
                        type="button"
                        onClick={handleExport}
                        className="bg-white hover:bg-secondary-50 text-secondary-800 border border-border rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                        <Download className="w-4 h-4 text-secondary-600" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Row 1: Weekly Calendar Strip */}
            <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2.5 overflow-x-auto pb-2 scrollbar-none touch-pan-x">
                {currentWeekDays.map((day) => {
                    const isSelected = selectedDayDate === day.dateStr;
                    const count = weekDayCounts[day.dateStr] ?? 0;
                    return (
                        <button
                            key={day.dateStr}
                            type="button"
                            onClick={() => handleSelectDay(day.dateStr)}
                            className={`flex-shrink-0 w-24 sm:w-auto rounded-2xl p-2.5 sm:p-3 text-center transition-all cursor-pointer ${
                                isSelected
                                    ? 'bg-blue-50/70 border-2 border-primary text-primary shadow-xs'
                                    : 'bg-white border border-border/80 hover:border-secondary-300 shadow-2xs'
                            }`}
                        >
                            <div
                                className={`text-[11px] font-bold tracking-wider uppercase ${
                                    isSelected ? 'text-primary' : 'text-secondary-500'
                                }`}
                            >
                                {day.dayName}
                            </div>
                            <div
                                className={`text-lg sm:text-xl font-bold my-0.5 ${
                                    isSelected ? 'text-primary' : 'text-foreground'
                                }`}
                            >
                                {day.dayNum}
                            </div>
                            <div
                                className={`text-xs font-medium ${
                                    isSelected ? 'text-primary/90 font-semibold' : 'text-secondary-500'
                                }`}
                            >
                                {count} {count === 1 ? 'request' : 'requests'}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Row 2: Segmented Filter Bar & Search */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Left: Segmented Status Controls */}
                <div className="flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/60 border border-border/60 gap-1 overflow-x-auto scrollbar-none max-w-full flex-nowrap shrink-0">
                    {statusTabs.map((tab) => {
                        const isActive = filterStatus === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setFilterStatus(tab.id);
                                    resetToPage1();
                                }}
                                className={`inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    isActive
                                        ? 'bg-white text-foreground shadow-xs'
                                        : 'text-secondary-600 hover:text-foreground'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                        isActive
                                            ? 'bg-blue-100 text-primary'
                                            : 'bg-secondary-200/70 text-secondary-600'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right: Search + Sacrament Type Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                    {/* Search input */}
                    <div className="relative w-full sm:w-64 lg:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search parishioner..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                resetToPage1();
                            }}
                            className="w-full pl-9 pr-8 py-2 rounded-full border border-border text-xs sm:text-sm bg-white placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    resetToPage1();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 cursor-pointer"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Sacrament type filter & Clear Button */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <select
                                value={filterSacrament}
                                onChange={(e) => {
                                    setFilterSacrament(e.target.value);
                                    resetToPage1();
                                }}
                                aria-label="Filter by sacrament"
                                className="w-full sm:w-auto appearance-none bg-white border border-border rounded-full pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium text-secondary-700 hover:bg-secondary-50 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="all">All Sacraments</option>
                                <option value="baptism">Baptism</option>
                                <option value="wedding">Matrimony</option>
                                <option value="funeral">Funeral / Burial</option>
                                <option value="confirmation">Confirmation</option>
                                <option value="mass_intention">Mass Intention</option>
                                <option value="anointing">Anointing</option>
                                <option value="confession">Confession</option>
                                <option value="counseling">Counseling</option>
                                <option value="house_blessing">House Blessing</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-500 pointer-events-none" />
                        </div>

                        {/* Clear active filter button */}
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                title="Reset filters"
                                className="p-2 rounded-full border border-border bg-white text-secondary-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm">
                    {error}
                </div>
            )}

            {/* Desktop View: Appointments Data Table */}
            <div className="hidden md:block bg-white border border-border/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full min-w-[800px] lg:min-w-[920px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/70 bg-secondary-50/50">
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-left">
                                    Sacrament
                                </th>
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-left">
                                    Requested By
                                </th>
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-left">
                                    Date and Time
                                </th>
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-left">
                                    Celebrant
                                </th>
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-left">
                                    Status
                                </th>
                                <th className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase px-3.5 lg:px-5 py-3.5 text-right pr-4 lg:pr-6">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {appointments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 px-4 text-secondary-500">
                                        <Calendar className="w-10 h-10 mx-auto mb-2.5 text-secondary-300" />
                                        <p className="font-semibold text-sm text-foreground">
                                            {canManageAppointments
                                                ? 'No appointment requests found'
                                                : 'You have no appointment requests'}
                                        </p>
                                        <p className="text-xs text-secondary-400 mt-1">
                                            Try adjusting your filters or selecting a different date.
                                        </p>
                                        {activeFilterCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={clearAllFilters}
                                                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors shadow-2xs cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                                Clear all filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                appointments.map((appointment) => {
                                    const isFuneral = isFuneralService(appointment.service_kind, appointment.service_type);
                                    const candidate = getCandidateDisplay(appointment);

                                    return (
                                        <tr
                                            key={appointment.id}
                                            className="hover:bg-secondary-50/50 transition-colors"
                                        >
                                            {/* SACRAMENT */}
                                            <td className="px-3.5 lg:px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
                                                        <Cross className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-sm text-foreground capitalize block truncate">
                                                            {formatSacramentTitle(appointment.service_type)}
                                                        </span>
                                                        <span className="text-xs text-secondary-500 font-normal truncate block mt-0.5 max-w-[200px]">
                                                            {appointment.church?.name || 'Parish'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* REQUESTED BY */}
                                            <td className="px-3.5 lg:px-5 py-3.5">
                                                <div className="min-w-0 max-w-[240px]">
                                                    <span
                                                        className="font-bold text-sm text-foreground truncate block"
                                                        title={candidate}
                                                    >
                                                        {candidate}
                                                    </span>
                                                    <div className="text-xs text-secondary-500 mt-0.5 flex items-center gap-1.5">
                                                        <span className="truncate max-w-[140px]">
                                                            by {appointment.profile?.full_name || 'Parishioner'}
                                                        </span>
                                                        <span>·</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingDocumentsFor(appointment.id)}
                                                            className="text-primary hover:underline font-medium cursor-pointer"
                                                        >
                                                            docs
                                                        </button>
                                                    </div>
                                                    {appointment.notes && candidate !== appointment.notes && (
                                                        <div
                                                            className="text-[11px] text-secondary-400 italic truncate mt-0.5 max-w-[220px]"
                                                            title={appointment.notes}
                                                        >
                                                            &ldquo;{appointment.notes}&rdquo;
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* DATE AND TIME */}
                                            <td className="px-3.5 lg:px-5 py-3.5 whitespace-nowrap">
                                                <div className="font-bold text-xs sm:text-sm text-foreground">
                                                    {formatDateDisplay(appointment.appointment_date)}
                                                </div>
                                                <div className="text-xs text-secondary-500 mt-0.5">
                                                    {formatTime(appointment.appointment_time)}
                                                </div>
                                                <RescheduledNotice appointment={appointment} className="mt-1.5" />
                                            </td>

                                            {/* CELEBRANT */}
                                            <td className="px-3.5 lg:px-5 py-3.5 whitespace-nowrap">
                                                {appointment.priest ? (
                                                    <span className="text-xs sm:text-sm font-medium text-foreground truncate block max-w-[170px]">
                                                        {formatCelebrantDisplay(appointment.priest)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-secondary-400 font-normal italic">
                                                        Not assigned
                                                    </span>
                                                )}
                                                <RequestedPriestNote appointment={appointment} className="mt-1" />
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-3.5 lg:px-5 py-3.5 whitespace-nowrap">
                                                {appointment.status === 'approved' ? (
                                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                        Approved
                                                    </span>
                                                ) : appointment.status === 'pending' ? (
                                                    <div className="space-y-1">
                                                        <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                            Pending
                                                        </span>
                                                        {isFuneral && (
                                                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full block w-fit">
                                                                Urgent
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : appointment.status === 'rejected' ? (
                                                    <span className="bg-red-50 text-red-700 border border-red-200/80 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                        Rejected
                                                    </span>
                                                ) : appointment.status === 'cancelled' ? (
                                                    <div className="space-y-1 whitespace-normal max-w-[220px]">
                                                        <span className="bg-red-50 text-red-700 border border-red-200/80 text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                            Cancelled
                                                        </span>
                                                        {appointment.cancellation_reason && (
                                                            <p className="text-xs text-secondary-600 leading-snug">
                                                                Reason: {appointment.cancellation_reason}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="bg-secondary-100 text-secondary-700 border border-secondary-200 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize">
                                                        {appointment.status === 'completed' ? 'Celebrated' : appointment.status}
                                                    </span>
                                                )}
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-3.5 lg:px-5 py-3.5 whitespace-nowrap text-right pr-4 lg:pr-6">
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    {canEditAppointments && appointment.status === 'pending' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setApprovingAppointment(appointment)}
                                                                className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openConfirmModal(
                                                                        appointment.id,
                                                                        'rejected',
                                                                        appointment.service_type
                                                                    )
                                                                }
                                                                className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    ) : canManageAppointments && (appointment.status === 'approved' || (canEditAppointments && (appointment.status === 'cancelled' || appointment.status === 'completed'))) ? (
                                                        <>
                                                            {canEditAppointments && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingAppointment(appointment)}
                                                                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewingDocumentsFor(appointment.id)}
                                                                className="px-3 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                                            >
                                                                <FileText className="w-3.5 h-3.5 text-secondary-500" />
                                                                <span>Documents</span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingDocumentsFor(appointment.id)}
                                                            className="px-3 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-secondary-500" />
                                                            <span>Documents</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {totalCount > 0 && (
                    <div className="px-4 lg:px-6 py-3.5 border-t border-border/80 bg-white">
                        <Pagination
                            variant="flat"
                            currentPage={currentPage}
                            totalItems={totalCount}
                            pageSize={pageSize}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setCurrentPage(1);
                            }}
                            pageSizeOptions={[5, 10, 25, 50]}
                            itemName="appointments"
                        />
                    </div>
                )}
            </div>

            {/* Mobile View: Clean Appointment Cards */}
            <div className="block md:hidden space-y-3">
                {appointments.length === 0 ? (
                    <div className="bg-white border border-border/80 rounded-2xl p-8 text-center text-secondary-500 shadow-xs">
                        <Calendar className="w-10 h-10 mx-auto mb-2.5 text-secondary-300" />
                        <p className="font-semibold text-sm text-foreground">
                            {canManageAppointments
                                ? 'No appointment requests found'
                                : 'You have no appointment requests'}
                        </p>
                        <p className="text-xs text-secondary-400 mt-1">
                            Try adjusting your filters or selecting a different date.
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors shadow-2xs cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {appointments.map((appointment) => {
                            const isFuneral = isFuneralService(appointment.service_kind, appointment.service_type);
                            const candidate = getCandidateDisplay(appointment);

                            return (
                                <div
                                    key={appointment.id}
                                    className="bg-white border border-border/80 rounded-2xl p-4 shadow-xs space-y-3"
                                >
                                    {/* Top row: Sacrament icon + Sacrament name + Parish, and Status badge */}
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-primary flex items-center justify-center shrink-0">
                                                <Cross className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-sm text-foreground capitalize truncate">
                                                    {formatSacramentTitle(appointment.service_type)}
                                                </h3>
                                                <p className="text-xs text-secondary-500 truncate mt-0.5">
                                                    {appointment.church?.name || 'Parish'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status badge */}
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                            {appointment.status === 'approved' ? (
                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center">
                                                    Approved
                                                </span>
                                            ) : appointment.status === 'pending' ? (
                                                <>
                                                    <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center">
                                                        Pending
                                                    </span>
                                                    {isFuneral && (
                                                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                            Urgent
                                                        </span>
                                                    )}
                                                </>
                                            ) : appointment.status === 'rejected' ? (
                                                <span className="bg-red-50 text-red-700 border border-red-200/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center">
                                                    Rejected
                                                </span>
                                            ) : appointment.status === 'cancelled' ? (
                                                <>
                                                    <span className="bg-red-50 text-red-700 border border-red-200/80 text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center">
                                                        Cancelled
                                                    </span>
                                                    {appointment.cancellation_reason && (
                                                        <p className="text-[11px] text-secondary-600 leading-snug text-right max-w-[180px]">
                                                            Reason: {appointment.cancellation_reason}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="bg-secondary-100 text-secondary-700 border border-secondary-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                                                    {appointment.status === 'completed' ? 'Celebrated' : appointment.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle row: Candidate / Requester, Date & Time, Celebrant */}
                                    <div className="pt-2 border-t border-border/50 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-secondary-500">Requested for:</span>
                                            <div className="font-semibold text-foreground truncate text-right flex items-center gap-1.5">
                                                <span title={candidate}>{candidate}</span>
                                                <span className="text-secondary-300">·</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingDocumentsFor(appointment.id)}
                                                    className="text-primary hover:underline font-semibold cursor-pointer text-xs"
                                                >
                                                    docs
                                                </button>
                                            </div>
                                        </div>

                                        {appointment.profile?.full_name && (
                                            <div className="flex items-center justify-between gap-2 text-secondary-500">
                                                <span>Requested by:</span>
                                                <span className="text-secondary-700 truncate font-medium">
                                                    {appointment.profile.full_name}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 text-secondary-500">
                                            <span className="flex items-center gap-1.5 text-secondary-600">
                                                <Calendar className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                                                <span>Date & Time:</span>
                                            </span>
                                            <span className="font-medium text-foreground text-right flex flex-col items-end gap-1">
                                                <span>
                                                    {formatDateDisplay(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}
                                                </span>
                                                <RescheduledNotice appointment={appointment} />
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 text-secondary-500">
                                            <span className="flex items-center gap-1.5 text-secondary-600">
                                                <Cross className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                                                <span>Celebrant:</span>
                                            </span>
                                            <span className="font-medium text-foreground text-right truncate max-w-[180px]">
                                                {appointment.priest ? (
                                                    formatCelebrantDisplay(appointment.priest)
                                                ) : (
                                                    <span className="text-secondary-400 italic">Not assigned</span>
                                                )}
                                            </span>
                                        </div>

                                        {appointment.requested_priest_id && (
                                            <div className="flex justify-end">
                                                <RequestedPriestNote appointment={appointment} />
                                            </div>
                                        )}

                                        {appointment.notes && candidate !== appointment.notes && (
                                            <div className="text-[11px] text-secondary-400 italic bg-secondary-50/70 p-2 rounded-lg border border-border/40 mt-1">
                                                &ldquo;{appointment.notes}&rdquo;
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom action buttons row */}
                                    <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                                        {canEditAppointments && appointment.status === 'pending' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setApprovingAppointment(appointment)}
                                                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer text-center"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openConfirmModal(
                                                            appointment.id,
                                                            'rejected',
                                                            appointment.service_type
                                                        )
                                                    }
                                                    className="flex-1 py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs shadow-2xs transition-colors cursor-pointer text-center"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        ) : canManageAppointments && (appointment.status === 'approved' || (canEditAppointments && (appointment.status === 'cancelled' || appointment.status === 'completed'))) ? (
                                            <div className="flex items-center gap-2 w-full">
                                                {canEditAppointments && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingAppointment(appointment)}
                                                        className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer text-center"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingDocumentsFor(appointment.id)}
                                                    className="flex-1 py-2 px-3 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                                >
                                                    <FileText className="w-3.5 h-3.5 text-secondary-500" />
                                                    <span>Documents</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setViewingDocumentsFor(appointment.id)}
                                                className="w-full py-2 px-3 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-secondary-500" />
                                                <span>Documents</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Mobile Pagination */}
                        {totalCount > 0 && (
                            <div className="bg-white border border-border/80 rounded-2xl p-4 shadow-xs">
                                <Pagination
                                    variant="flat"
                                    currentPage={currentPage}
                                    totalItems={totalCount}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={(newSize) => {
                                        setPageSize(newSize);
                                        setCurrentPage(1);
                                    }}
                                    pageSizeOptions={[5, 10, 25, 50]}
                                    itemName="appointments"
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Document Viewer Modal */}
            {viewingDocumentsFor && (
                <DocumentViewerModal
                    appointmentId={viewingDocumentsFor}
                    isOpen={true}
                    onClose={() => setViewingDocumentsFor(null)}
                />
            )}

            {/* Approve Appointment Modal with Celebrant Picker & Feedback */}
            <ApproveAppointmentModal
                isOpen={approvingAppointment?.status === 'pending'}
                onClose={() => {
                    if (!isApproving) setApprovingAppointment(null);
                }}
                appointment={approvingAppointment}
                onConfirm={handleApproveConfirm}
                isSubmitting={isApproving}
            />

            {/* Edit Appointment Modal (assign or change celebrant, cancel and future edit actions) */}
            <EditAppointmentModal
                isOpen={!!editingAppointment}
                onClose={() => setEditingAppointment(null)}
                appointment={editingAppointment}
                onSaved={async () => {
                    await fetchAppointments();
                    void fetchMetaCounts();
                }}
            />

            {/* Approve / Reject Confirmation Modal */}
            <Modal
                isOpen={!!confirmModal?.open}
                onClose={closeConfirmModal}
                size="md"
                footer={
                    <div className="flex gap-3 w-full">
                        <button
                            type="button"
                            onClick={closeConfirmModal}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors shadow-sm cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm cursor-pointer ${
                                confirmModal?.newStatus === 'approved'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {confirmModal?.newStatus === 'approved' ? 'Yes, Approve' : 'Yes, Reject'}
                        </button>
                    </div>
                }
            >
                {confirmModal && (
                    <div className="text-center py-2">
                        {/* Icon */}
                        <div
                            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                                confirmModal.newStatus === 'approved' ? 'bg-green-100' : 'bg-red-100'
                            }`}
                        >
                            {confirmModal.newStatus === 'approved' ? (
                                <CheckCircle className="w-7 h-7 text-green-600" />
                            ) : (
                                <XCircle className="w-7 h-7 text-red-600" />
                            )}
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            {confirmModal.newStatus === 'approved'
                                ? 'Approve Appointment?'
                                : 'Reject Appointment?'}
                        </h3>

                        {/* Body */}
                        <p className="text-sm text-muted leading-relaxed">
                            Are you sure you want to{' '}
                            <span
                                className={`font-semibold ${
                                    confirmModal.newStatus === 'approved'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                }`}
                            >
                                {confirmModal.newStatus}
                            </span>{' '}
                            the{' '}
                            <span className="font-semibold text-foreground">
                                {formatSacramentTitle(confirmModal.serviceType)}
                            </span>{' '}
                            appointment?
                            {confirmModal.newStatus === 'rejected' && (
                                <span className="block mt-1.5 text-red-500 text-xs">
                                    This action will notify the parishioner.
                                </span>
                            )}
                        </p>
                    </div>
                )}
            </Modal>

            {/* Export toast placeholder notification */}
            {showExportNotice && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg border border-border/20 text-xs sm:text-sm font-medium animate-in fade-in duration-200"
                >
                    <Download className="w-4 h-4 text-primary-200 shrink-0" />
                    <span>Export functionality will be enabled soon</span>
                    <button
                        type="button"
                        onClick={() => setShowExportNotice(false)}
                        className="ml-2 text-background/60 hover:text-background transition-colors cursor-pointer"
                        aria-label="Close notification"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

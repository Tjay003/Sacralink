import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, User, Building2, FileText, Search, X, ChevronDown } from 'lucide-react';
import {
    getAppointments,
    updateAppointmentStatus,
    subscribeToAppointments,
    formatAppointmentTime as formatTime,
    type HydratedAppointment as Appointment,
    type AppointmentStatus,
} from '../../lib/supabase/appointments';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import DocumentViewerModal from '../../components/documents/DocumentViewerModal';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/common/Pagination';

export default function AppointmentsPage() {
    const { profile } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterSacrament, setFilterSacrament] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewingDocumentsFor, setViewingDocumentsFor] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Church filter — admin/super_admin only
    const isAdminRole = profile?.role === 'super_admin' || profile?.role === 'admin';
    const isChurchStaff = profile?.role === 'church_admin' || profile?.role === 'volunteer';
    const { churches } = useChurches();
    const [selectedChurchId, setSelectedChurchId] = useState<string>('all');

    // Effective church for display badge and scoping
    const effectiveChurchId = isChurchStaff
        ? (profile?.assigned_church_id || null)
        : selectedChurchId === 'all' ? null : selectedChurchId;

    const activeChurchName = isChurchStaff
        ? churches.find(c => c.id === profile?.assigned_church_id)?.name || 'Your Church'
        : selectedChurchId === 'all'
            ? 'All Churches'
            : churches.find(c => c.id === selectedChurchId)?.name || 'Unknown';

    // Confirmation modal state
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

    const canManageAppointments = profile?.role === 'admin'
        || profile?.role === 'super_admin'
        || profile?.role === 'church_admin'
        || profile?.role === 'volunteer';

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
        const unsubscribe = subscribeToAppointments(
            effectiveChurchId ? { churchId: effectiveChurchId } : undefined,
            () => {
                void fetchAppointments();
            }
        );
        return () => {
            unsubscribe();
        };
    }, [fetchAppointments, effectiveChurchId]);

    const handleStatusUpdate = async (id: string, newStatus: AppointmentStatus) => {
        try {
            const appointment = appointments.find(app => app.id === id);
            if (!appointment) return;

            const { success, error: updateErr } = await updateAppointmentStatus(id, newStatus, {
                serviceType: appointment.service_type,
                userId: appointment.user_id,
            });

            if (!success || updateErr) throw updateErr;

            // Optimistic local state update
            setAppointments(prev => prev.map(app =>
                app.id === id ? { ...app, status: newStatus } : app
            ));
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status');
        }
    };

    const resetToPage1 = () => setCurrentPage(1);

    const activeFilterCount = [
        filterStatus !== 'all',
        filterSacrament !== 'all',
        filterDateFrom !== '',
        filterDateTo !== '',
        searchQuery !== '',
        isAdminRole && selectedChurchId !== 'all',
    ].filter(Boolean).length;

    const clearAllFilters = () => {
        setFilterStatus('all');
        setFilterSacrament('all');
        setFilterDateFrom('');
        setFilterDateTo('');
        setSearchQuery('');
        if (isAdminRole) setSelectedChurchId('all');
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{canManageAppointments ? 'Manage Appointments' : 'My Appointments'}</h1>
                    <p className="text-muted">{canManageAppointments ? 'Manage sacramental requests' : 'View status of your requests'}</p>
                </div>
                <div className="text-sm text-muted">
                    Total: <span className="font-semibold text-foreground">{totalCount}</span>
                </div>
            </div>

            {/* Church Selector — super_admin & admin only */}
            {isAdminRole && (
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted font-medium mb-1">Viewing Appointments For</p>
                            <div className="relative">
                                <select
                                    value={selectedChurchId}
                                    onChange={(e) => { setSelectedChurchId(e.target.value); resetToPage1(); }}
                                    className="w-full appearance-none bg-muted/10 border border-border rounded-lg px-3 pr-8 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                >
                                    <option value="all">🌐 All Churches</option>
                                    {churches.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Church Staff badge */}
            {isChurchStaff && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg w-fit">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{activeChurchName}</span>
                    <span className="text-xs text-muted">— Your assigned church</span>
                </div>
            )}

            <div className="card p-4">
                {/* Row 1: Search + Status + Sacrament Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Search by name — admins only */}
                    {canManageAppointments && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Search Parishioner</label>
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); resetToPage1(); }}
                                    className="input w-full !pl-10"
                                />
                            </div>
                        </div>
                    )}

                    {/* Status filter */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); resetToPage1(); }}
                            className="input w-full"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="rescheduled">Rescheduled</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Sacrament type filter */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Sacrament Type</label>
                        <select
                            value={filterSacrament}
                            onChange={(e) => { setFilterSacrament(e.target.value); resetToPage1(); }}
                            className="input w-full"
                        >
                            <option value="all">All Types</option>
                            <option value="baptism">Baptism</option>
                            <option value="wedding">Wedding</option>
                            <option value="funeral">Funeral</option>
                            <option value="confirmation">Confirmation</option>
                            <option value="counseling">Counseling</option>
                            <option value="mass_intention">Mass Intention</option>
                            <option value="confession">Confession</option>
                            <option value="anointing">Anointing</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Date Range — each date gets its own full column */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Date From</label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => { setFilterDateFrom(e.target.value); resetToPage1(); }}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Date To</label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => { setFilterDateTo(e.target.value); resetToPage1(); }}
                            className="input w-full"
                        />
                    </div>
                </div>

                {/* Active filter summary + clear */}
                {activeFilterCount > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                        <span className="text-sm text-muted">
                            <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-white text-xs rounded-full mr-1">{activeFilterCount}</span>
                            filter{activeFilterCount > 1 ? 's' : ''} active &mdash; showing {appointments.length} of {totalCount} appointments
                        </span>
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {appointments.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 rounded-lg text-gray-500">
                        {canManageAppointments ? 'No appointments found.' : 'You have no appointment requests.'}
                    </div>
                ) : (
                    appointments.map((appointment) => (
                        <div key={appointment.id} className="card p-4 flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                                        ${appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            appointment.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'}`}>
                                        {appointment.status}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        Requested on {new Date(appointment.created_at || new Date().toISOString()).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-lg">{appointment.service_type}</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{appointment.church?.name || 'Unknown Church'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{appointment.profile?.full_name || 'Unknown User'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 shrink-0" />
                                        {appointment.appointment_date}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        {formatTime(appointment.appointment_time)}
                                    </div>
                                </div>

                                {appointment.notes && (
                                    <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                                        <strong>Notes:</strong> {appointment.notes}
                                    </div>
                                )}
                            </div>

                            {/* Right-side Actions Panel */}
                            <div className="flex flex-row md:flex-col items-center justify-start md:justify-center gap-2 md:min-w-[140px] shrink-0">
                                {/* Approve / Reject — only for managers on pending */}
                                {canManageAppointments && appointment.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => openConfirmModal(appointment.id, 'approved', appointment.service_type)}
                                            className="btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm w-full"
                                        >
                                            <CheckCircle className="w-4 h-4 shrink-0" />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => openConfirmModal(appointment.id, 'rejected', appointment.service_type)}
                                            className="btn-secondary text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm w-full"
                                        >
                                            <XCircle className="w-4 h-4 shrink-0" />
                                            Reject
                                        </button>
                                    </>
                                )}

                                {/* Docs button — always visible to managers */}
                                {canManageAppointments && (
                                    <button
                                        onClick={() => setViewingDocumentsFor(appointment.id)}
                                        className="btn-secondary flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm w-full"
                                    >
                                        <FileText className="w-4 h-4 shrink-0" />
                                        Docs
                                    </button>
                                )}

                                {/* Status label for resolved appointments */}
                                {appointment.status !== 'pending' && (
                                    <span className={`text-sm font-medium italic ${
                                        appointment.status === 'approved' ? 'text-green-600' : 'text-red-500'
                                    }`}>
                                        {appointment.status === 'approved' ? 'Approved' : 'Rejected'}
                                    </span>
                                )}

                                {/* Awaiting label for regular users */}
                                {!canManageAppointments && appointment.status === 'pending' && (
                                    <span className="text-sm text-yellow-600 font-medium italic">Awaiting Review</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalCount > 0 && (
                <Pagination
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
            )}

            {/* Document Viewer Modal */}
            {viewingDocumentsFor && (
                <DocumentViewerModal
                    appointmentId={viewingDocumentsFor}
                    isOpen={true}
                    onClose={() => setViewingDocumentsFor(null)}
                />
            )}

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
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm ${
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
                        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                            confirmModal.newStatus === 'approved' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                            {confirmModal.newStatus === 'approved'
                                ? <CheckCircle className="w-7 h-7 text-green-600" />
                                : <XCircle className="w-7 h-7 text-red-600" />
                            }
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            {confirmModal.newStatus === 'approved' ? 'Approve Appointment?' : 'Reject Appointment?'}
                        </h3>

                        {/* Body */}
                        <p className="text-sm text-muted leading-relaxed">
                            Are you sure you want to{' '}
                            <span className={`font-semibold ${
                                confirmModal.newStatus === 'approved' ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {confirmModal.newStatus}
                            </span>{' '}
                            the <span className="font-semibold text-foreground">{confirmModal.serviceType}</span> appointment?
                            {confirmModal.newStatus === 'rejected' && (
                                <span className="block mt-1.5 text-red-500 text-xs">This action will notify the parishioner.</span>
                            )}
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
}

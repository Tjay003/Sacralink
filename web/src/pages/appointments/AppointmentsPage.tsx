import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, User, Building2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { notifyUserOfStatusChange } from '../../lib/supabase/notifications';
import { useAuth } from '../../contexts/AuthContext';
import DocumentViewerModal from '../../components/documents/DocumentViewerModal';

import type { Appointment as BaseAppointment } from '../../types/database';

interface Appointment extends BaseAppointment {
    church: {
        name: string;
    } | null;
    profile: {
        full_name: string | null;
    } | null;
}

/** Converts a raw HH:MM:SS / HH:MM string to 12‑hour AM/PM format */
const formatTime = (time: string | null | undefined): string => {
    if (!time) return '—';
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || '00';
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
};

export default function AppointmentsPage() {
    const { profile } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewingDocumentsFor, setViewingDocumentsFor] = useState<string | null>(null);

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

    const fetchAppointments = async () => {
        try {
            setLoading(true);

            // Note: RLS policies handle the filtering.
            // Admins see all. Users see their own.

            const { data, error } = await (supabase
                .from('appointments')
                .select(`
                    *,
                    church:churches(name),
                    profile:profiles(full_name)
                `)
                // Explicitly cast the query builder to any to avoid TypeScript inference issues with join
                .order('created_at', { ascending: false }) as any);

            if (error) throw error;

            console.log('Appointments data:', data);
            setAppointments(data || []);
        } catch (err: any) {
            console.error('Error fetching appointments:', err);
            setError('Failed to load appointments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            // Find the appointment to get user info
            const appointment = appointments.find(app => app.id === id);
            if (!appointment) return;

            const { error } = await (supabase
                .from('appointments') as any)
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Send notification to user
            await notifyUserOfStatusChange(
                appointment.user_id,
                appointment.service_type,
                newStatus as 'approved' | 'rejected',
                id
            );

            // Optimistic update
            setAppointments(prev => prev.map(app =>
                app.id === id ? { ...app, status: newStatus as any } : app
            ));
        } catch (err: any) {
            console.error('Error updating status:', err);
            alert('Failed to update status');
        }
    };

    const filteredAppointments = filterStatus === 'all'
        ? appointments
        : appointments.filter(app => app.status === filterStatus);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">{canManageAppointments ? 'Manage Appointments' : 'My Appointments'}</h1>
                    <p className="text-gray-500">{canManageAppointments ? 'Manage sacramental requests' : 'View status of your requests'}</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="input-field w-auto"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {filteredAppointments.length === 0 ? (
                    <div className="text-center p-8 bg-gray-50 rounded-lg text-gray-500">
                        {canManageAppointments ? 'No appointments found.' : 'You have no appointment requests.'}
                    </div>
                ) : (
                    filteredAppointments.map((appointment) => (
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

            {/* Document Viewer Modal */}
            {viewingDocumentsFor && (
                <DocumentViewerModal
                    appointmentId={viewingDocumentsFor}
                    isOpen={true}
                    onClose={() => setViewingDocumentsFor(null)}
                />
            )}

            {/* Approve / Reject Confirmation Modal */}
            {confirmModal?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
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
                        <h3 className="text-lg font-semibold text-center text-foreground mb-1">
                            {confirmModal.newStatus === 'approved' ? 'Approve Appointment?' : 'Reject Appointment?'}
                        </h3>

                        {/* Body */}
                        <p className="text-sm text-center text-gray-500 mb-6">
                            Are you sure you want to{' '}
                            <span className={`font-semibold ${
                                confirmModal.newStatus === 'approved' ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {confirmModal.newStatus}
                            </span>{' '}
                            the <span className="font-semibold text-foreground">{confirmModal.serviceType}</span> appointment?
                            {confirmModal.newStatus === 'rejected' && (
                                <span className="block mt-1 text-red-500">This action will notify the parishioner.</span>
                            )}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={closeConfirmModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                                    confirmModal.newStatus === 'approved'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {confirmModal.newStatus === 'approved' ? 'Yes, Approve' : 'Yes, Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

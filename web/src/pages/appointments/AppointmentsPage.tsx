import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, User, Building2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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

export default function AppointmentsPage() {
    const { profile } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewingDocumentsFor, setViewingDocumentsFor] = useState<string | null>(null);

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
            const { error } = await (supabase
                .from('appointments') as any)
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

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
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                                        ${appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            appointment.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'}`}>
                                        {appointment.status}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        Requested on {new Date(appointment.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-lg">{appointment.service_type}</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4" />
                                        {appointment.church?.name || 'Unknown Church'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        {appointment.profile?.full_name || 'Unknown User'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {appointment.appointment_date}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {appointment.appointment_time}
                                    </div>
                                </div>

                                {appointment.notes && (
                                    <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                                        <strong>Notes:</strong> {appointment.notes}
                                    </div>
                                )}
                            </div>

                            {/* Actions - Visible only to Managers */}
                            {canManageAppointments && (
                                <div className="flex items-center gap-2 md:flex-col md:justify-center">
                                    {appointment.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusUpdate(appointment.id, 'approved')}
                                                className="btn-primary bg-green-600 hover:bg-green-700 w-full md:w-32 justify-center"
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(appointment.id, 'rejected')}
                                                className="btn-secondary text-red-600 hover:bg-red-50 w-full md:w-32 justify-center"
                                            >
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setViewingDocumentsFor(appointment.id)}
                                        className="btn-secondary w-full md:w-32 justify-center"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Docs
                                    </button>
                                </div>
                            )}

                            {/* Read-Only Status for Users OR Non-Pending items */}
                            {(!canManageAppointments || appointment.status !== 'pending') && (
                                <div className="flex items-center md:flex-col md:justify-center min-w-[128px]">
                                    <p className="text-sm text-gray-400 italic font-medium">
                                        {appointment.status === 'pending' ? 'Awaiting Review' :
                                            appointment.status === 'approved' ? 'Approved' : 'Rejected'}
                                    </p>
                                </div>
                            )}
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
        </div>
    );
}

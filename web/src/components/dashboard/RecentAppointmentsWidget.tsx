import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface Appointment {
    id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    profiles: {
        full_name: string;
    };
}

interface RecentAppointmentsWidgetProps {
    churchId: string | null;
    limit?: number;
}

/**
 * RecentAppointmentsWidget - Shows latest appointments for the church
 * 
 * Features:
 * - Lists recent appointments (church-filtered)
 * - Shows user name, service type, status
 * - Links to appointments page
 */
export default function RecentAppointmentsWidget({ churchId, limit = 5 }: RecentAppointmentsWidgetProps) {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (churchId) {
            fetchAppointments();
        }
    }, [churchId, limit]);

    const fetchAppointments = async () => {
        if (!churchId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    service_type,
                    appointment_date,
                    appointment_time,
                    status,
                    profiles:user_id (
                        full_name
                    )
                `)
                .eq('church_id', churchId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            setAppointments((data || []) as any);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!churchId) {
        return null;
    }

    return (
        <div className="bg-card border rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Recent Appointments</h3>
                        <p className="text-sm text-muted-foreground">Latest requests</p>
                    </div>
                </div>

                {appointments.length > 0 && (
                    <button
                        onClick={() => navigate('/appointments')}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        View All
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Appointments List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
                            <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No appointments yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {appointments.map((appointment) => (
                        <div
                            key={appointment.id}
                            className="p-4 bg-background border rounded-lg hover:bg-muted transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-foreground">
                                            {appointment.profiles?.full_name || 'Unknown User'}
                                        </span>
                                    </div>
                                    <h4 className="font-medium text-foreground mb-1">
                                        {appointment.service_type}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {appointment.appointment_time}
                                        </div>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${appointment.status === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : appointment.status === 'pending'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                    {appointment.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

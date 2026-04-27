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

    // Format time to 12h AM/PM
    const formatTime = (time: string) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    // Status config: colors and left-border accent
    const statusConfig: Record<string, { badge: string; border: string }> = {
        approved:   { badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-400' },
        pending:    { badge: 'bg-amber-100  text-amber-700',    border: 'border-l-amber-400'   },
        rejected:   { badge: 'bg-red-100    text-red-700',      border: 'border-l-red-400'     },
        completed:  { badge: 'bg-blue-100   text-blue-700',     border: 'border-l-blue-400'    },
        cancelled:  { badge: 'bg-gray-100   text-gray-600',     border: 'border-l-gray-300'    },
    };

    const getStatus = (status: string) =>
        statusConfig[status] ?? { badge: 'bg-gray-100 text-gray-600', border: 'border-l-gray-300' };

    if (!churchId) return null;

    return (
        <div className="bg-card border rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Recent Appointments</h3>
                        <p className="text-sm text-gray-500">Latest requests</p>
                    </div>
                </div>

                {appointments.length > 0 && (
                    <button
                        onClick={() => navigate('/appointments')}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
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
                        <div key={i} className="p-4 bg-gray-50 rounded-xl animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-10">
                    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-7 h-7 text-blue-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">No appointments yet</p>
                    <p className="text-xs mt-1 text-gray-400">Appointments will appear here once booked</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {appointments.map((appointment) => {
                        const { badge, border } = getStatus(appointment.status);
                        return (
                            <div
                                key={appointment.id}
                                className={`flex items-center justify-between gap-3 p-4 bg-white border border-l-4 ${border} border-gray-100 rounded-xl hover:shadow-sm transition-all duration-200`}
                            >
                                <div className="flex-1 min-w-0">
                                    {/* Name row */}
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <span className="text-xs text-gray-500 truncate">
                                            {appointment.profiles?.full_name || 'Unknown User'}
                                        </span>
                                    </div>
                                    {/* Service type */}
                                    <h4 className="font-semibold text-gray-800 text-sm mb-1 capitalize">
                                        {appointment.service_type.replace(/_/g, ' ')}
                                    </h4>
                                    {/* Date & time */}
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(appointment.appointment_date), 'MMM dd, yyyy')}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(appointment.appointment_time)}
                                        </div>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${badge}`}>
                                    {appointment.status}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import {
    getAppointments,
    subscribeToAppointments,
    formatAppointmentTime,
    type HydratedAppointment as Appointment,
} from '../../lib/supabase/appointments';
import { UserName } from '../ui/UserName';

interface RecentAppointmentsWidgetProps {
    churchId?: string | null;
    limit?: number;
    title?: string;
    subtitle?: string;
    className?: string;
}

/**
 * RecentAppointmentsWidget - Shows latest appointments for a church or all churches
 */
export default function RecentAppointmentsWidget({
    churchId = null,
    limit = 5,
    title = 'Recent sacrament requests',
    subtitle = 'The latest five bookings',
    className,
}: RecentAppointmentsWidgetProps) {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const { data, error } = await getAppointments({
                ...(churchId ? { churchId } : {}),
                limit,
                orderBy: 'created_at',
                ascending: false,
            });

            if (error) throw error;
            setAppointments(data || []);
        } catch (err) {
            console.error('Error fetching recent appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
        const unsubscribe = subscribeToAppointments(churchId ? { churchId } : {}, () => {
            fetchAppointments();
        });
        return () => {
            unsubscribe();
        };
    }, [churchId, limit]);

    // Status config: clean pills matching Sacralink theme
    const statusConfig: Record<string, { badge: string }> = {
        approved:   { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
        pending:    { badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
        rejected:   { badge: 'bg-red-50 text-red-700 border border-red-200' },
        completed:  { badge: 'bg-blue-50 text-primary border border-blue-200' },
        cancelled:  { badge: 'bg-secondary-50 text-secondary-600 border border-border' },
    };

    const getStatus = (status: string) =>
        statusConfig[status] ?? { badge: 'bg-secondary-50 text-secondary-600 border border-border' };

    // Format service type into clean human label
    const formatServiceName = (type: string) => {
        const clean = type.toLowerCase().replace(/_/g, ' ');
        if (clean.includes('mass') || clean.includes('intention')) return 'Mass intention';
        if (clean.includes('baptism')) return 'Baptism';
        if (clean.includes('wedding') || clean.includes('marriage')) return 'Wedding';
        if (clean.includes('funeral') || clean.includes('burial')) return 'Funeral';
        if (clean.includes('blessing')) return 'Blessing';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div className={cn("bg-white border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between", className)}>
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/60">
                    <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
                        <p className="text-xs text-secondary-500 font-medium">{subtitle}</p>
                    </div>

                    <button
                        onClick={() => navigate('/appointments')}
                        className="text-xs text-primary hover:text-primary/80 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <span>View all</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Appointments List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-4 bg-secondary-50/60 rounded-xl animate-pulse">
                                <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-secondary-200 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-10 my-auto">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2.5">
                            <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">No sacrament requests yet</p>
                        <p className="text-xs text-secondary-500 mt-0.5">Bookings will appear here as parishioners schedule them.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {appointments.map((appointment) => {
                            const { badge } = getStatus(appointment.status);
                            const applicantName = appointment.profile?.full_name || 'Parishioner';
                            const appointmentDate = new Date(appointment.appointment_date);
                            const formattedDate = !isNaN(appointmentDate.getTime())
                                ? format(appointmentDate, 'MMM d')
                                : 'Date TBA';

                            return (
                                <div
                                    key={appointment.id}
                                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-secondary-50/40 rounded-xl px-2 transition-colors cursor-pointer"
                                    onClick={() => navigate('/appointments')}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center flex-shrink-0 border border-blue-100">
                                            <Plus className="w-4 h-4 stroke-[2.5]" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">
                                                <UserName name={applicantName} deletedAt={appointment.profile?.deleted_at} />
                                            </p>
                                            <p className="text-xs text-secondary-500 font-medium truncate mt-0.5">
                                                {formattedDate} · {formatAppointmentTime(appointment.appointment_time)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-700">
                                            {formatServiceName(appointment.service_type)}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${badge}`}>
                                            {appointment.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Count indicator matching activity widget */}
            {!loading && appointments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/60 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/appointments')}
                        className="text-xs font-medium text-secondary-500 hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                        Showing {appointments.length} latest requests &bull; View all
                    </button>
                </div>
            )}
        </div>
    );
}

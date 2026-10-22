import { useNavigate } from 'react-router-dom';
import { Calendar, Church, AlertCircle, CheckCircle2, AlertTriangle, Eye, MessageSquare, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { HydratedAppointment as Appointment } from '../../../lib/supabase/appointments';
import RescheduledNotice from '../../appointments/RescheduledNotice';
import RequestedPriestNote from '../../appointments/RequestedPriestNote';

interface UserNextAppointmentCardProps {
    appointment: Appointment | null;
    onMessageOffice: (churchId: string, churchName?: string | null) => void;
}

export default function UserNextAppointmentCard({
    appointment,
    onMessageOffice,
}: UserNextAppointmentCardProps) {
    const navigate = useNavigate();

    if (!appointment) {
        return (
            <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-xs text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-serif font-bold text-foreground">
                    No upcoming appointments
                </h3>
                <p className="text-sm text-muted mt-1 max-w-md mx-auto leading-relaxed">
                    Need to schedule a baptism, wedding, mass intention, or home blessing? You can request a sacrament anytime.
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/appointments')}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                >
                    <Plus className="w-4 h-4" />
                    Book a sacrament
                </button>
            </div>
        );
    }

    // Determine status badge
    const isPending = appointment.status === 'pending';
    const isApproved = appointment.status === 'approved';
    const isCancelled = appointment.status === 'cancelled';
    const isRescheduled = Boolean(appointment.rescheduled_from_date);

    // Formatted date string
    let formattedDate = appointment.appointment_date;
    try {
        formattedDate = format(new Date(appointment.appointment_date), 'EEE, MMM d, yyyy');
    } catch {
        formattedDate = appointment.appointment_date;
    }

    return (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
            {/* Card Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
                        <Calendar className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <span className="font-semibold text-base text-foreground">
                        Your next appointment
                    </span>
                </div>

                {/* Status Badge */}
                {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Under review
                    </span>
                )}
                {isApproved && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Confirmed
                    </span>
                )}
                {isCancelled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        Cancelled
                    </span>
                )}
                {!isPending && !isApproved && !isCancelled && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-800 border border-secondary-200 capitalize">
                        {appointment.status}
                    </span>
                )}
            </div>

            {/* Appointment Title */}
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mt-4">
                {appointment.service_type}
                {appointment.notes ? ` · ${appointment.notes}` : ''}
            </h2>

            {/* Date, Time & Church Meta */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm text-secondary-600 mt-2">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-secondary-500" />
                    <span>{formattedDate} · {appointment.appointment_time}</span>
                </div>
                {appointment.church?.name && (
                    <div className="flex items-center gap-1.5">
                        <Church className="w-4 h-4 text-secondary-500" />
                        <span>{appointment.church.name}</span>
                    </div>
                )}
            </div>
            <RescheduledNotice appointment={appointment} className="mt-2" />
            <RequestedPriestNote appointment={appointment} className="mt-2" />

            {/* State A Callout / Status Box */}
            <div className="rounded-xl p-4 bg-amber-50/70 border border-amber-200/80 mt-4 space-y-1.5">
                <div className="flex items-start gap-2.5">
                    {isCancelled ? (
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    ) : isApproved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 text-sm">
                        <p className="font-semibold text-amber-950">
                            {isCancelled
                                ? 'Appointment cancelled'
                                : isApproved
                                ? 'Liturgical details confirmed'
                                : isRescheduled
                                ? 'Rescheduled by parish office'
                                : 'Under parish office review'}
                        </p>
                        <p className="text-amber-900/90 text-xs sm:text-sm mt-0.5 leading-relaxed">
                            {isCancelled
                                ? `Reason: ${appointment.cancellation_reason || 'Please contact the parish office for details.'}`
                                : isApproved
                                ? `All requirements verified. Please arrive 15 minutes before the liturgy${appointment.church?.name ? ` at ${appointment.church.name}` : ''}.`
                                : isRescheduled
                                ? `New proposed schedule: ${formattedDate} at ${appointment.appointment_time}.${appointment.reschedule_reason ? ` (${appointment.reschedule_reason})` : ''}`
                                : 'Your appointment request and documents have been submitted. Parish staff are verifying your requirements.'}
                        </p>
                        {appointment.admin_feedback && (
                            <p className="text-xs font-medium text-amber-950 mt-1 pt-1 border-t border-amber-200/60">
                                Note from parish office: {appointment.admin_feedback}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-border">
                <button
                    type="button"
                    onClick={() => navigate('/appointments')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-foreground hover:bg-secondary-50 text-sm font-medium transition-colors"
                >
                    <Eye className="w-4 h-4 text-secondary-500" />
                    View details
                </button>

                {appointment.church_id && (
                    <button
                        type="button"
                        onClick={() => onMessageOffice(appointment.church_id, appointment.church?.name)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-foreground hover:bg-secondary-50 text-sm font-medium transition-colors"
                    >
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Message the parish office
                    </button>
                )}
            </div>
        </div>
    );
}

import { Calendar, Church, Clock, CheckCircle2, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import RescheduledNotice from '../../appointments/RescheduledNotice';
import RequestedPriestNote from '../../appointments/RequestedPriestNote';
import type { HydratedAppointment as Appointment } from '../../../lib/supabase/appointments';

interface UserOtherAppointmentsCardProps {
    appointments: Appointment[];
}

export default function UserOtherAppointmentsCard({ appointments }: UserOtherAppointmentsCardProps) {
    if (appointments.length === 0) {
        return null;
    }

    const confirmedCount = appointments.filter(a => a.status === 'approved').length;
    const pendingCount = appointments.filter(a => a.status === 'pending').length;
    const completedCount = appointments.filter(a => (a.status as string) === 'completed' || (a.status as string) === 'celebrated').length;

    const summaryParts: string[] = [];
    if (confirmedCount > 0) summaryParts.push(`${confirmedCount} confirmed`);
    if (pendingCount > 0) summaryParts.push(`${pendingCount} pending review`);
    if (completedCount > 0) summaryParts.push(`${completedCount} completed`);
    const summaryText = summaryParts.length > 0
        ? `${appointments.length} more · ${summaryParts.join(', ')}`
        : `${appointments.length} more`;

    return (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
            {/* Header */}
            <div className="mb-4">
                <h3 className="font-semibold text-lg text-foreground">
                    Other appointments
                </h3>
                <p className="text-xs text-muted mt-0.5">
                    {summaryText}
                </p>
            </div>

            {/* List */}
            <div className="divide-y divide-border">
                {appointments.map(app => {
                    const isPending = app.status === 'pending';
                    const isApproved = app.status === 'approved';
                    const isCancelled = app.status === 'cancelled';
                    const isCompleted = (app.status as string) === 'completed' || (app.status as string) === 'celebrated';

                    let formattedDate = app.appointment_date;
                    try {
                        formattedDate = format(new Date(app.appointment_date), 'EEE, MMM d');
                    } catch {
                        formattedDate = app.appointment_date;
                    }

                    return (
                        <div key={app.id} className="py-4 first:pt-1 last:pb-1 flex items-start gap-3.5">
                            {/* Icon */}
                            <div className="mt-0.5 shrink-0">
                                {isApproved && (
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                )}
                                {isPending && (
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                )}
                                {isCancelled && (
                                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                )}
                                {isCompleted && (
                                    <div className="w-8 h-8 rounded-lg bg-secondary-100 text-secondary-600 flex items-center justify-center">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}
                                {!isApproved && !isPending && !isCancelled && !isCompleted && (
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">
                                        {app.service_type}
                                    </h4>

                                    {/* Status Badge */}
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 capitalize ${
                                            isApproved
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                : isPending
                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                : isCancelled
                                                ? 'bg-red-50 text-red-800 border border-red-200'
                                                : 'bg-secondary-100 text-secondary-800 border border-secondary-200'
                                        }`}
                                    >
                                        {app.status}
                                    </span>
                                </div>

                                {app.notes && (
                                    <p className="text-xs text-secondary-600 mt-0.5 truncate">
                                        {app.notes}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1.5">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-secondary-400" />
                                        {formattedDate} · {app.appointment_time}
                                    </span>
                                    {app.church?.name && (
                                        <span className="flex items-center gap-1">
                                            <Church className="w-3.5 h-3.5 text-secondary-400" />
                                            {app.church.name}
                                        </span>
                                    )}
                                </div>

                                {app.cancellation_reason && (
                                    <p className="text-xs text-red-700 mt-1.5 font-medium">
                                        Reason: {app.cancellation_reason}
                                    </p>
                                )}

                                <RescheduledNotice appointment={app} className="mt-2" />
                                <RequestedPriestNote appointment={app} className="mt-2" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

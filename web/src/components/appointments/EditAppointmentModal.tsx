import { useEffect, useState } from 'react';
import { Loader2, XCircle, UserCog, CalendarClock, CheckCircle2, RotateCcw, type LucideIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import CelebrantPicker from './CelebrantPicker';
import AppointmentChangeHistory from './AppointmentChangeHistory';
import { normalizeTime } from '../../lib/liturgicalScheduler';
import {
    cancelAppointment,
    changeAppointmentCelebrant,
    markAppointmentCelebrated,
    rescheduleAppointment,
    restoreAppointment,
    formatAppointmentTime,
    type HydratedAppointment,
} from '../../lib/supabase/appointments';

/** Every action the office can perform on an appointment: the first four on approved ones, restore on Cancelled or Celebrated ones. */
export type EditActionId = 'cancel' | 'change_celebrant' | 'reschedule' | 'mark_celebrated' | 'restore';

interface EditActionDefinition {
    id: EditActionId;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Disabled actions are listed in the picker but cannot be chosen yet. */
    enabled: boolean;
    /** Whether the reason box must be filled before saving. */
    reasonRequired: boolean;
    reasonLabel: string;
    reasonPlaceholder: string;
    submitLabel: string;
    /** Destructive actions render a red primary button. */
    destructive?: boolean;
}

/**
 * Action registry. To add an action: flip `enabled`, register its handler in
 * EDIT_ACTION_HANDLERS below and (for actions with extra inputs) render its fields
 * in the modal body next to the reason box.
 */
const EDIT_ACTIONS: EditActionDefinition[] = [
    {
        id: 'cancel',
        label: 'Cancel appointment',
        description: 'End this appointment. The parishioner and the celebrant are notified with your reason.',
        icon: XCircle,
        enabled: true,
        reasonRequired: true,
        reasonLabel: 'Reason for cancelling',
        reasonPlaceholder: 'Explain why this appointment is being cancelled...',
        submitLabel: 'Cancel appointment',
        destructive: true,
    },
    {
        id: 'change_celebrant',
        label: 'Change celebrant',
        description: 'Assign a different priest to preside.',
        icon: UserCog,
        enabled: true,
        reasonRequired: true,
        reasonLabel: 'Reason for the change',
        reasonPlaceholder: 'Explain why the celebrant is changing...',
        submitLabel: 'Change celebrant',
    },
    {
        id: 'reschedule',
        label: 'Reschedule',
        description: 'Move this appointment to a new date or time.',
        icon: CalendarClock,
        enabled: true,
        reasonRequired: true,
        reasonLabel: 'Reason for rescheduling',
        reasonPlaceholder: 'Explain why the schedule is changing...',
        submitLabel: 'Reschedule',
    },
    {
        id: 'mark_celebrated',
        label: 'Mark celebrated',
        description: 'Record that the rite has taken place. Nobody is notified.',
        icon: CheckCircle2,
        enabled: true,
        reasonRequired: false,
        reasonLabel: 'Note (optional)',
        reasonPlaceholder: 'Add an optional note...',
        submitLabel: 'Mark celebrated',
    },
    {
        id: 'restore',
        label: 'Restore to approved',
        description: 'Undo a cancellation or a Celebrated mark. A restored cancellation notifies the parishioner and the celebrant.',
        icon: RotateCcw,
        enabled: true,
        reasonRequired: true,
        reasonLabel: 'Reason for restoring',
        reasonPlaceholder: 'Explain why this appointment is being restored...',
        submitLabel: 'Restore to approved',
    },
];

/** Cancelled and Celebrated (stored as 'completed') appointments can only be restored; approved ones can be edited. */
function isRestorable(appointment: HydratedAppointment): boolean {
    return appointment.status === 'cancelled' || appointment.status === 'completed';
}

/** The actions on offer for an appointment: only Restore once it is Cancelled or Celebrated, otherwise everything but Restore. */
function actionsFor(appointment: HydratedAppointment): EditActionDefinition[] {
    const restorable = isRestorable(appointment);
    return EDIT_ACTIONS.filter((a) => (a.id === 'restore') === restorable);
}

type EditActionResult = { success: boolean; error: { message: string } | null };

/** Extra inputs collected by an action's own fields (rendered above the reason box). */
interface EditActionInputs {
    /** Celebrant chosen in the picker (change_celebrant) or kept/switched to (reschedule). */
    priestId: string;
    /** New date (YYYY-MM-DD) and time (HH:mm) chosen for a reschedule. */
    date: string;
    time: string;
}

/** One handler per enabled action. Each receives the appointment, the trimmed reason and the extra inputs. */
const EDIT_ACTION_HANDLERS: Partial<
    Record<
        EditActionId,
        (appointment: HydratedAppointment, reason: string, inputs: EditActionInputs) => Promise<EditActionResult>
    >
> = {
    cancel: (appointment, reason) => cancelAppointment(appointment.id, reason),
    restore: (appointment, reason) => restoreAppointment(appointment.id, reason),
    // The note is optional: an empty reason is sent as no note
    mark_celebrated: (appointment, note) => markAppointmentCelebrated(appointment.id, note),
    change_celebrant: (appointment, reason, inputs) =>
        changeAppointmentCelebrant(appointment.id, inputs.priestId, reason),
    reschedule: (appointment, reason, inputs) =>
        rescheduleAppointment(
            appointment.id,
            inputs.date,
            inputs.time,
            reason,
            // Only a celebrant different from the current one counts as a switch
            inputs.priestId && inputs.priestId !== appointment.priest_id ? inputs.priestId : null
        ),
};

/** Today as YYYY-MM-DD in UTC, the same notion of "today" the reschedule_appointment function uses. */
function todayIso(): string {
    return new Date().toISOString().split('T')[0];
}

/** The same action reads "Assign celebrant" when nobody is assigned yet and "Change celebrant" otherwise. */
function resolveActionText(action: EditActionDefinition, appointment: HydratedAppointment) {
    if (action.id !== 'change_celebrant' || appointment.priest_id) return action;
    return {
        ...action,
        label: 'Assign celebrant',
        description: 'Choose the priest who will preside.',
        reasonLabel: 'Reason for the assignment',
        reasonPlaceholder: 'Explain why this celebrant is being assigned...',
        submitLabel: 'Assign celebrant',
    };
}

const DEFAULT_ACTION = EDIT_ACTIONS.find((a) => a.enabled) ?? EDIT_ACTIONS[0];

/** The action selected when the modal opens: Restore for Cancelled/Celebrated appointments, Cancel otherwise. */
function defaultActionFor(appointment: HydratedAppointment | null): EditActionDefinition {
    if (!appointment) return DEFAULT_ACTION;
    return actionsFor(appointment).find((a) => a.enabled) ?? DEFAULT_ACTION;
}

export interface EditAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: HydratedAppointment | null;
    /** Called after an action was saved so the page can refresh its data. */
    onSaved: (actionId: EditActionId, appointment: HydratedAppointment) => Promise<void> | void;
}

export default function EditAppointmentModal({ isOpen, onClose, appointment, onSaved }: EditAppointmentModalProps) {
    const [actionId, setActionId] = useState<EditActionId>(DEFAULT_ACTION.id);
    const [reason, setReason] = useState('');
    const [selectedPriestId, setSelectedPriestId] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset the form whenever the modal opens for a (different) appointment
    useEffect(() => {
        if (!isOpen) return;
        setActionId(defaultActionFor(appointment).id);
        setReason('');
        setSelectedPriestId('');
        setNewDate(appointment?.appointment_date?.split('T')[0] ?? '');
        setNewTime(normalizeTime(appointment?.appointment_time));
        setReasonError(null);
        setSubmitError(null);
        setIsSubmitting(false);
    // Re-seed only when the modal opens or switches appointment, not on every refetch of the same one
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, appointment?.id]);

    if (!appointment) return null;

    const selectedAction = resolveActionText(
        actionsFor(appointment).find((a) => a.id === actionId) ?? defaultActionFor(appointment),
        appointment
    );

    const today = todayIso();
    const isPastDate = Boolean(newDate) && newDate < today;
    const hasValidSlot = Boolean(newDate) && Boolean(newTime) && !isPastDate;

    const handleSave = async () => {
        if (selectedAction.id === 'reschedule') {
            if (!newDate || !newTime) {
                setSubmitError('Please choose a new date and time before saving.');
                return;
            }
            if (isPastDate) {
                setSubmitError('Past dates cannot be selected. Please choose today or a later date.');
                return;
            }
            const sameSlot =
                newDate === appointment.appointment_date.split('T')[0] &&
                normalizeTime(newTime) === normalizeTime(appointment.appointment_time);
            const priestSwitched = Boolean(selectedPriestId) && selectedPriestId !== appointment.priest_id;
            if (sameSlot && !priestSwitched) {
                setSubmitError('Choose a different date, time or celebrant to reschedule.');
                return;
            }
        }
        if (selectedAction.id === 'change_celebrant' && !selectedPriestId) {
            setSubmitError('Please choose a celebrant before saving.');
            return;
        }
        const trimmed = reason.trim();
        if (selectedAction.reasonRequired && !trimmed) {
            setReasonError('Please enter a reason before saving.');
            return;
        }
        const handler = EDIT_ACTION_HANDLERS[selectedAction.id];
        if (!handler) return;

        setReasonError(null);
        setSubmitError(null);
        setIsSubmitting(true);
        try {
            const { success, error } = await handler(appointment, trimmed, {
                priestId: selectedPriestId,
                date: newDate,
                time: newTime,
            });
            if (!success) {
                setSubmitError(error?.message || 'Could not save this change. Please try again.');
                return;
            }
            await onSaved(selectedAction.id, appointment);
            onClose();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Could not save this change. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={isSubmitting ? () => undefined : onClose}
            title="Edit appointment"
            description={`${appointment.service_type} · ${appointment.appointment_date} at ${formatAppointmentTime(appointment.appointment_time)}`}
            size="lg"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className={`px-4 py-2 rounded-xl text-white font-bold text-sm shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60 ${
                            selectedAction.destructive
                                ? 'bg-destructive hover:bg-red-600'
                                : 'bg-primary hover:bg-blue-700'
                        }`}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {selectedAction.submitLabel}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                <div role="radiogroup" aria-label="Edit action" className="grid gap-2 sm:grid-cols-2">
                    {actionsFor(appointment).map((definition) => {
                        const action = resolveActionText(definition, appointment);
                        const Icon = action.icon;
                        const isSelected = action.id === selectedAction.id;
                        return (
                            <button
                                key={action.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={!action.enabled || isSubmitting}
                                onClick={() => {
                                    setActionId(action.id);
                                    // Reschedule starts on the current celebrant ("keep"); Change celebrant starts empty
                                    setSelectedPriestId(action.id === 'reschedule' ? appointment.priest_id ?? '' : '');
                                    setReasonError(null);
                                    setSubmitError(null);
                                }}
                                className={`text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                                    isSelected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border bg-white hover:bg-secondary-50'
                                } ${action.enabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-secondary-500'}`} />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                                    <span className="block text-xs text-muted mt-0.5">
                                        {action.enabled ? action.description : 'Not available yet'}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {selectedAction.id === 'reschedule' && (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="edit-appointment-date" className="block text-sm font-semibold text-foreground mb-1.5">
                                    New date
                                </label>
                                <input
                                    id="edit-appointment-date"
                                    type="date"
                                    min={today}
                                    value={newDate}
                                    onChange={(e) => {
                                        setNewDate(e.target.value);
                                        setSubmitError(null);
                                    }}
                                    disabled={isSubmitting}
                                    aria-invalid={isPastDate ? true : undefined}
                                    className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div>
                                <label htmlFor="edit-appointment-time" className="block text-sm font-semibold text-foreground mb-1.5">
                                    New time
                                </label>
                                <input
                                    id="edit-appointment-time"
                                    type="time"
                                    value={newTime}
                                    onChange={(e) => {
                                        setNewTime(e.target.value);
                                        setSubmitError(null);
                                    }}
                                    disabled={isSubmitting}
                                    className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                        </div>
                        {isPastDate && (
                            <p role="alert" className="text-xs font-medium text-destructive">
                                Past dates cannot be selected. Choose today or a later date.
                            </p>
                        )}
                        {hasValidSlot && (
                            <CelebrantPicker
                                appointment={{ ...appointment, appointment_date: newDate, appointment_time: newTime }}
                                selectedPriestId={selectedPriestId}
                                onSelect={(priestId) => {
                                    setSelectedPriestId(priestId);
                                    setSubmitError(null);
                                }}
                                disabled={isSubmitting}
                                allowKeepCurrent
                            />
                        )}
                    </div>
                )}

                {selectedAction.id === 'change_celebrant' && (
                    <CelebrantPicker
                        appointment={appointment}
                        selectedPriestId={selectedPriestId}
                        onSelect={(priestId) => {
                            setSelectedPriestId(priestId);
                            setSubmitError(null);
                        }}
                        disabled={isSubmitting}
                    />
                )}

                <div>
                    <label htmlFor="edit-appointment-reason" className="block text-sm font-semibold text-foreground mb-1.5">
                        {selectedAction.reasonLabel}
                    </label>
                    <textarea
                        id="edit-appointment-reason"
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (reasonError) setReasonError(null);
                        }}
                        rows={3}
                        disabled={isSubmitting}
                        placeholder={selectedAction.reasonPlaceholder}
                        aria-invalid={reasonError ? true : undefined}
                        aria-describedby={reasonError ? 'edit-appointment-reason-error' : undefined}
                        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                            reasonError ? 'border-destructive' : 'border-border'
                        }`}
                    />
                    {reasonError && (
                        <p id="edit-appointment-reason-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                            {reasonError}
                        </p>
                    )}
                </div>

                {submitError && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                        {submitError}
                    </p>
                )}

                <AppointmentChangeHistory
                    appointmentId={appointment.id}
                    refreshKey={appointment.updated_at ?? appointment.status}
                    className="pt-4 border-t border-border"
                />
            </div>
        </Modal>
    );
}

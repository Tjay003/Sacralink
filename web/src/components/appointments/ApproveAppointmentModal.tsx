import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, User, Calendar, Clock, Building2, FileText, Loader2, Cross, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import { getChurchPriests } from '../../lib/supabase/profiles';
import { formatAppointmentTime, type HydratedAppointment } from '../../lib/supabase/appointments';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../types/database';

export interface ApproveAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: HydratedAppointment | null;
    onConfirm: (priestId: string | null, adminFeedback: string | null) => Promise<void>;
    isSubmitting: boolean;
}

export default function ApproveAppointmentModal({
    isOpen,
    onClose,
    appointment,
    onConfirm,
    isSubmitting,
}: ApproveAppointmentModalProps) {
    const { profile: currentUser } = useAuth();
    const [priests, setPriests] = useState<Profile[]>([]);
    const [loadingPriests, setLoadingPriests] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [selectedPriestId, setSelectedPriestId] = useState<string>('');
    const [adminFeedback, setAdminFeedback] = useState<string>('');

    // Whether the logged in user is eligible to preside (church admin, admin, priest)
    const isCurrentUserEligible = Boolean(
        currentUser && (
            currentUser.role === 'church_admin' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'priest' ||
            currentUser.is_priest
        )
    );

    // Ensure currentUser is always included in the available celebrants pool if eligible
    const availableCelebrants = useMemo(() => {
        if (!isCurrentUserEligible || !currentUser) return priests;
        const exists = priests.some(p => p.id === currentUser.id);
        if (exists) return priests;
        return [currentUser, ...priests];
    }, [priests, isCurrentUserEligible, currentUser]);

    // Synchronize initial state when modal opens or appointment changes
    useEffect(() => {
        if (!isOpen || !appointment) {
            setSelectedPriestId('');
            setAdminFeedback('');
            setPriests([]);
            setFetchError(null);
            return;
        }

        setSelectedPriestId(appointment.priest_id || '');
        setAdminFeedback(appointment.admin_feedback || '');

        let isMounted = true;
        const fetchPriests = async () => {
            try {
                setLoadingPriests(true);
                setFetchError(null);
                const data = await getChurchPriests(appointment.church_id);
                if (isMounted) {
                    setPriests(data || []);
                }
            } catch (err) {
                console.error('Failed to load priests for church:', err);
                if (isMounted) {
                    setFetchError('Unable to load available clergy. You may still proceed with parish pool.');
                }
            } finally {
                if (isMounted) {
                    setLoadingPriests(false);
                }
            }
        };

        void fetchPriests();

        return () => {
            isMounted = false;
        };
    }, [isOpen, appointment]);

    if (!isOpen || !appointment) return null;

    const isAlreadyApproved = appointment.status === 'approved';

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const priestIdToSubmit = selectedPriestId.trim() ? selectedPriestId.trim() : null;
        const feedbackToSubmit = adminFeedback.trim() ? adminFeedback.trim() : null;

        await onConfirm(priestIdToSubmit, feedbackToSubmit);
    };

    const formatPriestName = (profile: Profile): string => {
        const rawName = (profile.full_name || 'Clergy Member').trim();
        if (rawName.toLowerCase().startsWith('fr.') || rawName.toLowerCase().startsWith('father ')) {
            return rawName;
        }
        if (profile.role === 'priest' || profile.is_priest) {
            return `Fr. ${rawName}`;
        }
        return rawName;
    };

    const formatCelebrantOption = (priest: Profile): string => {
        const baseName = formatPriestName(priest);
        if (currentUser && priest.id === currentUser.id) {
            return `${baseName} (Assign to Myself)`;
        }
        return baseName;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (!isSubmitting) onClose();
            }}
            size="lg"
            title={
                <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${
                        isAlreadyApproved
                            ? 'bg-amber-50 text-amber-600 border-amber-200/60'
                            : 'bg-green-50 text-green-600 border-green-200/60'
                    }`}>
                        {isAlreadyApproved ? <Cross className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {isAlreadyApproved ? 'Assign Presiding Celebrant' : 'Approve Sacramental Appointment'}
                        </h2>
                        <p className="text-xs text-muted">
                            {isAlreadyApproved
                                ? 'Assign or update the presiding celebrant and instructions for this appointment.'
                                : 'Assign a presiding celebrant and send instructions to the parishioner.'}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleFormSubmit}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isAlreadyApproved ? 'Saving...' : 'Approving...'}
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                {isAlreadyApproved ? 'Save Assignment' : 'Approve Appointment'}
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Appointment Overview Summary Card */}
                <div className="bg-secondary-50/70 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <span className="font-semibold text-base text-foreground flex items-center gap-2">
                            <span>{appointment.service_type}</span>
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                            isAlreadyApproved
                                ? 'bg-green-50 text-green-700 border border-green-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}>
                            {isAlreadyApproved ? (
                                <>
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                    Approved
                                </>
                            ) : (
                                <>
                                    <Cross className="w-3 h-3 text-amber-600" />
                                    Pending Review
                                </>
                            )}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-secondary-700">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted shrink-0" />
                            <span className="truncate">
                                <span className="font-medium text-foreground">Parishioner:</span>{' '}
                                {appointment.profile?.full_name || 'Anonymous User'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted shrink-0" />
                            <span className="truncate">
                                <span className="font-medium text-foreground">Church:</span>{' '}
                                {appointment.church?.name || 'Selected Parish'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted shrink-0" />
                            <span>
                                <span className="font-medium text-foreground">Date:</span>{' '}
                                {appointment.appointment_date}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted shrink-0" />
                            <span>
                                <span className="font-medium text-foreground">Time:</span>{' '}
                                {formatAppointmentTime(appointment.appointment_time)}
                            </span>
                        </div>
                    </div>

                    {appointment.notes && (
                        <div className="text-xs bg-white border border-border/80 rounded-lg p-2.5 text-muted">
                            <span className="font-medium text-foreground">Parishioner Request Notes:</span>{' '}
                            {appointment.notes}
                        </div>
                    )}
                </div>

                {/* Celebrant Picker */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="celebrant-select" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Cross className="w-4 h-4 text-amber-600" />
                            <span>Presiding Celebrant</span>
                        </label>
                        <div className="flex items-center gap-2">
                            {isCurrentUserEligible && currentUser && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedPriestId(currentUser.id)}
                                    disabled={isSubmitting}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 font-medium ${
                                        selectedPriestId === currentUser.id
                                            ? 'bg-primary/10 border-primary text-primary font-semibold ring-1 ring-primary/20'
                                            : 'bg-white hover:bg-secondary-50 border-border text-secondary-700 shadow-sm'
                                    }`}
                                    title="Quickly assign yourself as the presiding celebrant"
                                >
                                    <User className="w-3.5 h-3.5" />
                                    <span>{selectedPriestId === currentUser.id ? '✓ Assigned to Myself' : 'Assign to Myself'}</span>
                                </button>
                            )}
                            {loadingPriests && (
                                <span className="text-xs text-muted flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                    Loading priests...
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            id="celebrant-select"
                            value={selectedPriestId}
                            onChange={(e) => setSelectedPriestId(e.target.value)}
                            disabled={isSubmitting || loadingPriests}
                            className="w-full bg-white border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60 cursor-pointer"
                        >
                            <option value="">None / Unassigned (Parish Pool)</option>
                            {availableCelebrants.map((priest) => (
                                <option key={priest.id} value={priest.id}>
                                    {formatCelebrantOption(priest)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <p className="text-xs text-muted">
                        Selecting a celebrant will assign them to the sacrament and automatically send them an in-app assignment notification.
                    </p>

                    {fetchError && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{fetchError}</span>
                        </div>
                    )}
                </div>

                {/* Parishioner Instructions & Feedback Textarea */}
                <div className="space-y-1.5">
                    <label htmlFor="admin-feedback" className="block text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" />
                        Admin Instructions & Notes for Parishioner
                        <span className="text-xs font-normal text-muted">(Optional)</span>
                    </label>

                    <textarea
                        id="admin-feedback"
                        rows={3}
                        value={adminFeedback}
                        onChange={(e) => setAdminFeedback(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Add instructions for the parishioner (e.g. Please bring original PSA birth certificate 3 days prior)..."
                        className="w-full bg-white border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none disabled:opacity-60"
                    />

                    <p className="text-xs text-muted">
                        These notes will be displayed on the parishioner&apos;s appointment card and included in their approval notification.
                    </p>
                </div>
            </form>
        </Modal>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import {
    CheckCircle2,
    User,
    Calendar,
    Clock,
    Building2,
    FileText,
    Loader2,
    Cross,
    AlertCircle,
    AlertTriangle,
    ShieldAlert,
    Sparkles,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { getChurchPriests } from '../../lib/supabase/profiles';
import { formatAppointmentTime, type HydratedAppointment } from '../../lib/supabase/appointments';
import { evaluateParishCelebrants, type CelebrantEvaluation } from '../../lib/liturgicalScheduler';
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

    // Celebrant evaluation & smart Canon 905 recommendation state
    const [celebrantEvaluations, setCelebrantEvaluations] = useState<Record<string, CelebrantEvaluation>>({});
    const [evaluatingCelebrants, setEvaluatingCelebrants] = useState<boolean>(false);
    const [recommendedPriest, setRecommendedPriest] = useState<Profile | null>(null);

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
            setCelebrantEvaluations({});
            setRecommendedPriest(null);
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

    // Run Canon 905 & availability multi-constraint evaluation for all candidate celebrants.
    // Depend on the slot fields, not the appointment object, so a re-render with the same slot doesn't re-run it.
    const evalAppointmentId = appointment?.id;
    const evalDate = appointment?.appointment_date;
    const evalTime = appointment?.appointment_time;
    const evalChurchId = appointment?.church_id;

    useEffect(() => {
        if (!isOpen || !evalAppointmentId || !evalDate || !evalTime || !evalChurchId || availableCelebrants.length === 0) {
            setCelebrantEvaluations({});
            setRecommendedPriest(null);
            return;
        }

        let isMounted = true;
        const runEvaluation = async () => {
            setEvaluatingCelebrants(true);
            try {
                const result = await evaluateParishCelebrants(
                    availableCelebrants,
                    evalDate,
                    evalTime,
                    evalChurchId,
                    evalAppointmentId
                );
                if (isMounted) {
                    setCelebrantEvaluations(result.evaluations);
                    setRecommendedPriest(result.recommendedPriest);
                }
            } catch (err) {
                console.error('Error evaluating parish celebrants:', err);
            } finally {
                if (isMounted) {
                    setEvaluatingCelebrants(false);
                }
            }
        };

        void runEvaluation();

        return () => {
            isMounted = false;
        };
    }, [isOpen, evalAppointmentId, evalDate, evalTime, evalChurchId, availableCelebrants]);

    if (!isOpen || !appointment) return null;

    const isAlreadyApproved = appointment.status === 'approved';
    const selectedEvaluation = selectedPriestId ? celebrantEvaluations[selectedPriestId] : null;
    const isSelectedPriestIneligible = Boolean(selectedPriestId && selectedEvaluation && !selectedEvaluation.eligible);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isSelectedPriestIneligible) return;

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
        const isSelf = currentUser && priest.id === currentUser.id;
        const selfSuffix = isSelf ? ' (Myself)' : '';
        const evaluation = celebrantEvaluations[priest.id];

        if (!evaluation) {
            return `${baseName}${selfSuffix}`;
        }

        let statusIndicator = '🟢';
        if (evaluation.badgeVariant === 'destructive') {
            statusIndicator = '🔴';
        } else if (evaluation.badgeVariant === 'warning') {
            statusIndicator = '⚠️';
        }

        return `${statusIndicator} ${baseName}${selfSuffix} — ${evaluation.badgeText}`;
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                    <div className="text-xs text-muted">
                        {isSelectedPriestIneligible && (
                            <span className="text-destructive font-medium flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Please resolve celebrant conflict before saving.
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                            disabled={isSubmitting || isSelectedPriestIneligible}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="space-y-2">
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
                            {(loadingPriests || evaluatingCelebrants) && (
                                <span className="text-xs text-muted flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                    <span>Evaluating Canon 905 & availability...</span>
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
                            className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 transition-all disabled:opacity-60 cursor-pointer ${
                                isSelectedPriestIneligible
                                    ? 'border-destructive focus:ring-destructive/20 focus:border-destructive text-destructive'
                                    : 'border-border text-foreground focus:ring-primary/20 focus:border-primary'
                            }`}
                        >
                            <option value="">None / Unassigned (Parish Pool)</option>
                            {availableCelebrants.map((priest) => (
                                <option key={priest.id} value={priest.id}>
                                    {formatCelebrantOption(priest)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selected Celebrant Realtime Status Pill */}
                    {selectedPriestId && selectedEvaluation && (
                        <div className="flex items-center gap-2 pt-0.5">
                            {selectedEvaluation.badgeVariant === 'success' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    <span>Canonically Available (0 commitments today)</span>
                                </span>
                            )}
                            {selectedEvaluation.badgeVariant === 'warning' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Eligible ({selectedEvaluation.dailyCount} liturgical celebration scheduled today)</span>
                                </span>
                            )}
                            {selectedEvaluation.badgeVariant === 'destructive' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-destructive border border-red-200">
                                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                                    <span>Unavailable: {selectedEvaluation.badgeText}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Reverent Conflict Warning Card */}
                    {selectedPriestId && selectedEvaluation && selectedEvaluation.warnings.length > 0 && (
                        <div
                            className={`rounded-xl border p-3.5 space-y-2 text-xs transition-all ${
                                !selectedEvaluation.eligible
                                    ? 'bg-red-50/70 border-red-200 text-red-900'
                                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                            }`}
                        >
                            <div className="flex items-start gap-2.5">
                                {!selectedEvaluation.eligible ? (
                                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1">
                                    <h4 className="font-semibold">
                                        {!selectedEvaluation.eligible
                                            ? 'Canonical / Temporal Conflict'
                                            : 'Liturgical Schedule Notice'}
                                    </h4>
                                    <ul className="space-y-1 list-disc list-inside opacity-90">
                                        {selectedEvaluation.warnings.map((warn, idx) => (
                                            <li key={idx}>{warn}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Smart Recommended Alternative Celebrant Card */}
                    {recommendedPriest && recommendedPriest.id !== selectedPriestId && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all">
                            <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-lg bg-blue-100 text-primary shrink-0 mt-0.5 sm:mt-0">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <span className="font-semibold text-foreground">
                                        💡 Recommended Celebrant:
                                    </span>{' '}
                                    <span className="text-secondary-700">
                                        <span className="font-semibold text-foreground">
                                            {formatPriestName(recommendedPriest)}
                                        </span>{' '}
                                        is available with{' '}
                                        <span className="font-medium text-foreground">
                                            {celebrantEvaluations[recommendedPriest.id]?.dailyCount ?? 0} commitments
                                        </span>{' '}
                                        today.
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPriestId(recommendedPriest.id)}
                                className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold transition-colors shadow-sm shrink-0 flex items-center gap-1"
                            >
                                <span>Assign {formatPriestName(recommendedPriest)}</span>
                            </button>
                        </div>
                    )}

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

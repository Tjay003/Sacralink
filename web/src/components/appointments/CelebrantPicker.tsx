import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { getChurchPriests } from '../../lib/supabase/profiles';
import { evaluateParishCelebrants, type CelebrantEvaluation } from '../../lib/liturgicalScheduler';
import type { HydratedAppointment } from '../../lib/supabase/appointments';
import type { Profile } from '../../types/database';

export interface CelebrantPickerProps {
    appointment: HydratedAppointment;
    selectedPriestId: string;
    onSelect: (priestId: string) => void;
    disabled?: boolean;
    /**
     * When true the current celebrant can be selected too (meaning "keep him"), so the office can see
     * whether he is free at a new slot. Used by Reschedule; Change celebrant leaves it off.
     */
    allowKeepCurrent?: boolean;
}

/** Display name for a clergy member, prefixed with "Fr." for priests. */
function formatPriestName(profile: Profile): string {
    const rawName = (profile.full_name || 'Clergy Member').trim();
    if (rawName.toLowerCase().startsWith('fr.') || rawName.toLowerCase().startsWith('father ')) {
        return rawName;
    }
    return profile.role === 'priest' || profile.is_priest ? `Fr. ${rawName}` : rawName;
}

const BADGE_STYLES: Record<CelebrantEvaluation['badgeVariant'], string> = {
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-red-50 text-destructive border-red-200',
};

/**
 * Scored list of the parish's celebrants for one appointment slot (day off, leave, double booking and
 * Canon 905 badges, same evaluation the approve modal uses). Conflicts are shown as a warning only:
 * the office can still pick a conflicting priest once it has seen the warning.
 */
export default function CelebrantPicker({
    appointment,
    selectedPriestId,
    onSelect,
    disabled,
    allowKeepCurrent = false,
}: CelebrantPickerProps) {
    const [priests, setPriests] = useState<Profile[]>([]);
    const [evaluations, setEvaluations] = useState<Record<string, CelebrantEvaluation>>({});
    const [recommendedId, setRecommendedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const { id, church_id: churchId, appointment_date: date, appointment_time: time } = appointment;

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const list = (await getChurchPriests(churchId)) || [];
                if (!isMounted) return;
                setPriests(list);
                if (list.length > 0) {
                    const result = await evaluateParishCelebrants(list, date, time, churchId, id);
                    if (!isMounted) return;
                    setEvaluations(result.evaluations);
                    setRecommendedId(result.recommendedPriest?.id ?? null);
                }
            } catch (err) {
                console.error('Failed to load celebrants for appointment:', err);
                if (isMounted) setLoadError('Unable to load the parish clergy. Please close this window and try again.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        void load();
        return () => {
            isMounted = false;
        };
    }, [id, churchId, date, time]);

    const selectedEvaluation = selectedPriestId ? evaluations[selectedPriestId] : undefined;
    const selectedPriest = priests.find((p) => p.id === selectedPriestId);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span id="celebrant-picker-label" className="text-sm font-semibold text-foreground">
                    Presiding celebrant
                </span>
                {loading && (
                    <span className="text-xs text-muted flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        Checking availability and Canon 905...
                    </span>
                )}
            </div>

            {loadError && (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{loadError}</span>
                </p>
            )}

            <div role="radiogroup" aria-labelledby="celebrant-picker-label" className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                {priests.map((priest) => {
                    const evaluation = evaluations[priest.id];
                    const isCurrent = priest.id === appointment.priest_id;
                    const isLocked = isCurrent && !allowKeepCurrent;
                    const isSelected = priest.id === selectedPriestId;
                    return (
                        <button
                            key={priest.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={disabled || isLocked}
                            onClick={() => onSelect(priest.id)}
                            className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                                isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border bg-white hover:bg-secondary-50'
                            } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-foreground truncate">
                                    {formatPriestName(priest)}
                                    {isCurrent && <span className="font-normal text-muted"> (current celebrant)</span>}
                                    {priest.id === recommendedId && !isLocked && (
                                        <span className="ml-2 text-[11px] font-semibold text-primary">Recommended</span>
                                    )}
                                </span>
                            </span>
                            {evaluation && (
                                <span
                                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${BADGE_STYLES[evaluation.badgeVariant]}`}
                                >
                                    {evaluation.badgeText}
                                </span>
                            )}
                        </button>
                    );
                })}
                {!loading && !loadError && priests.length === 0 && (
                    <p className="text-xs text-muted">No priests are registered for this parish yet.</p>
                )}
            </div>

            {selectedPriest && selectedEvaluation && (selectedEvaluation.warnings.length > 0 || !selectedEvaluation.eligible) && (
                <div
                    role="status"
                    data-testid="celebrant-conflict-warning"
                    className={`rounded-xl border p-3.5 text-xs ${
                        selectedEvaluation.eligible
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                            : 'bg-red-50/70 border-red-200 text-red-900'
                    }`}
                >
                    <div className="flex items-start gap-2.5">
                        {selectedEvaluation.eligible ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                            <h4 className="font-semibold">
                                {formatPriestName(selectedPriest)}:{' '}
                                {selectedEvaluation.eligible ? 'Liturgical schedule notice' : 'Scheduling conflict'}
                            </h4>
                            <ul className="space-y-1 list-disc list-inside opacity-90">
                                {selectedEvaluation.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                            <p className="font-medium pt-1">You can still save this change if you want to proceed.</p>
                        </div>
                    </div>
                </div>
            )}

            {selectedPriest && selectedEvaluation && selectedEvaluation.warnings.length === 0 && selectedEvaluation.eligible && (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    No conflicts found for {formatPriestName(selectedPriest)}.
                </p>
            )}
        </div>
    );
}

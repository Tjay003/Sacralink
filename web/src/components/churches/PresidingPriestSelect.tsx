import { useId } from 'react';
import { celebrantLabel, useParishClergy } from '../../hooks/useParishClergy';

interface PresidingPriestSelectProps {
    churchId: string;
    /** Profile id of the presiding priest, or '' for "Not assigned". */
    value: string;
    onChange: (priestId: string) => void;
    disabled?: boolean;
}

/**
 * PresidingPriestSelect - Optional "Presiding priest" field for the Mass schedule modals.
 * Lists only the priests of the given church (get_parish_clergy), plus "Not assigned".
 */
export default function PresidingPriestSelect({ churchId, value, onChange, disabled = false }: PresidingPriestSelectProps) {
    const selectId = useId();
    const { clergy, loading } = useParishClergy(churchId);

    // A stored celebrant who is no longer one of this church's priests stays visible, so saving
    // the form never clears them silently; the office can still pick someone else or Not assigned.
    const isFormerPriest = !loading && value !== '' && !clergy.some((member) => member.priestId === value);

    return (
        <div>
            <label htmlFor={selectId} className="block text-sm font-medium mb-1.5">
                Presiding priest (Optional)
            </label>
            <select
                id={selectId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || loading}
                className="input w-full"
            >
                {loading ? (
                    <option value={value}>Loading priests...</option>
                ) : (
                    <>
                        <option value="">Not assigned</option>
                        {clergy.map((member) => (
                            <option key={member.priestId} value={member.priestId}>
                                {celebrantLabel(member)}
                            </option>
                        ))}
                        {isFormerPriest && (
                            <option value={value}>Former parish priest (no longer assigned here)</option>
                        )}
                    </>
                )}
            </select>
        </div>
    );
}

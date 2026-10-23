import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import CountdownPanel from '../common/CountdownPanel';
import { useCountdown } from '../../hooks/useCountdown';
import { deleteChurch, getChurchDeletionImpact, type ChurchDeletionImpact } from '../../lib/supabase/churchDeletion';
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

interface DeleteChurchModalProps {
    churchId: string;
    churchName: string;
    onClose: () => void;
    /** Called after the church is gone. */
    onDeleted: () => void;
}

const COUNTDOWN_SECONDS = 5;

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

function peopleSummary(impact: ChurchDeletionImpact): string | null {
    const parts = [
        impact.church_admins > 0 && plural(impact.church_admins, 'Church Admin', 'Church Admins'),
        impact.priests > 0 && plural(impact.priests, 'priest', 'priests'),
        impact.volunteers > 0 && plural(impact.volunteers, 'volunteer', 'volunteers'),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
}

/**
 * DeleteChurchModal - confirmation for the Super Admin deleting a church. Shows what is removed (real counts) and what
 * happens to the church's people, requires typing the exact church name, then deletes after a 5 second countdown the
 * Super Admin can cancel. Calls public.delete_church.
 */
export default function DeleteChurchModal({ churchId, churchName, onClose, onDeleted }: DeleteChurchModalProps) {
    const [impact, setImpact] = useState<ChurchDeletionImpact | null>(null);
    const [confirmationName, setConfirmationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getChurchDeletionImpact(churchId)
            .then((result) => {
                if (!cancelled) setImpact(result);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load what deleting this church removes');
            });
        return () => {
            cancelled = true;
        };
    }, [churchId]);

    const isConfirmed = confirmationName.trim().toLowerCase() === churchName.trim().toLowerCase();

    const runDelete = async () => {
        try {
            setLoading(true);
            setError(null);
            await deleteChurch(churchId);
            onDeleted();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete the church.');
            setLoading(false);
        }
    };

    const countdown = useCountdown(COUNTDOWN_SECONDS, () => void runDelete());

    // Nothing is deleted until the countdown ends; Cancel (or closing the modal) aborts it.
    const handleDelete = (e: React.FormEvent) => {
        e.preventDefault();
        if (!impact) return;
        if (!isConfirmed) {
            setError("Please type the church's exact name to confirm.");
            return;
        }
        setError(null);
        countdown.start();
    };

    const people = impact ? peopleSummary(impact) : null;

    return (
        <Modal
            isOpen
            onClose={loading ? () => {} : () => { countdown.cancel(); onClose(); }}
            title={
                <div className="flex items-center gap-2 text-red-600 min-w-0 flex-1">
                    <Trash2 className="w-6 h-6 shrink-0" />
                    <span className="text-base sm:text-lg font-bold break-words min-w-0">Delete church</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <span>This cannot be undone</span>
                    </div>
                    {impact ? (
                        <ul className="text-xs text-red-700/90 space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                            <li>
                                <strong>Permanently deleted:</strong> {plural(impact.appointments, 'appointment', 'appointments')},{' '}
                                {plural(impact.donations, 'donation record', 'donation records')}
                                {impact.donations > 0 && <> (₱{Number(impact.donation_total).toLocaleString()} in total)</>},{' '}
                                {plural(impact.mass_schedules, 'mass schedule', 'mass schedules')},{' '}
                                {plural(impact.announcements, 'announcement', 'announcements')} and {plural(impact.images, 'gallery image', 'gallery images')},
                                plus the parish staff channel and AI knowledge files.
                            </li>
                            <li>
                                <strong>Its people become Parishioners.</strong>{' '}
                                {people ? <>{people} will lose their staff role and will no longer be assigned to a church.</> : 'No staff are assigned to this church.'}{' '}
                                Their accounts are kept, and they can be assigned to another church later.
                            </li>
                            {impact.conversations_kept > 0 && (
                                <li>
                                    {plural(impact.conversations_kept, 'conversation', 'conversations')} with parishioners keep their messages but are no longer linked to this church.
                                </li>
                            )}
                            <li>Consider setting the church to <strong>Inactive</strong> instead. That hides it and keeps every record.</li>
                        </ul>
                    ) : error ? (
                        <p className="text-xs text-red-700">{error}</p>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-red-700/90">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Checking what will be removed...</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-secondary-50 rounded-2xl border border-border">
                    <p className="text-sm font-bold text-foreground break-words">{churchName}</p>
                </div>

                <form onSubmit={handleDelete} className="space-y-4">
                    <div>
                        <label htmlFor="delete-church-confirm" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                            Confirmation
                        </label>
                        <p className="text-xs text-muted mb-2">
                            To confirm, type the church name{' '}
                            <code className="px-1.5 py-0.5 bg-secondary-100 text-foreground font-mono rounded font-semibold text-xs select-all break-words">{churchName}</code>{' '}
                            below:
                        </p>
                        <div className="relative">
                            <input
                                id="delete-church-confirm"
                                type="text"
                                placeholder="Enter the church name"
                                value={confirmationName}
                                onChange={(e) => setConfirmationName(e.target.value)}
                                disabled={loading || countdown.counting || !impact}
                                className={`input w-full text-sm font-medium ${isConfirmed ? 'border-emerald-500' : 'border-border'}`}
                                autoFocus
                            />
                            {isConfirmed && (
                                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                            )}
                        </div>
                    </div>

                    {error && impact && (
                        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-xs text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {countdown.remaining !== null ? (
                        <CountdownPanel
                            label={`Deleting ${churchName}`}
                            remaining={countdown.remaining}
                            total={COUNTDOWN_SECONDS}
                            onCancel={countdown.cancel}
                        />
                    ) : (
                        <div className="flex items-center gap-3 pt-4 border-t border-border">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-100 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!impact || !isConfirmed || loading}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete church</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </Modal>
    );
}

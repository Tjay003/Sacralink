import { useState } from 'react';
import Modal from '../ui/Modal';
import CountdownPanel from '../common/CountdownPanel';
import { useCountdown } from '../../hooks/useCountdown';
import { deleteUserAccount } from '../../lib/supabase/profiles';
import type { Profile } from '../../types/database';
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

interface DeleteUserModalProps {
    user: Pick<Profile, 'id' | 'full_name' | 'email'>;
    /** True when the person is the only Church Admin of their church (the church is left without an admin). */
    isLastChurchAdmin: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** Replaces the default delete call, e.g. deleting from a deletion-request ticket. Throws an Error to show its message. */
    onConfirm?: () => Promise<void>;
}

const COUNTDOWN_SECONDS = 5;

/**
 * DeleteUserModal - confirmation for the Super Admin deleting a user.
 * Moves the user to a 7-day Archive window where they can be restored before
 * automatic permanent deletion.
 * Requires typing the user's exact email. Calls public.delete_user_account after a 5 second countdown.
 */
export default function DeleteUserModal({ user, isLastChurchAdmin, onClose, onSuccess, onConfirm }: DeleteUserModalProps) {
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const targetEmail = (user.email || '').trim().toLowerCase();
    const isConfirmed = targetEmail.length > 0 && confirmationEmail.trim().toLowerCase() === targetEmail;

    const runDelete = async () => {
        try {
            setLoading(true);
            setError(null);
            await (onConfirm ? onConfirm() : deleteUserAccount(user.id));
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete the user.');
            setLoading(false);
        }
    };

    const countdown = useCountdown(COUNTDOWN_SECONDS, () => void runDelete());

    // Nothing is deleted until the countdown ends; Cancel (or closing the modal) aborts it.
    const handleDelete = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLastChurchAdmin) {
            setError('Cannot delete the only Church Admin of an active church. Promote another Church Admin first.');
            return;
        }
        if (!isConfirmed) {
            setError("Please type the user's exact email address to confirm.");
            return;
        }
        setError(null);
        countdown.start();
    };

    return (
        <Modal
            isOpen
            onClose={loading ? () => {} : () => { countdown.cancel(); onClose(); }}
            title={
                <div className="flex items-center gap-2 text-red-600 min-w-0 flex-1">
                    <Trash2 className="w-6 h-6 shrink-0" />
                    <span className="text-base sm:text-lg font-bold break-words min-w-0">Delete user</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <span>7-Day Archive Window</span>
                    </div>
                    <ul className="text-xs text-amber-900/90 space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                        <li>The account will be moved to the <strong>Archived</strong> tab for <strong>7 days</strong>, where it can be restored before permanent deletion.</li>
                        <li>Their <strong>name, email, and history are preserved</strong> during the 7-day archive window.</li>
                        <li>They are signed out immediately and <strong>login access is blocked</strong> while archived.</li>
                        <li>Any staff roles are reset to Parishioner (<code>user</code>) and pending requests are cancelled.</li>
                        <li>After <strong>7 days</strong>, any unrestored account is automatically and permanently deleted.</li>
                        {isLastChurchAdmin && (
                            <li className="text-red-700 font-semibold">
                                <strong>Cannot delete:</strong> This user is the only Church Admin of their active parish. Name a successor Church Admin before deleting this account.
                            </li>
                        )}
                    </ul>
                </div>

                <div className="p-4 bg-secondary-50 rounded-2xl border border-border">
                    <p className="text-sm font-bold text-foreground truncate">{user.full_name || 'No name set'}</p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                </div>

                <form onSubmit={handleDelete} className="space-y-4">
                    <div>
                        <label htmlFor="delete-user-confirm" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                            Confirmation
                        </label>
                        <p className="text-xs text-muted mb-2">
                            To confirm, type the email address{' '}
                            <code className="px-1.5 py-0.5 bg-secondary-100 text-foreground font-mono rounded font-semibold text-xs select-all">{user.email}</code>{' '}
                            below:
                        </p>
                        <div className="relative">
                            <input
                                id="delete-user-confirm"
                                type="text"
                                placeholder={`Enter ${user.email}`}
                                value={confirmationEmail}
                                onChange={(e) => setConfirmationEmail(e.target.value)}
                                disabled={loading || countdown.counting || isLastChurchAdmin}
                                className={`input w-full text-sm font-medium ${isConfirmed ? 'border-emerald-500' : 'border-border'}`}
                                autoFocus
                            />
                            {isConfirmed && (
                                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                            )}
                        </div>
                    </div>

                    {error && (
                        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-xs text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {countdown.remaining !== null ? (
                        <CountdownPanel
                            label={`Deleting ${user.full_name || user.email || 'this user'}`}
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
                                disabled={!isConfirmed || loading || isLastChurchAdmin}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete user</span>
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

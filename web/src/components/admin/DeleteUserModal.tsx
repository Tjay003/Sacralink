import { useState } from 'react';
import Modal from '../ui/Modal';
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

/**
 * DeleteUserModal - confirmation for the Super Admin deleting a user (anonymize in place).
 * Requires typing the user's exact email, like TransferOwnershipModal. Calls public.delete_user_account.
 */
export default function DeleteUserModal({ user, isLastChurchAdmin, onClose, onSuccess, onConfirm }: DeleteUserModalProps) {
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const targetEmail = (user.email || '').trim().toLowerCase();
    const isConfirmed = targetEmail.length > 0 && confirmationEmail.trim().toLowerCase() === targetEmail;

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConfirmed) {
            setError("Please type the user's exact email address to confirm.");
            return;
        }
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

    return (
        <Modal
            isOpen
            onClose={loading ? () => {} : onClose}
            title={
                <div className="flex items-center gap-2 text-red-600 min-w-0 flex-1">
                    <Trash2 className="w-6 h-6 shrink-0" />
                    <span className="text-base sm:text-lg font-bold break-words min-w-0">Delete user</span>
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
                    <ul className="text-xs text-red-700/90 space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                        <li>Their appointments, donations and messages are kept and shown as <strong>Deleted User</strong>.</li>
                        <li>They are signed out at once and <strong>cannot sign in</strong> again. Their email can register as a new account.</li>
                        <li>Their <strong>pending requests are cancelled</strong> and their open tickets are closed.</li>
                        <li>Their name, email, phone, photo and notifications are removed.</li>
                        {isLastChurchAdmin && (
                            <li>
                                <strong>They are the only Church Admin of their church.</strong> The church will be without an admin until you assign one.
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
                                disabled={loading}
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
                            disabled={!isConfirmed || loading}
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
                                    <span>Delete user</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

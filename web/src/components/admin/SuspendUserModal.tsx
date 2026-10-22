import { useState } from 'react';
import Modal from '../ui/Modal';
import { suspendUser } from '../../lib/supabase/profiles';
import type { Profile } from '../../types/database';
import { Ban, Loader2 } from 'lucide-react';

interface SuspendUserModalProps {
    user: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

const MIN_REASON_LENGTH = 10;

/**
 * SuspendUserModal - confirmation for the Super Admin suspending a user (reversible). Asks for a reason of at
 * least 10 characters and calls public.suspend_user.
 */
export default function SuspendUserModal({ user, onClose, onSuccess }: SuspendUserModalProps) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValid = reason.trim().length >= MIN_REASON_LENGTH;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) {
            setError(`Give a reason of at least ${MIN_REASON_LENGTH} characters.`);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            await suspendUser(user.id, reason.trim());
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to suspend the user.');
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={loading ? () => {} : onClose}
            title={
                <div className="flex items-center gap-2 text-amber-700 min-w-0 flex-1">
                    <Ban className="w-6 h-6 shrink-0" />
                    <span className="text-base sm:text-lg font-bold break-words min-w-0">Suspend user</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                    <p className="text-amber-800 font-bold text-sm">This can be undone</p>
                    <ul className="text-xs text-amber-800/90 space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                        <li>They are signed out at once and <strong>cannot sign in</strong> or use the app until you reactivate them.</li>
                        <li>Their role, church, appointments, donations, messages and email are <strong>kept</strong>.</li>
                        <li>Nobody can send them a direct message while they are suspended.</li>
                    </ul>
                </div>

                <div className="p-4 bg-secondary-50 rounded-2xl border border-border">
                    <p className="text-sm font-bold text-foreground truncate">{user.full_name || 'No name set'}</p>
                    <p className="text-xs text-muted truncate">{user.email}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="suspend-user-reason" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                            Reason
                        </label>
                        <textarea
                            id="suspend-user-reason"
                            rows={3}
                            placeholder="Why is this account being suspended? (at least 10 characters)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={loading}
                            className="input w-full text-sm font-medium"
                            autoFocus
                        />
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
                            disabled={!isValid || loading}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Suspending...</span>
                                </>
                            ) : (
                                <>
                                    <Ban className="w-4 h-4" />
                                    <span>Suspend user</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

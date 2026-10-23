import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import CountdownPanel from '../common/CountdownPanel';
import { useCountdown } from '../../hooks/useCountdown';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

const COUNTDOWN_SECONDS = 5;

interface DeleteMyAccountSectionProps {
    /** The signed-in person's email, typed back to confirm. */
    email: string;
}

interface DeleteCheck {
    can_delete: boolean;
    code: string | null;
    message: string | null;
}

/**
 * DeleteMyAccountSection - the "Delete my account" card at the bottom of the profile page, plus its confirmation modal.
 * Blocked cases (last Church Admin, Priest with upcoming appointments) are explained inline using can_delete_own_account().
 * The Super Admin never sees this section. On success the person is signed out and sent to /login.
 */
export default function DeleteMyAccountSection({ email }: DeleteMyAccountSectionProps) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [check, setCheck] = useState<DeleteCheck | null>(null);
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error: rpcError } = await supabase.rpc('can_delete_own_account');
            if (!cancelled && !rpcError) setCheck(data as unknown as DeleteCheck);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const target = email.trim().toLowerCase();
    const isConfirmed = target.length > 0 && confirmation.trim().toLowerCase() === target;
    const blocked = check && !check.can_delete ? check : null;

    const runDelete = async () => {
        setLoading(true);
        setError(null);
        const { error: rpcError } = await supabase.rpc('delete_own_account');
        if (rpcError) {
            setError(rpcError.message || 'Failed to delete your account.');
            setLoading(false);
            return;
        }
        // The server already ended every session, so a failing sign out is expected and harmless.
        try {
            await signOut();
        } catch {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        }
        navigate('/login', { replace: true });
    };

    const countdown = useCountdown(COUNTDOWN_SECONDS, () => void runDelete());

    const close = () => {
        countdown.cancel();
        setOpen(false);
        setConfirmation('');
        setError(null);
    };

    // Nothing is deleted until the countdown ends; Cancel (or closing the modal) aborts it.
    const handleDelete = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConfirmed) {
            setError('Please type your exact email address to confirm.');
            return;
        }
        setError(null);
        countdown.start();
    };

    return (
        <>
            <div className="card p-6 border border-red-200">
                <h2 className="text-lg font-semibold text-red-700 mb-2">Delete my account</h2>
                <p className="text-sm text-muted mb-4">
                    Permanently delete your account. You are signed out at once and cannot sign in again.
                </p>
                {blocked && (
                    <div role="alert" className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        {blocked.message}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={Boolean(blocked)}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                    Delete my account
                </button>
            </div>

            {open && (
                <Modal
                    isOpen
                    onClose={loading ? () => {} : close}
                    title={
                        <div className="flex items-center gap-2 text-red-600 min-w-0 flex-1">
                            <Trash2 className="w-6 h-6 shrink-0" />
                            <span className="text-base sm:text-lg font-bold break-words min-w-0">Delete my account</span>
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
                                <li>You are <strong>signed out immediately</strong> and cannot sign in again.</li>
                                <li>Your appointments, donations and messages are kept and shown as <strong>Deleted User</strong>.</li>
                                <li>Your pending requests are cancelled and your open tickets are closed.</li>
                                <li>Your name, email, phone, photo and notifications are removed.</li>
                            </ul>
                        </div>

                        <form onSubmit={handleDelete} className="space-y-4">
                            <div>
                                <label htmlFor="delete-my-account-confirm" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                                    Confirmation
                                </label>
                                <p className="text-xs text-muted mb-2">
                                    To confirm, type your email address{' '}
                                    <code className="px-1.5 py-0.5 bg-secondary-100 text-foreground font-mono rounded font-semibold text-xs select-all">{email}</code>{' '}
                                    below:
                                </p>
                                <div className="relative">
                                    <input
                                        id="delete-my-account-confirm"
                                        type="text"
                                        placeholder={`Enter ${email}`}
                                        value={confirmation}
                                        onChange={(e) => setConfirmation(e.target.value)}
                                        disabled={loading || countdown.counting}
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
                                    label="Deleting your account"
                                    remaining={countdown.remaining}
                                    total={COUNTDOWN_SECONDS}
                                    onCancel={countdown.cancel}
                                />
                            ) : (
                                <div className="flex items-center gap-3 pt-4 border-t border-border">
                                    <button
                                        type="button"
                                        onClick={close}
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
                                                <span>Delete my account</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </Modal>
            )}
        </>
    );
}

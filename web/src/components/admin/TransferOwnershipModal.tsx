import { useState } from 'react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../types/database';
import { 
    AlertTriangle, 
    Crown, 
    ShieldAlert, 
    ArrowRightLeft, 
    CheckCircle2, 
    Loader2 
} from 'lucide-react';

interface TransferOwnershipModalProps {
    isOpen: boolean;
    user: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * TransferOwnershipModal - High-security modal for transferring platform ownership (Super Admin)
 * 
 * Invariants & Security Rules:
 * - Only the current Super Admin can trigger this transfer.
 * - Requires exact email confirmation input to prevent accidental transfers.
 * - Invokes PostgreSQL RPC public.transfer_super_admin(target_user_id) atomically.
 * - Automatically updates the auth profile state on success.
 */
export default function TransferOwnershipModal({
    isOpen,
    user,
    onClose,
    onSuccess,
}: TransferOwnershipModalProps) {
    const { refreshProfile } = useAuth();
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const targetEmail = (user.email || '').trim().toLowerCase();
    const isConfirmed = confirmationEmail.trim().toLowerCase() === targetEmail && targetEmail.length > 0;

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConfirmed) {
            setError('Please type the exact email address of the recipient to confirm.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data, error: rpcError } = await supabase.rpc('transfer_super_admin', {
                target_user_id: user.id,
            });

            if (rpcError) {
                setError(rpcError.message || 'Failed to transfer ownership.');
                setLoading(false);
                return;
            }

            const response = data as { success?: boolean; error?: string } | null;
            if (response && response.success === false) {
                setError(response.error || 'Failed to transfer ownership.');
                setLoading(false);
                return;
            }

            // Successfully transferred! Refresh profile and trigger success callback
            await refreshProfile();
            onSuccess();
        } catch (err: unknown) {
            console.error('Transfer ownership exception:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during transfer.';
            setError(errorMessage);
            setLoading(false);
        }
    };

    const formatRole = (role?: string | null) => {
        if (!role) return 'Parishioner / User';
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? () => {} : onClose}
            title={
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                    <span>Transfer Platform Ownership</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
                {/* Critical Warning Alert Box */}
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <span>Warning: This action is permanent and irreversible</span>
                    </div>
                    <ul className="text-xs text-red-700/90 dark:text-red-300/90 space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                        <li>
                            You will transfer the <strong>sole Super Admin (Platform Owner)</strong> role to the selected user.
                        </li>
                        <li>
                            Your account will be demoted to <strong>Diocese Admin (admin)</strong> immediately.
                        </li>
                        <li>
                            You will surrender ultimate ownership privileges and cannot undo this action yourself.
                        </li>
                    </ul>
                </div>

                {/* Recipient Details Card */}
                <div className="p-4 bg-secondary-50 dark:bg-secondary-900/50 rounded-2xl border border-border space-y-3">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Designated Successor
                    </p>
                    <div className="flex items-center gap-3.5">
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.full_name || 'User'}
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
                                {user.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-foreground truncate">
                                {user.full_name || 'No name set'}
                            </p>
                            <p className="text-xs text-muted truncate">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary-200/70 dark:bg-secondary-800 text-muted font-medium">
                                    Current: {formatRole(user.role)}
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                                    <Crown className="w-3 h-3" /> New: Platform Owner
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Confirmation Form */}
                <form onSubmit={handleTransfer} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                            Confirmation Verification
                        </label>
                        <p className="text-xs text-muted mb-2">
                            To confirm transfer, please type the recipient's email address{' '}
                            <code className="px-1.5 py-0.5 bg-secondary-100 dark:bg-secondary-800 text-foreground font-mono rounded font-semibold text-xs select-all">
                                {user.email}
                            </code>{' '}
                            below:
                        </p>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={`Enter ${user.email}`}
                                value={confirmationEmail}
                                onChange={(e) => setConfirmationEmail(e.target.value)}
                                disabled={loading}
                                className={`input w-full text-sm font-medium ${
                                    isConfirmed 
                                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20' 
                                        : 'border-border'
                                }`}
                                autoFocus
                            />
                            {isConfirmed && (
                                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white dark:bg-secondary-800 hover:bg-secondary-100 dark:hover:bg-secondary-700 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isConfirmed || loading}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Transferring Ownership...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="w-4 h-4" />
                                    <span>Confirm & Transfer Ownership</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

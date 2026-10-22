import { useState } from 'react';
import Modal from '../ui/Modal';
import { ShieldAlert } from 'lucide-react';
import type { Profile } from '../../types/database';
import { setUserRole } from '../../lib/supabase/profiles';
import { demotionMessage } from '../../lib/roleEditing';

interface DemoteConfirmModalProps {
    user: Profile;
    churchName: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

/** Confirms and performs "Demote to Parishioner": the person keeps their church but loses staff access. */
export default function DemoteConfirmModal({ user, churchName, onClose, onSuccess }: DemoteConfirmModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const name = user.full_name || user.email || 'This person';

    const handleConfirm = async () => {
        setLoading(true);
        setError('');
        try {
            await setUserRole(user.id, 'user', user.assigned_church_id ?? null, false);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to demote this user');
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={loading ? () => undefined : onClose} title="Demote to Parishioner" size="sm">
            <p data-testid="demote-confirmation" className="text-sm text-foreground leading-relaxed">
                {demotionMessage(name, churchName)}
            </p>
            {error && (
                <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                </div>
            )}
            <div className="flex gap-3 pt-4 mt-4 border-t border-border">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-100 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-destructive hover:opacity-90 text-white font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                >
                    {loading ? 'Demoting...' : 'Demote to Parishioner'}
                </button>
            </div>
        </Modal>
    );
}

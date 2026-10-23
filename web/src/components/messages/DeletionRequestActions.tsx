import { useState } from 'react';
import { Ban, RotateCcw, Trash2, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import DeleteUserModal from '../admin/DeleteUserModal';
import SuspendUserModal from '../admin/SuspendUserModal';
import { supabase } from '../../lib/supabase';
import { reactivateUser, type UserReviewSummary } from '../../lib/supabase/profiles';
import { ticketRequestDecline, ticketRequestDelete, ticketRequestSuspend } from '../../lib/supabase/messaging';
import { TICKET_NOTE_MIN_LENGTH } from '../../lib/tickets';
import { useToast, type SuccessDialogOptions } from '../../contexts/toastContext';

interface DeletionRequestActionsProps {
    ticketId: string;
    ticketStatus: string | null | undefined;
    summary: UserReviewSummary;
    /** Called after the database accepted a decision, so the ticket and the review panel reload. */
    onChanged: () => void | Promise<void>;
}

type ModalKind = 'delete' | 'suspend' | 'decline' | null;

/**
 * The Super Admin decision buttons on a user deletion request: Delete user, Suspend and Decline request, plus
 * Reactivate while the subject is suspended. Each calls one database function that changes the ticket and the
 * account together; this component only decides what to show.
 */
export default function DeletionRequestActions({ ticketId, ticketStatus, summary, onChanged }: DeletionRequestActionsProps) {
    const toast = useToast();
    const [modal, setModal] = useState<ModalKind>(null);
    const [lastAdmin, setLastAdmin] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const closed = ticketStatus === 'closed';
    const deleted = Boolean(summary.deleted_at);
    const suspended = Boolean(summary.suspended_at);
    const subject = { id: summary.user_id, full_name: summary.full_name, email: summary.email };

    if (closed) return null;

    const openDelete = async () => {
        setError(null);
        let only = false;
        if (summary.role === 'church_admin' && summary.church_id) {
            const { count } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'church_admin')
                .eq('assigned_church_id', summary.church_id)
                .is('deleted_at', null)
                .neq('id', summary.user_id);
            only = (count ?? 0) === 0;
        }
        setLastAdmin(only);
        setModal('delete');
    };

    const subjectName = summary.full_name || summary.email || 'The user';

    const finish = async (result: SuccessDialogOptions) => {
        setModal(null);
        setNote('');
        toast.showSuccess(result);
        await onChanged();
    };

    const run = async (action: () => Promise<{ error: Error | null }>) => {
        const { error: failure } = await action();
        if (failure) throw failure;
    };

    const decline = async () => {
        setBusy(true);
        setError(null);
        const { error: failure } = await ticketRequestDecline(ticketId, note.trim());
        setBusy(false);
        if (failure) {
            setError(failure.message);
            toast.error(failure.message);
            return;
        }
        await finish({
            title: 'Request declined',
            message: 'The deletion request was declined and the Church Admin has been told.',
            tone: 'warning',
        });
    };

    const reactivate = async () => {
        setBusy(true);
        setError(null);
        try {
            await reactivateUser(summary.user_id);
            toast.showSuccess({
                title: 'User reactivated',
                message: `${subjectName} can sign in again with their previous role.`,
                tone: 'success',
            });
            await onChanged();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to reactivate the user.';
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const buttonClass =
        'px-3 py-2 min-h-10 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50';

    return (
        <div className="space-y-2 pt-3 border-t border-border/80" data-testid="deletion-request-actions">
            <p className="font-semibold text-secondary-700 text-xs">Decide on this request</p>
            <div className="flex flex-wrap gap-2">
                {!deleted && (
                    <button
                        type="button"
                        onClick={openDelete}
                        disabled={busy}
                        data-testid="deletion-request-delete"
                        className={`${buttonClass} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete user
                    </button>
                )}
                {!deleted && !suspended && (
                    <button
                        type="button"
                        onClick={() => setModal('suspend')}
                        disabled={busy}
                        data-testid="deletion-request-suspend"
                        className={`${buttonClass} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                    >
                        <Ban className="w-3.5 h-3.5" />
                        Suspend
                    </button>
                )}
                {!deleted && suspended && (
                    <button
                        type="button"
                        onClick={reactivate}
                        disabled={busy}
                        data-testid="deletion-request-reactivate"
                        className={`${buttonClass} border-border bg-white text-secondary-800 hover:bg-secondary-50`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reactivate
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setModal('decline');
                    }}
                    disabled={busy}
                    data-testid="deletion-request-decline"
                    className={`${buttonClass} border-border bg-white text-secondary-800 hover:bg-secondary-50`}
                >
                    <XCircle className="w-3.5 h-3.5" />
                    Decline request
                </button>
            </div>
            {error && modal === null && <p className="text-xs text-destructive">{error}</p>}

            {modal === 'delete' && (
                <DeleteUserModal
                    user={subject}
                    isLastChurchAdmin={lastAdmin}
                    onClose={() => setModal(null)}
                    onSuccess={() =>
                        finish({
                            title: 'User deleted',
                            message: `${subjectName} can no longer sign in. Their history is kept as Deleted User. The deletion request is closed.`,
                            tone: 'danger',
                        })
                    }
                    onConfirm={() => run(() => ticketRequestDelete(ticketId))}
                />
            )}
            {modal === 'suspend' && (
                <SuspendUserModal
                    user={subject}
                    onClose={() => setModal(null)}
                    onSuccess={() =>
                        finish({
                            title: 'User suspended',
                            message: `${subjectName} was signed out and cannot sign in until reactivated. The deletion request is closed.`,
                            tone: 'warning',
                        })
                    }
                    onConfirm={(reason) => run(() => ticketRequestSuspend(ticketId, reason))}
                />
            )}
            <Modal isOpen={modal === 'decline'} onClose={() => (busy ? undefined : setModal(null))} title="Decline request" size="md">
                <div className="space-y-4" data-testid="deletion-request-decline-modal">
                    {suspended && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            This user is still suspended. Declining the request does not reactivate them; use Reactivate if they should sign in again.
                        </div>
                    )}
                    <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-foreground">Note to the Church Admin</span>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={4}
                            placeholder="Why is this request declined?"
                            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="block text-[11px] text-secondary-500">At least {TICKET_NOTE_MIN_LENGTH} characters.</span>
                    </label>
                    {error && modal === 'decline' && (
                        <div role="alert" className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setModal(null)}
                            disabled={busy}
                            className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-secondary-700 hover:bg-secondary-50 cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={decline}
                            disabled={busy || note.trim().length < TICKET_NOTE_MIN_LENGTH}
                            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                            {busy ? 'Working...' : 'Decline request'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

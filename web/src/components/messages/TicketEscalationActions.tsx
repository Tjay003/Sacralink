import { useState } from 'react';
import { ArrowUpRight, Undo2, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../contexts/toastContext';
import { escalateTicket, sendBackTicket } from '../../lib/supabase/messaging';
import {
    TICKET_NOTE_MIN_LENGTH,
    canEscalateTicket,
    canSendBackTicket,
    type TicketLike,
    type TicketViewer,
} from '../../lib/tickets';

interface TicketEscalationActionsProps {
    conversation: TicketLike & { category?: string | null };
    viewer: TicketViewer;
    /** Role of the person who opened the ticket; decides whether a platform ticket can be sent back. */
    requesterRole: string | null | undefined;
    /** Called after the database accepted the change, so the list and thread reload. */
    onChanged: () => void | Promise<void>;
}

type ActionKind = 'escalate' | 'send_back';

const COPY: Record<
    ActionKind,
    { title: string; label: string; field: string; placeholder: string; warning: string; submit: string }
> = {
    escalate: {
        title: 'Escalate to Super Admin',
        label: 'Escalate to Super Admin',
        field: 'Reason',
        placeholder: 'Why can the church not solve this?',
        warning:
            'Once you escalate, you will no longer see this ticket. You see it again only if the Super Admin sends it back.',
        submit: 'Escalate ticket',
    },
    send_back: {
        title: 'Send back to church',
        label: 'Send back to church',
        field: 'Note to the church',
        placeholder: 'What should the Church Admin do with this ticket?',
        warning: 'The Church Admin of the church will see this ticket and your note, and you will no longer see it.',
        submit: 'Send back ticket',
    },
};

/**
 * Header controls for moving a ticket between the church and the Super Admin: Escalate (Church Admin or assignee),
 * Send back (Super Admin) and the "Sent back" badge. The database owns every rule; this only decides what to show.
 */
export default function TicketEscalationActions({
    conversation,
    viewer,
    requesterRole,
    onChanged,
}: TicketEscalationActionsProps) {
    const toast = useToast();
    const [open, setOpen] = useState<ActionKind | null>(null);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const showEscalate = canEscalateTicket(conversation, viewer);
    const showSendBack = canSendBackTicket(conversation, viewer, requesterRole);
    const sentBack = Boolean(conversation.sent_back_at) && !conversation.escalated_at;

    const close = () => {
        if (submitting) return;
        setOpen(null);
        setText('');
        setError(null);
    };

    const submit = async () => {
        if (!open || !conversation.id || submitting) return;
        setSubmitting(true);
        setError(null);
        const { error: failure } =
            open === 'escalate'
                ? await escalateTicket(conversation.id, text.trim())
                : await sendBackTicket(conversation.id, text.trim());
        setSubmitting(false);
        if (failure) {
            setError(failure.message);
            toast.error(failure.message);
            return;
        }
        toast.success(open === 'escalate' ? 'Ticket escalated to the Super Admin.' : 'Ticket sent back to the church.');
        setOpen(null);
        setText('');
        await onChanged();
    };

    const copy = open ? COPY[open] : null;
    const tooShort = text.trim().length < TICKET_NOTE_MIN_LENGTH;

    return (
        <>
            {sentBack && (
                <span
                    data-testid="ticket-sent-back-badge"
                    className="text-[10px] font-semibold px-2 py-1 rounded-md border bg-amber-50 text-amber-700 border-amber-200"
                >
                    Sent back by the Super Admin
                </span>
            )}
            {showEscalate && (
                <button
                    type="button"
                    onClick={() => setOpen('escalate')}
                    data-testid="ticket-escalate-button"
                    title={COPY.escalate.label}
                    className="px-3 py-2 min-h-10 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span className="sr-only sm:not-sr-only">Escalate</span>
                </button>
            )}
            {showSendBack && (
                <button
                    type="button"
                    onClick={() => setOpen('send_back')}
                    data-testid="ticket-send-back-button"
                    title={COPY.send_back.label}
                    className="px-3 py-2 min-h-10 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="sr-only sm:not-sr-only">Send back</span>
                </button>
            )}

            <Modal isOpen={open !== null} onClose={close} title={copy?.title} size="md">
                {copy && (
                    <div className="space-y-4" data-testid="ticket-escalation-modal">
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{copy.warning}</span>
                        </div>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-foreground">{copy.field}</span>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                rows={4}
                                placeholder={copy.placeholder}
                                data-testid="ticket-escalation-text"
                                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <span className="block text-[11px] text-secondary-500">
                                At least {TICKET_NOTE_MIN_LENGTH} characters.
                            </span>
                        </label>
                        {error && (
                            <div
                                role="alert"
                                data-testid="ticket-escalation-error"
                                className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                            >
                                {error}
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={close}
                                disabled={submitting}
                                className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-secondary-700 hover:bg-secondary-50 cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={submitting || tooShort}
                                data-testid="ticket-escalation-submit"
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? 'Working...' : copy.submit}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

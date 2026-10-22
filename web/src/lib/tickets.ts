/**
 * Ticket rules the Messages screen needs to decide what to render.
 *
 * The database is the authority (RLS plus is_ticket_handler, migration 067): these helpers only mirror it from
 * fields already on the conversation row, so the UI never shows a control the database would refuse.
 */

/** The fields of a conversation row the ticket rules read. */
export interface TicketLike {
    id?: string;
    ticket_number?: string | null;
    ticket_lane?: string | null;
    escalated_at?: string | null;
    assigned_to?: string | null;
    church_id?: string | null;
    created_by?: string | null;
    status?: string | null;
    sent_back_at?: string | null;
}

/** The signed-in person, reduced to what the rules need. */
export interface TicketViewer {
    id?: string | null;
    role?: string | null;
    church_id?: string | null;
    assigned_church_id?: string | null;
}

/** A ticket is a conversation that carries a ticket number; everything else is a chat, channel or ministry group. */
export function isTicket(conv: Pick<TicketLike, 'ticket_number'> | null | undefined): boolean {
    return Boolean(conv?.ticket_number);
}

function viewerBelongsToChurch(viewer: TicketViewer, churchId?: string | null): boolean {
    if (!churchId) return false;
    return viewer.church_id === churchId || viewer.assigned_church_id === churchId;
}

/** Mirrors is_ticket_handler(): who works the ticket and may change its status. */
export function canHandleTicket(conv: TicketLike | null | undefined, viewer: TicketViewer | null | undefined): boolean {
    if (!conv || !viewer || !isTicket(conv)) return false;
    const lane = conv.ticket_lane || 'church';
    const escalated = Boolean(conv.escalated_at);

    switch (viewer.role) {
        case 'super_admin':
            return lane === 'platform' || escalated;
        case 'church_admin':
            return lane === 'church' && !escalated && viewerBelongsToChurch(viewer, conv.church_id);
        case 'priest':
        case 'volunteer':
            return (
                lane === 'church' &&
                !escalated &&
                Boolean(viewer.id) &&
                conv.assigned_to === viewer.id &&
                viewerBelongsToChurch(viewer, conv.church_id)
            );
        default:
            return false;
    }
}

/** Mirrors the ticket branch of can_access_conversation(): the requester or a handler. */
export function canViewTicket(conv: TicketLike | null | undefined, viewer: TicketViewer | null | undefined): boolean {
    if (!conv || !viewer || !isTicket(conv)) return false;
    return (Boolean(viewer.id) && conv.created_by === viewer.id) || canHandleTicket(conv, viewer);
}

/** Whether the viewer opened the ticket. */
export function isTicketRequester(conv: TicketLike | null | undefined, viewer: TicketViewer | null | undefined): boolean {
    return Boolean(conv && viewer?.id && conv.created_by === viewer.id);
}

/** Header and info-panel label for the desk a ticket sits with. */
export function ticketLaneLabel(conv: TicketLike | null | undefined): string | null {
    if (!conv || !isTicket(conv)) return null;
    if (conv.escalated_at) return 'Escalated to Super Admin';
    return conv.ticket_lane === 'platform' ? 'Super Admin' : 'Parish office';
}

/** The requester may ask the Super Admin to review a church ticket after this many days without a handler reply. */
export const REVIEW_REQUEST_AFTER_DAYS = 7;

/**
 * Whether to offer "Ask the Super Admin to review". The database decides eligibility; this only decides when to show
 * the button: the requester's unescalated, never-sent-back church ticket, not closed, at least 7 days old, whose thread
 * holds no message from anyone but the requester (system notes do not count).
 */
export function shouldOfferReviewRequest(
    conv: TicketLike & { created_at?: string | null },
    viewer: TicketViewer | null | undefined,
    messages: Array<{ sender_id?: string | null; message_type?: string | null }>,
    now: Date = new Date()
): boolean {
    if (!isTicket(conv) || !isTicketRequester(conv, viewer)) return false;
    if ((conv.ticket_lane || 'church') !== 'church') return false;
    if (conv.escalated_at || conv.sent_back_at || conv.status === 'closed') return false;
    if (!conv.created_at) return false;
    const ageMs = now.getTime() - new Date(conv.created_at).getTime();
    if (ageMs < REVIEW_REQUEST_AFTER_DAYS * 24 * 60 * 60 * 1000) return false;
    const handlerReplied = messages.some(
        (m) => m.message_type !== 'system' && m.sender_id && m.sender_id !== conv.created_by
    );
    return !handlerReplied;
}

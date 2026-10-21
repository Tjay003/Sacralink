/** The slice of an appointment the "Requested priest" note depends on. */
export interface RequestedPriestSource {
    requested_priest_id?: string | null;
    requested_priest?: { full_name: string | null } | null;
}

/**
 * The priest the parishioner asked for at booking, as people read it, e.g. "Fr. Juan Dela Cruz".
 * Returns null when the appointment carries no request. The request is a preference only; the
 * assigned celebrant is a separate field and may be someone else.
 */
export function getRequestedPriestLabel(appointment: RequestedPriestSource): string | null {
    if (!appointment.requested_priest_id) return null;
    const name = appointment.requested_priest?.full_name?.trim();
    if (!name) return 'a specific priest';
    const lower = name.toLowerCase();
    return lower.startsWith('fr.') || lower.startsWith('father ') ? name : `Fr. ${name}`;
}

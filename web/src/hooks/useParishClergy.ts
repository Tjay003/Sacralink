import { useEffect, useMemo, useState } from 'react';
import { getParishClergy, type ParishClergyMember } from '../lib/supabase/priestAvailability';

interface LoadedClergy {
    churchId: string;
    clergy: ParishClergyMember[];
}

/**
 * Honorific plus name as parishioners read it, e.g. "Rev. Fr. Juan Dela Cruz".
 * Single place for the celebrant display so the schedule badge, the livestream player,
 * the modals and the clergy roster all print the same text.
 */
export function celebrantLabel(member: Pick<ParishClergyMember, 'title' | 'name'>): string {
    return `${member.title} ${member.name}`.trim();
}

/**
 * One-line description of a parish's priests for headers and fact lists: the priest's labelled name when
 * there is one, a count when there are several, and null when the parish has none.
 */
export function parishPriestSummary(clergy: ParishClergyMember[]): string | null {
    if (clergy.length === 0) return null;
    return clergy.length === 1 ? celebrantLabel(clergy[0]) : `${clergy.length} priests`;
}

/**
 * The parish's priests from the get_parish_clergy function (works while logged out and exposes
 * only name, title, designation and today's status).
 *
 * @param churchId - Church to load; an empty id loads nothing.
 * @returns The roster, a lookup by priest id, and whether the roster is still loading.
 */
export function useParishClergy(churchId?: string | null) {
    const [loaded, setLoaded] = useState<LoadedClergy | null>(null);

    useEffect(() => {
        if (!churchId) return;
        let cancelled = false;
        void getParishClergy(churchId).then(({ data }) => {
            if (!cancelled) setLoaded({ churchId, clergy: data });
        });
        return () => {
            cancelled = true;
        };
    }, [churchId]);

    const current = loaded && loaded.churchId === churchId ? loaded.clergy : null;
    const clergy = useMemo(() => current ?? [], [current]);
    const byId = useMemo(() => new Map(clergy.map((member) => [member.priestId, member])), [clergy]);

    return { clergy, byId, loading: Boolean(churchId) && current === null };
}

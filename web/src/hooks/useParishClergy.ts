import { useEffect, useMemo, useState } from 'react';
import { getParishClergy, type ParishClergyMember } from '../lib/supabase/priestAvailability';

interface LoadedClergy {
    churchId: string;
    clergy: ParishClergyMember[];
}

/**
 * Honorific plus name as parishioners read it, e.g. "Rev. Fr. Juan Dela Cruz".
 * Single place for the celebrant display so the schedule badge, the livestream player,
 * and the modals all print the same text.
 */
export function celebrantLabel(member: Pick<ParishClergyMember, 'title' | 'name'>): string {
    return `${member.title} ${member.name}`.trim();
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

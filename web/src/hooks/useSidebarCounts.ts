import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UNREAD_CHANGED_EVENT } from '../lib/supabase/messaging';
import type { Profile } from '../types/database';

export interface SidebarCounts {
    unreadMessages: number;
    pendingAppointments: number;
    pendingApplications: number;
}

const EMPTY_COUNTS: SidebarCounts = { unreadMessages: 0, pendingAppointments: 0, pendingApplications: 0 };

/**
 * Live counts for the sidebar badges.
 *  - unreadMessages: unread messages in the signed-in user's conversations (everyone).
 *  - pendingAppointments: staff (church admin, priest) see their parish's pending requests,
 *    diocese admins see all of them, parishioners and volunteers see only their own.
 *  - pendingApplications: parish applications awaiting a decision (diocese admins only).
 * Counts refresh on realtime changes, whenever a conversation is marked read, and on navigation.
 */
export function useSidebarCounts(profile: Profile | null): SidebarCounts {
    const location = useLocation();
    const [counts, setCounts] = useState<SidebarCounts>(EMPTY_COUNTS);

    const userId = profile?.id;
    const role = profile?.role;
    const churchId = profile?.assigned_church_id || profile?.church_id || null;

    const refresh = useCallback(async () => {
        if (!userId || !role) {
            setCounts(EMPTY_COUNTS);
            return;
        }
        try {
            let apptQuery = supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (role === 'user' || role === 'volunteer') {
                apptQuery = apptQuery.eq('user_id', userId);
            } else if (role === 'church_admin' || role === 'priest') {
                if (churchId) apptQuery = apptQuery.eq('church_id', churchId);
            }

            const isDioceseAdmin = role === 'admin' || role === 'super_admin';
            const [unreadRes, apptRes, appsRes] = await Promise.all([
                supabase.rpc('get_my_unread_message_count'),
                apptQuery,
                isDioceseAdmin
                    ? supabase
                          .from('parish_applications')
                          .select('*', { count: 'exact', head: true })
                          .in('status', ['pending', 'under_review'])
                    : Promise.resolve({ count: 0, error: null }),
            ]);

            setCounts({
                unreadMessages: !unreadRes.error && typeof unreadRes.data === 'number' ? unreadRes.data : 0,
                pendingAppointments: !apptRes.error ? apptRes.count ?? 0 : 0,
                pendingApplications: !appsRes.error ? appsRes.count ?? 0 : 0,
            });
        } catch (err) {
            console.error('Error fetching sidebar counts:', err);
        }
    }, [userId, role, churchId]);

    useEffect(() => {
        void refresh();
    }, [refresh, location.pathname]);

    useEffect(() => {
        if (!userId) return;
        const onChange = () => void refresh();
        const channel = supabase
            .channel(`layout-sidebar-counts-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, onChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'parish_applications' }, onChange)
            .subscribe();
        window.addEventListener(UNREAD_CHANGED_EVENT, onChange);
        return () => {
            window.removeEventListener(UNREAD_CHANGED_EVENT, onChange);
            supabase.removeChannel(channel);
        };
    }, [userId, refresh]);

    return counts;
}

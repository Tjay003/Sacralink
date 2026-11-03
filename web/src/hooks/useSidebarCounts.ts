import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UNREAD_CHANGED_EVENT } from '../lib/supabase/messaging';
import { APPOINTMENTS_CHANGED_EVENT } from '../lib/supabase/appointments';
import type { Profile } from '../types/database';

export interface SidebarCounts {
    unreadMessages: number;
    pendingAppointments: number;
    pendingApplications: number;
}

const EMPTY_COUNTS: SidebarCounts = { unreadMessages: 0, pendingAppointments: 0, pendingApplications: 0 };

/**
 * Ultra-responsive live counts for the sidebar badges:
 *  - unreadMessages: unread messages in the signed-in user's conversations.
 *  - pendingAppointments: staff (church admin, priest) see their parish's pending requests,
 *    parishioners and volunteers see only their own. Super admin is confidential-fenced (0).
 *  - pendingApplications: parish applications awaiting a decision (super admins only).
 * 
 * Synchronized via:
 *  1. Immediate local DOM events ('sacralink:unread_changed', 'sacralink:appointments_changed')
 *  2. Realtime WebSocket subscriptions (messages, conversation_participants, conversations, appointments, notifications, parish_applications)
 *  3. Window focus and document visibility events (instant refresh when returning to tab)
 *  4. Active-tab periodic heartbeat (5 seconds) as a fail-safe against missed websocket packets
 *  5. Coalesced debouncing (60ms) with stale-response discarding to eliminate race conditions
 */
export function useSidebarCounts(profile: Profile | null): SidebarCounts {
    const location = useLocation();
    const [counts, setCounts] = useState<SidebarCounts>(EMPTY_COUNTS);

    const userId = profile?.id;
    const role = profile?.role;
    const churchId = profile?.assigned_church_id || profile?.church_id || null;

    // Sequence counter to prevent slower, stale query responses from overwriting newer counts
    const requestIdRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const executeRefresh = useCallback(async () => {
        if (!userId || !role) {
            setCounts(EMPTY_COUNTS);
            return;
        }

        const currentRequestId = ++requestIdRef.current;

        try {
            const isSuperAdmin = role === 'super_admin';

            // Super admin does not manage parish appointments (confidential diocesan fence)
            let apptPromise: PromiseLike<{ count: number | null; error: any }> = Promise.resolve({ count: 0, error: null });

            if (!isSuperAdmin) {
                let apptQuery = supabase
                    .from('appointments')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');

                if (role === 'user' || role === 'volunteer') {
                    apptQuery = apptQuery.eq('user_id', userId);
                } else if (role === 'church_admin' || role === 'priest') {
                    if (churchId) {
                        apptQuery = apptQuery.eq('church_id', churchId);
                    } else {
                        // Without assigned church, staff sees 0 pending
                        apptQuery = apptQuery.eq('church_id', '00000000-0000-0000-0000-000000000000');
                    }
                }
                apptPromise = apptQuery;
            }

            const [unreadRes, apptRes, appsRes] = await Promise.all([
                supabase.rpc('get_my_unread_message_count'),
                apptPromise,
                isSuperAdmin
                    ? supabase
                          .from('parish_applications')
                          .select('*', { count: 'exact', head: true })
                          .in('status', ['pending', 'under_review'])
                    : Promise.resolve({ count: 0, error: null }),
            ]);

            // Discard stale response if a newer refresh has already been initiated
            if (currentRequestId !== requestIdRef.current) {
                return;
            }

            setCounts({
                unreadMessages: !unreadRes.error && typeof unreadRes.data === 'number' ? unreadRes.data : 0,
                pendingAppointments: !apptRes.error ? apptRes.count ?? 0 : 0,
                pendingApplications: !appsRes.error ? appsRes.count ?? 0 : 0,
            });
        } catch (err) {
            console.error('Error fetching sidebar counts:', err);
        }
    }, [userId, role, churchId]);

    // Debounced refresh trigger: coalesces rapid bursts into a single query batch
    const triggerRefresh = useCallback((immediate = false) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        if (immediate) {
            void executeRefresh();
        } else {
            debounceTimerRef.current = setTimeout(() => {
                void executeRefresh();
            }, 60);
        }
    }, [executeRefresh]);

    // Keep reference fresh for long-lived realtime subscriptions without tearing down channel
    const triggerRefreshRef = useRef(triggerRefresh);
    triggerRefreshRef.current = triggerRefresh;

    // Refresh immediately on mount, profile change, or route navigation
    useEffect(() => {
        triggerRefresh(true);
    }, [triggerRefresh, location.pathname]);

    // Realtime Postgres change subscriptions (stable lifecycle per userId)
    useEffect(() => {
        if (!userId) return;

        const handleRealtimeChange = () => {
            triggerRefreshRef.current();
        };

        const channelUniqueName = `layout-sidebar-counts-${userId}-${Math.random().toString(36).slice(2, 8)}`;
        const channel = supabase
            .channel(channelUniqueName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, handleRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'parish_applications' }, handleRealtimeChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Resync upon successful channel handshake
                    triggerRefreshRef.current(true);
                }
            });

        // Local custom events for 0ms instantaneous updates from user actions
        const handleLocalUnread = () => triggerRefreshRef.current(true);
        const handleLocalAppts = () => triggerRefreshRef.current(true);

        window.addEventListener(UNREAD_CHANGED_EVENT, handleLocalUnread);
        window.addEventListener(APPOINTMENTS_CHANGED_EVENT, handleLocalAppts);

        // Window focus, visibility, and network reconnect listeners
        const handleFocus = () => triggerRefreshRef.current(true);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                triggerRefreshRef.current(true);
            }
        };
        const handleOnline = () => triggerRefreshRef.current(true);

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        // Active tab polling heartbeat (every 5 seconds while tab is active)
        const heartbeatInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                triggerRefreshRef.current();
            }
        }, 5000);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            clearInterval(heartbeatInterval);
            window.removeEventListener(UNREAD_CHANGED_EVENT, handleLocalUnread);
            window.removeEventListener(APPOINTMENTS_CHANGED_EVENT, handleLocalAppts);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return counts;
}

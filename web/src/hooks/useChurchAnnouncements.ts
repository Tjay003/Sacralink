import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ChurchAnnouncement } from '../types/database';

/**
 * Custom hook to fetch church announcements
 * @param churchId - Optional church ID to filter announcements. If not provided, fetches all.
 * @returns Announcements data, loading state, error, and refetch function
 */
export function useChurchAnnouncements(churchId?: string) {
    const [announcements, setAnnouncements] = useState<ChurchAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('church_announcements')
                .select(`
                    *,
                    church:churches(id, name, status)
                `)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            // Filter by church if provided
            if (churchId) {
                query = query.eq('church_id', churchId);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                throw fetchError;
            }

            setAnnouncements((data as any) || []);
        } catch (err: any) {
            console.error('Error fetching church announcements:', err);
            setError(err.message || 'Failed to fetch announcements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('church_announcements_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'church_announcements',
                    filter: churchId ? `church_id=eq.${churchId}` : undefined,
                },
                () => {
                    // Refetch when changes occur
                    fetchAnnouncements();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [churchId]);

    return {
        announcements,
        loading,
        error,
        refetch: fetchAnnouncements,
    };
}

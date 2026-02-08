import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { SystemAnnouncement } from '../types/database';

/**
 * Custom hook to fetch active system announcements
 * @returns System announcements data, loading state, error, and refetch function
 */
export function useSystemAnnouncements() {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('system_announcements')
                .select('*')
                .eq('is_active', true)
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .order('created_at', { ascending: false });

            if (fetchError) {
                throw fetchError;
            }

            setAnnouncements(data || []);
        } catch (err: any) {
            console.error('Error fetching system announcements:', err);
            setError(err.message || 'Failed to fetch system announcements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('system_announcements_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'system_announcements',
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
    }, []);

    return {
        announcements,
        loading,
        error,
        refetch: fetchAnnouncements,
    };
}

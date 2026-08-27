import { useState, useEffect, useCallback } from 'react';
import {
    getSystemAnnouncements,
    subscribeToSystemAnnouncements,
    type SystemAnnouncement,
    type GetSystemAnnouncementsOptions,
} from '../lib/supabase/announcements';

/**
 * Custom hook to fetch system announcements
 * Delegates directly to the deep announcements domain module.
 *
 * @param options - Optional search, limit, and includeInactive options
 * @returns System announcements data, loading state, error, and refetch function
 */
export function useSystemAnnouncements(options?: GetSystemAnnouncementsOptions) {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const searchOption = options?.search;
    const limitOption = options?.limit;
    const includeInactiveOption = options?.includeInactive;

    const fetchAnnouncements = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await getSystemAnnouncements({
                search: searchOption,
                limit: limitOption,
                includeInactive: includeInactiveOption,
            });

            if (fetchError) {
                throw fetchError;
            }

            setAnnouncements(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch system announcements';
            console.error('Error fetching system announcements:', err);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [searchOption, limitOption, includeInactiveOption]);

    useEffect(() => {
        void fetchAnnouncements();

        // Subscribe to real-time updates via domain module
        const unsubscribe = subscribeToSystemAnnouncements(() => {
            void fetchAnnouncements();
        });

        return () => {
            unsubscribe();
        };
    }, [fetchAnnouncements]);

    return {
        announcements,
        loading,
        error,
        refetch: fetchAnnouncements,
    };
}


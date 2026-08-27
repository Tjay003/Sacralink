import { useState, useEffect, useCallback } from 'react';
import {
    getChurchAnnouncements,
    subscribeToChurchAnnouncements,
    type ChurchAnnouncement,
    type GetChurchAnnouncementsOptions,
} from '../lib/supabase/announcements';

/**
 * Custom hook to fetch church announcements
 * Delegates directly to the deep announcements domain module.
 *
 * @param churchId - Optional church ID to filter announcements. If not provided, fetches all.
 * @param options - Optional search or limit options.
 * @returns Announcements data, loading state, error, and refetch function
 */
export function useChurchAnnouncements(
    churchId?: string,
    options?: GetChurchAnnouncementsOptions
) {
    const [announcements, setAnnouncements] = useState<ChurchAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const effectiveChurchId = churchId && churchId.trim().length > 0 ? churchId.trim() : undefined;
    const searchOption = options?.search;
    const limitOption = options?.limit;

    const fetchAnnouncements = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await getChurchAnnouncements(effectiveChurchId, {
                search: searchOption,
                limit: limitOption,
            });

            if (fetchError) {
                throw fetchError;
            }

            setAnnouncements(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch church announcements';
            console.error('Error fetching church announcements:', err);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [effectiveChurchId, searchOption, limitOption]);

    useEffect(() => {
        void fetchAnnouncements();

        // Subscribe to real-time updates via domain module
        const unsubscribe = subscribeToChurchAnnouncements(effectiveChurchId, () => {
            void fetchAnnouncements();
        });

        return () => {
            unsubscribe();
        };
    }, [effectiveChurchId, fetchAnnouncements]);

    return {
        announcements,
        loading,
        error,
        refetch: fetchAnnouncements,
    };
}


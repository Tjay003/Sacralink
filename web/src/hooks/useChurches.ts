import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useChurches - Custom hook to fetch and manage church data
 * 
 * This is a REUSABLE hook that handles:
 * - Fetching all churches from database
 * - Loading state
 * - Error handling
 * - Refetch functionality
 * 
 * Usage:
 * const { churches, loading, error, refetch } = useChurches();
 */

import type { Church as DbChurch, MassSchedule } from '../types/database';

export type { MassSchedule };

export type Church = DbChurch & {
    mass_schedules?: MassSchedule[];
    status?: 'active' | 'inactive' | null;
};

export function useChurches() {
    const [churches, setChurches] = useState<Church[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch churches when component mounts
    useEffect(() => {
        fetchChurches();
    }, []);

    const fetchChurches = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('📍 Fetching churches from database...');

            const { data, error: fetchError } = await supabase
                .from('churches')
                .select('*')
                .order('name', { ascending: true });

            if (fetchError) {
                console.error('❌ Error fetching churches:', fetchError);
                setError(fetchError.message);
                return;
            }

            console.log('✅ Fetched churches:', data?.length || 0);
            setChurches(data || []);
        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to fetch churches');
        } finally {
            setLoading(false);
        }
    };

    return {
        churches,
        loading,
        error,
        refetch: fetchChurches,
    };
}

/**
 * useChurch - Fetch a single church by ID with mass schedules
 */
export function useChurch(id: string | undefined) {
    const [church, setChurch] = useState<Church | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        fetchChurch();
    }, [id]);

    const fetchChurch = async () => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);

            console.log('📍 Fetching church with schedules:', id);

            const { data, error: fetchError } = await supabase
                .from('churches')
                .select(`
          *,
          mass_schedules (
            id,
            day_of_week,
            time,
            language,
            created_at
          )
        `)
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('❌ Error fetching church:', fetchError);
                setError(fetchError.message);
                return;
            }

            console.log('✅ Fetched church:', (data as unknown as Church)?.name);
            setChurch(data as unknown as Church);
        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to fetch church');
        } finally {
            setLoading(false);
        }
    };

    return {
        church,
        loading,
        error,
        refetch: fetchChurch,
    };
}

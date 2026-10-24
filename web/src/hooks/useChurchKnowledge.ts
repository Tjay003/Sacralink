import { useState, useEffect, useCallback } from 'react';
import {
    getChurchKnowledgeSections,
    subscribeToChurchKnowledgeSections,
    type ChurchKnowledgeSection,
} from '../lib/supabase/churchKnowledge';

export function useChurchKnowledge(churchId?: string) {
    const [sections, setSections] = useState<ChurchKnowledgeSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const effectiveChurchId = churchId?.trim() || undefined;

    const fetchSections = useCallback(async () => {
        if (!effectiveChurchId) {
            setSections([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchErr } = await getChurchKnowledgeSections(effectiveChurchId);
            if (fetchErr) {
                setError(fetchErr.message);
            } else {
                setSections(data);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch knowledge sections');
        } finally {
            setLoading(false);
        }
    }, [effectiveChurchId]);

    useEffect(() => {
        void fetchSections();
        if (!effectiveChurchId) return;

        const unsubscribe = subscribeToChurchKnowledgeSections(effectiveChurchId, () => {
            void fetchSections();
        });

        return () => {
            unsubscribe();
        };
    }, [effectiveChurchId, fetchSections]);

    return {
        sections,
        loading,
        error,
        refetch: fetchSections,
    };
}

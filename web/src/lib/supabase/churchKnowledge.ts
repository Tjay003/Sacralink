import { supabase } from '../supabase';
import type { Database } from '../../types/database';

export type ChurchKnowledgeSection = Database['public']['Tables']['church_knowledge_sections']['Row'];

/**
 * Fetch all published knowledge sections for a church, ordered by display_order then created_at.
 */
export async function getChurchKnowledgeSections(churchId: string): Promise<{
    data: ChurchKnowledgeSection[];
    error: Error | null;
}> {
    try {
        const { data, error } = await supabase
            .from('church_knowledge_sections')
            .select('*')
            .eq('church_id', churchId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (err: unknown) {
        console.error('Error fetching church knowledge sections:', err);
        return {
            data: [],
            error: err instanceof Error ? err : new Error('Failed to load knowledge sections'),
        };
    }
}

/**
 * Subscribe to real-time changes in church_knowledge_sections for a church.
 */
export function subscribeToChurchKnowledgeSections(
    churchId: string,
    onChange: () => void
): () => void {
    const channel = supabase
        .channel(`public:church_knowledge_sections:${churchId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'church_knowledge_sections',
                filter: `church_id=eq.${churchId}`,
            },
            () => {
                onChange();
            }
        )
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

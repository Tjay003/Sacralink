import { supabase } from '../supabase';

/**
 * Follow a church (add to favorites)
 */
export async function followChurch(churchId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
        .from('church_favorites')
        .insert({ user_id: user.id, church_id: churchId });

    return { error };
}

/**
 * Unfollow a church (remove from favorites)
 */
export async function unfollowChurch(churchId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
        .from('church_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('church_id', churchId);

    return { error };
}

/**
 * Check if the current user follows a specific church
 */
export async function isChurchFollowed(churchId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
        .from('church_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('church_id', churchId)
        .maybeSingle();

    return !!data;
}

/**
 * Get all user IDs that follow a specific church.
 * Used for notification fanout when a new announcement is created.
 */
export async function getChurchFollowerIds(churchId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('church_favorites')
        .select('user_id')
        .eq('church_id', churchId);

    if (error) {
        console.error('Error fetching church followers:', error);
        return [];
    }

    return (data || []).map((row: any) => row.user_id);
}

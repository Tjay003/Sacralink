import { supabase } from '../supabase';
import imageCompression from 'browser-image-compression';
import type { Database, Profile } from '../../types/database';
import { getStoredPriestStatus, setStoredPriestStatus } from '../directApi';

export type ProfileUpdate = {
    full_name?: string | null;
    avatar_url?: string | null;
    church_id?: string | null;
    assigned_church_id?: string | null;
    role?: Database['public']['Enums']['user_role'] | null;
    is_priest?: boolean | null;
    phone_number?: string | null;
    is_verified?: boolean | null;
    fcm_token?: string | null;
};

/**
 * Compress and resize image before upload
 */
async function compressImage(file: File): Promise<File> {
    const options = {
        maxSizeMB: 0.2,          // 200KB max — safely under the 512KB storage bucket limit
        maxWidthOrHeight: 400,   // 400x400px
        useWebWorker: true,
        fileType: 'image/jpeg',  // Always output JPEG for better compression ratios
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.error('Error compressing image:', error);
        throw new Error('Failed to compress image. Please try a different photo.');
    }
}

/**
 * Upload avatar for the current user.
 *
 * Safe ordering: upload NEW file first (upsert), THEN delete old URL from profile record.
 * This way, if the upload fails, the user keeps their existing avatar.
 *
 * @param file - Image file to upload
 * @returns Public URL of the uploaded avatar
 */
export async function uploadAvatar(file: File): Promise<string> {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPG, PNG, or WEBP image.');
    }

    // Validate file size (max 5MB before compression)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('File too large. Please choose an image under 5MB.');
    }

    // Compress image BEFORE uploading
    const compressedFile = await compressImage(file);

    // Always use a fixed path so upsert overwrites the existing file
    const fileName = `${user.id}/avatar.jpg`;

    // Upload to storage (upsert = overwrite if exists)
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, {
            cacheControl: '0',   // No cache so the browser shows the new image immediately
            upsert: true,
            contentType: 'image/jpeg',
        });

    if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Build the public URL (add cache-buster so the browser doesn't show the old cached image)
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

    if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error(`Failed to save avatar: ${updateError.message}`);
    }

    return publicUrl;
}

/**
 * Delete avatar for the current user
 */
export async function deleteAvatar(): Promise<void> {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    // Get current avatar URL from profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single() as { data: { avatar_url: string | null } | null };

    // Remove the file from storage if it exists
    if (profile?.avatar_url) {
        try {
            const fileName = `${user.id}/avatar.jpg`;
            await supabase.storage.from('avatars').remove([fileName]);
        } catch (err) {
            console.warn('Could not remove avatar file from storage:', err);
            // Continue anyway — clearing the URL from the profile is the important part
        }
    }

    // Clear avatar_url from profile
    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

    if (error) throw new Error(`Failed to remove avatar: ${error.message}`);
}

/**
 * Get current user's profile
 */
export async function getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) throw error;
    if (data) {
        const storedPriest = getStoredPriestStatus(data.id);
        if (storedPriest !== null) {
            (data as Profile).is_priest = storedPriest;
        }
    }
    return data;
}

/**
 * Get profile by user ID
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile by ID:', error);
        return null;
    }
    if (data) {
        const storedPriest = getStoredPriestStatus(data.id);
        if (storedPriest !== null) {
            (data as Profile).is_priest = storedPriest;
        }
    }
    return data;
}

/**
 * Update user profile
 */
export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
    if (updates.is_priest !== undefined && updates.is_priest !== null) {
        setStoredPriestStatus(userId, updates.is_priest);
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select('*')
            .single();

        if (error) {
            // Check if error is due to missing is_priest column in remote database
            if (updates.is_priest !== undefined) {
                console.warn('updateProfile: remote DB error, retrying without is_priest column:', error);
                const { is_priest, ...updatesWithoutPriest } = updates;
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('profiles')
                    .update({
                        ...updatesWithoutPriest,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId)
                    .select('*')
                    .single();

                if (fallbackError) {
                    throw fallbackError;
                }
                const result = fallbackData as Profile;
                result.is_priest = is_priest;
                return result;
            }
            throw error;
        }

        const result = data as Profile;
        if (updates.is_priest !== undefined && updates.is_priest !== null) {
            result.is_priest = updates.is_priest;
        }
        return result;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

/**
 * Change a person's role through the database function set_user_role (the only sanctioned path).
 * Throws an Error whose message is safe to show to the user.
 */
export async function setUserRole(
    userId: string,
    role: Database['public']['Enums']['user_role'],
    churchId?: string | null,
    isPriest?: boolean | null
): Promise<void> {
    const { error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: role,
        p_church_id: churchId ?? null,
        p_is_priest: isPriest ?? null,
    });
    if (error) {
        if (error.code === '23514') {
            throw new Error('This church must keep at least one Church Admin. Promote someone else to Church Admin first.');
        }
        throw new Error(error.message || 'Failed to update the role');
    }
}

/**
 * Delete a user through the database function delete_user_account (Super Admin only). The account is anonymized in
 * place: history is kept and shown as Deleted User. Throws an Error whose message is safe to show to the user.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_user_account', { p_user_id: userId });
    if (error) {
        throw new Error(error.message || 'Failed to delete the user');
    }
}

/**
 * Suspend a user through the database function suspend_user (Super Admin only). The person is signed out at once and
 * cannot sign in until reactivated; nothing else changes. Throws an Error whose message is safe to show to the user.
 */
export async function suspendUser(userId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('suspend_user', { p_user_id: userId, p_reason: reason });
    if (error) {
        throw new Error(error.message || 'Failed to suspend the user');
    }
}

/**
 * Reactivate a suspended user through the database function reactivate_user (Super Admin only).
 */
export async function reactivateUser(userId: string): Promise<void> {
    const { error } = await supabase.rpc('reactivate_user', { p_user_id: userId });
    if (error) {
        throw new Error(error.message || 'Failed to reactivate the user');
    }
}

/**
 * Fetch priests and ordained clergy profiles for a church (or all clergy)
 */
export async function getChurchPriests(churchId?: string): Promise<Profile[]> {
    try {
        let query = supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .is('suspended_at', null)
            .or('role.eq.priest,role.eq.church_admin,role.eq.admin,is_priest.eq.true');

        if (churchId) {
            query = query.or(`assigned_church_id.eq.${churchId},church_id.eq.${churchId}`);
        }

        const { data, error } = await query.order('full_name', { ascending: true });
        if (error) {
            throw error;
        }
        return (data || []).map(p => {
            const lp = getStoredPriestStatus(p.id);
            if (lp !== null) p.is_priest = lp;
            return p;
        });
    } catch (err) {
        console.warn('Falling back getChurchPriests without is_priest column query:', err);
        let fallbackQuery = supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .is('suspended_at', null)
            .in('role', ['priest', 'church_admin']);
        if (churchId) {
            fallbackQuery = fallbackQuery.or(`assigned_church_id.eq.${churchId},church_id.eq.${churchId}`);
        }
        const { data } = await fallbackQuery.order('full_name', { ascending: true });
        return (data || []).map(p => {
            const lp = getStoredPriestStatus(p.id);
            if (lp !== null) p.is_priest = lp;
            return p;
        });
    }
}


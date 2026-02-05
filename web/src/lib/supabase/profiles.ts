import { supabase } from '../supabase';
import imageCompression from 'browser-image-compression';

/**
 * Compress and resize image before upload
 */
async function compressImage(file: File): Promise<File> {
    const options = {
        maxSizeMB: 0.5, // 500KB max
        maxWidthOrHeight: 400, // 400x400px
        useWebWorker: true,
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.error('Error compressing image:', error);
        throw new Error('Failed to compress image');
    }
}

/**
 * Upload avatar for the current user
 * @param file - Image file to upload
 * @returns Public URL of the uploaded avatar
 */
export async function uploadAvatar(file: File): Promise<string> {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload JPG, PNG, or WEBP');
        }

        // Validate file size (max 5MB before compression)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 5MB');
        }

        // Compress image
        const compressedFile = await compressImage(file);

        // Delete old avatar if exists
        const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single() as { data: { avatar_url: string | null } | null };

        if (profile?.avatar_url) {
            await deleteAvatar();
        }

        // Generate file path
        const fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/avatar.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, compressedFile, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update profile with new avatar URL
        const { error: updateError } = await (supabase
            .from('profiles') as any)
            .update({ avatar_url: data.publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading avatar:', error);
        throw error;
    }
}

/**
 * Delete avatar for the current user
 */
export async function deleteAvatar(): Promise<void> {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get current avatar URL
        const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single() as { data: { avatar_url: string | null } | null };

        if (profile?.avatar_url) {
            try {
                // Extract file path from URL
                const url = new URL(profile.avatar_url);
                const pathParts = url.pathname.split('/avatars/');
                if (pathParts.length > 1) {
                    const path = pathParts[1];

                    // Delete from storage
                    await supabase.storage
                        .from('avatars')
                        .remove([path]);
                }
            } catch (err) {
                console.error('Error deleting avatar file:', err);
                // Continue anyway to clear the URL from profile
            }
        }

        // Remove URL from profile
        const { error } = await (supabase
            .from('profiles') as any)
            .update({ avatar_url: null })
            .eq('id', user.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting avatar:', error);
        throw error;
    }
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
    return data;
}

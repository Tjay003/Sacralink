import { supabase } from '../supabase';
import imageCompression from 'browser-image-compression';

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
    return data;
}

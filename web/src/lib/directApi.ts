/**
 * directApi.ts - Direct REST API helpers for Supabase
 * 
 * These functions make direct HTTP requests to Supabase REST API
 * to bypass the AbortError issue with the Supabase JS client.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Fetch a single user profile by ID
 */
export async function directFetchProfile(userId: string, accessToken: string) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.error('Direct API error:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        return data[0] || null;
    } catch (error) {
        console.error('Direct API fetch error:', error);
        return null;
    }
}

/**
 * Fetch all user profiles (for admin user management)
 */
export async function directFetchProfiles(accessToken: string) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.error('Direct API error:', response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Direct API fetch error:', error);
        return null;
    }
}

/**
 * Update a user's role
 */
export async function directUpdateUserRole(
    userId: string,
    newRole: string,
    accessToken: string
) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify({ role: newRole }),
            }
        );

        if (!response.ok) {
            console.error('Direct API error:', response.status, response.statusText);
            return { success: false, error: 'Failed to update role' };
        }

        const data = await response.json();
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Direct API update error:', error);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Update a user's profile (name, church, etc.)
 */
export async function directUpdateProfile(
    userId: string,
    updates: { full_name?: string; church_id?: string | null; assigned_church_id?: string | null; role?: string },
    accessToken: string
) {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify({
                    ...updates,
                    updated_at: new Date().toISOString(),
                }),
            }
        );

        if (!response.ok) {
            console.error('Direct API error:', response.status, response.statusText);
            return { success: false, error: 'Failed to update profile' };
        }

        const data = await response.json();
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('Direct API update error:', error);
        return { success: false, error: 'Network error' };
    }
}

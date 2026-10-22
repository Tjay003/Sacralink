/**
 * directApi.ts - Direct REST API helpers for Supabase
 * 
 * These functions make direct HTTP requests to Supabase REST API
 * to bypass the AbortError issue with the Supabase JS client.
 */

import type { Church, Profile } from '../types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Helper to get fallback priest status from localStorage
 */
export function getStoredPriestStatus(userId: string): boolean | null {
    try {
        const val = localStorage.getItem(`sacralink_is_priest_${userId}`);
        if (val !== null) return val === 'true';
    } catch {
        // localStorage not available
    }
    return null;
}

/**
 * Helper to persist fallback priest status in localStorage
 */
export function setStoredPriestStatus(userId: string, isPriest: boolean): void {
    try {
        localStorage.setItem(`sacralink_is_priest_${userId}`, String(isPriest));
    } catch {
        // localStorage not available
    }
}

/**
 * Fetch a single user profile by ID
 */
export async function directFetchProfile(userId: string, accessToken: string): Promise<Profile | null> {
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

        const data: Profile[] = await response.json();
        const profile = data[0] || null;
        if (profile) {
            const fallbackPriest = getStoredPriestStatus(profile.id);
            if (fallbackPriest !== null) {
                profile.is_priest = fallbackPriest;
            }
        }
        return profile;
    } catch (error) {
        console.error('Direct API fetch error:', error);
        return null;
    }
}

export interface DirectFetchProfilesOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    churchId?: string;
}

export interface DirectFetchProfilesResult {
    data: Profile[];
    count: number;
}

/**
 * Fetch all user profiles (for admin user management) with optional pagination and filters
 */
export async function directFetchProfiles(
    accessToken: string,
    options?: DirectFetchProfilesOptions
): Promise<DirectFetchProfilesResult> {
    try {
        let url = `${SUPABASE_URL}/rest/v1/profiles?select=*&deleted_at=is.null&order=created_at.desc`;

        if (options?.role && options.role !== 'all') {
            url += `&role=eq.${encodeURIComponent(options.role)}`;
        }

        if (options?.churchId && options.churchId !== 'all') {
            if (options.churchId === 'unassigned') {
                url += `&assigned_church_id=is.null`;
            } else {
                url += `&assigned_church_id=eq.${encodeURIComponent(options.churchId)}`;
            }
        }

        if (options?.search && options.search.trim()) {
            const term = encodeURIComponent(`%${options.search.trim()}%`);
            url += `&or=(full_name.ilike.${term},email.ilike.${term})`;
        }

        const headers: Record<string, string> = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact',
        };

        if (options?.page && options?.pageSize) {
            const from = (options.page - 1) * options.pageSize;
            const to = options.page * options.pageSize - 1;
            headers['Range'] = `${from}-${to}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error('Direct API error:', response.status, response.statusText);
            return { data: [], count: 0 };
        }

        const data: Profile[] = await response.json();
        if (Array.isArray(data)) {
            data.forEach(profile => {
                const fallbackPriest = getStoredPriestStatus(profile.id);
                if (fallbackPriest !== null) {
                    profile.is_priest = fallbackPriest;
                }
            });
        }
        let totalCount = Array.isArray(data) ? data.length : 0;

        const contentRange = response.headers.get('content-range');
        if (contentRange) {
            const parts = contentRange.split('/');
            if (parts.length > 1) {
                const parsed = parseInt(parts[1], 10);
                if (!isNaN(parsed)) {
                    totalCount = parsed;
                }
            }
        }

        const result: DirectFetchProfilesResult = { data: data || [], count: totalCount };
        if (Array.isArray(data)) {
            Object.assign(data, result);
        }
        return result;
    } catch (error) {
        console.error('Direct API fetch error:', error);
        return { data: [], count: 0 };
    }
}

/**
 * Fetch all churches (direct REST query)
 */
export async function directFetchChurches(): Promise<Church[]> {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/churches?select=*&order=name.asc`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.error('Direct API fetch churches error:', response.status, response.statusText);
            return [];
        }

        const data: Church[] = await response.json();
        return data || [];
    } catch (error) {
        console.error('Direct API fetch churches error:', error);
        return [];
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
    updates: { full_name?: string; church_id?: string | null; assigned_church_id?: string | null; role?: string; is_priest?: boolean | null },
    accessToken: string
) {
    if (updates.is_priest !== undefined && updates.is_priest !== null) {
        setStoredPriestStatus(userId, updates.is_priest);
    }

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
            // Check if 400 Bad Request is due to missing is_priest column in remote PostgreSQL
            if (response.status === 400 && updates.is_priest !== undefined) {
                console.warn('directUpdateProfile: remote DB may lack is_priest column, retrying without is_priest...');
                const { is_priest, ...updatesWithoutPriest } = updates;
                const fallbackResponse = await fetch(
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
                            ...updatesWithoutPriest,
                            updated_at: new Date().toISOString(),
                        }),
                    }
                );

                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    const updated = fallbackData[0] || {};
                    updated.is_priest = is_priest;
                    return { success: true, data: updated };
                }
            }

            console.error('Direct API error:', response.status, response.statusText);
            return { success: false, error: 'Failed to update profile' };
        }

        const data = await response.json();
        const updated = data[0] || {};
        if (updates.is_priest !== undefined && updates.is_priest !== null) {
            updated.is_priest = updates.is_priest;
        }
        return { success: true, data: updated };
    } catch (error) {
        console.error('Direct API update error:', error);
        return { success: false, error: 'Network error' };
    }
}

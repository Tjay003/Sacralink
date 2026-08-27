import { supabase } from '../supabase';
import type { Database } from '../../types/database';
import { notifyFollowersOfAnnouncement } from './notifications';

export type AnnouncementCategory =
    | 'general'
    | 'mass_schedule'
    | 'event'
    | 'emergency'
    | 'reminder';

export type SystemAnnouncementType =
    | 'info'
    | 'warning'
    | 'maintenance'
    | 'success';

export interface ChurchJoinedInfo {
    id: string;
    name: string;
    status?: string | null;
}

export interface ChurchAnnouncement {
    id: string;
    church_id: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    is_pinned: boolean | null;
    scheduled_at: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
    church?: ChurchJoinedInfo | null;
}

export interface SystemAnnouncement {
    id: string;
    title: string;
    content: string;
    type: SystemAnnouncementType | string | null;
    is_active: boolean | null;
    expires_at: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface UnifiedChurchAnnouncement extends ChurchAnnouncement {
    kind: 'church';
    is_pinned: boolean;
}

export interface UnifiedSystemAnnouncement extends SystemAnnouncement {
    kind: 'system';
    church_id?: undefined;
    church?: undefined;
    category?: undefined;
    scheduled_at?: undefined;
    is_pinned: false;
}

export type UnifiedAnnouncement = UnifiedChurchAnnouncement | UnifiedSystemAnnouncement;

export interface GetChurchAnnouncementsOptions {
    search?: string;
    limit?: number;
}

export interface GetSystemAnnouncementsOptions {
    search?: string;
    limit?: number;
    includeInactive?: boolean;
}

export interface GetAllAnnouncementsOptions {
    churchId?: string;
    search?: string;
    limit?: number;
    includeInactiveSystem?: boolean;
}

export interface CreateChurchAnnouncementInput {
    churchId: string;
    title: string;
    content: string;
    category?: AnnouncementCategory;
    isPinned?: boolean;
    scheduledAt?: string | null;
    churchName?: string;
}

export interface UpdateChurchAnnouncementInput {
    title?: string;
    content?: string;
    category?: AnnouncementCategory;
    isPinned?: boolean;
    scheduledAt?: string | null;
}

export interface CreateSystemAnnouncementInput {
    title: string;
    content: string;
    type?: SystemAnnouncementType;
    expiresAt?: string | null;
    isActive?: boolean;
}

export interface UpdateSystemAnnouncementInput {
    title?: string;
    content?: string;
    type?: SystemAnnouncementType;
    expiresAt?: string | null;
    isActive?: boolean;
}

function normalizeChurch(
    church: ChurchJoinedInfo | ChurchJoinedInfo[] | null | undefined
): ChurchJoinedInfo | null {
    if (!church) return null;
    if (Array.isArray(church)) {
        return church.length > 0 ? church[0] : null;
    }
    return church;
}

/**
 * Ranks announcements with pinned items first, followed by newest created_at descending.
 */
export function rankAnnouncements<T extends { is_pinned?: boolean | null; created_at: string | null }>(
    items: T[]
): T[] {
    return [...items].sort((a, b) => {
        const aPinned = Boolean(a.is_pinned);
        const bPinned = Boolean(b.is_pinned);

        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;

        return timeB - timeA;
    });
}

/**
 * Fetch church announcements with optional church ID filtering, search, and pagination limit.
 * Always ranks pinned announcements first, then newest created_at descending.
 */
export async function getChurchAnnouncements(
    churchId?: string,
    options: GetChurchAnnouncementsOptions = {}
): Promise<{ data: ChurchAnnouncement[]; error: Error | null }> {
    try {
        let query = supabase
            .from('church_announcements')
            .select(`
                id,
                church_id,
                title,
                content,
                category,
                is_pinned,
                scheduled_at,
                created_by,
                created_at,
                updated_at,
                church:churches(id, name, status)
            `)
            .order('is_pinned', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (churchId) {
            query = query.eq('church_id', churchId);
        }

        if (options.search && options.search.trim().length > 0) {
            const term = options.search.trim();
            query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
        }

        if (typeof options.limit === 'number' && options.limit > 0) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) throw error;

        const mapped: ChurchAnnouncement[] = (data || []).map((row) => ({
            id: row.id,
            church_id: row.church_id,
            title: row.title,
            content: row.content,
            category: (row.category as AnnouncementCategory) || 'general',
            is_pinned: row.is_pinned,
            scheduled_at: row.scheduled_at,
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
            church: normalizeChurch(row.church),
        }));

        const sorted = rankAnnouncements(mapped);

        return { data: sorted, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error fetching church announcements:', error);
        return { data: [], error };
    }
}

/**
 * Fetch active, non-expired system announcements (or all system announcements if includeInactive is true).
 * Ordered by created_at descending.
 */
export async function getSystemAnnouncements(
    options: GetSystemAnnouncementsOptions = {}
): Promise<{ data: SystemAnnouncement[]; error: Error | null }> {
    try {
        const nowIso = new Date().toISOString();
        let query = supabase
            .from('system_announcements')
            .select(`
                id,
                title,
                content,
                type,
                is_active,
                expires_at,
                created_by,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false });

        if (!options.includeInactive) {
            query = query
                .eq('is_active', true)
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
        }

        if (options.search && options.search.trim().length > 0) {
            const term = options.search.trim();
            query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
        }

        if (typeof options.limit === 'number' && options.limit > 0) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) throw error;

        const nowMs = Date.now();
        const mapped: SystemAnnouncement[] = (data || [])
            .map((row) => ({
                id: row.id,
                title: row.title,
                content: row.content,
                type: (row.type as SystemAnnouncementType) || 'info',
                is_active: row.is_active,
                expires_at: row.expires_at,
                created_by: row.created_by,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
            .filter((item) => {
                if (options.includeInactive) return true;
                if (item.is_active === false) return false;
                if (item.expires_at) {
                    const expTime = new Date(item.expires_at).getTime();
                    if (!isNaN(expTime) && expTime <= nowMs) {
                        return false;
                    }
                }
                return true;
            });

        return { data: mapped, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error fetching system announcements:', error);
        return { data: [], error };
    }
}

/**
 * Fetch unified announcements feed (church announcements + active system announcements).
 * Pinned announcements appear first, followed by newest created_at descending.
 */
export async function getAllAnnouncements(
    options: GetAllAnnouncementsOptions = {}
): Promise<{ data: UnifiedAnnouncement[]; error: Error | null }> {
    try {
        const [churchRes, systemRes] = await Promise.all([
            getChurchAnnouncements(options.churchId, {
                search: options.search,
            }),
            getSystemAnnouncements({
                search: options.search,
                includeInactive: options.includeInactiveSystem,
            }),
        ]);

        if (churchRes.error) {
            console.error('Error in getAllAnnouncements (church):', churchRes.error);
        }
        if (systemRes.error) {
            console.error('Error in getAllAnnouncements (system):', systemRes.error);
        }

        const churchUnified: UnifiedChurchAnnouncement[] = churchRes.data.map((item) => ({
            ...item,
            kind: 'church' as const,
            is_pinned: Boolean(item.is_pinned),
        }));

        const systemUnified: UnifiedSystemAnnouncement[] = systemRes.data.map((item) => ({
            ...item,
            kind: 'system' as const,
            is_pinned: false as const,
        }));

        const combined = rankAnnouncements([...churchUnified, ...systemUnified]);
        const data = options.limit && options.limit > 0 ? combined.slice(0, options.limit) : combined;

        const combinedError = churchRes.error || systemRes.error || null;
        return { data, error: combinedError };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error in getAllAnnouncements:', error);
        return { data: [], error };
    }
}

/**
 * Delete a church announcement by ID.
 */
export async function deleteChurchAnnouncement(id: string): Promise<{ error: Error | null }> {
    try {
        if (!id) throw new Error('Announcement ID is required for deletion');

        const { error } = await supabase
            .from('church_announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error deleting church announcement:', error);
        return { error };
    }
}

/**
 * Delete a system announcement by ID.
 */
export async function deleteSystemAnnouncement(id: string): Promise<{ error: Error | null }> {
    try {
        if (!id) throw new Error('Announcement ID is required for deletion');

        const { error } = await supabase
            .from('system_announcements')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error deleting system announcement:', error);
        return { error };
    }
}

/**
 * Create a new church announcement with optional follower notification.
 */
export async function createChurchAnnouncement(
    input: CreateChurchAnnouncementInput
): Promise<{ data: ChurchAnnouncement | null; error: Error | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        const insertPayload: Database['public']['Tables']['church_announcements']['Insert'] = {
            church_id: input.churchId,
            title: input.title.trim(),
            content: input.content.trim(),
            category: input.category || 'general',
            is_pinned: input.isPinned ?? false,
            scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
            created_by: user?.id || null,
        };

        const { data, error } = await supabase
            .from('church_announcements')
            .insert(insertPayload)
            .select(`
                id,
                church_id,
                title,
                content,
                category,
                is_pinned,
                scheduled_at,
                created_by,
                created_at,
                updated_at,
                church:churches(id, name, status)
            `)
            .single();

        if (error) throw error;

        const created: ChurchAnnouncement = {
            id: data.id,
            church_id: data.church_id,
            title: data.title,
            content: data.content,
            category: (data.category as AnnouncementCategory) || 'general',
            is_pinned: data.is_pinned,
            scheduled_at: data.scheduled_at,
            created_by: data.created_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
            church: normalizeChurch(data.church),
        };

        if (created.id && input.churchId) {
            void notifyFollowersOfAnnouncement(
                input.churchId,
                input.churchName || 'Your followed church',
                created.id,
                created.title
            );
        }

        return { data: created, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error creating church announcement:', error);
        return { data: null, error };
    }
}

/**
 * Update an existing church announcement by ID.
 */
export async function updateChurchAnnouncement(
    id: string,
    input: UpdateChurchAnnouncementInput
): Promise<{ data: ChurchAnnouncement | null; error: Error | null }> {
    try {
        const updatePayload: Database['public']['Tables']['church_announcements']['Update'] = {};
        if (input.title !== undefined) updatePayload.title = input.title.trim();
        if (input.content !== undefined) updatePayload.content = input.content.trim();
        if (input.category !== undefined) updatePayload.category = input.category;
        if (input.isPinned !== undefined) updatePayload.is_pinned = input.isPinned;
        if (input.scheduledAt !== undefined) {
            updatePayload.scheduled_at = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
        }

        const { data, error } = await supabase
            .from('church_announcements')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                id,
                church_id,
                title,
                content,
                category,
                is_pinned,
                scheduled_at,
                created_by,
                created_at,
                updated_at,
                church:churches(id, name, status)
            `)
            .single();

        if (error) throw error;

        const updated: ChurchAnnouncement = {
            id: data.id,
            church_id: data.church_id,
            title: data.title,
            content: data.content,
            category: (data.category as AnnouncementCategory) || 'general',
            is_pinned: data.is_pinned,
            scheduled_at: data.scheduled_at,
            created_by: data.created_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
            church: normalizeChurch(data.church),
        };

        return { data: updated, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error updating church announcement:', error);
        return { data: null, error };
    }
}

/**
 * Create a new system-wide announcement.
 */
export async function createSystemAnnouncement(
    input: CreateSystemAnnouncementInput
): Promise<{ data: SystemAnnouncement | null; error: Error | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        const insertPayload: Database['public']['Tables']['system_announcements']['Insert'] = {
            title: input.title.trim(),
            content: input.content.trim(),
            type: input.type || 'info',
            expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
            is_active: input.isActive ?? true,
            created_by: user?.id || null,
        };

        const { data, error } = await supabase
            .from('system_announcements')
            .insert(insertPayload)
            .select(`
                id,
                title,
                content,
                type,
                is_active,
                expires_at,
                created_by,
                created_at,
                updated_at
            `)
            .single();

        if (error) throw error;

        const created: SystemAnnouncement = {
            id: data.id,
            title: data.title,
            content: data.content,
            type: (data.type as SystemAnnouncementType) || 'info',
            is_active: data.is_active,
            expires_at: data.expires_at,
            created_by: data.created_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };

        return { data: created, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error creating system announcement:', error);
        return { data: null, error };
    }
}

/**
 * Update an existing system-wide announcement by ID.
 */
export async function updateSystemAnnouncement(
    id: string,
    input: UpdateSystemAnnouncementInput
): Promise<{ data: SystemAnnouncement | null; error: Error | null }> {
    try {
        const updatePayload: Database['public']['Tables']['system_announcements']['Update'] = {};
        if (input.title !== undefined) updatePayload.title = input.title.trim();
        if (input.content !== undefined) updatePayload.content = input.content.trim();
        if (input.type !== undefined) updatePayload.type = input.type;
        if (input.expiresAt !== undefined) {
            updatePayload.expires_at = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
        }
        if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

        const { data, error } = await supabase
            .from('system_announcements')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                id,
                title,
                content,
                type,
                is_active,
                expires_at,
                created_by,
                created_at,
                updated_at
            `)
            .single();

        if (error) throw error;

        const updated: SystemAnnouncement = {
            id: data.id,
            title: data.title,
            content: data.content,
            type: (data.type as SystemAnnouncementType) || 'info',
            is_active: data.is_active,
            expires_at: data.expires_at,
            created_by: data.created_by,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };

        return { data: updated, error: null };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error updating system announcement:', error);
        return { data: null, error };
    }
}

/**
 * Subscribes to real-time changes for both church and system announcements.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToAnnouncements(
    churchId: string | undefined,
    onUpdate: () => void
): () => void {
    const channelId = `announcements_${churchId || 'all'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'church_announcements',
                ...(churchId ? { filter: `church_id=eq.${churchId}` } : {}),
            },
            () => {
                onUpdate();
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'system_announcements',
            },
            () => {
                onUpdate();
            }
        )
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

/**
 * Subscribes specifically to church announcements real-time events.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToChurchAnnouncements(
    churchId: string | undefined,
    onUpdate: () => void
): () => void {
    const channelId = `church_announcements_${churchId || 'all'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'church_announcements',
                ...(churchId ? { filter: `church_id=eq.${churchId}` } : {}),
            },
            () => {
                onUpdate();
            }
        )
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

/**
 * Subscribes specifically to system announcements real-time events.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToSystemAnnouncements(
    onUpdate: () => void
): () => void {
    const channelId = `system_announcements_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'system_announcements',
            },
            () => {
                onUpdate();
            }
        )
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

/**
 * Type guard for UnifiedChurchAnnouncement
 */
export function isChurchAnnouncement(
    announcement: UnifiedAnnouncement
): announcement is UnifiedChurchAnnouncement {
    return announcement.kind === 'church';
}

/**
 * Type guard for UnifiedSystemAnnouncement
 */
export function isSystemAnnouncement(
    announcement: UnifiedAnnouncement
): announcement is UnifiedSystemAnnouncement {
    return announcement.kind === 'system';
}

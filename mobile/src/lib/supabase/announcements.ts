import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AnnouncementPriority = 'urgent' | 'advisory' | 'holy_week' | 'event' | 'general';
export type AnnouncementFilterTab = 'all' | 'diocesan' | 'parish' | 'events';

export interface Announcement {
  id: string;
  kind: 'system' | 'church';
  church_id: string | null;
  church_name: string;
  title: string;
  content: string;
  category: string;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  cover_image_url: string | null;
  created_at: string;
  scheduled_at: string | null;
  expires_at: string | null;
}

/**
 * Computes semantic announcement priority badge based on text and metadata.
 */
function computePriority(
  kind: 'system' | 'church',
  category?: string | null,
  type?: string | null,
  title?: string,
  content?: string
): AnnouncementPriority {
  const t = (title || '').toLowerCase();
  const c = (content || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  const typ = (type || '').toLowerCase();

  if (
    typ === 'warning' ||
    cat === 'emergency' ||
    t.includes('urgent') ||
    t.includes('alert') ||
    c.includes('urgent') ||
    c.includes('emergency')
  ) {
    return 'urgent';
  }

  if (
    t.includes('holy week') ||
    t.includes('lent') ||
    t.includes('easter') ||
    cat === 'holy_week' ||
    c.includes('holy week')
  ) {
    return 'holy_week';
  }

  if (
    cat === 'event' ||
    t.includes('event') ||
    t.includes('feast') ||
    t.includes('festival') ||
    t.includes('celebration') ||
    c.includes('feast day')
  ) {
    return 'event';
  }

  if (
    typ === 'maintenance' ||
    cat === 'reminder' ||
    cat === 'mass_schedule' ||
    typ === 'info' ||
    t.includes('advisory') ||
    t.includes('schedule adjustment')
  ) {
    return 'advisory';
  }

  return 'general';
}

/**
 * Fetches system-wide (church_id IS NULL) and church-specific announcements,
 * ordered by pinned status, priority, and created_at DESC.
 */
export async function fetchAnnouncements(churchId?: string): Promise<Announcement[]> {
  try {
    const results: Announcement[] = [];

    // 1. Fetch church announcements
    let churchQuery = supabase
      .from('church_announcements')
      .select(`
        id,
        church_id,
        title,
        content,
        category,
        is_pinned,
        scheduled_at,
        created_at,
        updated_at,
        church:churches(id, name, cover_image_url)
      `)
      .order('created_at', { ascending: false });

    if (churchId) {
      churchQuery = churchQuery.eq('church_id', churchId);
    }

    const { data: churchData, error: churchError } = await churchQuery;
    if (churchError) {
      console.warn('[Announcements] Error fetching church announcements:', churchError);
    } else if (churchData) {
      churchData.forEach((row: any) => {
        const churchObj = Array.isArray(row.church) ? row.church[0] : row.church;
        const priority = computePriority('church', row.category, null, row.title, row.content);
        results.push({
          id: row.id,
          kind: 'church',
          church_id: row.church_id,
          church_name: churchObj?.name || 'Local Parish',
          title: row.title,
          content: row.content,
          category: row.category || 'general',
          priority,
          is_pinned: Boolean(row.is_pinned),
          cover_image_url: churchObj?.cover_image_url || null,
          created_at: row.created_at,
          scheduled_at: row.scheduled_at,
          expires_at: null,
        });
      });
    }

    // 2. Fetch active system announcements
    let systemQuery = supabase
      .from('system_announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const { data: systemData, error: systemError } = await systemQuery;
    if (systemError) {
      console.warn('[Announcements] Error fetching system announcements:', systemError);
    } else if (systemData) {
      const now = Date.now();
      systemData.forEach((row: any) => {
        if (row.expires_at && new Date(row.expires_at).getTime() < now) {
          return;
        }
        const priority = computePriority('system', null, row.type, row.title, row.content);
        results.push({
          id: row.id,
          kind: 'system',
          church_id: null,
          church_name: 'Diocese of Davao',
          title: row.title,
          content: row.content,
          category: row.type || 'info',
          priority:
            priority === 'general' && (row.type === 'warning' || row.type === 'maintenance')
              ? 'urgent'
              : priority,
          is_pinned: row.type === 'warning' || Boolean(row.is_pinned),
          cover_image_url: null,
          created_at: row.created_at,
          scheduled_at: null,
          expires_at: row.expires_at,
        });
      });
    }

    // 3. Fallback: also check legacy announcements table if populated
    try {
      let legacyQuery = supabase
        .from('announcements')
        .select('*, church:churches(id, name, cover_image_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (churchId) {
        legacyQuery = legacyQuery.eq('church_id', churchId);
      }

      const { data: legacyData } = await legacyQuery;
      if (legacyData && legacyData.length > 0) {
        legacyData.forEach((row: any) => {
          const churchObj = Array.isArray(row.church) ? row.church[0] : row.church;
          const priority = computePriority('church', null, null, row.title, row.body);
          results.push({
            id: row.id,
            kind: 'church',
            church_id: row.church_id,
            church_name: churchObj?.name || 'Local Parish',
            title: row.title,
            content: row.body,
            category: 'general',
            priority,
            is_pinned: Boolean(row.is_pinned),
            cover_image_url: row.image_url || churchObj?.cover_image_url || null,
            created_at: row.created_at,
            scheduled_at: null,
            expires_at: row.expires_at,
          });
        });
      }
    } catch {
      // Ignored if table empty
    }

    // Sort: pinned first, then urgent, then created_at DESC
    return results.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const priorityOrder: Record<AnnouncementPriority, number> = {
        urgent: 4,
        holy_week: 3,
        advisory: 2,
        event: 1,
        general: 0,
      };

      const diffPriority = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (diffPriority !== 0) return diffPriority;

      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.error('[Announcements] Failed to fetch announcements:', err);
    return [];
  }
}

/**
 * TanStack Query hook to retrieve announcements feed.
 */
export function useAnnouncements(churchId?: string) {
  return useQuery({
    queryKey: ['announcements', churchId || 'all'],
    queryFn: () => fetchAnnouncements(churchId),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

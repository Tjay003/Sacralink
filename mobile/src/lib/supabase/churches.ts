import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface ChurchOperatingHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
  [key: string]: { open: string; close: string } | undefined;
}

export interface MassSchedule {
  id: string;
  church_id: string;
  day_of_week: string; // e.g., 'Sunday', 'Monday'
  time: string; // "06:00:00" or "08:00"
  time_start?: string;
  time_end?: string;
  language?: string | null; // e.g., 'English', 'Tagalog', 'Filipino'
  celebrant?: string | null;
  mass_type?: string | null;
  created_at?: string | null;
}

export interface Church {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  cover_image_url: string | null;
  featured_image_url?: string | null;
  panorama_url: string | null;
  livestream_url: string | null;
  livestream_title?: string | null;
  livestream_platform?: string | null;
  is_live?: boolean | null;
  candle_count?: number | null;
  livestream_started_at?: string | null;
  contact_number: string | null;
  email: string | null;
  description?: string | null;
  facebook_url?: string | null;
  gcash_number?: string | null;
  maya_number?: string | null;
  donation_qr_url?: string | null;
  operating_hours: ChurchOperatingHours | null;
  status: string | null;
  is_active: boolean | null;
  mass_schedules?: MassSchedule[];
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Known default coordinate fallbacks for diocese parishes whose lat/lng
 * has not yet been geocoded in the database.
 */
const KNOWN_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'st. joseph the worker parish': { latitude: 14.8138, longitude: 121.0453 },
  'sacred heart of jesus parish': { latitude: 14.8080, longitude: 121.0520 },
  'our lady of perpetual help quasi-parish': { latitude: 14.7920, longitude: 121.0550 },
  'san isidro labrador parish muzon': { latitude: 14.8028, longitude: 121.0332 },
  'quasi-parish of our lady of la salette.': { latitude: 14.7954, longitude: 121.0283 },
};

/**
 * Extract municipality / city name from full address string.
 */
export function extractCityFromAddress(address: string | null | undefined): string {
  if (!address) return 'San Jose Del Monte City';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const cityPart = parts.find((p) => /city/i.test(p));
    if (cityPart) return cityPart;
    return parts[parts.length - 2] || parts[parts.length - 1];
  }
  return parts[0] || 'San Jose Del Monte City';
}

/**
 * Normalize raw Supabase church record into Church interface.
 */
function normalizeChurch(raw: Record<string, any>): Church {
  const nameLower = (raw.name || '').toLowerCase().trim();
  const fallbackCoords = KNOWN_COORDINATES[nameLower];

  const latitude =
    raw.latitude !== null && raw.latitude !== undefined
      ? Number(raw.latitude)
      : fallbackCoords?.latitude ?? null;

  const longitude =
    raw.longitude !== null && raw.longitude !== undefined
      ? Number(raw.longitude)
      : fallbackCoords?.longitude ?? null;

  const cover_image_url =
    raw.cover_image_url || raw.featured_image_url || null;

  const city = raw.city || extractCityFromAddress(raw.address);

  return {
    id: raw.id,
    name: raw.name || 'Unnamed Parish',
    address: raw.address || 'Address pending',
    city,
    latitude,
    longitude,
    cover_image_url,
    featured_image_url: raw.featured_image_url || cover_image_url,
    panorama_url: raw.panorama_url || null,
    livestream_url: raw.livestream_url || null,
    livestream_title: raw.livestream_title || null,
    livestream_platform: raw.livestream_platform || 'youtube',
    is_live: Boolean(raw.is_live),
    candle_count: typeof raw.candle_count === 'number' ? raw.candle_count : 0,
    livestream_started_at: raw.livestream_started_at || null,
    contact_number: raw.contact_number || null,
    email: raw.email || null,
    description: raw.description || null,
    facebook_url: raw.facebook_url || null,
    gcash_number: raw.gcash_number || null,
    maya_number: raw.maya_number || null,
    donation_qr_url: raw.donation_qr_url || null,
    operating_hours: raw.operating_hours || null,
    status: raw.status || 'active',
    is_active: raw.is_active ?? true,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
  };
}

/**
 * Fetch all published (active) churches.
 */
export async function getChurches(): Promise<Church[]> {
  const { data, error } = await supabase
    .from('churches')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching churches from Supabase:', error);
    throw new Error(error.message);
  }

  return (data || [])
    .filter((c) => c.status !== 'inactive' && c.is_active !== false)
    .map(normalizeChurch);
}

/**
 * Day of week sorting order (Sunday first).
 */
const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Fetch a single church by id with its mass schedules.
 */
export async function getChurchById(id: string): Promise<Church | null> {
  const { data, error } = await supabase
    .from('churches')
    .select(`
      *,
      mass_schedules (*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching church by id:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  const normalized = normalizeChurch(data);

  // Normalize mass schedules
  const rawSchedules: Record<string, any>[] = (data as any).mass_schedules || [];
  const mass_schedules: MassSchedule[] = rawSchedules
    .map((s) => ({
      id: s.id,
      church_id: s.church_id,
      day_of_week: s.day_of_week || 'Sunday',
      time: s.time || s.time_start || '06:00:00',
      time_start: s.time_start || s.time || '06:00:00',
      time_end: s.time_end || undefined,
      language: s.language || 'English',
      celebrant: s.celebrant || null,
      mass_type: s.mass_type || 'regular',
      created_at: s.created_at || null,
    }))
    .sort((a, b) => {
      const orderA = DAY_ORDER[a.day_of_week] ?? 99;
      const orderB = DAY_ORDER[b.day_of_week] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.time || '').localeCompare(b.time || '');
    });

  return {
    ...normalized,
    mass_schedules,
  };
}

/**
 * TanStack Query hook to fetch all churches.
 */
export function useChurches() {
  return useQuery({
    queryKey: ['churches'],
    queryFn: getChurches,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * TanStack Query hook to fetch a single church by id.
 */
export function useChurch(id?: string) {
  return useQuery({
    queryKey: ['church', id],
    queryFn: () => (id ? getChurchById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Light a virtual candle and record intention for a parish.
 */
export async function lightChurchCandle(
  churchId: string,
  userIntention?: string | null
): Promise<{ success: boolean; candle_count: number }> {
  const { data, error } = await supabase.rpc('light_church_candle', {
    target_church_id: churchId,
    user_intention: userIntention?.trim() || null,
  });

  if (error) {
    console.error('Error lighting candle:', error);
    throw error;
  }

  return data;
}


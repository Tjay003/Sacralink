import { supabase } from './supabase';
import { calculateHaversineDistance, formatDistance } from './geo';
import type { Church } from '../types/database';

export const STANDARD_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

export interface SlotRecommendation {
  churchId: string;
  churchName: string;
  churchAddress?: string | null;
  distanceKm?: number;
  distanceFormatted?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  formattedDate: string;
  formattedTime: string;
  reason?: string;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  conflictReason?: string;
  sameChurchAlternative: SlotRecommendation | null;
  nearbyChurchAlternative: SlotRecommendation | null;
}

/**
 * Normalizes any time string (HH:MM:SS, HH:MM, "10:00 AM", "02:00 PM") into HH:MM (24-hour).
 */
export function normalizeTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();

  // 12-hour format with AM/PM
  if (/am|pm/i.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hour < 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  // 24-hour format HH:MM:SS or HH:MM
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const hour = parseInt(parts[0], 10);
    const minute = parts[1].slice(0, 2);
    if (!isNaN(hour)) {
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  return trimmed;
}

/**
 * Formats a 24-hour HH:MM time into standard 12-hour AM/PM string.
 */
export function formatTimeDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return '—';
  const normalized = normalizeTime(timeStr);
  const [hourStr, minuteStr] = normalized.split(':');
  let hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const minute = minuteStr || '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

/**
 * Formats a YYYY-MM-DD date string into a user-friendly format (e.g. "Tuesday, Sep 15, 2026").
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Helper to add days to a YYYY-MM-DD date string.
 */
function addDays(dateStr: string, daysToAdd: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

/**
 * Checks if a specific date and time slot is available at a given church.
 */
export async function isChurchSlotFree(
  churchId: string,
  dateStr: string,
  timeStr: string
): Promise<{ isFree: boolean; reason?: string }> {
  try {
    const normTime = normalizeTime(timeStr);

    // 1. Check existing appointments (pending, approved, rescheduled, completed)
    const { data: existingAppts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, status')
      .eq('church_id', churchId)
      .eq('appointment_date', dateStr);

    if (apptErr) {
      console.warn('⚠️ Non-fatal error checking appointment collisions:', apptErr);
    } else if (existingAppts && existingAppts.length > 0) {
      const activeAppts = existingAppts.filter(
        (a) => a.status !== 'rejected' && a.status !== 'cancelled'
      );
      const isTaken = activeAppts.some((a) => {
        const apptNorm = normalizeTime(a.appointment_time);
        return apptNorm === normTime;
      });

      if (isTaken) {
        return { isFree: false, reason: 'This time slot is already booked by another parishioner.' };
      }
    }

    // 2. Check priest availability blocked dates
    const { data: priestBlocks, error: priestErr } = await supabase
      .from('priest_availability')
      .select('id, is_blocked, start_time, end_time, notes')
      .eq('church_id', churchId)
      .eq('available_date', dateStr)
      .eq('is_blocked', true);

    if (priestErr) {
      console.warn('⚠️ Non-fatal error checking priest availability:', priestErr);
    } else if (priestBlocks && priestBlocks.length > 0) {
      // Check if any block covers the requested time or the whole day
      for (const block of priestBlocks) {
        if (!block.start_time || !block.end_time) {
          return { isFree: false, reason: block.notes || 'Priest is unavailable on this date.' };
        }
        const blockStart = normalizeTime(block.start_time);
        const blockEnd = normalizeTime(block.end_time);
        if (normTime >= blockStart && normTime <= blockEnd) {
          return { isFree: false, reason: block.notes || 'Priest is unavailable during this time.' };
        }
      }
    }

    return { isFree: true };
  } catch (err) {
    console.error('Error in isChurchSlotFree:', err);
    return { isFree: true };
  }
}

/**
 * Finds the earliest next available slot at the given church starting from the requested date and time.
 */
export async function findNextAvailableSlotAtChurch(
  church: Church,
  requestedDate: string,
  requestedTime: string
): Promise<SlotRecommendation | null> {
  const normReqTime = normalizeTime(requestedTime);

  // 1. Check later standard slots on the SAME date
  for (const slot of STANDARD_TIME_SLOTS) {
    if (slot > normReqTime) {
      const { isFree } = await isChurchSlotFree(church.id, requestedDate, slot);
      if (isFree) {
        return {
          churchId: church.id,
          churchName: church.name,
          churchAddress: church.address,
          date: requestedDate,
          time: slot,
          formattedDate: formatDateDisplay(requestedDate),
          formattedTime: formatTimeDisplay(slot),
          reason: `Next open slot today at ${church.name}`,
        };
      }
    }
  }

  // 2. Check upcoming dates up to 14 days ahead
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const candidateDate = addDays(requestedDate, dayOffset);
    for (const slot of STANDARD_TIME_SLOTS) {
      const { isFree } = await isChurchSlotFree(church.id, candidateDate, slot);
      if (isFree) {
        return {
          churchId: church.id,
          churchName: church.name,
          churchAddress: church.address,
          date: candidateDate,
          time: slot,
          formattedDate: formatDateDisplay(candidateDate),
          formattedTime: formatTimeDisplay(slot),
          reason: `Earliest opening at ${church.name}`,
        };
      }
    }
  }

  return null;
}

/**
 * Finds the nearest alternative parish offering an open slot on the requested date (or earliest slot).
 */
export async function findNearestAlternativeParish(
  currentChurch: Church,
  allChurches: Church[],
  requestedDate: string,
  requestedTime: string
): Promise<SlotRecommendation | null> {
  const otherChurches = allChurches.filter(
    (c) =>
      c.id !== currentChurch.id &&
      (c.status === 'verified_active' || c.status === 'active' || !c.status) &&
      c.status !== 'unverified' &&
      c.status !== 'pending' &&
      c.status !== 'inactive' &&
      c.is_active !== false
  );

  if (otherChurches.length === 0) {
    return null;
  }

  // Calculate distance for all other churches with coordinates (CSJDM default center: 14.8135, 121.0453)
  const CSJDM_LAT = 14.8135;
  const CSJDM_LON = 121.0453;
  const currentLat = currentChurch.latitude ?? CSJDM_LAT;
  const currentLon = currentChurch.longitude ?? CSJDM_LON;

  const candidateList = otherChurches.map((c) => {
    const candLat = c.latitude ?? CSJDM_LAT;
    const candLon = c.longitude ?? CSJDM_LON;
    const distanceKm = calculateHaversineDistance(currentLat, currentLon, candLat, candLon);
    return {
      church: c,
      distanceKm,
    };
  });

  // Sort by shortest distance first
  candidateList.sort((a, b) => a.distanceKm - b.distanceKm);

  const normReqTime = normalizeTime(requestedTime);

  // Check closest churches for availability on requested date
  for (const { church, distanceKm } of candidateList) {
    // Check if the requested time slot is available at this church
    const { isFree: reqTimeFree } = await isChurchSlotFree(church.id, requestedDate, normReqTime);
    if (reqTimeFree) {
      return {
        churchId: church.id,
        churchName: church.name,
        churchAddress: church.address,
        distanceKm,
        distanceFormatted: formatDistance(distanceKm),
        date: requestedDate,
        time: normReqTime,
        formattedDate: formatDateDisplay(requestedDate),
        formattedTime: formatTimeDisplay(normReqTime),
        reason: `Nearest parish with open slot on requested date`,
      };
    }

    // Otherwise check standard slots on the requested date
    for (const slot of STANDARD_TIME_SLOTS) {
      const { isFree } = await isChurchSlotFree(church.id, requestedDate, slot);
      if (isFree) {
        return {
          churchId: church.id,
          churchName: church.name,
          churchAddress: church.address,
          distanceKm,
          distanceFormatted: formatDistance(distanceKm),
          date: requestedDate,
          time: slot,
          formattedDate: formatDateDisplay(requestedDate),
          formattedTime: formatTimeDisplay(slot),
          reason: `Nearest parish with open slot on requested date`,
        };
      }
    }
  }

  // Fallback: If no slots open on requested date at any nearby church, find the nearest candidate's next open date
  if (candidateList.length > 0) {
    const nearest = candidateList[0];
    const nextSlot = await findNextAvailableSlotAtChurch(nearest.church, requestedDate, requestedTime);
    if (nextSlot) {
      return {
        ...nextSlot,
        distanceKm: nearest.distanceKm,
        distanceFormatted: formatDistance(nearest.distanceKm),
        reason: `Nearest alternative parish`,
      };
    }
  }

  return null;
}

/**
 * Main entry point: Validates availability of a requested slot and computes smart alternatives if unavailable.
 */
export async function evaluateSlotAndRecommendations(
  currentChurch: Church,
  allChurches: Church[],
  _serviceType: string,
  requestedDate: string,
  requestedTime: string
): Promise<AvailabilityCheckResult> {
  if (!requestedDate || !requestedTime || !currentChurch) {
    return {
      isAvailable: true,
      sameChurchAlternative: null,
      nearbyChurchAlternative: null,
    };
  }

  // 1. Check if requested slot is free
  const { isFree, reason } = await isChurchSlotFree(currentChurch.id, requestedDate, requestedTime);

  if (isFree) {
    return {
      isAvailable: true,
      sameChurchAlternative: null,
      nearbyChurchAlternative: null,
    };
  }

  // 2. If taken/blocked, compute dual alternatives in parallel
  const [sameChurchAlternative, nearbyChurchAlternative] = await Promise.all([
    findNextAvailableSlotAtChurch(currentChurch, requestedDate, requestedTime),
    findNearestAlternativeParish(currentChurch, allChurches, requestedDate, requestedTime),
  ]);

  return {
    isAvailable: false,
    conflictReason: reason || 'The selected date and time slot is currently unavailable.',
    sameChurchAlternative,
    nearbyChurchAlternative,
  };
}

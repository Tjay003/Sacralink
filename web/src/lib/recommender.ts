import { checkParishSlot } from './supabase/priestAvailability';
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

/**
 * Limits on the check_parish_slot calls one availability check may make while it scans for alternatives.
 * Each scan stops at its first open slot, sends at most SLOT_CHECK_CONCURRENCY calls at once, and gives up
 * when its budget is spent, so one check never exceeds 1 + 72 + 60 calls (nearer 10 in practice).
 */
export const SLOT_CHECK_CONCURRENCY = 6;
/** Days after the requested date that the same-parish scan looks through. */
export const SAME_CHURCH_SCAN_DAYS = 7;
/** Nearest other parishes tried for an open slot on the requested date. */
export const NEARBY_CHURCH_LIMIT = 3;
export const SAME_CHURCH_CHECK_BUDGET = 72;
export const NEARBY_CHECK_BUDGET = 60;

/** Shown when a pending or approved request already holds the slot. */
export const SLOT_TAKEN_REASON = 'This time slot is already booked by another parishioner.';
/** Shown when every priest of the parish is away or committed; never says why. */
export const NO_CELEBRANT_REASON = 'No celebrant is available at this time.';

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

interface SlotVerdict {
  isFree: boolean;
  reason?: string;
  /** The check could not run; the slot is neither confirmed free nor taken. */
  failed: boolean;
}

interface SlotCandidate {
  date: string;
  time: string;
}

/** The calls one availability check has made or may still make, shared by the scans it starts. */
interface SlotScan {
  signal?: AbortSignal;
  cache: Map<string, Promise<SlotVerdict>>;
  remaining: number;
}

function createScan(
  budget: number,
  signal?: AbortSignal,
  cache: Map<string, Promise<SlotVerdict>> = new Map()
): SlotScan {
  return { signal, cache, remaining: budget };
}

function slotKey(churchId: string, candidate: SlotCandidate): string {
  return `${churchId}|${candidate.date}|${candidate.time}`;
}

/**
 * Asks the parish slot check whether the slot is taken and whether any priest of the parish could preside.
 * A parish without priests only has the taken check. Answers are cached for the whole availability check.
 */
function inspectSlot(
  churchId: string,
  candidate: SlotCandidate,
  cache: Map<string, Promise<SlotVerdict>>
): Promise<SlotVerdict> {
  const key = slotKey(churchId, candidate);
  const cached = cache.get(key);
  if (cached) return cached;

  const verdict = checkParishSlot(churchId, candidate.date, candidate.time).then(
    ({ data, error }): SlotVerdict => {
      if (error || !data) {
        console.warn('⚠️ Non-fatal error checking parish slot:', error);
        return { isFree: true, failed: true };
      }
      if (data.slotTaken) return { isFree: false, reason: SLOT_TAKEN_REASON, failed: false };
      if (!data.hasEligiblePriest) return { isFree: false, reason: NO_CELEBRANT_REASON, failed: false };
      return { isFree: true, failed: false };
    }
  );
  cache.set(key, verdict);
  return verdict;
}

/**
 * Checks if a specific date and time slot is available at a given church: not already requested by
 * someone else, and at least one priest of the parish eligible (a parish without priests has no priest
 * constraint). Fails open when the check cannot run.
 */
export async function isChurchSlotFree(
  churchId: string,
  dateStr: string,
  timeStr: string
): Promise<{ isFree: boolean; reason?: string }> {
  try {
    const { isFree, reason } = await inspectSlot(
      churchId,
      { date: dateStr, time: normalizeTime(timeStr) },
      new Map()
    );
    return { isFree, reason };
  } catch (err) {
    console.error('Error in isChurchSlotFree:', err);
    return { isFree: true };
  }
}

/**
 * Returns the first candidate, in order, whose slot is open. Candidates are checked a few at a time and
 * the scan ends at its first hit, when the budget is spent, or when the caller aborts. A check that fails
 * is never recommended.
 */
async function firstOpenSlot(
  churchId: string,
  candidates: SlotCandidate[],
  scan: SlotScan
): Promise<SlotCandidate | null> {
  let index = 0;
  while (index < candidates.length) {
    if (scan.signal?.aborted) return null;

    const chunk: SlotCandidate[] = [];
    let fresh = 0;
    while (index < candidates.length && fresh < Math.min(SLOT_CHECK_CONCURRENCY, scan.remaining)) {
      const candidate = candidates[index++];
      if (!scan.cache.has(slotKey(churchId, candidate))) fresh += 1;
      chunk.push(candidate);
    }
    if (chunk.length === 0) return null;

    scan.remaining -= fresh;
    const verdicts = await Promise.all(chunk.map((c) => inspectSlot(churchId, c, scan.cache)));
    const hit = verdicts.findIndex((v) => v.isFree && !v.failed);
    if (hit >= 0) return chunk[hit];
  }
  return null;
}

/** Later standard slots on the requested date, then every standard slot on the following days. */
function upcomingCandidates(requestedDate: string, normReqTime: string): SlotCandidate[] {
  const candidates: SlotCandidate[] = STANDARD_TIME_SLOTS.filter((slot) => slot > normReqTime).map((slot) => ({
    date: requestedDate,
    time: slot,
  }));
  for (let dayOffset = 1; dayOffset <= SAME_CHURCH_SCAN_DAYS; dayOffset++) {
    const date = addDays(requestedDate, dayOffset);
    for (const slot of STANDARD_TIME_SLOTS) {
      candidates.push({ date, time: slot });
    }
  }
  return candidates;
}

async function nextSlotAtChurch(
  church: Church,
  requestedDate: string,
  requestedTime: string,
  scan: SlotScan
): Promise<SlotRecommendation | null> {
  const found = await firstOpenSlot(
    church.id,
    upcomingCandidates(requestedDate, normalizeTime(requestedTime)),
    scan
  );
  if (!found) return null;
  return {
    churchId: church.id,
    churchName: church.name,
    churchAddress: church.address,
    date: found.date,
    time: found.time,
    formattedDate: formatDateDisplay(found.date),
    formattedTime: formatTimeDisplay(found.time),
    reason:
      found.date === requestedDate
        ? `Next open slot today at ${church.name}`
        : `Earliest opening at ${church.name}`,
  };
}

/**
 * Finds the earliest next available slot at the given church starting from the requested date and time.
 * A slot counts as available only when it is not taken and the parish has an eligible priest (or none).
 */
export async function findNextAvailableSlotAtChurch(
  church: Church,
  requestedDate: string,
  requestedTime: string,
  signal?: AbortSignal
): Promise<SlotRecommendation | null> {
  return nextSlotAtChurch(church, requestedDate, requestedTime, createScan(SAME_CHURCH_CHECK_BUDGET, signal));
}

async function nearestAlternativeParish(
  currentChurch: Church,
  allChurches: Church[],
  requestedDate: string,
  requestedTime: string,
  scan: SlotScan
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

  // The requested time first, then the standard slots, on the requested date
  const sameDayCandidates: SlotCandidate[] = [
    normReqTime,
    ...STANDARD_TIME_SLOTS.filter((slot) => slot !== normReqTime),
  ].map((time) => ({ date: requestedDate, time }));

  // Check the closest churches for availability on requested date
  for (const { church, distanceKm } of candidateList.slice(0, NEARBY_CHURCH_LIMIT)) {
    const found = await firstOpenSlot(church.id, sameDayCandidates, scan);
    if (found) {
      return {
        churchId: church.id,
        churchName: church.name,
        churchAddress: church.address,
        distanceKm,
        distanceFormatted: formatDistance(distanceKm),
        date: found.date,
        time: found.time,
        formattedDate: formatDateDisplay(found.date),
        formattedTime: formatTimeDisplay(found.time),
        reason: `Nearest parish with open slot on requested date`,
      };
    }
  }

  // Fallback: If no slots open on requested date at any nearby church, find the nearest candidate's next open date
  if (candidateList.length > 0) {
    const nearest = candidateList[0];
    const nextSlot = await nextSlotAtChurch(nearest.church, requestedDate, requestedTime, scan);
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
 * Finds the nearest alternative parish offering an open slot on the requested date (or earliest slot).
 * Only the nearest NEARBY_CHURCH_LIMIT parishes are tried for the requested date.
 */
export async function findNearestAlternativeParish(
  currentChurch: Church,
  allChurches: Church[],
  requestedDate: string,
  requestedTime: string,
  signal?: AbortSignal
): Promise<SlotRecommendation | null> {
  return nearestAlternativeParish(
    currentChurch,
    allChurches,
    requestedDate,
    requestedTime,
    createScan(NEARBY_CHECK_BUDGET, signal)
  );
}

/**
 * Main entry point: Validates availability of a requested slot and computes smart alternatives if unavailable.
 * Pass a signal to stop scanning once the parishioner has changed the date or time.
 */
export async function evaluateSlotAndRecommendations(
  currentChurch: Church,
  allChurches: Church[],
  _serviceType: string,
  requestedDate: string,
  requestedTime: string,
  signal?: AbortSignal
): Promise<AvailabilityCheckResult> {
  if (!requestedDate || !requestedTime || !currentChurch) {
    return {
      isAvailable: true,
      sameChurchAlternative: null,
      nearbyChurchAlternative: null,
    };
  }

  // 1. Check if requested slot is free
  const cache = new Map<string, Promise<SlotVerdict>>();
  const requested = await inspectSlot(
    currentChurch.id,
    { date: requestedDate, time: normalizeTime(requestedTime) },
    cache
  );

  if (requested.isFree) {
    return {
      isAvailable: true,
      sameChurchAlternative: null,
      nearbyChurchAlternative: null,
    };
  }

  // 2. If taken or without an eligible celebrant, compute dual alternatives in parallel
  const [sameChurchAlternative, nearbyChurchAlternative] = await Promise.all([
    nextSlotAtChurch(
      currentChurch,
      requestedDate,
      requestedTime,
      createScan(SAME_CHURCH_CHECK_BUDGET, signal, cache)
    ),
    nearestAlternativeParish(
      currentChurch,
      allChurches,
      requestedDate,
      requestedTime,
      createScan(NEARBY_CHECK_BUDGET, signal, cache)
    ),
  ]);

  return {
    isAvailable: false,
    conflictReason: requested.reason || 'The selected date and time slot is currently unavailable.',
    sameChurchAlternative,
    nearbyChurchAlternative,
  };
}

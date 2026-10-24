import { checkParishSlot, evaluateParishPool } from './supabase/priestAvailability';
import {
  createAppointmentWithDocuments,
  validateBookingSubmission,
  validateFutureDate,
  type BookingRequirementLike,
} from './supabase/appointments';
import { formatDateDisplay, formatTimeDisplay, STANDARD_TIME_SLOTS } from './recommender';

export type BookingStep = 'service' | 'date' | 'time' | 'priest' | 'documents' | 'notes' | 'summary' | 'confirmed';

export interface BookingDraft {
  churchId: string;
  churchName?: string;
  serviceTypeId?: string;
  serviceTypeName?: string;
  serviceKind?: string | null;
  date?: string; // YYYY-MM-DD
  formattedDate?: string;
  time?: string; // HH:MM
  formattedTime?: string;
  requestedPriestId?: string | null;
  requestedPriestName?: string | null;
  priestWarning?: string | null;
  hasRequirements?: boolean;
  attachedRequirementIds?: string[];
  notes?: string;
  step: BookingStep;
}

export const BOOKING_DRAFT_STORAGE_KEY = 'sacralink:booking-draft';

/**
 * Loads the active booking draft from sessionStorage if present.
 */
export function getStoredBookingDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingDraft;
  } catch (err) {
    console.warn('Could not parse booking draft from sessionStorage:', err);
    return null;
  }
}

/**
 * Persists the booking draft to sessionStorage.
 */
export function saveStoredBookingDraft(draft: BookingDraft | null): void {
  try {
    if (!draft) {
      sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    } else {
      sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  } catch (err) {
    console.warn('Could not save booking draft to sessionStorage:', err);
  }
}

/**
 * Clears any active booking draft from sessionStorage.
 */
export function clearStoredBookingDraft(): void {
  try {
    sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Helper to generate candidate future dates (e.g. tomorrow through day 7).
 * Strictly guarantees past dates are never offered.
 */
export function getFutureDateCandidates(count = 7): Array<{ date: string; label: string }> {
  const candidates: Array<{ date: string; label: string }> = [];
  const now = new Date();

  for (let i = 1; i <= count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    // Verify it passes validateFutureDate
    if (validateFutureDate(dateStr, undefined, now).ok) {
      candidates.push({
        date: dateStr,
        label: formatDateDisplay(dateStr),
      });
    }
  }

  return candidates;
}

/**
 * Checks all standard time slots for a given church and date,
 * filtering out any slot that is already booked or has no available celebrant.
 */
export async function getOpenTimeSlots(
  churchId: string,
  dateStr: string
): Promise<Array<{ time: string; label: string }>> {
  if (!churchId || !dateStr) return [];

  const slotResults = await Promise.all(
    STANDARD_TIME_SLOTS.map(async (slot) => {
      try {
        const { data, error } = await checkParishSlot(churchId, dateStr, slot);
        if (error || !data) {
          return { slot, isAvailable: true };
        }
        // Slot is open only if not taken AND has an eligible priest (or parish has 0 priests)
        const isAvailable = !data.slotTaken && data.hasEligiblePriest;
        return { slot, isAvailable };
      } catch {
        return { slot, isAvailable: true };
      }
    })
  );

  return slotResults
    .filter((res) => res.isAvailable)
    .map((res) => ({
      time: res.slot,
      label: formatTimeDisplay(res.slot),
    }));
}

/**
 * Checks whether a specific requested priest is eligible at the chosen date and time.
 * If ineligible, returns a non-blocking warning without leaking private reasons.
 */
export async function evaluateRequestedPriest(
  churchId: string,
  priestId: string,
  dateStr: string,
  timeStr: string,
  priestName: string
): Promise<{ eligible: boolean; warning?: string }> {
  try {
    const { data } = await evaluateParishPool(churchId, dateStr, timeStr);
    const verdict = data?.find((p) => p.priestId === priestId);
    if (verdict && !verdict.eligible) {
      return {
        eligible: false,
        warning: `Note: ${priestName} may be unavailable at this time. Your preference has been noted, but the parish office may assign another celebrant.`,
      };
    }
    return { eligible: true };
  } catch (err) {
    console.warn('Priest availability evaluation error:', err);
    return { eligible: true };
  }
}

export interface SubmitBookingParams {
  draft: BookingDraft;
  userId: string;
  userName?: string;
  documents?: Map<string, File> | Array<{ requirementId: string; file: File }>;
  requirements?: BookingRequirementLike[];
}

export interface SubmitBookingResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
}

/**
 * Submits the confirmed booking draft through createAppointmentWithDocuments.
 * Validates future date, verifies slot availability, validates required documents,
 * stores preference as requested_priest_id, and notifies parish office admins.
 */
export async function submitConfirmedBooking(
  params: SubmitBookingParams
): Promise<SubmitBookingResult> {
  const { draft, userId, userName, documents, requirements } = params;

  if (!draft.churchId || !draft.serviceTypeName || !draft.date || !draft.time) {
    return { success: false, error: 'Incomplete booking details.' };
  }

  // 1. Static validation rules from ticket 02
  const validation = validateBookingSubmission({
    appointmentDate: draft.date,
    appointmentTime: draft.time,
    availability: true,
    requirements,
    documents,
  });

  if (!validation.ok) {
    return { success: false, error: validation.error || 'Invalid booking details.' };
  }

  // 2. Fresh slot availability check right before insert
  const { data: slotCheck } = await checkParishSlot(draft.churchId, draft.date, draft.time);
  if (slotCheck?.slotTaken) {
    return {
      success: false,
      error: 'The selected slot is unavailable. Please select an alternative slot or change the date and time.',
    };
  }

  // 3. Create appointment with documents & admin notifications
  const { data: appointment, error } = await createAppointmentWithDocuments({
    userId,
    churchId: draft.churchId,
    serviceType: draft.serviceTypeName,
    serviceTypeId: draft.serviceTypeId ?? null,
    appointmentDate: draft.date,
    appointmentTime: draft.time,
    notes: draft.notes || null,
    userName: userName || 'A parishioner',
    requestedPriestId: draft.requestedPriestId || null,
    documents,
  });

  if (error || !appointment) {
    const errorMsg = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : (error ? String(error) : 'Failed to submit appointment booking. Please try again.'));
    return {
      success: false,
      error: errorMsg,
    };
  }

  // 4. Clear draft from sessionStorage
  clearStoredBookingDraft();

  return {
    success: true,
    appointmentId: appointment.id,
  };
}

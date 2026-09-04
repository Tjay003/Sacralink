import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AppointmentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'rescheduled'
  | 'completed'
  | 'cancelled';

export interface AppointmentDocument {
  id: string;
  appointment_id: string;
  requirement_id?: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number | null;
  uploaded_at?: string;
  uploaded_by?: string | null;
  sacrament_requirements?: SacramentRequirement | null;
}

export interface SacramentRequirement {
  id: string;
  church_id?: string;
  service_type: string;
  requirement_name: string;
  is_required: boolean;
  allowed_file_types?: string[];
  description?: string | null;
  display_order?: number;
  created_at?: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  church_id: string;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  notes?: string | null;
  admin_feedback?: string | null;
  created_at?: string;
  updated_at?: string;
  church?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    cover_image_url?: string | null;
    contact_number?: string | null;
  } | null;
  appointment_documents?: AppointmentDocument[];
}

export interface UploadedDocumentInput {
  requirementId?: string;
  requirementName: string;
  fileUri: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface CreateAppointmentInput {
  userId: string;
  churchId: string;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string | null;
  contactPerson?: string;
  contactPhone?: string;
}

export interface SlotAvailabilityResult {
  available: boolean;
  reason?: string;
}

export interface SacramentMeta {
  type: string;
  title: string;
  durationMinutes: number;
  durationText: string;
  description: string;
  badge: string;
}

export const SACRAMENTS_META: SacramentMeta[] = [
  {
    type: 'Baptism',
    title: 'Holy Baptism',
    durationMinutes: 60,
    durationText: '60 mins',
    description: 'Sacrament of initiation, cleansing original sin and entering the Church family.',
    badge: 'Initiation',
  },
  {
    type: 'Wedding',
    title: 'Holy Matrimony',
    durationMinutes: 90,
    durationText: '90 mins',
    description: 'Sacred nuptial ceremony uniting a man and a woman in holy Catholic covenant.',
    badge: 'Vocation',
  },
  {
    type: 'Funeral',
    title: 'Funeral Mass',
    durationMinutes: 60,
    durationText: '60 mins',
    description: 'Requiem liturgy, commendation, and prayers for the repose of the faithful departed.',
    badge: 'Memorial',
  },
  {
    type: 'Confirmation',
    title: 'Sacrament of Confirmation',
    durationMinutes: 60,
    durationText: '60 mins',
    description: 'Deepening baptismal grace, sealed with the seven gifts of the Holy Spirit.',
    badge: 'Initiation',
  },
  {
    type: 'Counseling',
    title: 'Pastoral Counseling',
    durationMinutes: 45,
    durationText: '45 mins',
    description: 'Spiritual direction, pastoral guidance, or pre-marital counseling with a priest.',
    badge: 'Pastoral',
  },
  {
    type: 'Mass Intention',
    title: 'Mass Intention',
    durationMinutes: 45,
    durationText: '45 mins',
    description: 'Offering holy masses for thanksgiving, healing, birthdays, or departed souls.',
    badge: 'Devotion',
  },
  {
    type: 'Confession',
    title: 'Sacrament of Reconciliation',
    durationMinutes: 30,
    durationText: '30 mins',
    description: 'Confession of sins, penance, absolution, and reconciliation with God.',
    badge: 'Healing',
  },
  {
    type: 'Anointing',
    title: 'Anointing of the Sick',
    durationMinutes: 45,
    durationText: '45 mins',
    description: 'Spiritual strength, peace, and holy anointing for those facing grave illness or surgery.',
    badge: 'Healing',
  },
  {
    type: 'Blessing',
    title: 'Parish Blessing',
    durationMinutes: 30,
    durationText: '30 mins',
    description: 'Dedicated blessing for home, vehicle, store, religious icons, or personal items.',
    badge: 'Devotion',
  },
];

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
 * Normalizes time string to HH:MM format.
 */
export function normalizeTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();

  // AM/PM format
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

  // 24-hour format
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
 * Format time to 12-hour AM/PM string.
 */
export function formatAppointmentTime(timeStr: string | null | undefined): string {
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
 * Format date string (YYYY-MM-DD) into user-friendly format (e.g., "Sat, Oct 10, 2026").
 */
export function formatAppointmentDate(dateStr: string | null | undefined): string {
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
 * Default fallback document requirements per sacrament if none configured in database.
 */
export function getDefaultSacramentRequirements(sacramentType: string): SacramentRequirement[] {
  const norm = (sacramentType || '').toLowerCase().trim();

  switch (norm) {
    case 'baptism':
      return [
        {
          id: 'fallback-baptism-1',
          service_type: 'Baptism',
          requirement_name: 'PSA / Civil Birth Certificate',
          is_required: true,
          description: 'Official birth certificate of the child.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
        {
          id: 'fallback-baptism-2',
          service_type: 'Baptism',
          requirement_name: 'Parents Marriage Certificate',
          is_required: false,
          description: 'Church or civil marriage contract of parents.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 2,
        },
        {
          id: 'fallback-baptism-3',
          service_type: 'Baptism',
          requirement_name: 'Godparents Confirmation Certificate',
          is_required: true,
          description: 'Catholic confirmation certificate of principal sponsors.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 3,
        },
      ];

    case 'wedding':
      return [
        {
          id: 'fallback-wedding-1',
          service_type: 'Wedding',
          requirement_name: 'Baptismal Certificate (For Marriage)',
          is_required: true,
          description: 'Issued within 6 months with notation "For Marriage Purposes".',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
        {
          id: 'fallback-wedding-2',
          service_type: 'Wedding',
          requirement_name: 'Confirmation Certificate',
          is_required: true,
          description: 'Church confirmation certificate of both bride and groom.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 2,
        },
        {
          id: 'fallback-wedding-3',
          service_type: 'Wedding',
          requirement_name: 'PSA CENOMAR',
          is_required: true,
          description: 'Certificate of No Marriage record issued within 6 months.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 3,
        },
        {
          id: 'fallback-wedding-4',
          service_type: 'Wedding',
          requirement_name: 'Pre-Cana Seminar Certificate',
          is_required: true,
          description: 'Certificate of completion for pre-marriage seminar.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 4,
        },
      ];

    case 'funeral':
      return [
        {
          id: 'fallback-funeral-1',
          service_type: 'Funeral',
          requirement_name: 'PSA / City Death Certificate',
          is_required: true,
          description: 'Certified true copy of the registered death certificate.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
        {
          id: 'fallback-funeral-2',
          service_type: 'Funeral',
          requirement_name: 'Burial / Transfer Permit',
          is_required: false,
          description: 'Official cemetery burial or transport clearance permit.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 2,
        },
      ];

    case 'confirmation':
      return [
        {
          id: 'fallback-confirmation-1',
          service_type: 'Confirmation',
          requirement_name: 'Baptismal Certificate',
          is_required: true,
          description: 'Original or certified copy of baptismal record.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
        {
          id: 'fallback-confirmation-2',
          service_type: 'Confirmation',
          requirement_name: 'First Communion Certificate',
          is_required: true,
          description: 'Proof of reception of First Holy Eucharist.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 2,
        },
        {
          id: 'fallback-confirmation-3',
          service_type: 'Confirmation',
          requirement_name: 'Sponsor Certificate of Eligibility',
          is_required: false,
          description: 'Confirmation and church standing certification of godparent.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 3,
        },
      ];

    case 'counseling':
      return [
        {
          id: 'fallback-counseling-1',
          service_type: 'Counseling',
          requirement_name: 'Valid Government Issued ID',
          is_required: true,
          description: 'Passport, Drivers License, UMID, or National ID.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
      ];

    case 'mass intention':
      return [
        {
          id: 'fallback-mass-intention-1',
          service_type: 'Mass Intention',
          requirement_name: 'Names & Intention Notes',
          is_required: true,
          description: 'List of names for thanksgiving, healing, or repose of souls.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
      ];

    case 'anointing':
      return [
        {
          id: 'fallback-anointing-1',
          service_type: 'Anointing',
          requirement_name: 'Medical Certificate / Hospital Record',
          is_required: false,
          description: 'Optional clinical diagnosis or room/hospital location document.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
      ];

    default:
      return [
        {
          id: `fallback-${norm || 'general'}-1`,
          service_type: sacramentType,
          requirement_name: 'Valid Government ID',
          is_required: false,
          description: 'Identification document for verification.',
          allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png'],
          display_order: 1,
        },
      ];
  }
}

/**
 * Fetch all appointments for a user with joined church details and documents.
 */
export async function getAppointments(userId: string): Promise<Appointment[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        church:churches(id, name, address, city, cover_image_url, contact_number),
        appointment_documents(id, appointment_id, requirement_id, file_url, file_name, file_type, file_size, uploaded_at)
      `)
      .eq('user_id', userId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (error) {
      console.error('Error fetching appointments:', error);
      throw new Error(error.message);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      church_id: row.church_id,
      service_type: row.service_type,
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      status: row.status as AppointmentStatus,
      notes: row.notes,
      admin_feedback: row.admin_feedback,
      created_at: row.created_at,
      updated_at: row.updated_at,
      church: row.church
        ? {
            id: row.church.id,
            name: row.church.name,
            address: row.church.address,
            city: row.church.city,
            cover_image_url: row.church.cover_image_url,
            contact_number: row.church.contact_number,
          }
        : null,
      appointment_documents: row.appointment_documents || [],
    }));
  } catch (err) {
    console.error('Exception in getAppointments:', err);
    throw err;
  }
}

/**
 * Fetch required documents for a sacrament from sacrament_requirements table,
 * falling back to standard requirements if empty.
 */
export async function getSacramentRequirements(
  sacramentType: string,
  churchId?: string
): Promise<SacramentRequirement[]> {
  if (!sacramentType) return [];

  try {
    let query = supabase
      .from('sacrament_requirements')
      .select('*')
      .ilike('service_type', sacramentType)
      .order('display_order', { ascending: true });

    if (churchId) {
      query = query.eq('church_id', churchId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        church_id: item.church_id,
        service_type: item.service_type,
        requirement_name: item.requirement_name,
        is_required: item.is_required ?? true,
        allowed_file_types: item.allowed_file_types || ['pdf', 'jpg', 'jpeg', 'png'],
        description: item.description || null,
        display_order: item.display_order ?? 0,
        created_at: item.created_at,
      }));
    }

    // Return standard fallbacks
    return getDefaultSacramentRequirements(sacramentType);
  } catch (err) {
    console.warn('Error fetching sacrament requirements, using fallbacks:', err);
    return getDefaultSacramentRequirements(sacramentType);
  }
}

/**
 * Checks priest availability and existing appointments to determine slot availability.
 */
export async function checkSlotAvailability(
  churchId: string,
  date: string,
  time: string,
  _sacramentType?: string
): Promise<SlotAvailabilityResult> {
  if (!churchId || !date || !time) {
    return { available: true };
  }

  try {
    const normTime = normalizeTime(time);

    // 1. Check existing appointments (pending, approved, rescheduled)
    const { data: existingAppts, error: apptError } = await supabase
      .from('appointments')
      .select('id, appointment_time, status')
      .eq('church_id', churchId)
      .eq('appointment_date', date);

    if (apptError) {
      console.warn('Warning checking appointments collision:', apptError);
    } else if (existingAppts && existingAppts.length > 0) {
      const activeAppts = existingAppts.filter(
        (a) => a.status !== 'rejected' && a.status !== 'cancelled'
      );
      const isTaken = activeAppts.some((a) => {
        const apptNorm = normalizeTime(a.appointment_time);
        return apptNorm === normTime;
      });

      if (isTaken) {
        return {
          available: false,
          reason: 'This time slot is already booked by another parishioner.',
        };
      }
    }

    // 2. Check priest availability blocked dates
    const { data: priestBlocks, error: priestError } = await supabase
      .from('priest_availability')
      .select('id, is_blocked, start_time, end_time, notes')
      .eq('church_id', churchId)
      .eq('available_date', date)
      .eq('is_blocked', true);

    if (priestError) {
      console.warn('Warning checking priest blocks:', priestError);
    } else if (priestBlocks && priestBlocks.length > 0) {
      for (const block of priestBlocks) {
        if (!block.start_time || !block.end_time) {
          return {
            available: false,
            reason: block.notes || 'Parish priest is unavailable on this date.',
          };
        }
        const blockStart = normalizeTime(block.start_time);
        const blockEnd = normalizeTime(block.end_time);
        if (normTime >= blockStart && normTime <= blockEnd) {
          return {
            available: false,
            reason: block.notes || 'Parish priest is occupied during this time window.',
          };
        }
      }
    }

    return { available: true };
  } catch (err) {
    console.error('Exception in checkSlotAvailability:', err);
    return { available: true };
  }
}

/**
 * Uploads a document to Supabase storage (documents bucket with fallback to appointment-documents)
 * and records entry in appointment_documents.
 */
async function uploadFileToStorage(
  filePath: string,
  fileUri: string,
  fileType: string
): Promise<string> {
  const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();

  const primaryBucket = 'documents';
  const fallbackBucket = 'appointment-documents';

  const { error: primaryError } = await supabase.storage
    .from(primaryBucket)
    .upload(filePath, arrayBuffer, {
      contentType: fileType || 'application/octet-stream',
      upsert: true,
    });

  if (!primaryError) {
    const { data } = supabase.storage.from(primaryBucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  // If primary bucket failed, attempt fallback bucket
  const { error: fallbackError } = await supabase.storage
    .from(fallbackBucket)
    .upload(filePath, arrayBuffer, {
      contentType: fileType || 'application/octet-stream',
      upsert: true,
    });

  if (fallbackError) {
    console.error('Storage upload failed on both buckets:', primaryError, fallbackError);
    throw primaryError || fallbackError;
  }

  const { data } = supabase.storage.from(fallbackBucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Creates an appointment in appointments table and uploads attached documents.
 */
export async function createAppointment(
  appointmentData: CreateAppointmentInput,
  uploadedDocuments: UploadedDocumentInput[] = []
): Promise<Appointment> {
  try {
    // 1. Format notes with contact person if provided
    let combinedNotes = appointmentData.notes?.trim() || '';
    const contactParts: string[] = [];
    if (appointmentData.contactPerson?.trim()) {
      contactParts.push(`Contact: ${appointmentData.contactPerson.trim()}`);
    }
    if (appointmentData.contactPhone?.trim()) {
      contactParts.push(`Phone: ${appointmentData.contactPhone.trim()}`);
    }
    if (contactParts.length > 0) {
      combinedNotes = combinedNotes
        ? `${combinedNotes}\n\n[Contact Info]\n${contactParts.join(' | ')}`
        : `[Contact Info]\n${contactParts.join(' | ')}`;
    }

    // 2. Insert appointment record
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        user_id: appointmentData.userId,
        church_id: appointmentData.churchId,
        service_type: appointmentData.serviceType,
        appointment_date: appointmentData.appointmentDate,
        appointment_time: appointmentData.appointmentTime,
        notes: combinedNotes || null,
        status: 'pending',
      })
      .select(`
        *,
        church:churches(id, name, address, city, cover_image_url, contact_number)
      `)
      .single();

    if (insertError) {
      console.error('Error inserting appointment:', insertError);
      throw new Error(insertError.message);
    }
    if (!appointment) {
      throw new Error('Failed to create appointment record.');
    }

    // 3. Upload attached documents if any
    const savedDocs: AppointmentDocument[] = [];
    if (uploadedDocuments && uploadedDocuments.length > 0) {
      for (const doc of uploadedDocuments) {
        try {
          const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${appointment.id}/${Date.now()}_${safeName}`;
          const publicUrl = await uploadFileToStorage(filePath, doc.fileUri, doc.fileType);

          const { data: docRecord, error: docError } = await supabase
            .from('appointment_documents')
            .insert({
              appointment_id: appointment.id,
              requirement_id: doc.requirementId?.startsWith('fallback-') ? null : doc.requirementId || null,
              file_url: publicUrl,
              file_name: doc.fileName,
              file_type: doc.fileType,
              file_size: doc.fileSize || 0,
              uploaded_by: appointmentData.userId,
            })
            .select()
            .single();

          if (docError) {
            console.warn('Warning saving document record:', docError);
          } else if (docRecord) {
            savedDocs.push(docRecord as AppointmentDocument);
          }
        } catch (uploadErr) {
          console.error(`Error uploading document ${doc.fileName}:`, uploadErr);
        }
      }
    }

    return {
      id: appointment.id,
      user_id: appointment.user_id,
      church_id: appointment.church_id,
      service_type: appointment.service_type,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      status: appointment.status as AppointmentStatus,
      notes: appointment.notes,
      admin_feedback: appointment.admin_feedback,
      created_at: appointment.created_at,
      updated_at: appointment.updated_at,
      church: appointment.church,
      appointment_documents: savedDocs,
    };
  } catch (err) {
    console.error('Exception in createAppointment:', err);
    throw err;
  }
}

/**
 * Cancels an appointment.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<boolean> {
  try {
    const updatePayload: Record<string, any> = {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    };

    if (reason) {
      updatePayload.notes = `[Cancellation Reason]: ${reason}`;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId);

    if (error) {
      console.error('Error cancelling appointment:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (err) {
    console.error('Exception in cancelAppointment:', err);
    throw err;
  }
}

/**
 * TanStack Query hook to fetch user appointments.
 */
export function useUserAppointments(userId?: string) {
  return useQuery({
    queryKey: ['appointments', 'user', userId],
    queryFn: () => (userId ? getAppointments(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * TanStack Query hook to fetch sacrament requirements.
 */
export function useSacramentRequirements(sacrament?: string, churchId?: string) {
  return useQuery({
    queryKey: ['sacrament-requirements', sacrament, churchId],
    queryFn: () => (sacrament ? getSacramentRequirements(sacrament, churchId) : Promise.resolve([])),
    enabled: Boolean(sacrament),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * TanStack Query hook to check slot availability in real time.
 */
export function useCheckSlotAvailability(
  churchId?: string,
  date?: string,
  time?: string,
  sacramentType?: string
) {
  return useQuery<SlotAvailabilityResult>({
    queryKey: ['slot-availability', churchId, date, time, sacramentType],
    queryFn: (): Promise<SlotAvailabilityResult> =>
      churchId && date && time
        ? checkSlotAvailability(churchId, date, time, sacramentType)
        : Promise.resolve({ available: true }),
    enabled: Boolean(churchId && date && time),
    staleTime: 1000 * 10,
  });
}

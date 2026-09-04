import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AdminParishMetrics {
  pendingAppointmentsCount: number;
  pendingDonationsCount: number;
  activeAnnouncementsCount: number;
  churchName?: string;
  churchId?: string;
}

export interface ChurchAppointmentWithDetails {
  id: string;
  user_id: string;
  church_id: string;
  priest_id?: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'rescheduled';
  notes?: string | null;
  admin_feedback?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    avatar_url?: string | null;
  } | null;
  priest?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  church?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;
  appointment_documents?: {
    id: string;
    appointment_id: string;
    requirement_id?: string | null;
    file_url: string;
    file_name: string;
    file_type: string;
    file_size?: number | null;
    uploaded_at?: string;
  }[];
}

export interface ChurchDonationWithDetails {
  id: string;
  user_id: string;
  church_id: string;
  amount: number;
  purpose?: string | null;
  reference_number?: string | null;
  proof_url?: string | null;
  status: 'pending' | 'verified' | 'rejected';
  donor_notes?: string | null;
  notes?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    avatar_url?: string | null;
  } | null;
  verifier?: {
    id: string;
    full_name?: string | null;
  } | null;
  church?: {
    id: string;
    name: string;
  } | null;
}

export interface PriestLiturgicalScheduleItem {
  id: string;
  church_id: string;
  day_of_week: string;
  time: string;
  language: string;
  created_at?: string;
}

export interface PriestScheduleData {
  appointments: ChurchAppointmentWithDetails[];
  massSchedules: PriestLiturgicalScheduleItem[];
  churchName?: string;
}

export interface PriestAvailabilityStatus {
  date: string;
  isAvailable: boolean;
  notes?: string | null;
}

export interface ChurchPriestProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone_number: string | null;
}

// ============================================================================
// Data Operations
// ============================================================================

/**
 * 1. fetchAdminParishMetrics(churchId):
 * Counts pending appointments, pending donations, active announcements, and church details.
 */
export async function fetchAdminParishMetrics(churchId?: string | null): Promise<AdminParishMetrics> {
  try {
    let targetChurchId = churchId;
    let churchName: string | undefined;

    // If no churchId supplied, resolve from user or pick the first active church
    if (!targetChurchId) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('church_id, assigned_church_id')
          .eq('id', authData.user.id)
          .maybeSingle();

        targetChurchId = profile?.assigned_church_id || profile?.church_id || null;
      }
    }

    if (!targetChurchId) {
      const { data: fallbackChurch } = await supabase
        .from('churches')
        .select('id, name')
        .limit(1)
        .maybeSingle();

      targetChurchId = fallbackChurch?.id;
      churchName = fallbackChurch?.name;
    } else {
      const { data: churchRow } = await supabase
        .from('churches')
        .select('name')
        .eq('id', targetChurchId)
        .maybeSingle();
      churchName = churchRow?.name;
    }

    if (!targetChurchId) {
      return {
        pendingAppointmentsCount: 0,
        pendingDonationsCount: 0,
        activeAnnouncementsCount: 0,
      };
    }

    // Parallel queries for metrics
    const [apptRes, donationRes, annRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', targetChurchId)
        .eq('status', 'pending'),
      supabase
        .from('donations')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', targetChurchId)
        .eq('status', 'pending'),
      supabase
        .from('church_announcements')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', targetChurchId),
    ]);

    return {
      pendingAppointmentsCount: apptRes.count || 0,
      pendingDonationsCount: donationRes.count || 0,
      activeAnnouncementsCount: annRes.count || 0,
      churchName,
      churchId: targetChurchId,
    };
  } catch (err) {
    console.error('[AdminWorkflows] fetchAdminParishMetrics error:', err);
    return {
      pendingAppointmentsCount: 0,
      pendingDonationsCount: 0,
      activeAnnouncementsCount: 0,
    };
  }
}

/**
 * 2. fetchChurchAppointments(churchId, statusFilter?):
 * Queries appointments for church with parishioner profiles and documents.
 */
export async function fetchChurchAppointments(
  churchId?: string | null,
  statusFilter?: string
): Promise<ChurchAppointmentWithDetails[]> {
  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        user:profiles!appointments_user_id_fkey(id, full_name, email, phone_number, avatar_url),
        priest:profiles!appointments_priest_id_fkey(id, full_name, email),
        church:churches!appointments_church_id_fkey(id, name, address),
        appointment_documents(*)
      `)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (churchId) {
      query = query.eq('church_id', churchId);
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[AdminWorkflows] fetchChurchAppointments error:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      church_id: row.church_id,
      priest_id: row.priest_id,
      service_type: row.service_type,
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      status: row.status,
      notes: row.notes,
      admin_feedback: row.admin_feedback,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: row.user || null,
      priest: row.priest || null,
      church: row.church || null,
      appointment_documents: row.appointment_documents || [],
    }));
  } catch (err) {
    console.error('[AdminWorkflows] fetchChurchAppointments exception:', err);
    return [];
  }
}

/**
 * 3. updateAppointmentStatus(appointmentId, status, remarks?, priestId?):
 * Updates status ('approved' | 'rejected' | 'completed') and triggers in-app notification insert to the user.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'approved' | 'rejected' | 'completed',
  remarks?: string,
  priestId?: string | null
): Promise<boolean> {
  try {
    // 1. Fetch current appointment details to notify the correct parishioner
    const { data: existingAppt, error: fetchErr } = await supabase
      .from('appointments')
      .select('id, user_id, service_type, appointment_date, appointment_time, church_id')
      .eq('id', appointmentId)
      .single();

    if (fetchErr || !existingAppt) {
      throw new Error(fetchErr?.message || 'Appointment record not found');
    }

    // 2. Perform appointment update
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (remarks !== undefined) {
      updatePayload.admin_feedback = remarks.trim() || null;
    }

    if (priestId !== undefined) {
      updatePayload.priest_id = priestId || null;
    }

    const { error: updateErr } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId);

    if (updateErr) {
      console.error('[AdminWorkflows] Error updating appointment:', updateErr);
      throw updateErr;
    }

    // 3. Dispatch in-app notification insert to the user (without .select() to avoid cross-user RLS blocking)
    try {
      const cleanRemarks = remarks?.trim();
      let notifTitle = 'Appointment Update';
      let notifMessage = `Your ${existingAppt.service_type} appointment status is now ${status}.`;

      if (status === 'approved') {
        notifTitle = 'Sacrament Appointment Approved 🙏';
        notifMessage = `Your ${existingAppt.service_type} on ${existingAppt.appointment_date} has been confirmed.${
          cleanRemarks ? ` Notes: "${cleanRemarks}"` : ' Please arrive 15 minutes before schedule.'
        }`;
      } else if (status === 'rejected') {
        notifTitle = 'Appointment Request Update';
        notifMessage = `Your ${existingAppt.service_type} request was not approved.${
          cleanRemarks ? ` Reason: "${cleanRemarks}"` : ''
        }`;
      } else if (status === 'completed') {
        notifTitle = 'Sacrament Ceremony Completed ✨';
        notifMessage = `Your ${existingAppt.service_type} record has been marked as completed. Blessings to you and your family!`;
      }

      await supabase.from('notifications').insert({
        user_id: existingAppt.user_id,
        type: `appointment_${status}`,
        title: notifTitle,
        message: notifMessage,
        link: '/appointments',
      });
    } catch (notifErr) {
      console.warn('[AdminWorkflows] Non-fatal notification error on appointment update:', notifErr);
    }

    return true;
  } catch (err) {
    console.error('[AdminWorkflows] updateAppointmentStatus exception:', err);
    throw err;
  }
}

/**
 * 4. fetchChurchDonations(churchId, statusFilter?):
 * Queries donations for church with user profile.
 */
export async function fetchChurchDonations(
  churchId?: string | null,
  statusFilter?: string
): Promise<ChurchDonationWithDetails[]> {
  try {
    let query = supabase
      .from('donations')
      .select(`
        *,
        user:profiles!donations_user_id_fkey(id, full_name, email, phone_number, avatar_url),
        verifier:profiles!donations_verified_by_fkey(id, full_name),
        church:churches!donations_church_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (churchId) {
      query = query.eq('church_id', churchId);
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[AdminWorkflows] fetchChurchDonations error:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      church_id: row.church_id,
      amount: Number(row.amount || 0),
      purpose: row.purpose || 'General Donation',
      reference_number: row.reference_number || null,
      proof_url: row.proof_url || null,
      status: row.status,
      donor_notes: row.donor_notes || null,
      notes: row.notes || null,
      verified_by: row.verified_by || null,
      verified_at: row.verified_at || null,
      created_at: row.created_at,
      user: row.user || null,
      verifier: row.verifier || null,
      church: row.church || null,
    }));
  } catch (err) {
    console.error('[AdminWorkflows] fetchChurchDonations exception:', err);
    return [];
  }
}

/**
 * 5. updateDonationStatus(donationId, status, notes?):
 * Updates donation status ('verified' | 'rejected') and triggers notification to donor.
 */
export async function updateDonationStatus(
  donationId: string,
  status: 'verified' | 'rejected',
  notes?: string
): Promise<boolean> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const verifierId = authData?.user?.id || null;

    // 1. Fetch current donation details
    const { data: donation, error: fetchErr } = await supabase
      .from('donations')
      .select(`
        id,
        user_id,
        amount,
        church_id,
        church:churches!donations_church_id_fkey(name)
      `)
      .eq('id', donationId)
      .single();

    if (fetchErr || !donation) {
      throw new Error(fetchErr?.message || 'Donation record not found');
    }

    // 2. Update donation in database
    const updatePayload: Record<string, any> = {
      status,
      verified_by: verifierId,
      verified_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updatePayload.notes = notes.trim() || null;
    }

    const { error: updateErr } = await supabase
      .from('donations')
      .update(updatePayload)
      .eq('id', donationId);

    if (updateErr) {
      console.error('[AdminWorkflows] Error updating donation status:', updateErr);
      throw updateErr;
    }

    // 3. Dispatch notification to donor (without .select())
    try {
      const formattedAmount = `₱${Number(donation.amount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}`;
      const churchObj = Array.isArray(donation.church) ? donation.church[0] : donation.church;
      const churchName = churchObj?.name || 'the Parish';
      const cleanNotes = notes?.trim();

      const notifTitle = status === 'verified' ? 'Donation Verified 🙏' : 'Donation Verification Update';
      const notifMessage =
        status === 'verified'
          ? `Your ${formattedAmount} offering to ${churchName} has been verified and recorded. May God bless your generosity!`
          : `Your donation proof for ${formattedAmount} to ${churchName} could not be verified.${
              cleanNotes ? ` Reason: "${cleanNotes}"` : ''
            }`;

      await supabase.from('notifications').insert({
        user_id: donation.user_id,
        type: `donation_${status}`,
        title: notifTitle,
        message: notifMessage,
        link: '/donations',
      });
    } catch (notifErr) {
      console.warn('[AdminWorkflows] Non-fatal notification error on donation update:', notifErr);
    }

    return true;
  } catch (err) {
    console.error('[AdminWorkflows] updateDonationStatus exception:', err);
    throw err;
  }
}

/**
 * 6. fetchPriestSchedule(priestId, churchId?):
 * Queries assigned sacrament appointments and parish mass schedules for the priest.
 */
export async function fetchPriestSchedule(
  priestId?: string | null,
  churchId?: string | null
): Promise<PriestScheduleData> {
  try {
    let targetPriestId = priestId;
    let targetChurchId = churchId;

    if (!targetPriestId) {
      const { data: authData } = await supabase.auth.getUser();
      targetPriestId = authData?.user?.id || null;
    }

    if (!targetChurchId && targetPriestId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('church_id, assigned_church_id')
        .eq('id', targetPriestId)
        .maybeSingle();

      targetChurchId = profile?.assigned_church_id || profile?.church_id || null;
    }

    if (!targetChurchId) {
      const { data: firstChurch } = await supabase
        .from('churches')
        .select('id, name')
        .limit(1)
        .maybeSingle();
      targetChurchId = firstChurch?.id || null;
    }

    // 1. Query appointments assigned to priest OR for church
    let apptQuery = supabase
      .from('appointments')
      .select(`
        *,
        user:profiles!appointments_user_id_fkey(id, full_name, email, phone_number, avatar_url),
        church:churches!appointments_church_id_fkey(id, name, address),
        appointment_documents(*)
      `)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (targetPriestId) {
      // Show appointments directly assigned to this priest, or if churchId exists show pending/approved
      apptQuery = apptQuery.or(
        `priest_id.eq.${targetPriestId}${targetChurchId ? `,church_id.eq.${targetChurchId}` : ''}`
      );
    } else if (targetChurchId) {
      apptQuery = apptQuery.eq('church_id', targetChurchId);
    }

    const { data: apptData, error: apptErr } = await apptQuery;
    if (apptErr) {
      console.warn('[AdminWorkflows] fetchPriestSchedule appt query warning:', apptErr);
    }

    // 2. Query Mass Schedules
    let massSchedules: PriestLiturgicalScheduleItem[] = [];
    if (targetChurchId) {
      const { data: massData, error: massErr } = await supabase
        .from('mass_schedules')
        .select('id, church_id, day_of_week, time, language, created_at')
        .eq('church_id', targetChurchId)
        .order('time', { ascending: true });

      if (!massErr && massData) {
        massSchedules = massData as PriestLiturgicalScheduleItem[];
      }
    }

    // 3. Resolve church name
    let churchName: string | undefined;
    if (targetChurchId) {
      const { data: cData } = await supabase
        .from('churches')
        .select('name')
        .eq('id', targetChurchId)
        .maybeSingle();
      churchName = cData?.name;
    }

    return {
      appointments: (apptData || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        church_id: row.church_id,
        priest_id: row.priest_id,
        service_type: row.service_type,
        appointment_date: row.appointment_date,
        appointment_time: row.appointment_time,
        status: row.status,
        notes: row.notes,
        admin_feedback: row.admin_feedback,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: row.user || null,
        church: row.church || null,
        appointment_documents: row.appointment_documents || [],
      })),
      massSchedules,
      churchName,
    };
  } catch (err) {
    console.error('[AdminWorkflows] fetchPriestSchedule exception:', err);
    return {
      appointments: [],
      massSchedules: [],
    };
  }
}

/**
 * 7. fetchPriestAvailability(priestId, date):
 * Queries priest availability record for a given calendar date (YYYY-MM-DD).
 * Returns true if available (on-duty), false if blocked (off-duty).
 */
export async function fetchPriestAvailability(
  priestId: string,
  date: string
): Promise<PriestAvailabilityStatus> {
  try {
    if (!priestId || !date) {
      return { date, isAvailable: true };
    }

    const { data, error } = await supabase
      .from('priest_availability')
      .select('id, is_blocked, notes')
      .eq('priest_id', priestId)
      .eq('available_date', date)
      .maybeSingle();

    if (error) {
      console.warn('[AdminWorkflows] fetchPriestAvailability query warning:', error);
      return { date, isAvailable: true };
    }

    if (!data) {
      return { date, isAvailable: true, notes: null };
    }

    return {
      date,
      isAvailable: !data.is_blocked,
      notes: data.notes || null,
    };
  } catch (err) {
    console.error('[AdminWorkflows] fetchPriestAvailability exception:', err);
    return { date, isAvailable: true };
  }
}

/**
 * 8. togglePriestDayAvailability(priestId, churchId, date, isAvailable, notes?):
 * Updates or inserts into priest_availability table setting duty availability.
 */
export async function togglePriestDayAvailability(
  priestId: string,
  churchId: string,
  date: string,
  isAvailable: boolean,
  notes?: string
): Promise<boolean> {
  try {
    if (!priestId || !date) {
      throw new Error('Priest ID and date are required');
    }

    // Resolve churchId fallback if empty
    let targetChurchId = churchId;
    if (!targetChurchId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('church_id, assigned_church_id')
        .eq('id', priestId)
        .maybeSingle();
      targetChurchId = profile?.assigned_church_id || profile?.church_id || '';
    }

    if (!targetChurchId) {
      const { data: firstChurch } = await supabase
        .from('churches')
        .select('id')
        .limit(1)
        .maybeSingle();
      targetChurchId = firstChurch?.id || '';
    }

    // Check if entry exists for this priest and date
    const { data: existingRecord } = await supabase
      .from('priest_availability')
      .select('id')
      .eq('priest_id', priestId)
      .eq('available_date', date)
      .maybeSingle();

    const isBlocked = !isAvailable;
    const dutyNotes = notes || (isAvailable ? 'On-duty: Available for parish liturgies' : 'Off-duty: On leave / rest');

    if (existingRecord) {
      const { error: updateErr } = await supabase
        .from('priest_availability')
        .update({
          is_blocked: isBlocked,
          notes: dutyNotes,
        })
        .eq('id', existingRecord.id);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('priest_availability')
        .insert({
          priest_id: priestId,
          church_id: targetChurchId,
          available_date: date,
          start_time: '06:00:00',
          end_time: '20:00:00',
          is_blocked: isBlocked,
          notes: dutyNotes,
        });

      if (insertErr) throw insertErr;
    }

    return true;
  } catch (err) {
    console.error('[AdminWorkflows] togglePriestDayAvailability exception:', err);
    throw err;
  }
}

/**
 * 9. createParishAnnouncement(churchId, title, content, priority, imageUrl?):
 * Creates announcement in church_announcements with priority tag and optional image.
 */
export async function createParishAnnouncement(
  churchId: string,
  title: string,
  content: string,
  priority: 'urgent' | 'advisory' | 'event' | 'general' = 'general',
  imageUrl?: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    if (!churchId || !title.trim() || !content.trim()) {
      throw new Error('Church, title, and content are required to publish an announcement.');
    }

    // 1. Insert into church_announcements
    const { data: newRecord, error: insertErr } = await supabase
      .from('church_announcements')
      .insert({
        church_id: churchId,
        title: title.trim(),
        content: content.trim(),
        category: priority,
        is_pinned: priority === 'urgent',
        created_by: userId,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[AdminWorkflows] Error creating church announcement:', insertErr);
      throw insertErr;
    }

    // 2. Also record in legacy announcements table for full platform interoperability
    try {
      await supabase.from('announcements').insert({
        church_id: churchId,
        title: title.trim(),
        body: content.trim(),
        image_url: imageUrl || null,
        is_pinned: priority === 'urgent',
        is_active: true,
        created_by: userId,
      });
    } catch {
      // Non-fatal legacy mirror
    }

    return { success: true, id: newRecord?.id };
  } catch (err) {
    console.error('[AdminWorkflows] createParishAnnouncement exception:', err);
    throw err;
  }
}

/**
 * Helper to fetch priests assigned to a church for the Priest Selector in appointment review.
 */
export async function fetchChurchPriests(churchId?: string | null): Promise<ChurchPriestProfile[]> {
  try {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, phone_number')
      .eq('role', 'priest');

    if (churchId) {
      query = query.or(`church_id.eq.${churchId},assigned_church_id.eq.${churchId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[AdminWorkflows] fetchChurchPriests warning:', error);
      return [];
    }

    return (data || []) as ChurchPriestProfile[];
  } catch (err) {
    console.error('[AdminWorkflows] fetchChurchPriests exception:', err);
    return [];
  }
}

// ============================================================================
// TanStack Query Hooks
// ============================================================================

export function useAdminParishMetrics(churchId?: string | null) {
  return useQuery({
    queryKey: ['admin-parish-metrics', churchId || 'default'],
    queryFn: () => fetchAdminParishMetrics(churchId),
    staleTime: 1000 * 20, // 20 seconds
  });
}

export function useChurchAppointments(churchId?: string | null, statusFilter?: string) {
  return useQuery({
    queryKey: ['church-appointments', churchId || 'all', statusFilter || 'all'],
    queryFn: () => fetchChurchAppointments(churchId, statusFilter),
    staleTime: 1000 * 20,
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      status,
      remarks,
      priestId,
    }: {
      appointmentId: string;
      status: 'approved' | 'rejected' | 'completed';
      remarks?: string;
      priestId?: string | null;
    }) => updateAppointmentStatus(appointmentId, status, remarks, priestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parish-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['priest-schedule'] });
    },
  });
}

export function useChurchDonations(churchId?: string | null, statusFilter?: string) {
  return useQuery({
    queryKey: ['church-donations', churchId || 'all', statusFilter || 'all'],
    queryFn: () => fetchChurchDonations(churchId, statusFilter),
    staleTime: 1000 * 20,
  });
}

export function useUpdateDonationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      donationId,
      status,
      notes,
    }: {
      donationId: string;
      status: 'verified' | 'rejected';
      notes?: string;
    }) => updateDonationStatus(donationId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-donations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parish-metrics'] });
    },
  });
}

export function usePriestSchedule(priestId?: string | null, churchId?: string | null) {
  return useQuery({
    queryKey: ['priest-schedule', priestId || 'default', churchId || 'default'],
    queryFn: () => fetchPriestSchedule(priestId, churchId),
    staleTime: 1000 * 30,
  });
}

export function usePriestAvailability(priestId?: string | null, date?: string) {
  return useQuery({
    queryKey: ['priest-availability', priestId || 'default', date || 'today'],
    queryFn: () =>
      priestId && date
        ? fetchPriestAvailability(priestId, date)
        : Promise.resolve({ date: date || '', isAvailable: true }),
    enabled: Boolean(priestId && date),
    staleTime: 1000 * 30,
  });
}

export function useTogglePriestDayAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      priestId,
      churchId,
      date,
      isAvailable,
      notes,
    }: {
      priestId: string;
      churchId: string;
      date: string;
      isAvailable: boolean;
      notes?: string;
    }) => togglePriestDayAvailability(priestId, churchId, date, isAvailable, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priest-availability'] });
      queryClient.invalidateQueries({ queryKey: ['priest-schedule'] });
    },
  });
}

export function useCreateParishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      churchId,
      title,
      content,
      priority,
      imageUrl,
    }: {
      churchId: string;
      title: string;
      content: string;
      priority: 'urgent' | 'advisory' | 'event' | 'general';
      imageUrl?: string;
    }) => createParishAnnouncement(churchId, title, content, priority, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parish-metrics'] });
    },
  });
}

export function useChurchPriests(churchId?: string | null) {
  return useQuery({
    queryKey: ['church-priests', churchId || 'default'],
    queryFn: () => fetchChurchPriests(churchId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

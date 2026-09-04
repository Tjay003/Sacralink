import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UserRoleBreakdown {
  parishioners: number;
  priests: number;
  churchAdmins: number;
  superAdmins: number;
}

export interface SystemOverviewMetrics {
  totalChurches: number;
  totalUsers: number;
  roleBreakdown: UserRoleBreakdown;
  totalAppointments: number;
  totalDonationsVolumePhp: number;
  pendingApplicationsCount: number;
}

export type ApplicationReviewStatus = 'pending' | 'under_review' | 'verified_active' | 'approved' | 'rejected';

export interface ParishApplicationItem {
  id: string;
  applicant_id: string | null;
  parish_name: string;
  address: string;
  contact_number?: string | null;
  email?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gcash_number?: string | null;
  maya_number?: string | null;
  celebret_url: string;
  decree_url: string;
  status: ApplicationReviewStatus;
  checklist?: Record<string, any> | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  church_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  applicant?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    avatar_url?: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name?: string | null;
  } | null;
  church?: {
    id: string;
    name: string;
    status?: string | null;
  } | null;
}

export interface SystemUserItem {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'user' | 'priest' | 'church_admin' | 'admin' | 'super_admin';
  avatar_url?: string | null;
  phone_number?: string | null;
  church_id?: string | null;
  assigned_church_id?: string | null;
  created_at?: string | null;
  assigned_church_name?: string | null;
}

export interface ChurchOption {
  id: string;
  name: string;
  address?: string | null;
}

// ============================================================================
// Data Layer Functions
// ============================================================================

/**
 * 1. fetchSystemOverviewMetrics():
 * Aggregates diocesan telemetry: active churches, user roles, sacrament appointments,
 * verified donations volume in PHP, and pending parish applications count.
 */
export async function fetchSystemOverviewMetrics(): Promise<SystemOverviewMetrics> {
  try {
    const [
      churchesRes,
      usersRes,
      apptsRes,
      donationsRes,
      pendingAppsRes,
    ] = await Promise.all([
      // 1. Total Active Churches
      supabase
        .from('churches')
        .select('*', { count: 'exact', head: true })
        .or('is_active.eq.true,status.eq.active,status.eq.verified_active'),

      // 2. Users with Roles
      supabase
        .from('profiles')
        .select('role'),

      // 3. Total Appointments
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true }),

      // 4. Verified Donations Volume
      supabase
        .from('donations')
        .select('amount')
        .eq('status', 'verified'),

      // 5. Pending Parish Applications
      supabase
        .from('parish_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'under_review']),
    ]);

    // Parse role counts
    const users = usersRes.data || [];
    let parishioners = 0;
    let priests = 0;
    let churchAdmins = 0;
    let superAdmins = 0;

    users.forEach((u: { role?: string | null }) => {
      const r = u.role || 'user';
      if (r === 'priest') priests++;
      else if (r === 'church_admin' || r === 'admin') churchAdmins++;
      else if (r === 'super_admin') superAdmins++;
      else parishioners++;
    });

    // Sum donation volume
    const donations = donationsRes.data || [];
    const totalDonationsVolumePhp = donations.reduce(
      (sum: number, item: { amount?: number | string | null }) => sum + (Number(item.amount) || 0),
      0
    );

    return {
      totalChurches: churchesRes.count || 0,
      totalUsers: users.length,
      roleBreakdown: {
        parishioners,
        priests,
        churchAdmins,
        superAdmins,
      },
      totalAppointments: apptsRes.count || 0,
      totalDonationsVolumePhp,
      pendingApplicationsCount: pendingAppsRes.count || 0,
    };
  } catch (err) {
    console.error('[SuperAdmin] fetchSystemOverviewMetrics error:', err);
    return {
      totalChurches: 0,
      totalUsers: 0,
      roleBreakdown: {
        parishioners: 0,
        priests: 0,
        churchAdmins: 0,
        superAdmins: 0,
      },
      totalAppointments: 0,
      totalDonationsVolumePhp: 0,
      pendingApplicationsCount: 0,
    };
  }
}

/**
 * 2. fetchParishApplications(statusFilter?):
 * Queries parish_applications with applicant, reviewer, and church relationships.
 */
export async function fetchParishApplications(
  statusFilter?: string
): Promise<ParishApplicationItem[]> {
  try {
    let query = supabase
      .from('parish_applications')
      .select(`
        *,
        applicant:profiles!parish_applications_applicant_id_fkey(id, full_name, email, phone_number, avatar_url),
        reviewer:profiles!parish_applications_reviewed_by_fkey(id, full_name),
        church:churches!parish_applications_church_id_fkey(id, name, status)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'approved' || statusFilter === 'verified_active') {
        query = query.or('status.eq.verified_active,status.eq.approved');
      } else if (statusFilter === 'pending') {
        query = query.or('status.eq.pending,status.eq.under_review');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('[SuperAdmin] fetchParishApplications error:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      applicant_id: row.applicant_id,
      parish_name: row.parish_name,
      address: row.address,
      contact_number: row.contact_number,
      email: row.email,
      description: row.description,
      latitude: row.latitude,
      longitude: row.longitude,
      gcash_number: row.gcash_number,
      maya_number: row.maya_number,
      celebret_url: row.celebret_url,
      decree_url: row.decree_url,
      status: row.status as ApplicationReviewStatus,
      checklist: row.checklist,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      rejection_reason: row.rejection_reason,
      church_id: row.church_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      applicant: row.applicant || null,
      reviewer: row.reviewer || null,
      church: row.church || null,
    }));
  } catch (err) {
    console.error('[SuperAdmin] fetchParishApplications exception:', err);
    return [];
  }
}

/**
 * 3. reviewParishApplication(applicationId, status, adminFeedback?):
 * Approves (onboards new church & upgrades applicant to church_admin) or rejects application.
 */
export async function reviewParishApplication(
  applicationId: string,
  status: 'approved' | 'rejected' | 'verified_active',
  adminFeedback?: string
): Promise<{ success: boolean; churchId?: string | null }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const reviewerId = authData?.user?.id || null;

    // Fetch existing application record
    const { data: application, error: fetchErr } = await supabase
      .from('parish_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchErr || !application) {
      throw new Error(fetchErr?.message || 'Parish application record not found');
    }

    const isApproval = status === 'approved' || status === 'verified_active';

    if (isApproval) {
      let finalChurchId = application.church_id;

      // 1. Create or ensure Church in churches table
      if (!finalChurchId) {
        const { data: newChurch, error: churchError } = await supabase
          .from('churches')
          .insert({
            name: application.parish_name.trim(),
            address: application.address.trim(),
            contact_number: application.contact_number?.trim() || null,
            email: application.email?.trim() || null,
            description: application.description?.trim() || null,
            latitude: application.latitude ?? null,
            longitude: application.longitude ?? null,
            gcash_number: application.gcash_number?.trim() || null,
            maya_number: application.maya_number?.trim() || null,
            status: 'verified_active',
            is_active: true,
          })
          .select('id')
          .single();

        if (churchError) {
          console.error('[SuperAdmin] Error creating new parish church:', churchError);
          throw churchError;
        }

        finalChurchId = newChurch.id;
      } else {
        await supabase
          .from('churches')
          .update({
            status: 'verified_active',
            is_active: true,
          })
          .eq('id', finalChurchId);
      }

      // 2. Elevate applicant profile role to church_admin and assign church
      if (application.applicant_id && finalChurchId) {
        try {
          await supabase
            .from('profiles')
            .update({
              role: 'church_admin',
              assigned_church_id: finalChurchId,
              church_id: finalChurchId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', application.applicant_id);
        } catch (profErr) {
          console.warn('[SuperAdmin] Error elevating applicant role:', profErr);
        }
      }

      // 3. Update application status
      const { error: updateAppErr } = await supabase
        .from('parish_applications')
        .update({
          status: 'verified_active',
          church_id: finalChurchId,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (updateAppErr) throw updateAppErr;

      // 4. Send in-app notification to applicant
      if (application.applicant_id) {
        try {
          const feedbackMsg = adminFeedback?.trim() ? ` Remarks: "${adminFeedback.trim()}".` : '';
          await supabase.from('notifications').insert({
            user_id: application.applicant_id,
            type: 'parish_application_approved',
            title: 'Parish Application Approved 🙏',
            message: `Your application for "${application.parish_name}" has been verified and approved by the Diocesan Chancery.${feedbackMsg} Your parish is now live on SacraLink!`,
            link: finalChurchId ? `/church/${finalChurchId}` : '/explore',
          });
        } catch (notifErr) {
          console.warn('[SuperAdmin] Non-fatal notification error on approval:', notifErr);
        }
      }

      return { success: true, churchId: finalChurchId };
    } else {
      // Rejection Workflow
      const rejectionReason = adminFeedback?.trim() || 'Application did not meet accreditation criteria.';

      const { error: rejectErr } = await supabase
        .from('parish_applications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (rejectErr) throw rejectErr;

      // Send rejection notification
      if (application.applicant_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: application.applicant_id,
            type: 'parish_application_rejected',
            title: 'Parish Application Update',
            message: `Your application for "${application.parish_name}" was not approved. Feedback: "${rejectionReason}"`,
            link: '/explore',
          });
        } catch (notifErr) {
          console.warn('[SuperAdmin] Non-fatal notification error on rejection:', notifErr);
        }
      }

      return { success: true, churchId: null };
    }
  } catch (err) {
    console.error('[SuperAdmin] reviewParishApplication exception:', err);
    throw err;
  }
}

/**
 * 4. fetchSystemUsers(searchQuery?, roleFilter?):
 * Fetches all registered system profiles with their assigned parish name.
 */
export async function fetchSystemUsers(
  searchQuery?: string,
  roleFilter?: string
): Promise<SystemUserItem[]> {
  try {
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        role,
        avatar_url,
        phone_number,
        church_id,
        assigned_church_id,
        created_at,
        assigned_church:churches!profiles_assigned_church_id_fkey(id, name),
        church:churches!profiles_church_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (roleFilter && roleFilter !== 'all') {
      if (roleFilter === 'church_admin') {
        query = query.or('role.eq.church_admin,role.eq.admin');
      } else {
        query = query.eq('role', roleFilter);
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.trim();
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[SuperAdmin] Join query error, falling back to flat query:', error);
      // Fallback query without explicit foreign key joins in case FK alias differs
      let fallbackQuery = supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, phone_number, church_id, assigned_church_id, created_at')
        .order('created_at', { ascending: false });

      if (roleFilter && roleFilter !== 'all') {
        if (roleFilter === 'church_admin') {
          fallbackQuery = fallbackQuery.or('role.eq.church_admin,role.eq.admin');
        } else {
          fallbackQuery = fallbackQuery.eq('role', roleFilter);
        }
      }

      if (searchQuery && searchQuery.trim()) {
        const term = searchQuery.trim();
        fallbackQuery = fallbackQuery.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw fallbackError;

      return (fallbackData || []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        role: row.role || 'user',
        avatar_url: row.avatar_url,
        phone_number: row.phone_number,
        church_id: row.church_id,
        assigned_church_id: row.assigned_church_id,
        created_at: row.created_at,
        assigned_church_name: null,
      }));
    }

    return (data || []).map((row: any) => {
      const assignedChurch = Array.isArray(row.assigned_church) ? row.assigned_church[0] : row.assigned_church;
      const church = Array.isArray(row.church) ? row.church[0] : row.church;
      const churchName = assignedChurch?.name || church?.name || null;

      return {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        role: row.role || 'user',
        avatar_url: row.avatar_url,
        phone_number: row.phone_number,
        church_id: row.church_id,
        assigned_church_id: row.assigned_church_id,
        created_at: row.created_at,
        assigned_church_name: churchName,
      };
    });
  } catch (err) {
    console.error('[SuperAdmin] fetchSystemUsers exception:', err);
    return [];
  }
}

/**
 * 5. updateUserRole(userId, newRole, assignedChurchId?):
 * Updates user role and church assignment in profiles.
 */
export async function updateUserRole(
  userId: string,
  newRole: 'user' | 'priest' | 'church_admin' | 'admin' | 'super_admin',
  assignedChurchId?: string | null
): Promise<boolean> {
  try {
    const payload: Record<string, any> = {
      role: newRole,
      assigned_church_id: assignedChurchId || null,
      church_id: assignedChurchId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.error('[SuperAdmin] updateUserRole error:', error);
      throw error;
    }

    // Dispatch notification to updated user
    try {
      const roleLabels: Record<string, string> = {
        user: 'Parishioner',
        priest: 'Clergy / Priest',
        church_admin: 'Parish Administrator',
        admin: 'Parish Administrator',
        super_admin: 'Diocesan Super Administrator',
      };
      const prettyRole = roleLabels[newRole] || newRole;
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'role_updated',
        title: 'Account Role Updated',
        message: `Your account role has been updated to ${prettyRole} by the Diocesan Chancery.`,
        link: '/profile',
      });
    } catch (notifErr) {
      console.warn('[SuperAdmin] Non-fatal notification error on role update:', notifErr);
    }

    return true;
  } catch (err) {
    console.error('[SuperAdmin] updateUserRole exception:', err);
    throw err;
  }
}

/**
 * 6. publishSystemAnnouncement(title, content, priority, expiresAt?):
 * Inserts system-wide bulletin decree into system_announcements.
 */
export async function publishSystemAnnouncement(
  title: string,
  content: string,
  priority: 'urgent' | 'advisory' | 'event' | 'general' = 'general',
  expiresAt?: string | null
): Promise<{ success: boolean; id?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    if (!title.trim() || !content.trim()) {
      throw new Error('Title and content are required to broadcast a system decree.');
    }

    const typeMap: Record<string, 'info' | 'warning' | 'maintenance' | 'success'> = {
      urgent: 'warning',
      advisory: 'info',
      event: 'info',
      general: 'info',
    };
    const announcementType = typeMap[priority] || 'info';

    const { data, error } = await supabase
      .from('system_announcements')
      .insert({
        title: title.trim(),
        content: content.trim(),
        type: announcementType,
        expires_at: expiresAt || null,
        is_active: true,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SuperAdmin] publishSystemAnnouncement error:', error);
      throw error;
    }

    // Mirror to legacy announcements table for platform-wide compatibility
    try {
      await supabase.from('announcements').insert({
        title: title.trim(),
        body: content.trim(),
        is_pinned: priority === 'urgent',
        is_active: true,
        created_by: userId,
      });
    } catch {
      // Ignored non-fatal mirror
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[SuperAdmin] publishSystemAnnouncement exception:', err);
    throw err;
  }
}

/**
 * Helper to fetch list of churches for the assignment picker.
 */
export async function fetchChurchesList(): Promise<ChurchOption[]> {
  try {
    const { data, error } = await supabase
      .from('churches')
      .select('id, name, address')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as ChurchOption[];
  } catch (err) {
    console.error('[SuperAdmin] fetchChurchesList exception:', err);
    return [];
  }
}

// ============================================================================
// TanStack Query Hooks
// ============================================================================

export function useSystemOverviewMetrics() {
  return useQuery({
    queryKey: ['system-overview-metrics'],
    queryFn: fetchSystemOverviewMetrics,
    staleTime: 1000 * 20, // 20 seconds
  });
}

export function useParishApplications(statusFilter?: string) {
  return useQuery({
    queryKey: ['parish-applications', statusFilter || 'all'],
    queryFn: () => fetchParishApplications(statusFilter),
    staleTime: 1000 * 20,
  });
}

export function useReviewParishApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      status,
      adminFeedback,
    }: {
      applicationId: string;
      status: 'approved' | 'rejected' | 'verified_active';
      adminFeedback?: string;
    }) => reviewParishApplication(applicationId, status, adminFeedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parish-applications'] });
      queryClient.invalidateQueries({ queryKey: ['system-overview-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      queryClient.invalidateQueries({ queryKey: ['churches-list-for-assignment'] });
    },
  });
}

export function useSystemUsers(searchQuery?: string, roleFilter?: string) {
  return useQuery({
    queryKey: ['system-users', searchQuery || '', roleFilter || 'all'],
    queryFn: () => fetchSystemUsers(searchQuery, roleFilter),
    staleTime: 1000 * 20,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      newRole,
      assignedChurchId,
    }: {
      userId: string;
      newRole: 'user' | 'priest' | 'church_admin' | 'admin' | 'super_admin';
      assignedChurchId?: string | null;
    }) => updateUserRole(userId, newRole, assignedChurchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['system-overview-metrics'] });
    },
  });
}

export function usePublishSystemAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      content,
      priority,
      expiresAt,
    }: {
      title: string;
      content: string;
      priority: 'urgent' | 'advisory' | 'event' | 'general';
      expiresAt?: string | null;
    }) => publishSystemAnnouncement(title, content, priority, expiresAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['system-overview-metrics'] });
    },
  });
}

export function useChurchesList() {
  return useQuery({
    queryKey: ['churches-list-for-assignment'],
    queryFn: fetchChurchesList,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

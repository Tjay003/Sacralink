import { supabase } from '../supabase';

/** What deleting a church removes and who is affected (database function church_deletion_impact, migration 079). */
export interface ChurchDeletionImpact {
  name: string;
  church_admins: number;
  priests: number;
  volunteers: number;
  appointments: number;
  donations: number;
  donation_total: number;
  mass_schedules: number;
  announcements: number;
  images: number;
  conversations_kept: number;
}

export interface ArchivedAdminInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  current_role: string;
  current_church_id: string | null;
  current_church_name: string | null;
}

export interface ChurchRestoreStatus {
  can_auto_restore: boolean;
  archived_admin: ArchivedAdminInfo | null;
}

/** Super Admin only. Throws an Error whose message is safe to show. */
export async function getChurchDeletionImpact(churchId: string): Promise<ChurchDeletionImpact> {
  const { data, error } = await supabase.rpc('church_deletion_impact', { p_church_id: churchId });
  if (error || !data) throw new Error(error?.message || 'Could not load what deleting this church removes');
  return data as unknown as ChurchDeletionImpact;
}

/**
 * Delete a church through delete_church (Super Admin only): moves church to archived status,
 * demotes staff to parishioners, and keeps all historical records intact.
 * Throws an Error whose message is safe to show.
 */
export async function deleteChurch(churchId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_church', { p_church_id: churchId });
  if (error) throw new Error(error.message || 'Failed to delete the church');
}

/**
 * Check whether an archived church's former admin can be automatically restored
 * or if a replacement Church Admin must be selected (Super Admin only).
 */
export async function getChurchRestoreStatus(churchId: string): Promise<ChurchRestoreStatus> {
  const { data, error } = await supabase.rpc('church_restore_status', { p_church_id: churchId });
  if (error || !data) throw new Error(error?.message || 'Could not load church restore status');
  return data as unknown as ChurchRestoreStatus;
}

/**
 * Restore an archived church (Super Admin only).
 * If newAdminId is omitted, auto-restores the former admin if eligible.
 */
export async function restoreChurch(churchId: string, newAdminId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('restore_church', {
    p_church_id: churchId,
    p_new_admin_id: newAdminId ?? null,
  });
  if (error) throw new Error(error.message || 'Failed to restore the church');
}

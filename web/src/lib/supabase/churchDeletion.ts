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

/** Super Admin only. Throws an Error whose message is safe to show. */
export async function getChurchDeletionImpact(churchId: string): Promise<ChurchDeletionImpact> {
  const { data, error } = await supabase.rpc('church_deletion_impact', { p_church_id: churchId });
  if (error || !data) throw new Error(error?.message || 'Could not load what deleting this church removes');
  return data as unknown as ChurchDeletionImpact;
}

/**
 * Delete a church through delete_church (Super Admin only): its people become Parishioners and the church and its
 * records are removed in one transaction. Throws an Error whose message is safe to show.
 */
export async function deleteChurch(churchId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_church', { p_church_id: churchId });
  if (error) throw new Error(error.message || 'Failed to delete the church');
}

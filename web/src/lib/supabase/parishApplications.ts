import { supabase, uploadFile } from '../supabase';
import type { Database } from '../../types/database';
import { createNotification } from './notifications';
import { seedDefaultRequirements } from './requirements';

export type ParishApplication = Database['public']['Tables']['parish_applications']['Row'];
export type InsertParishApplication = Database['public']['Tables']['parish_applications']['Insert'];
export type UpdateParishApplication = Database['public']['Tables']['parish_applications']['Update'];

export type ParishApplicationStatus = 'pending' | 'under_review' | 'verified_active' | 'rejected';

export interface ApplicationChecklist {
  rectory_call: boolean;
  celebret_verified: boolean;
  merchant_entity_verified: boolean;
  notes: string;
}

export interface CreateParishApplicationParams {
  parish_name: string;
  address: string;
  contact_number?: string;
  email?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  gcash_number?: string;
  maya_number?: string;
  celebret_file: File;
  decree_file: File;
}

export interface ParishApplicationWithRelations extends ParishApplication {
  applicant?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name: string | null;
  } | null;
  church?: {
    id: string;
    name: string;
    status: string | null;
  } | null;
}

/**
 * Upload an application credential document (Celebret or Decree)
 */
export async function uploadApplicationDocument(file: File, folder: 'celebret' | 'decree'): Promise<string> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `parish-applications/${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;

  try {
    return await uploadFile('church-images', fileName, file);
  } catch (err) {
    // Fallback attempt to appointment-documents if church-images fails
    console.warn('Upload to church-images failed, trying appointment-documents bucket:', err);
    return await uploadFile('appointment-documents', fileName, file);
  }
}

/**
 * Submit a new parish verification onboarding application
 */
export async function submitParishApplication(
  params: CreateParishApplicationParams
): Promise<{ data: ParishApplication | null; error: Error | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('You must be logged in to submit a parish onboarding application');
    }

    const userId = authData.user.id;

    // 1. Upload the two mandatory verification documents
    const [celebretUrl, decreeUrl] = await Promise.all([
      uploadApplicationDocument(params.celebret_file, 'celebret'),
      uploadApplicationDocument(params.decree_file, 'decree'),
    ]);

    const initialChecklist: ApplicationChecklist = {
      rectory_call: false,
      celebret_verified: false,
      merchant_entity_verified: false,
      notes: '',
    };

    // 2. Insert application record
    const insertPayload: InsertParishApplication = {
      applicant_id: userId,
      parish_name: params.parish_name.trim(),
      address: params.address.trim(),
      contact_number: params.contact_number?.trim() || null,
      email: params.email?.trim() || null,
      description: params.description?.trim() || null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      gcash_number: params.gcash_number?.trim() || null,
      maya_number: params.maya_number?.trim() || null,
      celebret_url: celebretUrl,
      decree_url: decreeUrl,
      status: 'pending',
      checklist: initialChecklist as any,
    };

    const { data, error } = await supabase
      .from('parish_applications')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    // 3. Notify Super Admins of new pending application
    try {
      const { data: superAdmins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin');

      if (superAdmins && superAdmins.length > 0) {
        await Promise.all(
          superAdmins.map((sa) =>
            createNotification({
              userId: sa.id,
              type: 'parish_application_submitted',
              title: 'New Parish Application',
              message: `A new onboarding application for "${params.parish_name}" has been submitted for review.`,
              link: '/admin/applications',
            })
          )
        );
      }
    } catch (notifErr) {
      console.warn('Failed to dispatch notifications to super admins:', notifErr);
    }

    return { data: data as ParishApplication, error: null };
  } catch (err: any) {
    console.error('Error submitting parish application:', err);
    return { data: null, error: err instanceof Error ? err : new Error(err.message || 'Submission failed') };
  }
}

/**
 * Fetch all parish applications for Super Admin review queue
 */
export async function getParishApplications(): Promise<{
  data: ParishApplicationWithRelations[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('parish_applications')
      .select(`
        *,
        applicant:profiles!parish_applications_applicant_id_fkey(id, full_name, email, phone_number),
        reviewer:profiles!parish_applications_reviewed_by_fkey(id, full_name),
        church:churches!parish_applications_church_id_fkey(id, name, status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: (data as unknown as ParishApplicationWithRelations[]) || [], error: null };
  } catch (err: any) {
    console.error('Error fetching parish applications:', err);
    return { data: null, error: err instanceof Error ? err : new Error(err.message || 'Failed to fetch applications') };
  }
}

/**
 * Fetch current user's submitted parish applications
 */
export async function getMyParishApplications(): Promise<{
  data: ParishApplication[] | null;
  error: Error | null;
}> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { data: [], error: null };

    const { data, error } = await supabase
      .from('parish_applications')
      .select('*')
      .eq('applicant_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error fetching user parish applications:', err);
    return { data: null, error: err instanceof Error ? err : new Error(err.message || 'Failed to fetch your applications') };
  }
}

/**
 * Fetch single parish application details
 */
export async function getParishApplicationById(id: string): Promise<{
  data: ParishApplicationWithRelations | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('parish_applications')
      .select(`
        *,
        applicant:profiles!parish_applications_applicant_id_fkey(id, full_name, email, phone_number),
        reviewer:profiles!parish_applications_reviewed_by_fkey(id, full_name),
        church:churches!parish_applications_church_id_fkey(id, name, status)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data: data as unknown as ParishApplicationWithRelations, error: null };
  } catch (err: any) {
    console.error('Error fetching parish application by id:', err);
    return { data: null, error: err instanceof Error ? err : new Error(err.message || 'Application not found') };
  }
}

/**
 * Update checklist progress or mark application as under review
 */
export async function updateApplicationChecklist(
  id: string,
  checklist: ApplicationChecklist,
  status: ParishApplicationStatus = 'under_review'
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('parish_applications')
      .update({
        checklist: checklist as any,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('Error updating application checklist:', err);
    return { error: err instanceof Error ? err : new Error(err.message || 'Failed to update checklist') };
  }
}

/**
 * Approve a parish application, creating or activating the church and granting permissions
 */
export async function approveParishApplication(
  id: string,
  checklist: ApplicationChecklist
): Promise<{ churchId: string | null; error: Error | null }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const reviewerId = authData.user?.id || null;

    // 1. Fetch current application
    const { data: application, error: appError } = await supabase
      .from('parish_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (appError || !application) {
      throw new Error(appError?.message || 'Application not found');
    }

    let finalChurchId = application.church_id;

    // 2. If church doesn't exist yet, insert into churches table with status = 'verified_active'
    if (!finalChurchId) {
      const { data: newChurch, error: churchError } = await supabase
        .from('churches')
        .insert({
          name: application.parish_name,
          address: application.address,
          contact_number: application.contact_number,
          email: application.email,
          description: application.description,
          latitude: application.latitude,
          longitude: application.longitude,
          gcash_number: application.gcash_number,
          maya_number: application.maya_number,
          status: 'verified_active',
          is_active: true,
        })
        .select('id')
        .single();

      if (churchError) throw churchError;
      finalChurchId = newChurch.id;

      // Seed default sacrament requirements for the newly created church
      try {
        await seedDefaultRequirements(finalChurchId);
      } catch (seedErr) {
        console.warn('Failed to seed default sacrament requirements for verified church:', seedErr);
      }
    } else {
      // If church already existed, set status to verified_active
      const { error: updateChurchErr } = await supabase
        .from('churches')
        .update({
          status: 'verified_active',
          is_active: true,
          gcash_number: application.gcash_number,
          maya_number: application.maya_number,
          latitude: application.latitude,
          longitude: application.longitude,
        })
        .eq('id', finalChurchId);

      if (updateChurchErr) throw updateChurchErr;
    }

    // 3. Update the applicant profile to assign them to this church as church_admin
    if (application.applicant_id && finalChurchId) {
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', application.applicant_id)
          .single();

        const updates: { assigned_church_id: string; role?: 'church_admin' } = {
          assigned_church_id: finalChurchId,
        };

        if (userProfile && userProfile.role === 'user') {
          updates.role = 'church_admin';
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', application.applicant_id);
      } catch (profErr) {
        console.warn('Failed to update applicant assigned church profile:', profErr);
      }
    }

    // 4. Update the parish_applications record
    const { error: updateAppErr } = await supabase
      .from('parish_applications')
      .update({
        status: 'verified_active',
        checklist: checklist as any,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        church_id: finalChurchId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateAppErr) throw updateAppErr;

    // 5. Notify the applicant of approval
    if (application.applicant_id) {
      try {
        await createNotification({
          userId: application.applicant_id,
          type: 'parish_application_approved',
          title: 'Parish Application Approved',
          message: `Your application for "${application.parish_name}" has been verified and activated! Cashless donations and sacrament scheduling are now active.`,
          link: `/churches/${finalChurchId}`,
        });
      } catch (notifErr) {
        console.warn('Failed to notify applicant of approval:', notifErr);
      }
    }

    return { churchId: finalChurchId, error: null };
  } catch (err: any) {
    console.error('Error approving parish application:', err);
    return { churchId: null, error: err instanceof Error ? err : new Error(err.message || 'Approval failed') };
  }
}

/**
 * Reject a parish application with a recorded reason
 */
export async function rejectParishApplication(
  id: string,
  rejectionReason: string,
  checklist?: ApplicationChecklist
): Promise<{ error: Error | null }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const reviewerId = authData.user?.id || null;

    // 1. Fetch current application
    const { data: application, error: appError } = await supabase
      .from('parish_applications')
      .select('applicant_id, parish_name')
      .eq('id', id)
      .single();

    if (appError || !application) {
      throw new Error(appError?.message || 'Application not found');
    }

    const updatePayload: UpdateParishApplication = {
      status: 'rejected',
      rejection_reason: rejectionReason.trim(),
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (checklist) {
      updatePayload.checklist = checklist as any;
    }

    // 2. Update application record
    const { error: updateErr } = await supabase
      .from('parish_applications')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) throw updateErr;

    // 3. Notify applicant of rejection
    if (application.applicant_id) {
      try {
        await createNotification({
          userId: application.applicant_id,
          type: 'parish_application_rejected',
          title: 'Parish Application Rejected',
          message: `Your application for "${application.parish_name}" was rejected. Reason: ${rejectionReason.trim()}`,
          link: '/churches/apply',
        });
      } catch (notifErr) {
        console.warn('Failed to notify applicant of rejection:', notifErr);
      }
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error rejecting parish application:', err);
    return { error: err instanceof Error ? err : new Error(err.message || 'Rejection failed') };
  }
}

import { supabase, uploadFile } from '../supabase';
import type { Database, Json } from '../../types/database';
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

export const APPLICANT_BUCKET = 'applicant-verification';
export const APPLICANT_MAX_ATTEMPTS = 3;
export const APPLICANT_POSITIONS = ['Parish Priest', 'Parochial Administrator', 'Parish Secretary', 'Other'] as const;

export interface ApplicantVerificationInput {
  legal_name: string;
  position: string;
  phone: string;
  id_file: File;
  selfie_file: File;
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
  applicant: ApplicantVerificationInput;
}

export interface ParishApplicationWithRelations extends ParishApplication {
  applicant?: {
    id: string;
    full_name: string | null;
    deleted_at?: string | null;
    email: string | null;
    phone_number: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name: string | null;
    deleted_at?: string | null;
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
 * Upload the applicant's ID and selfie to the private bucket and submit the applicant part for review.
 * Files go to <user id>/..., never a public URL; only the applicant and the Super Admin can read them (migration 078).
 */
export async function submitApplicantVerification(
  applicationId: string,
  input: ApplicantVerificationInput
): Promise<{ error: Error | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('You must be logged in to submit your applicant details');

    const upload = async (kind: 'id' | 'selfie', file: File) => {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${authData.user.id}/${Date.now()}_${kind}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;
      const { error } = await supabase.storage.from(APPLICANT_BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw error;
      return path;
    };

    const [idPath, selfiePath] = await Promise.all([upload('id', input.id_file), upload('selfie', input.selfie_file)]);

    const { error } = await supabase.rpc('submit_applicant_verification', {
      p_application_id: applicationId,
      p_legal_name: input.legal_name,
      p_position: input.position,
      p_phone: input.phone,
      p_id_path: idPath,
      p_selfie_path: selfiePath,
    });
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    console.error('Error submitting applicant verification:', err);
    return { error: err instanceof Error ? err : new Error(err.message || 'Failed to submit your applicant details') };
  }
}

export interface ApplicantChecklist {
  id_valid: boolean;
  face_matches_selfie: boolean;
  name_matches_documents: boolean;
  position_plausible: boolean;
}

/**
 * Super Admin: record the applicant outcome. A rejection needs a reason of 10+ characters and notifies the applicant.
 */
export async function reviewApplicantVerification(
  application: Pick<ParishApplication, 'id' | 'applicant_id' | 'parish_name'>,
  passed: boolean,
  checklist: ApplicantChecklist,
  reason: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('review_applicant_verification', {
      p_application_id: application.id,
      p_passed: passed,
      p_checklist: checklist as unknown as Json,
      p_reason: reason.trim() || null,
    });
    if (error) throw error;

    if (!passed && application.applicant_id) {
      try {
        await createNotification({
          userId: application.applicant_id,
          type: 'parish_applicant_rejected',
          title: 'Applicant Details Need Attention',
          message: `Your applicant details for "${application.parish_name}" were not accepted: ${reason.trim()} You can submit them again from My Applications.`,
          link: '/churches/apply',
        });
      } catch (notifErr) {
        console.warn('Failed to notify applicant of rejected details:', notifErr);
      }
    }
    return { error: null };
  } catch (err) {
    console.error('Error reviewing applicant verification:', err);
    return { error: err instanceof Error ? err : new Error('Failed to record the applicant review') };
  }
}

/**
 * Super Admin: ask an applicant who applied before applicant verification existed to send their details.
 */
export async function requestApplicantDetails(
  application: Pick<ParishApplication, 'applicant_id' | 'parish_name'>
): Promise<{ error: Error | null }> {
  if (!application.applicant_id) return { error: new Error('This application has no applicant to notify') };
  const { error } = await createNotification({
    userId: application.applicant_id,
    type: 'parish_applicant_details_requested',
    title: 'Applicant Details Requested',
    message: `To continue the review of "${application.parish_name}", please submit your legal name, position, photo ID and a selfie holding it from My Applications.`,
    link: '/churches/apply',
  });
  return { error: error instanceof Error ? error : error ? new Error(String(error.message ?? error)) : null };
}

/**
 * Short-lived private links to an applicant's ID and selfie. Only the Super Admin (and the applicant) can create them.
 */
export async function getApplicantFileUrls(
  idPath: string,
  selfiePath: string,
  expiresInSeconds = 300
): Promise<{ idUrl: string | null; selfieUrl: string | null; error: Error | null }> {
  const storage = supabase.storage.from(APPLICANT_BUCKET);
  const [idResult, selfieResult] = await Promise.all([
    storage.createSignedUrl(idPath, expiresInSeconds),
    storage.createSignedUrl(selfiePath, expiresInSeconds),
  ]);
  const failure = idResult.error ?? selfieResult.error;
  return {
    idUrl: idResult.data?.signedUrl ?? null,
    selfieUrl: selfieResult.data?.signedUrl ?? null,
    error: failure ? new Error(failure.message) : null,
  };
}

/**
 * Submit a new parish verification onboarding application
 */
export async function submitParishApplication(
  params: CreateParishApplicationParams
): Promise<{ data: ParishApplication | null; error: Error | null; applicantError?: Error | null }> {
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

    // 3. Submit the applicant part. If it fails the parish part is still saved and can be completed from My Applications.
    const { error: applicantError } = await submitApplicantVerification(data.id, params.applicant);

    // 4. Notify Super Admins of new pending application
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

    const { data: saved } = await supabase.from('parish_applications').select('*').eq('id', data.id).single();
    return { data: (saved ?? data) as ParishApplication, error: null, applicantError };
  } catch (err: any) {
    console.error('Error submitting parish application:', err);
    return { data: null, error: err instanceof Error ? err : new Error(err.message || 'Submission failed') };
  }
}

export interface ParishApplicationPaginationOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

/**
 * Fetch all parish applications for Super Admin review queue
 */
export async function getParishApplications(
  options?: ParishApplicationPaginationOptions
): Promise<{
  data: ParishApplicationWithRelations[] | null;
  count: number;
  error: Error | null;
}> {
  try {
    let query = supabase
      .from('parish_applications')
      .select(`
        *,
        applicant:profiles!parish_applications_applicant_id_fkey(id, full_name, deleted_at, email, phone_number),
        reviewer:profiles!parish_applications_reviewed_by_fkey(id, full_name, deleted_at),
        church:churches!parish_applications_church_id_fkey(id, name, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.page && options?.pageSize) {
      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: (data as unknown as ParishApplicationWithRelations[]) || [],
      count: count ?? (data?.length || 0),
      error: null,
    };
  } catch (err: any) {
    console.error('Error fetching parish applications:', err);
    return {
      data: null,
      count: 0,
      error: err instanceof Error ? err : new Error(err.message || 'Failed to fetch applications'),
    };
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
        applicant:profiles!parish_applications_applicant_id_fkey(id, full_name, deleted_at, email, phone_number),
        reviewer:profiles!parish_applications_reviewed_by_fkey(id, full_name, deleted_at),
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
    // 1. One database transaction: both verifications must have passed, then the church is created or activated,
    //    the applicant gets their role through set_user_role and the application is marked approved (migration 078).
    const { data, error: approveErr } = await supabase.rpc('approve_parish_application', {
      p_application_id: id,
      p_checklist: checklist as unknown as Json,
    });
    if (approveErr) throw approveErr;

    const result = (Array.isArray(data) ? data[0] : data) as { church_id: string; church_created: boolean } | null;
    if (!result?.church_id) throw new Error('Approval did not return a church');
    const finalChurchId = result.church_id;

    // 2. Seed the starter services and their default requirements for a newly created church
    if (result.church_created) {
      try {
        await seedDefaultRequirements(finalChurchId);
      } catch (seedErr) {
        console.warn('Failed to seed default sacrament requirements for verified church:', seedErr);
      }
    }

    const { data: application } = await supabase
      .from('parish_applications')
      .select('applicant_id, parish_name')
      .eq('id', id)
      .single();

    // 3. Notify the applicant of approval
    if (application?.applicant_id) {
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

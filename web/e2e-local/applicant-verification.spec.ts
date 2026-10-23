import { test, expect } from '@playwright/test';
import { deleteTempAccounts, getSeed, serviceClient, soleSuperAdmin, tempUser, type TempAccount } from './support';

/**
 * Migration 078: applicant verification for parish applications.
 * Database rules only: who can read an uploaded ID, the approval refusal, the attempt limit and retention.
 * Every account, application, church and stored file here is created by this spec and removed afterwards.
 */

const db = serviceClient();
const TAG = 'applver';
const BUCKET = 'applicant-verification';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

let applicant: TempAccount;
let otherApplicant: TempAccount;
let churchAdmin: TempAccount;
let parishioner: TempAccount;
let superAdmin: TempAccount;
let restoreSuperAdmin: () => Promise<void>;
let churchId: string;
const applicationIds: string[] = [];
const filePaths: string[] = [];
const createdChurches: string[] = [];

async function newApplication(owner: TempAccount, label: string) {
  const { data, error } = await db
    .from('parish_applications')
    .insert({
      applicant_id: owner.id,
      parish_name: `${TAG} ${label} ${Date.now()}`,
      address: '1 Test Street',
      celebret_url: 'celebret.png',
      decree_url: 'decree.png',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw error;
  applicationIds.push(data.id);
  return data.id as string;
}

async function upload(owner: TempAccount, name: string) {
  const path = `${owner.id}/${Date.now()}-${name}.png`;
  const { error } = await owner.client.storage.from(BUCKET).upload(path, PNG, { contentType: 'image/png' });
  if (error) throw error;
  filePaths.push(path);
  return path;
}

async function submit(owner: TempAccount, applicationId: string) {
  const idPath = await upload(owner, 'id');
  const selfiePath = await upload(owner, 'selfie');
  return owner.client.rpc('submit_applicant_verification', {
    p_application_id: applicationId,
    p_legal_name: 'Juan Dela Cruz',
    p_position: 'Parish Priest',
    p_phone: '09171234567',
    p_id_path: idPath,
    p_selfie_path: selfiePath,
  });
}

async function application(id: string) {
  const { data, error } = await db.from('parish_applications').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const seed = await getSeed();
  churchId = seed.churchId;
  applicant = await tempUser(TAG, 'applicant', 'user', null);
  otherApplicant = await tempUser(TAG, 'other-applicant', 'user', null);
  churchAdmin = await tempUser(TAG, 'church-admin', 'church_admin', churchId);
  parishioner = await tempUser(TAG, 'parishioner', 'user', null);
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
});

test.afterAll(async () => {
  if (filePaths.length) await db.storage.from(BUCKET).remove(filePaths);
  if (applicationIds.length) await db.from('parish_applications').delete().in('id', applicationIds);
  await deleteTempAccounts([applicant, otherApplicant, churchAdmin, parishioner]);
  if (createdChurches.length) await db.from('churches').delete().in('id', createdChurches);
  if (restoreSuperAdmin) await restoreSuperAdmin();
});

test('only the applicant (own folder) and the Super Admin can read an uploaded ID', async () => {
  await newApplication(applicant, 'storage');
  await newApplication(otherApplicant, 'storage-other');
  const path = await upload(applicant, 'id');

  // Writing into somebody else's folder is refused
  const intruder = await otherApplicant.client.storage
    .from(BUCKET)
    .upload(`${applicant.id}/${Date.now()}-intruder.png`, PNG, { contentType: 'image/png' });
  expect(intruder.error).not.toBeNull();

  // Someone without an open application cannot upload at all, even into their own folder
  const noApplication = await parishioner.client.storage
    .from(BUCKET)
    .upload(`${parishioner.id}/${Date.now()}-id.png`, PNG, { contentType: 'image/png' });
  expect(noApplication.error).not.toBeNull();

  // Read matrix: applicant and Super Admin can; the others and signed URLs for them cannot
  expect((await applicant.client.storage.from(BUCKET).download(path)).error).toBeNull();
  expect((await superAdmin.client.storage.from(BUCKET).download(path)).error).toBeNull();
  for (const outsider of [otherApplicant, churchAdmin, parishioner]) {
    expect((await outsider.client.storage.from(BUCKET).download(path)).error).not.toBeNull();
    expect((await outsider.client.storage.from(BUCKET).createSignedUrl(path, 60)).data).toBeNull();
  }

  // A Super Admin signed URL works, and the bucket is not public
  const signed = await superAdmin.client.storage.from(BUCKET).createSignedUrl(path, 60);
  expect(signed.data?.signedUrl).toBeTruthy();
  expect((await fetch(signed.data!.signedUrl)).status).toBe(200);
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  expect((await fetch(publicUrl)).status).not.toBe(200);
});

test('submit, review and resubmit follow the rules and stop after three attempts', async () => {
  const id = await newApplication(applicant, 'attempts');

  // Nobody but the applicant can submit for this application
  const intruderIdPath = await upload(otherApplicant, 'id');
  const foreign = await otherApplicant.client.rpc('submit_applicant_verification', {
    p_application_id: id,
    p_legal_name: 'Someone Else',
    p_position: 'Parish Priest',
    p_phone: '0917',
    p_id_path: intruderIdPath,
    p_selfie_path: intruderIdPath,
  });
  expect(foreign.error).not.toBeNull();

  // A path outside the applicant's own folder is refused
  const wrongFolder = await applicant.client.rpc('submit_applicant_verification', {
    p_application_id: id,
    p_legal_name: 'Juan Dela Cruz',
    p_position: 'Parish Priest',
    p_phone: '09171234567',
    p_id_path: intruderIdPath,
    p_selfie_path: intruderIdPath,
  });
  expect(wrongFolder.error?.message).toContain('own folder');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const submitted = await submit(applicant, id);
    expect(submitted.error).toBeNull();
    const pending = await application(id);
    expect(pending.applicant_status).toBe('pending');
    expect(pending.applicant_attempts).toBe(attempt);

    // Only the Super Admin reviews, and a rejection needs a real reason
    expect((await churchAdmin.client.rpc('review_applicant_verification', { p_application_id: id, p_passed: false, p_checklist: {}, p_reason: 'Not allowed to do this' })).error).not.toBeNull();
    const shortReason = await superAdmin.client.rpc('review_applicant_verification', { p_application_id: id, p_passed: false, p_checklist: {}, p_reason: 'blurry' });
    expect(shortReason.error?.message).toContain('10 characters');

    const rejected = await superAdmin.client.rpc('review_applicant_verification', {
      p_application_id: id,
      p_passed: false,
      p_checklist: { id_valid: false },
      p_reason: 'The photo ID is too blurry to read',
    });
    expect(rejected.error).toBeNull();
    const after = await application(id);
    expect(after.applicant_status).toBe('rejected');
    expect(after.applicant_rejection_reason).toBe('The photo ID is too blurry to read');
    expect(after.applicant_reviewed_by).toBe(superAdmin.id);
  }

  // The fourth attempt is refused, and the third rejection started the retention clock
  const fourth = await submit(applicant, id);
  expect(fourth.error?.message).toContain('new application');
  const final = await application(id);
  expect(final.applicant_attempts).toBe(3);
  expect(final.applicant_files_delete_after).not.toBeNull();
});

test('approval is refused until the applicant passes, then the applicant becomes Church Admin', async () => {
  const id = await newApplication(parishioner, 'approval');

  // The applicant cannot write the applicant columns or approve themselves, however they try
  const selfPass = await parishioner.client.from('parish_applications').update({ applicant_status: 'passed' }).eq('id', id);
  expect(selfPass.error ?? (await application(id)).applicant_status === 'not_submitted' ? null : new Error('changed')).toBeNull();
  expect((await application(id)).applicant_status).toBe('not_submitted');
  const selfInsert = await parishioner.client
    .from('parish_applications')
    .insert({ applicant_id: parishioner.id, parish_name: `${TAG} forged`, address: 'x', celebret_url: 'c', decree_url: 'd', applicant_status: 'passed', status: 'verified_active' })
    .select('id, status, applicant_status')
    .maybeSingle();
  if (selfInsert.data) {
    applicationIds.push(selfInsert.data.id);
    expect(selfInsert.data.status).toBe('pending');
    expect(selfInsert.data.applicant_status).toBe('not_submitted');
  }

  // Not submitted: approval refused with a readable message, and the Super Admin cannot flip the status directly either
  const early = await superAdmin.client.rpc('approve_parish_application', { p_application_id: id, p_checklist: {} });
  expect(early.error?.message).toContain('applicant must be verified');
  const direct = await superAdmin.client.from('parish_applications').update({ status: 'verified_active' }).eq('id', id);
  expect(direct.error).not.toBeNull();
  expect((await application(id)).status).toBe('pending');
  const forced = await superAdmin.client.from('parish_applications').update({ applicant_status: 'passed' }).eq('id', id);
  expect(forced.error).not.toBeNull();

  // Submitted but still pending: still refused
  expect((await submit(parishioner, id)).error).toBeNull();
  const stillPending = await superAdmin.client.rpc('approve_parish_application', { p_application_id: id, p_checklist: {} });
  expect(stillPending.error).not.toBeNull();

  // Passed: only the Super Admin can approve
  const passed = await superAdmin.client.rpc('review_applicant_verification', { p_application_id: id, p_passed: true, p_checklist: { id_valid: true } });
  expect(passed.error).toBeNull();
  expect((await churchAdmin.client.rpc('approve_parish_application', { p_application_id: id, p_checklist: {} })).error).not.toBeNull();

  const approved = await superAdmin.client.rpc('approve_parish_application', { p_application_id: id, p_checklist: { rectory_call: true } });
  expect(approved.error).toBeNull();
  const row = Array.isArray(approved.data) ? approved.data[0] : approved.data;
  expect(row.church_created).toBe(true);
  createdChurches.push(row.church_id);

  const decided = await application(id);
  expect(decided.status).toBe('verified_active');
  expect(decided.church_id).toBe(row.church_id);
  expect(decided.reviewed_by).toBe(superAdmin.id);
  expect(decided.applicant_files_delete_after).not.toBeNull();

  const { data: profile } = await db.from('profiles').select('role, assigned_church_id').eq('id', parishioner.id).single();
  expect(profile?.role).toBe('church_admin');
  expect(profile?.assigned_church_id).toBe(row.church_id);

  // A second approval is refused
  expect((await superAdmin.client.rpc('approve_parish_application', { p_application_id: id, p_checklist: {} })).error).not.toBeNull();

  // Nothing about the ID leaks into notifications or the activity log
  const paths = [decided.applicant_id_path, decided.applicant_selfie_path] as string[];
  const { data: logs } = await db.from('activity_logs').select('metadata, action').eq('user_id', superAdmin.id);
  const { data: notifications } = await db.from('notifications').select('message, title, link').eq('user_id', parishioner.id);
  const haystack = JSON.stringify([logs, notifications]);
  for (const path of paths) expect(haystack).not.toContain(path);
});

test('files are removed after the retention date; the checklist and reviewer remain', async () => {
  const id = await newApplication(otherApplicant, 'retention');
  expect((await submit(otherApplicant, id)).error).toBeNull();
  expect((await superAdmin.client.rpc('review_applicant_verification', { p_application_id: id, p_passed: true, p_checklist: { id_valid: true } })).error).toBeNull();

  const before = await application(id);
  const paths = [before.applicant_id_path, before.applicant_selfie_path] as string[];

  // Not due yet: nothing is listed for this application
  const early = await db.rpc('applicant_files_due_for_purge');
  expect((early.data ?? []).filter((row: { application_id: string }) => row.application_id === id)).toHaveLength(0);

  // The retention date passes
  await db.from('parish_applications').update({ status: 'rejected', applicant_files_delete_after: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
  const due = await db.rpc('applicant_files_due_for_purge');
  const mine = (due.data ?? []).filter((row: { application_id: string }) => row.application_id === id);
  expect(mine.map((row: { file_path: string }) => row.file_path).sort()).toEqual([...paths].sort());

  // The purge job deletes the files through the Storage API, then records it
  const removed = await db.storage.from(BUCKET).remove(paths);
  expect(removed.error).toBeNull();
  const marked = await db.rpc('mark_applicant_files_purged', { p_application_ids: [id] });
  expect(marked.data).toBe(1);

  for (const path of paths) expect((await superAdmin.client.storage.from(BUCKET).download(path)).error).not.toBeNull();
  const after = await application(id);
  expect(after.applicant_id_path).toBeNull();
  expect(after.applicant_selfie_path).toBeNull();
  expect(after.applicant_status).toBe('passed');
  expect(after.applicant_checklist).toEqual({ id_valid: true });
  expect(after.applicant_reviewed_by).toBe(superAdmin.id);

  // The purge functions are not callable by signed-in users
  expect((await superAdmin.client.rpc('applicant_files_due_for_purge')).error).not.toBeNull();
  expect((await superAdmin.client.rpc('mark_applicant_files_purged', { p_application_ids: [id] })).error).not.toBeNull();
});

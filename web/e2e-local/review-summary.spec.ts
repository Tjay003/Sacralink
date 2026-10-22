import { test, expect } from '@playwright/test';
import { deleteTempAccounts, getSeed, isoDate, serviceClient, soleSuperAdmin, tempUser, type Seed, type TempAccount } from './support';

/**
 * Migration 076: get_user_review_summary. Super Admin only, counts and recent activity from existing data,
 * never message text, donation amounts or file URLs.
 */

const db = serviceClient();
const TAG = 'rev-sum';
const SECRET_TEXT = 'rev-sum-private-message-body';
const SECRET_PROOF = 'https://example.test/rev-sum-secret-proof.png';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let churchAdmin: TempAccount;
let priest: TempAccount;
let subject: TempAccount;
const accounts: TempAccount[] = [];

async function makeUser(label: string, role: string, churchId: string | null) {
  const account = await tempUser(TAG, label, role, churchId);
  accounts.push(account);
  return account;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  churchAdmin = await makeUser('church-admin', 'church_admin', seed.churchId);
  priest = await makeUser('priest', 'priest', seed.churchId);
  subject = await makeUser('subject', 'user', seed.churchId);

  for (const status of ['approved', 'cancelled']) {
    const { error } = await db.from('appointments').insert({
      user_id: subject.id, church_id: seed.churchId, service_type: 'Baptism',
      appointment_date: isoDate(30), appointment_time: '10:00:00', status,
    });
    if (error) throw error;
  }
  const { error: donErr } = await db.from('donations').insert([
    { user_id: subject.id, church_id: seed.churchId, amount: 987.65, status: 'verified', proof_url: SECRET_PROOF },
    { user_id: subject.id, church_id: seed.churchId, amount: 123.45, status: 'rejected', proof_url: SECRET_PROOF },
  ]);
  if (donErr) throw donErr;
  const { data: conv, error: convErr } = await db.from('conversations')
    .insert({ title: `${TAG} direct`, type: 'direct', created_by: subject.id }).select('id').single();
  if (convErr) throw convErr;
  const { error: msgErr } = await db.from('messages').insert({ conversation_id: conv.id, sender_id: subject.id, content: SECRET_TEXT });
  if (msgErr) throw msgErr;
  const now = Date.now();
  const { error: logErr } = await db.from('activity_logs').insert(
    Array.from({ length: 12 }, (_, i) => ({
      user_id: subject.id, church_id: seed.churchId, action: `rev_action_${i}`, entity_type: 'test',
      created_at: new Date(now - i * 60_000).toISOString(),
    })),
  );
  if (logErr) throw logErr;
});

test.afterAll(async () => {
  await db.from('conversations').delete().like('title', `%${TAG}%`);
  const ids = accounts.map((a) => a.id);
  await db.from('activity_logs').delete().in('user_id', ids);
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test('the Super Admin gets the profile facts, the counts and only the 10 newest activities', async () => {
  const { data, error } = await superAdmin.client.rpc('get_user_review_summary', { p_user_id: subject.id });
  expect(error).toBeNull();
  expect(data).toMatchObject({
    user_id: subject.id, email: subject.email, role: 'user', church_id: seed.churchId,
    suspended_at: null, deleted_at: null,
    counts: { appointments: 2, appointments_cancelled: 1, donations: 2, donations_rejected: 1, messages_sent: 1, tickets_raised: 0 },
  });
  expect(data.created_at).toBeTruthy();
  expect(data.church_name).toBeTruthy();
  expect(data.recent_activity).toHaveLength(10);
  expect(data.recent_activity[0].action).toBe('rev_action_0');
  expect(data.recent_activity[9].action).toBe('rev_action_9');
});

test('no message text, donation amount or proof URL is ever exposed', async () => {
  const { data } = await superAdmin.client.rpc('get_user_review_summary', { p_user_id: subject.id });
  const text = JSON.stringify(data);
  for (const leaked of [SECRET_TEXT, SECRET_PROOF, '987.65', '123.45']) expect(text).not.toContain(leaked);
});

test('every other role is rejected, including the Church Admin, the Priest and the person themselves', async () => {
  for (const [label, caller] of [['church admin', churchAdmin], ['priest', priest], ['subject', subject]] as const) {
    const { data, error } = await caller.client.rpc('get_user_review_summary', { p_user_id: subject.id });
    expect(error, label).not.toBeNull();
    expect(data, label).toBeNull();
  }
});

test('a user who never signed in has a null last sign-in and no activity gives an empty list; a suspended user shows the state', async () => {
  const email = `${TAG}-fresh@local.test`;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  // Created through the admin API and never signed in
  const { data: created, error: createErr } = await db.auth.admin.createUser({ email, password: 'LocalTest#123', email_confirm: true });
  if (createErr) throw createErr;
  const fresh = { id: created.user.id, email, client: superAdmin.client } as TempAccount;
  accounts.push(fresh);
  await db.from('profiles').upsert({ id: fresh.id, email, full_name: 'Temp fresh', role: 'user', is_verified: true });

  const { data } = await superAdmin.client.rpc('get_user_review_summary', { p_user_id: fresh.id });
  expect(data.last_sign_in_at).toBeNull();
  expect(data.recent_activity).toEqual([]);
  expect(data.counts.appointments).toBe(0);

  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: fresh.id, p_reason: 'Investigating a report' })).error).toBeNull();
  const { data: suspended } = await superAdmin.client.rpc('get_user_review_summary', { p_user_id: fresh.id });
  expect(suspended.suspended_at).not.toBeNull();
});

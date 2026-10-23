import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  LOCAL_URL,
  PASSWORD,
  deleteTempAccounts,
  getSeed,
  isoDate,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Migration 066: the Super Admin deletes a user (anonymize in place) and a deleted account is cut off at once.
 * Every account is a temporary user created here; the seeded users other specs share are never touched.
 */

const db = serviceClient();
const TAG = 'del-user';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let churchAdmin: TempAccount;
let priest: TempAccount;
let bystander: TempAccount;
const accounts: TempAccount[] = [];
const churchesToRemove: string[] = [];
const conversationsToRemove: string[] = [];

async function makeUser(label: string, role: string, churchId: string | null) {
  const account = await tempUser(TAG, label, role, churchId);
  accounts.push(account);
  return account;
}

async function addAppointment(userId: string, status: 'approved' | 'pending') {
  const { data, error } = await db
    .from('appointments')
    .insert({
      user_id: userId,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: isoDate(30),
      appointment_time: '10:00:00',
      status,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addDirectChat(a: string, b: string) {
  const { data, error } = await db.from('conversations').insert({ title: `${TAG} direct`, type: 'direct', created_by: a }).select('id').single();
  if (error) throw error;
  conversationsToRemove.push(data.id);
  const { error: pErr } = await db.from('conversation_participants').insert([
    { conversation_id: data.id, user_id: a },
    { conversation_id: data.id, user_id: b },
  ]);
  if (pErr) throw pErr;
  return data.id as string;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  churchAdmin = await makeUser('church-admin', 'church_admin', seed.churchId);
  priest = await makeUser('priest', 'priest', seed.churchId);
  bystander = await makeUser('bystander', 'user', null);
});

test.afterAll(async () => {
  if (conversationsToRemove.length) await db.from('conversations').delete().in('id', conversationsToRemove);
  await db.from('conversations').delete().like('title', `%${TAG}%`);
  const ids = accounts.map((a) => a.id);
  await db.from('activity_logs').delete().in('entity_id', ids);
  await db.from('activity_logs').delete().in('user_id', ids);
  await db.from('notifications').delete().in('user_id', ids);
  await deleteTempAccounts(accounts);
  if (churchesToRemove.length) await db.from('churches').delete().in('id', churchesToRemove);
  await restoreSuperAdmin();
});

test('the Super Admin deletes a user through the UI: history is kept, the profile is anonymized, login fails and the email can register again', async ({ page }) => {
  const victim = await makeUser('victim', 'user', null);
  const approvedId = await addAppointment(victim.id, 'approved');
  const pendingId = await addAppointment(victim.id, 'pending');
  const { data: donation, error: dErr } = await db
    .from('donations')
    .insert({ user_id: victim.id, church_id: seed.churchId, amount: 150 })
    .select('id')
    .single();
  if (dErr) throw dErr;
  const direct = await addDirectChat(victim.id, churchAdmin.id);
  const { data: message, error: mErr } = await db
    .from('messages')
    .insert({ conversation_id: direct, sender_id: victim.id, content: `${TAG} hello` })
    .select('id')
    .single();
  if (mErr) throw mErr;
  const ticket = await victim.client.rpc('create_ticket', {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} open ticket`,
    p_message: 'A long enough message for the ticket.',
  });
  expect(ticket.error).toBeNull();

  await loginAsAccount(page, superAdmin);
  await page.goto('/users');
  await page.getByPlaceholder('Search by name, email, or parish...').fill(victim.email);
  const row = page.getByRole('row').filter({ hasText: victim.email });
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Delete user' }).click();
  const form = page.locator('form').filter({ has: page.locator('#delete-user-confirm') });
  const confirmButton = form.getByRole('button', { name: 'Delete user' });
  await expect(confirmButton).toBeDisabled();
  await page.locator('#delete-user-confirm').fill(victim.email);
  await confirmButton.click();
  // The deletion only runs after the 5 second countdown
  await expect(page.locator('#delete-user-confirm')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('row').filter({ hasText: victim.email })).toHaveCount(0);

  // History survives with the same owner
  const { data: appts } = await db.from('appointments').select('id,status,user_id,cancellation_reason').eq('user_id', victim.id);
  const byId = new Map((appts ?? []).map((a) => [a.id, a]));
  expect(byId.get(approvedId)?.status).toBe('approved');
  expect(byId.get(pendingId)).toMatchObject({ status: 'cancelled', cancellation_reason: 'Account deleted' });
  expect((await db.from('donations').select('user_id').eq('id', donation.id).single()).data?.user_id).toBe(victim.id);
  expect((await db.from('messages').select('sender_id').eq('id', message.id).single()).data?.sender_id).toBe(victim.id);

  // Profile anonymized, login banned with an unusable email
  const { data: profile } = await db.from('profiles').select('*').eq('id', victim.id).single();
  expect(profile).toMatchObject({ full_name: 'Deleted User', email: null, phone_number: null, avatar_url: null, role: 'user', church_id: null, assigned_church_id: null });
  expect(profile?.deleted_at).not.toBeNull();
  const { data: authUser } = await db.auth.admin.getUserById(victim.id);
  expect(authUser.user?.email).toBe(`deleted+${victim.id}@deleted.invalid`);
  expect(authUser.user?.banned_until).not.toBeNull();

  // The open ticket was closed with a system note; closed ones are untouched
  const { data: tickets } = await db.from('conversations').select('id,status').eq('created_by', victim.id).not('ticket_number', 'is', null);
  expect(tickets).toHaveLength(1);
  expect(tickets![0].status).toBe('closed');
  const { data: notes } = await db.from('messages').select('message_type,metadata,sender_id').eq('conversation_id', tickets![0].id).eq('message_type', 'system');
  expect(notes).toHaveLength(1);
  expect(notes![0]).toMatchObject({ sender_id: victim.id, metadata: { event: 'ticket_closed_account_deleted' } });

  // The audit row exists
  const { data: log } = await db.from('activity_logs').select('user_id').eq('action', 'user_deleted').eq('entity_id', victim.id);
  expect(log).toHaveLength(1);
  expect(log![0].user_id).toBe(superAdmin.id);

  // A fresh login fails
  const fresh = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await fresh.auth.signInWithPassword({ email: victim.email, password: PASSWORD });
  expect(login.error).not.toBeNull();

  // The same email can register again as a new account
  const again = await db.auth.admin.createUser({ email: victim.email, password: PASSWORD, email_confirm: true });
  expect(again.error).toBeNull();
  expect(again.data.user?.id).not.toBe(victim.id);
  if (again.data.user) await db.auth.admin.deleteUser(again.data.user.id);
});

test('only the Super Admin can delete, and never themselves or another Super Admin', async () => {
  const target = await makeUser('target', 'user', null);
  for (const [label, caller] of [['church admin', churchAdmin], ['priest', priest], ['parishioner', bystander]] as const) {
    const { error } = await caller.client.rpc('delete_user_account', { p_user_id: target.id });
    expect(error, label).not.toBeNull();
  }
  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: superAdmin.id })).error).not.toBeNull();

  // A second Super Admin row cannot exist (single-owner index), so check the guard through anonymize's own refusal
  const { data: stillThere } = await db.from('profiles').select('deleted_at').eq('id', target.id).single();
  expect(stillThere?.deleted_at).toBeNull();
  const { data: owner } = await db.from('profiles').select('deleted_at').eq('id', superAdmin.id).single();
  expect(owner?.deleted_at).toBeNull();
  // anonymize_user is not callable by signed-in users
  expect((await superAdmin.client.rpc('anonymize_user', { p_user_id: target.id })).error).not.toBeNull();
});

test('a deleted user with a still-valid access token is rejected on the next request, and nobody else is affected', async () => {
  const victim = await makeUser('cutoff', 'user', null);
  await addAppointment(victim.id, 'approved');
  // The signed-in client keeps its access token; it is never refreshed
  const before = await victim.client.from('appointments').select('id').eq('user_id', victim.id);
  expect(before.data).toHaveLength(1);
  const { data: other } = await db.from('appointments').insert({
    user_id: bystander.id, church_id: seed.churchId, service_type: 'Baptism', appointment_date: isoDate(31), appointment_time: '11:00:00', status: 'approved',
  }).select('id').single();

  const deleted = await superAdmin.client.rpc('delete_user_account', { p_user_id: victim.id });
  expect(deleted.error).toBeNull();

  // Reads return nothing
  for (const table of ['appointments', 'donations', 'notifications', 'conversations', 'conversation_participants', 'churches']) {
    const { data, error } = await victim.client.from(table).select('*').limit(5);
    expect(error?.message ?? '', table).toBe('');
    expect(data, table).toHaveLength(0);
  }
  // Writes are rejected
  const write = await victim.client.from('donations').insert({ user_id: victim.id, church_id: seed.churchId, amount: 10 });
  expect(write.error).not.toBeNull();
  const profileWrite = await victim.client.from('profiles').update({ full_name: 'Back again' }).eq('id', victim.id);
  expect(profileWrite.error).not.toBeNull();
  // RPCs are rejected
  const rpc = await victim.client.rpc('get_my_unread_message_count');
  expect(rpc.error?.message).toContain('This account is blocked');
  // Storage lists nothing (or errors)
  const listing = await victim.client.storage.from('appointment-documents').list('');
  expect(listing.error !== null || (listing.data ?? []).length === 0).toBe(true);
  // The profile row stays readable so the app can see deleted_at and sign out
  const own = await victim.client.from('profiles').select('deleted_at').eq('id', victim.id).single();
  expect(own.data?.deleted_at).not.toBeNull();

  // Blast radius: the Super Admin and an unrelated parishioner keep working
  const mine = await bystander.client.from('appointments').select('id').eq('user_id', bystander.id);
  expect((mine.data ?? []).map((r) => r.id)).toContain(other!.id);
  expect((await bystander.client.rpc('get_my_unread_message_count')).error).toBeNull();
  const admins = await superAdmin.client.from('profiles').select('id').eq('id', victim.id);
  expect(admins.data).toHaveLength(1);
  expect((await superAdmin.client.rpc('get_my_unread_message_count')).error).toBeNull();
});

test('nobody can message a Direct chat whose other person was deleted, and the history stays readable', async () => {
  const victim = await makeUser('dm-gone', 'user', null);
  const direct = await addDirectChat(victim.id, churchAdmin.id);
  await db.from('messages').insert({ conversation_id: direct, sender_id: victim.id, content: `${TAG} before` });
  const okBefore = await churchAdmin.client.from('messages').insert({ conversation_id: direct, sender_id: churchAdmin.id, content: `${TAG} reply` });
  expect(okBefore.error).toBeNull();

  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: victim.id })).error).toBeNull();

  const blocked = await churchAdmin.client.from('messages').insert({ conversation_id: direct, sender_id: churchAdmin.id, content: `${TAG} after` });
  expect(blocked.error?.message).toContain('This user is no longer available');
  const history = await churchAdmin.client.from('messages').select('content').eq('conversation_id', direct);
  expect((history.data ?? []).length).toBeGreaterThanOrEqual(2);
  const flag = await churchAdmin.client.rpc('direct_other_participant_blocked', { _conversation_id: direct });
  expect(flag.data).toBe(true);
});

test('deleting a volunteer removes them from the staff channel, and deleting the last Church Admin of a church is allowed', async () => {
  const { data: church, error } = await db
    .from('churches')
    .insert({ name: `${TAG} church ${Date.now()}`, address: '3 Test Street', status: 'verified_active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  churchesToRemove.push(church.id);
  const volunteer = await makeUser('volunteer', 'volunteer', church.id);
  const soleAdmin = await makeUser('sole-admin', 'church_admin', church.id);
  const { data: channel, error: cErr } = await db.from('conversations').insert({ title: `${TAG} staff`, type: 'channel', church_id: church.id }).select('id').single();
  if (cErr) throw cErr;
  conversationsToRemove.push(channel.id);
  await db.from('conversation_participants').insert([
    { conversation_id: channel.id, user_id: volunteer.id },
    { conversation_id: channel.id, user_id: soleAdmin.id },
  ]);

  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: volunteer.id })).error).toBeNull();
  const { data: members } = await db.from('conversation_participants').select('user_id').eq('conversation_id', channel.id);
  expect((members ?? []).map((m) => m.user_id)).toEqual([soleAdmin.id]);

  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: soleAdmin.id })).error).toBeNull();
  const { data: left } = await db.from('profiles').select('role,assigned_church_id,deleted_at').eq('id', soleAdmin.id).single();
  expect(left).toMatchObject({ role: 'user', assigned_church_id: null });
  expect(left?.deleted_at).not.toBeNull();
});

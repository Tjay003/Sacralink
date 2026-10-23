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
 * Migration 068: the Super Admin suspends and reactivates a user. A suspended account is cut off at once, keeps all
 * of its data, and comes back with the same email, password, role and church. Every account here is a temporary user.
 */

const db = serviceClient();
const TAG = 'susp-user';
const SUSPENDED_MESSAGE = 'This account is suspended. Contact your parish office or the Super Admin.';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let churchAdmin: TempAccount;
let bystander: TempAccount;
const accounts: TempAccount[] = [];
const conversationsToRemove: string[] = [];

async function makeUser(label: string, role: string, churchId: string | null) {
  const account = await tempUser(TAG, label, role, churchId);
  accounts.push(account);
  return account;
}

async function addAppointment(userId: string) {
  const { data, error } = await db
    .from('appointments')
    .insert({
      user_id: userId,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: isoDate(30),
      appointment_time: '10:00:00',
      status: 'approved',
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

function freshClient() {
  return createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  churchAdmin = await makeUser('church-admin', 'church_admin', seed.churchId);
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
  await restoreSuperAdmin();
});

test('the Super Admin suspends and reactivates a user through the Users page: sign-in is refused with the suspended message and everything else is untouched', async ({ page, browser }) => {
  const victim = await makeUser('victim', 'volunteer', seed.churchId);
  const apptId = await addAppointment(victim.id);

  await loginAsAccount(page, superAdmin);
  await page.goto('/users');
  await page.getByPlaceholder('Search by name, email, or parish...').fill(victim.email);
  const row = page.getByRole('row').filter({ hasText: victim.email });
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Suspend user' }).click();

  const submit = page.locator('form').filter({ has: page.locator('#suspend-user-reason') }).getByRole('button', { name: 'Suspend user' });
  await expect(submit).toBeDisabled();
  await page.locator('#suspend-user-reason').fill('too short');
  await expect(submit).toBeDisabled();
  await page.locator('#suspend-user-reason').fill('Investigating a deletion request');
  await submit.click();
  await expect(page.locator('#suspend-user-reason')).toHaveCount(0);
  await expect(row.getByText('Suspended', { exact: true })).toBeVisible();

  // The login is banned and the old session cannot refresh
  const { data: authUser } = await db.auth.admin.getUserById(victim.id);
  expect(authUser.user?.banned_until).not.toBeNull();
  const refresh = await victim.client.auth.refreshSession();
  expect(refresh.error).not.toBeNull();

  // Nothing else changed
  const { data: profile } = await db.from('profiles').select('*').eq('id', victim.id).single();
  expect(profile).toMatchObject({ role: 'volunteer', assigned_church_id: seed.churchId, email: victim.email, suspended_by: superAdmin.id, suspension_reason: 'Investigating a deletion request' });
  expect(profile?.suspended_at).not.toBeNull();
  expect(profile?.deleted_at).toBeNull();
  expect((await db.from('appointments').select('id').eq('id', apptId)).data).toHaveLength(1);
  const { data: log } = await db.from('activity_logs').select('user_id').eq('action', 'user_suspended').eq('entity_id', victim.id);
  expect(log).toHaveLength(1);

  // The real login form explains why
  const context = await browser.newContext();
  const loginPage = await context.newPage();
  await loginPage.goto('/login');
  await loginPage.locator('#email').fill(victim.email);
  await loginPage.locator('#password').fill(PASSWORD);
  await loginPage.getByRole('button', { name: 'Login' }).click();
  await expect(loginPage.getByText(SUSPENDED_MESSAGE)).toBeVisible();
  await context.close();

  // Filter and Reactivate from the page
  await page.getByLabel('Filter by role').selectOption('suspended');
  await expect(page.getByRole('row').filter({ hasText: victim.email })).toHaveCount(1);
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Reactivate user' }).click();
  await expect(row.getByText('Suspended', { exact: true })).toHaveCount(0);

  const { data: back } = await db.from('profiles').select('role,assigned_church_id,suspended_at,suspended_by,suspension_reason').eq('id', victim.id).single();
  expect(back).toMatchObject({ role: 'volunteer', assigned_church_id: seed.churchId, suspended_at: null, suspended_by: null, suspension_reason: null });
  expect((await db.auth.admin.getUserById(victim.id)).data.user?.banned_until ?? null).toBeNull();
  const login = await freshClient().auth.signInWithPassword({ email: victim.email, password: PASSWORD });
  expect(login.error).toBeNull();
  const { data: relog } = await db.from('activity_logs').select('id').eq('action', 'user_reactivated').eq('entity_id', victim.id);
  expect(relog).toHaveLength(1);
});

test('only the Super Admin can suspend or reactivate; never themselves, the Super Admin, a deleted user, or without a reason; clients cannot write suspended_at', async () => {
  const target = await makeUser('target', 'user', null);
  const priest = await makeUser('priest', 'priest', seed.churchId);

  for (const [label, caller] of [['church admin', churchAdmin], ['priest', priest], ['parishioner', bystander]] as const) {
    expect((await caller.client.rpc('suspend_user', { p_user_id: target.id, p_reason: 'A perfectly good reason' })).error, label).not.toBeNull();
  }
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: superAdmin.id, p_reason: 'A perfectly good reason' })).error).not.toBeNull();
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: target.id, p_reason: 'short' })).error).not.toBeNull();
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: target.id, p_reason: '          ' })).error).not.toBeNull();
  expect((await db.from('profiles').select('suspended_at').eq('id', target.id).single()).data?.suspended_at).toBeNull();

  // Direct writes are refused, by a Church Admin of the same church and by the person themselves
  const own = await target.client.from('profiles').update({ suspended_at: null, suspension_reason: 'x' }).eq('id', target.id);
  expect(own.error).not.toBeNull();
  const byAdmin = await churchAdmin.client.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', priest.id);
  expect(byAdmin.error).not.toBeNull();
  const bySelf = await bystander.client.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', bystander.id);
  expect(bySelf.error).not.toBeNull();
  expect((await db.from('profiles').select('suspended_at').in('id', [priest.id, bystander.id])).data?.every((p) => p.suspended_at === null)).toBe(true);

  // A suspended user cannot be suspended twice, and only the Super Admin reactivates
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: target.id, p_reason: 'A perfectly good reason' })).error).toBeNull();
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: target.id, p_reason: 'A perfectly good reason' })).error).not.toBeNull();
  expect((await churchAdmin.client.rpc('reactivate_user', { p_user_id: target.id })).error).not.toBeNull();
  expect((await db.from('profiles').select('suspended_at').eq('id', target.id).single()).data?.suspended_at).not.toBeNull();
  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: target.id })).error).toBeNull();
  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: target.id })).error).not.toBeNull();

  // A deleted user can be neither suspended nor reactivated
  const gone = await makeUser('gone', 'user', null);
  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: gone.id })).error).toBeNull();
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: gone.id, p_reason: 'A perfectly good reason' })).error).not.toBeNull();
  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: gone.id })).error).not.toBeNull();
});

test('instant cut-off: a suspended user with a still-valid access token gets nothing on the next request, and reactivation restores access', async () => {
  const victim = await makeUser('cutoff', 'user', null);
  await addAppointment(victim.id);
  expect((await victim.client.from('appointments').select('id').eq('user_id', victim.id)).data).toHaveLength(1);

  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: victim.id, p_reason: 'Investigating a deletion request' })).error).toBeNull();

  for (const table of ['appointments', 'notifications', 'conversations', 'conversation_participants', 'churches']) {
    const { data, error } = await victim.client.from(table).select('*').limit(5);
    expect(error?.message ?? '', table).toBe('');
    expect(data, table).toHaveLength(0);
  }
  expect((await victim.client.rpc('get_my_unread_message_count')).error?.message).toContain('This account is blocked');
  expect((await victim.client.from('donations').insert({ user_id: victim.id, church_id: seed.churchId, amount: 10 })).error).not.toBeNull();
  const listing = await victim.client.storage.from('appointment-documents').list('');
  expect(listing.error !== null || (listing.data ?? []).length === 0).toBe(true);
  // The own profile row stays readable so the app can see the flag
  const own = await victim.client.from('profiles').select('suspended_at').eq('id', victim.id).single();
  expect(own.data?.suspended_at).not.toBeNull();
  // An unrelated parishioner is unaffected
  expect((await bystander.client.rpc('get_my_unread_message_count')).error).toBeNull();

  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: victim.id })).error).toBeNull();
  const fresh = freshClient();
  expect((await fresh.auth.signInWithPassword({ email: victim.email, password: PASSWORD })).error).toBeNull();
  expect((await fresh.from('appointments').select('id').eq('user_id', victim.id)).data).toHaveLength(1);
  expect((await fresh.rpc('get_my_unread_message_count')).error).toBeNull();
});

test('an open browser tab of a suspended user signs out and shows the suspended message', async ({ browser }) => {
  const victim = await makeUser('open-tab', 'user', null);
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsAccount(page, victim);

  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: victim.id, p_reason: 'Investigating a deletion request' })).error).toBeNull();
  // Realtime usually fires first; a focus event is the fallback the app also relies on
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForURL('**/login**', { timeout: 15000 });
  await expect(page.getByText(SUSPENDED_MESSAGE)).toBeVisible();
  await context.close();
});

test('nobody can post in a Direct chat whose other person is suspended, and reactivating lifts it', async () => {
  const victim = await makeUser('dm', 'user', null);
  const direct = await addDirectChat(victim.id, churchAdmin.id);
  expect((await churchAdmin.client.from('messages').insert({ conversation_id: direct, sender_id: churchAdmin.id, content: `${TAG} before` })).error).toBeNull();

  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: victim.id, p_reason: 'Investigating a deletion request' })).error).toBeNull();
  const blocked = await churchAdmin.client.from('messages').insert({ conversation_id: direct, sender_id: churchAdmin.id, content: `${TAG} during` });
  expect(blocked.error?.message).toContain('This user is no longer available');
  expect(((await churchAdmin.client.from('messages').select('content').eq('conversation_id', direct)).data ?? []).length).toBeGreaterThanOrEqual(1);

  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: victim.id })).error).toBeNull();
  expect((await churchAdmin.client.from('messages').insert({ conversation_id: direct, sender_id: churchAdmin.id, content: `${TAG} after` })).error).toBeNull();
});

test('a suspended priest leaves the celebrant pools and the clergy list, and returns on reactivation', async () => {
  const priest = await makeUser('pool-priest', 'priest', seed.churchId);
  const inClergy = async () => ((await db.rpc('get_parish_clergy', { p_church_id: seed.churchId })).data ?? []).some((r: { priest_id: string }) => r.priest_id === priest.id);
  const inPool = async () =>
    ((await db.rpc('evaluate_parish_celebrants', { p_church_id: seed.churchId, p_date: isoDate(40), p_time: '10:00:00' })).data ?? []).some(
      (r: { priest_id: string }) => r.priest_id === priest.id
    );
  expect(await inClergy()).toBe(true);
  expect(await inPool()).toBe(true);

  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: priest.id, p_reason: 'Investigating a deletion request' })).error).toBeNull();
  expect(await inClergy()).toBe(false);
  expect(await inPool()).toBe(false);
  // The web picker query (getChurchPriests) filters the same way
  const picker = await superAdmin.client.from('profiles').select('id').is('deleted_at', null).is('suspended_at', null).eq('role', 'priest').eq('assigned_church_id', seed.churchId);
  expect((picker.data ?? []).map((p) => p.id)).not.toContain(priest.id);
  // Their role and church are untouched
  expect((await db.from('profiles').select('role,assigned_church_id').eq('id', priest.id).single()).data).toMatchObject({ role: 'priest', assigned_church_id: seed.churchId });

  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: priest.id })).error).toBeNull();
  expect(await inClergy()).toBe(true);
  expect(await inPool()).toBe(true);
});

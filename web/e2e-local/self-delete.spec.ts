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
 * Migration 074: everyone except the Super Admin can delete their own account, with safeguards.
 * Every account is a temporary user created here; the seeded users other specs share are never touched.
 */

const db = serviceClient();
const TAG = 'self-del';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
const accounts: TempAccount[] = [];
const churchesToRemove: string[] = [];
const appointmentsToRemove: string[] = [];

async function makeUser(label: string, role: string, churchId: string | null) {
  const account = await tempUser(TAG, label, role, churchId);
  accounts.push(account);
  return account;
}

async function makeChurch(label: string) {
  const { data, error } = await db
    .from('churches')
    .insert({ name: `${TAG} ${label} ${Date.now()}`, address: '4 Test Street', status: 'verified_active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  churchesToRemove.push(data.id);
  return data.id as string;
}

async function addAppointment(userId: string, priestId: string | null, status: string, days: number) {
  const { data, error } = await db
    .from('appointments')
    .insert({
      user_id: userId,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: isoDate(days),
      appointment_time: '10:00:00',
      status,
      priest_id: priestId,
    })
    .select('id')
    .single();
  if (error) throw error;
  appointmentsToRemove.push(data.id);
  return data.id as string;
}

async function profileOf(id: string) {
  const { data } = await db.from('profiles').select('role,deleted_at,full_name,assigned_church_id').eq('id', id).single();
  return data;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
});

test.afterAll(async () => {
  if (appointmentsToRemove.length) await db.from('appointments').delete().in('id', appointmentsToRemove);
  const ids = accounts.map((a) => a.id);
  await db.from('activity_logs').delete().in('entity_id', ids);
  await db.from('activity_logs').delete().in('user_id', ids);
  await db.from('notifications').delete().in('user_id', ids);
  await db.from('conversations').delete().like('title', `%${TAG}%`);
  await deleteTempAccounts(accounts);
  if (churchesToRemove.length) await db.from('churches').delete().in('id', churchesToRemove);
  await restoreSuperAdmin();
});

test('a parishioner deletes their own account from the profile page: signed out at once, history kept, ticket closed, old token dead, login fails', async ({ page }) => {
  const person = await makeUser('parishioner', 'user', null);
  const apptId = await addAppointment(person.id, null, 'approved', 30);
  const ticket = await person.client.rpc('create_ticket', {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} open ticket`,
    p_message: 'A long enough message for the ticket.',
  });
  expect(ticket.error).toBeNull();

  // The access token held before deleting works now
  const before = await person.client.from('appointments').select('id').eq('user_id', person.id);
  expect(before.data).toHaveLength(1);

  await loginAsAccount(page, person);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirmButton = page.locator('form').filter({ has: page.locator('#delete-my-account-confirm') }).getByRole('button', { name: 'Delete my account' });
  await expect(confirmButton).toBeDisabled();
  await page.locator('#delete-my-account-confirm').fill(person.email);
  await confirmButton.click();
  await page.waitForURL('**/login**');

  // Anonymized, history intact
  expect(await profileOf(person.id)).toMatchObject({ full_name: 'Deleted User', role: 'user' });
  expect((await profileOf(person.id))?.deleted_at).not.toBeNull();
  const { data: appt } = await db.from('appointments').select('user_id,status').eq('id', apptId).single();
  expect(appt).toMatchObject({ user_id: person.id, status: 'approved' });

  // The open ticket ended closed
  const { data: tickets } = await db.from('conversations').select('status').eq('created_by', person.id).not('ticket_number', 'is', null);
  expect(tickets).toHaveLength(1);
  expect(tickets![0].status).toBe('closed');

  // The token they held before deleting returns no rows now
  const after = await person.client.from('appointments').select('id').eq('user_id', person.id);
  expect(after.data ?? []).toHaveLength(0);

  // A fresh login fails
  const fresh = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await fresh.auth.signInWithPassword({ email: person.email, password: PASSWORD })).error).not.toBeNull();
});

test('the last Church Admin of a church is blocked in the UI and the database, and nothing changes', async ({ page }) => {
  const churchId = await makeChurch('sole');
  const sole = await makeUser('sole-admin', 'church_admin', churchId);

  const check = await sole.client.rpc('can_delete_own_account');
  expect(check.data).toMatchObject({ can_delete: false, code: 'last_church_admin' });
  const del = await sole.client.rpc('delete_own_account');
  expect(del.error?.message).toContain('Name a successor Church Admin before deleting your account');
  expect(del.error?.code).toBe('23514');

  await loginAsAccount(page, sole);
  await page.goto('/profile');
  await expect(page.getByText('Name a successor Church Admin before deleting your account')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeDisabled();

  const p = await profileOf(sole.id);
  expect(p).toMatchObject({ role: 'church_admin', deleted_at: null, assigned_church_id: churchId });
});

test('a Church Admin with a second Church Admin in the church can delete themselves', async () => {
  const churchId = await makeChurch('pair');
  const first = await makeUser('pair-first', 'church_admin', churchId);
  await makeUser('pair-second', 'church_admin', churchId);

  expect((await first.client.rpc('can_delete_own_account')).data).toMatchObject({ can_delete: true });
  const del = await first.client.rpc('delete_own_account');
  expect(del.error).toBeNull();
  expect((await profileOf(first.id))?.deleted_at).not.toBeNull();
  const { data: auth } = await db.auth.admin.getUserById(first.id);
  expect(auth.user?.banned_until).not.toBeNull();
});

test('a Priest with an upcoming approved appointment is blocked; pending requests naming him and past appointments do not block', async () => {
  const priest = await makeUser('priest-busy', 'priest', seed.churchId);
  const parishioner = await makeUser('priest-booker', 'user', null);
  const upcoming = await addAppointment(parishioner.id, priest.id, 'approved', 20);

  const del = await priest.client.rpc('delete_own_account');
  expect(del.error?.message).toContain('You have 1 upcoming appointment. Ask the parish office to reassign them first');
  expect(del.error?.code).toBe('55000');
  expect((await profileOf(priest.id))?.deleted_at).toBeNull();

  // Once the appointment is cancelled, a past approved one and a pending request that only names him do not block
  await db.from('appointments').update({ status: 'cancelled' }).eq('id', upcoming);
  await addAppointment(parishioner.id, priest.id, 'approved', -5);
  const { data: pending, error } = await db
    .from('appointments')
    .insert({
      user_id: parishioner.id,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: isoDate(25),
      appointment_time: '09:00:00',
      status: 'pending',
      requested_priest_id: priest.id,
    })
    .select('id')
    .single();
  if (error) throw error;
  appointmentsToRemove.push(pending.id);

  expect((await priest.client.rpc('delete_own_account')).error).toBeNull();
  expect((await profileOf(priest.id))?.deleted_at).not.toBeNull();
});

test('the Super Admin is blocked in the database, nothing changes, and never sees the delete section', async ({ page }) => {
  const check = await superAdmin.client.rpc('can_delete_own_account');
  expect(check.data).toMatchObject({ can_delete: false, code: 'super_admin' });
  const del = await superAdmin.client.rpc('delete_own_account');
  expect(del.error?.message).toContain('The Super Admin account cannot be deleted');
  expect(del.error?.code).toBe('42501');
  expect(await profileOf(superAdmin.id)).toMatchObject({ role: 'super_admin', deleted_at: null });

  await loginAsAccount(page, superAdmin);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change Password' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Delete my account' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete my account' })).toHaveCount(0);
});

test('a volunteer can delete themselves and a signed-out caller cannot call the function', async () => {
  const volunteer = await makeUser('volunteer', 'volunteer', seed.churchId);
  const anon = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await anon.rpc('delete_own_account')).error).not.toBeNull();

  expect((await volunteer.client.rpc('delete_own_account')).error).toBeNull();
  expect(await profileOf(volunteer.id)).toMatchObject({ full_name: 'Deleted User', role: 'user', assigned_church_id: null });
  // A second call from the dead session is refused
  expect((await volunteer.client.rpc('delete_own_account')).error).not.toBeNull();
});

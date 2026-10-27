import { test, expect } from '@playwright/test';
import {
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
 * Ticket 08: a deleted account reads "Deleted User" with a danger marker everywhere a name is shown,
 * and a Direct chat with a deleted person is read-only. Every account is a temporary user created here.
 */

const db = serviceClient();
const TAG = 'del-display';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let churchAdmin: TempAccount;
let victim: TempAccount;
let directId: string;
const accounts: TempAccount[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  churchAdmin = await tempUser(TAG, 'church-admin', 'church_admin', seed.churchId);
  victim = await tempUser(TAG, 'victim', 'user', null);
  accounts.push(churchAdmin, victim);

  const { error: aErr } = await db.from('appointments').insert({
    user_id: victim.id,
    church_id: seed.churchId,
    service_type: 'Baptism',
    appointment_date: isoDate(30),
    appointment_time: '10:00:00',
    status: 'approved',
  });
  if (aErr) throw aErr;
  const { error: dErr } = await db.from('donations').insert({ user_id: victim.id, church_id: seed.churchId, amount: 321 });
  if (dErr) throw dErr;

  const { data: conv, error: cErr } = await db.from('conversations').insert({ title: `${TAG} direct`, type: 'direct', created_by: victim.id }).select('id').single();
  if (cErr) throw cErr;
  directId = conv.id;
  const { error: pErr } = await db.from('conversation_participants').insert([
    { conversation_id: directId, user_id: victim.id },
    { conversation_id: directId, user_id: churchAdmin.id },
  ]);
  if (pErr) throw pErr;
  const { error: mErr } = await db.from('messages').insert({ conversation_id: directId, sender_id: victim.id, content: `${TAG} hello from the past` });
  if (mErr) throw mErr;

  const deleted = await superAdmin.client.rpc('delete_user_account', { p_user_id: victim.id });
  if (deleted.error) throw deleted.error;
  await db.from('profiles').update({ archived_at: new Date(Date.now() - 8 * 86400 * 1000).toISOString() }).eq('id', victim.id);
  await superAdmin.client.rpc('purge_expired_archived_users');
});

test.afterAll(async () => {
  await db.from('conversations').delete().like('title', `%${TAG}%`);
  const ids = accounts.map((a) => a.id);
  await db.from('activity_logs').delete().in('entity_id', ids);
  await db.from('activity_logs').delete().in('user_id', ids);
  await db.from('notifications').delete().in('user_id', ids);
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test('the appointments list shows Deleted User with the marker, and no stale name or email', async ({ page }) => {
  await loginAsAccount(page, churchAdmin);
  await page.goto('/appointments');
  const row = page.locator('table').locator('tr', { hasText: 'Deleted User' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByRole('img', { name: 'Deleted user' }).first()).toBeVisible();
  await expect(row).not.toContainText(victim.email);
  await expect(row).not.toContainText('Unnamed User');
});

test('the donations list shows the donor as Deleted User with the marker', async ({ page }) => {
  await loginAsAccount(page, churchAdmin);
  await page.goto('/donations');
  const row = page.locator('tr', { hasText: 'Deleted User' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByRole('img', { name: 'Deleted user' })).toBeVisible();
});

test('the other chat member sees the old message under Deleted User and cannot reply', async ({ page }) => {
  await loginAsAccount(page, churchAdmin);
  await page.goto(`/messages?conv=${directId}`);
  await expect(page.locator('p.whitespace-pre-wrap', { hasText: `${TAG} hello from the past` })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Deleted user' }).first()).toBeVisible();
  await expect(page.getByTestId('composer-unavailable')).toHaveText('This user is no longer available');
  await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0);
});

test('the marker shows its "Deleted user" tooltip on keyboard focus', async ({ page }) => {
  await loginAsAccount(page, churchAdmin);
  await page.goto('/donations');
  const row = page.locator('tr', { hasText: 'Deleted User' }).first();
  const marker = row.getByRole('img', { name: 'Deleted user' });
  await marker.focus();
  await expect(row.getByRole('tooltip')).toBeVisible();
  await expect(row.getByRole('tooltip')).toHaveText('Deleted user');
});

import { test, expect, type Page } from '@playwright/test';
import {
  deleteTempAccounts,
  getSeed,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type TempAccount,
} from './support';

/**
 * Ticket 06: the Users page and Edit User Access modal drive the set_user_role database function.
 * Every account is a throwaway created here; final state is asserted with the service client.
 */

const db = serviceClient();
const TAG = 'roleui';
const accounts: TempAccount[] = [];
const channels: string[] = [];
const churches: string[] = [];
let restoreSuperAdmin: (() => Promise<void>) | null = null;

async function account(label: string, role: string, churchId: string | null) {
  const a = await tempUser(TAG, label, role, churchId);
  accounts.push(a);
  return a;
}

async function profile(id: string) {
  const { data, error } = await db.from('profiles').select('role,assigned_church_id,is_priest').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function openUsers(page: Page, who: TempAccount, tab?: string) {
  await loginAsAccount(page, who);
  await page.goto('/users');
  if (tab) await page.getByRole('button', { name: new RegExp(`^${tab}`) }).click();
}

async function findRow(page: Page, email: string) {
  await page.getByPlaceholder(/Search by name/).fill(email);
  const row = page.locator('tr', { hasText: email });
  await expect(row).toBeVisible();
  return row;
}

test.afterEach(async () => {
  if (channels.length) await db.from('conversations').delete().in('id', channels.splice(0));
  if (restoreSuperAdmin) {
    await restoreSuperAdmin();
    restoreSuperAdmin = null;
  }
  const ids = accounts.map((a) => a.id);
  if (ids.length) {
    await db.from('activity_logs').delete().in('user_id', ids);
    await db.from('activity_logs').delete().in('entity_id', ids);
  }
  await deleteTempAccounts(accounts.splice(0));
  if (churches.length) await db.from('churches').delete().in('id', churches.splice(0));
});

test('a Church Admin sees exactly four roles and no church picker, and promotes a Parishioner to Volunteer', async ({ page }) => {
  const seed = await getSeed();
  const admin = await account('admin', 'church_admin', seed.churchId);
  const joiner = await account('joiner', 'user', null);
  const elsewhere = await account('elsewhere', 'user', seed.otherChurchId);

  await openUsers(page, admin, 'Parishioners');
  // A Parishioner who already belongs to another church is not offered to this Church Admin
  await page.getByPlaceholder(/Search by name/).fill(elsewhere.email);
  await expect(page.locator('tr', { hasText: elsewhere.email })).toHaveCount(0);

  const row = await findRow(page, joiner.email);
  await row.getByRole('button', { name: 'Edit Role' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal.locator('select')).toHaveCount(1);
  const values = await modal.locator('select option').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
  expect(values).toEqual(['user', 'volunteer', 'priest', 'church_admin']);

  await modal.locator('select').selectOption('volunteer');
  await modal.getByRole('button', { name: 'Save Changes' }).click();
  await expect(modal).toBeHidden();

  expect(await profile(joiner.id)).toMatchObject({ role: 'volunteer', assigned_church_id: seed.churchId });
});

test('a Church Admin demotes a second Church Admin: confirmation wording, same church, out of the staff channel', async ({ page }) => {
  const seed = await getSeed();
  const admin = await account('admin', 'church_admin', seed.churchId);
  const second = await account('second', 'church_admin', seed.churchId);
  const { data: channel, error } = await db.from('conversations').insert({ title: `${TAG} staff`, type: 'channel', church_id: seed.churchId }).select('id').single();
  if (error) throw error;
  channels.push(channel.id);
  await db.from('conversation_participants').insert([{ conversation_id: channel.id, user_id: admin.id }, { conversation_id: channel.id, user_id: second.id }]);

  await openUsers(page, admin);
  const row = await findRow(page, second.email);
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Demote to Parishioner' }).click();

  const confirmation = page.getByTestId('demote-confirmation');
  await expect(confirmation).toContainText('will become a Parishioner and stay in');
  await expect(confirmation).toContainText('leave the church staff channel');
  await expect(confirmation).toContainText('Their own open tickets to the Super Admin stay open.');
  await page.getByRole('dialog').getByRole('button', { name: 'Demote to Parishioner' }).click();
  await expect(page.getByTestId('demote-confirmation')).toBeHidden();

  expect(await profile(second.id)).toMatchObject({ role: 'user', assigned_church_id: seed.churchId, is_priest: false });
  const { data: left } = await db.from('conversation_participants').select('id').eq('conversation_id', channel.id).eq('user_id', second.id);
  expect(left).toHaveLength(0);
  const { data: kept } = await db.from('conversation_participants').select('id').eq('conversation_id', channel.id).eq('user_id', admin.id);
  expect(kept).toHaveLength(1);
});

test('your own row offers no role editing or demotion', async ({ page }) => {
  const seed = await getSeed();
  const admin = await account('admin', 'church_admin', seed.churchId);
  await openUsers(page, admin);
  const row = await findRow(page, admin.email);
  await expect(row.getByRole('button', { name: 'Your account' })).toBeDisabled();
  await expect(row.getByRole('button', { name: /Edit Role|Demote/ })).toHaveCount(0);
});

test('the last Church Admin error reads as plain text when a Super Admin demotes them', async ({ page }) => {
  const { data: church, error } = await db.from('churches').insert({ name: `${TAG} church ${Date.now()}`, address: '1 Test Street', status: 'verified_active', is_active: true }).select('id').single();
  if (error) throw error;
  churches.push(church.id);
  const sole = await account('sole', 'church_admin', church.id);
  const owner = await soleSuperAdmin(TAG);
  restoreSuperAdmin = owner.restore;

  await openUsers(page, owner.account);
  const row = await findRow(page, sole.email);
  await row.getByRole('button', { name: /More actions/ }).click();
  await page.getByRole('menuitem', { name: 'Demote to Parishioner' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Demote to Parishioner' }).click();

  await expect(page.getByRole('alert')).toContainText('at least one Church Admin');
  expect(await profile(sole.id)).toMatchObject({ role: 'church_admin' });
});

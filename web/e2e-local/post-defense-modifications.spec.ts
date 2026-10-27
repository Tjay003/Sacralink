import { test, expect, type Page } from '@playwright/test';
import {
  deleteTempAccounts,
  getSeed,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

const db = serviceClient();
const TAG = 'postdef';

let seed: Seed;
let superAdmin: TempAccount;
let churchAdmin: TempAccount;
let parishioner: TempAccount;
let restoreSuperAdmin: () => Promise<void>;
const accounts: TempAccount[] = [];
const churchesToRemove: string[] = [];
const channelsToRemove: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;

  churchAdmin = await tempUser(TAG, 'cadmin', 'church_admin', seed.churchId);
  parishioner = await tempUser(TAG, 'parishioner', 'user', null);
  accounts.push(churchAdmin, parishioner);
});

test.afterAll(async () => {
  if (channelsToRemove.length) {
    await db.from('conversations').delete().in('id', channelsToRemove);
  }
  if (churchesToRemove.length) {
    await db.from('churches').delete().in('id', churchesToRemove);
  }
  await deleteTempAccounts(accounts);
  if (restoreSuperAdmin) await restoreSuperAdmin();
});

async function loginClean(page: Page, account: TempAccount) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginAsAccount(page, account);
}

test('Ticket 01: Super Admin Dashboard does not render Daily Verse', async ({ page }) => {
  await loginClean(page, superAdmin);
  await page.goto('/dashboard');
  await expect(page.getByText('DAILY VERSE')).toHaveCount(0);
  await expect(page.getByText('Needs Your Attention')).toBeVisible();
});

test('Ticket 01: Church Admin Dashboard does not render Daily Verse', async ({ page }) => {
  await loginClean(page, churchAdmin);
  await page.goto('/dashboard');
  await expect(page.getByText('DAILY VERSE')).toHaveCount(0);
  await expect(page.getByText('Parish Attention')).toBeVisible();
});

test('Ticket 01: Parishioner Dashboard renders Daily Verse', async ({ page }) => {
  await loginClean(page, parishioner);
  await page.goto('/dashboard');
  await expect(page.getByText('DAILY VERSE')).toBeVisible();
});

test('Ticket 01: EditRoleModal does not expose Platform Ownership Transfer', async ({ page }) => {
  await loginClean(page, superAdmin);
  await page.goto('/users');
  await page.getByPlaceholder(/Search by name/).fill(churchAdmin.email);
  const row = page.locator('tr', { hasText: churchAdmin.email });
  await row.getByRole('button', { name: /Edit access|Edit role/i }).click();

  // Platform Ownership Transfer section must be absent
  await expect(page.getByText('Platform Ownership Transfer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Transfer Ownership/i })).toHaveCount(0);
});

test('Ticket 02: Donations chart defaults to 12 months with responsive period filters', async ({ page }) => {
  await loginClean(page, churchAdmin);
  await page.goto('/donations');

  // Heading defaults to 12 months
  await expect(page.getByRole('heading', { name: 'Giving, last 12 months' })).toBeVisible();

  // Switch to Weekly
  const toggleWeekly = page.getByRole('button', { name: 'Weekly', exact: true });
  await expect(toggleWeekly).toBeVisible();
  await toggleWeekly.click();

  // Heading updates to 8 weeks
  await expect(page.getByRole('heading', { name: 'Giving, last 8 weeks' })).toBeVisible();

  // Switch back to Monthly
  const toggleMonthly = page.getByRole('button', { name: 'Monthly', exact: true });
  await toggleMonthly.click();
  await expect(page.getByRole('heading', { name: 'Giving, last 12 months' })).toBeVisible();
});

test('Ticket 04: ensure_church_staff_channel provisions staff channel for a new church', async () => {
  const { data: church, error } = await db
    .from('churches')
    .insert({
      name: `${TAG} Auto Parish ${Date.now()}`,
      address: 'San Jose del Monte, Bulacan',
      status: 'verified_active',
      is_active: true,
    })
    .select('id, name')
    .single();

  expect(error).toBeNull();
  churchesToRemove.push(church!.id);

  // Trigger auto-provisioning RPC
  const { data: channelId, error: rpcError } = await superAdmin.client.rpc('ensure_church_staff_channel', {
    p_church_id: church!.id,
  });

  expect(rpcError).toBeNull();
  expect(channelId).toBeTruthy();
  channelsToRemove.push(channelId as string);

  // Assert the conversation exists in the DB
  const { data: conv } = await db.from('conversations').select('*').eq('id', channelId).single();
  expect(conv).toMatchObject({
    type: 'channel',
    church_id: church!.id,
  });
  expect(conv?.title).toContain(church!.name);
});

test('Ticket 05: Churches page and Users page render Active and Archived tabs for Super Admin', async ({ page }) => {
  await loginClean(page, superAdmin);

  // 1. Churches Page has Active and Archived tabs
  await page.goto('/churches');
  await expect(page.getByRole('button', { name: /Active/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Archived/i })).toBeVisible();

  // 2. Users Page has Active and Archived tabs
  await page.goto('/users');
  await expect(page.getByRole('button', { name: /Active/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Archived/i })).toBeVisible();
});

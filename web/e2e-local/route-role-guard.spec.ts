import { test, expect } from '@playwright/test';
import {
  deleteTempAccounts,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type TempAccount,
} from './support';

const db = serviceClient();
const TAG = 'routeguard';
const accounts: TempAccount[] = [];

async function makeAccount(label: string, role: string, churchId: string | null = null) {
  const a = await tempUser(TAG, label, role, churchId);
  accounts.push(a);
  return a;
}

test.afterAll(async () => {
  const ids = accounts.map((a) => a.id);
  if (ids.length) {
    await db.from('activity_logs').delete().in('user_id', ids);
    await db.from('activity_logs').delete().in('entity_id', ids);
  }
  await deleteTempAccounts(accounts);
});

test.describe('Route Role Gate Guards', () => {
  test('Parishioner visiting /users sees Access Denied', async ({ page }) => {
    const parishioner = await makeAccount('parishioner', 'user');
    await loginAsAccount(page, parishioner);
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible();
  });

  test('Volunteer visiting /users sees Access Denied', async ({ page }) => {
    const volunteer = await makeAccount('volunteer', 'volunteer');
    await loginAsAccount(page, volunteer);
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
  });

  test('Priest visiting /users sees Access Denied', async ({ page }) => {
    const priest = await makeAccount('priest', 'priest');
    await loginAsAccount(page, priest);
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
  });

  test('Church Admin visiting /admin/applications sees Access Denied', async ({ page }) => {
    const churchAdmin = await makeAccount('churchadmin', 'church_admin');
    await loginAsAccount(page, churchAdmin);
    await page.goto('/admin/applications');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
  });

  test('Parishioner visiting /admin/applications sees Access Denied', async ({ page }) => {
    const parishioner = accounts.find((a) => a.email.includes('parishioner')) || (await makeAccount('parishioner2', 'user'));
    await loginAsAccount(page, parishioner);
    await page.goto('/admin/applications');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
  });

  test('Super Admin can access /admin/applications and /users', async ({ page }) => {
    const { account: superAdmin, restore } = await soleSuperAdmin(TAG);
    try {
      await loginAsAccount(page, superAdmin);

      // Super admin visits /admin/applications
      await page.goto('/admin/applications');
      await expect(page.getByRole('heading', { name: 'Access Denied' })).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Church Applications' })).toBeVisible();

      // Super admin visits /users
      await page.goto('/users');
      await expect(page.getByRole('heading', { name: 'Access Denied' })).not.toBeVisible();
      await expect(page.getByPlaceholder(/Search by name/)).toBeVisible();
    } finally {
      await restore();
    }
  });
});

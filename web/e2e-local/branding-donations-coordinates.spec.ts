import { test, expect, type Page } from '@playwright/test';
import { PASSWORD, getSeed, loginAs, serviceClient, type Role } from './support';

/**
 * Real end-to-end: sidebar brand subtitle, Parishes page header, numeric-only donation amount input,
 * and the GPS coordinates badge on the parish page (staff only, hidden from parishioners and volunteers).
 */

const db = serviceClient();
const VOLUNTEER_EMAIL = 'volunteer@local.test';
const COORDINATES_BADGE = '📍 14.8136, 121.0450';

/** Creates (idempotently) a volunteer assigned to the seeded parish, since global-setup has none. */
async function ensureVolunteer(churchId: string) {
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  let id = list.users.find((u) => u.email === VOLUNTEER_EMAIL)?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: VOLUNTEER_EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Local Volunteer' },
    });
    if (error) throw error;
    id = data.user.id;
  }
  const { error } = await db.from('profiles').upsert({
    id,
    email: VOLUNTEER_EMAIL,
    full_name: 'Local Volunteer',
    role: 'volunteer',
    church_id: churchId,
    assigned_church_id: churchId,
    is_verified: true,
  });
  if (error) throw error;
}

async function loginAsVolunteer(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(VOLUNTEER_EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

test.beforeAll(async () => {
  const seed = await getSeed();
  await ensureVolunteer(seed.churchId);
  const { error } = await db
    .from('churches')
    .update({ latitude: 14.8136, longitude: 121.045, accept_cashless: true, status: 'verified_active', gcash_number: '09171234567' })
    .eq('id', seed.churchId);
  if (error) throw error;
});

test.describe('Branding and parish page polish', () => {
  test('sidebar subtitle reads Parishes of San Jose del Monte and /churches has no Diocese subtitle', async ({ page }) => {
    await loginAs(page, 'parishioner');
    await expect(page.getByText('Parishes of San Jose del Monte').first()).toBeAttached();
    await expect(page.getByText('Diocese of San Jose del Monte')).toHaveCount(0);

    await page.goto('/churches');
    await expect(page.getByRole('heading', { name: 'Parishes', exact: true })).toBeVisible();
    await expect(page.getByText(/Manage the .* parishes of the Diocese/)).toHaveCount(0);
  });

  test('donation amount rejects letters, e, +, - and strips them from pasted text', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);
    await page.getByRole('button', { name: 'Donate', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Donate to Local Test Parish/ })).toBeVisible();

    const amount = page.getByPlaceholder('100');
    await amount.fill('');
    await amount.pressSequentially('1a2eE+-3');
    await expect(amount).toHaveValue('123');

    await amount.fill('');
    await amount.pressSequentially('45.6.7');
    await expect(amount).toHaveValue('45.67');

    // Pasting goes through onChange rather than onKeyDown, so it must be sanitised too
    await amount.fill('');
    await amount.evaluate((el: HTMLInputElement) => {
      el.focus();
      document.execCommand('insertText', false, 'abc1,2e+3-.5.5');
    });
    await expect(amount).toHaveValue('123.55');
  });
});

test.describe('Raw coordinates badge on the parish page', () => {
  const visibleFor: Array<{ who: string; login: (page: Page) => Promise<void>; shown: boolean }> = [
    { who: 'parishioner', login: (p) => loginAs(p, 'parishioner'), shown: false },
    { who: 'volunteer', login: loginAsVolunteer, shown: false },
    { who: 'church_admin', login: (p) => loginAs(p, 'church_admin' as Role), shown: true },
    { who: 'priest', login: (p) => loginAs(p, 'priest' as Role), shown: true },
  ];

  for (const { who, login, shown } of visibleFor) {
    test(`${who} ${shown ? 'sees' : 'does not see'} the coordinates; map and OpenStreetMap link stay`, async ({ page }) => {
      const seed = await getSeed();
      await login(page);
      await page.goto(`/churches/${seed.churchId}`);

      await expect(page.getByText('Open in OpenStreetMap')).toBeVisible();
      await expect(page.locator('iframe[title="Parish OpenStreetMap"]')).toBeAttached();
      await expect(page.getByText(COORDINATES_BADGE)).toHaveCount(shown ? 1 : 0);
    });
  }
});

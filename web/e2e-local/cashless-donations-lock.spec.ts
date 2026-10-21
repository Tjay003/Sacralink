import { test, expect } from '@playwright/test';
import { getSeed, loginAs, serviceClient } from './support';

/**
 * Real end-to-end: the church admin's "accept cashless" switch is stored on the church, and when it is
 * off the parishioner's Donate button on the church page is locked (paused), and unlocks again when on.
 */

const db = serviceClient();

async function setCashless(churchId: string, accept: boolean) {
  const { error } = await db
    .from('churches')
    .update({ accept_cashless: accept, status: 'verified_active', gcash_number: '09171234567' })
    .eq('id', churchId);
  if (error) throw error;
}

test.afterEach(async () => {
  const seed = await getSeed();
  await setCashless(seed.churchId, true);
});

test.describe('Cashless donation toggle locks the donor-facing Donate button', () => {
  test('on: Donate is enabled and opens the donate modal', async ({ page }) => {
    const seed = await getSeed();
    await setCashless(seed.churchId, true);
    await loginAs(page, 'parishioner');

    await page.goto(`/churches/${seed.churchId}`);
    const donate = page.getByRole('button', { name: 'Donate', exact: true });
    await expect(donate).toBeEnabled();

    await donate.click();
    await expect(page.getByRole('heading', { name: /Donate to Local Test Parish/ })).toBeVisible();
    await expect(page.getByText('Cashless Donations Paused')).toHaveCount(0);
  });

  test('off: Donate is disabled and reads Donations paused; turning it on again unlocks it', async ({ page }) => {
    const seed = await getSeed();
    await setCashless(seed.churchId, false);
    await loginAs(page, 'parishioner');

    await page.goto(`/churches/${seed.churchId}`);
    const paused = page.getByRole('button', { name: 'Donations paused' });
    await expect(paused).toBeVisible();
    await expect(paused).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Donate', exact: true })).toHaveCount(0);

    await paused.click({ force: true });
    await expect(page.getByRole('heading', { name: /Donate to Local Test Parish/ })).toHaveCount(0);

    await setCashless(seed.churchId, true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Donate', exact: true })).toBeEnabled();
  });

  test('the database stores the switch per church and does not touch other parishes', async () => {
    const seed = await getSeed();
    await setCashless(seed.churchId, false);

    const { data, error } = await db.from('churches').select('id,accept_cashless').in('id', [seed.churchId, seed.otherChurchId]);
    if (error) throw error;
    expect(data!.find((c) => c.id === seed.churchId)!.accept_cashless).toBe(false);
    expect(data!.find((c) => c.id === seed.otherChurchId)!.accept_cashless).not.toBe(false);
  });
});

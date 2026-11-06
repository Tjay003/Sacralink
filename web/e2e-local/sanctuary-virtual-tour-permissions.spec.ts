import { test, expect } from '@playwright/test';
import { getSeed, loginAs } from './support';

test.describe('Sanctuary Virtual Tour permissions', () => {
  test('parishioner cannot see Replace panorama button', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);
    await page.getByRole('button', { name: 'Media' }).click();
    await expect(page.getByText('360° virtual tour')).toBeVisible();
    await expect(page.getByRole('button', { name: /Replace panorama/i })).toHaveCount(0);
  });

  test('church admin can see Replace panorama button', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    await page.goto(`/churches/${seed.churchId}`);
    await page.getByRole('button', { name: 'Media' }).click();
    await expect(page.getByText('360° virtual tour')).toBeVisible();
    await expect(page.getByRole('button', { name: /Replace panorama/i })).toBeVisible();
  });
});

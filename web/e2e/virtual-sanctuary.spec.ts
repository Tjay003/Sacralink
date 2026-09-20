import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Live Mass & Virtual Sanctuary - Option 1 Modal Presentation', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'super_admin');
    await page.goto('/churches/church-1');
  });

  test('should render the Virtual Sanctuary section and full-width LivestreamPlayer without theater mode buttons', async ({ page }) => {
    // Check section heading
    await expect(page.getByRole('heading', { name: 'Live Mass & Virtual Sanctuary' })).toBeVisible();

    // Verify player is rendered
    await expect(page.getByText('Sacralink Virtual Sanctuary').first()).toBeVisible();

    // Verify Theater button is removed
    await expect(page.getByRole('button', { name: /Theater/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Exit Theater/i })).toHaveCount(0);

    // Verify Hide / Show Sidebar button is removed
    await expect(page.getByRole('button', { name: /Hide Sidebar/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Show Sidebar/i })).toHaveCount(0);

    // Verify the 3 companion buttons are visible
    await expect(page.getByRole('button', { name: /Daily Gospel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Intentions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Offertory/i })).toBeVisible();
  });

  test('should open clean Modal on clicking Daily Gospel and allow closing via close button', async ({ page }) => {
    // Initially modal dialog is not present
    await expect(page.getByRole('dialog', { name: 'Modal' })).toHaveCount(0);

    // Click Daily Gospel button
    await page.getByRole('button', { name: /Daily Gospel/i }).click();

    // Modal is now open
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();

    // Verify Gospel content inside modal
    await expect(modal.getByText('Holy Gospel of the Day')).toBeVisible();
    await expect(modal.getByText('Act of Spiritual Communion')).toBeVisible();

    // Close via modal close button
    const closeBtn = modal.getByRole('button', { name: 'Close modal' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Modal should be closed
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test('should open Modal directly to Intentions and Offertory tabs', async ({ page }) => {
    // Click Intentions button
    await page.getByRole('button', { name: /Intentions/i }).click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Parish Mass Intentions')).toBeVisible();

    // Switch to Offertory within modal
    await modal.getByRole('button', { name: 'Offertory' }).click();
    await expect(modal.getByText(/Love Offering Amount/i)).toBeVisible();
    await expect(modal.getByRole('button', { name: '₱100' })).toBeVisible();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});

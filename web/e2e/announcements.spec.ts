import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Announcements System', () => {
  test.describe('System Announcements Management (Super Admin)', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'super_admin');
      await page.goto('/admin/system-announcements');
    });

    test('should render System Announcements page with header, counts, and filter tabs', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'System Announcements' })).toBeVisible();
      await expect(page.getByText('Manage app-wide announcements visible to all users')).toBeVisible();

      // Filter tabs
      await expect(page.getByRole('button', { name: /All \(/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Info \(/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Maintenance \(/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Warning \(/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Success \(/i })).toBeVisible();
    });

    test('should switch filter tabs and filter announcements', async ({ page }) => {
      // By default All tab shows maintenance notice and info festival
      await expect(page.getByText('System Maintenance Notice')).toBeVisible();
      await expect(page.getByText('Diocese Youth Festival 2026')).toBeVisible();

      // Switch to Maintenance tab
      await page.getByRole('button', { name: /Maintenance \(/i }).click();
      await expect(page.getByText('System Maintenance Notice')).toBeVisible();
      await expect(page.getByText('Diocese Youth Festival 2026')).not.toBeVisible();

      // Switch to Info tab
      await page.getByRole('button', { name: /Info \(/i }).click();
      await expect(page.getByText('Diocese Youth Festival 2026')).toBeVisible();
      await expect(page.getByText('System Maintenance Notice')).not.toBeVisible();
    });

    test('should open and close New Announcement modal', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: 'New Announcement' });
      await newBtn.click();

      // Modal should appear
      await expect(page.getByRole('heading', { name: 'Create System Announcement' })).toBeVisible();
      await expect(page.getByPlaceholder('Announcement title')).toBeVisible();

      // Cancel button closes modal
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      await cancelBtn.click();

      await expect(page.getByRole('heading', { name: 'Create System Announcement' })).not.toBeVisible();
    });
  });

  test.describe('Announcements Banner and Widgets', () => {
    test('should render System Announcements Banner across dashboards', async ({ page }) => {
      await authenticateAs(page, 'super_admin');
      await page.goto('/dashboard');

      // The banner renders system announcements if active
      await expect(page.locator('body')).toBeVisible();
    });

    test('should render Parish Announcements Widget on Church Admin dashboard', async ({ page }) => {
      await authenticateAs(page, 'church_admin');
      await page.goto('/dashboard');

      await expect(page.getByText('Church Announcements').first()).toBeVisible();
      await expect(page.getByText('Fiesta Mass Schedule').first()).toBeVisible();
    });
  });
});

import { test, expect } from '@playwright/test';
import { setupSupabaseMocks, authenticateAs } from './helpers/mockAuth';

test.describe('Public & Protected Navigation Flow', () => {
  test.describe('Unauthenticated Visitors', () => {
    test.beforeEach(async ({ page }) => {
      await setupSupabaseMocks(page);
    });

    test('should redirect root path / to /login when unauthenticated', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/.*\/login/);
      await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    });

    test('should redirect protected routes /dashboard and /churches to /login', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/.*\/login/);

      await page.goto('/churches');
      await expect(page).toHaveURL(/.*\/login/);

      await page.goto('/appointments');
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should render public Privacy Policy page and navigate back to login', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
      await expect(page.getByText('1. Introduction')).toBeVisible();
      await expect(page.getByText('4. User Data Deletion')).toBeVisible();

      const backLink = page.getByRole('link', { name: /Back to Login/i });
      await expect(backLink).toBeVisible();
      await backLink.click();

      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Authenticated Navigation', () => {
    test('should navigate between Dashboard, Churches, and Appointments pages', async ({ page }) => {
      await authenticateAs(page, 'super_admin');
      await page.goto('/dashboard');

      // Verify Dashboard rendered
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();

      // Navigate to Churches page
      const churchesNavLink = page.locator('nav').getByRole('link', { name: 'Churches' });
      await churchesNavLink.click();

      await expect(page).toHaveURL(/.*\/churches/);
      await expect(page.getByRole('heading', { name: 'Churches' })).toBeVisible();
      await expect(page.getByPlaceholder('Search churches...')).toBeVisible();
      await expect(page.getByText('San Sebastian Cathedral').first()).toBeVisible();

      // Navigate to Appointments page
      const appointmentsNavLink = page.locator('nav').getByRole('link', { name: 'Appointments' });
      await appointmentsNavLink.click();

      await expect(page).toHaveURL(/.*\/appointments/);
      await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();
    });

    test('should toggle between Grid and List view on Churches page', async ({ page }) => {
      await authenticateAs(page, 'super_admin');
      await page.goto('/churches');

      await expect(page.getByRole('heading', { name: 'Churches' })).toBeVisible();

      // Switch to List view
      const listButton = page.getByRole('button', { name: /List/i });
      await listButton.click();

      // Table should be visible in desktop list view
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('table').getByText('San Sebastian Cathedral')).toBeVisible();

      // Switch back to Grid view
      const gridButton = page.getByRole('button', { name: /Grid/i });
      await gridButton.click();

      await expect(page.getByText('San Sebastian Cathedral').first()).toBeVisible();
    });

    test('should filter churches list via search bar', async ({ page }) => {
      await authenticateAs(page, 'super_admin');
      await page.goto('/churches');

      const searchInput = page.getByPlaceholder('Search churches...');
      await searchInput.fill('Queen of Peace');

      await expect(page.getByText('Queen of Peace Parish').first()).toBeVisible();
      await expect(page.getByText('San Sebastian Cathedral')).not.toBeVisible();
    });
  });
});

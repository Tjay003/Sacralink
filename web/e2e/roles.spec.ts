import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Role-Based Access Control & Multi-Role Personas', () => {
  test.describe('Super Admin Persona (user1@gmail.com)', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'super_admin');
    });

    test('should render Super Admin diocese dashboard with full administration widgets', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
      await expect(page.getByText('Diocese Dashboard - Manage all churches and system-wide settings')).toBeVisible();
      await expect(page.getByText('System Announcements').first()).toBeVisible();

      // Check sidebar nav items
      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Churches' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Appointments' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'System Announcements' })).toBeVisible();
    });

    test('should allow Super Admin to access User Management page and view users', async ({ page }) => {
      await page.goto('/users');

      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
      await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible();
      await expect(page.locator('table').getByText('Super Admin User')).toBeVisible();
      await expect(page.locator('table').getByText('Father Church Admin')).toBeVisible();
    });

    test('should allow Super Admin to access System Announcements management', async ({ page }) => {
      await page.goto('/admin/system-announcements');

      await expect(page.getByRole('heading', { name: 'System Announcements' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'New Announcement' })).toBeVisible();
      await expect(page.getByRole('button', { name: /All/i })).toBeVisible();
    });
  });

  test.describe('Church Admin Persona (user2@gmail.com)', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'church_admin');
    });

    test('should render Church Admin parish dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByText('Church Announcements').first()).toBeVisible();

      // Check sidebar nav items (should have Users for church management, but not System Announcements)
      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Churches' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Appointments' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'System Announcements' })).not.toBeVisible();
    });

    test('should block Church Admin from accessing Super Admin system announcements page', async ({ page }) => {
      await page.goto('/admin/system-announcements');

      await expect(page.getByText('Access Denied')).toBeVisible();
      await expect(page.getByText("You don't have permission to access this page.")).toBeVisible();
    });
  });

  test.describe('Parishioner Persona (user6@gmail.com)', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'parishioner');
    });

    test('should render Parishioner User Dashboard with personal appointments and verse', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
      await expect(page.getByText('Upcoming Appointments').first()).toBeVisible();
      await expect(page.getByText('Daily Verse').first()).toBeVisible();

      // Check sidebar nav items: regular parishioners do NOT see Users or System Announcements
      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: 'Users' })).not.toBeVisible();
      await expect(nav.getByRole('link', { name: 'System Announcements' })).not.toBeVisible();
      await expect(nav.getByRole('link', { name: 'Churches' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Appointments' })).toBeVisible();
    });
  });
});

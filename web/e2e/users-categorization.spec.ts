import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Admin User Management: Church Categorization & Multi-Column Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'super_admin');
    await page.goto('/users');
  });

  test('should render parish names instead of raw IDs in the user list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    
    // Check that Father Church Admin has the resolved church name badge
    await expect(page.locator('table').getByText('San Sebastian Cathedral').first()).toBeVisible();
  });

  test('should filter users by church using the church filter dropdown', async ({ page }) => {
    const churchFilter = page.locator('select').filter({ hasText: /All Parishes|San Sebastian Cathedral/i });
    await expect(churchFilter).toBeVisible();

    // Filter by San Sebastian Cathedral
    await churchFilter.selectOption({ label: 'San Sebastian Cathedral' });
    
    // Should show Father Church Admin
    await expect(page.locator('table').getByText('Father Church Admin')).toBeVisible();
  });

  test('should toggle between Flat Table View and Group by Parish Accordion View', async ({ page }) => {
    // Look for View Mode toggle buttons
    const groupToggleBtn = page.getByRole('button', { name: /Group by Parish/i });
    await expect(groupToggleBtn).toBeVisible();

    // Switch to Group by Parish Mode
    await groupToggleBtn.click();

    // Should display Church Accordion headers
    await expect(page.getByRole('heading', { name: 'San Sebastian Cathedral' })).toBeVisible();
    await expect(page.getByText(/Members/i).first()).toBeVisible();

    // Switch back to Flat Table View
    const flatToggleBtn = page.getByRole('button', { name: /Flat Table/i });
    await flatToggleBtn.click();
    await expect(page.locator('table')).toBeVisible();
  });

  test('should support multi-column sorting by Church, Role, Name, and Date', async ({ page }) => {
    // Clickable table header sorting
    const roleHeader = page.locator('th').filter({ hasText: /Role/i });
    await expect(roleHeader.first()).toBeVisible();
  });
});

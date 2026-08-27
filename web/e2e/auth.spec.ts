import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './helpers/mockAuth';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
  });

  test('should render login page with all core UI elements', async ({ page }) => {
    await page.goto('/login');

    // Branding and headers
    await expect(page.getByText('SACRA').first()).toBeVisible();
    await expect(page.getByText('LINK').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByText('Please enter your details to continue')).toBeVisible();

    // Form inputs and buttons
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const loginButton = page.getByRole('button', { name: 'Login' });
    const forgotPasswordLink = page.getByRole('link', { name: 'Forgot password ?' });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    await expect(forgotPasswordLink).toBeVisible();

    // Auth tabs
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
  });

  test('should toggle password visibility when eye icon is clicked', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button inside password input container
    const toggleButton = passwordInput.locator('..').locator('button');
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should display client-side validation errors on empty submission', async ({ page }) => {
    await page.goto('/login');

    const loginButton = page.getByRole('button', { name: 'Login' });
    await loginButton.click();

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should display validation error on invalid email format', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'invaliduser@invaliddomain');
    await page.fill('#password', 'somepassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('should display error message on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'wronguser@gmail.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('should navigate between login and register tabs', async ({ page }) => {
    await page.goto('/login');

    const registerTab = page.getByRole('link', { name: 'Register' });
    await registerTab.click();

    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    const loginTab = page.getByRole('link', { name: 'Login' });
    await loginTab.click();

    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('should render forgot-password link with correct href', async ({ page }) => {
    await page.goto('/login');

    const forgotPasswordLink = page.getByRole('link', { name: 'Forgot password ?' });
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  test('should successfully log in as Super Admin and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'user1@gmail.com');
    await page.fill('#password', 'Lolgamers_123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
  });
});

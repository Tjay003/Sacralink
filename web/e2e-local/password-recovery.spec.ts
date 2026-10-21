import { expect, test, type Page } from '@playwright/test';
import { serviceClient, ANON_KEY, LOCAL_URL } from './support';
import { createClient } from '@supabase/supabase-js';

// The local Supabase stack delivers every auth email to Mailpit (see docs/agents/local-testing.md).
const MAILPIT = 'http://127.0.0.1:54324';
const OLD_PASSWORD = 'OldPass#12345';
const NEW_PASSWORD = 'BrandNew#98765';

interface MailSummary {
  ID: string;
  To: { Address: string }[];
}

/** Waits for the newest email sent to `address` and returns its plain-text body. */
async function waitForEmailText(address: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
    const body = (await list.json()) as { messages?: MailSummary[] };
    const newest = body.messages?.[0];
    if (newest) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`);
      return ((await message.json()) as { Text: string }).Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email arrived for ${address}`);
}

function recoveryLink(text: string): string {
  const match = text.match(/https?:\/\/[^\s)>\]"]+type=recovery[^\s)>\]"]*/);
  if (!match) throw new Error(`No recovery link in email:\n${text}`);
  return match[0];
}

async function purgeInbox() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
}

async function requestResetEmail(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('link', { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByTestId('forgot-password-sent')).toBeVisible();
}

test.describe('Password recovery', () => {
  let email: string;
  let userId: string;

  test.beforeEach(async () => {
    email = `recovery-${Date.now()}@local.test`;
    const { data, error } = await serviceClient().auth.admin.createUser({
      email,
      password: OLD_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Recovery Tester' },
    });
    if (error) throw error;
    userId = data.user.id;
    await purgeInbox();
  });

  test.afterEach(async () => {
    await serviceClient().auth.admin.deleteUser(userId);
  });

  test('forgot password sends a real email whose link lets the user set a new password and log in', async ({ page }) => {
    await requestResetEmail(page, email);
    await expect(page.getByTestId('forgot-password-sent')).toContainText(email);

    await page.goto(recoveryLink(await waitForEmailText(email)));
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();

    await page.locator('#password').fill(NEW_PASSWORD);
    await page.locator('#confirmPassword').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByTestId('reset-password-done')).toBeVisible();

    await page.getByRole('button', { name: 'Go to login' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The old password no longer works through the real client; the new one does.
    const oldAttempt = await createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password: OLD_PASSWORD });
    expect(oldAttempt.error).not.toBeNull();

    await page.locator('#email').fill(email);
    await page.locator('#password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard**');
  });

  test('reset password rejects a short password and a mismatched confirmation', async ({ page }) => {
    await requestResetEmail(page, email);
    await page.goto(recoveryLink(await waitForEmailText(email)));
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();

    await page.locator('#password').fill('short');
    await page.locator('#confirmPassword').fill('short');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    await page.locator('#password').fill(NEW_PASSWORD);
    await page.locator('#confirmPassword').fill('Different#12345');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page.getByTestId('reset-password-done')).toHaveCount(0);

    // Nothing was changed: the original password still signs in.
    const stillOld = await createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password: OLD_PASSWORD });
    expect(stillOld.error).toBeNull();
  });

  test('visiting reset password without a recovery link explains the link is invalid', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByTestId('reset-password-no-session')).toContainText('invalid, has expired or was already used');
    await page.getByRole('link', { name: 'Request a new link' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test('forgot password validates the email address before sending', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    await expect(page.getByTestId('forgot-password-sent')).toHaveCount(0);
  });
});

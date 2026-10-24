import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeed, loginAs, resetMassSchedules, resetChurchChatLogs, serviceClient, LOCAL_URL } from './support';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let fakeGeminiProcess: ChildProcess | null = null;
let edgeFunctionsProcess: ChildProcess | null = null;

async function ensureFakeGeminiRunning() {
  try {
    const res = await fetch('http://127.0.0.1:54399/health');
    if (res.ok) return;
  } catch {
    // Not running, spawn it
  }

  const scriptPath = resolve(__dirname, '../../scripts/fake-gemini.mjs');
  fakeGeminiProcess = spawn('node', [scriptPath], {
    stdio: 'ignore',
    detached: false,
  });

  // Wait for it to become healthy
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:54399/health');
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function ensureFunctionsServing() {
  try {
    const res = await fetch(`${LOCAL_URL}/functions/v1/parish-assistant`, { method: 'OPTIONS' });
    if (res.ok) return;
  } catch {
    // Not running, spawn it
  }

  edgeFunctionsProcess = spawn('npx', ['supabase', 'functions', 'serve'], {
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${LOCAL_URL}/functions/v1/parish-assistant`, { method: 'OPTIONS' });
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

test.beforeAll(async () => {
  await ensureFakeGeminiRunning();
  await ensureFunctionsServing();
});

test.beforeEach(async () => {
  await resetChurchChatLogs();
});

test.afterAll(async () => {
  if (fakeGeminiProcess) {
    fakeGeminiProcess.kill();
  }
  if (edgeFunctionsProcess) {
    edgeFunctionsProcess.kill();
  }
  await resetMassSchedules();
});

test.describe('AI Parish Assistant - Tracer Bullet', () => {
  test('refuses unauthenticated calls to parish-assistant with 401', async () => {
    const res = await fetch(`${LOCAL_URL}/functions/v1/parish-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What are the Mass times?' }),
    });

    expect(res.status).toBe(401);
  });

  test('staff roles (church_admin) never see the Parish Assistant button', async ({ page }) => {
    await loginAs(page, 'church_admin');
    await page.goto('/dashboard');

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toHaveCount(0);

    await page.goto('/appointments');
    await expect(assistantBtn).toHaveCount(0);
  });

  test('parishioner sees assistant on dashboard, appointments, and parish pages, with no horizontal scroll at phone width', async ({
    page,
  }) => {
    const seed = await getSeed();
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(page, 'parishioner');

    // 1. Dashboard page
    await page.goto('/dashboard');
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible();

    // 2. Appointments page
    await page.goto('/appointments');
    await expect(assistantBtn).toBeVisible();

    // 3. Parish detail page
    await page.goto(`/churches/${seed.churchId}`);
    await expect(assistantBtn).toBeVisible();

    // Open assistant and verify responsive layout fits screen without overflow
    await assistantBtn.click();
    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    // Close panel
    await page.locator('[data-testid="parish-assistant-close"]').click();
    await expect(panel).toBeHidden();
  });

  test('answers live Mass times from database and reflects immediate changes without sync', async ({ page }) => {
    const seed = await getSeed();
    const db = serviceClient();

    await resetMassSchedules();

    // 1. Seed two recurring Mass schedules
    await db.from('mass_schedules').insert([
      {
        church_id: seed.churchId,
        day_of_week: 'Sunday',
        time: '09:00:00',
        language: 'Tagalog',
      },
      {
        church_id: seed.churchId,
        day_of_week: 'Sunday',
        time: '11:00:00',
        language: 'English',
      },
    ]);

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // Open Parish Assistant
    await page.locator('[data-testid="parish-assistant-button"]').click();
    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Verify parish context is detected from route
    await expect(page.locator('[data-testid="parish-assistant-church-chip"]')).toContainText(
      'Local Test Parish'
    );

    // Ask for Mass times via starter quick-tap chip
    await page.getByRole('button', { name: 'What are the Mass schedules?' }).click();

    // Verify assistant responds with live schedules
    const firstReply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(firstReply).toBeVisible({ timeout: 15000 });
    await expect(firstReply).toContainText('09:00:00');
    await expect(firstReply).toContainText('11:00:00');

    // 2. Insert a new schedule directly into the database (no sync step)
    await db.from('mass_schedules').insert({
      church_id: seed.churchId,
      day_of_week: 'Saturday',
      time: '18:00:00',
      language: 'English',
    });

    // Ask again in chat
    await page.locator('textarea').fill('What are the Mass schedules?');
    await page.locator('button[aria-label="Send message"]').click();

    // Verify the second reply immediately reflects the new database row
    const replies = page.locator('[data-testid="assistant-reply"]');
    await expect(replies).toHaveCount(2, { timeout: 15000 });
    const latestReply = replies.nth(1);
    await expect(latestReply).toContainText('18:00:00');
  });
});

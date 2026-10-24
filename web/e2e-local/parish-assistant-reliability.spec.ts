import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSeed,
  loginAs,
  resetMassSchedules,
  resetChurchChatLogs,
  serviceClient,
  clientAs,
  LOCAL_URL,
} from './support';

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

test.describe('AI Parish Assistant - Reliability, Server Rate Limit, Logging & Fallback', () => {
  test.beforeAll(async () => {
    await ensureFakeGeminiRunning();
    await ensureFunctionsServing();
  });

  test.afterAll(async () => {
    if (fakeGeminiProcess) {
      fakeGeminiProcess.kill();
    }
    if (edgeFunctionsProcess) {
      edgeFunctionsProcess.kill();
    }
    await resetMassSchedules();
    await resetChurchChatLogs();
  });

  test('1. Server rate limit: 11th message inside 5 minutes receives rate-limit notice even with browser storage cleared', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // 1. Wipe chat logs for this parishioner
    await resetChurchChatLogs(seed.ids.parishioner);

    // 2. Seed 10 recent chat log entries for this user within the last 5 minutes
    const seededLogs = Array.from({ length: 10 }).map((_, i) => ({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      question: `Seeded query ${i + 1}`,
      answer: `Seeded answer ${i + 1}`,
      created_at: new Date(Date.now() - (i + 1) * 15 * 1000).toISOString(),
    }));
    const { error: seedErr } = await db.from('church_chat_logs').insert(seededLogs);
    expect(seedErr).toBeNull();

    // 3. Log in as parishioner and navigate to dashboard
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // 4. Intentionally clear browser sessionStorage to prove server enforces rate limit
    // even with empty client rate limit state
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // 5. Open assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // 6. Attempt the 11th inquiry
    await page.locator('textarea').fill('What are the Mass schedules?');
    await page.locator('button[aria-label="Send message"]').click();

    // 7. Verify the rate limit notice is returned by the server and rendered in the assistant
    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText(
      'You have reached the temporary inquiry limit. Please wait a few minutes or contact the parish office directly for immediate assistance.'
    );

    // Verify rate-limited requests are not added to the log table
    const { count } = await db
      .from('church_chat_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', seed.ids.parishioner);
    expect(count).toBe(10);
  });

  test('2. Single log per exchange: exactly one log entry in church_chat_logs, none written by browser', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // Reset logs for clean count
    await resetChurchChatLogs(seed.ids.parishioner);
    await resetMassSchedules();

    // Seed a Mass schedule
    await db.from('mass_schedules').insert({
      church_id: seed.churchId,
      day_of_week: 'Sunday',
      time: '08:00:00',
      language: 'English',
    });

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const testQuestion = `What are the Sunday Mass times? (${Date.now()})`;
    await page.locator('textarea').fill(testQuestion);
    await page.locator('button[aria-label="Send message"]').click();

    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText('08:00:00');

    // Wait a brief moment to ensure no background duplicate writes occur
    await page.waitForTimeout(1000);

    // Query church_chat_logs for this user
    const { data: logs, error } = await db
      .from('church_chat_logs')
      .select('id, question, answer, church_id, user_id')
      .eq('user_id', seed.ids.parishioner);

    expect(error).toBeNull();
    // Exactly 1 log entry exists for this exchange
    expect(logs).toHaveLength(1);
    expect(logs![0].church_id).toBe(seed.churchId);
    expect(logs![0].user_id).toBe(seed.ids.parishioner);
    expect(logs![0].question).toBe(testQuestion);
    expect(logs![0].answer).toContain('08:00:00');
  });

  test('3. Fallback on function unreachability: keyword fallback answers Mass times when function is aborted', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    await resetMassSchedules();

    // Seed Mass schedules in database
    await db.from('mass_schedules').insert([
      {
        church_id: seed.churchId,
        day_of_week: 'Sunday',
        time: '07:30:00',
        language: 'Tagalog',
      },
      {
        church_id: seed.churchId,
        day_of_week: 'Sunday',
        time: '10:00:00',
        language: 'English',
      },
    ]);

    // Abort all edge function calls to simulate complete network unreachability / downtime
    await page.route('**/functions/v1/parish-assistant', (route) => route.abort());

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    // Ask for Mass schedules
    await page.locator('textarea').fill('What are the Mass schedules?');
    await page.locator('button[aria-label="Send message"]').click();

    // Assistant should engage keyword fallback and return live schedules from the database
    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText('official Mass schedules');
    await expect(reply).toContainText('7:30 AM');
    await expect(reply).toContainText('10:00 AM');
    await expect(reply).toContainText('Local Test Parish');
  });

  test('4. Model fallback: 429 quota error on model 1 falls through to model 2', async () => {
    const seed = await getSeed();
    const parishionerClient = await clientAs('parishioner');

    // Clean up logs to keep rate limit clear
    await resetChurchChatLogs(seed.ids.parishioner);

    // Call parish-assistant edge function with header x-test-simulate-quota: true
    // Model 1 (gemini-2.5-flash) will receive 429 from fake-gemini,
    // which then falls through to Model 2 (gemini-1.5-flash) returning 200.
    const { data, error } = await parishionerClient.functions.invoke('parish-assistant', {
      headers: {
        'x-test-simulate-quota': 'true',
      },
      body: {
        message: 'What are the Mass schedules?',
        churchId: seed.churchId,
      },
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.reply).toBeDefined();
    // Verify successful reply obtained via fallback model
    expect(data.reply.length).toBeGreaterThan(0);
    expect(data.isRateLimited).toBeFalsy();
  });
});

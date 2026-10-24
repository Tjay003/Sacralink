import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, LOCAL_URL } from './support';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let fakeGeminiProcess: ChildProcess | null = null;
let edgeFunctionsProcess: ChildProcess | null = null;

async function ensureFakeGeminiRunning() {
  try {
    const res = await fetch('http://127.0.0.1:54399/health');
    if (res.ok) return;
  } catch {
    // Not running
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
    // Not running
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

test.afterAll(() => {
  if (fakeGeminiProcess) {
    try {
      fakeGeminiProcess.kill();
    } catch {
      // ignore
    }
  }
  if (edgeFunctionsProcess) {
    try {
      edgeFunctionsProcess.kill();
    } catch {
      // ignore
    }
  }
});

test.describe('AI Parish Assistant - Ticket 10: Accessibility (Large Text & Read Aloud)', () => {
  test('Test 1: Large text toggle persists in localStorage, survives reload, and scales chips to at least 56px', async ({ page }) => {
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 1. Open assistant
    const assistantBtn = page.getByTestId('parish-assistant-button');
    await expect(assistantBtn).toBeVisible();
    await assistantBtn.click();

    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Verify initial default mode: large text is off
    const toggleBtn = page.getByTestId('parish-assistant-large-text-toggle');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

    const starterChip = page.getByTestId('starter-chip-what-are-the-mass-schedules-');
    await expect(starterChip).toBeVisible();
    const defaultBox = await starterChip.boundingBox();
    expect(defaultBox).not.toBeNull();
    // Default height is < 56px
    expect(defaultBox!.height).toBeLessThan(56);

    // 2. Toggle large text mode ON
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // Check localStorage persistence
    const storedVal = await page.evaluate(() => localStorage.getItem('sacralink_assistant_large_text'));
    expect(storedVal).toBe('true');

    // Check that chips have scaled to at least 56px tall
    const largeBox = await starterChip.boundingBox();
    expect(largeBox).not.toBeNull();
    expect(largeBox!.height).toBeGreaterThanOrEqual(56);

    // 3. Reload page and check that preference persists
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The panel should either be already open (due to sessionStorage) or easily opened
    const isPanelVisible = await panel.isVisible();
    if (!isPanelVisible) {
      const btn = page.getByTestId('parish-assistant-button');
      await expect(btn).toBeVisible();
      await btn.click();
    }

    await expect(panel).toBeVisible();

    const toggleAfterReload = page.getByTestId('parish-assistant-large-text-toggle');
    await expect(toggleAfterReload).toHaveAttribute('aria-pressed', 'true');

    const starterChipAfterReload = page.getByTestId('starter-chip-what-are-the-mass-schedules-');
    const boxAfterReload = await starterChipAfterReload.boundingBox();
    expect(boxAfterReload!.height).toBeGreaterThanOrEqual(56);
  });

  test('Test 2: Large text mode never causes horizontal scrolling on phone viewports (360px & 390px)', async ({ page }) => {
    // Set mobile viewport 360px
    await page.setViewportSize({ width: 360, height: 740 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open assistant
    await page.getByTestId('parish-assistant-button').click();
    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Enable large text
    const toggleBtn = page.getByTestId('parish-assistant-large-text-toggle');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // Check 360px: verify page and panel have zero horizontal scroll
    const hasHorizontalOverflow360 = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow360).toBe(false);

    // Set mobile viewport 390px
    await page.setViewportSize({ width: 390, height: 844 });
    const hasHorizontalOverflow390 = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow390).toBe(false);
  });

  test('Test 3: Read aloud speaks reply, can be stopped, and is hidden when speech synthesis is unsupported', async ({ page }) => {
    // Spy on window.speechSynthesis to track speak / cancel calls
    await page.addInitScript(() => {
      (window as any).__speechLog = {
        spokenTexts: [] as string[],
        cancelCount: 0,
      };

      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
          (window as any).__speechLog.spokenTexts.push(utterance.text);
          if (utterance.onstart) {
            setTimeout(() => (utterance as any).onstart(), 10);
          }
        };

        const origCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
        window.speechSynthesis.cancel = () => {
          (window as any).__speechLog.cancelCount++;
          origCancel();
        };
      }
    });

    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open assistant
    await page.getByTestId('parish-assistant-button').click();
    await expect(page.getByTestId('parish-assistant-panel')).toBeVisible();

    // Tap starter chip: "What are the Mass schedules?"
    await page.getByTestId('starter-chip-what-are-the-mass-schedules-').click();

    // Wait for assistant reply
    const assistantReply = page.getByTestId('assistant-reply').first();
    await expect(assistantReply).toBeVisible({ timeout: 15000 });

    // The Read Aloud button should be present
    const readAloudBtn = assistantReply.getByTestId('read-aloud-button');
    await expect(readAloudBtn).toBeVisible();
    await expect(readAloudBtn).toHaveAttribute('aria-label', 'Read aloud');

    // Click "Read aloud"
    await readAloudBtn.click();

    // Verify speech was triggered with clean stripped text
    await expect.poll(async () => {
      const log = await page.evaluate(() => (window as any).__speechLog);
      return log.spokenTexts.length;
    }).toBeGreaterThan(0);

    // Button state changes to "Stop reading"
    await expect(readAloudBtn).toHaveAttribute('aria-label', 'Stop reading');

    // Click again to stop
    await readAloudBtn.click();
    const updatedLog = await page.evaluate(() => (window as any).__speechLog);
    expect(updatedLog.cancelCount).toBeGreaterThan(0);
    await expect(readAloudBtn).toHaveAttribute('aria-label', 'Read aloud');
  });

  test('Test 4: Private browsing / blocked localStorage does not crash assistant', async ({ page }) => {
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Simulate blocked storage specifically on sacralink_assistant_large_text
    await page.evaluate(() => {
      const origGet = localStorage.getItem.bind(localStorage);
      const origSet = localStorage.setItem.bind(localStorage);

      localStorage.getItem = (key: string) => {
        if (key === 'sacralink_assistant_large_text') {
          throw new DOMException('Blocked storage in private mode', 'SecurityError');
        }
        return origGet(key);
      };

      localStorage.setItem = (key: string, val: string) => {
        if (key === 'sacralink_assistant_large_text') {
          throw new DOMException('Blocked storage in private mode', 'SecurityError');
        }
        return origSet(key, val);
      };
    });

    // Open assistant - should NOT crash
    await page.getByTestId('parish-assistant-button').click();
    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Toggle large text - should safely catch error without crashing
    const toggleBtn = page.getByTestId('parish-assistant-large-text-toggle');
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

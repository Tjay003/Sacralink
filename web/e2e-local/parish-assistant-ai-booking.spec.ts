import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSeed,
  loginAs,
  resetAppointmentData,
  resetPriestAvailability,
  resetMassSchedules,
  resetChurchChatLogs,
  serviceClient,
  isoDate,
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

test.describe('AI Parish Assistant - Ticket 08: AI-Assisted Natural Language Booking', () => {
  test.beforeAll(async () => {
    await ensureFakeGeminiRunning();
    await ensureFunctionsServing();
  });

  test.beforeEach(async () => {
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();
  });

  test.afterAll(async () => {
    if (fakeGeminiProcess) {
      fakeGeminiProcess.kill();
    }
    if (edgeFunctionsProcess) {
      edgeFunctionsProcess.kill();
    }
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();
  });

  test('Test 1: "I want to book a baptism" starts guide at date step with Baptism selected', async ({
    page,
  }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // 1. Open Parish Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // 2. Type: "I want to book a baptism"
    const textarea = panel.locator('textarea');
    await textarea.fill('I want to book a baptism');
    await panel.locator('button[aria-label="Send message"]').click();

    // 3. Verify assistant responds with booking reply
    const reply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText(/Baptism/i);

    // 4. Verify guide is directly at date step (date chips visible, service step skipped)
    const dateChips = panel.locator('[data-testid^="date-chip-"]');
    await expect(dateChips.first()).toBeVisible({ timeout: 10000 });

    // 5. Verify sessionStorage draft state
    const draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft).not.toBeNull();
    expect(draft.step).toBe('date');
    expect(draft.serviceTypeName).toBe('Baptism');
  });

  test('Test 2: Typed slot proposal: taken slot is rejected with alternatives; free slot is accepted', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // 1. Seed a taken slot for tomorrow at 10:00:00
    const targetDate = isoDate(1);
    await db.from('appointments').insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: targetDate,
      appointment_time: '10:00:00',
      status: 'approved',
    });

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // Open assistant and start booking
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Start booking via natural language intent
    const textarea = panel.locator('textarea');
    await textarea.fill('I want to book a baptism');
    await panel.locator('button[aria-label="Send message"]').click();

    // Pick targetDate (tomorrow)
    const targetDateChip = panel.locator(`[data-testid="date-chip-${targetDate}"]`);
    await expect(targetDateChip).toBeVisible({ timeout: 10000 });
    await targetDateChip.click();

    // We are now at time step. Verify open time slot chips appear
    await expect(panel.locator('[data-testid^="time-chip-"]').first()).toBeVisible({ timeout: 10000 });

    // Type taken slot: "10:00 AM"
    await textarea.fill('10:00 AM');
    await panel.locator('button[aria-label="Send message"]').click();

    // Proposal must be REJECTED with explanation and alternative chips
    const rejectedMsg = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(rejectedMsg).toBeVisible({ timeout: 15000 });
    await expect(rejectedMsg).toContainText(/unavailable|already booked/i);

    // Verify draft remains at 'time' step and 10:00 was NOT accepted
    let draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft.step).toBe('time');
    expect(draft.time).toBeUndefined();

    // Type free slot: "2:00 PM"
    await textarea.fill('2:00 PM');
    await panel.locator('button[aria-label="Send message"]').click();

    // Proposal must be ACCEPTED and advance to priest step
    const priestChipAny = panel.locator('[data-testid="priest-chip-any"]');
    await expect(priestChipAny).toBeVisible({ timeout: 15000 });

    // Verify draft advanced to 'priest' step with time set to 14:00
    draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft.step).toBe('priest');
    expect(draft.time).toBe('14:00');
  });

  test('Test 3: Side question mid-booking is answered and booking resumes at current step', async ({
    page,
  }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // Open assistant and start booking
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Start booking
    const textarea = panel.locator('textarea');
    await textarea.fill('I want to book a baptism');
    await panel.locator('button[aria-label="Send message"]').click();

    // Date step reached
    const dateChips = panel.locator('[data-testid^="date-chip-"]');
    await expect(dateChips.first()).toBeVisible({ timeout: 10000 });

    // Select first date
    await dateChips.first().click();

    // Now at time step
    await expect(panel.locator('[data-testid^="time-chip-"]').first()).toBeVisible({ timeout: 10000 });

    // Ask side question mid-booking
    await textarea.fill('What is a Pre-Jordan seminar?');
    await panel.locator('button[aria-label="Send message"]').click();

    // Verify side question reply
    const sideReply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(sideReply).toBeVisible({ timeout: 15000 });
    await expect(sideReply).toContainText(/Pre-Jordan|catechetical/i);

    // Verify booking draft is preserved at 'time' step and chips are still visible
    const draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft.step).toBe('time');
    expect(draft.date).toBeTruthy();

    // Click a time chip to resume booking
    const firstTimeChip = panel.locator('[data-testid^="time-chip-"]').first();
    await expect(firstTimeChip).toBeVisible();
    await firstTimeChip.click();

    // Successfully moves forward to priest step
    await expect(panel.locator('[data-testid="priest-chip-any"]')).toBeVisible({ timeout: 10000 });
  });

  test('Test 4: "Change the date" rewinds to date step and clears dependent fields', async ({
    page,
  }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Start booking
    const textarea = panel.locator('textarea');
    await textarea.fill('I want to book a baptism');
    await panel.locator('button[aria-label="Send message"]').click();

    // Select date
    const dateChips = panel.locator('[data-testid^="date-chip-"]');
    await expect(dateChips.first()).toBeVisible({ timeout: 10000 });
    const firstDate = await dateChips.first().getAttribute('data-date');
    await dateChips.first().click();

    // Select time
    const timeChip = panel.locator('[data-testid^="time-chip-"]').first();
    await expect(timeChip).toBeVisible({ timeout: 10000 });
    await timeChip.click();

    // At priest step
    await expect(panel.locator('[data-testid="priest-chip-any"]')).toBeVisible({ timeout: 10000 });

    // Verify draft has date and time populated
    let draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft.step).toBe('priest');
    expect(draft.date).toBe(firstDate);
    expect(draft.time).toBeTruthy();

    // Type: "Change the date"
    await textarea.fill('Change the date');
    await panel.locator('button[aria-label="Send message"]').click();

    // Verify assistant responds confirming date change
    const changeReply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(changeReply).toBeVisible({ timeout: 15000 });
    await expect(changeReply).toContainText(/change.*date|choose.*date|options/i);

    // Verify date chips are visible again
    await expect(panel.locator('[data-testid^="date-chip-"]').first()).toBeVisible({ timeout: 10000 });

    // Verify dependent fields (date, time) are cleared from draft
    draft = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('sacralink:booking-draft') || 'null');
    });
    expect(draft.step).toBe('date');
    expect(draft.date).toBeUndefined();
    expect(draft.time).toBeUndefined();
  });

  test('Test 5: Language mirroring (English, Tagalog, Taglish)', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    const textarea = panel.locator('textarea');
    const sendBtn = panel.locator('button[aria-label="Send message"]');

    // 1. English Inquiry
    await textarea.fill('I want to book a baptism');
    await sendBtn.click();

    const englishReply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(englishReply).toBeVisible({ timeout: 15000 });
    await expect(englishReply).toContainText(/assist you with booking a Baptism|select an appointment date/i);

    // Reset booking draft by canceling
    await textarea.fill('cancel');
    await sendBtn.click();

    // 2. Tagalog Inquiry
    await textarea.fill('Gusto ko pong magpa-binyag');
    await sendBtn.click();

    const tagalogReply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(tagalogReply).toBeVisible({ timeout: 15000 });
    await expect(tagalogReply).toContainText(/Ikinagagalak ko po kayong tulungan sa pag-book ng Binyag|petsa/i);

    // Reset booking draft by canceling
    await textarea.fill('cancel');
    await sendBtn.click();

    // 3. Taglish Inquiry
    await textarea.fill('Gusto ko mag book ng baptism please');
    await sendBtn.click();

    const taglishReply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(taglishReply).toBeVisible({ timeout: 15000 });
    await expect(taglishReply).toContainText(/Opo.*mag-book ng Baptism|options/i);
  });
});

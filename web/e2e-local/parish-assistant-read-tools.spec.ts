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
  addLeave,
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

test.describe('AI Parish Assistant - Live Read Tools & Isolation', () => {
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
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();

    const db = serviceClient();
    const seed = await getSeed();
    await db.from('sacrament_requirements').delete().eq('church_id', seed.churchId);
    await db.from('church_announcements').delete().eq('church_id', seed.churchId);
  });

  test('Spec test #2: Parishioner A sees only their own appointments, never Parishioner B details', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    await resetAppointmentData();

    // 1. Seed appointment for Parishioner A
    const parishionerAAppointmentDate = isoDate(7);
    const parishionerANotes = 'Parishioner A Baby Juan Baptism';
    await db.from('appointments').insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: parishionerAAppointmentDate,
      appointment_time: '10:00:00',
      status: 'approved',
      notes: parishionerANotes,
    });

    // 2. Seed appointment for Parishioner B (using other user ID, e.g. church_admin)
    const parishionerBAppointmentDate = isoDate(10);
    const parishionerBConfidentialNotes = 'Parishioner B Confidential High-Profile Wedding';
    await db.from('appointments').insert({
      user_id: seed.ids.church_admin,
      church_id: seed.churchId,
      service_type: 'Wedding',
      appointment_date: parishionerBAppointmentDate,
      appointment_time: '14:00:00',
      status: 'approved',
      notes: parishionerBConfidentialNotes,
    });

    // 3. Log in as Parishioner A
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    // Open Parish Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Click starter chip "My appointments"
    await page.getByRole('button', { name: 'My appointments' }).click();

    // Wait for the assistant reply
    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    // Assert Parishioner A's appointment details are present
    await expect(reply).toContainText('Baptism');
    await expect(reply).toContainText(parishionerANotes);
    await expect(reply).toContainText(parishionerAAppointmentDate);

    // CRITICAL SECURITY ASSERTION: Parishioner B's appointment details must NEVER appear
    await expect(reply).not.toContainText(parishionerBConfidentialNotes);
    await expect(reply).not.toContainText('High-Profile Wedding');
  });

  test('Priest availability privacy: confirms unavailable without leaking private leave reason', async ({
    page,
  }) => {
    const seed = await getSeed();
    await resetPriestAvailability();

    // 1. Put Father on leave with a private sensitive reason
    const leaveDate = isoDate(12);
    const privateSensitiveReason = 'Confidential psychological therapy and private personal surgery';
    await addLeave('priest', leaveDate, leaveDate, privateSensitiveReason);

    // 2. Inquire via Parish Assistant as parishioner
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Inquire about Father's availability on that specific date
    await page.locator('textarea').fill(`Is Father Local Priest available on ${leaveDate}?`);
    await page.locator('button[aria-label="Send message"]').click();

    // Wait for the assistant reply
    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    // Assert reply states Father is not available
    await expect(reply).toContainText('not available');

    // CRITICAL PRIVACY ASSERTIONS: Private reason strings must NEVER appear in the reply
    await expect(reply).not.toContainText(privateSensitiveReason);
    await expect(reply).not.toContainText('psychological');
    await expect(reply).not.toContainText('surgery');
    await expect(reply).not.toContainText('Confidential');
  });

  test('Mass across parishes: finds Masses across multiple parishes by day of week', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    await resetMassSchedules();

    // 1. Seed Sunday Mass in Local Test Parish
    await db.from('mass_schedules').insert({
      church_id: seed.churchId,
      day_of_week: 'Sunday',
      time: '08:00:00',
      language: 'Tagalog',
    });

    // 2. Seed Sunday Mass in Other Test Parish
    await db.from('mass_schedules').insert({
      church_id: seed.otherChurchId,
      day_of_week: 'Sunday',
      time: '18:00:00',
      language: 'English',
    });

    // 3. Inquire in assistant
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    await page.locator('[data-testid="parish-assistant-button"]').click();
    await expect(page.locator('[data-testid="parish-assistant-panel"]')).toBeVisible();

    await page.locator('textarea').fill('Where can I hear Mass across parishes on Sunday?');
    await page.locator('button[aria-label="Send message"]').click();

    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    // Verify both parishes appear in the diocesan schedule reply
    await expect(reply).toContainText('Local Test Parish');
    await expect(reply).toContainText('Other Test Parish');
    await expect(reply).toContainText('08:00:00');
    await expect(reply).toContainText('18:00:00');
  });

  test('Bookable services: returns active services offered by the parish', async ({ page }) => {
    const seed = await getSeed();

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    await page.locator('[data-testid="parish-assistant-button"]').click();
    await expect(page.locator('[data-testid="parish-assistant-panel"]')).toBeVisible();

    await page.locator('textarea').fill('What bookable services do you offer?');
    await page.locator('button[aria-label="Send message"]').click();

    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    await expect(reply).toContainText('Baptism');
    await expect(reply).toContainText('Wedding');
  });

  test('Sacrament requirements: returns requirements checklist for a service', async ({ page }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // Seed requirements for Baptism in Local Test Parish
    await db.from('sacrament_requirements').delete().eq('church_id', seed.churchId);
    await db.from('sacrament_requirements').insert([
      {
        church_id: seed.churchId,
        service_type: 'Baptism',
        requirement_name: 'PSA Birth Certificate',
        description: 'Original copy issued by the Philippine Statistics Authority',
        is_required: true,
      },
      {
        church_id: seed.churchId,
        service_type: 'Baptism',
        requirement_name: 'Parents Marriage Certificate',
        description: 'Catholic church marriage contract',
        is_required: true,
      },
    ]);

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    await page.locator('[data-testid="parish-assistant-button"]').click();
    await expect(page.locator('[data-testid="parish-assistant-panel"]')).toBeVisible();

    await page.locator('textarea').fill('What are the requirements for Baptism?');
    await page.locator('button[aria-label="Send message"]').click();

    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    await expect(reply).toContainText('PSA Birth Certificate');
    await expect(reply).toContainText('Parents Marriage Certificate');
  });

  test('Free-text knowledge search: answers from synced knowledge sections', async ({ page }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // Seed a knowledge section in church_announcements
    await db.from('church_announcements').delete().eq('church_id', seed.churchId);
    await db.from('church_announcements').insert({
      church_id: seed.churchId,
      title: 'Parish Office Hours & Ministries',
      content: 'The Parish Office operates Tuesday through Sunday from 08:30 AM to 05:00 PM. Closed on Mondays.',
      category: 'general',
      target_audience: 'everyone',
    });

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    await page.locator('[data-testid="parish-assistant-button"]').click();
    await expect(page.locator('[data-testid="parish-assistant-panel"]')).toBeVisible();

    await page.locator('textarea').fill('What are the parish office hours and ministry schedules?');
    await page.locator('button[aria-label="Send message"]').click();

    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });

    await expect(reply).toContainText('08:30 AM to 05:00 PM');
    await expect(reply).toContainText('Closed on Mondays');
  });
});

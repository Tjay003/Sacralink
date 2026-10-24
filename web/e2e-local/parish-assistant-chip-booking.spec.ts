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

test.describe('AI Parish Assistant - Ticket 06: Book by Tapping Chips', () => {
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

  test('Test 1: Full chip-only booking for a service without required documents (Blessing)', async ({
    page,
  }) => {
    const seed = await getSeed();

    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    // 1. Open Parish Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // 2. Tap starter chip: "Book a sacrament" inside assistant panel
    const bookChip = panel.getByRole('button', { name: 'Book a sacrament', exact: true });
    await expect(bookChip).toBeVisible();
    await bookChip.click();

    // If prompted to pick a parish, select Local Test Parish
    const localParishChip = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await localParishChip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await localParishChip.click();
    }

    // 3. Step: Service selection - tap "Blessing" chip
    const blessingChip = panel.getByRole('button', { name: 'Blessing', exact: true });
    await expect(blessingChip).toBeVisible({ timeout: 10000 });
    await blessingChip.click();

    // 4. Step: Date selection - select first upcoming date
    const dateChip = panel.locator('[data-testid^="date-chip-"]').first();
    await expect(dateChip).toBeVisible({ timeout: 10000 });
    const selectedDate = await dateChip.getAttribute('data-date');
    await dateChip.click();

    // 5. Step: Time selection - select first available slot
    const timeChip = panel.locator('[data-testid^="time-chip-"]').first();
    await expect(timeChip).toBeVisible({ timeout: 10000 });
    const selectedTime = await timeChip.getAttribute('data-time');
    await timeChip.click();

    // 6. Step: Preferred Priest selection - select parish priest
    const priestChip = panel.locator(`[data-testid="priest-chip-${seed.ids.priest}"]`);
    await expect(priestChip).toBeVisible({ timeout: 10000 });
    await priestChip.click();

    // 7. Step: Notes / Skip - tap skip
    const skipNotesChip = panel.locator('[data-testid="notes-chip-skip"]');
    await expect(skipNotesChip).toBeVisible({ timeout: 10000 });
    await skipNotesChip.click();

    // 8. Step: Summary card - verify details and tap Confirm
    const summaryCard = panel.locator('[data-testid="booking-summary-card"]');
    await expect(summaryCard).toBeVisible({ timeout: 10000 });
    await expect(summaryCard).toContainText('Blessing');
    if (selectedDate) {
      await expect(summaryCard.locator('[data-testid="summary-date"]')).toHaveAttribute('data-date', selectedDate);
    }

    const confirmBtn = panel.locator('[data-testid="booking-confirm-button"]');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 9. Assert success confirmation card
    const successCard = panel.locator('[data-testid="booking-success-card"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });

    // 10. Database assertions
    const db = serviceClient();
    const { data: appts, error: apptErr } = await db
      .from('appointments')
      .select('*')
      .eq('user_id', seed.ids.parishioner)
      .eq('church_id', seed.churchId);

    expect(apptErr).toBeNull();
    expect(appts).toHaveLength(1);

    const appt = appts![0];
    expect(appt.service_type).toBe('Blessing');
    expect(appt.status).toBe('pending');
    expect(appt.priest_id).toBeNull(); // Celebrant is unassigned at booking
    expect(appt.requested_priest_id).toBe(seed.ids.priest); // Stored as preference only
    expect(appt.appointment_date).toBe(selectedDate);
    if (selectedTime) {
      expect(appt.appointment_time.slice(0, 5)).toBe(selectedTime.slice(0, 5));
    }

    // 11. Assert Parish Admins were notified
    const { data: notifs, error: notifErr } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', seed.ids.church_admin);

    expect(notifErr).toBeNull();
    expect(notifs && notifs.length).toBeGreaterThan(0);
    expect(notifs?.some((n) => n.message?.includes('Blessing') || n.link?.includes(appt.id))).toBe(true);
  });

  test('Test 2: Past dates and already taken slots are never offered as chips', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    // Insert an appointment for tomorrow at 10:00:00 to simulate a taken slot
    const targetDate = isoDate(1);
    await db.from('appointments').insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type: 'Blessing',
      appointment_date: targetDate,
      appointment_time: '10:00:00',
      status: 'approved',
    });

    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Book a sacrament', exact: true }).click();
    const parishChip2 = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await parishChip2.isVisible({ timeout: 1500 }).catch(() => false)) {
      await parishChip2.click();
    }
    await panel.getByRole('button', { name: 'Blessing', exact: true }).click();

    // 1. Verify that NO past dates are offered as date chips
    const dateChips = panel.locator('[data-testid^="date-chip-"]');
    const chipCount = await dateChips.count();
    expect(chipCount).toBeGreaterThan(0);

    const todayStr = isoDate(0);
    for (let i = 0; i < chipCount; i++) {
      const chipDate = await dateChips.nth(i).getAttribute('data-date');
      expect(chipDate).toBeTruthy();
      // Chip date must be today or future (never in the past)
      expect(chipDate! >= todayStr).toBe(true);
    }

    // 2. Select targetDate (tomorrow)
    const targetDateChip = panel.locator(`[data-testid="date-chip-${targetDate}"]`);
    await expect(targetDateChip).toBeVisible();
    await targetDateChip.click();

    // 3. Verify that the taken slot (10:00) is NEVER offered as a time chip
    await expect(panel.locator('[data-testid^="time-chip-"]').first()).toBeVisible({ timeout: 10000 });
    const takenSlotChip = panel.locator('[data-testid="time-chip-10-00"]');
    await expect(takenSlotChip).toHaveCount(0);

    // Verify other open slots are offered
    const openSlotChip = panel.locator('[data-testid="time-chip-08-00"]');
    await expect(openSlotChip).toBeVisible();
  });

  test('Test 3: Page refresh mid-flow retains the booking draft state from sessionStorage', async ({
    page,
  }) => {
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Book a sacrament', exact: true }).click();
    const parishChip2 = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await parishChip2.isVisible({ timeout: 1500 }).catch(() => false)) {
      await parishChip2.click();
    }
    await panel.getByRole('button', { name: 'Blessing', exact: true }).click();

    const dateChip = panel.locator('[data-testid^="date-chip-"]').first();
    await expect(dateChip).toBeVisible();
    const selectedDate = await dateChip.getAttribute('data-date');
    await dateChip.click();

    const timeChip = panel.locator('[data-testid^="time-chip-"]').first();
    await expect(timeChip).toBeVisible();
    const selectedTime = await timeChip.getAttribute('data-time');
    await timeChip.click();

    // We are now at the preferred priest step
    await expect(panel.locator('[data-testid="priest-chip-any"]')).toBeVisible({ timeout: 10000 });

    // REFRESH PAGE MID-FLOW
    await page.reload();

    // Reopen assistant if needed
    const reopenBtn = page.locator('[data-testid="parish-assistant-button"]');
    if (await reopenBtn.isVisible()) {
      await reopenBtn.click();
    }
    const refreshedPanel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(refreshedPanel).toBeVisible();

    // Verify the priest chips are still displayed (progress preserved!)
    const priestChipAny = refreshedPanel.locator('[data-testid="priest-chip-any"]');
    await expect(priestChipAny).toBeVisible({ timeout: 10000 });
    await priestChipAny.click();

    // Continue to notes and summary
    const skipNotesChip = refreshedPanel.locator('[data-testid="notes-chip-skip"]');
    await expect(skipNotesChip).toBeVisible();
    await skipNotesChip.click();

    const summaryCard = refreshedPanel.locator('[data-testid="booking-summary-card"]');
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toContainText('Blessing');
    if (selectedDate) {
      await expect(summaryCard.locator('[data-testid="summary-date"]')).toHaveAttribute('data-date', selectedDate);
    }

    // Confirm booking
    await refreshedPanel.locator('[data-testid="booking-confirm-button"]').click();
    await expect(refreshedPanel.locator('[data-testid="booking-success-card"]')).toBeVisible({ timeout: 15000 });

    // Verify database row created with the preserved date and time
    const db = serviceClient();
    const seed = await getSeed();
    const { data: appts } = await db
      .from('appointments')
      .select('*')
      .eq('user_id', seed.ids.parishioner)
      .eq('church_id', seed.churchId);

    expect(appts).toHaveLength(1);
    expect(appts![0].service_type).toBe('Blessing');
    expect(appts![0].appointment_date).toBe(selectedDate);
    if (selectedTime) {
      expect(appts![0].appointment_time.slice(0, 5)).toBe(selectedTime.slice(0, 5));
    }
  });

  test('Test 4: Double-clicking Confirm creates exactly ONE appointment', async ({
    page,
  }) => {
    const seed = await getSeed();

    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Book a sacrament', exact: true }).click();
    const parishChip2 = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await parishChip2.isVisible({ timeout: 1500 }).catch(() => false)) {
      await parishChip2.click();
    }
    await panel.getByRole('button', { name: 'Blessing', exact: true }).click();

    const dateChip = panel.locator('[data-testid^="date-chip-"]').first();
    await expect(dateChip).toBeVisible();
    await dateChip.click();

    const timeChip = panel.locator('[data-testid^="time-chip-"]').first();
    await expect(timeChip).toBeVisible();
    await timeChip.click();

    const priestChipAny = panel.locator('[data-testid="priest-chip-any"]');
    await expect(priestChipAny).toBeVisible();
    await priestChipAny.click();

    const skipNotesChip = panel.locator('[data-testid="notes-chip-skip"]');
    await expect(skipNotesChip).toBeVisible();
    await skipNotesChip.click();

    const confirmBtn = panel.locator('[data-testid="booking-confirm-button"]');
    await expect(confirmBtn).toBeVisible();

    // Rapid double-click on Confirm Booking
    await Promise.all([
      confirmBtn.click({ force: true, noWaitAfter: true }),
      confirmBtn.click({ force: true, noWaitAfter: true }),
    ]);

    // Wait for success card
    await expect(panel.locator('[data-testid="booking-success-card"]')).toBeVisible({ timeout: 15000 });

    // Assert database has EXACTLY ONE appointment
    const db = serviceClient();
    const { data: appts, error } = await db
      .from('appointments')
      .select('id')
      .eq('user_id', seed.ids.parishioner)
      .eq('church_id', seed.churchId);

    expect(error).toBeNull();
    expect(appts).toHaveLength(1);
  });
});

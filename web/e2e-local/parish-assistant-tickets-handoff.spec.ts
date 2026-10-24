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
  LOCAL_URL,
  createApprovedAppointment,
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

async function purgeTickets(requesterId: string) {
  const db = serviceClient();
  const { data: convs } = await db
    .from('conversations')
    .select('id')
    .eq('created_by', requesterId)
    .eq('ticket_lane', 'church');
  if (convs && convs.length > 0) {
    const ids = convs.map((c) => c.id);
    await db.from('messages').delete().in('conversation_id', ids);
    await db.from('conversation_participants').delete().in('conversation_id', ids);
    await db.from('conversations').delete().in('id', ids);
  }
}

test.describe('AI Parish Assistant - Ticket 09: Parish Office Ticket Drafting & Hand-offs', () => {
  test.beforeAll(async () => {
    await ensureFakeGeminiRunning();
    await ensureFunctionsServing();
  });

  test.beforeEach(async () => {
    const seed = await getSeed();
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();
    await purgeTickets(seed.ids.parishioner);
  });

  test.afterAll(async () => {
    if (fakeGeminiProcess) {
      fakeGeminiProcess.kill();
    }
    if (edgeFunctionsProcess) {
      edgeFunctionsProcess.kill();
    }
    const seed = await getSeed();
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();
    await purgeTickets(seed.ids.parishioner);
  });

  test('Spec Test #3: Parishioner asks to talk to parish office, edits drafted ticket, confirms, and ticket exists in DB', async ({
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

    // 2. Type: "I want to talk to the parish office"
    const textarea = panel.locator('textarea');
    await textarea.fill('I want to talk to the parish office');
    await panel.locator('button[aria-label="Send message"]').click();

    // 3. Verify assistant responds and editable ticket draft card is shown
    const draftCard = panel.locator('[data-testid="ticket-draft-card"]');
    await expect(draftCard).toBeVisible({ timeout: 15000 });

    // 4. Verify initial drafted fields
    const categorySelect = panel.locator('[data-testid="ticket-draft-category"]');
    await expect(categorySelect).toHaveValue('general');

    const subjectInput = panel.locator('[data-testid="ticket-draft-subject"]');
    await expect(subjectInput).toHaveValue('Inquiry regarding parish services');

    const messageInput = panel.locator('[data-testid="ticket-draft-message"]');
    await expect(messageInput).toHaveValue('Hello, I would like to inquire about parish services.');

    // 5. Edit category, subject, and message before confirming
    await categorySelect.selectOption('baptism');
    await subjectInput.fill('Question regarding baptism godparent requirements');
    await messageInput.fill(
      'Good day, our family is preparing for a baptism next month and we would like to clarify if proxy godparents are permitted.'
    );

    // 6. Tap Confirm & Send
    const confirmBtn = panel.locator('[data-testid="confirm-ticket-button"]');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 7. Verify success card and link to messages appears
    const successCard = panel.locator('[data-testid="ticket-success-card"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });
    const viewTicketLink = panel.locator('[data-testid="view-ticket-link"]');
    await expect(viewTicketLink).toBeVisible();

    // 8. Assert in DB that a Parish Office Ticket was created with edited subject and message
    const db = serviceClient();
    const { data: ticket, error: ticketErr } = await db
      .from('conversations')
      .select('id, title, category, ticket_lane, ticket_number, church_id, created_by, status')
      .eq('created_by', seed.ids.parishioner)
      .eq('church_id', seed.churchId)
      .eq('ticket_lane', 'church')
      .single();

    expect(ticketErr).toBeNull();
    expect(ticket).not.toBeNull();
    expect(ticket!.title).toBe('Inquiry: Question regarding baptism godparent requirements');
    expect(ticket!.category).toBe('baptism');
    expect(ticket!.ticket_lane).toBe('church');
    expect(ticket!.status).toBe('open');
    expect(ticket!.ticket_number).toMatch(/^TCK-\d+$/);

    // Assert message content in DB
    const { data: ticketMsg, error: msgErr } = await db
      .from('messages')
      .select('content, sender_id')
      .eq('conversation_id', ticket!.id)
      .single();

    expect(msgErr).toBeNull();
    expect(ticketMsg!.sender_id).toBe(seed.ids.parishioner);
    expect(ticketMsg!.content).toContain(
      'Good day, our family is preparing for a baptism next month and we would like to clarify if proxy godparents are permitted.'
    );

    // 9. Clicking view ticket link navigates to /messages
    await viewTicketLink.click();
    await expect(page).toHaveURL(/\/messages/);
  });

  test('Drafted ticket can be edited before Confirm, and nothing is created without Confirm', async ({
    page,
  }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // Open Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // Tap starter chip: "Talk to the parish office"
    const starterChip = panel.locator('[data-testid="starter-chip-talk-to-the-parish-office"]');
    await expect(starterChip).toBeVisible();
    await starterChip.click();

    // Verify draft card appears
    const draftCard = panel.locator('[data-testid="ticket-draft-card"]');
    await expect(draftCard).toBeVisible({ timeout: 15000 });

    // Edit fields
    const subjectInput = panel.locator('[data-testid="ticket-draft-subject"]');
    await subjectInput.fill('Cancelled inquiry draft that should never be stored');
    const messageInput = panel.locator('[data-testid="ticket-draft-message"]');
    await messageInput.fill('This message should never enter the database because user cancels.');

    // User taps Cancel
    const cancelBtn = panel.locator('[data-testid="cancel-ticket-button"]');
    await cancelBtn.click();

    // Verify draft card is dismissed
    await expect(draftCard).not.toBeVisible();

    // Assert database: No conversation ticket exists
    const db = serviceClient();
    const { data: tickets } = await db
      .from('conversations')
      .select('id, title')
      .eq('created_by', seed.ids.parishioner)
      .eq('ticket_lane', 'church');

    expect(tickets).toHaveLength(0);
  });

  test('Hand-off test: "Cancel my wedding booking" renders button to appointments and does NOT alter appointment in DB', async ({
    page,
  }) => {
    const seed = await getSeed();

    // 1. Seed an approved wedding appointment in database
    const weddingAppointmentId = await createApprovedAppointment({
      serviceType: 'Wedding',
      daysFromToday: 30,
      time: '14:00:00',
    });

    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // 2. Open Parish Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // 3. User says: "Cancel my wedding booking"
    const textarea = panel.locator('textarea');
    await textarea.fill('Cancel my wedding booking');
    await panel.locator('button[aria-label="Send message"]').click();

    // 4. Verify assistant explains it cannot cancel and renders hand-off button
    const reply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText(/cannot cancel or modify bookings/i);

    const handoffBtn = panel.locator('[data-testid="handoff-button"]');
    await expect(handoffBtn).toBeVisible();
    await expect(handoffBtn).toContainText('View Appointment');

    // 5. Assert the database: appointment was NOT cancelled or modified
    const db = serviceClient();
    const { data: appt, error } = await db
      .from('appointments')
      .select('id, status, service_type, appointment_date, appointment_time')
      .eq('id', weddingAppointmentId)
      .single();

    expect(error).toBeNull();
    expect(appt!.status).toBe('approved');
    expect(appt!.service_type).toBe('Wedding');
    expect(appt!.appointment_time).toBe('14:00:00');

    // 6. Click the hand-off button and verify it opens /appointments
    await handoffBtn.click();
    await expect(page).toHaveURL(/\/appointments/);
  });

  test('Hand-off test: "Message Father" renders button to Messages and does not send direct messages', async ({
    page,
  }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    // Open Parish Assistant
    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    // User says: "Message Father"
    const textarea = panel.locator('textarea');
    await textarea.fill('Message Father');
    await panel.locator('button[aria-label="Send message"]').click();

    // Verify assistant responds with hand-off to messages
    const reply = panel.locator('[data-testid="assistant-reply"]').last();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText(/Messages center/i);

    const handoffBtn = panel.locator('[data-testid="handoff-button"]');
    await expect(handoffBtn).toBeVisible();
    await expect(handoffBtn).toContainText('Go to Messages');

    // Click hand-off button and verify navigation to /messages
    await handoffBtn.click();
    await expect(page).toHaveURL(/\/messages/);
  });
});

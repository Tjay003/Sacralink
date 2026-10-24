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

async function setupBaptismRequirements(churchId: string) {
  const db = serviceClient();
  const { data: service, error: sErr } = await db
    .from('church_service_types')
    .select('id')
    .eq('church_id', churchId)
    .eq('name', 'Baptism')
    .single();

  if (sErr || !service) throw new Error('Baptism service not found in seeded church');

  // Clear existing requirements for Baptism
  await db.from('sacrament_requirements').delete().eq('service_type_id', service.id);

  // Insert:
  // 1. Birth Certificate (required, allowed: pdf, png, jpg)
  // 2. Godparent Certificate (optional, allowed: pdf)
  const { data: reqs, error: rErr } = await db.from('sacrament_requirements').insert([
    {
      church_id: churchId,
      service_type_id: service.id,
      service_type: 'baptism',
      requirement_name: 'Birth Certificate',
      description: 'PSA or Local Civil Registrar Birth Certificate',
      is_required: true,
      allowed_file_types: ['pdf', 'png', 'jpg'],
      display_order: 1,
    },
    {
      church_id: churchId,
      service_type_id: service.id,
      service_type: 'baptism',
      requirement_name: 'Godparent Certificate',
      description: 'Confirmation or Catholic Marriage certificate',
      is_required: false,
      allowed_file_types: ['pdf'],
      display_order: 2,
    },
  ]).select();

  if (rErr || !reqs) throw rErr;

  return {
    serviceId: service.id,
    birthCertReq: reqs.find((r) => r.requirement_name === 'Birth Certificate')!,
    godparentReq: reqs.find((r) => r.requirement_name === 'Godparent Certificate')!,
  };
}

test.describe('AI Parish Assistant - Ticket 07: Document Upload Cards in Chat', () => {
  let seededReqs: {
    serviceId: string;
    birthCertReq: { id: string; requirement_name: string; is_required: boolean | null; allowed_file_types: string[] | null };
    godparentReq: { id: string; requirement_name: string; is_required: boolean | null; allowed_file_types: string[] | null };
  };

  test.beforeAll(async () => {
    await ensureFakeGeminiRunning();
    await ensureFunctionsServing();
  });

  test.beforeEach(async () => {
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();

    const seed = await getSeed();
    seededReqs = await setupBaptismRequirements(seed.churchId);
  });

  test.afterAll(async () => {
    if (fakeGeminiProcess) {
      fakeGeminiProcess.kill();
    }
    if (edgeFunctionsProcess) {
      edgeFunctionsProcess.kill();
    }
    const seed = await getSeed();
    const db = serviceClient();
    await db.from('sacrament_requirements').delete().eq('church_id', seed.churchId);
    await resetAppointmentData();
    await resetPriestAvailability();
    await resetMassSchedules();
    await resetChurchChatLogs();
  });

  test('Test 1: Book Baptism with upload cards, disabled Confirm when required document is missing, and database verification', async ({
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

    // 2. Tap starter chip: "Book a sacrament"
    const bookChip = panel.getByRole('button', { name: 'Book a sacrament', exact: true });
    await expect(bookChip).toBeVisible();
    await bookChip.click();

    // If prompted to pick a parish, select Local Test Parish
    const localParishChip = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await localParishChip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await localParishChip.click();
    }

    // 3. Step: Service selection - tap "Baptism" chip
    const baptismChip = panel.getByRole('button', { name: 'Baptism', exact: true });
    await expect(baptismChip).toBeVisible({ timeout: 10000 });
    await baptismChip.click();

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

    // 7. Step: Document Upload Cards should be displayed!
    const uploadCardsContainer = panel.locator('[data-testid="document-upload-cards"]');
    await expect(uploadCardsContainer).toBeVisible({ timeout: 10000 });

    // Verify requirement cards, names, and badges
    const birthCard = panel.locator(`[data-testid="document-card-${seededReqs.birthCertReq.id}"]`);
    await expect(birthCard).toBeVisible();
    await expect(birthCard).toContainText('Birth Certificate');
    await expect(birthCard).toContainText('Required');

    const godparentCard = panel.locator(`[data-testid="document-card-${seededReqs.godparentReq.id}"]`);
    await expect(godparentCard).toBeVisible();
    await expect(godparentCard).toContainText('Godparent Certificate');
    await expect(godparentCard).toContainText('Optional');

    // Verify file chooser accepts appropriate file types
    const birthFileInput = panel.locator(`[data-testid="document-input-${seededReqs.birthCertReq.id}"]`);
    const birthAccept = await birthFileInput.getAttribute('accept');
    expect(birthAccept).toContain('.pdf');
    expect(birthAccept).toContain('.png');
    expect(birthAccept).toContain('.jpg');

    const godparentFileInput = panel.locator(`[data-testid="document-input-${seededReqs.godparentReq.id}"]`);
    const godparentAccept = await godparentFileInput.getAttribute('accept');
    expect(godparentAccept).toBe('.pdf');

    // 8. Verify Confirm button is disabled while a required document is missing
    const continueBtn = panel.locator('[data-testid="documents-continue-button"]');
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Tap "No notes / Skip" to reach Summary Card
    const skipNotesChip = panel.locator('[data-testid="notes-chip-skip"]');
    await expect(skipNotesChip).toBeVisible({ timeout: 10000 });
    await skipNotesChip.click();

    // Assert Summary Card is visible
    const summaryCard = panel.locator('[data-testid="booking-summary-card"]');
    await expect(summaryCard).toBeVisible({ timeout: 10000 });
    await expect(summaryCard).toContainText('Baptism');

    // Assert Confirm button is DISABLED because Birth Certificate is missing
    const confirmBtn = panel.locator('[data-testid="booking-confirm-button"]');
    await expect(confirmBtn).toBeDisabled();

    // Assert warning naming the missing requirement
    const warning = panel.locator('[data-testid="missing-documents-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Missing required document: Birth Certificate');

    // 9. Attach the required document using the navigation link on the summary card
    const attachLink = panel.locator('[data-testid="summary-goto-documents-button"]');
    await expect(attachLink).toBeVisible();
    await attachLink.click();

    // Document upload cards are visible again
    await expect(uploadCardsContainer).toBeVisible();

    // Attach valid file to Birth Certificate
    await birthFileInput.setInputFiles({
      name: 'birth_certificate.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 sample birth certificate pdf content'),
    });

    // Verify file is attached on the card with file name, replace, and remove options
    const birthAttached = panel.locator(`[data-testid="document-attached-${seededReqs.birthCertReq.id}"]`);
    await expect(birthAttached).toBeVisible();
    await expect(panel.locator(`[data-testid="document-name-${seededReqs.birthCertReq.id}"]`)).toContainText('birth_certificate.pdf');
    await expect(panel.locator(`[data-testid="document-replace-${seededReqs.birthCertReq.id}"]`)).toBeVisible();
    await expect(panel.locator(`[data-testid="document-remove-${seededReqs.birthCertReq.id}"]`)).toBeVisible();

    // Keep Godparent Certificate (optional) unattached to verify optional docs do not block
    await continueBtn.click();
    await skipNotesChip.click();

    // 10. Summary Card: Verify Confirm is now ENABLED
    await expect(summaryCard).toBeVisible();
    await expect(panel.locator('[data-testid="missing-documents-warning"]')).toHaveCount(0);
    await expect(confirmBtn).toBeEnabled();
    await expect(panel.locator('[data-testid="summary-documents"]')).toContainText('1 document attached');

    // 11. Tap Confirm
    await confirmBtn.click();

    // 12. Assert Success Confirmation Card
    const successCard = panel.locator('[data-testid="booking-success-card"]');
    await expect(successCard).toBeVisible({ timeout: 15000 });

    // 13. Database Assertions
    const db = serviceClient();
    const { data: appts, error: apptErr } = await db
      .from('appointments')
      .select('*')
      .eq('user_id', seed.ids.parishioner)
      .eq('church_id', seed.churchId);

    expect(apptErr).toBeNull();
    expect(appts).toHaveLength(1);

    const appt = appts![0];
    expect(appt.service_type).toBe('Baptism');
    expect(appt.status).toBe('pending');
    expect(appt.priest_id).toBeNull();
    expect(appt.requested_priest_id).toBe(seed.ids.priest);
    expect(appt.appointment_date).toBe(selectedDate);
    if (selectedTime) {
      expect(appt.appointment_time.slice(0, 5)).toBe(selectedTime.slice(0, 5));
    }

    // Assert uploaded document record in appointment_documents table
    const { data: docs, error: docErr } = await db
      .from('appointment_documents')
      .select('*')
      .eq('appointment_id', appt.id);

    expect(docErr).toBeNull();
    expect(docs).toHaveLength(1);
    expect(docs![0].requirement_id).toBe(seededReqs.birthCertReq.id);
    expect(docs![0].file_name).toBe('birth_certificate.pdf');
    expect(docs![0].file_url).toContain('appointment-documents');
  });

  test('Test 2: Replace and remove documents in upload cards', async ({ page }) => {
    const seed = await getSeed();

    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');

    const assistantBtn = page.locator('[data-testid="parish-assistant-button"]');
    await expect(assistantBtn).toBeVisible({ timeout: 10000 });
    await assistantBtn.click();

    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    const bookChip = panel.getByRole('button', { name: 'Book a sacrament', exact: true });
    await expect(bookChip).toBeVisible();
    await bookChip.click();

    const localParishChip = panel.getByRole('button', { name: 'Local Test Parish', exact: true });
    if (await localParishChip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await localParishChip.click();
    }

    // Select Baptism -> Date -> Time -> Priest
    await panel.getByRole('button', { name: 'Baptism', exact: true }).click();
    await panel.locator('[data-testid^="date-chip-"]').first().click();
    await panel.locator('[data-testid^="time-chip-"]').first().click();
    await panel.locator(`[data-testid="priest-chip-${seed.ids.priest}"]`).click();

    const birthFileInput = panel.locator(`[data-testid="document-input-${seededReqs.birthCertReq.id}"]`);
    await expect(birthFileInput).toBeAttached();

    // Attach initial file
    await birthFileInput.setInputFiles({
      name: 'initial_file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 file 1'),
    });

    const birthAttached = panel.locator(`[data-testid="document-attached-${seededReqs.birthCertReq.id}"]`);
    await expect(birthAttached).toBeVisible();
    await expect(panel.locator(`[data-testid="document-name-${seededReqs.birthCertReq.id}"]`)).toContainText('initial_file.pdf');

    // Remove file
    const removeBtn = panel.locator(`[data-testid="document-remove-${seededReqs.birthCertReq.id}"]`);
    await removeBtn.click();

    // Verify upload button reappears
    await expect(birthAttached).toHaveCount(0);
    const uploadBtn = panel.locator(`[data-testid="document-upload-button-${seededReqs.birthCertReq.id}"]`);
    await expect(uploadBtn).toBeVisible();

    // Re-attach new file
    await birthFileInput.setInputFiles({
      name: 'replacement_file.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake png image buffer'),
    });

    await expect(birthAttached).toBeVisible();
    await expect(panel.locator(`[data-testid="document-name-${seededReqs.birthCertReq.id}"]`)).toContainText('replacement_file.png');
  });
});

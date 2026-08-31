import { test, expect } from '@playwright/test';
import { authenticateAs, MOCK_CHURCHES, MOCK_PARISH_APPLICATIONS } from './helpers/mockAuth';

test.describe('Parish Verification & Donation Gate', () => {
  test('1. Submits parish onboarding application with mandatory credentials', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await page.goto('/churches/apply');
    await page.waitForLoadState('networkidle');

    // Verify page header and sections
    await expect(page.getByRole('heading', { name: 'Parish Onboarding Application' })).toBeVisible();
    await expect(page.getByText('1. Parish Information')).toBeVisible();
    await expect(page.getByText('2. Geographical Location')).toBeVisible();
    await expect(page.getByText('4. Mandatory Verification Credentials')).toBeVisible();

    // Fill parish details
    await page.locator('input[placeholder="e.g., St. Joseph the Worker Parish"]').fill('St. Anthony of Padua Parish');
    await page.locator('input[placeholder="e.g., Tungkong Mangga, City of San Jose del Monte, Bulacan"]').fill('Brgy. Kaypian, City of San Jose del Monte, Bulacan');
    await page.locator('input[placeholder*="(044) 123-4567"]').fill('(044) 798-1122');
    await page.locator('input[placeholder="e.g., parish.office@diocese.ph"]').fill('stanthony@diocese.ph');

    // Create and attach mock credential files
    const mockFileBuffer = Buffer.from('Mock PDF Content for Clergy Credential');
    const celebretInput = page.locator('input[type="file"]').first();
    const decreeInput = page.locator('input[type="file"]').nth(1);

    await celebretInput.setInputFiles({
      name: 'cbcp-celebret-card.pdf',
      mimeType: 'application/pdf',
      buffer: mockFileBuffer,
    });

    await decreeInput.setInputFiles({
      name: 'chancery-appointment-decree.pdf',
      mimeType: 'application/pdf',
      buffer: mockFileBuffer,
    });

    // Verify file attachments show in UI
    await expect(page.getByText('cbcp-celebret-card.pdf')).toBeVisible();
    await expect(page.getByText('chancery-appointment-decree.pdf')).toBeVisible();

    // Submit form
    const submitBtn = page.getByRole('button', { name: 'Submit Verification Application' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success confirmation screen
    await expect(page.getByRole('heading', { name: 'Application Submitted Successfully' })).toBeVisible();
    await expect(page.getByText('Diocese Chancery Super Admin queue')).toBeVisible();
  });

  test('2. Cashless donations are strictly locked on unverified churches', async ({ page }) => {
    await authenticateAs(page, 'parishioner');

    // Mock specific unverified church route response
    await page.route('**/rest/v1/churches*id=eq.church-unverified-1*', async (route) => {
      const unverifiedChurch = MOCK_CHURCHES.find((c) => c.id === 'church-unverified-1');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([unverifiedChurch]),
      });
    });

    await page.goto('/churches/church-unverified-1');
    await page.waitForLoadState('networkidle');

    // Verify Verification Pending badge in header
    await expect(page.getByText('Verification Pending').first()).toBeVisible();

    // Verify prominent donation gate banner
    await expect(page.getByText('Cashless Donations Locked — Verification Pending')).toBeVisible();
    await expect(page.getByText('Anti-Fraud Gate')).toBeVisible();
    await expect(page.getByText('cashless donations (GCash/Maya) and QR code displays are locked')).toBeVisible();

    // Top action donate button is locked
    const lockedBtn = page.getByRole('button', { name: 'Locked' });
    await expect(lockedBtn).toBeVisible();
    await expect(lockedBtn).toBeDisabled();
  });

  test('3. Super Admin reviews queue, inspects documents, and completes anti-fraud checklist to approve parish', async ({ page }) => {
    await authenticateAs(page, 'super_admin');
    await page.goto('/admin/applications');
    await page.waitForLoadState('networkidle');

    // Verify review queue page
    await expect(page.getByRole('heading', { name: 'Parish Verification Applications' })).toBeVisible();
    await expect(page.getByText('St. Vincent Ferrer Parish')).toBeVisible();
    await expect(page.getByText('Pending Review').first()).toBeVisible();

    // Open review modal
    const reviewBtn = page.getByRole('button', { name: 'Review & Verify' }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Verify modal content & document links
    await expect(page.getByRole('heading', { name: /Verification Review: St. Vincent Ferrer Parish/i })).toBeVisible();
    await expect(page.getByText('CBCP Clergy ID / Celebret')).toBeVisible();
    await expect(page.getByText('Chancery Appointment Decree')).toBeVisible();

    // Verify and check all 3 anti-fraud checklist items
    const rectoryCheck = page.getByLabel(/Rectory Phone Call Confirmed with Chancery/i);
    const celebretCheck = page.getByLabel(/CBCP Clergy ID \/ Celebret Verified with Diocese Roster/i);
    const merchantCheck = page.getByLabel(/Merchant Name \/ GCash \/ Maya Matches Legal Parish Entity/i);

    await rectoryCheck.check();
    await celebretCheck.check();
    await merchantCheck.check();

    expect(await rectoryCheck.isChecked()).toBe(true);
    expect(await celebretCheck.isChecked()).toBe(true);
    expect(await merchantCheck.isChecked()).toBe(true);

    // Enter Chancery review notes
    const notesInput = page.getByPlaceholder('Record verification notes, diocese call log, or specific remarks...');
    await notesInput.fill('Chancery confirmed rectory landline call with Fr. Admin. Celebret faculty active in Diocese registry.');

    // Approve parish application
    const approveBtn = page.getByRole('button', { name: 'Approve & Activate Parish' });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Modal closes after approval
    await expect(page.getByRole('heading', { name: /Verification Review: St. Vincent Ferrer Parish/i })).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { lintKnowledgeSection } from '../src/utils/knowledgeLinter';
import { getSeed, loginAs, serviceClient } from './support';

test.describe('Ticket 02: Knowledge Discrepancy Linter (Pure Utility)', () => {
  test('detects Mass schedule patterns accurately', () => {
    const testCases = [
      { text: 'Sunday Mass at 7:00 AM', expectedType: 'mass_schedule' },
      { text: 'Weekday Mass 6pm', expectedType: 'mass_schedule' },
      { text: 'Misa ng Linggo 8:00 AM', expectedType: 'mass_schedule' },
      { text: 'Sunday mass at 6am', expectedType: 'mass_schedule' },
      { text: 'Sunday Mass: 6am and 8am', expectedType: 'mass_schedule' },
      { text: 'Daily Mass 6:30am', expectedType: 'mass_schedule' },
      { text: 'Anticipated Mass 5:00 PM', expectedType: 'mass_schedule' },
      { text: 'Mass schedule for holy days', expectedType: 'mass_schedule' },
      { text: '7:00 am mass is available', expectedType: 'mass_schedule' },
      { text: 'Misa sa Sabado 6pm', expectedType: 'mass_schedule' },
    ];

    for (const { text, expectedType } of testCases) {
      const result = lintKnowledgeSection('Schedule Notes', text);
      expect(result.hasWarnings).toBe(true);
      expect(result.issues.some((i) => i.type === expectedType)).toBe(true);
      expect(result.issues[0].suggestion).toContain('Liturgy');
    }
  });

  test('detects fee and payment amount patterns accurately', () => {
    const testCases = [
      { text: '₱500 fee', expectedType: 'service_fee' },
      { text: 'Php 1,500 donation', expectedType: 'service_fee' },
      { text: 'wedding fee 5000 pesos', expectedType: 'service_fee' },
      { text: 'Fee: 500 pesos', expectedType: 'service_fee' },
      { text: 'Bayad: 200', expectedType: 'service_fee' },
      { text: 'Stipend amounting to 1000 pesos', expectedType: 'service_fee' },
      { text: 'Suggested donation is Php 500', expectedType: 'service_fee' },
      { text: 'Total charge: ₱2,500.00', expectedType: 'service_fee' },
    ];

    for (const { text, expectedType } of testCases) {
      const result = lintKnowledgeSection('Payment Information', text);
      expect(result.hasWarnings).toBe(true);
      expect(result.issues.some((i) => i.type === expectedType)).toBe(true);
      expect(result.issues[0].suggestion).toContain('Services');
    }
  });

  test('yields zero warnings on safe pastoral policies and text', () => {
    const safeTexts = [
      'Proper attire required: avoid sleeveless shirts',
      'Godparents must be at least 16 years old and confirmed Catholics',
      'The parish was founded in 1954 and serves 10,000 parishioners.',
      'Office hours: Monday to Friday from 8:00 AM to 5:00 PM.',
      'Bring 2 valid IDs and 3 photocopies of the birth certificate.',
      'Baptism seminars are held on the 1st and 3rd Saturdays of the month.',
      'Children under 7 years old do not need to register separately.',
      'Parish office is closed during national holidays.',
    ];

    for (const text of safeTexts) {
      const result = lintKnowledgeSection('Parish Guidelines', text);
      expect(result.hasWarnings).toBe(false);
      expect(result.issues).toHaveLength(0);
    }
  });

  test('handles empty or blank inputs without errors', () => {
    expect(lintKnowledgeSection('', '').hasWarnings).toBe(false);
    expect(lintKnowledgeSection('   ', '   ').hasWarnings).toBe(false);
    expect(lintKnowledgeSection('Clean Title', '').hasWarnings).toBe(false);
  });
});

test.describe('Ticket 02: Knowledge Base Page Linter & Confirmation Modal E2E', () => {
  const TEST_TITLE = 'E2E Linter Test Section';

  test.beforeEach(async () => {
    const seed = await getSeed();
    const db = serviceClient();
    await db.from('church_knowledge_sections').delete().eq('church_id', seed.churchId).ilike('title', `${TEST_TITLE}%`);
  });

  test.afterAll(async () => {
    const seed = await getSeed();
    const db = serviceClient();
    await db.from('church_knowledge_sections').delete().eq('church_id', seed.churchId).ilike('title', `${TEST_TITLE}%`);
  });

  test('shows real-time warning box, intercepts save with modal, and allows Proceed Anyway', async ({ page }) => {
    // Intercept sync API calls to return immediately
    await page.route('**/functions/v1/sync-church-knowledge', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, chunksProcessed: 1 }),
      })
    );

    await loginAs(page, 'church_admin');
    await page.goto('/knowledge');

    // 1. Open new section editor
    const addSectionBtn = page.getByRole('button', { name: /Add (First )?Section/i });
    await expect(addSectionBtn).toBeVisible({ timeout: 10000 });
    await addSectionBtn.click();

    const titleInput = page.getByPlaceholder(/Section title/i);
    const contentInput = page.getByPlaceholder(/Paste or type your church information/i);
    await expect(titleInput).toBeVisible();

    // 2. Type safe pastoral policy first -> assert NO warning box
    await titleInput.fill(`${TEST_TITLE} - Safe`);
    await contentInput.fill('Proper attire required: please avoid sleeveless shirts and wear respectful clothing.');
    const warningBox = page.locator('[data-testid="knowledge-lint-warning"]');
    await expect(warningBox).not.toBeVisible();

    // 3. Type hardcoded Mass schedule and fee -> assert warning box appears
    await titleInput.fill(TEST_TITLE);
    await contentInput.fill('Sunday mass at 6am. The sacrament fee is 500 pesos.');
    await expect(warningBox).toBeVisible();
    await expect(warningBox).toContainText('Hardcoded Mass schedule or fee detected');
    await expect(warningBox).toContainText('Sunday mass at 6am');

    // 4. Click Save Section -> modal intercepts
    const saveButton = page.getByRole('button', { name: 'Save Section' });
    await saveButton.click();

    const modalTitle = page.getByText('Discrepancy Warning');
    await expect(modalTitle).toBeVisible();
    await expect(page.getByText('This section contains hardcoded schedules or fees')).toBeVisible();

    // 5. Test "Review & Edit" (cancel button) -> closes modal, stays on form
    const reviewBtn = page.getByRole('button', { name: 'Review & Edit' });
    await reviewBtn.click();
    await expect(modalTitle).not.toBeVisible();
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(TEST_TITLE);

    // 6. Click Save Section again -> click "Proceed Anyway"
    await saveButton.click();
    await expect(modalTitle).toBeVisible();

    const proceedBtn = page.getByRole('button', { name: 'Proceed Anyway' });
    await proceedBtn.click();

    // 7. Verify section was successfully saved in the knowledge base table
    await expect(modalTitle).not.toBeVisible();
    await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 10000 });

    // 8. Test Edit mode warning box & confirmation flow
    // Find section row and click Edit (Pencil button)
    const sectionRow = page.locator('div', { hasText: TEST_TITLE }).first();
    const editBtn = sectionRow.locator('button[title="Edit section"]').first();
    await editBtn.click();

    // Edit content with a new fee pattern
    const editContentInput = page.locator('textarea');
    await editContentInput.fill('Updated note: wedding fee 5000 pesos.');
    await expect(page.locator('[data-testid="knowledge-lint-warning"]')).toBeVisible();

    // Save changes
    const saveChangesBtn = page.getByRole('button', { name: 'Save Changes' });
    await saveChangesBtn.click();
    await expect(page.getByText('Discrepancy Warning')).toBeVisible();

    // Proceed anyway
    await page.getByRole('button', { name: 'Proceed Anyway' }).click();
    await expect(page.getByText('Discrepancy Warning')).not.toBeVisible();
    await expect(page.getByText(TEST_TITLE)).toBeVisible();
  });
});

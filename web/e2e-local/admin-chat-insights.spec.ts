import { test, expect } from '@playwright/test';
import { getSeed, loginAs, serviceClient } from './support';

test.describe('Ticket 05: Admin Chat Inquiry Insights & 1-Click FAQ Generator', () => {
  const TEST_QUESTION = 'Can we rent the parish hall for receptions?';
  const TEST_ANSWER =
    'I do not have information about parish hall rentals. Please contact the parish office.';
  let seededLogId: string | null = null;
  let churchId: string;

  test.beforeEach(async () => {
    const seed = await getSeed();
    churchId = seed.churchId;
    const db = serviceClient();

    // Clean up any test sections
    await db
      .from('church_knowledge_sections')
      .delete()
      .eq('church_id', churchId)
      .ilike('title', '%Parish Hall Rentals%');

    // Clean up any matching test chat logs
    await db
      .from('church_chat_logs')
      .delete()
      .eq('church_id', churchId)
      .eq('question', TEST_QUESTION);

    // Seed mock unanswered inquiry
    const { data, error } = await db
      .from('church_chat_logs')
      .insert({
        church_id: churchId,
        user_id: seed.ids.parishioner,
        question: TEST_QUESTION,
        answer: TEST_ANSWER,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to seed mock inquiry: ${error.message}`);
    }
    seededLogId = data.id;
  });

  test.afterAll(async () => {
    const seed = await getSeed();
    const db = serviceClient();
    await db
      .from('church_knowledge_sections')
      .delete()
      .eq('church_id', seed.churchId)
      .ilike('title', '%Parish Hall Rentals%');

    if (seededLogId) {
      await db.from('church_chat_logs').delete().eq('id', seededLogId);
    }
  });

  test('surfaces unanswered inquiries, allows 1-click FAQ conversion, and persists to knowledge sections', async ({
    page,
  }) => {
    // Intercept sync edge function to return immediately
    await page.route('**/functions/v1/sync-church-knowledge', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, chunksProcessed: 1 }),
      })
    );

    // 1. Log in as Church Admin for Church A
    await loginAs(page, 'church_admin');
    await page.goto('/knowledge');

    // 2. Check tab exists with badge and click "Inquiry Insights & Gaps" tab
    const insightsTab = page.getByRole('button', { name: /Inquiry Insights/i });
    await expect(insightsTab).toBeVisible({ timeout: 10000 });
    await insightsTab.click();

    // 3. Assert the hall rental inquiry appears under "Unanswered Questions"
    const sectionHeading = page.getByRole('heading', { name: /Unanswered Questions/i });
    await expect(sectionHeading).toBeVisible();

    const questionText = page.getByText(`"${TEST_QUESTION}"`);
    await expect(questionText).toBeVisible();

    const answerSnippet = page.getByText(`"${TEST_ANSWER}"`);
    await expect(answerSnippet).toBeVisible();

    // 4. Click "✨ Convert to FAQ"
    const convertBtn = page.getByRole('button', { name: /Convert to FAQ/i }).first();
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    // 5. Assert the section editor opens in "Knowledge Sections" tab with pre-filled title and template
    const titleInput = page.getByPlaceholder(/Section title/i);
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(/Parish Hall Rentals/i);

    const contentInput = page.getByPlaceholder(/Paste or type your church information/i);
    await expect(contentInput).toBeVisible();
    const contentVal = await contentInput.inputValue();
    expect(contentVal).toContain('Frequently Asked Question');
    expect(contentVal).toContain(TEST_QUESTION);

    // 6. Click "Save Section"
    const saveBtn = page.getByRole('button', { name: 'Save Section' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 7. Verify the editor closes and section appears in the list
    await expect(page.getByText(/Parish Hall Rentals/i)).toBeVisible({ timeout: 10000 });

    // 8. Assert the section appears in church_knowledge_sections in database
    const db = serviceClient();
    await expect
      .poll(
        async () => {
          const { data: createdSection } = await db
            .from('church_knowledge_sections')
            .select('id, title, content')
            .eq('church_id', churchId)
            .ilike('title', '%Parish Hall Rentals%')
            .maybeSingle();
          return createdSection?.title || null;
        },
        { timeout: 10000 }
      )
      .toContain('Parish Hall Rentals');
  });
});

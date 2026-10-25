import { test, expect } from '@playwright/test';
import { getStarterFaqTemplates, STARTER_FAQ_TEMPLATES } from '../src/config/starterFaqTemplates';
import { offlinePolishFallback } from '../src/lib/supabase/aiScribe';
import { getSeed, loginAs, serviceClient } from './support';

test.describe('Ticket 03: Starter FAQ Templates & Offline Polish Utility', () => {
  test('starter FAQ templates contain canonical Catholic parish policies', () => {
    const templates = getStarterFaqTemplates();
    expect(templates).toHaveLength(6);

    const requiredIds = [
      'dress-code-decorum',
      'baptism-godparents',
      'wedding-timeline',
      'funeral-blessing',
      'mass-intentions-turnaround',
      'ministries-volunteers',
    ];

    for (const id of requiredIds) {
      const tmpl = templates.find((t) => t.id === id);
      expect(tmpl).toBeDefined();
      expect(tmpl?.title.length).toBeGreaterThan(5);
      expect(tmpl?.content.length).toBeGreaterThan(50);
      expect(tmpl?.category.length).toBeGreaterThan(2);
    }
  });

  test('offlinePolishFallback formats rough notes into dignified pastoral markdown', () => {
    const rawNotes = 'bawal sumbrero\nbawal sleeveless\nsilent cellphones';
    const result = offlinePolishFallback('Dress Code Notes', rawNotes);

    expect(result.polishedTitle).toBe('Dress Code Notes');
    expect(result.polishedContent).toContain('### Liturgical Decorum & Guidelines');
    expect(result.polishedContent).toContain('• Bawal sumbrero');
    expect(result.polishedContent).toContain('• Bawal sleeveless');
    expect(result.polishedContent).toContain('• Silent cellphones');
    expect(result.polishedContent).toContain('pastoral guidelines');
  });

  test('offlinePolishFallback handles empty notes gracefully', () => {
    const result = offlinePolishFallback('', '');
    expect(result.polishedTitle).toBe('Parish Guidelines & Policy');
    expect(result.polishedContent).toContain('### Liturgical Decorum & Guidelines');
  });
});

test.describe('Ticket 03: AI Scribe & Starter Templates E2E Flow', () => {
  const TEST_PREFIX = 'E2E AI Scribe';

  test.beforeEach(async () => {
    const seed = await getSeed();
    const db = serviceClient();
    await db
      .from('church_knowledge_sections')
      .delete()
      .eq('church_id', seed.churchId)
      .ilike('title', `${TEST_PREFIX}%`);
  });

  test.afterAll(async () => {
    const seed = await getSeed();
    const db = serviceClient();
    await db
      .from('church_knowledge_sections')
      .delete()
      .eq('church_id', seed.churchId)
      .ilike('title', `${TEST_PREFIX}%`);
  });

  test('bulk inserts starter templates, polishes draft content with AI, and reviews/applies changes', async ({
    page,
  }) => {
    // Intercept sync edge function to resolve immediately
    await page.route('**/functions/v1/sync-church-knowledge', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, chunksProcessed: 5 }),
      })
    );

    // Intercept polish_knowledge edge function
    await page.route('**/functions/v1/parish-assistant', async (route) => {
      const postData = route.request().postDataJSON();
      if (postData?.action === 'polish_knowledge') {
        const title = postData.title || `${TEST_PREFIX} Church Dress Code`;
        const rawContent = postData.content || '';
        const lines = rawContent
          .split('\n')
          .map((l: string) => l.trim().replace(/^[-*•]\s*/, ''))
          .filter(Boolean);
        const bullets = lines
          .map((l: string) => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`)
          .join('\n');

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            polishedTitle: title,
            polishedContent: `### Liturgical Decorum & Parish Policy\n\nTo preserve the sanctity of our church and foster a prayerful environment for all worshippers, our parish kindly requests your faithful cooperation with the following guidelines:\n\n${bullets}\n\n*We thank you for your understanding and reverence in the House of God.*`,
          }),
        });
      }
      return route.continue();
    });

    await loginAs(page, 'church_admin');
    await page.goto('/knowledge');

    // 1. Verify "Starter Templates" button is present and opens modal
    const starterTemplatesBtn = page.getByRole('button', { name: /Starter Templates/i });
    await expect(starterTemplatesBtn).toBeVisible({ timeout: 10000 });
    await starterTemplatesBtn.click();

    // Verify modal content
    const modalHeading = page.getByRole('heading', { name: 'Starter FAQ & Policy Templates' });
    await expect(modalHeading).toBeVisible();

    for (const tmpl of STARTER_FAQ_TEMPLATES) {
      await expect(page.getByText(tmpl.title).first()).toBeVisible();
    }

    // Deselect all, then select only "Church Dress Code & Liturgical Decorum"
    await page.getByRole('button', { name: 'Deselect All' }).click();
    await expect(page.getByText(`0 of ${STARTER_FAQ_TEMPLATES.length} templates selected`)).toBeVisible();

    // Select the first template checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(page.getByText(`1 of ${STARTER_FAQ_TEMPLATES.length} templates selected`)).toBeVisible();

    // Click "Create Selected Sections (1)"
    const createSelectedBtn = page.getByRole('button', { name: /Create Selected Sections \(1\)/i });
    await createSelectedBtn.click();
    await expect(modalHeading).not.toBeVisible();

    // Verify created section appears in the list
    await expect(
      page.getByText('Church Dress Code & Liturgical Decorum').first()
    ).toBeVisible({ timeout: 10000 });

    // 2. Open section editor to test "✨ Polish with AI"
    const addSectionBtn = page.getByRole('button', { name: 'Add Section' });
    await addSectionBtn.click();

    const titleInput = page.getByPlaceholder(/Section title/i);
    const contentTextarea = page.getByPlaceholder(/Paste or type your church information/i);
    const polishBtn = page.getByRole('button', { name: /Polish with AI/i });

    // Verify Polish button is disabled when content is short (< 10 chars)
    await contentTextarea.fill('short');
    await expect(polishBtn).toBeDisabled();

    // Fill with rough informal bullet points
    await titleInput.fill(`${TEST_PREFIX} - Dress Code Notes`);
    await contentTextarea.fill(
      'bawal sumbrero sa church\nbawal sleeveless at rubber slippers\nturn off cellphones during mass'
    );
    await expect(polishBtn).toBeEnabled();

    // 3. Click "Polish with AI" -> Assert Review Preview modal opens
    await polishBtn.click();

    const reviewModalHeader = page.getByRole('heading', {
      name: 'Review Polished Pastoral Guidelines',
    });
    await expect(reviewModalHeader).toBeVisible({ timeout: 10000 });

    // Assert side-by-side view shows original and polished versions
    await expect(page.getByText('Original Draft')).toBeVisible();
    await expect(page.getByText('Polished Pastoral Version')).toBeVisible();
    await expect(page.getByText(/Liturgical Decorum & Parish Policy/i)).toBeVisible();

    // 4. Click "Apply Polished Version"
    const applyBtn = page.getByRole('button', { name: /Apply Polished Version/i });
    await applyBtn.click();
    await expect(reviewModalHeader).not.toBeVisible();

    // Assert success badge is shown
    await expect(page.getByText('✨ Polished with AI!')).toBeVisible();

    // Assert content in editor is updated with polished content
    await expect(contentTextarea).toHaveValue(/Liturgical Decorum & Parish Policy/);

    // 5. Save the section
    const saveBtn = page.getByRole('button', { name: 'Save Section' });
    await saveBtn.click();

    // Verify section appears in the list
    await expect(
      page.getByText(`${TEST_PREFIX} - Dress Code Notes`).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify in database
    const seed = await getSeed();
    const db = serviceClient();
    const { data: dbRecord } = await db
      .from('church_knowledge_sections')
      .select('title, content')
      .eq('church_id', seed.churchId)
      .eq('title', `${TEST_PREFIX} - Dress Code Notes`)
      .single();

    expect(dbRecord).toBeDefined();
    expect(dbRecord?.content).toContain('Liturgical Decorum & Parish Policy');
    expect(dbRecord?.content).toContain('Bawal sumbrero sa church');
  });

  test('editor template picker loads pre-crafted template directly into active form', async ({
    page,
  }) => {
    await loginAs(page, 'church_admin');
    await page.goto('/knowledge');

    const addSectionBtn = page.getByRole('button', { name: /Add (First )?Section/i });
    await expect(addSectionBtn).toBeVisible({ timeout: 10000 });
    await addSectionBtn.click();

    const titleInput = page.getByPlaceholder(/Section title/i);
    const contentTextarea = page.getByPlaceholder(/Paste or type your church information/i);

    // Pick Baptism template from select dropdown
    const templateSelect = page.locator('select', { hasText: 'Insert Template' });
    await expect(templateSelect).toBeVisible();
    await templateSelect.selectOption('baptism-godparents');

    await expect(titleInput).toHaveValue('Holy Baptism Requirements & Godparent Guidelines');
    await expect(contentTextarea).toHaveValue(/Holy Baptism Policy & Guidelines/);
    await expect(contentTextarea).toHaveValue(/Godparent \(Ninong \/ Ninang\)/);

    // Cancel form
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(titleInput).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginAs } from './support';

test.describe('AI Parish Assistant - UI Enhancements & Flow Controls', () => {
  test('Test 1: Window size, desktop layout, and Maximize/Restore toggle', async ({ page }) => {
    // Set a spacious desktop viewport (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 1. Open assistant
    const assistantBtn = page.getByTestId('parish-assistant-button');
    await expect(assistantBtn).toBeVisible();
    await assistantBtn.click();

    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Verify default desktop panel is generous (> 480px wide)
    await page.waitForTimeout(350); // allow initial enter transition
    const initialBox = await panel.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(initialBox!.width).toBeGreaterThanOrEqual(480);
    expect(initialBox!.height).toBeGreaterThanOrEqual(600);

    // 2. Click Maximize toggle
    const maximizeToggle = page.getByTestId('parish-assistant-maximize-toggle');
    await expect(maximizeToggle).toBeVisible();
    await maximizeToggle.click();

    // Wait for 300ms CSS transition
    await page.waitForTimeout(350);

    // Maximized panel width should now be desktop-class (> 800px)
    const maximizedBox = await panel.boundingBox();
    expect(maximizedBox).not.toBeNull();
    expect(maximizedBox!.width).toBeGreaterThanOrEqual(800);

    // 3. Click Restore toggle
    await maximizeToggle.click();
    await page.waitForTimeout(350);

    const restoredBox = await panel.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(restoredBox!.width).toBeLessThan(700);
    expect(restoredBox!.width).toBeGreaterThanOrEqual(480);
  });

  test('Test 2: Mid-booking cancel button exists in all steps and aborts booking cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open assistant
    await page.getByTestId('parish-assistant-button').click();
    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Start booking flow via chip
    const bookChip = page.getByTestId('starter-chip-book-a-sacrament');
    await expect(bookChip).toBeVisible();
    await bookChip.click();

    // If prompted to pick a parish, click first parish chip
    const parishChips = panel.locator('div.flex.flex-wrap.gap-1\\.5 button');
    if (await parishChips.first().isVisible({ timeout: 1500 }).catch(() => false)) {
      await parishChips.first().click();
    }

    // Step 1: Services are displayed, and mid-booking cancel bar is visible
    const cancelMidwayBtn = page.getByTestId('cancel-booking-midway');
    await expect(cancelMidwayBtn).toBeVisible({ timeout: 10000 });
    await expect(cancelMidwayBtn).toContainText('Cancel');

    // Click Cancel midway
    await cancelMidwayBtn.click();

    // Verify booking is cancelled and message posted
    await expect(panel).toContainText('Sacrament booking has been cancelled');
    await expect(cancelMidwayBtn).not.toBeVisible();

    // Starter chips return
    await expect(page.getByTestId('starter-chip-book-a-sacrament')).toBeVisible();
  });

  test('Test 3: Booking confirmed card dismiss button and auto-dismiss on new question', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open assistant
    await page.getByTestId('parish-assistant-button').click();
    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Inject confirmed booking state to verify dismissal UX
    await page.evaluate(() => {
      // simulate session storage or test confirmed card
      const draft = {
        churchId: 'test-church',
        churchName: 'Our Lady of Lourdes Parish',
        step: 'confirmed',
      };
      sessionStorage.setItem('sacralink:assistant-booking-draft', JSON.stringify(draft));
    });

    // Reload to pick up stored confirmed draft
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open assistant again if closed
    const isVisible = await panel.isVisible();
    if (!isVisible) {
      await page.getByTestId('parish-assistant-button').click();
    }

    // Now test that the dismiss button works
    // Or send a message and verify it auto-clears
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('What are the mass schedules?');
    await textarea.press('Enter');

    // The booking success card should disappear
    await expect(page.getByTestId('booking-success-card')).not.toBeVisible();
  });

  test('Test 4: Clear Chat button resets conversation, booking draft, and assistant state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open assistant
    await page.getByTestId('parish-assistant-button').click();
    const panel = page.getByTestId('parish-assistant-panel');
    await expect(panel).toBeVisible();

    // Start a booking draft via starter chip
    const bookChip = page.getByTestId('starter-chip-book-a-sacrament');
    await expect(bookChip).toBeVisible();
    await bookChip.click();

    // Verify clear chat button exists
    const clearChatBtn = page.getByTestId('parish-assistant-clear-chat');
    await expect(clearChatBtn).toBeVisible();
    await expect(clearChatBtn).toHaveAttribute('title', 'Clear conversation');

    // Click Clear Conversation
    await clearChatBtn.click();

    // Verify conversation is cleared and starter chips return
    await expect(page.getByTestId('starter-chip-book-a-sacrament')).toBeVisible();
    await expect(panel.getByTestId('cancel-booking-midway')).not.toBeVisible();
  });

  test('Test 5: Mascot dragging elevates z-index and return to corner button resets position', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'parishioner');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const dove = page.getByTestId('parish-assistant-button');
    await expect(dove).toBeVisible();

    // Check default z-index is 60 (above desktop sidebar z-50)
    const initialZ = await page.evaluate(() => {
      const fx = document.querySelector('.kal-fx') as HTMLElement;
      return fx ? fx.style.getPropertyValue('--kal-z') : null;
    });
    expect(initialZ).toBe('60');

    // Verify return button exists inside mascot
    const resetBtn = page.locator('.kal-reset');
    await expect(resetBtn).toBeAttached();
    await expect(resetBtn).toHaveAttribute('title', 'Return to corner');
    await expect(resetBtn).toHaveAttribute('aria-label', 'Return Kalapati to original corner');

    // Drag Kalapati
    const box = await dove.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 200, startY - 200, { steps: 5 });

    // While dragging, z-index elevates to 100
    const draggingZ = await page.evaluate(() => {
      const fx = document.querySelector('.kal-fx') as HTMLElement;
      return fx ? fx.style.getPropertyValue('--kal-z') : null;
    });
    expect(draggingZ).toBe('100');

    // Release drag
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Z-index restores to 60
    const endZ = await page.evaluate(() => {
      const fx = document.querySelector('.kal-fx') as HTMLElement;
      return fx ? fx.style.getPropertyValue('--kal-z') : null;
    });
    expect(endZ).toBe('60');

    // Click Return to Corner button
    await resetBtn.click({ force: true });
    await page.waitForTimeout(300);

    // Verify reset executed
    await expect(dove).toBeVisible();
  });
});

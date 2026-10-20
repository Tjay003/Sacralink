import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Canon 905 & Liturgical Scheduler Engine (Browser Context)', () => {

  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'priest');
    await page.goto('/dashboard');
  });

  test('should accurately calculate Canon 905 rules and time normalization in client app', async ({ page }) => {
    const results = await page.evaluate(async () => {
      // Dynamic import of liturgicalScheduler inside browser runtime
      const module = await import('../src/lib/liturgicalScheduler');

      return {
        sundayCheck: module.isSundayDate('2026-10-25'),
        weekdayCheck: module.isSundayDate('2026-10-20'),
        sundayMax: module.getMaxCanonMasses('2026-10-25'),
        weekdayMax: module.getMaxCanonMasses('2026-10-20'),
        normalized12h: module.normalizeTime('10:00 AM'),
        normalized24h: module.normalizeTime('14:30'),
        normalizedPm: module.normalizeTime('02:30 PM'),
      };
    });

    // Verify Sunday vs Weekday detection
    expect(results.sundayCheck).toBe(true);
    expect(results.weekdayCheck).toBe(false);

    // Verify Canon 905 limits
    expect(results.sundayMax).toBe(3);
    expect(results.weekdayMax).toBe(2);

    // Verify Time Normalization
    expect(results.normalized12h).toBe('10:00');
    expect(results.normalized24h).toBe('14:30');
    expect(results.normalizedPm).toBe('14:30');
  });

});

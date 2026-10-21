import { test, expect, type Browser } from '@playwright/test';
import { capture, createApprovedAppointment, loginAs, openEdit, pageAs, resetAppointmentData } from './support';

/**
 * Real end-to-end: after the office cancels an approved appointment, the parishioner's appointment
 * card shows "Cancelled" together with the cancellation reason (spec section 3).
 */

const REASON = 'The church is closed for emergency roof repairs on that date.';

test.beforeEach(async () => {
  await resetAppointmentData();
});

/** The office cancels the only appointment through the real Edit modal. */
async function cancelAsOffice(browser: Browser) {
  const office = await pageAs(browser, 'church_admin', { viewport: { width: 1280, height: 900 } });
  const { dialog } = await openEdit(office);
  await dialog.getByRole('radio', { name: /Cancel appointment/ }).click();
  await dialog.getByLabel('Reason for cancelling').fill(REASON);
  await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  await office.context().close();
}

test.describe('Parishioner sees the cancelled appointment with its reason', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('appointments page on desktop: Cancelled badge, reason, no longer Approved, nothing to edit', async ({ page, browser }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    await cancelAsOffice(browser);

    await loginAs(page, 'parishioner');
    await page.goto('/appointments');
    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(row).toContainText(`Reason: ${REASON}`);
    await expect(row.getByText('Approved', { exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Cancelled\s*1$/ })).toBeVisible();
    await capture(page, 'cancelled-card-parishioner-desktop-1280');
  });

  test('dashboard Upcoming Appointments card also shows the cancellation reason', async ({ page, browser }) => {
    // Spec section 3: "A cancelled appointment shows its cancellation reason on the parishioner's appointment card."
    // The dashboard lists the cancelled appointment with a yellow "cancelled" pill but never renders the reason.
    test.fail(true, 'Product gap: the UserDashboard upcoming card shows the status only, not cancellation_reason');
    await createApprovedAppointment({ daysFromToday: 14 });
    await cancelAsOffice(browser);

    await loginAs(page, 'parishioner');
    const card = page.locator('div.card').filter({ has: page.getByRole('heading', { name: 'Upcoming Appointments' }) });
    await expect(card.getByRole('heading', { name: 'Baptism' })).toBeVisible();
    await expect(card).toContainText('cancelled');
    await capture(page, 'cancelled-card-parishioner-dashboard-1280');
    await expect(card).toContainText(REASON, { timeout: 3000 });
  });
});

test.describe('Parishioner on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mobile appointment card shows Cancelled and the reason without overflowing', async ({ page, browser }) => {
    await createApprovedAppointment({ daysFromToday: 14 });
    await cancelAsOffice(browser);

    await loginAs(page, 'parishioner');
    await page.goto('/appointments');
    const card = page.locator('div.lg\\:hidden > div').filter({ hasText: 'Baptism' });
    await expect(card.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(card).toContainText(`Reason: ${REASON}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await capture(page, 'cancelled-card-parishioner-mobile-390');
  });
});

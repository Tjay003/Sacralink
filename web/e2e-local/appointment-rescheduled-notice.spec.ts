import { test, expect, type Page } from '@playwright/test';
import {
  capture,
  clientAs,
  createApprovedAppointment,
  isoDate,
  loginAs,
  openEdit,
  pageAs,
  resetAppointmentData,
  serviceClient,
} from './support';

/**
 * Real end-to-end: the amber "Rescheduled from <old date>" notice, with the reason on hover or tap,
 * for the parishioner, the celebrant and the office. It disappears once the new date has passed,
 * while the change history keeps the record.
 */

const REASON = 'The parish hall is unavailable on the original date.';
const NOTICE_TIME = '09:30';

const db = serviceClient();

/** "Nov 4, 2026": how the notice formats the old date. */
function noticeLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Reschedules through the real database function as the office (data setup for the audience checks). */
async function rescheduleAsOffice(id: string, daysFromToday: number) {
  const admin = await clientAs('church_admin');
  const { error } = await admin.rpc('reschedule_appointment', {
    p_appointment_id: id,
    p_new_date: isoDate(daysFromToday),
    p_new_time: `${NOTICE_TIME}:00`,
    p_reason: REASON,
  });
  if (error) throw error;
}

/** The notice chips currently on screen (the desktop table and the phone cards both live in the DOM). */
function visibleNotices(page: Page) {
  return page.getByTestId('rescheduled-notice').filter({ visible: true });
}

/** The priest dashboard's "Upcoming sacramental ministry" list. */
function upcomingList(page: Page) {
  return page.locator('section').filter({ hasText: 'Upcoming sacramental ministry' });
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Rescheduled notice on a desktop screen', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('after the office reschedules, the parishioner, the celebrant and the office all see the amber notice', async ({
    page,
    browser,
  }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    const oldLabel = noticeLabel(isoDate(14));

    // The office reschedules through the real Edit modal
    await loginAs(page, 'church_admin');
    const { dialog } = await openEdit(page);
    await dialog.getByRole('radio', { name: /Reschedule/ }).click();
    await dialog.getByLabel('New date').fill(isoDate(21));
    await dialog.getByLabel('New time').fill(NOTICE_TIME);
    await dialog.getByLabel('Reason for rescheduling').fill(REASON);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    // Office: table row shows the chip, the reason opens on hover
    const officeNotice = visibleNotices(page);
    await expect(officeNotice).toHaveText(`Rescheduled from ${oldLabel}`);
    await officeNotice.hover();
    await expect(page.getByTestId('rescheduled-notice-reason')).toContainText(REASON);
    await capture(page, 'rescheduled-notice-office-desktop-1280');

    // Parishioner: dashboard card and appointments page
    const parishioner = await pageAs(browser, 'parishioner', { viewport: { width: 1280, height: 1100 } });
    await expect(visibleNotices(parishioner)).toHaveText(`Rescheduled from ${oldLabel}`);
    await parishioner.goto('/appointments');
    const parishionerNotice = visibleNotices(parishioner);
    await expect(parishionerNotice).toHaveText(`Rescheduled from ${oldLabel}`);
    await parishionerNotice.hover();
    await expect(parishioner.getByTestId('rescheduled-notice-reason')).toContainText(REASON);
    await capture(parishioner, 'rescheduled-notice-parishioner-desktop-1280');

    // Celebrant: the upcoming sacramental ministry list on the priest dashboard
    const priest = await pageAs(browser, 'priest', { viewport: { width: 1280, height: 900 } });
    const priestNotice = upcomingList(priest).getByTestId('rescheduled-notice');
    await expect(priestNotice).toHaveText(`Rescheduled from ${oldLabel}`);
    // The same appointment also sits in his "Needs celebrant attention" queue
    await expect(visibleNotices(priest)).toHaveCount(2);
    await priestNotice.hover();
    await expect(priest.getByTestId('rescheduled-notice-reason')).toContainText(REASON);
    await capture(priest, 'rescheduled-notice-priest-desktop-1280', false);

    // A reschedule never turns into a status: the appointment is still approved
    const { data } = await db.from('appointments').select('status').eq('id', id).single();
    expect(data?.status).toBe('approved');
    const { data: odd } = await db.from('appointments').select('id').eq('status', 'rescheduled');
    expect(odd).toHaveLength(0);
  });

  test('an appointment that was never rescheduled shows no notice to anyone', async ({ page, browser }) => {
    await createApprovedAppointment({ daysFromToday: 14 });

    await loginAs(page, 'church_admin');
    await page.goto('/appointments');
    await expect(page.locator('table').getByText('Baptism')).toBeVisible();
    await expect(page.getByTestId('rescheduled-notice')).toHaveCount(0);

    const parishioner = await pageAs(browser, 'parishioner');
    await expect(parishioner.getByText('Baptism').first()).toBeVisible();
    await expect(parishioner.getByTestId('rescheduled-notice')).toHaveCount(0);

    const priest = await pageAs(browser, 'priest');
    await expect(priest.getByText('Upcoming sacramental ministry')).toBeVisible();
    await expect(priest.getByTestId('rescheduled-notice')).toHaveCount(0);
  });

  test('the notice is hidden when the appointment is cancelled', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await rescheduleAsOffice(id, 21);
    const admin = await clientAs('church_admin');
    const { error } = await admin.rpc('cancel_appointment', { p_appointment_id: id, p_reason: REASON });
    expect(error).toBeNull();

    await loginAs(page, 'church_admin');
    await page.goto('/appointments');
    await expect(page.locator('table').getByText('Cancelled')).toBeVisible();
    await expect(page.getByTestId('rescheduled-notice')).toHaveCount(0);
  });

  test('the notice disappears once the new date has passed, but the change history keeps the reschedule', async ({
    page,
    browser,
  }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await rescheduleAsOffice(id, 21);
    const oldLabel = noticeLabel(isoDate(14));

    // Today is the last day it still shows
    await db.from('appointments').update({ appointment_date: isoDate(0), appointment_time: '23:30:00' }).eq('id', id);
    await loginAs(page, 'church_admin');
    await page.goto('/appointments');
    await expect(visibleNotices(page)).toHaveText(`Rescheduled from ${oldLabel}`);
    const priestToday = await pageAs(browser, 'priest');
    const timeline = priestToday.locator('section').filter({ hasText: "Today's celebrations" });
    await expect(timeline.getByTestId('rescheduled-notice')).toHaveText(`Rescheduled from ${oldLabel}`);

    // Yesterday: the new date has passed, so the notice is gone for every audience
    await db.from('appointments').update({ appointment_date: isoDate(-1) }).eq('id', id);
    await page.goto('/appointments');
    await expect(page.locator('table').getByText('Baptism')).toBeVisible();
    await expect(page.getByTestId('rescheduled-notice')).toHaveCount(0);

    const parishioner = await pageAs(browser, 'parishioner');
    await parishioner.goto('/appointments');
    await expect(parishioner.locator('table').getByText('Baptism')).toBeVisible();
    await expect(parishioner.getByTestId('rescheduled-notice')).toHaveCount(0);

    const priest = await pageAs(browser, 'priest');
    await expect(priest.getByText('Not yet marked celebrated').first()).toBeVisible();
    await expect(priest.getByTestId('rescheduled-notice')).toHaveCount(0);

    // The change history keeps it permanently
    const { dialog } = await openEdit(page);
    const entry = dialog.getByRole('region', { name: 'Change history' }).getByRole('listitem').filter({ hasText: 'Rescheduled' });
    await expect(entry).toContainText(REASON);
    await expect(entry).toContainText('Local Church Admin');
  });
});

test.describe('Rescheduled notice on a phone', () => {
  test.use({ viewport: { width: 390, height: 1200 }, hasTouch: true, isMobile: true });

  test('parishioner taps the chip on the appointment card to read the reason', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await rescheduleAsOffice(id, 21);
    const oldLabel = noticeLabel(isoDate(14));

    await loginAs(page, 'parishioner');
    await page.goto('/appointments');
    const notice = visibleNotices(page);
    await expect(notice).toHaveText(`Rescheduled from ${oldLabel}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const reason = page.getByTestId('rescheduled-notice-reason');
    await expect(reason).toHaveCount(0);
    await notice.tap();
    await expect(reason).toContainText(REASON);
    await capture(page, 'rescheduled-notice-parishioner-mobile-390');

    // A second tap closes it again
    await notice.tap();
    await expect(reason).toHaveCount(0);
  });

  test('office sees the chip on the mobile appointment card and can tap it', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await rescheduleAsOffice(id, 21);

    await loginAs(page, 'church_admin');
    await page.goto('/appointments');
    const notice = visibleNotices(page);
    await expect(notice).toHaveText(`Rescheduled from ${noticeLabel(isoDate(14))}`);
    await notice.tap();
    await expect(page.getByTestId('rescheduled-notice-reason')).toContainText(REASON);
    await capture(page, 'rescheduled-notice-office-mobile-390');
  });

  test('celebrant sees the chip on the priest dashboard on a phone', async ({ page }) => {
    const id = await createApprovedAppointment({ daysFromToday: 14 });
    await rescheduleAsOffice(id, 21);

    await loginAs(page, 'priest');
    const notice = upcomingList(page).getByTestId('rescheduled-notice');
    await expect(notice).toHaveText(`Rescheduled from ${noticeLabel(isoDate(14))}`);
    await notice.tap();
    await expect(page.getByTestId('rescheduled-notice-reason')).toContainText(REASON);
    await capture(page, 'rescheduled-notice-priest-mobile-390', false);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  priest?: { id: string; full_name: string; email: string } | null;
  rescheduled_from_date?: string | null;
  reschedule_reason?: string | null;
};

const PRIEST = MOCK_USERS.priest;
const REASON = 'The church hall is closed for repairs on the original date.';
const NOTICE = '[data-testid="rescheduled-notice"]';

/** YYYY-MM-DD for today plus an offset, in the browser's local calendar */
function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The label the notice shows for a YYYY-MM-DD key */
function noticeLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `Rescheduled from ${new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

const assignedToPriest = (overrides: Partial<MockAppointment>): MockAppointment => ({
  ...MOCK_APPOINTMENTS[0],
  priest_id: PRIEST.id,
  priest: { id: PRIEST.id, full_name: PRIEST.full_name, email: PRIEST.email },
  ...overrides,
});

async function mockAppointments(page: Page, appointments: MockAppointment[]) {
  await page.route('**/rest/v1/appointments*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${appointments.length - 1}/${appointments.length}` },
      body: JSON.stringify(appointments),
    });
  });
}

test.describe('Rescheduled from ... notice: parishioner appointments', () => {
  const fromKey = dateKey(-3);
  const rescheduled = assignedToPriest({
    id: 'apt-resched',
    appointment_date: dateKey(10),
    appointment_time: '10:00:00',
    rescheduled_from_date: fromKey,
    reschedule_reason: REASON,
  });
  const neverRescheduled = assignedToPriest({
    id: 'apt-plain',
    service_type: 'Confirmation',
    appointment_date: dateKey(12),
    appointment_time: '11:00:00',
  });

  test('shows the amber notice with the reason on hover, and none for a never-rescheduled appointment', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await mockAppointments(page, [rescheduled, neverRescheduled]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    const chip = row.locator(NOTICE);
    await expect(chip).toHaveText(noticeLabel(fromKey));
    await expect(chip).toHaveClass(/amber/);
    // Status is untouched by a reschedule
    await expect(row.getByText('Approved', { exact: true }).first()).toBeVisible();

    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await chip.hover();
    await expect(page.getByRole('tooltip')).toContainText(REASON);
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await expect(page.locator('table').locator('tr', { hasText: 'Confirmation' })).toBeVisible();
    await expect(page.locator('table').locator('tr', { hasText: 'Confirmation' }).locator(NOTICE)).toHaveCount(0);
  });

  test('hides the notice once the new date has passed', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await mockAppointments(page, [{ ...rescheduled, appointment_date: dateKey(-1) }]);
    await page.goto('/appointments');

    await expect(page.locator('table').locator('tr', { hasText: 'Baptism' })).toBeVisible();
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });

  test('hides the notice on a cancelled appointment', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await mockAppointments(page, [{ ...rescheduled, status: 'cancelled' }]);
    await page.goto('/appointments');

    await expect(page.locator('table').locator('tr', { hasText: 'Baptism' })).toBeVisible();
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the mobile card reveals the reason on tap and closes on a second tap', async ({ page }) => {
      await authenticateAs(page, 'parishioner');
      await mockAppointments(page, [rescheduled, neverRescheduled]);
      await page.goto('/appointments');

      const chip = page.locator(NOTICE).filter({ visible: true });
      await expect(chip).toHaveCount(1);
      await expect(page.getByRole('tooltip')).toHaveCount(0);

      await chip.tap();
      await expect(chip).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('tooltip')).toContainText(REASON);

      await chip.tap();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    });
  });

  test('is keyboard accessible: focus shows the reason, Escape closes it', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await mockAppointments(page, [rescheduled]);
    await page.goto('/appointments');

    const chip = page.locator('table').locator(NOTICE);
    await chip.focus();
    await expect(page.getByRole('tooltip')).toContainText(REASON);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});

test.describe('Rescheduled from ... notice: office appointments', () => {
  test('church admin sees the notice in the office table', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const fromKey = dateKey(-2);
    await mockAppointments(page, [
      assignedToPriest({
        appointment_date: dateKey(8),
        appointment_time: '09:00:00',
        rescheduled_from_date: fromKey,
        reschedule_reason: REASON,
      }),
    ]);
    await page.goto('/appointments');

    const chip = page.locator('table').locator(NOTICE);
    await expect(chip).toHaveText(noticeLabel(fromKey));
    await chip.hover();
    await expect(page.getByRole('tooltip')).toContainText(REASON);
  });
});

test.describe('Rescheduled from ... notice: celebrant (priest dashboard)', () => {
  const todayFrom = dateKey(-4);
  const upcomingFrom = dateKey(-5);
  const todays = assignedToPriest({
    id: 'apt-today',
    appointment_date: dateKey(0),
    appointment_time: '23:30:00',
    rescheduled_from_date: todayFrom,
    reschedule_reason: 'Moved because of the bishop visit.',
  });
  const upcoming = assignedToPriest({
    id: 'apt-upcoming',
    service_type: 'Confirmation',
    appointment_date: dateKey(6),
    appointment_time: '10:00:00',
    rescheduled_from_date: upcomingFrom,
    reschedule_reason: REASON,
  });
  const plain = assignedToPriest({
    id: 'apt-plain',
    service_type: 'Funeral',
    appointment_date: dateKey(9),
    appointment_time: '08:00:00',
  });

  test('shows the notice in the timeline, upcoming list and attention queue, not on plain appointments', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointments(page, [todays, upcoming, plain]);
    await page.goto('/dashboard');

    const timeline = page
      .getByRole('heading', { name: /Today's celebrations/i })
      .locator('xpath=ancestor::section[1]');
    await expect(timeline.locator(NOTICE)).toHaveText(noticeLabel(todayFrom));

    const upcomingList = page
      .getByRole('heading', { name: /Upcoming sacramental ministry/i })
      .locator('xpath=ancestor::section[1]');
    const upcomingChips = upcomingList.locator(NOTICE);
    await expect(upcomingChips).toHaveCount(1);
    await expect(upcomingChips).toHaveText(noticeLabel(upcomingFrom));
    await upcomingChips.hover();
    await expect(page.getByRole('tooltip')).toContainText(REASON);

    const queue = page
      .getByRole('heading', { name: /Needs celebrant attention/i })
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(queue.locator(NOTICE)).toHaveCount(2);
    await expect(queue.locator(NOTICE).first()).toContainText('Rescheduled from');
  });

  test('hides the notice for a celebration whose new date has passed', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointments(page, [{ ...upcoming, appointment_date: dateKey(-1) }]);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /Upcoming sacramental ministry/i })).toBeVisible();
    await expect(page.locator(NOTICE)).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { PASSWORD, capture, getSeed, isoDate, loginAs, resetAppointmentData, serviceClient } from './support';

/**
 * Layout guard: the Appointments table and the Users directory fit every screen width without a horizontal scrollbar,
 * even with long names, emails, notes and cancellation reasons. Pure layout, so no behaviour is asserted beyond the rows rendering.
 */

const db = serviceClient();
const WIDTHS = [375, 768, 1024, 1280, 1440];
const SUPER_EMAIL = 'overflow-super@local.test';
const LONG_NAME = 'Maria Magdalena Esperanza de los Santos y Fernandez-Villanueva';
const createdUserIds: string[] = [];

async function createUser(email: string, fullName: string, role: string, churchId: string | null) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const { error: profileErr } = await db.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    church_id: churchId,
    assigned_church_id: role === 'user' ? null : churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  createdUserIds.push(data.user.id);
  return data.user.id;
}

/** Everything that could make a page pan sideways: the document, any table wider than its box, any scroll container in use. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const problems: string[] = [];
    if (doc.scrollWidth > doc.clientWidth) {
      problems.push(`document ${doc.scrollWidth} > ${doc.clientWidth}`);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > doc.clientWidth + 1) problems.push(`wide ${el.tagName}.${String(el.className).slice(0, 80)} right=${Math.round(r.right)}`);
        if (problems.length > 8) break;
      }
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *, table'))) {
      const style = getComputedStyle(el);
      if (style.display === 'none') continue;
      const scrolls = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      if (scrolls) problems.push(`scroll container ${el.tagName}.${String(el.className).slice(0, 60)} ${el.scrollWidth} > ${el.clientWidth}`);
      if (el.tagName === 'TABLE' && el.parentElement && el.scrollWidth > el.parentElement.clientWidth + 1) {
        problems.push(`table ${el.scrollWidth} > ${el.parentElement.clientWidth}`);
      }
    }
    return problems;
  });
}

test.beforeAll(async () => {
  const seed = await getSeed();
  await createUser(SUPER_EMAIL, 'Overflow Super Admin', 'super_admin', null);
  for (let i = 0; i < 4; i++) {
    await createUser(`overflow-long-address-user-${i}-with-a-very-long-local-part@some-extremely-long-domain-name.example.test`, `${LONG_NAME} ${i}`, 'user', null);
  }
  await createUser('overflow-volunteer@local.test', LONG_NAME, 'volunteer', seed.churchId);
});

test.beforeEach(async () => {
  await resetAppointmentData();
  const seed = await getSeed();
  const rows = createdUserIds.map((userId, i) => ({
    user_id: userId,
    church_id: i % 2 === 0 ? seed.churchId : seed.otherChurchId,
    service_type: ['Baptism', 'Wedding', 'Funeral', 'Confirmation', 'Blessing', 'Other'][i % 6],
    appointment_date: isoDate(10 + i),
    appointment_time: '09:30:00',
    status: ['pending', 'approved', 'cancelled', 'rejected', 'pending', 'approved'][i % 6],
    priest_id: i % 2 === 0 && i % 3 !== 0 ? seed.ids.priest : null,
    requested_priest_id: i % 2 === 0 && i % 3 === 0 ? seed.ids.priest2 : null,
    notes: `Candidate: ${LONG_NAME}, a long note with an unbroken-word-${'x'.repeat(60)} to stress wrapping behaviour`,
    cancellation_reason: i % 6 === 2 ? `The family asked to cancel because ${'of a very long reason '.repeat(6)}` : null,
  }));
  const { error } = await db.from('appointments').insert(rows);
  if (error) throw error;
});

test.afterAll(async () => {
  await resetAppointmentData();
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id);
});

test.describe('No horizontal scroll', () => {
  test('/appointments fits every width for a church admin', async ({ page }) => {
    await loginAs(page, 'church_admin');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/appointments');
      await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();
      await expect(page.getByText(LONG_NAME).locator('visible=true').first()).toBeVisible();
      expect(await horizontalOverflow(page), `appointments at ${width}px`).toEqual([]);
      if (width === 375 || width === 1024) await capture(page, `responsive-appointments-${width}`);
    }
  });

  test('/appointments fits every width for a super admin', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(SUPER_EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard**');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/appointments');
      await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();
      expect(await horizontalOverflow(page), `appointments (super admin) at ${width}px`).toEqual([]);
    }
  });

  test('/users fits every width in table and grouped views for a super admin', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(SUPER_EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard**');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/users');
      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
      await page.getByRole('button', { name: 'All Accounts' }).click();
      await expect(page.getByText(LONG_NAME).locator('visible=true').first()).toBeVisible();
      expect(await horizontalOverflow(page), `users table at ${width}px`).toEqual([]);
      if (width === 375 || width === 1024) await capture(page, `responsive-users-${width}`);

      await page.getByRole('button', { name: 'Group by Parish' }).click();
      await expect(page.getByText(LONG_NAME).locator('visible=true').first()).toBeVisible();
      expect(await horizontalOverflow(page), `users grouped at ${width}px`).toEqual([]);
    }
  });

  test('/users fits every width for a church admin', async ({ page }) => {
    await loginAs(page, 'church_admin');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/users');
      await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
      await page.getByRole('button', { name: 'All Accounts' }).click();
      expect(await horizontalOverflow(page), `users (church admin) at ${width}px`).toEqual([]);
    }
  });
});

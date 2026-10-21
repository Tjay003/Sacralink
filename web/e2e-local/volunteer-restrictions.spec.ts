import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, createPendingAppointment, getSeed, isoDate, pageAs, resetAppointmentData, serviceClient } from './support';

/**
 * Volunteer boundaries: a lean dashboard, parishioner-style personal appointments (never the parish-wide list, in the UI
 * or through the API), and no way to edit parish details or donation QR codes.
 */

const db = serviceClient();
const VOLUNTEER_EMAIL = 'volunteer-restrictions@local.test';
let volunteerId = '';
let volunteerClient: SupabaseClient;

async function createVolunteer(churchId: string) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === VOLUNTEER_EMAIL);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({ email: VOLUNTEER_EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  volunteerId = data.user.id;
  const { error: profileErr } = await db.from('profiles').upsert({
    id: volunteerId,
    email: VOLUNTEER_EMAIL,
    full_name: 'Local Volunteer',
    role: 'volunteer',
    church_id: churchId,
    assigned_church_id: churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  volunteerClient = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await volunteerClient.auth.signInWithPassword({ email: VOLUNTEER_EMAIL, password: PASSWORD });
  if (signInErr) throw signInErr;
}

async function volunteerPage(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(VOLUNTEER_EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

test.beforeAll(async () => {
  const seed = await getSeed();
  await createVolunteer(seed.churchId);
});

test.beforeEach(async () => {
  await resetAppointmentData();
  const seed = await getSeed();
  // The parishioner's request is parish-wide data the volunteer must never see; the Wedding is the volunteer's own.
  await createPendingAppointment({ serviceType: 'Baptism' });
  const { error } = await db.from('appointments').insert({
    user_id: volunteerId,
    church_id: seed.churchId,
    service_type: 'Wedding',
    appointment_date: isoDate(20),
    appointment_time: '11:00:00',
    status: 'pending',
  });
  if (error) throw error;
});

test.afterAll(async () => {
  await resetAppointmentData();
  if (volunteerId) await db.auth.admin.deleteUser(volunteerId);
});

test.describe('Volunteer restrictions', () => {
  test('dashboard shows the lean volunteer widgets only', async ({ page }) => {
    await volunteerPage(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Local');
    await expect(page.getByText('Announcements and bulletin board')).toBeVisible();
    await expect(page.getByText('Recent sacrament requests')).toHaveCount(0);
    await expect(page.getByText(/recent activity/i)).toHaveCount(0);
    await expect(page.getByText(/ai parish assistant/i)).toHaveCount(0);
  });

  test('appointments page offers booking and lists only the volunteer\'s own bookings', async ({ page }) => {
    await volunteerPage(page);
    await page.goto('/appointments');

    await expect(page.getByRole('button', { name: 'Book Appointment' })).toBeVisible();
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Matrimony');
    await expect(page.locator('table')).not.toContainText('Baptism');
    for (const name of ['Approve', 'Reject', 'Edit', 'Reschedule', 'Cancel']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }

    await page.getByRole('button', { name: 'Book Appointment' }).click();
    const seed = await getSeed();
    await expect(page).toHaveURL(new RegExp(`/churches/${seed.churchId}/book$`));
  });

  test('the database hides parish-wide appointments from a volunteer', async () => {
    const { data, error } = await volunteerClient.from('appointments').select('id,user_id');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(volunteerId);
  });

  test('parishes list has no Edit button and the edit URL redirects to the parish page', async ({ page }) => {
    const seed = await getSeed();
    await volunteerPage(page);

    await page.goto('/churches');
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.locator('table').getByText('Local Test Parish')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);

    await page.goto(`/churches/${seed.churchId}/edit`);
    await expect(page).toHaveURL(new RegExp(`/churches/${seed.churchId}$`));
    await expect(page.getByText('Donation QR')).toHaveCount(0);
  });

  test('a church admin still sees Edit on the parishes list', async ({ browser }) => {
    const admin = await pageAs(browser, 'church_admin');
    await admin.goto('/churches');
    await admin.getByRole('button', { name: 'List' }).click();
    await expect(admin.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible();
    await admin.context().close();
  });
});

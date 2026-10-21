import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, addMass, capture, clientAs, getSeed, loginAs, resetMassSchedules, serviceClient } from './support';

/**
 * Real end-to-end for the presiding priest on Mass schedules (ticket 03): the Celebrant badge on the
 * Liturgy tab (visible to a parishioner who cannot manage schedules), the "Presiding priest" select in the Add and Edit
 * modals (assign, change, clear), and the celebrant in the livestream standby countdown.
 */

const db = serviceClient();

const PRIEST_LABEL = 'Rev. Fr. Local Priest';
const PRIEST2_LABEL = 'Rev. Fr. Second Priest';

async function presidingPriests() {
  const seed = await getSeed();
  const { data, error } = await db
    .from('mass_schedules')
    .select('time,day_of_week,presiding_priest_id')
    .eq('church_id', seed.churchId)
    .order('time');
  if (error) throw error;
  return data;
}

async function openLiturgy(page: Page) {
  const seed = await getSeed();
  await page.goto(`/churches/${seed.churchId}`);
  await page.getByRole('button', { name: /^Liturgy/ }).click();
}

async function openLivestream(page: Page) {
  const seed = await getSeed();
  await page.goto(`/churches/${seed.churchId}`);
  await page.getByRole('button', { name: 'Livestream', exact: true }).click();
}

/** The player's standby card for the next Mass (exact, case-sensitive label so no other copy on the page can match). */
function standbyNextMass(page: Page) {
  return page.getByText('Next Scheduled Holy Mass', { exact: true }).locator('..');
}

function card(page: Page, time: string) {
  return page.getByTestId('mass-schedule-card').filter({ hasText: time });
}

test.beforeEach(async () => {
  await resetMassSchedules();
});

test.describe('Celebrant badge on the Liturgy tab', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('a parishioner sees the badge only on Masses with a presiding priest', async ({ page }) => {
    await addMass(0, '08:00:00', 'priest');
    await addMass(0, '10:00:00');

    await loginAs(page, 'parishioner');
    await openLiturgy(page);

    await expect(card(page, '8:00 AM')).toContainText(`Celebrant: ${PRIEST_LABEL}`);
    await expect(card(page, '10:00 AM')).toBeVisible();
    await expect(card(page, '10:00 AM')).not.toContainText('Celebrant');
    await expect(page.getByText('Celebrant:')).toHaveCount(1);
    await capture(page, 'presiding-priest-badge-parishioner');
  });

  test('shows nothing at all when no Mass has a presiding priest', async ({ page }) => {
    await addMass(0, '08:00:00');

    await loginAs(page, 'parishioner');
    await openLiturgy(page);

    await expect(card(page, '8:00 AM')).toBeVisible();
    await expect(page.getByText('Celebrant:')).toHaveCount(0);
  });

  test('the badge follows a change made in the database', async ({ page }) => {
    await addMass(0, '08:00:00', 'priest');
    await loginAs(page, 'parishioner');
    await openLiturgy(page);
    await expect(card(page, '8:00 AM')).toContainText(PRIEST_LABEL);

    const seed = await getSeed();
    await db.from('mass_schedules').update({ presiding_priest_id: seed.ids.priest2 }).eq('church_id', seed.churchId);
    await openLiturgy(page);
    await expect(card(page, '8:00 AM')).toContainText(`Celebrant: ${PRIEST2_LABEL}`);
  });
});

test.describe('The church page has no priest roster', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('a parish with priests shows no Parish Clergy section, no Book with Father button and no invented priest name', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parish team' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Parish Clergy' })).toHaveCount(0);
    await expect(page.getByTestId('parish-clergy-section')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Book with Father' })).toHaveCount(0);
    await expect(page.getByText('Assigned Clergy')).toHaveCount(0);
  });
});

test('the roster behind the badge resolves names for a logged-out client', async () => {
  const seed = await getSeed();
  const anon = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc('get_parish_clergy', { p_church_id: seed.churchId });
  expect(error).toBeNull();
  expect(data!.map((row: { priest_id: string; title: string; name: string }) => [row.priest_id, `${row.title} ${row.name}`])).toEqual(
    expect.arrayContaining([
      [seed.ids.priest, PRIEST_LABEL],
      [seed.ids.priest2, PRIEST2_LABEL],
    ]),
  );
});

test.describe('Presiding priest select in the schedule modals', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  // The mass_schedules write policy admits only the `admin` and `super_admin` roles, so the seeded
  // church admins are switched to `admin` for these tests and put back afterwards.
  test.beforeAll(async () => {
    const seed = await getSeed();
    const { error } = await db.from('profiles').update({ role: 'admin' }).in('id', [seed.ids.church_admin, seed.ids.other_admin]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    const seed = await getSeed();
    const { error } = await db.from('profiles').update({ role: 'church_admin' }).in('id', [seed.ids.church_admin, seed.ids.other_admin]);
    if (error) throw error;
  });

  test('Add lists only the parish priests plus Not assigned, and assigns the chosen priest', async ({ page }) => {
    await loginAs(page, 'church_admin');
    await openLiturgy(page);
    await page.getByRole('button', { name: 'Add schedule' }).click();

    const dialog = page.getByRole('dialog');
    const select = dialog.getByLabel('Presiding priest');
    await expect(select).toHaveValue('');
    await expect(select.locator('option')).toHaveText(['Not assigned', PRIEST_LABEL, PRIEST2_LABEL]);
    await capture(page, 'presiding-priest-add-modal');

    await dialog.locator('input[type="time"]').fill('07:30');
    await select.selectOption({ label: PRIEST_LABEL });
    await dialog.getByRole('button', { name: 'Add Schedule' }).click();

    await expect(dialog).toHaveCount(0);
    const seed = await getSeed();
    await expect.poll(presidingPriests).toEqual([{ time: '07:30:00', day_of_week: 'Sunday', presiding_priest_id: seed.ids.priest }]);
    await expect(card(page, '7:30 AM')).toContainText(`Celebrant: ${PRIEST_LABEL}`);
  });

  test('Add without choosing a priest stores no celebrant', async ({ page }) => {
    await loginAs(page, 'church_admin');
    await openLiturgy(page);
    await page.getByRole('button', { name: 'Add schedule' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="time"]').fill('09:00');
    await dialog.getByRole('button', { name: 'Add Schedule' }).click();

    await expect(dialog).toHaveCount(0);
    await expect.poll(presidingPriests).toEqual([{ time: '09:00:00', day_of_week: 'Sunday', presiding_priest_id: null }]);
    await expect(card(page, '9:00 AM')).toBeVisible();
    await expect(page.getByText('Celebrant:')).toHaveCount(0);
  });

  test('Edit assigns, changes and clears the presiding priest', async ({ page }) => {
    await addMass(0, '08:00:00');
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    await openLiturgy(page);

    const edit = async (label: string | null) => {
      await card(page, '8:00 AM').getByTitle('Edit schedule').click();
      const dialog = page.getByRole('dialog');
      const select = dialog.getByLabel('Presiding priest');
      await select.selectOption(label ? { label } : { value: '' });
      await dialog.getByRole('button', { name: 'Save Changes' }).click();
      await expect(dialog).toHaveCount(0);
    };

    // assign
    await edit(PRIEST_LABEL);
    await expect.poll(presidingPriests).toEqual([{ time: '08:00:00', day_of_week: 'Sunday', presiding_priest_id: seed.ids.priest }]);
    await expect(card(page, '8:00 AM')).toContainText(`Celebrant: ${PRIEST_LABEL}`);

    // the modal opens preselected on the current celebrant
    await card(page, '8:00 AM').getByTitle('Edit schedule').click();
    await expect(page.getByRole('dialog').getByLabel('Presiding priest')).toHaveValue(seed.ids.priest);
    await capture(page, 'presiding-priest-edit-modal');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    // change
    await edit(PRIEST2_LABEL);
    await expect.poll(presidingPriests).toEqual([{ time: '08:00:00', day_of_week: 'Sunday', presiding_priest_id: seed.ids.priest2 }]);
    await expect(card(page, '8:00 AM')).toContainText(`Celebrant: ${PRIEST2_LABEL}`);

    // clear
    await edit(null);
    await expect.poll(presidingPriests).toEqual([{ time: '08:00:00', day_of_week: 'Sunday', presiding_priest_id: null }]);
    await expect(card(page, '8:00 AM')).not.toContainText('Celebrant');
  });

  test('changing only the time keeps the presiding priest, and delete still works', async ({ page }) => {
    await addMass(0, '08:00:00', 'priest');
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    await openLiturgy(page);

    await card(page, '8:00 AM').getByTitle('Edit schedule').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="time"]').fill('11:00');
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(presidingPriests).toEqual([{ time: '11:00:00', day_of_week: 'Sunday', presiding_priest_id: seed.ids.priest }]);

    page.once('dialog', (d) => d.accept());
    await card(page, '11:00 AM').getByTitle('Delete schedule').click();
    await expect.poll(presidingPriests).toEqual([]);
    await expect(page.getByText('Celebrant:')).toHaveCount(0);
  });

  test('a parishioner cannot manage schedules and sees no Presiding priest select', async ({ page }) => {
    await addMass(0, '08:00:00', 'priest');
    await loginAs(page, 'parishioner');
    await openLiturgy(page);

    await expect(card(page, '8:00 AM')).toContainText(`Celebrant: ${PRIEST_LABEL}`);
    await expect(page.getByRole('button', { name: 'Add schedule' })).toHaveCount(0);
    await expect(page.getByTitle('Edit schedule')).toHaveCount(0);
  });

  test('a church admin cannot assign a priest to a Mass of another parish', async () => {
    const seed = await getSeed();
    await addMass(0, '08:00:00');
    const { data } = await db.from('mass_schedules').select('id').eq('church_id', seed.churchId).single();
    const otherAdmin = await clientAs('other_admin');
    const { data: updated } = await otherAdmin
      .from('mass_schedules')
      .update({ presiding_priest_id: seed.ids.priest })
      .eq('id', data!.id)
      .select();
    expect(updated ?? []).toHaveLength(0);
    expect((await presidingPriests())[0].presiding_priest_id).toBeNull();
  });
});

test.describe('Celebrant in the livestream standby countdown', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('shows the celebrant of the next scheduled Mass to a parishioner', async ({ page }) => {
    await addMass(0, '08:00:00', 'priest');
    const seed = await getSeed();
    await db.from('churches').update({ is_live: false, livestream_url: null }).eq('id', seed.churchId);

    await loginAs(page, 'parishioner');
    await openLivestream(page);

    await expect(standbyNextMass(page)).toBeVisible();
    await expect(standbyNextMass(page)).toContainText(`Celebrant: ${PRIEST_LABEL}`);
    await capture(page, 'presiding-priest-livestream-standby');
  });

  test('shows no celebrant line when the next Mass has none', async ({ page }) => {
    await addMass(0, '08:00:00');
    const seed = await getSeed();
    await db.from('churches').update({ is_live: false, livestream_url: null }).eq('id', seed.churchId);

    await loginAs(page, 'parishioner');
    await openLivestream(page);

    await expect(standbyNextMass(page)).toBeVisible();
    await expect(standbyNextMass(page)).not.toContainText('Celebrant:');
  });
});

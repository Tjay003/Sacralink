import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  LOCAL_URL,
  addLeave,
  addMass,
  addWeeklyDayOff,
  capture,
  getSeed,
  isoDate,
  loginAs,
  resetMassSchedules,
  resetPriestAvailability,
  serviceClient,
} from './support';

/**
 * Real end-to-end for the Parish Clergy section of the church page (ticket 04): the roster, the
 * Available / In Mass / On Leave badges, the "Book with Father" shortcut, and the guarantee that leave
 * reasons, emails and phone numbers never reach the roster. The web app sends logged-out visitors to
 * /login before any church page, so the logged-out criterion is proved at the RPC level with the anon key.
 */

const db = serviceClient();

const LEAVE_REASON = 'Medical leave: do not disclose';
const DAY_OFF_REASON = 'Personal retreat day, confidential';
const PRIEST_LABEL = 'Rev. Fr. Local Priest';
const PRIEST2_LABEL = 'Rev. Fr. Second Priest';

interface RosterRow {
  priest_id: string;
  name: string;
  title: string;
  designation: string;
  status: string;
}

function anon() {
  return createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The current weekday index (0 = Sunday) and clock time in Philippine time, the timezone the roster reads. */
function manilaNow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return { dow: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
}

/** Seeds a presiding Mass that started 20 minutes ago (or at midnight just after midnight), so the priest is in Mass now. */
async function addMassInProgress(role: 'priest' | 'priest2') {
  const { dow, minutes } = manilaNow();
  const start = Math.max(0, minutes - 20);
  const pad = (n: number) => String(n).padStart(2, '0');
  await addMass(dow, `${pad(Math.floor(start / 60))}:${pad(start % 60)}:00`, role);
}

async function anonRoster(churchId: string) {
  const { data, error } = await anon().rpc('get_parish_clergy', { p_church_id: churchId });
  expect(error).toBeNull();
  return data as RosterRow[];
}

function clergySection(page: Page) {
  return page.getByTestId('parish-clergy-section');
}

function clergyCard(page: Page, name: string) {
  return page.getByTestId('clergy-card').filter({ hasText: name });
}

async function openChurch(page: Page, churchId: string) {
  await page.goto(`/churches/${churchId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.beforeEach(async () => {
  await resetPriestAvailability();
  await resetMassSchedules();
});

test.afterAll(async () => {
  await resetPriestAvailability();
  await resetMassSchedules();
});

test.describe('The roster as a logged-out visitor sees it (RPC with the anon key)', () => {
  test('lists the parish priests with title, designation and status only', async () => {
    const seed = await getSeed();
    await addLeave('priest', isoDate(-1), isoDate(1), LEAVE_REASON);
    await addWeeklyDayOff('priest2', manilaNow().dow, DAY_OFF_REASON);
    await db.from('profiles').update({ phone_number: '+639170000000' }).eq('id', seed.ids.priest);

    try {
      const rows = await anonRoster(seed.churchId);
      expect(rows.map((r) => `${r.title} ${r.name}`)).toEqual([PRIEST_LABEL, PRIEST2_LABEL]);
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['designation', 'name', 'priest_id', 'status', 'title']);
        expect(row.designation).toBe('Priest');
      }
      const body = JSON.stringify(rows);
      expect(body).not.toContain(LEAVE_REASON);
      expect(body).not.toContain(DAY_OFF_REASON);
      expect(body).not.toContain('@local.test');
      expect(body).not.toContain('+639170000000');
    } finally {
      await db.from('profiles').update({ phone_number: null }).eq('id', seed.ids.priest);
    }
  });

  test('reports on_leave for a blackout and for a weekly day off, in_mass for a presiding Mass in progress, available otherwise', async () => {
    const seed = await getSeed();
    const statuses = async () => Object.fromEntries((await anonRoster(seed.churchId)).map((r) => [r.priest_id, r.status]));

    expect(await statuses()).toEqual({ [seed.ids.priest]: 'available', [seed.ids.priest2]: 'available' });

    await addLeave('priest', isoDate(-1), isoDate(1), LEAVE_REASON);
    await addWeeklyDayOff('priest2', manilaNow().dow, DAY_OFF_REASON);
    expect(await statuses()).toEqual({ [seed.ids.priest]: 'on_leave', [seed.ids.priest2]: 'on_leave' });

    await resetPriestAvailability();
    await addMassInProgress('priest2');
    expect(await statuses()).toEqual({ [seed.ids.priest]: 'available', [seed.ids.priest2]: 'in_mass' });
  });

  test('a parish with no priests returns an empty roster', async () => {
    const seed = await getSeed();
    expect(await anonRoster(seed.otherChurchId)).toEqual([]);
  });
});

test.describe('Parish Clergy section on the church page', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('shows a card per priest with name, designation and Available status', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    const section = clergySection(page);
    await expect(section.getByRole('heading', { name: 'Parish Clergy' })).toBeVisible();
    await expect(page.getByTestId('clergy-card')).toHaveCount(2);
    for (const label of [PRIEST_LABEL, PRIEST2_LABEL]) {
      const card = clergyCard(page, label);
      await expect(card).toContainText('Priest');
      await expect(card.getByTestId('clergy-status')).toHaveText('Available');
      await expect(card.getByRole('button', { name: 'Book with Father' })).toBeVisible();
    }
    await capture(page, 'church-clergy-roster-available');
  });

  test('shows On Leave for a blackout and for a weekly day off, without any reason', async ({ page }) => {
    const seed = await getSeed();
    await addLeave('priest', isoDate(-1), isoDate(1), LEAVE_REASON);
    await addWeeklyDayOff('priest2', manilaNow().dow, DAY_OFF_REASON);

    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await expect(clergyCard(page, PRIEST_LABEL).getByTestId('clergy-status')).toHaveText('On Leave');
    await expect(clergyCard(page, PRIEST2_LABEL).getByTestId('clergy-status')).toHaveText('On Leave');
    await capture(page, 'church-clergy-roster-on-leave');

    const html = await page.content();
    expect(html).not.toContain(LEAVE_REASON);
    expect(html).not.toContain(DAY_OFF_REASON);
    await expect(clergySection(page)).not.toContainText('@');
    expect(requested.filter((url) => url.includes('priest_availability'))).toEqual([]);
  });

  test('shows In Mass for a priest whose presiding Mass started within the hour, and Available for the other', async ({ page }) => {
    const seed = await getSeed();
    await addMassInProgress('priest');

    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await expect(clergyCard(page, PRIEST_LABEL).getByTestId('clergy-status')).toHaveText('In Mass');
    await expect(clergyCard(page, PRIEST2_LABEL).getByTestId('clergy-status')).toHaveText('Available');
    await capture(page, 'church-clergy-roster-in-mass');
  });

  test('leave outranks In Mass on the card', async ({ page }) => {
    const seed = await getSeed();
    await addMassInProgress('priest');
    await addWeeklyDayOff('priest', manilaNow().dow, DAY_OFF_REASON);

    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await expect(clergyCard(page, PRIEST_LABEL).getByTestId('clergy-status')).toHaveText('On Leave');
  });

  test('a parish with no priests shows no clergy section', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.otherChurchId);

    await expect(page.getByRole('heading', { name: 'Parish team' })).toBeVisible();
    await expect(clergySection(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Parish Clergy' })).toHaveCount(0);
  });

  test('an admin account flagged is_priest appears in its parish roster as a Parish Administrator', async ({ page }) => {
    const seed = await getSeed();
    const { error } = await db.from('profiles').update({ role: 'admin', is_priest: true }).eq('id', seed.ids.church_admin);
    if (error) throw error;

    try {
      await loginAs(page, 'parishioner');
      await openChurch(page, seed.churchId);

      await expect(page.getByTestId('clergy-card')).toHaveCount(3);
      const card = clergyCard(page, 'Local Church Admin');
      await expect(card).toContainText('Parish Administrator');
      await expect(card.getByTestId('clergy-status')).toHaveText('Available');
    } finally {
      await db.from('profiles').update({ role: 'church_admin', is_priest: false }).eq('id', seed.ids.church_admin);
    }
  });

  test('Book with Father opens the booking flow for that church', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await clergyCard(page, PRIEST2_LABEL).getByRole('button', { name: 'Book with Father' }).click();

    await expect(page).toHaveURL(new RegExp(`/churches/${seed.churchId}/book$`));
    await expect(page.getByRole('heading', { name: 'Book an Appointment' })).toBeVisible();
    await expect(page.getByText('Request a sacrament or service at Local Test Parish')).toBeVisible();
  });

  test('a priest seen on leave stays bookable: the shortcut is never disabled', async ({ page }) => {
    const seed = await getSeed();
    await addWeeklyDayOff('priest', manilaNow().dow, DAY_OFF_REASON);
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await expect(clergyCard(page, PRIEST_LABEL).getByRole('button', { name: 'Book with Father' })).toBeEnabled();
  });
});

test.describe('Priest names on the church page come from the roster', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('the header, Quick facts and the roster agree and summarise several priests as a count', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.churchId);

    await expect(page.getByTestId('parish-priest-summary')).toHaveText('2 priests');
    await expect(page.getByTestId('parish-priest-summary')).not.toContainText('Second Priest');
    await expect(page.getByTestId('quick-fact-clergy')).toContainText('2 priests');
  });

  test('with a single priest the header names him with his title', async ({ page }) => {
    const seed = await getSeed();
    const { error } = await db.from('profiles').update({ assigned_church_id: null, church_id: null }).eq('id', seed.ids.priest2);
    if (error) throw error;

    try {
      await loginAs(page, 'parishioner');
      await openChurch(page, seed.churchId);

      await expect(page.getByTestId('parish-priest-summary')).toHaveText(PRIEST_LABEL);
      await expect(page.getByTestId('quick-fact-clergy')).toContainText(PRIEST_LABEL);
      await expect(page.getByTestId('clergy-card')).toHaveCount(1);
    } finally {
      await db.from('profiles').update({ assigned_church_id: seed.churchId, church_id: seed.churchId }).eq('id', seed.ids.priest2);
    }
  });

  test('a parish without priests shows no priest line and no invented name', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'parishioner');
    await openChurch(page, seed.otherChurchId);

    await expect(page.getByTestId('parish-priest-summary')).toHaveCount(0);
    await expect(page.getByTestId('quick-fact-clergy')).toHaveCount(0);
    await expect(page.getByText('Assigned Clergy')).toHaveCount(0);
  });
});

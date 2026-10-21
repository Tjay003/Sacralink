import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  LOCAL_URL,
  PASSWORD,
  STARTER_SERVICES,
  clientAs,
  createApprovedAppointment,
  createPendingAppointment,
  firstWeekdayOffset,
  getSeed,
  isoDate,
  loginAs,
  resetAppointmentData,
  resetMassSchedules,
  resetPriestAvailability,
  resetServiceTypes,
  serviceClient,
  serviceTypeByName,
} from './support';

/**
 * Real end-to-end for church-owned service types (ticket 16): every parish owns its list of services
 * (church_service_types), appointments and checklists link to a service by id, the booking form lists the
 * parish's own visible services with their descriptions, renames follow everywhere, and clients that only
 * know the old text columns (the live web build, the mobile app) keep working through the link triggers.
 */

const db = serviceClient();

/** A weekday (never a Sunday) far enough ahead to be bookable. */
function weekdayDate(fromDays = 21): string {
  return isoDate(firstWeekdayOffset(fromDays));
}

async function openBooking(page: Page, churchId: string) {
  await page.goto(`/churches/${churchId}/book`);
  await expect(page.getByLabel(/Preferred Date/i)).toBeVisible();
}

async function fillSlot(page: Page, date: string, time: string) {
  await page.getByLabel(/Preferred Date/i).fill(date);
  await page.getByLabel(/Preferred Time/i).fill(time);
}

async function optionLabels(page: Page): Promise<string[]> {
  return page.getByLabel('Service Type').locator('option').allTextContents();
}

async function appointments() {
  const { data, error } = await db.from('appointments').select('*').order('created_at');
  if (error) throw error;
  return data ?? [];
}

/** Adds a service to a parish with the service role and returns its row. */
async function addService(
  churchId: string,
  name: string,
  extra: Record<string, unknown> = {}
): Promise<{ id: string; name: string; kind: string | null }> {
  const { data, error } = await db
    .from('church_service_types')
    .insert({ church_id: churchId, name, ...extra })
    .select('id,name,kind')
    .single();
  if (error) throw error;
  return data;
}

/** A checklist document linked to a service by id, written the way the Services & Documents manager will. */
async function addRequirement(
  churchId: string,
  service: { id: string; name: string },
  requirementName: string,
  isRequired = true,
  order = 1
) {
  const { data, error } = await db
    .from('sacrament_requirements')
    .insert({
      church_id: churchId,
      service_type: service.name.toLowerCase(),
      service_type_id: service.id,
      requirement_name: requirementName,
      is_required: isRequired,
      display_order: order,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

interface TempUser {
  id: string;
  client: SupabaseClient;
}
const tempEmails: string[] = [];

/** A throwaway signed-in user with the given role, assigned to a parish. */
async function tempUser(label: string, role: string, churchId: string): Promise<TempUser> {
  const email = `${label}@local.test`;
  tempEmails.push(email);
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const { error: profileErr } = await db.from('profiles').upsert({
    id,
    email,
    full_name: `Temp ${label}`,
    role,
    church_id: churchId,
    assigned_church_id: churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
  return { id, client };
}

test.beforeEach(async () => {
  await resetServiceTypes();
  await resetPriestAvailability();
  await resetMassSchedules();
});

test.afterAll(async () => {
  await resetServiceTypes();
  await resetPriestAvailability();
  await resetMassSchedules();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const email of tempEmails) {
    const found = list?.users.find((u) => u.email === email);
    if (found) await db.auth.admin.deleteUser(found.id);
  }
});

test.describe('Starter services and the backfill', () => {
  test('each seeded parish owns the six starter services in booking order', async () => {
    const seed = await getSeed();
    for (const churchId of [seed.churchId, seed.otherChurchId]) {
      const { data, error } = await db
        .from('church_service_types')
        .select('name,kind,is_hidden,deleted_at,description')
        .eq('church_id', churchId)
        .order('display_order');
      expect(error).toBeNull();
      expect(data?.map((row) => row.name)).toEqual(STARTER_SERVICES);
      expect(data?.map((row) => row.kind)).toEqual(STARTER_SERVICES.map((name) => name.toLowerCase()));
      expect(data?.every((row) => !row.is_hidden && row.deleted_at === null)).toBe(true);
    }
  });

  test('seeding is idempotent and never brings back a deleted or renamed starter', async () => {
    const seed = await getSeed();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    await db.from('church_service_types').update({ name: 'Burial Service' }).eq('id', funeral!.id);
    const blessing = await serviceTypeByName(seed.churchId, 'Blessing');
    await db.from('church_service_types').update({ deleted_at: new Date().toISOString() }).eq('id', blessing!.id);

    const { error } = await db.rpc('seed_church_service_types', { p_church_id: seed.churchId });
    expect(error).toBeNull();
    const { data } = await db.from('church_service_types').select('name,deleted_at').eq('church_id', seed.churchId);
    expect(data).toHaveLength(6);
    expect(data?.map((row) => row.name).sort()).toEqual(['Baptism', 'Blessing', 'Burial Service', 'Confirmation', 'Other', 'Wedding']);
  });

  test('a new parish gets the six, only an authorised caller can seed, and a stranger cannot', async () => {
    const { data: church, error: churchErr } = await db
      .from('churches')
      .insert({ name: 'Brand New Parish', address: '2 Test Street', status: 'verified_active', is_active: true })
      .select('id')
      .single();
    if (churchErr) throw churchErr;
    try {
      const stranger = await clientAs('other_admin');
      const denied = await stranger.rpc('seed_church_service_types', { p_church_id: church.id });
      expect(denied.error?.code).toBe('42501');
      const parishioner = await clientAs('parishioner');
      expect((await parishioner.rpc('seed_church_service_types', { p_church_id: church.id })).error?.code).toBe('42501');
      expect((await db.from('church_service_types').select('id').eq('church_id', church.id)).data).toHaveLength(0);

      const own = await tempUser('seed-owner', 'church_admin', church.id);
      const seeded = await own.client.rpc('seed_church_service_types', { p_church_id: church.id });
      expect(seeded.error).toBeNull();
      expect(seeded.data?.map((row: { name: string }) => row.name)).toEqual(STARTER_SERVICES);
      const again = await own.client.rpc('seed_church_service_types', { p_church_id: church.id });
      expect(again.error).toBeNull();
      expect((await db.from('church_service_types').select('id').eq('church_id', church.id)).data).toHaveLength(6);
    } finally {
      await db.from('churches').delete().eq('id', church.id);
    }
  });

  test('the backfill creates the six, links legacy rows by lowercased text, creates hidden types for unmatched text and never rewrites text', async () => {
    const seed = await getSeed();
    const { data: church, error: churchErr } = await db
      .from('churches')
      .insert({ name: 'Backfill Parish', address: '3 Test Street', status: 'verified_active', is_active: true })
      .select('id')
      .single();
    if (churchErr) throw churchErr;
    try {
      const base = {
        user_id: seed.ids.parishioner,
        church_id: church.id,
        appointment_date: weekdayDate(),
        appointment_time: '09:00:00',
        status: 'approved',
      };
      const legacyAppointments = ['Wedding', 'Funeral', 'WEDDING', 'Mass Intention'];
      const insertedIds: string[] = [];
      for (const serviceType of legacyAppointments) {
        const { data, error } = await db.from('appointments').insert({ ...base, service_type: serviceType }).select('id').single();
        if (error) throw error;
        insertedIds.push(data.id);
      }
      const legacyRequirements = [
        { service_type: 'wedding', requirement_name: 'Baptismal Certificate' },
        { service_type: 'baptism', requirement_name: 'Birth Certificate' },
        { service_type: 'counseling', requirement_name: 'Letter' },
      ];
      for (const row of legacyRequirements) {
        const { error } = await db.from('sacrament_requirements').insert({ church_id: church.id, ...row });
        if (error) throw error;
      }

      // Recreate the state production is in: text only, no links, no service types
      await db.from('appointments').update({ service_type_id: null }).eq('church_id', church.id);
      // The link trigger normalised the text on insert; put the original legacy spelling back
      for (const [index, serviceType] of legacyAppointments.entries()) {
        await db.from('appointments').update({ service_type: serviceType }).eq('id', insertedIds[index]);
      }
      await db.from('sacrament_requirements').update({ service_type_id: null }).eq('church_id', church.id);
      await db.from('church_service_types').delete().eq('church_id', church.id);
      expect((await db.from('church_service_types').select('id').eq('church_id', church.id)).data).toHaveLength(0);

      const first = await db.rpc('backfill_church_service_types');
      expect(first.error).toBeNull();
      expect(first.data.appointments_linked).toBeGreaterThanOrEqual(4);
      expect(first.data.requirements_linked).toBeGreaterThanOrEqual(3);

      const { data: types } = await db
        .from('church_service_types')
        .select('id,name,kind,is_hidden,display_order')
        .eq('church_id', church.id)
        .order('display_order');
      const names = types!.map((row) => row.name);
      expect(names.slice(0, 6)).toEqual(STARTER_SERVICES);
      expect(types!.slice(0, 6).every((row) => !row.is_hidden)).toBe(true);
      // Unmatched text becomes a hidden type of that parish, not an unlinked row
      const extras = types!.slice(6);
      expect(extras.map((row) => row.name).sort()).toEqual(['Mass Intention', 'counseling']);
      expect(extras.every((row) => row.is_hidden && row.kind === null)).toBe(true);

      const { data: apts } = await db.from('appointments').select('service_type,service_type_id').eq('church_id', church.id);
      expect(apts).toHaveLength(4);
      expect(apts!.every((row) => row.service_type_id !== null)).toBe(true);
      expect(apts!.map((row) => row.service_type).sort()).toEqual([...legacyAppointments].sort());
      const wedding = types!.find((row) => row.name === 'Wedding')!;
      expect(apts!.filter((row) => row.service_type_id === wedding.id).map((row) => row.service_type).sort()).toEqual(['WEDDING', 'Wedding']);

      const { data: reqs } = await db.from('sacrament_requirements').select('service_type,service_type_id').eq('church_id', church.id);
      expect(reqs).toHaveLength(3);
      expect(reqs!.every((row) => row.service_type_id !== null)).toBe(true);
      expect(reqs!.map((row) => row.service_type).sort()).toEqual(['baptism', 'counseling', 'wedding']);
      expect(reqs!.find((row) => row.service_type === 'wedding')!.service_type_id).toBe(wedding.id);

      const second = await db.rpc('backfill_church_service_types');
      expect(second.error).toBeNull();
      expect(second.data.churches_seeded).toBe(0);
      expect(second.data.appointments_linked).toBe(0);
      expect(second.data.requirements_linked).toBe(0);
      expect(second.data.types_created_from_text).toBe(0);
      expect((await db.from('church_service_types').select('id').eq('church_id', church.id)).data).toHaveLength(8);
    } finally {
      await db.from('churches').delete().eq('id', church.id);
    }
  });

  test('the backfill is callable by the service role only', async () => {
    const parishioner = await clientAs('parishioner');
    expect((await parishioner.rpc('backfill_church_service_types')).error).not.toBeNull();
    const admin = await clientAs('church_admin');
    expect((await admin.rpc('backfill_church_service_types')).error).not.toBeNull();
  });
});

test.describe('Booking lists the parish own services', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });
  test.beforeEach(async () => {
    await resetAppointmentData();
  });

  test('shows only visible, non-deleted services in display order with the description under the select', async ({ page }) => {
    const seed = await getSeed();
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    await db.from('church_service_types').update({ is_hidden: true }).eq('id', wedding!.id);
    const blessing = await serviceTypeByName(seed.churchId, 'Blessing');
    await db.from('church_service_types').update({ deleted_at: new Date().toISOString() }).eq('id', blessing!.id);
    await addService(seed.churchId, 'First Communion', { display_order: 0, description: 'For children preparing for their first Holy Communion.' });
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    await db.from('church_service_types').update({ description: 'Includes the pre-baptismal seminar.' }).eq('id', baptism!.id);

    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);

    expect(await optionLabels(page)).toEqual(['First Communion', 'Baptism', 'Funeral', 'Confirmation', 'Other']);
    const description = page.getByTestId('service-description');
    await expect(page.getByLabel('Service Type')).toHaveValue(/.+/);
    await expect(description).toHaveText('For children preparing for their first Holy Communion.');

    await page.getByLabel('Service Type').selectOption({ label: 'Baptism' });
    await expect(description).toHaveText('Includes the pre-baptismal seminar.');

    await page.getByLabel('Service Type').selectOption({ label: 'Funeral' });
    await expect(description).toHaveCount(0);
  });

  test('another parish keeps its own list, so a change in one never shows in the other', async ({ page }) => {
    const seed = await getSeed();
    await addService(seed.otherChurchId, 'Home Visit', { display_order: 7 });
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.otherChurchId);
    expect(await optionLabels(page)).toEqual([...STARTER_SERVICES, 'Home Visit']);
    await openBooking(page, seed.churchId);
    expect(await optionLabels(page)).toEqual(STARTER_SERVICES);
  });

  test('a parish with nothing bookable shows a clear message instead of the form', async ({ page }) => {
    const { data: church, error } = await db
      .from('churches')
      .insert({ name: 'Empty Services Parish', address: '4 Test Street', status: 'verified_active', is_active: true })
      .select('id')
      .single();
    if (error) throw error;
    try {
      await loginAs(page, 'parishioner');
      await page.goto(`/churches/${church.id}/book`);
      const message = page.getByTestId('no-services-message');
      await expect(message).toBeVisible();
      await expect(message).toContainText('not accepting online appointment requests');
      await expect(page.getByLabel(/Preferred Date/i)).toHaveCount(0);

      // Hiding every service of a parish that had a list has the same effect
      const seed = await getSeed();
      await db.from('church_service_types').update({ is_hidden: true }).eq('church_id', seed.otherChurchId);
      await page.goto(`/churches/${seed.otherChurchId}/book`);
      await expect(page.getByTestId('no-services-message')).toBeVisible();
    } finally {
      await db.from('churches').delete().eq('id', church.id);
    }
  });

  test('books a custom service: the appointment links to it by id and keeps its name', async ({ page }) => {
    const seed = await getSeed();
    const custom = await addService(seed.churchId, 'First Communion', { description: 'Preparation required.' });
    await addRequirement(seed.churchId, custom, 'Baptismal Certificate', false);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await page.getByLabel('Service Type').selectOption({ label: 'First Communion' });
    await fillSlot(page, weekdayDate(), '10:00');
    await expect(page.getByText('Baptismal Certificate')).toBeVisible();
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByText('Request Sent!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('First Communion').first()).toBeVisible();

    const rows = await appointments();
    expect(rows).toHaveLength(1);
    expect(rows[0].service_type).toBe('First Communion');
    expect(rows[0].service_type_id).toBe(custom.id);
    expect(rows[0].status).toBe('pending');
  });

  test('the checklist follows the chosen service by id and a required document blocks the request', async ({ page }) => {
    const seed = await getSeed();
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    await addRequirement(seed.churchId, wedding!, 'Marriage License', true, 1);
    await addRequirement(seed.churchId, wedding!, 'Pre-Cana Certificate', false, 2);
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    await fillSlot(page, weekdayDate(), '10:00');

    // Baptism has no checklist: no upload section at all
    await expect(page.getByText('Required Documents')).toHaveCount(0);

    await page.getByLabel('Service Type').selectOption({ label: 'Wedding' });
    await expect(page.getByText('Marriage License')).toBeVisible();
    await expect(page.getByText('Pre-Cana Certificate')).toBeVisible();
    await page.getByRole('button', { name: /Submit Request/i }).click();
    await expect(page.getByRole('alert')).toContainText('Missing required document: Marriage License');
    expect(await appointments()).toHaveLength(0);

    await page.getByLabel('Service Type').selectOption({ label: 'Blessing' });
    await expect(page.getByText('Marriage License', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Required Documents')).toHaveCount(0);
  });

  test('a hidden service leaves the booking form but its appointments still show to the office', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ serviceType: 'Wedding', daysFromToday: 30 });
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    await db.from('church_service_types').update({ is_hidden: true }).eq('id', wedding!.id);

    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    expect(await optionLabels(page)).toEqual(['Baptism', 'Funeral', 'Confirmation', 'Blessing', 'Other']);

    const office = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
    const officePage = await office.newPage();
    await loginAs(officePage, 'church_admin');
    await officePage.goto('/appointments');
    await expect(officePage.locator('table').locator('tr', { hasText: 'Matrimony' })).toBeVisible();
    await office.close();

    // Unhiding restores it to the form
    await db.from('church_service_types').update({ is_hidden: false }).eq('id', wedding!.id);
    await openBooking(page, seed.churchId);
    expect(await optionLabels(page)).toEqual(STARTER_SERVICES);
  });
});

test.describe('Rename, hide, delete and restore', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('renaming a service updates existing appointments and checklist text but keeps the checklist linked', async ({ page }) => {
    const seed = await getSeed();
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    const requirementId = await addRequirement(seed.churchId, baptism!, 'Birth Certificate', true);
    const past = await createApprovedAppointment({ serviceType: 'Baptism', daysFromToday: -10 });
    const upcoming = await createPendingAppointment({ serviceType: 'Baptism', daysFromToday: 20 });

    const admin = await clientAs('church_admin');
    const { error } = await admin.from('church_service_types').update({ name: 'Christening' }).eq('id', baptism!.id);
    expect(error).toBeNull();

    const { data: rows } = await db.from('appointments').select('id,service_type,service_type_id').in('id', [past, upcoming]);
    expect(rows!.every((row) => row.service_type === 'Christening' && row.service_type_id === baptism!.id)).toBe(true);
    const { data: req } = await db.from('sacrament_requirements').select('service_type,service_type_id,requirement_name').eq('id', requirementId).single();
    expect(req).toEqual({ service_type: 'christening', service_type_id: baptism!.id, requirement_name: 'Birth Certificate' });

    // Booking offers the new name with the same checklist
    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    expect((await optionLabels(page))[0]).toBe('Christening');
    await fillSlot(page, weekdayDate(), '10:00');
    await expect(page.getByText('Birth Certificate')).toBeVisible();
  });

  test('a rename never overwrites other parishes and a conflicting name is refused', async () => {
    const seed = await getSeed();
    await createPendingAppointment({ serviceType: 'Baptism' });
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    const admin = await clientAs('church_admin');
    await admin.from('church_service_types').update({ name: 'Christening' }).eq('id', baptism!.id);
    const other = await serviceTypeByName(seed.otherChurchId, 'Baptism');
    expect(other?.name).toBe('Baptism');

    const clash = await admin.from('church_service_types').update({ name: 'wedding' }).eq('id', baptism!.id);
    expect(clash.error?.code).toBe('23505');
    expect((await serviceTypeByName(seed.churchId, 'Christening'))?.id).toBe(baptism!.id);
    expect((await appointments())[0].service_type).toBe('Christening');
  });

  test('deleting a service with appointments soft-deletes it and the appointments keep working', async ({ page }) => {
    const seed = await getSeed();
    const apptId = await createApprovedAppointment({ serviceType: 'Confirmation', daysFromToday: 25 });
    const confirmation = await serviceTypeByName(seed.churchId, 'Confirmation');
    const reqId = await addRequirement(seed.churchId, confirmation!, 'Sponsor Certificate');

    const admin = await clientAs('church_admin');
    const result = await admin.rpc('delete_church_service_type', { p_service_type_id: confirmation!.id });
    expect(result.error).toBeNull();
    expect(result.data).toBe('archived');

    const { data: row } = await db.from('church_service_types').select('deleted_at').eq('id', confirmation!.id).single();
    expect(row?.deleted_at).not.toBeNull();
    const { data: apt } = await db.from('appointments').select('service_type,service_type_id').eq('id', apptId).single();
    expect(apt).toEqual({ service_type: 'Confirmation', service_type_id: confirmation!.id });
    // History survives: the checklist rows stay attached to the archived service
    expect((await db.from('sacrament_requirements').select('id').eq('id', reqId)).data).toHaveLength(1);

    await loginAs(page, 'parishioner');
    await openBooking(page, seed.churchId);
    expect(await optionLabels(page)).toEqual(['Baptism', 'Wedding', 'Funeral', 'Blessing', 'Other']);

    // The deleted name is free again for a brand new service
    const reuse = await admin.from('church_service_types').insert({ church_id: seed.churchId, name: 'Confirmation' }).select('id').single();
    expect(reuse.error).toBeNull();
    expect(reuse.data?.id).not.toBe(confirmation!.id);
  });

  test('deleting a service nobody booked removes it and its checklist for good', async () => {
    const seed = await getSeed();
    const custom = await addService(seed.churchId, 'Pilgrimage Blessing');
    const reqId = await addRequirement(seed.churchId, custom, 'Itinerary');

    const admin = await clientAs('church_admin');
    const result = await admin.rpc('delete_church_service_type', { p_service_type_id: custom.id });
    expect(result.error).toBeNull();
    expect(result.data).toBe('deleted');
    expect((await db.from('church_service_types').select('id').eq('id', custom.id)).data).toHaveLength(0);
    expect((await db.from('sacrament_requirements').select('id').eq('id', reqId)).data).toHaveLength(0);
  });

  test('a renamed Funeral keeps the Urgent flag on pending requests', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ serviceType: 'Funeral', daysFromToday: 10 });
    await loginAs(page, 'church_admin');
    await page.goto('/appointments');
    const funeralRow = page.locator('table').locator('tr', { hasText: 'Funeral / Burial' });
    await expect(funeralRow.getByText('Urgent')).toBeVisible();

    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    expect(funeral?.kind).toBe('funeral');
    const admin = await clientAs('church_admin');
    await admin.from('church_service_types').update({ name: 'Memorial Service' }).eq('id', funeral!.id);
    await page.goto('/appointments');
    const renamedRow = page.locator('table').locator('tr', { hasText: 'Memorial Service' });
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow.getByText('Urgent')).toBeVisible();

    // An ordinary service is not flagged
    await createPendingAppointment({ serviceType: 'Blessing', daysFromToday: 12, time: '14:00:00' });
    await page.goto('/appointments');
    await expect(page.locator('table').locator('tr', { hasText: 'Blessing' }).getByText('Urgent')).toHaveCount(0);
  });
});

test.describe('Names', () => {
  test('are unique per parish regardless of case, required and trimmed', async () => {
    const seed = await getSeed();
    const admin = await clientAs('church_admin');

    const duplicate = await admin.from('church_service_types').insert({ church_id: seed.churchId, name: 'baptism' });
    expect(duplicate.error?.code).toBe('23505');
    const spaced = await admin.from('church_service_types').insert({ church_id: seed.churchId, name: '  WEDDING ' });
    expect(spaced.error?.code).toBe('23505');
    const blank = await admin.from('church_service_types').insert({ church_id: seed.churchId, name: '   ' });
    expect(blank.error).not.toBeNull();

    const trimmed = await admin
      .from('church_service_types')
      .insert({ church_id: seed.churchId, name: '  Pilgrimage Blessing  ', description: '   ' })
      .select('name,description')
      .single();
    expect(trimmed.error).toBeNull();
    expect(trimmed.data).toEqual({ name: 'Pilgrimage Blessing', description: null });

    // The same name in another parish is fine
    const sibling = await db.from('church_service_types').insert({ church_id: seed.otherChurchId, name: 'Pilgrimage Blessing' });
    expect(sibling.error).toBeNull();
  });
});

test.describe('Who can write (RLS)', () => {
  test('the parish church admin can add, edit, hide and reorder but not remove rows directly', async () => {
    const seed = await getSeed();
    const admin = await clientAs('church_admin');
    const created = await admin
      .from('church_service_types')
      .insert({ church_id: seed.churchId, name: 'Anointing of the Sick', description: 'At home or in hospital.', display_order: 9 })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    const edited = await admin
      .from('church_service_types')
      .update({ is_hidden: true, display_order: 3, description: 'Updated.' })
      .eq('id', id)
      .select('is_hidden,display_order,description')
      .single();
    expect(edited.error).toBeNull();
    expect(edited.data).toEqual({ is_hidden: true, display_order: 3, description: 'Updated.' });

    await admin.from('church_service_types').delete().eq('id', id);
    expect((await db.from('church_service_types').select('id').eq('id', id)).data).toHaveLength(1);
  });

  test('a church admin of another parish cannot insert, edit, move, delete or seed', async () => {
    const seed = await getSeed();
    const stranger = await clientAs('other_admin');
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');

    const insert = await stranger.from('church_service_types').insert({ church_id: seed.churchId, name: 'Intruder' });
    expect(insert.error?.code).toBe('42501');

    const update = await stranger.from('church_service_types').update({ name: 'Hijacked' }).eq('id', baptism!.id).select('id');
    expect(update.data ?? []).toHaveLength(0);

    const move = await stranger.from('church_service_types').update({ church_id: seed.churchId }).eq('church_id', seed.otherChurchId).select('id');
    expect(move.error).not.toBeNull();

    const remove = await stranger.rpc('delete_church_service_type', { p_service_type_id: baptism!.id });
    expect(remove.error?.code).toBe('42501');

    expect((await serviceTypeByName(seed.churchId, 'Baptism'))?.id).toBe(baptism!.id);
    expect((await db.from('church_service_types').select('id').eq('name', 'Intruder')).data).toHaveLength(0);
  });

  test('a volunteer and a parishioner cannot write, a priest of the parish cannot either', async () => {
    const seed = await getSeed();
    const volunteer = await tempUser('volunteer-services', 'volunteer', seed.churchId);
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    const clients: SupabaseClient[] = [volunteer.client, await clientAs('parishioner'), await clientAs('priest')];

    for (const client of clients) {
      const insert = await client.from('church_service_types').insert({ church_id: seed.churchId, name: 'Not Allowed' });
      expect(insert.error?.code).toBe('42501');
      const update = await client.from('church_service_types').update({ name: 'Nope' }).eq('id', baptism!.id).select('id');
      expect(update.data ?? []).toHaveLength(0);
      const remove = await client.rpc('delete_church_service_type', { p_service_type_id: baptism!.id });
      expect(remove.error?.code).toBe('42501');
      const requirement = await client
        .from('sacrament_requirements')
        .insert({ church_id: seed.churchId, service_type: 'baptism', service_type_id: baptism!.id, requirement_name: 'Sneaky' });
      expect(requirement.error).not.toBeNull();
    }
    expect((await serviceTypeByName(seed.churchId, 'Baptism'))?.id).toBe(baptism!.id);
  });

  test('an admin and a church admin can each manage their own parish, and an admin may manage any parish', async () => {
    const seed = await getSeed();
    const admin = await tempUser('admin-services', 'admin', seed.churchId);
    const own = await admin.client.from('church_service_types').insert({ church_id: seed.churchId, name: 'Admin Added' });
    expect(own.error).toBeNull();
    const anyParish = await admin.client.from('church_service_types').insert({ church_id: seed.otherChurchId, name: 'Admin Elsewhere' });
    expect(anyParish.error).toBeNull();

    // A church admin is limited to the parish they are assigned to
    const churchAdmin = await clientAs('church_admin');
    const foreign = await churchAdmin.from('church_service_types').insert({ church_id: seed.otherChurchId, name: 'Church Admin Intruder' });
    expect(foreign.error?.code).toBe('42501');
  });

  test('anyone, even signed out, can read the list; hidden and deleted rows are visible to staff tools only by flag', async () => {
    const seed = await getSeed();
    const anon = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const read = await anon.from('church_service_types').select('name').eq('church_id', seed.churchId).order('display_order');
    expect(read.error).toBeNull();
    expect(read.data?.map((row) => row.name)).toEqual(STARTER_SERVICES);
    const write = await anon.from('church_service_types').insert({ church_id: seed.churchId, name: 'Anon' });
    expect(write.error).not.toBeNull();

    const parishioner = await clientAs('parishioner');
    const own = await parishioner.from('church_service_types').select('id').eq('church_id', seed.otherChurchId);
    expect(own.data).toHaveLength(6);
  });

  test('a checklist document cannot be attached to a service of another parish', async () => {
    const seed = await getSeed();
    const foreign = await serviceTypeByName(seed.otherChurchId, 'Wedding');
    const { error } = await db.from('sacrament_requirements').insert({
      church_id: seed.churchId,
      service_type: 'wedding',
      service_type_id: foreign!.id,
      requirement_name: 'Crossed Wires',
    });
    expect(error?.code).toBe('22023');
  });

  test('the church admin of the parish can write its checklist documents', async () => {
    const seed = await getSeed();
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    const admin = await clientAs('church_admin');
    const created = await admin
      .from('sacrament_requirements')
      .insert({ church_id: seed.churchId, service_type: 'wedding', service_type_id: wedding!.id, requirement_name: 'CENOMAR' })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const stranger = await clientAs('other_admin');
    const hijack = await stranger.from('sacrament_requirements').update({ requirement_name: 'Hijacked' }).eq('id', created.data!.id).select('id');
    expect(hijack.data ?? []).toHaveLength(0);
    const removed = await admin.from('sacrament_requirements').delete().eq('id', created.data!.id);
    expect(removed.error).toBeNull();
  });
});

test.describe('Clients that only know the text columns keep working', () => {
  test('a text-only appointment insert is linked to the parish service, whatever the case', async () => {
    const seed = await getSeed();
    for (const text of ['Wedding', 'wedding', ' WEDDING ']) {
      await resetAppointmentData();
      const { data, error } = await db
        .from('appointments')
        .insert({
          user_id: seed.ids.parishioner,
          church_id: seed.churchId,
          service_type: text,
          appointment_date: weekdayDate(),
          appointment_time: '09:00:00',
          status: 'pending',
        })
        .select('service_type,service_type_id')
        .single();
      expect(error).toBeNull();
      const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
      expect(data?.service_type_id).toBe(wedding!.id);
    }
    expect((await db.from('church_service_types').select('id').eq('church_id', seed.churchId)).data).toHaveLength(6);
  });

  test('a mobile-style insert as the signed-in parishioner still works and gets linked', async () => {
    const seed = await getSeed();
    const parishioner = await clientAs('parishioner');
    const { data, error } = await parishioner
      .from('appointments')
      .insert({
        user_id: seed.ids.parishioner,
        church_id: seed.churchId,
        service_type: 'Funeral',
        appointment_date: weekdayDate(),
        appointment_time: '11:00:00',
        status: 'pending',
        notes: 'Deceased: Maria Santos',
      })
      .select('service_type,service_type_id')
      .single();
    expect(error).toBeNull();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    expect(data).toEqual({ service_type: 'Funeral', service_type_id: funeral!.id });
  });

  test('unknown text creates a hidden service for that parish instead of failing the booking', async () => {
    const seed = await getSeed();
    const parishioner = await clientAs('parishioner');
    const { data, error } = await parishioner
      .from('appointments')
      .insert({
        user_id: seed.ids.parishioner,
        church_id: seed.churchId,
        service_type: 'House Blessing',
        appointment_date: weekdayDate(),
        appointment_time: '11:00:00',
        status: 'pending',
      })
      .select('service_type,service_type_id')
      .single();
    expect(error).toBeNull();
    const { data: created } = await db.from('church_service_types').select('*').eq('id', data!.service_type_id).single();
    expect(created).toMatchObject({ church_id: seed.churchId, name: 'House Blessing', is_hidden: true, kind: null, deleted_at: null });
    expect(created!.display_order).toBeGreaterThan(6);
  });

  test('text matching a deleted service links to it and does not bring the service back', async () => {
    const seed = await getSeed();
    const blessing = await serviceTypeByName(seed.churchId, 'Blessing');
    await db.from('church_service_types').update({ deleted_at: new Date().toISOString() }).eq('id', blessing!.id);
    const { data, error } = await db
      .from('appointments')
      .insert({
        user_id: seed.ids.parishioner,
        church_id: seed.churchId,
        service_type: 'Blessing',
        appointment_date: weekdayDate(),
        appointment_time: '11:00:00',
        status: 'pending',
      })
      .select('service_type_id')
      .single();
    expect(error).toBeNull();
    expect(data?.service_type_id).toBe(blessing!.id);
    expect(await serviceTypeByName(seed.churchId, 'Blessing')).toBeNull();
  });

  test('an insert that names the service by id gets the current name in the text column', async () => {
    const seed = await getSeed();
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    await db.from('church_service_types').update({ name: 'Christening' }).eq('id', baptism!.id);
    const { data, error } = await db
      .from('appointments')
      .insert({
        user_id: seed.ids.parishioner,
        church_id: seed.churchId,
        service_type_id: baptism!.id,
        service_type: 'Baptism',
        appointment_date: weekdayDate(),
        appointment_time: '11:00:00',
        status: 'pending',
      })
      .select('service_type,service_type_id')
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ service_type: 'Christening', service_type_id: baptism!.id });
  });

  test('a service id of another parish is refused', async () => {
    const seed = await getSeed();
    const foreign = await serviceTypeByName(seed.otherChurchId, 'Baptism');
    const { error } = await db.from('appointments').insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type_id: foreign!.id,
      service_type: 'Baptism',
      appointment_date: weekdayDate(),
      appointment_time: '11:00:00',
      status: 'pending',
    });
    expect(error?.code).toBe('22023');
  });

  test('a text-only checklist insert is linked, and the mobile ilike read still finds it after a rename', async () => {
    const seed = await getSeed();
    const { data, error } = await db
      .from('sacrament_requirements')
      .insert({ church_id: seed.churchId, service_type: 'wedding', requirement_name: 'Old Client Document' })
      .select('service_type_id')
      .single();
    expect(error).toBeNull();
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    expect(data?.service_type_id).toBe(wedding!.id);

    const parishioner = await clientAs('parishioner');
    const mobileRead = await parishioner
      .from('sacrament_requirements')
      .select('requirement_name')
      .ilike('service_type', 'Wedding')
      .eq('church_id', seed.churchId);
    expect(mobileRead.data?.map((row) => row.requirement_name)).toEqual(['Old Client Document']);
  });
});

test.describe('Dashboards count documents by service id', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('the celebrant and priest dashboards still count the checklist (0 of 2 documents) after the service is renamed', async ({ page }) => {
    const seed = await getSeed();
    await resetMassSchedules();
    const baptism = await serviceTypeByName(seed.churchId, 'Baptism');
    await addRequirement(seed.churchId, baptism!, 'Birth Certificate', true, 1);
    await addRequirement(seed.churchId, baptism!, 'Godparent Certificate', true, 2);
    await createApprovedAppointment({ serviceType: 'Baptism', daysFromToday: 3 });

    await db.from('church_service_types').update({ name: 'Christening' }).eq('id', baptism!.id);

    await loginAs(page, 'priest');
    await page.goto('/dashboard');
    await expect(page.getByText('0 of 2 documents').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Documents pending').first()).toBeVisible();
  });
});

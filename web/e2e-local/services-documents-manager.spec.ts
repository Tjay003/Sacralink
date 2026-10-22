import { test, expect, type Locator, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  LOCAL_URL,
  PASSWORD,
  STARTER_SERVICES,
  clientAs,
  createPendingAppointment,
  firstWeekdayOffset,
  getSeed,
  isoDate,
  loginAs,
  pageAs,
  resetServiceTypes,
  serviceClient,
  serviceTypeByName,
} from './support';

/**
 * Real end-to-end for the Services & Documents manager in Edit Church (ticket 06): a parish office adds,
 * renames, describes, reorders, hides and deletes its services and manages the documents a parishioner must
 * upload for each, the Funeral default (new parishes and the one-time backfill), who can see and write it,
 * and the booking form showing exactly the saved checklist and blocking submission until required documents
 * are attached.
 */

const db = serviceClient();

function weekdayDate(fromDays = 21): string {
  return isoDate(firstWeekdayOffset(fromDays));
}

interface TempUser {
  id: string;
  email: string;
  client: SupabaseClient;
}
const tempEmails: string[] = [];
const tempChurchIds: string[] = [];

/** A throwaway signed-in user with the given role, assigned to a parish. */
async function tempUser(label: string, role: string, churchId: string | null): Promise<TempUser> {
  const email = `${label}@local.test`;
  tempEmails.push(email);
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Temp ${label}` },
  });
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
  return { id, email, client };
}

async function loginWithEmail(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

/** A parish created with the service role and seeded with the six starters (no checklists). */
async function newParish(name: string): Promise<string> {
  const { data, error } = await db
    .from('churches')
    .insert({ name, address: '9 Test Street', status: 'verified_active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  tempChurchIds.push(data.id);
  const seeded = await db.rpc('seed_church_service_types', { p_church_id: data.id });
  if (seeded.error) throw seeded.error;
  return data.id as string;
}

async function openManager(page: Page, churchId: string): Promise<Locator> {
  await page.goto(`/churches/${churchId}/edit`);
  const section = page.getByTestId('services-documents');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-service-name]').first()).toBeVisible();
  return section;
}

const serviceRow = (section: Locator, name: string) => section.locator(`[data-service-name="${name}"]`);
const documentRow = (row: Locator, name: string) => row.locator(`[data-document-name="${name}"]`);

async function serviceNames(section: Locator): Promise<(string | null)[]> {
  return section.locator('[data-service-name]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-service-name')));
}

async function documentNames(row: Locator): Promise<(string | null)[]> {
  return row.locator('[data-document-name]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-document-name')));
}

async function openDocuments(row: Locator, name: string) {
  const toggle = row.getByRole('button', { name: `Documents for ${name}` });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function addService(section: Locator, name: string, description?: string) {
  await section.getByRole('button', { name: 'Add service' }).click();
  await section.getByLabel('Service name').fill(name);
  if (description) await section.getByLabel('Service description').fill(description);
  await section.getByRole('button', { name: 'Create service' }).click();
  await expect(section.getByRole('button', { name: 'Create service' })).toHaveCount(0);
}

async function addDocument(
  row: Locator,
  input: { name: string; description?: string; required?: boolean }
) {
  await row.getByRole('button', { name: 'Add document' }).click();
  await row.getByLabel('Document name').fill(input.name);
  if (input.description) await row.getByLabel('Document description').fill(input.description);
  await row.getByRole('button', { name: input.required === false ? 'Optional' : 'Required', exact: true }).click();
  await row.getByRole('button', { name: 'Save document' }).click();
  await expect(row.getByRole('button', { name: 'Save document' })).toHaveCount(0);
}

async function liveServices(churchId: string) {
  const { data, error } = await db
    .from('church_service_types')
    .select('*')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

async function checklist(serviceTypeId: string) {
  const { data, error } = await db
    .from('sacrament_requirements')
    .select('*')
    .eq('service_type_id', serviceTypeId)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

test.beforeEach(async () => {
  await resetServiceTypes();
});

test.afterAll(async () => {
  await resetServiceTypes();
  for (const churchId of tempChurchIds) await db.from('churches').delete().eq('id', churchId);
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const email of tempEmails) {
    const found = list?.users.find((u) => u.email === email);
    if (found) await db.auth.admin.deleteUser(found.id);
  }
});

test.describe('services', () => {
  test('the office sees the parish services in order and adds a custom service with a description', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    await expect(section.getByRole('heading', { name: 'Services & Documents' })).toBeVisible();
    expect(await serviceNames(section)).toEqual(STARTER_SERVICES);

    await addService(section, 'First Communion', 'For children preparing for their first Eucharist');
    const row = serviceRow(section, 'First Communion');
    await expect(row).toBeVisible();
    await expect(row).toContainText('For children preparing for their first Eucharist');
    expect(await serviceNames(section)).toEqual([...STARTER_SERVICES, 'First Communion']);

    const stored = await serviceTypeByName(seed.churchId, 'First Communion');
    expect(stored?.description).toBe('For children preparing for their first Eucharist');
    expect(stored?.is_hidden).toBe(false);
    expect(stored?.kind).toBeNull();
    // Added at the end of the parish's list
    const live = await liveServices(seed.churchId);
    expect(live[live.length - 1].name).toBe('First Communion');
  });

  test('renaming a service follows existing appointments, and the description can be edited and cleared', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ serviceType: 'Funeral', daysFromToday: 30 });
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);

    await serviceRow(section, 'Funeral').getByRole('button', { name: 'Edit Funeral' }).click();
    await section.getByLabel('Service name').fill('Funeral and Burial');
    await section.getByLabel('Service description').fill('Funeral Mass and rite of committal');
    await section.getByRole('button', { name: 'Save service' }).click();

    const renamed = serviceRow(section, 'Funeral and Burial');
    await expect(renamed).toBeVisible();
    await expect(renamed).toContainText('Funeral Mass and rite of committal');
    await expect(serviceRow(section, 'Funeral')).toHaveCount(0);

    const stored = await serviceTypeByName(seed.churchId, 'Funeral and Burial');
    expect(stored?.kind).toBe('funeral');
    expect(stored?.description).toBe('Funeral Mass and rite of committal');
    const { data: appointment } = await db.from('appointments').select('service_type,service_type_id').single();
    expect(appointment?.service_type).toBe('Funeral and Burial');
    expect(appointment?.service_type_id).toBe(stored!.id);

    // Clearing the description stores nothing
    await renamed.getByRole('button', { name: 'Edit Funeral and Burial' }).click();
    await section.getByLabel('Service description').fill('');
    await section.getByRole('button', { name: 'Save service' }).click();
    await expect(renamed).not.toContainText('Funeral Mass and rite of committal');
    await expect(section.getByRole('button', { name: 'Save service' })).toHaveCount(0);
    expect((await serviceTypeByName(seed.churchId, 'Funeral and Burial'))?.description).toBeNull();
  });

  test('a duplicate name is refused inline when adding and when renaming, ignoring case and spaces', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);

    await section.getByRole('button', { name: 'Add service' }).click();
    await section.getByLabel('Service name').fill('  baptism ');
    await section.getByRole('button', { name: 'Create service' }).click();
    await expect(section.getByRole('alert')).toContainText('already exists');
    expect(await liveServices(seed.churchId)).toHaveLength(6);
    // The form stays open so the name can be corrected
    await section.getByLabel('Service name').fill('Baptism of Adults');
    await section.getByRole('button', { name: 'Create service' }).click();
    await expect(serviceRow(section, 'Baptism of Adults')).toBeVisible();
    await expect(section.getByRole('alert')).toHaveCount(0);

    await serviceRow(section, 'Wedding').getByRole('button', { name: 'Edit Wedding' }).click();
    await section.getByLabel('Service name').fill('BAPTISM');
    await section.getByRole('button', { name: 'Save service' }).click();
    await expect(section.getByRole('alert')).toContainText('already exists');
    expect((await serviceTypeByName(seed.churchId, 'Wedding'))?.name).toBe('Wedding');

    // A blank name cannot be saved
    await section.getByLabel('Service name').fill('   ');
    await expect(section.getByRole('button', { name: 'Save service' })).toBeDisabled();
  });

  test('reordering moves a service up or down, persists, and is the booking order', async ({ page, browser }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    await expect(section.getByRole('button', { name: 'Move Baptism up' })).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Move Other down' })).toBeDisabled();

    await section.getByRole('button', { name: 'Move Funeral up' }).click();
    await expect.poll(() => serviceNames(section)).toEqual(['Baptism', 'Funeral', 'Wedding', 'Confirmation', 'Blessing', 'Other']);
    await section.getByRole('button', { name: 'Move Baptism down' }).click();
    await expect.poll(() => serviceNames(section)).toEqual(['Funeral', 'Baptism', 'Wedding', 'Confirmation', 'Blessing', 'Other']);

    await expect
      .poll(async () => (await liveServices(seed.churchId)).map((s) => s.name))
      .toEqual(['Funeral', 'Baptism', 'Wedding', 'Confirmation', 'Blessing', 'Other']);
    await page.reload();
    await expect(section.locator('[data-service-name]').first()).toBeVisible();
    expect(await serviceNames(section)).toEqual(['Funeral', 'Baptism', 'Wedding', 'Confirmation', 'Blessing', 'Other']);

    const parishioner = await pageAs(browser, 'parishioner');
    await parishioner.goto(`/churches/${seed.churchId}/book`);
    await expect(parishioner.getByLabel('Service Type')).toBeVisible();
    expect(await parishioner.getByLabel('Service Type').locator('option').allTextContents()).toEqual([
      'Funeral', 'Baptism', 'Wedding', 'Confirmation', 'Blessing', 'Other',
    ]);
    await parishioner.context().close();
  });

  test('hiding takes a service off the booking form and showing restores it', async ({ page, browser }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    const parishioner = await pageAs(browser, 'parishioner');
    const options = async () => {
      await parishioner.goto(`/churches/${seed.churchId}/book`);
      await expect(parishioner.getByLabel('Service Type')).toBeVisible();
      return parishioner.getByLabel('Service Type').locator('option').allTextContents();
    };

    await serviceRow(section, 'Wedding').getByRole('button', { name: 'Hide Wedding' }).click();
    await expect(serviceRow(section, 'Wedding')).toContainText('Hidden');
    await expect(serviceRow(section, 'Wedding').getByRole('button', { name: 'Show Wedding' })).toBeVisible();
    expect((await serviceTypeByName(seed.churchId, 'Wedding'))?.is_hidden).toBe(true);
    expect(await options()).toEqual(['Baptism', 'Funeral', 'Confirmation', 'Blessing', 'Other']);
    // A hidden service stays in the office list
    expect(await serviceNames(section)).toEqual(STARTER_SERVICES);

    await serviceRow(section, 'Wedding').getByRole('button', { name: 'Show Wedding' }).click();
    await expect(serviceRow(section, 'Wedding')).not.toContainText('Hidden');
    expect((await serviceTypeByName(seed.churchId, 'Wedding'))?.is_hidden).toBe(false);
    expect(await options()).toEqual(STARTER_SERVICES);
    await parishioner.context().close();
  });

  test('deleting a service nobody booked removes it for good after a confirmation', async ({ page }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    const blessing = await serviceTypeByName(seed.churchId, 'Blessing');

    await serviceRow(section, 'Blessing').getByRole('button', { name: 'Delete Blessing' }).click();
    const confirm = section.getByRole('group', { name: 'Confirm delete Blessing' });
    await expect(confirm).toContainText('permanently');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(serviceRow(section, 'Blessing')).toBeVisible();

    await serviceRow(section, 'Blessing').getByRole('button', { name: 'Delete Blessing' }).click();
    await section.getByRole('group', { name: 'Confirm delete Blessing' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(serviceRow(section, 'Blessing')).toHaveCount(0);
    const { data } = await db.from('church_service_types').select('id').eq('id', blessing!.id);
    expect(data).toHaveLength(0);
  });

  test('deleting a service with appointments warns, then keeps history and frees the name', async ({ page }) => {
    const seed = await getSeed();
    await createPendingAppointment({ serviceType: 'Wedding', daysFromToday: 30 });
    const wedding = await serviceTypeByName(seed.churchId, 'Wedding');
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);

    await serviceRow(section, 'Wedding').getByRole('button', { name: 'Delete Wedding' }).click();
    const confirm = section.getByRole('group', { name: 'Confirm delete Wedding' });
    await expect(confirm).toContainText('Existing appointments keep this service; it will no longer be offered.');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    expect((await serviceTypeByName(seed.churchId, 'Wedding'))?.deleted_at).toBeNull();

    await serviceRow(section, 'Wedding').getByRole('button', { name: 'Delete Wedding' }).click();
    await section.getByRole('group', { name: 'Confirm delete Wedding' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(serviceRow(section, 'Wedding')).toHaveCount(0);
    expect(await serviceNames(section)).toEqual(['Baptism', 'Funeral', 'Confirmation', 'Blessing', 'Other']);

    const { data: kept } = await db.from('church_service_types').select('deleted_at').eq('id', wedding!.id).single();
    expect(kept?.deleted_at).not.toBeNull();
    const { data: appointment } = await db.from('appointments').select('service_type,service_type_id').single();
    expect(appointment).toEqual({ service_type: 'Wedding', service_type_id: wedding!.id });

    // The freed name can be used again
    await addService(section, 'Wedding');
    await expect(serviceRow(section, 'Wedding')).toBeVisible();
    expect((await serviceTypeByName(seed.churchId, 'Wedding'))?.id).not.toBe(wedding!.id);
  });
});

test.describe('documents', () => {
  test('the office adds, edits, reorders and deletes the documents of a service', async ({ page }) => {
    const seed = await getSeed();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    const row = serviceRow(section, 'Funeral');

    await openDocuments(row, 'Funeral');
    await expect(row).toContainText('No documents yet');

    await addDocument(row, { name: 'Death Certificate', description: 'Certified copy from the civil registry', required: true });
    await addDocument(row, { name: 'Burial Permit', required: false });
    expect(await documentNames(row)).toEqual(['Death Certificate', 'Burial Permit']);
    await expect(documentRow(row, 'Death Certificate')).toContainText('Required');
    await expect(documentRow(row, 'Death Certificate')).toContainText('Certified copy from the civil registry');
    await expect(documentRow(row, 'Burial Permit')).toContainText('Optional');

    let rows = await checklist(funeral!.id);
    expect(rows.map((r) => [r.requirement_name, r.is_required, r.display_order, r.service_type, r.church_id])).toEqual([
      ['Death Certificate', true, 1, 'funeral', seed.churchId],
      ['Burial Permit', false, 2, 'funeral', seed.churchId],
    ]);
    expect(rows[0].description).toBe('Certified copy from the civil registry');

    // Edit name, description and the Required flag
    await documentRow(row, 'Burial Permit').getByRole('button', { name: 'Edit Burial Permit' }).click();
    await row.getByLabel('Document name').fill('Burial Permit (Municipal)');
    await row.getByLabel('Document description').fill('Issued by the municipal health office');
    await row.getByRole('button', { name: 'Required', exact: true }).click();
    await row.getByRole('button', { name: 'Save document' }).click();
    await expect(documentRow(row, 'Burial Permit (Municipal)')).toContainText('Issued by the municipal health office');
    await expect(documentRow(row, 'Burial Permit (Municipal)')).toContainText('Required');
    rows = await checklist(funeral!.id);
    expect(rows[1]).toMatchObject({ requirement_name: 'Burial Permit (Municipal)', is_required: true, description: 'Issued by the municipal health office' });

    // Reorder
    await expect(row.getByRole('button', { name: 'Move Death Certificate up' })).toBeDisabled();
    await row.getByRole('button', { name: 'Move Burial Permit (Municipal) up' }).click();
    await expect.poll(() => documentNames(row)).toEqual(['Burial Permit (Municipal)', 'Death Certificate']);
    await expect
      .poll(async () => (await checklist(funeral!.id)).map((r) => r.requirement_name))
      .toEqual(['Burial Permit (Municipal)', 'Death Certificate']);

    // Delete asks first
    await documentRow(row, 'Death Certificate').getByRole('button', { name: 'Delete Death Certificate' }).click();
    await row.getByRole('group', { name: 'Confirm delete Death Certificate' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(documentRow(row, 'Death Certificate')).toBeVisible();
    await documentRow(row, 'Death Certificate').getByRole('button', { name: 'Delete Death Certificate' }).click();
    await row.getByRole('group', { name: 'Confirm delete Death Certificate' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(documentRow(row, 'Death Certificate')).toHaveCount(0);
    expect((await checklist(funeral!.id)).map((r) => r.requirement_name)).toEqual(['Burial Permit (Municipal)']);
  });

  test('documents survive a rename of the service, and a document that parishioners already uploaded can still be deleted', async ({ page }) => {
    const seed = await getSeed();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    const { data: requirement } = await db
      .from('sacrament_requirements')
      .insert({ church_id: seed.churchId, service_type: 'funeral', service_type_id: funeral!.id, requirement_name: 'Death Certificate', is_required: true, display_order: 1 })
      .select('id')
      .single();
    const appointmentId = await createPendingAppointment({ serviceType: 'Funeral', daysFromToday: 30 });
    const { error: docError } = await db.from('appointment_documents').insert({
      appointment_id: appointmentId,
      requirement_id: requirement!.id,
      file_url: 'http://127.0.0.1/none.pdf',
      file_name: 'none.pdf',
    });
    expect(docError).toBeNull();

    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    await serviceRow(section, 'Funeral').getByRole('button', { name: 'Edit Funeral' }).click();
    await section.getByLabel('Service name').fill('Funeral Rites');
    await section.getByRole('button', { name: 'Save service' }).click();
    const row = serviceRow(section, 'Funeral Rites');
    await openDocuments(row, 'Funeral Rites');
    await expect(documentRow(row, 'Death Certificate')).toBeVisible();
    expect((await checklist(funeral!.id))[0].service_type).toBe('funeral rites');

    await documentRow(row, 'Death Certificate').getByRole('button', { name: 'Delete Death Certificate' }).click();
    await row.getByRole('group', { name: 'Confirm delete Death Certificate' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(documentRow(row, 'Death Certificate')).toHaveCount(0);
    expect(await checklist(funeral!.id)).toHaveLength(0);
    // The uploaded file stays on the appointment, no longer tied to a checklist item
    const { data: kept } = await db.from('appointment_documents').select('requirement_id,file_name').eq('appointment_id', appointmentId);
    expect(kept).toEqual([{ requirement_id: null, file_name: 'none.pdf' }]);
  });
});

test.describe('Funeral default', () => {
  test('a parish created from Add Church gets the six services and a required Death Certificate on Funeral', async ({ page }) => {
    const admin = await tempUser('services-super_admin', 'super_admin', null);
    await loginWithEmail(page, admin.email);
    await page.goto('/churches/add');
    await page.getByPlaceholder('e.g., St. Peter Parish').fill('Funeral Default Parish');
    await page.getByPlaceholder('Full address of the church').fill('5 Default Street');
    await page.getByRole('button', { name: 'Create Church' }).click();
    await page.waitForURL(/\/churches\/[0-9a-f-]{36}$/);
    const churchId = page.url().split('/').pop()!;
    tempChurchIds.push(churchId);

    const services = await liveServices(churchId);
    expect(services.map((s) => s.name)).toEqual(STARTER_SERVICES);
    const funeral = services.find((s) => s.kind === 'funeral')!;
    const funeralList = await checklist(funeral.id);
    expect(funeralList.map((r) => [r.requirement_name, r.is_required, r.service_type])).toEqual([['Death Certificate', true, 'funeral']]);
    // The other starter checklists are still seeded
    const baptism = services.find((s) => s.kind === 'baptism')!;
    expect((await checklist(baptism.id)).map((r) => r.requirement_name)).toEqual([
      'Birth Certificate', 'Godparent Certificate', 'Parent Marriage Certificate',
    ]);

    // It is an ordinary document: the office can delete it afterwards
    const { error } = await db.from('sacrament_requirements').delete().eq('id', funeralList[0].id);
    expect(error).toBeNull();
  });

  test('the backfill adds a required Death Certificate only to a Funeral service with no documents at all', async () => {
    const own = await newParish('Funeral Own Checklist Parish');
    const bare = await newParish('Funeral Bare Parish');
    const renamed = await newParish('Funeral Renamed Parish');
    const removed = await newParish('Funeral Removed Parish');
    const kindOf = async (churchId: string, kind: string) => {
      const { data } = await db.from('church_service_types').select('*').eq('church_id', churchId).eq('kind', kind).single();
      return data!;
    };

    // A parish that set its own Funeral checklist (even an optional one) is never touched
    const ownFuneral = await kindOf(own, 'funeral');
    await db.from('sacrament_requirements').insert({
      church_id: own, service_type_id: ownFuneral.id, service_type: 'funeral', requirement_name: 'Parish Burial Form', is_required: false, display_order: 1,
    });
    // Documents on another service do not count as a Funeral checklist
    const bareWedding = await kindOf(bare, 'wedding');
    await db.from('sacrament_requirements').insert({
      church_id: bare, service_type_id: bareWedding.id, service_type: 'wedding', requirement_name: 'Marriage License', is_required: true, display_order: 1,
    });
    // A renamed Funeral is still the Funeral
    const renamedFuneral = await kindOf(renamed, 'funeral');
    await db.from('church_service_types').update({ name: 'Memorial Service' }).eq('id', renamedFuneral.id);
    // A parish that deleted Funeral has nothing to backfill
    const removedFuneral = await kindOf(removed, 'funeral');
    await db.from('church_service_types').update({ deleted_at: new Date().toISOString() }).eq('id', removedFuneral.id);

    const first = await db.rpc('backfill_funeral_death_certificate');
    expect(first.error).toBeNull();
    expect(first.data).toBeGreaterThanOrEqual(2);

    expect((await checklist(ownFuneral.id)).map((r) => r.requirement_name)).toEqual(['Parish Burial Form']);
    const bareFuneral = await kindOf(bare, 'funeral');
    expect((await checklist(bareFuneral.id)).map((r) => [r.requirement_name, r.is_required, r.display_order, r.service_type, r.church_id])).toEqual([
      ['Death Certificate', true, 1, 'funeral', bare],
    ]);
    expect((await checklist(bareWedding.id)).map((r) => r.requirement_name)).toEqual(['Marriage License']);
    expect((await checklist(renamedFuneral.id)).map((r) => [r.requirement_name, r.is_required, r.service_type])).toEqual([
      ['Death Certificate', true, 'memorial service'],
    ]);
    expect(await checklist(removedFuneral.id)).toHaveLength(0);

    // Running it again changes nothing
    const second = await db.rpc('backfill_funeral_death_certificate');
    expect(second.error).toBeNull();
    expect(second.data).toBe(0);
    expect(await checklist(bareFuneral.id)).toHaveLength(1);

    // It is not callable through the API by anyone but the service role
    const stranger = await clientAs('church_admin');
    expect((await stranger.rpc('backfill_funeral_death_certificate')).error?.code).toBe('42501');
  });
});

test.describe('who can use it', () => {
  test('only the parish church admin and super admin see the section', async ({ page, browser }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    await openManager(page, seed.churchId);

    for (const role of ['super_admin'] as const) {
      const user = await tempUser(`services-${role}`, role, null);
      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      const other = await context.newPage();
      await loginWithEmail(other, user.email);
      await openManager(other, seed.churchId);
      await context.close();
    }

    // The parish priest can open Edit Church but never gets the section
    const priest = await pageAs(browser, 'priest');
    await priest.goto(`/churches/${seed.churchId}/edit`);
    await expect(priest.getByRole('heading', { name: 'Edit parish details' })).toBeVisible();
    await expect(priest.getByTestId('services-documents')).toHaveCount(0);
    await priest.context().close();

    // A parishioner and the admin of another parish are sent away
    for (const role of ['parishioner', 'other_admin'] as const) {
      const outsider = await pageAs(browser, role);
      await outsider.goto(`/churches/${seed.churchId}/edit`);
      await outsider.waitForURL('**/churches');
      await expect(outsider.getByTestId('services-documents')).toHaveCount(0);
      await outsider.context().close();
    }
  });

  test('row level security refuses writes to services and documents from everyone else', async () => {
    const seed = await getSeed();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    const { data: requirement } = await db
      .from('sacrament_requirements')
      .insert({ church_id: seed.churchId, service_type: 'funeral', service_type_id: funeral!.id, requirement_name: 'Death Certificate', is_required: true, display_order: 1 })
      .select('id')
      .single();
    const volunteer = await tempUser('services-volunteer', 'volunteer', seed.churchId);
    const clients: Array<[string, SupabaseClient]> = [
      ['priest', await clientAs('priest')],
      ['parishioner', await clientAs('parishioner')],
      ['other parish admin', await clientAs('other_admin')],
      ['volunteer', volunteer.client],
    ];

    for (const [label, client] of clients) {
      const addedService = await client
        .from('church_service_types')
        .insert({ church_id: seed.churchId, name: `Intruder ${label}` })
        .select();
      expect(addedService.error?.code, `${label} add service`).toBe('42501');
      const renamed = await client.from('church_service_types').update({ name: 'Hacked' }).eq('id', funeral!.id).select();
      expect(renamed.data ?? [], `${label} rename service`).toHaveLength(0);
      const deleted = await client.rpc('delete_church_service_type', { p_service_type_id: funeral!.id });
      expect(deleted.error?.code, `${label} delete service`).toBe('42501');

      const addedDoc = await client
        .from('sacrament_requirements')
        .insert({ church_id: seed.churchId, service_type: 'funeral', service_type_id: funeral!.id, requirement_name: `Intruder ${label}`, is_required: false })
        .select();
      expect(addedDoc.error?.code, `${label} add document`).toBe('42501');
      const edited = await client.from('sacrament_requirements').update({ is_required: false }).eq('id', requirement!.id).select();
      expect(edited.data ?? [], `${label} edit document`).toHaveLength(0);
      const removed = await client.from('sacrament_requirements').delete().eq('id', requirement!.id).select();
      expect(removed.data ?? [], `${label} delete document`).toHaveLength(0);
    }

    expect((await serviceTypeByName(seed.churchId, 'Funeral'))?.name).toBe('Funeral');
    const rows = await checklist(funeral!.id);
    expect(rows.map((r) => [r.requirement_name, r.is_required])).toEqual([['Death Certificate', true]]);
    expect(await liveServices(seed.churchId)).toHaveLength(6);
  });
});

test.describe('booking', () => {
  test('a custom service with a custom checklist shows exactly that checklist and blocks submission until required documents are uploaded', async ({ page, browser }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);

    // The office builds the service and its checklist in the manager
    await addService(section, 'First Communion', 'For children preparing for their first Eucharist');
    await addService(section, 'Retreat Blessing');
    const row = serviceRow(section, 'First Communion');
    await openDocuments(row, 'First Communion');
    await addDocument(row, { name: 'Parent ID', description: 'Government ID of a parent or guardian', required: true });
    await addDocument(row, { name: 'Recent Photo', required: false });
    await addDocument(row, { name: 'Catechism Certificate', required: true });
    await documentRow(row, 'Catechism Certificate').getByRole('button', { name: 'Delete Catechism Certificate' }).click();
    await row.getByRole('group', { name: 'Confirm delete Catechism Certificate' }).getByRole('button', { name: 'Yes, delete' }).click();
    await expect(documentRow(row, 'Catechism Certificate')).toHaveCount(0);

    // The parishioner books it
    const parishioner = await pageAs(browser, 'parishioner');
    const uploads: Array<Record<string, unknown>> = [];
    await parishioner.route('**/storage/v1/object/appointment-documents/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'appointment-documents/mock' }) })
    );
    await parishioner.route('**/rest/v1/appointment_documents*', (route) => {
      if (route.request().method() === 'POST') {
        uploads.push(route.request().postDataJSON());
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: 'mock' }]) });
      }
      return route.continue();
    });
    await parishioner.goto(`/churches/${seed.churchId}/book`);
    await parishioner.getByLabel(/Preferred Date/i).fill(weekdayDate());
    await parishioner.getByLabel(/Preferred Time/i).fill('10:00');

    await parishioner.getByLabel('Service Type').selectOption({ label: 'First Communion' });
    await expect(parishioner.getByTestId('service-description')).toContainText('For children preparing for their first Eucharist');
    const documents = parishioner.locator('input[type="file"]');
    await expect(documents).toHaveCount(2);
    await expect(parishioner.getByText('Parent ID')).toBeVisible();
    await expect(parishioner.getByText('Government ID of a parent or guardian')).toBeVisible();
    await expect(parishioner.getByText('Recent Photo')).toBeVisible();
    await expect(parishioner.getByText('Catechism Certificate')).toHaveCount(0);

    // A service with no documents shows no upload section
    await parishioner.getByLabel('Service Type').selectOption({ label: 'Retreat Blessing' });
    await expect(parishioner.getByText('Required Documents')).toHaveCount(0);
    await parishioner.getByLabel('Service Type').selectOption({ label: 'First Communion' });
    await expect(documents).toHaveCount(2);

    const submit = parishioner.getByRole('button', { name: /Submit Request/i });
    await submit.click();
    await expect(parishioner.getByRole('alert')).toContainText('Missing required document: Parent ID');

    // The optional photo alone is not enough
    await documents.nth(1).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await submit.click();
    await expect(parishioner.getByRole('alert')).toContainText('Missing required document: Parent ID');
    const { data: before } = await db.from('appointments').select('id');
    expect(before).toHaveLength(0);

    await documents.nth(0).setInputFiles({ name: 'parent-id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await submit.click();
    await expect(parishioner.getByRole('heading', { name: 'Request Sent!' })).toBeVisible();

    const custom = await serviceTypeByName(seed.churchId, 'First Communion');
    const { data: booked } = await db.from('appointments').select('service_type,service_type_id,status');
    expect(booked).toEqual([{ service_type: 'First Communion', service_type_id: custom!.id, status: 'pending' }]);
    const saved = await checklist(custom!.id);
    expect(saved.map((r) => r.requirement_name)).toEqual(['Parent ID', 'Recent Photo']);
    expect(uploads.map((u) => u.requirement_id).sort()).toEqual(saved.map((r) => r.id).sort());
    expect(uploads.map((u) => u.file_name).sort()).toEqual(['parent-id.pdf', 'photo.png']);
    await parishioner.context().close();
  });

  test('turning a document from required to optional lets the booking go through without it', async ({ page, browser }) => {
    const seed = await getSeed();
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    const row = serviceRow(section, 'Confirmation');
    await openDocuments(row, 'Confirmation');
    await addDocument(row, { name: 'Sponsor Certificate', required: true });

    const parishioner = await pageAs(browser, 'parishioner');
    const book = async () => {
      await parishioner.goto(`/churches/${seed.churchId}/book`);
      await parishioner.getByLabel(/Preferred Date/i).fill(weekdayDate());
      await parishioner.getByLabel(/Preferred Time/i).fill('10:00');
      await parishioner.getByLabel('Service Type').selectOption({ label: 'Confirmation' });
      await parishioner.getByRole('button', { name: /Submit Request/i }).click();
    };
    await book();
    await expect(parishioner.getByRole('alert')).toContainText('Missing required document: Sponsor Certificate');

    await documentRow(row, 'Sponsor Certificate').getByRole('button', { name: 'Edit Sponsor Certificate' }).click();
    await row.getByRole('button', { name: 'Optional', exact: true }).click();
    await row.getByRole('button', { name: 'Save document' }).click();
    await expect(documentRow(row, 'Sponsor Certificate')).toContainText('Optional');

    await book();
    await expect(parishioner.getByRole('heading', { name: 'Request Sent!' })).toBeVisible();
    await parishioner.context().close();
  });
});

test.describe('layout', () => {
  test('the section fits a 375px phone without horizontal scrolling or overlapping controls', async ({ page }) => {
    const seed = await getSeed();
    const funeral = await serviceTypeByName(seed.churchId, 'Funeral');
    await db.from('sacrament_requirements').insert({
      church_id: seed.churchId,
      service_type: 'funeral',
      service_type_id: funeral!.id,
      requirement_name: 'Death Certificate with a rather long document name to test wrapping',
      description: 'A long description that has to wrap onto several lines on a narrow phone screen without pushing the buttons out',
      is_required: true,
      display_order: 1,
    });
    await page.setViewportSize({ width: 375, height: 800 });
    await loginAs(page, 'church_admin');
    const section = await openManager(page, seed.churchId);
    await openDocuments(serviceRow(section, 'Funeral'), 'Funeral');
    await serviceRow(section, 'Funeral').getByRole('button', { name: 'Add document' }).click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await section.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);

    // Every action button of a service row stays inside the row
    const row = serviceRow(section, 'Funeral');
    const rowBox = (await row.boundingBox())!;
    const buttons = await row.getByRole('button').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      })
    );
    for (const b of buttons) {
      expect(b.left).toBeGreaterThanOrEqual(rowBox.x - 1);
      expect(b.right).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
      expect(b.width).toBeGreaterThan(0);
    }
    await page.screenshot({ path: 'e2e-screenshots/services-documents-375.png', fullPage: false });
  });
});

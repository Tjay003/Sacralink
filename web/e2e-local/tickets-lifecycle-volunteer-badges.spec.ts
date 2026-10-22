import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, clientAs, createPendingAppointment, getSeed, loginAs, resetAppointmentData, serviceClient, type Seed } from './support';

/**
 * Ticket lifecycle on /messages, Volunteer messaging scope and live sidebar badges (ticket 06):
 *  - A parishioner opens a Parish Office Ticket from /messages; closed tickets lock the composer (Reopen is ticket 15).
 *  - The Tickets tab filters by status.
 *  - A volunteer reaches the Staff Channel and own-parish staff, never starts a DM with a parishioner or priest, and cannot read
 *    a parish ticket they are not assigned to (ticket 11)
 *    (in the search and at the database).
 *  - The sidebar badges show real counts, never the old hardcoded 2 and 12, and the info panel never invents an appointment.
 */

const db = serviceClient();
const TAG = 'tkt-life';
const VOLUNTEER_EMAIL = `${TAG}-volunteer@local.test`;

let seed: Seed;
let volunteerId = '';
let volunteerClient: SupabaseClient;

async function purge() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function createTicket(title: string, status: string, requesterId: string): Promise<string> {
  const { data, error } = await db
    .from('conversations')
    .insert({
      title,
      type: 'group',
      church_id: seed.churchId,
      created_by: requesterId,
      category: 'general',
      status: 'open',
      ticket_number: `TCK-${Math.floor(100000 + Math.random() * 899999)}`,
    })
    .select('id')
    .single();
  if (error) throw error;
  const { error: partErr } = await db
    .from('conversation_participants')
    .insert([requesterId, seed.ids.church_admin].map((user_id) => ({ conversation_id: data.id, user_id })));
  if (partErr) throw partErr;
  const { error: msgErr } = await db
    .from('messages')
    .insert({ conversation_id: data.id, sender_id: requesterId, content: `Opening note for ${title}` });
  if (msgErr) throw msgErr;
  // Set the wanted status last: the opening message of a resolved ticket would otherwise reopen it (automatic status)
  if (status !== 'open') {
    const { error: statusErr } = await db.from('conversations').update({ status }).eq('id', data.id);
    if (statusErr) throw statusErr;
  }
  return data.id as string;
}

async function volunteerPage(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(VOLUNTEER_EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purge();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === VOLUNTEER_EMAIL);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({ email: VOLUNTEER_EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  volunteerId = data.user.id;
  const { error: profileErr } = await db.from('profiles').upsert({
    id: volunteerId,
    email: VOLUNTEER_EMAIL,
    full_name: 'Tkt Volunteer',
    role: 'volunteer',
    church_id: seed.churchId,
    assigned_church_id: seed.churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  volunteerClient = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await volunteerClient.auth.signInWithPassword({ email: VOLUNTEER_EMAIL, password: PASSWORD });
  if (signInErr) throw signInErr;
});

test.afterAll(async () => {
  await purge();
  await resetAppointmentData();
  if (volunteerId) await db.auth.admin.deleteUser(volunteerId);
});

test.describe('Ticket lifecycle on /messages', () => {
  test('a parishioner opens a ticket from /messages, the Church Admin closes it through ticket_set_status and the composer locks', async ({ page }) => {
    await loginAs(page, 'parishioner');
    await page.goto('/messages');

    await page.getByRole('button', { name: 'New Ticket' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#inquiry-parish').selectOption({ label: 'Local Test Parish' });
    await dialog.locator('#inquiry-subject').fill(`${TAG} baptism papers`);
    await dialog.locator('#inquiry-message').fill('Please tell me which documents we must bring.');
    await dialog.getByRole('button', { name: 'Send Inquiry' }).click();

    await expect(page).toHaveURL(/conv=/);
    await expect(page.locator('h2', { hasText: `Inquiry: ${TAG} baptism papers` })).toBeVisible();
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    const ticketId = new URL(page.url()).searchParams.get('conv')!;
    const { data: created } = await db.from('conversations').select('status, church_id, ticket_number').eq('id', ticketId).single();
    expect(created?.status).toBe('open');
    expect(created?.church_id).toBe(seed.churchId);
    expect(created?.ticket_number).toBeTruthy();

    // The parish office closes it (through RLS, as the church admin, who is the handler)
    const churchAdmin = await clientAs('church_admin');
    const closed = await churchAdmin.rpc('ticket_set_status', { p_ticket_id: ticketId, p_status: 'closed' });
    expect(closed.error).toBeNull();

    await page.goto(`/messages?conv=${ticketId}`);
    await expect(page.getByText('This inquiry ticket is closed')).toBeVisible();
    await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0);

    const { data: after } = await db.from('conversations').select('status').eq('id', ticketId).single();
    expect(after?.status).toBe('closed');
    const { data: notes } = await db.from('messages').select('message_type').eq('conversation_id', ticketId).eq('message_type', 'system');
    expect(notes).toHaveLength(1);
  });

  test('the Tickets tab filters by All, Open, In Progress, Resolved and Closed', async ({ page }) => {
    await createTicket(`${TAG} filter-open`, 'open', seed.ids.parishioner);
    await createTicket(`${TAG} filter-progress`, 'in_progress', seed.ids.parishioner);
    await createTicket(`${TAG} filter-resolved`, 'resolved', seed.ids.parishioner);
    await createTicket(`${TAG} filter-closed`, 'closed', seed.ids.parishioner);

    await loginAs(page, 'parishioner');
    await page.goto('/messages');
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();

    const list = page.locator('div.divide-y.overflow-y-auto h3', { hasText: `${TAG} filter-` });
    await expect(list).toHaveCount(4);

    const cases: Array<[string, string]> = [
      ['Open', 'filter-open'],
      ['In Progress', 'filter-progress'],
      ['Resolved', 'filter-resolved'],
      ['Closed', 'filter-closed'],
    ];
    for (const [pill, slug] of cases) {
      await page.getByRole('button', { name: pill, exact: true }).click();
      await expect(list).toHaveCount(1);
      await expect(list.first()).toContainText(slug);
    }

    await page.getByRole('button', { name: 'All', exact: true }).last().click();
    await expect(list).toHaveCount(4);
  });
});

test.describe('Volunteer messaging scope', () => {
  test('the New Message dialog offers a volunteer the staff channel and New Ticket, never a contact', async ({ page }) => {
    await volunteerPage(page);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'New message' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'New Ticket' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Open staff channel' })).toBeVisible();
    await expect(dialog.getByText('Local Church Admin')).toHaveCount(0);
    await expect(dialog.getByText('Local Parishioner')).toHaveCount(0);
    await expect(dialog.getByText('Fr. Local Priest')).toHaveCount(0);
    await expect(dialog.getByText('Other Parish Admin')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Parishioners' })).toHaveCount(0);
  });

  test('the database refuses every volunteer-started DM, through the function and through REST', async () => {
    for (const targetId of [seed.ids.parishioner, seed.ids.priest, seed.ids.other_admin, seed.ids.church_admin]) {
      const started = await volunteerClient.rpc('start_direct_conversation', { p_target: targetId });
      expect(started.error).not.toBeNull();
    }

    const created = await volunteerClient
      .from('conversations')
      .insert({ title: `${TAG} cold-dm`, type: 'direct', created_by: volunteerId })
      .select('id')
      .single();
    expect(created.error).not.toBeNull();
  });

  test('an unassigned volunteer cannot see a parish ticket at all, the Church Admin handles it, and the volunteer still uses the Staff Channel', async ({ page }) => {
    const ticketId = await createTicket(`${TAG} volunteer-ticket`, 'open', seed.ids.parishioner);

    // Database: no conversation row and no messages for the unassigned volunteer
    const seen = await volunteerClient.from('conversations').select('id').eq('id', ticketId);
    expect(seen.data).toEqual([]);
    const seenMessages = await volunteerClient.from('messages').select('id').eq('conversation_id', ticketId);
    expect(seenMessages.data).toEqual([]);
    const asVolunteer = await volunteerClient.rpc('ticket_set_status', { p_ticket_id: ticketId, p_status: 'resolved' });
    expect(asVolunteer.error).not.toBeNull();

    // The Church Admin is the handler: a reply starts the ticket and the status can be resolved
    const churchAdmin = await clientAs('church_admin');
    const reply = await churchAdmin
      .from('messages')
      .insert({ conversation_id: ticketId, sender_id: seed.ids.church_admin, content: 'The certificate is ready.' });
    expect(reply.error).toBeNull();
    expect((await churchAdmin.rpc('ticket_set_status', { p_ticket_id: ticketId, p_status: 'resolved' })).error).toBeNull();
    const { data: row } = await db.from('conversations').select('status').eq('id', ticketId).single();
    expect(row?.status).toBe('resolved');

    // The app shows the volunteer nothing for that ticket, and the Staff Channel keeps working
    await volunteerPage(page);
    await page.goto(`/messages?conv=${ticketId}`);
    await expect(page.locator('h2', { hasText: `${TAG} volunteer-ticket` })).toHaveCount(0);

    await page.getByRole('button', { name: 'Staff channel' }).click();
    await expect(page.locator('h2', { hasText: /Staff Channel/ })).toBeVisible();
    await page.getByPlaceholder('Type a message...').fill('Volunteer checking in on the staff channel.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: 'Volunteer checking in on the staff channel.' })).toBeVisible();
  });
});

test.describe('Live sidebar badges and info panel', () => {
  test('badges show the real unread and pending counts, hide at zero, and never the old hardcoded 2 and 12', async ({ page }) => {
    await resetAppointmentData();
    // Mark everything the parishioner has as read, then add exactly one unread message and one pending appointment
    await db
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('user_id', seed.ids.parishioner);

    await loginAs(page, 'parishioner');
    const messagesBadge = page.locator('aside a[href="/messages"] span.rounded-full');
    const appointmentsBadge = page.locator('aside a[href="/appointments"] span.rounded-full');
    await expect(messagesBadge).toHaveCount(0);
    await expect(appointmentsBadge).toHaveCount(0);

    // in_progress so the office's reply does not trigger the automatic open to in_progress note
    const ticketId = await createTicket(`${TAG} badge-ticket`, 'in_progress', seed.ids.parishioner);
    await db.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('user_id', seed.ids.parishioner);
    const { error } = await db
      .from('messages')
      .insert({ conversation_id: ticketId, sender_id: seed.ids.church_admin, content: 'An unread reply from the office' });
    expect(error).toBeNull();
    await createPendingAppointment();

    await page.goto('/dashboard');
    await expect(messagesBadge).toHaveText('1');
    await expect(appointmentsBadge).toHaveText('1');
    await expect(page.locator('aside').getByText(/^(2|12)$/)).toHaveCount(0);

    // Reading the conversation clears the Messages badge
    await page.goto(`/messages?conv=${ticketId}`);
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: 'An unread reply from the office' })).toBeVisible();
    await expect(messagesBadge).toHaveCount(0);

    // Church admin sees their parish's pending requests
    const adminContext = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, 'church_admin');
    await expect(adminPage.locator('aside a[href="/appointments"] span.rounded-full')).toHaveText('1');
    await adminContext.close();
  });

  test('the conversation info panel shows no invented appointment', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await resetAppointmentData();
    const { data: dm, error } = await db
      .from('conversations')
      .insert({ title: `${TAG} info-dm`, type: 'direct', created_by: seed.ids.parishioner })
      .select('id')
      .single();
    expect(error).toBeNull();
    await db
      .from('conversation_participants')
      .insert([seed.ids.parishioner, seed.ids.church_admin].map((user_id) => ({ conversation_id: dm!.id, user_id })));
    await db.from('messages').insert({ conversation_id: dm!.id, sender_id: seed.ids.church_admin, content: 'Hello from the office' });

    await loginAs(page, 'parishioner');
    await page.goto(`/messages?conv=${dm!.id}`);
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: 'Hello from the office' })).toBeVisible();
    await expect(page.getByText('Local Church Admin').first()).toBeVisible();
    await expect(page.getByText('LINKED REQUEST')).toHaveCount(0);
    await expect(page.getByText('Baptism · Nov 11, 2026')).toHaveCount(0);
    await expect(page.getByText('anna.davis@example.com')).toHaveCount(0);
  });
});

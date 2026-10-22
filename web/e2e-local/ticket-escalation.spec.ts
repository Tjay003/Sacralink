import { test, expect, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clientAs,
  deleteTempAccounts,
  getSeed,
  loginAs,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Escalate to the Super Admin, request a review, send back (migration 070):
 *  - only the Church Admin or the assignee escalates; the hand-over strips every other reader
 *  - the Church Admin learns of an escalated ticket only through list_escalated_ticket_stubs()
 *  - the requester asks for a review after 7 days without a handler reply, with the same effects
 *  - the Super Admin sends back an escalated ticket or a staff member's general/problem ticket, never the others
 *  - the escalate modal and the Super Admin's Tickets tab in the real UI
 */

const db = serviceClient();
const TAG = 'tkt-esc';
const REASON = 'The parish office cannot fix this app bug.';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let requester: TempAccount;
let assignee: TempAccount; // priest of the church
let otherPriest: TempAccount; // priest of the church, never assigned
let volunteer: TempAccount; // volunteer of the church, raises platform tickets
let churchAdmin: SupabaseClient;
let otherChurchAdmin: SupabaseClient;
const accounts: TempAccount[] = [];

async function purge() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function churchTicket(label: string, assigned = false): Promise<string> {
  const { data, error } = await requester.client.rpc('create_ticket', {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} ${label}`,
    p_message: 'A long enough message for the ticket.',
  });
  if (error) throw error;
  const id = data as string;
  if (assigned) {
    await db.from('conversations').update({ assigned_to: assignee.id }).eq('id', id);
    await db.from('conversation_participants').upsert({ conversation_id: id, user_id: assignee.id });
  }
  return id;
}

async function platformTicket(owner: TempAccount | SupabaseClient, category: string, label: string): Promise<string> {
  const client = 'rpc' in owner ? owner : owner.client;
  const { data, error } = await client.rpc('create_ticket', {
    p_lane: 'platform',
    p_church_id: seed.churchId,
    p_category: category,
    p_subject: `${TAG} ${label}`,
    p_message: 'A long enough message for the ticket.',
  });
  if (error) throw error;
  return data as string;
}

async function row(id: string) {
  const { data, error } = await db.from('conversations').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function participants(id: string): Promise<string[]> {
  const { data } = await db.from('conversation_participants').select('user_id').eq('conversation_id', id);
  return (data ?? []).map((p) => p.user_id as string);
}

async function canRead(client: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await client.from('conversations').select('id').eq('id', id);
  return (data ?? []).length === 1;
}

async function systemEvents(id: string): Promise<Array<{ event: string; content: string }>> {
  const { data } = await db
    .from('messages')
    .select('content, metadata')
    .eq('conversation_id', id)
    .eq('message_type', 'system')
    .order('created_at', { ascending: true });
  return (data ?? []).map((m) => ({ event: (m.metadata as { event: string }).event, content: m.content as string }));
}

async function age(id: string, days: number) {
  const created = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  expect((await db.from('conversations').update({ created_at: created }).eq('id', id)).error).toBeNull();
}

async function freshPage(page: Page, account: TempAccount) {
  const context = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await context.newPage();
  await loginAsAccount(other, account);
  return { page: other, close: () => context.close() };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purge();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  requester = await tempUser(TAG, 'requester', 'user', null);
  assignee = await tempUser(TAG, 'assignee', 'priest', seed.churchId);
  otherPriest = await tempUser(TAG, 'other-priest', 'priest', seed.churchId);
  volunteer = await tempUser(TAG, 'volunteer', 'volunteer', seed.churchId);
  accounts.push(requester, assignee, otherPriest, volunteer);
  churchAdmin = await clientAs('church_admin');
  otherChurchAdmin = await clientAs('other_admin');
});

test.afterAll(async () => {
  await purge();
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test.describe('ticket_escalate', () => {
  test('only the Church Admin and the assignee escalate; everyone else, platform, closed and short reasons are refused', async () => {
    const id = await churchTicket('matrix', true);

    const refused: Array<[string, SupabaseClient]> = [
      ['unassigned priest', otherPriest.client],
      ['requester', requester.client],
      ['church admin of another church', otherChurchAdmin],
      ['super admin before escalation', superAdmin.client],
    ];
    for (const [label, client] of refused) {
      const { error } = await client.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON });
      expect(error, label).not.toBeNull();
    }
    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: id, p_reason: 'too short' })).error).not.toBeNull();
    expect((await row(id)).escalated_at).toBeNull();

    const platform = await platformTicket(volunteer, 'general', 'platform not escalatable');
    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: platform, p_reason: REASON })).error).not.toBeNull();

    const closed = await churchTicket('closed');
    expect((await churchAdmin.rpc('ticket_set_status', { p_ticket_id: closed, p_status: 'closed' })).error).toBeNull();
    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: closed, p_reason: REASON })).error).not.toBeNull();

    // The assignee may
    const { error } = await assignee.client.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON });
    expect(error).toBeNull();
    expect((await row(id)).escalated_at).not.toBeNull();
    // Already escalated: nobody can do it again
    expect((await superAdmin.client.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON })).error).not.toBeNull();
  });

  test('the hand-over: Church Admin and assignee lose the ticket, the Super Admin gets it, the requester sees the note', async () => {
    const id = await churchTicket('handover', true);
    expect(await canRead(superAdmin.client, id)).toBe(false);

    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON })).error).toBeNull();

    const after = await row(id);
    expect(after.assigned_to).toBeNull();
    expect(after.status).toBe('in_progress');
    expect((await participants(id)).sort()).toEqual([requester.id, superAdmin.id].sort());

    expect(await canRead(churchAdmin, id)).toBe(false);
    expect(await canRead(assignee.client, id)).toBe(false);
    expect(await canRead(superAdmin.client, id)).toBe(true);
    expect(await canRead(requester.client, id)).toBe(true);

    const adminPost = await churchAdmin.from('messages').insert({ conversation_id: id, sender_id: seed.ids.church_admin, content: 'still here?' });
    expect(adminPost.error).not.toBeNull();
    const superPost = await superAdmin.client.from('messages').insert({ conversation_id: id, sender_id: superAdmin.id, content: 'Looking into it.' });
    expect(superPost.error).toBeNull();
    expect((await superAdmin.client.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'resolved' })).error).toBeNull();

    const notes = await systemEvents(id);
    expect(notes.find((n) => n.event === 'ticket_escalated')?.content).toContain(`escalated this ticket to the Super Admin: ${REASON}`);
    const seen = await requester.client.from('messages').select('content').eq('conversation_id', id).eq('message_type', 'system');
    expect((seen.data ?? []).some((m) => String(m.content).includes('escalated this ticket'))).toBe(true);
  });

  test('list_escalated_ticket_stubs returns only number and date, and only to the Church Admin of that church', async () => {
    const id = await churchTicket('stub', true);
    const before = await churchAdmin.rpc('list_escalated_ticket_stubs');
    expect(before.error).toBeNull();
    const number = (await row(id)).ticket_number as string;
    expect((before.data as Array<{ ticket_number: string }>).some((s) => s.ticket_number === number)).toBe(false);

    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON })).error).toBeNull();
    const escalatedAt = (await row(id)).escalated_at as string;

    const stubs = await churchAdmin.rpc('list_escalated_ticket_stubs');
    const mine = (stubs.data as Array<Record<string, string>>).filter((s) => s.ticket_number === number);
    expect(mine).toHaveLength(1);
    expect(Object.keys(mine[0]).sort()).toEqual(['escalated_at', 'ticket_number']);
    expect(new Date(mine[0].escalated_at).getTime()).toBe(new Date(escalatedAt).getTime());

    for (const [label, client] of [
      ['assignee', assignee.client],
      ['other priest', otherPriest.client],
      ['requester', requester.client],
      ['super admin', superAdmin.client],
      ['other church admin', otherChurchAdmin],
    ] as Array<[string, SupabaseClient]>) {
      const { data, error } = await client.rpc('list_escalated_ticket_stubs');
      expect(error, label).toBeNull();
      expect((data as unknown[]).length, label).toBe(0);
    }

    // Sent back: the stub is gone and the ticket reads as a normal one again
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: id, p_note: 'Please handle this one locally.' })).error).toBeNull();
    const after = await churchAdmin.rpc('list_escalated_ticket_stubs');
    expect((after.data as Array<{ ticket_number: string }>).some((s) => s.ticket_number === number)).toBe(false);
    expect(await canRead(churchAdmin, id)).toBe(true);
  });
});

test.describe('ticket_request_review', () => {
  test('the requester escalates after 7 days with no handler reply; every other case is refused', async () => {
    const id = await churchTicket('review');
    const review = (client: SupabaseClient, ticket = id) => client.rpc('ticket_request_review', { p_ticket_id: ticket });

    expect((await review(requester.client)).error, 'too young').not.toBeNull();
    await age(id, 8);
    expect((await review(churchAdmin)).error, 'not the requester').not.toBeNull();
    expect((await review(superAdmin.client)).error, 'super admin').not.toBeNull();

    const answered = await churchTicket('review-answered');
    await age(answered, 8);
    expect((await db.from('messages').insert({ conversation_id: answered, sender_id: seed.ids.church_admin, content: 'On it.' })).error).toBeNull();
    expect((await review(requester.client, answered)).error, 'handler replied').not.toBeNull();

    const closed = await churchTicket('review-closed');
    await age(closed, 8);
    await churchAdmin.rpc('ticket_set_status', { p_ticket_id: closed, p_status: 'closed' });
    expect((await review(requester.client, closed)).error, 'closed').not.toBeNull();

    const platform = await platformTicket(volunteer, 'general', 'review platform');
    await age(platform, 8);
    expect((await review(volunteer.client, platform)).error, 'platform lane').not.toBeNull();

    // Eligible: same effects as a normal escalation
    expect((await review(requester.client)).error).toBeNull();
    const after = await row(id);
    expect(after.escalated_at).not.toBeNull();
    expect(after.status).toBe('in_progress');
    expect((await participants(id)).sort()).toEqual([requester.id, superAdmin.id].sort());
    expect(await canRead(churchAdmin, id)).toBe(false);
    expect(await canRead(superAdmin.client, id)).toBe(true);
    const note = (await systemEvents(id)).find((n) => n.event === 'ticket_escalated');
    expect(note?.content).toContain('asked the Super Admin to review this ticket (no reply for 7 days)');
    expect((await review(requester.client)).error, 'already escalated').not.toBeNull();
  });
});

test.describe('ticket_send_back', () => {
  test('an escalated church ticket goes back to the Church Admin, leaves the Super Admin and cannot be escalated again', async () => {
    const id = await churchTicket('send back church', true);
    expect((await assignee.client.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON })).error).toBeNull();

    for (const [label, client] of [
      ['church admin', churchAdmin],
      ['requester', requester.client],
      ['assignee', assignee.client],
    ] as Array<[string, SupabaseClient]>) {
      expect((await client.rpc('ticket_send_back', { p_ticket_id: id, p_note: 'Sending this back down.' })).error, label).not.toBeNull();
    }
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: id, p_note: 'short' })).error).not.toBeNull();

    await db.from('notifications').insert({
      user_id: superAdmin.id,
      type: 'message',
      title: 'New ticket message',
      message: 'x',
      link: `/messages?conv=${id}`,
    });
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: id, p_note: 'The church can fix this.' })).error).toBeNull();

    const after = await row(id);
    expect(after.sent_back_at).not.toBeNull();
    expect(after.escalated_at).toBeNull();
    expect(after.ticket_lane).toBe('church');
    expect(after.assigned_to).toBeNull();
    const people = await participants(id);
    expect(people).toContain(seed.ids.church_admin);
    expect(people).toContain(requester.id);
    expect(people).not.toContain(superAdmin.id);
    const { data: left } = await db.from('notifications').select('id').eq('user_id', superAdmin.id).like('link', `%${id}%`);
    expect(left ?? []).toHaveLength(0);

    expect(await canRead(churchAdmin, id)).toBe(true);
    expect(await canRead(superAdmin.client, id)).toBe(false);
    expect((await systemEvents(id)).some((n) => n.event === 'ticket_sent_back' && n.content.includes('sent this ticket back to the Church Admin: The church can fix this.'))).toBe(true);
    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: id, p_reason: REASON })).error).not.toBeNull();
    expect((await requester.client.rpc('ticket_request_review', { p_ticket_id: id })).error).not.toBeNull();
  });

  test('a Volunteer general or problem ticket goes down to the Church Admin; report a person and Church Admin tickets are refused', async () => {
    const note = 'Please deal with this locally.';
    const general = await platformTicket(volunteer, 'general', 'staff general');
    expect(await canRead(churchAdmin, general), 'private before send back').toBe(false);
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: general, p_note: note })).error).toBeNull();
    const sent = await row(general);
    expect(sent.ticket_lane).toBe('church');
    expect(sent.sent_back_at).not.toBeNull();
    expect(await canRead(churchAdmin, general)).toBe(true);
    expect(await canRead(volunteer.client, general)).toBe(true);
    expect(await canRead(superAdmin.client, general)).toBe(false);
    expect((await churchAdmin.rpc('ticket_escalate', { p_ticket_id: general, p_reason: REASON })).error).not.toBeNull();

    const problem = await platformTicket(volunteer, 'report_problem', 'staff problem');
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: problem, p_note: note })).error).toBeNull();

    const person = await platformTicket(volunteer, 'report_person', 'staff person');
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: person, p_note: note })).error).not.toBeNull();
    const adminTicket = await platformTicket(churchAdmin, 'general', 'admin general');
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: adminTicket, p_note: note })).error).not.toBeNull();
    const concern = await platformTicket(requester, 'report_church', 'concern');
    expect((await superAdmin.client.rpc('ticket_send_back', { p_ticket_id: concern, p_note: note })).error).not.toBeNull();
    expect((await row(person)).ticket_lane).toBe('platform');
  });
});

test.describe('in the browser', () => {
  test('the Church Admin escalates through the modal, then only the Super Admin finds the ticket under Tickets', async ({ page }) => {
    const id = await churchTicket('ui escalate');

    await loginAs(page, 'church_admin');
    await page.goto(`/messages?conv=${id}`);
    await expect(page.locator('h2', { hasText: `${TAG} ui escalate` })).toBeVisible();
    await page.getByTestId('ticket-escalate-button').click();
    const submit = page.getByTestId('ticket-escalation-submit');
    await expect(submit).toBeDisabled();
    await page.getByTestId('ticket-escalation-text').fill(REASON);
    await submit.click();
    await expect(page.getByTestId('ticket-escalation-modal')).toHaveCount(0);
    expect((await row(id)).escalated_at).not.toBeNull();
    await expect(page.locator('h2', { hasText: `${TAG} ui escalate` })).toHaveCount(0);

    const superView = await freshPage(page, superAdmin);
    await superView.page.goto('/messages');
    await superView.page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(superView.page.locator('div.divide-y.overflow-y-auto h3').filter({ hasText: `${TAG} ui escalate` })).toHaveCount(1);
    await superView.page.goto(`/messages?conv=${id}`);
    await expect(superView.page.getByTestId('ticket-lane')).toHaveText('Escalated to Super Admin');
    await expect(superView.page.getByTestId('ticket-send-back-button')).toBeVisible();
    await superView.close();
  });
});

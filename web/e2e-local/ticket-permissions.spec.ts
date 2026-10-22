import { test, expect } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clientAs,
  deleteTempAccounts,
  getSeed,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Ticket permissions, ticket_set_status and automatic status (migration 067):
 *  - a ticket is readable only by its requester and its handler (live rule, participant rows grant nothing)
 *  - the Super Admin sees a church ticket only after escalation; then the Church Admin and the assignee lose it
 *  - a platform ticket is readable only by its requester and the Super Admin
 *  - status changes only through ticket_set_status (handler only); direct REST updates of ticket columns fail
 *  - posting: requester or handler, never on a closed ticket, no client system notes
 *  - a handler's reply moves open to in_progress, a requester's reply moves resolved to open
 */

const db = serviceClient();
const TAG = 'tkt-perm';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let requester: TempAccount;
let strangerParishioner: TempAccount;
let assignee: TempAccount; // volunteer of the church, assigned to the ticket
let otherVolunteer: TempAccount; // volunteer of the church, not assigned
let otherPriest: TempAccount; // priest of the church, not assigned
let churchAdmin: SupabaseClient;
let otherChurchAdmin: SupabaseClient;
const accounts: TempAccount[] = [];

async function purgeTickets() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function newTicket(label: string, lane: 'church' | 'platform' = 'church'): Promise<string> {
  const args =
    lane === 'church'
      ? { p_lane: 'church', p_church_id: seed.churchId, p_category: 'general' }
      : { p_lane: 'platform', p_church_id: seed.churchId, p_category: 'report_church' };
  const { data, error } = await requester.client.rpc('create_ticket', {
    ...args,
    p_subject: `${TAG} ${label}`,
    p_message: 'A long enough message for the ticket.',
  });
  if (error) throw error;
  return data as string;
}

async function ticketRow(id: string) {
  const { data, error } = await db.from('conversations').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** True when the caller can read both the conversation row and its messages through RLS. */
async function canRead(client: SupabaseClient, id: string): Promise<boolean> {
  const conv = await client.from('conversations').select('id').eq('id', id);
  const msgs = await client.from('messages').select('id').eq('conversation_id', id);
  const sawConversation = (conv.data ?? []).length === 1;
  const sawMessages = (msgs.data ?? []).length > 0;
  expect(sawConversation, 'conversation row and messages must be readable together').toBe(sawMessages);
  return sawConversation;
}

async function post(client: SupabaseClient, senderId: string, id: string, text = 'reply', type = 'text') {
  return client.from('messages').insert({ conversation_id: id, sender_id: senderId, content: text, message_type: type });
}

async function statusNotes(id: string) {
  const { data } = await db
    .from('messages')
    .select('metadata')
    .eq('conversation_id', id)
    .eq('message_type', 'system')
    .order('created_at', { ascending: true });
  return (data ?? []).map((m) => m.metadata as { event: string; from: string; to: string });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purgeTickets();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  requester = await tempUser(TAG, 'requester', 'user', null);
  strangerParishioner = await tempUser(TAG, 'stranger', 'user', null);
  assignee = await tempUser(TAG, 'assignee', 'volunteer', seed.churchId);
  otherVolunteer = await tempUser(TAG, 'other-vol', 'volunteer', seed.churchId);
  otherPriest = await tempUser(TAG, 'other-priest', 'priest', seed.churchId);
  accounts.push(requester, strangerParishioner, assignee, otherVolunteer, otherPriest);
  churchAdmin = await clientAs('church_admin');
  otherChurchAdmin = await clientAs('other_admin');
});

test.afterAll(async () => {
  await purgeTickets();
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test.describe('who can read a ticket', () => {
  test('a church ticket is read by the requester, its Church Admin and its assignee only, and the Super Admin sees it only after escalation', async () => {
    const id = await newTicket('read church');
    await db.from('conversations').update({ assigned_to: assignee.id }).eq('id', id);

    const readers: Array<[string, SupabaseClient, boolean]> = [
      ['requester', requester.client, true],
      ['church admin of the church', churchAdmin, true],
      ['assigned volunteer', assignee.client, true],
      ['unassigned volunteer', otherVolunteer.client, false],
      ['unassigned priest', otherPriest.client, false],
      ['church admin of another church', otherChurchAdmin, false],
      ['other parishioner', strangerParishioner.client, false],
      ['super admin before escalation', superAdmin.client, false],
    ];
    for (const [label, client, expected] of readers) {
      expect(await canRead(client, id), label).toBe(expected);
    }

    // An assignee who stops being a Volunteer of the church stops reading at once
    await db.from('profiles').update({ role: 'user', church_id: null, assigned_church_id: null }).eq('id', assignee.id);
    expect(await canRead(assignee.client, id), 'demoted assignee').toBe(false);
    await db
      .from('profiles')
      .update({ role: 'volunteer', church_id: seed.churchId, assigned_church_id: seed.churchId })
      .eq('id', assignee.id);
    expect(await canRead(assignee.client, id), 'restored assignee').toBe(true);
  });

  test('after escalation only the requester and the Super Admin read the ticket; the Church Admin and the assignee lose it', async () => {
    const id = await newTicket('read escalated');
    await db.from('conversations').update({ assigned_to: assignee.id }).eq('id', id);
    await db.from('conversations').update({ escalated_at: new Date().toISOString() }).eq('id', id);

    expect(await canRead(requester.client, id), 'requester').toBe(true);
    expect(await canRead(superAdmin.client, id), 'super admin').toBe(true);
    expect(await canRead(churchAdmin, id), 'church admin').toBe(false);
    expect(await canRead(assignee.client, id), 'assignee').toBe(false);
    expect(await canRead(otherVolunteer.client, id), 'unassigned volunteer').toBe(false);
  });

  test('a platform ticket is read only by its requester and the Super Admin, not by the requester\'s own Church Admin', async () => {
    const id = await newTicket('read platform', 'platform');
    expect(await canRead(requester.client, id), 'requester').toBe(true);
    expect(await canRead(superAdmin.client, id), 'super admin').toBe(true);
    expect(await canRead(churchAdmin, id), 'church admin of the church').toBe(false);
    expect(await canRead(otherVolunteer.client, id), 'church volunteer').toBe(false);
    expect(await canRead(otherChurchAdmin, id), 'church admin of another church').toBe(false);
  });
});

test.describe('who can change status', () => {
  test('only a handler can set status, a no-change is rejected, and each change leaves one system note', async () => {
    const id = await newTicket('status rpc');
    await db.from('conversations').update({ assigned_to: assignee.id }).eq('id', id);

    const outsiders: Array<[string, SupabaseClient]> = [
      ['requester', requester.client],
      ['unassigned volunteer', otherVolunteer.client],
      ['unassigned priest', otherPriest.client],
      ['church admin of another church', otherChurchAdmin],
      ['super admin on a non-escalated church ticket', superAdmin.client],
      ['other parishioner', strangerParishioner.client],
    ];
    for (const [label, client] of outsiders) {
      const result = await client.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'closed' });
      expect(result.error, label).not.toBeNull();
    }
    expect((await ticketRow(id)).status).toBe('open');
    expect(await statusNotes(id)).toHaveLength(0);

    // The Church Admin walks through all four statuses; the assignee is a handler too
    const steps: Array<[SupabaseClient, string]> = [
      [churchAdmin, 'in_progress'],
      [assignee.client, 'resolved'],
      [churchAdmin, 'closed'],
      [churchAdmin, 'open'],
    ];
    for (const [client, status] of steps) {
      const result = await client.rpc('ticket_set_status', { p_ticket_id: id, p_status: status });
      expect(result.error, status).toBeNull();
      expect((await ticketRow(id)).status).toBe(status);
    }
    const notes = await statusNotes(id);
    expect(notes.map((n) => `${n.from}>${n.to}`)).toEqual(['open>in_progress', 'in_progress>resolved', 'resolved>closed', 'closed>open']);

    const same = await churchAdmin.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'open' });
    expect(same.error).not.toBeNull();
    const bogus = await churchAdmin.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'banana' });
    expect(bogus.error).not.toBeNull();
    expect(await statusNotes(id)).toHaveLength(4);
  });

  test('the Super Admin handles a platform ticket and an escalated ticket, and the Church Admin no longer can once it is escalated', async () => {
    const platform = await newTicket('status platform', 'platform');
    expect((await superAdmin.client.rpc('ticket_set_status', { p_ticket_id: platform, p_status: 'in_progress' })).error).toBeNull();
    expect((await churchAdmin.rpc('ticket_set_status', { p_ticket_id: platform, p_status: 'resolved' })).error).not.toBeNull();

    const church = await newTicket('status escalated');
    await db.from('conversations').update({ escalated_at: new Date().toISOString() }).eq('id', church);
    expect((await churchAdmin.rpc('ticket_set_status', { p_ticket_id: church, p_status: 'resolved' })).error).not.toBeNull();
    expect((await superAdmin.client.rpc('ticket_set_status', { p_ticket_id: church, p_status: 'resolved' })).error).toBeNull();
    expect((await ticketRow(church)).status).toBe('resolved');
  });

  test('a direct REST update of status, assigned_to, church_id or reopen_count on a ticket row fails for every signed-in caller', async () => {
    const id = await newTicket('column lock');
    const before = await ticketRow(id);

    const callers: Array<[string, SupabaseClient]> = [
      ['requester', requester.client],
      ['church admin', churchAdmin],
      ['super admin', superAdmin.client],
      ['unassigned volunteer', otherVolunteer.client],
    ];
    const patches: Array<Record<string, unknown>> = [
      { status: 'closed' },
      { assigned_to: otherVolunteer.id },
      { church_id: seed.otherChurchId },
      { reopen_count: 5 },
      { escalated_at: new Date().toISOString() },
    ];
    for (const [label, client] of callers) {
      for (const patch of patches) {
        await client.from('conversations').update(patch).eq('id', id);
        const after = await ticketRow(id);
        for (const key of Object.keys(patch)) {
          expect(after[key], `${label} must not change ${key}`).toEqual(before[key]);
        }
      }
    }
    // The requester can see the row, so the refusal is an explicit error rather than a silent no-op
    const loud = await requester.client.from('conversations').update({ status: 'closed' }).eq('id', id);
    expect(loud.error).not.toBeNull();
  });
});

test.describe('who can post, and automatic status', () => {
  test('the requester and the handler can post, outsiders cannot, nobody posts on a closed ticket, and clients cannot write system notes', async () => {
    const id = await newTicket('posting');
    await db.from('conversations').update({ assigned_to: assignee.id }).eq('id', id);

    expect((await post(requester.client, requester.id, id)).error).toBeNull();
    expect((await post(churchAdmin, seed.ids.church_admin, id)).error).toBeNull();
    expect((await post(otherVolunteer.client, otherVolunteer.id, id)).error).not.toBeNull();
    expect((await post(otherChurchAdmin, seed.ids.other_admin, id)).error).not.toBeNull();
    expect((await post(superAdmin.client, superAdmin.id, id)).error).not.toBeNull();
    expect((await post(requester.client, requester.id, id, 'fake note', 'system')).error).not.toBeNull();

    for (const status of ['resolved']) {
      await churchAdmin.rpc('ticket_set_status', { p_ticket_id: id, p_status: status });
      expect((await post(requester.client, requester.id, id, 'still allowed on resolved')).error).toBeNull();
    }

    await db.from('conversations').update({ status: 'closed' }).eq('id', id);
    expect((await post(requester.client, requester.id, id)).error).not.toBeNull();
    expect((await post(churchAdmin, seed.ids.church_admin, id)).error).not.toBeNull();
    expect((await post(assignee.client, assignee.id, id)).error).not.toBeNull();
  });

  test('a handler\'s first reply moves open to in_progress, a requester reply on resolved moves it to open, and a reply on in_progress changes nothing', async () => {
    const id = await newTicket('auto status');

    // The requester's own message on an open ticket changes nothing
    expect((await post(requester.client, requester.id, id)).error).toBeNull();
    expect((await ticketRow(id)).status).toBe('open');

    expect((await post(churchAdmin, seed.ids.church_admin, id, 'first reply')).error).toBeNull();
    expect((await ticketRow(id)).status).toBe('in_progress');
    expect((await statusNotes(id)).map((n) => `${n.from}>${n.to}`)).toEqual(['open>in_progress']);

    expect((await post(churchAdmin, seed.ids.church_admin, id, 'second reply')).error).toBeNull();
    expect((await post(requester.client, requester.id, id, 'thanks')).error).toBeNull();
    expect((await ticketRow(id)).status).toBe('in_progress');

    await churchAdmin.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'resolved' });
    expect((await post(requester.client, requester.id, id, 'one more question')).error).toBeNull();
    const row = await ticketRow(id);
    expect(row.status).toBe('open');
    expect(row.reopen_count).toBe(0);
    expect((await statusNotes(id)).map((n) => `${n.from}>${n.to}`)).toEqual([
      'open>in_progress',
      'in_progress>resolved',
      'resolved>open',
    ]);
  });
});

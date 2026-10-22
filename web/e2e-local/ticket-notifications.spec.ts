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
 * Ticket notifications (migration 075), driven through the real RPCs and message inserts:
 *  - each event notifies the right people, never the actor
 *  - recipients pass the ticket read rule: strangers, the Super Admin before escalation, another church's
 *    Church Admin, an unassigned Priest and a previous assignee get nothing
 *  - repeated replies collapse into one unread notification per recipient
 *  - after escalation the assignee and the Church Admin hear nothing (and their unread ones are gone) until a send back
 */

const db = serviceClient();
const TAG = 'tkt-notify';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let requester: TempAccount;
let volunteer: TempAccount; // first assignee
let volunteer2: TempAccount; // current assignee
let unassignedPriest: TempAccount;
let churchAdmin: SupabaseClient;
let churchAdminId: string;
let otherAdminId: string;
let parishionerId: string;
const accounts: TempAccount[] = [];

let ticketId: string;

async function purge() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function notes(userId: string, conversationId: string, type?: string) {
  let query = db
    .from('notifications')
    .select('type, title, message, link, is_read')
    .eq('user_id', userId)
    .like('link', `%${conversationId}`);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function typesFor(userId: string, conversationId: string) {
  return (await notes(userId, conversationId)).map((n) => n.type).sort();
}

async function say(client: SupabaseClient, conversationId: string, senderId: string, content: string) {
  const { error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content });
  if (error) throw error;
}

async function rpc(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { error } = await client.rpc(fn, args);
  if (error) throw error;
}

async function strangersHeardNothing(conversationId: string) {
  for (const id of [otherAdminId, parishionerId, unassignedPriest.id]) {
    expect(await notes(id, conversationId)).toEqual([]);
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purge();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  requester = await tempUser(TAG, 'requester', 'user', null);
  volunteer = await tempUser(TAG, 'volunteer', 'volunteer', seed.churchId);
  volunteer2 = await tempUser(TAG, 'volunteer2', 'volunteer', seed.churchId);
  unassignedPriest = await tempUser(TAG, 'priest', 'priest', seed.churchId);
  accounts.push(requester, volunteer, volunteer2, unassignedPriest);
  churchAdmin = await clientAs('church_admin');
  churchAdminId = seed.ids.church_admin;
  otherAdminId = seed.ids.other_admin;
  parishionerId = seed.ids.parishioner;
});

test.afterAll(async () => {
  await purge();
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test.describe('ticket notifications', () => {
  test('a new church ticket, an assignment, replies and a status change reach exactly the right people', async () => {
    const { data, error } = await requester.client.rpc('create_ticket', {
      p_lane: 'church',
      p_church_id: seed.churchId,
      p_category: 'general',
      p_subject: `${TAG} church lane`,
      p_message: 'A long enough message for the ticket.',
    });
    if (error) throw error;
    ticketId = data as string;

    // New ticket: the church's Church Admin only, once (the opening message adds no reply notification)
    expect(await typesFor(churchAdminId, ticketId)).toEqual(['ticket_new']);
    const created = (await notes(churchAdminId, ticketId))[0];
    expect(created.link).toBe(`/messages?conv=${ticketId}`);
    expect(created.title).toMatch(/^TCK-\d+: /);
    expect(await notes(requester.id, ticketId)).toEqual([]);
    expect(await notes(superAdmin.id, ticketId)).toEqual([]);

    // Assignment notifies the assignee, not the actor
    await rpc(churchAdmin, 'ticket_assign', { p_ticket_id: ticketId, p_assignee: volunteer.id });
    expect(await typesFor(volunteer.id, ticketId)).toEqual(['ticket_assigned']);
    expect(await typesFor(churchAdminId, ticketId)).toEqual(['ticket_new']);

    // Handler reply notifies the requester; the automatic Open -> In progress flip adds nothing
    await say(volunteer.client, ticketId, volunteer.id, 'We are looking at this now.');
    expect(await typesFor(requester.id, ticketId)).toEqual(['ticket_reply']);
    expect(await typesFor(volunteer.id, ticketId)).toEqual(['ticket_assigned']);

    // Requester replies twice: the Church Admin and the assignee each keep ONE unread reply notification
    await say(requester.client, ticketId, requester.id, 'First follow-up question.');
    await say(requester.client, ticketId, requester.id, 'Second follow-up question.');
    for (const id of [churchAdminId, volunteer.id]) {
      const replies = await notes(id, ticketId, 'ticket_reply');
      expect(replies).toHaveLength(1);
      expect(replies[0].message).toContain('church lane');
      expect(replies[0].is_read).toBe(false);
    }
    // The requester's own replies never notify the requester
    expect(await notes(requester.id, ticketId, 'ticket_reply')).toHaveLength(1);

    // The Church Admin changes the status: the requester and the assignee hear it, the admin does not
    await rpc(churchAdmin, 'ticket_set_status', { p_ticket_id: ticketId, p_status: 'resolved' });
    expect(await notes(requester.id, ticketId, 'ticket_status')).toHaveLength(1);
    expect(await notes(volunteer.id, ticketId, 'ticket_status')).toHaveLength(1);
    expect(await notes(churchAdminId, ticketId, 'ticket_status')).toHaveLength(0);

    // The assignee changing it tells only the requester
    await rpc(volunteer.client, 'ticket_set_status', { p_ticket_id: ticketId, p_status: 'in_progress' });
    expect(await notes(requester.id, ticketId, 'ticket_status')).toHaveLength(2);
    expect(await notes(volunteer.id, ticketId, 'ticket_status')).toHaveLength(1);
    expect(await notes(churchAdminId, ticketId, 'ticket_status')).toHaveLength(0);

    // Nobody who cannot read the ticket was told anything, including the Super Admin before escalation
    expect(await notes(superAdmin.id, ticketId)).toEqual([]);
    await strangersHeardNothing(ticketId);
  });

  test('reassigning and unassigning silences the previous assignee and does not notify on unassign', async () => {
    await rpc(churchAdmin, 'ticket_assign', { p_ticket_id: ticketId, p_assignee: volunteer2.id });
    expect(await typesFor(volunteer2.id, ticketId)).toEqual(['ticket_assigned']);
    // The previous assignee lost the ticket and their unread ones with it
    expect(await notes(volunteer.id, ticketId)).toEqual([]);

    await say(requester.client, ticketId, requester.id, 'Anything new on this?');
    expect(await notes(volunteer.id, ticketId)).toEqual([]);
    expect(await notes(volunteer2.id, ticketId, 'ticket_reply')).toHaveLength(1);

    await rpc(churchAdmin, 'ticket_assign', { p_ticket_id: ticketId, p_assignee: null });
    // Unassigning clears the unread ones and sends nothing new
    expect(await notes(volunteer2.id, ticketId)).toEqual([]);
    await rpc(churchAdmin, 'ticket_assign', { p_ticket_id: ticketId, p_assignee: volunteer2.id });
    expect(await notes(volunteer2.id, ticketId, 'ticket_assigned')).toHaveLength(1);
    await strangersHeardNothing(ticketId);
  });

  test('escalation silences the Church Admin and the assignee until the Super Admin sends it back', async () => {
    await rpc(churchAdmin, 'ticket_escalate', { p_ticket_id: ticketId, p_reason: 'This needs the Super Admin to decide.' });

    expect(await notes(superAdmin.id, ticketId, 'ticket_escalated')).toHaveLength(1);
    expect(await notes(requester.id, ticketId, 'ticket_escalated')).toHaveLength(1);
    // The actor is not told, and the unread ticket notifications of the Church Admin and the assignee are gone
    expect(await notes(churchAdminId, ticketId)).toEqual([]);
    expect(await notes(volunteer2.id, ticketId)).toEqual([]);

    // The requester replies: only the Super Admin is told
    await say(requester.client, ticketId, requester.id, 'Thank you for looking at this.');
    expect(await notes(superAdmin.id, ticketId, 'ticket_reply')).toHaveLength(1);
    expect(await notes(churchAdminId, ticketId)).toEqual([]);
    expect(await notes(volunteer2.id, ticketId)).toEqual([]);

    // The Super Admin replies and changes the status: only the requester is told
    const superClient = superAdmin.client;
    await say(superClient, ticketId, superAdmin.id, 'I am reviewing it.');
    await rpc(superClient, 'ticket_set_status', { p_ticket_id: ticketId, p_status: 'resolved' });
    expect(await notes(requester.id, ticketId, 'ticket_reply').then((n) => n.length)).toBeGreaterThanOrEqual(1);
    expect(await notes(churchAdminId, ticketId)).toEqual([]);
    expect(await notes(volunteer2.id, ticketId)).toEqual([]);
    await strangersHeardNothing(ticketId);

    // Send back: the requester and the Church Admin hear it, the Super Admin does not and loses the ticket
    await rpc(superClient, 'ticket_send_back', { p_ticket_id: ticketId, p_note: 'Please handle this at the church.' });
    expect(await notes(requester.id, ticketId, 'ticket_sent_back')).toHaveLength(1);
    expect(await notes(churchAdminId, ticketId, 'ticket_sent_back')).toHaveLength(1);
    expect(await notes(superAdmin.id, ticketId)).toEqual([]);
    expect(await notes(volunteer2.id, ticketId)).toEqual([]);

    // Afterwards the Church Admin is notified as for any church ticket, the Super Admin is not
    await say(requester.client, ticketId, requester.id, 'Back with the church now.');
    expect(await notes(churchAdminId, ticketId, 'ticket_reply')).toHaveLength(1);
    expect(await notes(superAdmin.id, ticketId)).toEqual([]);
    await strangersHeardNothing(ticketId);
  });

  test('a requester reopening a closed ticket notifies the handlers, not the requester', async () => {
    await rpc(churchAdmin, 'ticket_set_status', { p_ticket_id: ticketId, p_status: 'closed' });
    const before = (await notes(churchAdminId, ticketId, 'ticket_status')).length;
    await rpc(requester.client, 'ticket_reopen', { p_ticket_id: ticketId });
    const after = await notes(churchAdminId, ticketId, 'ticket_status');
    expect(after.length).toBe(before + 1);
    expect(after.some((n) => n.title.includes('reopened'))).toBe(true);
    expect(await notes(superAdmin.id, ticketId)).toEqual([]);
    expect((await notes(requester.id, ticketId, 'ticket_status')).some((n) => n.title.includes('reopened'))).toBe(false);
  });

  test('a platform ticket notifies the Super Admin only, and never the requester own Church Admin', async () => {
    const { data, error } = await requester.client.rpc('create_ticket', {
      p_lane: 'platform',
      p_church_id: seed.churchId,
      p_category: 'report_church',
      p_subject: `${TAG} platform lane`,
      p_message: 'A long enough concern about the church.',
    });
    if (error) throw error;
    const id = data as string;

    expect(await typesFor(superAdmin.id, id)).toEqual(['ticket_new']);
    expect(await notes(churchAdminId, id)).toEqual([]);

    await say(superAdmin.client, id, superAdmin.id, 'Thanks, we are looking into it.');
    expect(await typesFor(requester.id, id)).toEqual(['ticket_reply']);

    await say(requester.client, id, requester.id, 'One more detail for you.');
    expect(await notes(superAdmin.id, id, 'ticket_reply')).toHaveLength(1);
    expect(await notes(churchAdminId, id)).toEqual([]);
    await strangersHeardNothing(id);
  });
});

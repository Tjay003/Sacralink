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
 * Ticket handler assignment (migration 069):
 *  - only the Church Admin of the ticket's church assigns, and only a Priest or Volunteer of that church
 *  - assignment grants read, reply and status rights; unassign or reassign removes them at once
 *  - demoting the assignee unassigns the ticket automatically, platform tickets are left alone
 */

const db = serviceClient();
const TAG = 'tkt-assign';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let requester: TempAccount;
let parishioner: TempAccount;
let assignee: TempAccount; // volunteer of the church
let otherStaff: TempAccount; // priest of the church
let outsider: TempAccount; // volunteer of another church
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

async function canRead(client: SupabaseClient, id: string): Promise<boolean> {
  const conv = await client.from('conversations').select('id').eq('id', id);
  const msgs = await client.from('messages').select('id').eq('conversation_id', id);
  return (conv.data ?? []).length === 1 && (msgs.data ?? []).length > 0;
}

async function isParticipant(userId: string, id: string): Promise<boolean> {
  const { data } = await db.from('conversation_participants').select('user_id').eq('conversation_id', id).eq('user_id', userId);
  return (data ?? []).length > 0;
}

async function systemEvents(id: string): Promise<string[]> {
  const { data } = await db
    .from('messages')
    .select('metadata')
    .eq('conversation_id', id)
    .eq('message_type', 'system')
    .order('created_at', { ascending: true });
  return (data ?? []).map((m) => (m.metadata as { event: string }).event);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purgeTickets();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  requester = await tempUser(TAG, 'requester', 'user', null);
  parishioner = await tempUser(TAG, 'parishioner', 'user', null);
  assignee = await tempUser(TAG, 'assignee', 'volunteer', seed.churchId);
  otherStaff = await tempUser(TAG, 'other-staff', 'priest', seed.churchId);
  outsider = await tempUser(TAG, 'outsider', 'volunteer', seed.otherChurchId);
  accounts.push(requester, parishioner, assignee, otherStaff, outsider);
  churchAdmin = await clientAs('church_admin');
  otherChurchAdmin = await clientAs('other_admin');
});

test.afterAll(async () => {
  await purgeTickets();
  await deleteTempAccounts(accounts);
  await restoreSuperAdmin();
});

test('only the Church Admin of the ticket\'s church can assign; staff, requester, Super Admin and another church cannot', async () => {
  const id = await newTicket('who assigns');
  const denied: Array<[string, SupabaseClient]> = [
    ['requester', requester.client],
    ['unassigned priest', otherStaff.client],
    ['volunteer', assignee.client],
    ['super admin', superAdmin.client],
    ['church admin of another church', otherChurchAdmin],
    ['parishioner', parishioner.client],
  ];
  for (const [label, client] of denied) {
    const { error } = await client.rpc('ticket_assign', { p_ticket_id: id, p_assignee: assignee.id });
    expect(error, label).not.toBeNull();
  }
  expect((await ticketRow(id)).assigned_to).toBeNull();

  const ok = await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: assignee.id });
  expect(ok.error).toBeNull();
  expect((await ticketRow(id)).assigned_to).toBe(assignee.id);
  expect(await systemEvents(id)).toContain('ticket_assigned');
});

test('the Church Admin cannot assign to outsiders, parishioners, the requester, or on platform, escalated or closed tickets', async () => {
  const id = await newTicket('invalid targets');
  for (const [label, target] of [
    ['volunteer of another church', outsider.id],
    ['parishioner', parishioner.id],
    ['requester', requester.id],
    ['the Church Admin', seed.ids.church_admin],
  ] as const) {
    const { error } = await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: target });
    expect(error, label).not.toBeNull();
  }

  const platform = await newTicket('platform lane', 'platform');
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: platform, p_assignee: assignee.id })).error, 'platform').not.toBeNull();
  expect((await superAdmin.client.rpc('ticket_assign', { p_ticket_id: platform, p_assignee: assignee.id })).error, 'super admin platform').not.toBeNull();

  const escalated = await newTicket('escalated');
  await db.from('conversations').update({ escalated_at: new Date().toISOString() }).eq('id', escalated);
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: escalated, p_assignee: assignee.id })).error, 'escalated').not.toBeNull();

  const closed = await newTicket('closed');
  await db.from('conversations').update({ status: 'closed' }).eq('id', closed);
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: closed, p_assignee: assignee.id })).error, 'closed').not.toBeNull();

  expect((await ticketRow(id)).assigned_to).toBeNull();
});

test('assignment grants read, reply and status rights; unassign and reassign take them away with the notifications', async () => {
  const id = await newTicket('access');
  expect(await canRead(assignee.client, id), 'before assignment').toBe(false);

  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: assignee.id })).error).toBeNull();
  expect(await canRead(assignee.client, id), 'assignee reads').toBe(true);
  expect(await canRead(otherStaff.client, id), 'other staff blind').toBe(false);
  expect(await isParticipant(assignee.id, id)).toBe(true);
  const reply = await assignee.client
    .from('messages')
    .insert({ conversation_id: id, sender_id: assignee.id, content: 'On it.', message_type: 'text' });
  expect(reply.error, 'assignee posts').toBeNull();
  expect((await assignee.client.rpc('ticket_set_status', { p_ticket_id: id, p_status: 'resolved' })).error, 'assignee sets status').toBeNull();

  await db.from('notifications').insert({
    user_id: assignee.id,
    type: 'message',
    title: 'New message',
    message: 'You have a new ticket message',
    link: `/messages?conv=${id}`,
    is_read: false,
  });

  // Reassign to the other staff member
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: otherStaff.id })).error).toBeNull();
  expect(await canRead(assignee.client, id), 'previous assignee loses it').toBe(false);
  expect(await canRead(otherStaff.client, id), 'new assignee reads').toBe(true);
  expect(await isParticipant(assignee.id, id)).toBe(false);
  const { data: left } = await db.from('notifications').select('id').eq('user_id', assignee.id).like('link', `%${id}%`);
  expect(left ?? [], 'previous assignee notifications').toHaveLength(0);
  const stale = await assignee.client
    .from('messages')
    .insert({ conversation_id: id, sender_id: assignee.id, content: 'Still here?', message_type: 'text' });
  expect(stale.error, 'previous assignee cannot post').not.toBeNull();

  // Unassign
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: null })).error).toBeNull();
  expect((await ticketRow(id)).assigned_to).toBeNull();
  expect(await canRead(otherStaff.client, id), 'unassigned staff loses it').toBe(false);
  expect(await canRead(requester.client, id), 'requester keeps it').toBe(true);
  expect(await canRead(churchAdmin, id), 'church admin keeps it').toBe(true);
});

test('demoting the assignee unassigns their church tickets with a note and leaves their own platform tickets open', async () => {
  const id = await newTicket('demotion');
  expect((await churchAdmin.rpc('ticket_assign', { p_ticket_id: id, p_assignee: assignee.id })).error).toBeNull();

  const { data: platformId, error: platformErr } = await assignee.client.rpc('create_ticket', {
    p_lane: 'platform',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} own platform`,
    p_message: 'A long enough message for the ticket.',
  });
  expect(platformErr).toBeNull();

  const demote = await churchAdmin.rpc('set_user_role', { p_user_id: assignee.id, p_role: 'user', p_church_id: null, p_is_priest: null });
  expect(demote.error).toBeNull();

  expect((await ticketRow(id)).assigned_to).toBeNull();
  expect(await canRead(assignee.client, id), 'demoted assignee').toBe(false);
  expect(await isParticipant(assignee.id, id)).toBe(false);
  expect(await systemEvents(id)).toContain('ticket_unassigned_staff_removed');
  const platform = await ticketRow(platformId as string);
  expect(platform.status).toBe('open');
  expect(await canRead(assignee.client, platformId as string), 'own platform ticket still readable').toBe(true);
});

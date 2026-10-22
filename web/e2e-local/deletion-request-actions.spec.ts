import { test, expect } from '@playwright/test';
import {
  deleteTempAccounts,
  getSeed,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Decision actions on a deletion request (migration 077). Database rules only:
 *  - Delete anonymizes the subject like delete_user_account and resolves the ticket in one step
 *  - Suspend bans the subject, leaves the ticket In Progress, and Delete / Decline still work afterwards
 *  - Decline closes the ticket with a note, notifies the requesting Church Admin and leaves the subject alone
 *  - only the Super Admin can run them, and only on an open user_deletion_request (not a Report a person ticket)
 *  - the subject is cut off at once, including with an access token that was already issued
 */

const db = serviceClient();
const TAG = 'del-act';
const REASON = 'This person left the parish and asked for their data to be removed.';
const SUSPEND_REASON = 'Investigating a deletion request';

let seed: Seed;
let superAdmin: TempAccount;
let restoreSuper: () => Promise<void>;
let churchAdmin: TempAccount;
let otherAdmin: TempAccount;
const accounts: TempAccount[] = [];
let counter = 0;

async function newSubject(role = 'user') {
  counter += 1;
  const subject = await tempUser(TAG, `subject-${counter}`, role, seed.churchId);
  accounts.push(subject);
  return subject;
}

async function fileRequest(subject: TempAccount, category: 'user_deletion_request' | 'report_person' = 'user_deletion_request') {
  const { data, error } = await churchAdmin.client.rpc('create_ticket', {
    p_lane: 'platform',
    p_church_id: seed.churchId,
    p_category: category,
    p_subject: category === 'report_person' ? 'Report a person' : 'Request user deletion',
    p_message: REASON,
    p_subject_user_id: subject.id,
  });
  expect(error).toBeNull();
  return data as string;
}

async function ticketOf(id: string) {
  const { data } = await db.from('conversations').select('status').eq('id', id).single();
  return data?.status as string;
}

async function profileOf(id: string) {
  const { data } = await db.from('profiles').select('full_name, email, deleted_at, suspended_at, role').eq('id', id).single();
  return data;
}

async function lastSystemNote(ticketId: string) {
  const { data } = await db
    .from('messages')
    .select('content, metadata, sender_id')
    .eq('conversation_id', ticketId)
    .eq('message_type', 'system')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuper = sole.restore;
  churchAdmin = await tempUser(TAG, 'ca', 'church_admin', seed.churchId);
  otherAdmin = await tempUser(TAG, 'other-ca', 'church_admin', seed.otherChurchId);
  accounts.push(churchAdmin, otherAdmin);
});

test.afterAll(async () => {
  await db.from('conversations').delete().like('title', `%Temp subject-%`).eq('category', 'user_deletion_request');
  await db.from('conversations').delete().like('title', `%Temp subject-%`).eq('category', 'report_person');
  await deleteTempAccounts(accounts);
  await restoreSuper();
});

test('Delete from the ticket anonymizes the subject, resolves the ticket, writes the note and notifies the requester', async () => {
  const subject = await newSubject();
  const ticket = await fileRequest(subject);
  await db.from('notifications').delete().eq('user_id', churchAdmin.id);

  const { error } = await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: ticket });
  expect(error).toBeNull();

  const profile = await profileOf(subject.id);
  expect(profile?.full_name).toBe('Deleted User');
  expect(profile?.email).toBeNull();
  expect(profile?.deleted_at).not.toBeNull();
  expect(await ticketOf(ticket)).toBe('resolved');

  const note = await lastSystemNote(ticket);
  expect(note?.content).toMatch(/^Temp super-admin deleted the account of Temp subject-\d+$/);
  expect(note?.sender_id).toBe(superAdmin.id);

  const { data: notifications } = await db.from('notifications').select('type, link').eq('user_id', churchAdmin.id);
  expect((notifications ?? []).some((n) => n.type === 'ticket_status' && String(n.link).includes(ticket))).toBe(true);

  // Already deleted: a second action is refused with a readable message
  const again = await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: ticket });
  expect(again.error?.message).toMatch(/already deleted|already closed|already resolved/i);
});

test('Suspend bans the subject at once, keeps the ticket In Progress, and Delete still works afterwards', async () => {
  const subject = await newSubject();
  const ticket = await fileRequest(subject);

  // Signed in with a token that is still valid
  expect((await subject.client.rpc('get_my_unread_message_count')).error).toBeNull();

  const short = await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: ticket, p_reason: 'short' });
  expect(short.error).not.toBeNull();
  expect(await ticketOf(ticket)).toBe('open');
  expect((await profileOf(subject.id))?.suspended_at).toBeNull();

  const { error } = await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: ticket, p_reason: SUSPEND_REASON });
  expect(error).toBeNull();

  expect((await profileOf(subject.id))?.suspended_at).not.toBeNull();
  expect(await ticketOf(ticket)).toBe('in_progress');
  expect((await lastSystemNote(ticket))?.content).toMatch(/^Temp super-admin suspended Temp subject-\d+ pending review$/);
  expect((await db.auth.admin.getUserById(subject.id)).data.user?.banned_until).not.toBeNull();

  // The already-issued token is rejected on the next request
  expect((await subject.client.rpc('get_my_unread_message_count')).error?.message).toContain('This account is blocked');
  expect((await subject.client.auth.refreshSession()).error).not.toBeNull();

  // A second suspend is refused readably, and the Super Admin can still Delete
  const again = await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: ticket, p_reason: SUSPEND_REASON });
  expect(again.error?.message).toContain('already suspended');
  expect((await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: ticket })).error).toBeNull();
  expect((await profileOf(subject.id))?.deleted_at).not.toBeNull();
  expect(await ticketOf(ticket)).toBe('resolved');
  expect((await subject.client.rpc('get_my_unread_message_count')).error).not.toBeNull();
});

test('Decline closes the ticket with the note, notifies the Church Admin and leaves the subject untouched; Reactivate keeps the ticket status', async () => {
  const subject = await newSubject();
  const ticket = await fileRequest(subject);
  await db.from('notifications').delete().eq('user_id', churchAdmin.id);

  const tooShort = await superAdmin.client.rpc('ticket_request_decline', { p_ticket_id: ticket, p_note: 'no' });
  expect(tooShort.error).not.toBeNull();
  expect(await ticketOf(ticket)).toBe('open');

  expect((await superAdmin.client.rpc('ticket_request_decline', { p_ticket_id: ticket, p_note: 'They are still an active volunteer.' })).error).toBeNull();
  expect(await ticketOf(ticket)).toBe('closed');
  const note = await lastSystemNote(ticket);
  expect(note?.content).toBe('Request declined: They are still an active volunteer.');
  expect(note?.metadata).toMatchObject({ decision: 'declined', note: 'They are still an active volunteer.' });

  const profile = await profileOf(subject.id);
  expect(profile?.deleted_at).toBeNull();
  expect(profile?.suspended_at).toBeNull();
  expect(profile?.email).toBe(subject.email);
  expect((await subject.client.rpc('get_my_unread_message_count')).error).toBeNull();

  const { data: notifications } = await db.from('notifications').select('type, link').eq('user_id', churchAdmin.id);
  expect((notifications ?? []).some((n) => n.type === 'ticket_status' && String(n.link).includes(ticket))).toBe(true);

  // A closed request accepts no further decision
  expect((await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: ticket })).error?.message).toContain('already closed');

  // Suspended through a ticket, then reactivated: the ticket status is left alone
  const other = await newSubject();
  const second = await fileRequest(other);
  expect((await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: second, p_reason: SUSPEND_REASON })).error).toBeNull();
  expect((await superAdmin.client.rpc('reactivate_user', { p_user_id: other.id })).error).toBeNull();
  expect(await ticketOf(second)).toBe('in_progress');
  expect((await profileOf(other.id))?.suspended_at).toBeNull();
});

test('only the Super Admin can run the actions: the requesting Church Admin, another Church Admin and the subject are rejected', async () => {
  const subject = await newSubject();
  const ticket = await fileRequest(subject);

  for (const caller of [churchAdmin, otherAdmin, subject]) {
    expect((await caller.client.rpc('ticket_request_delete', { p_ticket_id: ticket })).error, 'delete').not.toBeNull();
    expect((await caller.client.rpc('ticket_request_suspend', { p_ticket_id: ticket, p_reason: SUSPEND_REASON })).error, 'suspend').not.toBeNull();
    expect(
      (await caller.client.rpc('ticket_request_decline', { p_ticket_id: ticket, p_note: 'A long enough note here' })).error,
      'decline'
    ).not.toBeNull();
  }
  expect(await ticketOf(ticket)).toBe('open');
  const profile = await profileOf(subject.id);
  expect(profile?.deleted_at).toBeNull();
  expect(profile?.suspended_at).toBeNull();

  // A Church Admin still cannot delete or suspend directly
  expect((await churchAdmin.client.rpc('delete_user_account', { p_user_id: subject.id })).error).not.toBeNull();
  expect((await churchAdmin.client.rpc('suspend_user', { p_user_id: subject.id, p_reason: SUSPEND_REASON })).error).not.toBeNull();
});

test('the actions exist only on a user deletion request, never on a Report a person ticket or a missing ticket', async () => {
  const subject = await newSubject();
  const report = await fileRequest(subject, 'report_person');

  expect((await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: report })).error?.message).toContain('only available on a user deletion request');
  expect((await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: report, p_reason: SUSPEND_REASON })).error).not.toBeNull();
  expect((await superAdmin.client.rpc('ticket_request_decline', { p_ticket_id: report, p_note: 'A long enough note here' })).error).not.toBeNull();
  expect(await ticketOf(report)).toBe('open');
  const profile = await profileOf(subject.id);
  expect(profile?.deleted_at).toBeNull();
  expect(profile?.suspended_at).toBeNull();

  const missing = '00000000-0000-0000-0000-000000000000';
  expect((await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: missing })).error).not.toBeNull();
});

test('a subject already deleted or suspended by another path gets a readable refusal and the ticket is left alone', async () => {
  const gone = await newSubject();
  const goneTicket = await fileRequest(gone);
  expect((await superAdmin.client.rpc('delete_user_account', { p_user_id: gone.id })).error).toBeNull();

  const del = await superAdmin.client.rpc('ticket_request_delete', { p_ticket_id: goneTicket });
  expect(del.error?.message).toContain('already deleted');
  const sus = await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: goneTicket, p_reason: SUSPEND_REASON });
  expect(sus.error?.message).toContain('already deleted');
  expect(await ticketOf(goneTicket)).toBe('open');

  // Suspended from the Users page, then suspended again from the ticket: refused, ticket still open
  const held = await newSubject();
  const heldTicket = await fileRequest(held);
  expect((await superAdmin.client.rpc('suspend_user', { p_user_id: held.id, p_reason: SUSPEND_REASON })).error).toBeNull();
  const again = await superAdmin.client.rpc('ticket_request_suspend', { p_ticket_id: heldTicket, p_reason: SUSPEND_REASON });
  expect(again.error?.message).toContain('already suspended');
  expect(await ticketOf(heldTicket)).toBe('open');
});

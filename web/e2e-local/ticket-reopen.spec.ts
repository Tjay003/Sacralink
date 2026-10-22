import { test, expect } from '@playwright/test';
import {
  clientAs,
  deleteTempAccounts,
  getSeed,
  serviceClient,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Reopen limit and linked follow-up (migration 071):
 *  - a requester reopens a Closed ticket twice; the third attempt is refused and the UI offers "Raise a new ticket"
 *  - the handler reopens without limit and without touching reopen_count
 *  - a client cannot write a ticket_reopened note or change reopen_count
 *  - a follow-up links to the original, only for its own requester and only once both reopens are used
 *  - a requester's reply on a Resolved ticket reopens it and does not consume a reopen
 */

const db = serviceClient();
const TAG = 'tkt-reopen';

let seed: Seed;
let requester: TempAccount;
let stranger: TempAccount;
const accounts: TempAccount[] = [];

async function purge() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function newTicket(label: string, client = requester.client): Promise<string> {
  const { data, error } = await client.rpc('create_ticket', {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'baptism',
    p_subject: `${TAG} ${label}`,
    p_message: 'A long enough message for the ticket.',
  });
  if (error) throw error;
  return data as string;
}

async function setStatus(id: string, status: string, reopenCount?: number) {
  const patch: Record<string, unknown> = { status };
  if (reopenCount !== undefined) patch.reopen_count = reopenCount;
  const { error } = await db.from('conversations').update(patch).eq('id', id);
  if (error) throw error;
}

async function row(id: string) {
  const { data, error } = await db.from('conversations').select('status, reopen_count, linked_ticket_id, category, ticket_lane, church_id').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function reopenNotes(id: string) {
  const { data } = await db.from('messages').select('metadata').eq('conversation_id', id).eq('message_type', 'system');
  return (data ?? []).map((m) => m.metadata as Record<string, unknown>).filter((m) => m.event === 'ticket_reopened');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purge();
  requester = await tempUser(TAG, 'requester', 'user', null);
  stranger = await tempUser(TAG, 'stranger', 'user', null);
  accounts.push(requester, stranger);
});

test.afterAll(async () => {
  await purge();
  await deleteTempAccounts(accounts);
});

test.describe('ticket_reopen', () => {
  test('a requester reopens twice, the third attempt is refused, and each reopen logs a note', async () => {
    const id = await newTicket('limit');

    for (const expected of [1, 2]) {
      await setStatus(id, 'closed');
      const { error } = await requester.client.rpc('ticket_reopen', { p_ticket_id: id });
      expect(error).toBeNull();
      const after = await row(id);
      expect(after.status).toBe('open');
      expect(after.reopen_count).toBe(expected);
    }

    await setStatus(id, 'closed');
    const third = await requester.client.rpc('ticket_reopen', { p_ticket_id: id });
    expect(third.error?.code).toBe('23514');
    expect(third.error?.message).toContain('reopen limit');
    const after = await row(id);
    expect(after.status).toBe('closed');
    expect(after.reopen_count).toBe(2);

    const notes = await reopenNotes(id);
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.by === 'requester')).toBe(true);
  });

  test('the handler reopens any number of times and reopen_count never moves; strangers and open tickets are refused', async () => {
    const id = await newTicket('handler');
    const admin = await clientAs('church_admin');

    for (let i = 0; i < 4; i += 1) {
      await setStatus(id, 'closed');
      const { error } = await admin.rpc('ticket_reopen', { p_ticket_id: id });
      expect(error).toBeNull();
    }
    expect((await row(id)).reopen_count).toBe(0);
    expect((await reopenNotes(id)).every((n) => n.by === 'handler')).toBe(true);

    await setStatus(id, 'closed');
    const asStranger = await stranger.client.rpc('ticket_reopen', { p_ticket_id: id });
    expect(asStranger.error).not.toBeNull();
    expect((await row(id)).status).toBe('closed');

    await setStatus(id, 'open');
    const notClosed = await requester.client.rpc('ticket_reopen', { p_ticket_id: id });
    expect(notClosed.error).not.toBeNull();
  });

  test('a client cannot write a ticket_reopened note or change reopen_count directly', async () => {
    const id = await newTicket('forge');
    await setStatus(id, 'closed');

    const forged = await requester.client.from('messages').insert({
      conversation_id: id,
      sender_id: requester.id,
      content: 'Forged reopened this ticket.',
      message_type: 'system',
      metadata: { event: 'ticket_reopened', by: 'handler' },
    });
    expect(forged.error).not.toBeNull();
    expect(await reopenNotes(id)).toHaveLength(0);

    const count = await requester.client.from('conversations').update({ reopen_count: 5 }).eq('id', id).select('id');
    expect(count.error).not.toBeNull();
    const status = await requester.client.from('conversations').update({ status: 'open' }).eq('id', id).select('id');
    expect(status.error).not.toBeNull();
    expect((await row(id)).status).toBe('closed');
  });
});

test.describe('linked follow-up', () => {
  test('only the requester, only on a closed ticket with both reopens used, and the link and defaults are stored', async () => {
    const id = await newTicket('followup-source');
    const args = (client: TempAccount['client']) =>
      client.rpc('create_ticket', {
        p_lane: null,
        p_church_id: null,
        p_category: null,
        p_subject: `${TAG} Follow-up: source`,
        p_message: 'Following up on my earlier ticket.',
        p_linked_ticket_id: id,
      });

    // Not closed, then closed with reopens left: refused
    expect((await args(requester.client)).error).not.toBeNull();
    await setStatus(id, 'closed', 1);
    expect((await args(requester.client)).error?.message).toContain('reopened twice');

    // At the limit but still open: refused
    await setStatus(id, 'open', 2);
    expect((await args(requester.client)).error).not.toBeNull();

    // At the limit and closed: a stranger is refused, the requester succeeds
    await setStatus(id, 'closed', 2);
    expect((await args(stranger.client)).error).not.toBeNull();
    const created = await args(requester.client);
    expect(created.error).toBeNull();

    const followUp = await row(created.data as string);
    expect(followUp.linked_ticket_id).toBe(id);
    expect(followUp.category).toBe('baptism');
    expect(followUp.ticket_lane).toBe('church');
    expect(followUp.church_id).toBe(seed.churchId);
  });

  test('a requester reply on a Resolved ticket reopens it and does not consume a reopen', async () => {
    const id = await newTicket('resolved-reply');
    await setStatus(id, 'resolved');

    const { error } = await requester.client.from('messages').insert({
      conversation_id: id,
      sender_id: requester.id,
      content: 'Thank you, one more question please.',
    });
    expect(error).toBeNull();
    const after = await row(id);
    expect(after.status).toBe('open');
    expect(after.reopen_count).toBe(0);
    expect(await reopenNotes(id)).toHaveLength(0);
  });
});

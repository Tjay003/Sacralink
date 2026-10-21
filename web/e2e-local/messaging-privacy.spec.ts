import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, USERS, clientAs, getSeed, loginAs, serviceClient, type Seed } from './support';

/**
 * Messaging privacy (migration 059, ADR 0002):
 *  - Direct Messages are readable only by their participants, not by church admins, admins or the super admin.
 *  - Parishioners are never members of, and can never read, a Parish Staff Channel.
 *  - Parish Office Tickets are readable by the requester and that parish's staff, never by other parishes.
 *  - Browser: signing out clears the cached ministry conversations so the next account never sees them.
 */

const db = serviceClient();
const TAG = 'rls-privacy';
const tempEmails: string[] = [];

interface TempUser {
  id: string;
  client: SupabaseClient;
}

async function tempUser(label: string, role: string, churchId: string | null): Promise<TempUser> {
  const email = `${TAG}-${label}@local.test`;
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

async function purgeConversations() {
  const { error } = await db.from('conversations').delete().like('title', `${TAG}%`);
  if (error) throw error;
}

async function makeConversation(fields: Record<string, unknown>, participantIds: string[]): Promise<string> {
  const { data, error } = await db.from('conversations').insert(fields).select('id').single();
  if (error) throw error;
  if (participantIds.length) {
    const { error: pErr } = await db
      .from('conversation_participants')
      .insert(participantIds.map((user_id) => ({ conversation_id: data.id, user_id })));
    if (pErr) throw pErr;
  }
  return data.id as string;
}

async function postMessage(conversationId: string, senderId: string, content: string) {
  const { error } = await db.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content });
  if (error) throw error;
}

async function visibleConversationIds(client: SupabaseClient, ids: string[]): Promise<string[]> {
  const { data, error } = await client.from('conversations').select('id').in('id', ids);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.id as string);
}

async function visibleMessageCount(client: SupabaseClient, conversationId: string): Promise<number> {
  const { data, error } = await client.from('messages').select('id').eq('conversation_id', conversationId);
  expect(error).toBeNull();
  return data?.length ?? 0;
}

let seed: Seed;
let dmPartner: TempUser;
let stranger: TempUser;
let parishionerWithChurch: TempUser;
let volunteer: TempUser;
let admin: TempUser;
let superAdmin: TempUser;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purgeConversations();
  dmPartner = await tempUser('dm-partner', 'user', seed.churchId);
  stranger = await tempUser('stranger', 'user', seed.churchId);
  parishionerWithChurch = await tempUser('parishioner-church', 'user', seed.churchId);
  volunteer = await tempUser('volunteer', 'volunteer', seed.churchId);
  admin = await tempUser('admin', 'admin', seed.churchId);
  superAdmin = await tempUser('super-admin', 'super_admin', null);
});

test.afterAll(async () => {
  await purgeConversations();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const user of list?.users ?? []) {
    if (user.email && tempEmails.includes(user.email)) await db.auth.admin.deleteUser(user.id);
  }
});

test.describe('Direct Message privacy', () => {
  test('only the two participants can read a Direct Message; admins and the super admin cannot', async () => {
    const parishioner = await clientAs('parishioner');
    const churchAdmin = await clientAs('church_admin');
    const dmId = await makeConversation({ title: `${TAG}-dm`, type: 'direct', created_by: seed.ids.parishioner }, [
      seed.ids.parishioner,
      dmPartner.id,
    ]);
    await postMessage(dmId, seed.ids.parishioner, 'a private hello');

    for (const participant of [parishioner, dmPartner.client]) {
      expect(await visibleConversationIds(participant, [dmId])).toEqual([dmId]);
      expect(await visibleMessageCount(participant, dmId)).toBe(1);
    }

    for (const outsider of [stranger.client, churchAdmin, admin.client, superAdmin.client]) {
      expect(await visibleConversationIds(outsider, [dmId])).toEqual([]);
      expect(await visibleMessageCount(outsider, dmId)).toBe(0);
      const participants = await outsider.from('conversation_participants').select('id').eq('conversation_id', dmId);
      expect(participants.data ?? []).toHaveLength(0);

      const intrusion = await outsider
        .from('messages')
        .insert({ conversation_id: dmId, sender_id: (await outsider.auth.getUser()).data.user!.id, content: 'sneaky' });
      expect(intrusion.error).not.toBeNull();
    }
  });

  test('a parishioner can still start a Direct Message with the parish office and get a reply', async () => {
    const parishioner = await clientAs('parishioner');
    const churchAdmin = await clientAs('church_admin');

    const created = await parishioner
      .from('conversations')
      .insert({ title: `${TAG}-dm-office`, type: 'direct', created_by: seed.ids.parishioner })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const dmId = created.data!.id as string;

    const joined = await parishioner.from('conversation_participants').insert([
      { conversation_id: dmId, user_id: seed.ids.parishioner },
      { conversation_id: dmId, user_id: seed.ids.church_admin },
    ]);
    expect(joined.error).toBeNull();

    const sent = await parishioner.from('messages').insert({ conversation_id: dmId, sender_id: seed.ids.parishioner, content: 'hello office' });
    expect(sent.error).toBeNull();

    expect(await visibleMessageCount(churchAdmin, dmId)).toBe(1);
    const reply = await churchAdmin.from('messages').insert({ conversation_id: dmId, sender_id: seed.ids.church_admin, content: 'hello back' });
    expect(reply.error).toBeNull();
    expect(await visibleMessageCount(parishioner, dmId)).toBe(2);
  });
});

test.describe('Parish Staff Channel', () => {
  test('a parishioner with a parish is not enrolled and cannot read the channel; staff can', async () => {
    const churchAdmin = await clientAs('church_admin');
    const priest = await clientAs('priest');
    const otherAdmin = await clientAs('other_admin');
    const channelId = await makeConversation(
      { title: `${TAG}-staff-channel`, type: 'channel', church_id: seed.churchId, created_by: seed.ids.church_admin },
      [seed.ids.church_admin, seed.ids.priest, volunteer.id],
    );
    await postMessage(channelId, seed.ids.church_admin, 'staff only');

    for (const staff of [churchAdmin, priest, volunteer.client]) {
      expect(await visibleConversationIds(staff, [channelId])).toEqual([channelId]);
      expect(await visibleMessageCount(staff, channelId)).toBe(1);
    }

    // Parishioners (with a parish) see nothing, and nobody - not even staff - can enrol them
    expect(await visibleConversationIds(parishionerWithChurch.client, [channelId])).toEqual([]);
    expect(await visibleMessageCount(parishionerWithChurch.client, channelId)).toBe(0);

    const selfJoin = await parishionerWithChurch.client
      .from('conversation_participants')
      .insert({ conversation_id: channelId, user_id: parishionerWithChurch.id });
    expect(selfJoin.error).not.toBeNull();

    const staffAdds = await churchAdmin
      .from('conversation_participants')
      .insert({ conversation_id: channelId, user_id: parishionerWithChurch.id });
    expect(staffAdds.error).not.toBeNull();

    const enrolled = await db
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', channelId)
      .eq('user_id', parishionerWithChurch.id);
    expect(enrolled.data ?? []).toHaveLength(0);

    // A church admin of another parish is not staff of this channel either
    expect(await visibleConversationIds(otherAdmin, [channelId])).toEqual([]);

    // Staff can still post to the channel; the parishioner cannot
    const staffPost = await volunteer.client.from('messages').insert({ conversation_id: channelId, sender_id: volunteer.id, content: 'volunteer here' });
    expect(staffPost.error).toBeNull();
    const parishionerPost = await parishionerWithChurch.client
      .from('messages')
      .insert({ conversation_id: channelId, sender_id: parishionerWithChurch.id, content: 'let me in' });
    expect(parishionerPost.error).not.toBeNull();
  });
});

test.describe('Parish Office Tickets', () => {
  test('visible to the requester and the parish staff only, and staff can still reply and change status', async () => {
    const parishioner = await clientAs('parishioner');
    const churchAdmin = await clientAs('church_admin');
    const otherAdmin = await clientAs('other_admin');

    // The requester opens a ticket the same way the app does
    const created = await parishioner
      .from('conversations')
      .insert({
        title: `${TAG}-ticket`,
        type: 'group',
        church_id: seed.churchId,
        created_by: seed.ids.parishioner,
        category: 'general',
        status: 'open',
        ticket_number: `TCK-${Date.now().toString().slice(-6)}`,
      })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const ticketId = created.data!.id as string;

    const joined = await parishioner.from('conversation_participants').insert(
      [seed.ids.parishioner, seed.ids.church_admin, seed.ids.priest].map((user_id) => ({ conversation_id: ticketId, user_id })),
    );
    expect(joined.error).toBeNull();
    const opening = await parishioner
      .from('messages')
      .insert({ conversation_id: ticketId, sender_id: seed.ids.parishioner, content: 'I need a certificate' });
    expect(opening.error).toBeNull();

    // Requester, the parish church admin, the parish volunteer (not a participant) and the super admin can read it
    for (const reader of [parishioner, churchAdmin, volunteer.client, superAdmin.client]) {
      expect(await visibleConversationIds(reader, [ticketId])).toEqual([ticketId]);
      expect(await visibleMessageCount(reader, ticketId)).toBe(1);
    }

    // Another parish's admin and an unrelated parishioner cannot
    for (const outsider of [otherAdmin, stranger.client]) {
      expect(await visibleConversationIds(outsider, [ticketId])).toEqual([]);
      expect(await visibleMessageCount(outsider, ticketId)).toBe(0);
    }
    const outsiderReply = await otherAdmin
      .from('messages')
      .insert({ conversation_id: ticketId, sender_id: (await otherAdmin.auth.getUser()).data.user!.id, content: 'not mine' });
    expect(outsiderReply.error).not.toBeNull();
    const outsiderStatus = await otherAdmin.from('conversations').update({ status: 'closed' }).eq('id', ticketId).select('id');
    expect(outsiderStatus.data ?? []).toHaveLength(0);

    // Staff reply and move the ticket along
    const adminReply = await churchAdmin.from('messages').insert({ conversation_id: ticketId, sender_id: seed.ids.church_admin, content: 'On it' });
    expect(adminReply.error).toBeNull();
    const volunteerReply = await volunteer.client.from('messages').insert({ conversation_id: ticketId, sender_id: volunteer.id, content: 'Ready tomorrow' });
    expect(volunteerReply.error).toBeNull();

    const inProgress = await churchAdmin.from('conversations').update({ status: 'in_progress' }).eq('id', ticketId).select('status');
    expect(inProgress.error).toBeNull();
    expect(inProgress.data).toEqual([{ status: 'in_progress' }]);
    const resolved = await volunteer.client.from('conversations').update({ status: 'resolved' }).eq('id', ticketId).select('status');
    expect(resolved.error).toBeNull();
    expect(resolved.data).toEqual([{ status: 'resolved' }]);

    // The requester sees the replies and can follow up and reopen
    expect(await visibleMessageCount(parishioner, ticketId)).toBe(3);
    const followUp = await parishioner.from('messages').insert({ conversation_id: ticketId, sender_id: seed.ids.parishioner, content: 'Thank you' });
    expect(followUp.error).toBeNull();
    const reopened = await parishioner.from('conversations').update({ status: 'open' }).eq('id', ticketId).select('status');
    expect(reopened.data).toEqual([{ status: 'open' }]);
  });
});

test.describe('Sign-out cache cleanup', () => {
  test('logging out and in as another user shows no cached conversations from the first user', async ({ page }) => {
    await loginAs(page, 'parishioner');

    // Stand-in for the fallback cache the first user's session left behind
    await page.evaluate((userId) => {
      const conv = JSON.stringify([{ id: 'ministry-cache-test', title: 'Cached Ministry', type: 'group', church_id: 'c1', created_by: userId, created_at: '', updated_at: '', participants: [userId] }]);
      localStorage.setItem(`sacralink_local_ministry_convs:${userId}`, conv);
      sessionStorage.setItem(`sacralink_local_ministry_convs:${userId}`, conv);
      localStorage.setItem('sacralink_local_ministry_convs', conv);
      localStorage.setItem(`sacralink_local_ministry_messages:${userId}_ministry-cache-test`, '[]');
      localStorage.setItem('sacralink_local_ministry_messages_ministry-cache-test', '[]');
    }, seed.ids.parishioner);

    await page.locator('aside button:has-text("Sign out")').click();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await page.waitForURL('**/login**');

    const leftovers = () =>
      page.evaluate(() =>
        [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((key) => key.startsWith('sacralink_local_ministry')),
      );
    expect(await leftovers()).toEqual([]);

    await page.locator('#email').fill(USERS.priest.email);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard**');
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');

    expect(await leftovers()).toEqual([]);
    await expect(page.getByText('Cached Ministry')).toHaveCount(0);
  });
});

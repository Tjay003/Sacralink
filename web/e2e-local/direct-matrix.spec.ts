import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, getSeed, isoDate, serviceClient, type Seed } from './support';

/**
 * Direct-message matrix (migration 065, spec decisions 27 and 33):
 *  - start_direct_conversation / may_start_direct follow the matrix for every initiator and target role.
 *  - REST can no longer insert a Direct conversation or a Direct participant.
 *  - Chats their starter could not start today are read-only for Parishioners and Volunteers
 *    ("Please open a ticket") but stay readable and replyable for Church Admins, Priests and the Super Admin.
 */

const db = serviceClient();
const TAG = 'dmx';

type Who =
  | 'parA' | 'parA2' | 'volA' | 'priestA' | 'adminA'
  | 'parB' | 'volB' | 'priestB' | 'adminB' | 'super';
type Kind = 'user' | 'volunteer' | 'priest' | 'church_admin' | 'super_admin';

interface Temp {
  id: string;
  kind: Kind;
  church: 'A' | 'B' | null;
  client: SupabaseClient;
}

const SPEC: Record<Who, { kind: Kind; church: 'A' | 'B' | null }> = {
  parA: { kind: 'user', church: 'A' },
  parA2: { kind: 'user', church: 'A' },
  volA: { kind: 'volunteer', church: 'A' },
  priestA: { kind: 'priest', church: 'A' },
  adminA: { kind: 'church_admin', church: 'A' },
  parB: { kind: 'user', church: 'B' },
  volB: { kind: 'volunteer', church: 'B' },
  priestB: { kind: 'priest', church: 'B' },
  adminB: { kind: 'church_admin', church: 'B' },
  super: { kind: 'super_admin', church: null },
};

let seed: Seed;
const users = {} as Record<Who, Temp>;
const createdConversations: string[] = [];
let replacedSuperAdmin: string | null = null;

async function makeUser(label: Who): Promise<Temp> {
  const { kind, church } = SPEC[label];
  const email = `${TAG}-${label.toLowerCase()}@local.test`;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const stale = list?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const churchId = church === 'A' ? seed.churchId : church === 'B' ? seed.otherChurchId : null;
  const { error: profileErr } = await db.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name: `Temp ${label}`,
    role: kind,
    is_priest: kind === 'priest',
    church_id: churchId,
    assigned_church_id: churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
  return { id: data.user.id, kind, church, client };
}

/** The matrix from the spec, written independently of the SQL. */
function allowed(from: Who, to: Who): boolean {
  const a = users[from];
  const b = users[to];
  if (from === to) return false;
  switch (a.kind) {
    case 'user':
    case 'volunteer':
      return false;
    case 'priest':
      if (b.kind === 'user') return from === 'priestA' && to === 'parA'; // the only seeded appointment
      return b.kind === 'church_admin' && a.church === b.church;
    case 'church_admin':
      if (b.kind === 'super_admin' || b.kind === 'church_admin') return true;
      return a.church === b.church;
    case 'super_admin':
      return b.kind === 'church_admin';
  }
}

async function seedChat(createdBy: Who | null, members: Who[], messages: Array<[Who, string]> = []): Promise<string> {
  const { data, error } = await db
    .from('conversations')
    .insert({ type: 'direct', title: `${TAG}-chat`, created_by: createdBy ? users[createdBy].id : null })
    .select('id')
    .single();
  if (error) throw error;
  createdConversations.push(data.id);
  const { error: pErr } = await db
    .from('conversation_participants')
    .insert(members.map((m) => ({ conversation_id: data.id, user_id: users[m].id })));
  if (pErr) throw pErr;
  for (const [sender, content] of messages) {
    const { error: mErr } = await db.from('messages').insert({ conversation_id: data.id, sender_id: users[sender].id, content });
    if (mErr) throw mErr;
  }
  return data.id as string;
}

async function reply(who: Who, conversationId: string, content: string) {
  return users[who].client.from('messages').insert({ conversation_id: conversationId, sender_id: users[who].id, content });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  // The Super Admin is unique; if another spec left one behind, borrow its slot for this run and restore it afterwards
  const { data: existing } = await db.from('profiles').select('id, email').eq('role', 'super_admin');
  for (const row of existing ?? []) {
    if (!row.email?.startsWith(`${TAG}-`)) {
      replacedSuperAdmin = row.id;
      await db.from('profiles').update({ role: 'user' }).eq('id', row.id);
    }
  }
  for (const who of Object.keys(SPEC) as Who[]) users[who] = await makeUser(who);
  const { error } = await db.from('appointments').insert({
    user_id: users.parA.id,
    church_id: seed.churchId,
    service_type: 'Baptism',
    appointment_date: isoDate(30),
    appointment_time: '09:00:00',
    status: 'approved',
    priest_id: users.priestA.id,
  });
  if (error) throw error;
});

test.afterAll(async () => {
  if (createdConversations.length) await db.from('conversations').delete().in('id', createdConversations);
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const user of list?.users ?? []) {
    if (user.email?.startsWith(`${TAG}-`)) await db.auth.admin.deleteUser(user.id);
  }
  if (replacedSuperAdmin) await db.from('profiles').update({ role: 'super_admin' }).eq('id', replacedSuperAdmin);
});

test.describe('start_direct_conversation follows the matrix', () => {
  test('every initiator against every target: allowed cells create a chat, the rest are rejected', async () => {
    const all = Object.keys(SPEC) as Who[];
    const mismatches: string[] = [];
    for (const from of all) {
      for (const to of all) {
        if (from === to) continue;
        const expected = allowed(from, to);
        const check = await users[from].client.rpc('may_start_direct', { _initiator: users[from].id, _target: users[to].id });
        if (check.error || check.data !== expected) mismatches.push(`may_start_direct ${from}->${to}: got ${check.data}, want ${expected}`);

        const res = await users[from].client.rpc('start_direct_conversation', { p_target: users[to].id });
        if (expected) {
          if (res.error || !res.data) {
            mismatches.push(`start ${from}->${to}: rejected (${res.error?.message})`);
            continue;
          }
          const id = res.data as string;
          const members = await db.from('conversation_participants').select('user_id').eq('conversation_id', id);
          const ids = (members.data ?? []).map((m) => m.user_id).sort();
          if (JSON.stringify(ids) !== JSON.stringify([users[from].id, users[to].id].sort())) mismatches.push(`start ${from}->${to}: wrong participants`);
          const conv = await db.from('conversations').select('type,created_by').eq('id', id).single();
          if (conv.data?.type !== 'direct' || conv.data?.created_by !== users[from].id) mismatches.push(`start ${from}->${to}: wrong conversation row`);
          // Remove it so the reverse cell is judged by the matrix, not by an existing chat
          await db.from('conversations').delete().eq('id', id);
        } else if (!res.error) {
          mismatches.push(`start ${from}->${to}: should have been rejected`);
          await db.from('conversations').delete().eq('id', res.data as string);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('rejections name the route to use, and a Priest needs a shared appointment', async () => {
    const msg = async (from: Who, to: Who) => (await users[from].client.rpc('start_direct_conversation', { p_target: users[to].id })).error?.message ?? '';
    expect(await msg('parA2', 'adminA')).toContain('Raise a ticket instead');
    expect(await msg('volA', 'adminA')).toContain('church staff channel');
    expect(await msg('priestA', 'super')).toContain('Raise a platform ticket');
    expect(await msg('priestA', 'volA')).toContain('church staff channel');
    expect(await msg('priestA', 'parA2')).toContain('appointment');
    expect(await msg('adminA', 'parB')).toContain('own church');
    expect(await msg('super', 'parA')).toContain('Church Admins');
  });

  test('asking again, from either side, returns the same chat instead of a second one', async () => {
    const first = await users.adminA.client.rpc('start_direct_conversation', { p_target: users.parA.id });
    expect(first.error).toBeNull();
    createdConversations.push(first.data as string);
    const again = await users.adminA.client.rpc('start_direct_conversation', { p_target: users.parA.id });
    expect(again.data).toBe(first.data);
    // The parishioner may not start chats, but opening the one the admin started is not starting a new one
    const fromRecipient = await users.parA.client.rpc('start_direct_conversation', { p_target: users.adminA.id });
    expect(fromRecipient.error).toBeNull();
    expect(fromRecipient.data).toBe(first.data);
  });
});

test.describe('REST cannot bypass the function', () => {
  test('nobody can insert a Direct conversation or add a participant to one through REST', async () => {
    const existing = await seedChat(null, ['adminA', 'adminB']);
    for (const who of ['parA', 'volA', 'priestA', 'adminA', 'adminB', 'super'] as Who[]) {
      const c = users[who].client;
      const conv = await c.from('conversations').insert({ type: 'direct', created_by: users[who].id, title: `${TAG}-rest` });
      expect(conv.error, `${who} inserted a direct conversation`).not.toBeNull();

      const self = await c.from('conversation_participants').insert({ conversation_id: existing, user_id: users[who].id });
      expect(self.error, `${who} added themselves to a direct chat`).not.toBeNull();
      const other = await c.from('conversation_participants').insert({ conversation_id: existing, user_id: users.parA2.id });
      expect(other.error, `${who} added someone to a direct chat`).not.toBeNull();
    }
    const members = await db.from('conversation_participants').select('user_id').eq('conversation_id', existing);
    expect(members.data).toHaveLength(2);
    const stray = await db.from('conversations').select('id').eq('title', `${TAG}-rest`);
    expect(stray.data ?? []).toHaveLength(0);
  });
});

test.describe('legacy Direct chats', () => {
  test('a chat a Parishioner or Volunteer started with the office is read-only for them but still readable', async () => {
    const parChat = await seedChat('parA', ['parA', 'adminA'], [['parA', 'hello office'], ['adminA', 'hello back']]);
    const volChat = await seedChat('volA', ['volA', 'adminA'], [['volA', 'volunteer hello']]);
    const priestVolChat = await seedChat('priestA', ['priestA', 'volA'], [['priestA', 'priest to volunteer']]);

    for (const id of [parChat, volChat, priestVolChat]) {
      const flag = await db.rpc('direct_is_legacy', { _conversation_id: id });
      expect(flag.data).toBe(true);
    }

    expect((await reply('parA', parChat, 'one more thing')).error?.message).toContain('Please open a ticket');
    expect((await reply('volA', volChat, 'one more thing')).error?.message).toContain('Please open a ticket');
    expect((await reply('volA', priestVolChat, 'one more thing')).error?.message).toContain('Please open a ticket');

    // History stays readable and untouched
    const history = await users.parA.client.from('messages').select('content').eq('conversation_id', parChat);
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(2);
    const listed = await users.parA.client.from('conversations').select('id, is_legacy_direct').eq('id', parChat).single();
    expect(listed.data?.is_legacy_direct).toBe(true);

    // Church Admin and Priest can still finish them
    expect((await reply('adminA', parChat, 'closing this out')).error).toBeNull();
    expect((await reply('adminA', volChat, 'closing this out')).error).toBeNull();
    expect((await reply('priestA', priestVolChat, 'still here')).error).toBeNull();
    const total = await db.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', parChat);
    expect(total.count).toBe(3);
  });

  test('admin-to-admin, admin-to-super and a chat whose starter can still start it stay replyable both ways', async () => {
    const adminAdmin = await seedChat('adminA', ['adminA', 'adminB'], [['adminA', 'hi']]);
    const adminSuper = await seedChat('adminA', ['adminA', 'super'], [['adminA', 'hi']]);
    const adminParishioner = await seedChat('adminA', ['adminA', 'parA'], [['adminA', 'about your baptism']]);
    const superAdminChat = await seedChat('super', ['super', 'adminB'], [['super', 'hi']]);
    const unknownStarter = await seedChat(null, ['adminA', 'parA2'], [['adminA', 'hi']]);

    for (const id of [adminAdmin, adminSuper, adminParishioner, superAdminChat, unknownStarter]) {
      expect((await db.rpc('direct_is_legacy', { _conversation_id: id })).data).toBe(false);
    }

    expect((await reply('adminB', adminAdmin, 'hello')).error).toBeNull();
    expect((await reply('adminA', adminAdmin, 'hello again')).error).toBeNull();
    expect((await reply('super', adminSuper, 'hello')).error).toBeNull();
    expect((await reply('adminA', adminSuper, 'hello again')).error).toBeNull();
    expect((await reply('parA', adminParishioner, 'thank you')).error).toBeNull();
    expect((await reply('adminA', adminParishioner, 'you are welcome')).error).toBeNull();
    expect((await reply('adminB', superAdminChat, 'hello')).error).toBeNull();
    expect((await reply('parA2', unknownStarter, 'hello')).error).toBeNull();

    // An unknown starter that the matrix fails in both directions is legacy
    const bothWays = await seedChat(null, ['parA2', 'volA']);
    expect((await db.rpc('direct_is_legacy', { _conversation_id: bothWays })).data).toBe(true);
  });
});

import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, getSeed, serviceClient } from './support';

/**
 * Migration 063: role, church and clergy changes only happen through public.set_user_role (or transfer_super_admin).
 * Every account here is a temporary user created by this spec, so the seeded users other specs share are never touched.
 * A Church Admin in the Local Test Parish is "A", the Other Test Parish is "B".
 */

const db = serviceClient();
const TAG = 'rolechg';
const created: string[] = [];
const channels: string[] = [];
const tempChurches: string[] = [];
let previousSuperAdmins: string[] = [];

type Role = 'user' | 'volunteer' | 'priest' | 'church_admin' | 'super_admin';
let counter = 0;

async function makeUser(role: Role, churchId: string | null, isPriest = false) {
  const email = `${TAG}-${Date.now()}-${counter++}@local.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  created.push(id);
  const { error: pErr } = await db
    .from('profiles')
    .upsert({ id, email, full_name: email, role, church_id: churchId, assigned_church_id: churchId, is_priest: isPriest, is_verified: true });
  if (pErr) throw pErr;
  return { id, email };
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function profile(id: string) {
  const { data, error } = await db.from('profiles').select('role,assigned_church_id,church_id,is_priest').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function staffChannel(churchId: string, memberIds: string[]) {
  const { data, error } = await db.from('conversations').insert({ title: `${TAG} staff`, type: 'channel', church_id: churchId }).select('id').single();
  if (error) throw error;
  channels.push(data.id);
  const { error: cErr } = await db.from('conversation_participants').insert(memberIds.map((user_id) => ({ conversation_id: data.id, user_id })));
  if (cErr) throw cErr;
  return data.id as string;
}

async function isMember(conversationId: string, userId: string) {
  const { data } = await db.from('conversation_participants').select('id').eq('conversation_id', conversationId).eq('user_id', userId);
  return (data ?? []).length > 0;
}

async function cleanup() {
  if (channels.length) {
    await db.from('conversations').delete().in('id', channels);
    channels.length = 0;
  }
  if (created.length) {
    await db.from('activity_logs').delete().in('user_id', created);
    await db.from('activity_logs').delete().in('entity_id', created);
    for (const id of created) await db.auth.admin.deleteUser(id);
    created.length = 0;
  }
  if (tempChurches.length) {
    await db.from('churches').delete().in('id', tempChurches);
    tempChurches.length = 0;
  }
}

/** A church of its own, so tests about the last Church Admin are not affected by the seeded admins. */
async function tempChurch() {
  const { data, error } = await db.from('churches').insert({ name: `${TAG} church ${Date.now()}`, address: '1 Test Street', status: 'verified_active', is_active: true }).select('id').single();
  if (error) throw error;
  tempChurches.push(data.id);
  return data.id as string;
}

test.beforeAll(async () => {
  const { data } = await db.from('profiles').select('id').eq('role', 'super_admin');
  previousSuperAdmins = (data ?? []).map((r) => r.id);
  // idx_single_super_admin allows one owner; park the existing one as a Parishioner while this spec runs
  if (previousSuperAdmins.length) await db.from('profiles').update({ role: 'user' }).in('id', previousSuperAdmins);
});

test.afterEach(cleanup);

test.afterAll(async () => {
  await cleanup();
  await db.from('profiles').update({ role: 'super_admin' }).in('id', previousSuperAdmins);
});

test.describe('Database-enforced role changes (migration 063)', () => {
  test('direct REST updates cannot change role, church or clergy status, for a Church Admin or a Parishioner', async () => {
    const seed = await getSeed();
    const admin = await makeUser('church_admin', seed.churchId);
    const member = await makeUser('volunteer', seed.churchId);
    const stranger = await makeUser('user', null);
    const adminClient = await signedIn(admin.email);

    const attempts: Array<[string, string, Record<string, unknown>]> = [
      ['escalate a member to super_admin', member.id, { role: 'super_admin' }],
      ['adopt a member into another church', member.id, { assigned_church_id: seed.otherChurchId }],
      ['promote a member by role', member.id, { role: 'church_admin' }],
      ['change their own role', admin.id, { role: 'user' }],
      ['mark a member as priest', member.id, { is_priest: true }],
    ];
    for (const [label, id, patch] of attempts) {
      const { error } = await adminClient.from('profiles').update(patch).eq('id', id);
      expect(error, label).not.toBeNull();
    }
    expect(await profile(member.id)).toMatchObject({ role: 'volunteer', assigned_church_id: seed.churchId, is_priest: false });
    expect(await profile(admin.id)).toMatchObject({ role: 'church_admin' });

    // A Parishioner cannot change their own role or church either
    const strangerClient = await signedIn(stranger.email);
    await strangerClient.from('profiles').update({ role: 'church_admin', assigned_church_id: seed.churchId }).eq('id', stranger.id);
    expect(await profile(stranger.id)).toMatchObject({ role: 'user', assigned_church_id: null });

    // Non-role self-service edits keep working for a Church Admin on their own row
    const { error: nameErr } = await adminClient.from('profiles').update({ full_name: 'Renamed Admin' }).eq('id', admin.id);
    expect(nameErr).toBeNull();
  });

  test('a Church Admin cannot set super_admin, reach another church, demote themselves or touch the Super Admin through the RPC', async () => {
    const seed = await getSeed();
    const admin = await makeUser('church_admin', seed.churchId);
    const second = await makeUser('church_admin', seed.churchId);
    const otherMember = await makeUser('volunteer', seed.otherChurchId);
    const otherStranger = await makeUser('user', seed.otherChurchId);
    const owner = await makeUser('super_admin', null);
    const adminClient = await signedIn(admin.email);

    const cases: Array<[string, Record<string, unknown>]> = [
      ['set super_admin', { p_user_id: second.id, p_role: 'super_admin' }],
      ['set the retired admin role', { p_user_id: second.id, p_role: 'admin' }],
      ['change a member of another church', { p_user_id: otherMember.id, p_role: 'user' }],
      ['adopt a Parishioner who already belongs to another church', { p_user_id: otherStranger.id, p_role: 'volunteer' }],
      ['demote themselves', { p_user_id: admin.id, p_role: 'user' }],
      ['target the Super Admin', { p_user_id: owner.id, p_role: 'user' }],
    ];
    for (const [label, args] of cases) {
      const { error } = await adminClient.rpc('set_user_role', args);
      expect(error, label).not.toBeNull();
      expect(error?.code, label).toBe('42501');
    }
    expect(await profile(otherMember.id)).toMatchObject({ role: 'volunteer', assigned_church_id: seed.otherChurchId });
    expect(await profile(owner.id)).toMatchObject({ role: 'super_admin' });

    // Church parameter is ignored for a Church Admin: the target ends up in the caller's church
    const free = await makeUser('user', null);
    const { error } = await adminClient.rpc('set_user_role', { p_user_id: free.id, p_role: 'volunteer', p_church_id: seed.otherChurchId });
    expect(error).toBeNull();
    expect(await profile(free.id)).toMatchObject({ role: 'volunteer', assigned_church_id: seed.churchId });
  });

  test('a Church Admin can promote a church user and demote another Church Admin; demotion keeps the church and clears clergy status', async () => {
    const seed = await getSeed();
    const admin = await makeUser('church_admin', seed.churchId);
    const second = await makeUser('church_admin', seed.churchId, true);
    const joiner = await makeUser('user', null);
    const adminClient = await signedIn(admin.email);

    const promote = await adminClient.rpc('set_user_role', { p_user_id: joiner.id, p_role: 'church_admin' });
    expect(promote.error).toBeNull();
    expect(await profile(joiner.id)).toMatchObject({ role: 'church_admin', assigned_church_id: seed.churchId, church_id: seed.churchId });

    const demote = await adminClient.rpc('set_user_role', { p_user_id: second.id, p_role: 'user' });
    expect(demote.error).toBeNull();
    expect(await profile(second.id)).toMatchObject({ role: 'user', assigned_church_id: seed.churchId, is_priest: false });

    const { data: logs } = await db.from('activity_logs').select('metadata').eq('action', 'set_user_role').eq('entity_id', second.id);
    expect(logs).toHaveLength(1);
    expect(logs![0].metadata).toMatchObject({ before_role: 'church_admin', after_role: 'user', before_church_id: seed.churchId, after_church_id: seed.churchId });
  });

  test('a church always keeps one Church Admin: demote-then-demote, mutual demotion and a Super Admin cannot empty it', async () => {
    const seed = { churchId: await tempChurch(), otherChurchId: (await getSeed()).otherChurchId };
    const first = await makeUser('church_admin', seed.churchId);
    const second = await makeUser('church_admin', seed.churchId);
    const owner = await makeUser('super_admin', null);
    const firstClient = await signedIn(first.email);
    const secondClient = await signedIn(second.email);

    // First demotes second: allowed (first remains)
    const one = await firstClient.rpc('set_user_role', { p_user_id: second.id, p_role: 'user' });
    expect(one.error).toBeNull();

    // Second, now a Parishioner, cannot demote first back
    const back = await secondClient.rpc('set_user_role', { p_user_id: first.id, p_role: 'user' });
    expect(back.error?.code).toBe('42501');
    expect(await profile(first.id)).toMatchObject({ role: 'church_admin' });

    // The Super Admin cannot demote or move the last Church Admin either
    const ownerClient = await signedIn(owner.email);
    const demote = await ownerClient.rpc('set_user_role', { p_user_id: first.id, p_role: 'user' });
    expect(demote.error?.code).toBe('23514');
    expect(demote.error?.message).toContain('at least one Church Admin');
    const move = await ownerClient.rpc('set_user_role', { p_user_id: first.id, p_role: 'church_admin', p_church_id: seed.otherChurchId });
    expect(move.error?.code).toBe('23514');
    expect(await profile(first.id)).toMatchObject({ role: 'church_admin', assigned_church_id: seed.churchId });

    // With a second Church Admin back in place the first can be demoted
    const restore = await ownerClient.rpc('set_user_role', { p_user_id: second.id, p_role: 'church_admin' });
    expect(restore.error).toBeNull();
    const ok = await ownerClient.rpc('set_user_role', { p_user_id: first.id, p_role: 'user' });
    expect(ok.error).toBeNull();
  });

  test('a Super Admin can set any of the four roles on any church but never super_admin or admin', async () => {
    const seed = await getSeed();
    const owner = await makeUser('super_admin', null);
    const target = await makeUser('user', null);
    const ownerClient = await signedIn(owner.email);

    for (const role of ['volunteer', 'priest', 'church_admin', 'user'] as const) {
      const { error } = await ownerClient.rpc('set_user_role', { p_user_id: target.id, p_role: role, p_church_id: seed.otherChurchId });
      expect(error, role).toBeNull();
      expect((await profile(target.id)).role).toBe(role);
    }
    // Ended as 'user': church kept after demotion
    expect(await profile(target.id)).toMatchObject({ assigned_church_id: seed.otherChurchId, is_priest: false });

    const priest = await ownerClient.rpc('set_user_role', { p_user_id: target.id, p_role: 'priest', p_church_id: seed.churchId });
    expect(priest.error).toBeNull();
    expect(await profile(target.id)).toMatchObject({ role: 'priest', assigned_church_id: seed.churchId, is_priest: true });

    for (const role of ['super_admin', 'admin']) {
      const { error } = await ownerClient.rpc('set_user_role', { p_user_id: target.id, p_role: role });
      expect(error, role).not.toBeNull();
    }
    const selfTarget = await ownerClient.rpc('set_user_role', { p_user_id: owner.id, p_role: 'user' });
    expect(selfTarget.error?.code).toBe('42501');
    expect(await profile(owner.id)).toMatchObject({ role: 'super_admin' });
  });

  test('demoting or moving a staff member removes them from the church staff channel; a same-church role change keeps them', async () => {
    const seed = await getSeed();
    const owner = await makeUser('super_admin', null);
    const admin = await makeUser('church_admin', seed.churchId);
    const volunteerA = await makeUser('volunteer', seed.churchId);
    const volunteerB = await makeUser('volunteer', seed.churchId);
    const volunteerC = await makeUser('volunteer', seed.churchId);
    const channel = await staffChannel(seed.churchId, [admin.id, volunteerA.id, volunteerB.id, volunteerC.id]);
    const adminClient = await signedIn(admin.email);
    const ownerClient = await signedIn(owner.email);

    // Volunteer to Priest in the same church: stays in the channel
    expect((await adminClient.rpc('set_user_role', { p_user_id: volunteerA.id, p_role: 'priest' })).error).toBeNull();
    expect(await isMember(channel, volunteerA.id)).toBe(true);

    // Demotion to Parishioner: removed
    expect((await adminClient.rpc('set_user_role', { p_user_id: volunteerB.id, p_role: 'user' })).error).toBeNull();
    expect(await isMember(channel, volunteerB.id)).toBe(false);

    // Move to another church by the Super Admin: removed from the old church's channel
    expect((await ownerClient.rpc('set_user_role', { p_user_id: volunteerC.id, p_role: 'volunteer', p_church_id: seed.otherChurchId })).error).toBeNull();
    expect(await isMember(channel, volunteerC.id)).toBe(false);
    expect(await isMember(channel, admin.id)).toBe(true);
  });

  test('transfer_super_admin still works with the guard in place, and the new owner keeps no church', async () => {
    const seed = await getSeed();
    const owner = await makeUser('super_admin', null);
    const heir = await makeUser('church_admin', seed.churchId);
    const ownerClient = await signedIn(owner.email);

    const { data, error } = await ownerClient.rpc('transfer_super_admin', { target_user_id: heir.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true });
    expect(await profile(heir.id)).toMatchObject({ role: 'super_admin', assigned_church_id: null, church_id: null });
    expect((await profile(owner.id)).role).toBe('user');
  });
});

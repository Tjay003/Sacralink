import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { ANON_KEY, LOCAL_URL, PASSWORD, getSeed, migrationsFrom062, serviceClient } from './support';

/**
 * Migration 062 retires the Admin role at the data level: existing admins become Parishioners (keeping their church),
 * nobody can be given `admin` again (even with the service role), and transfer_super_admin demotes the previous owner
 * to a Parishioner. Seeding an `admin` row needs the guard trigger switched off, so this spec talks to the local
 * Postgres container directly for that step and for re-running the migration file.
 */

const db = serviceClient();
// 063 redefines guard_profile_role_columns; 068 re-adds its suspension-column guard, so replay it after 063.
const EMAILS = ['retired-admin@local.test', 'retired-super@local.test', 'retired-target@local.test'];

function psql(sql: string) {
  const container = execFileSync('docker', ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
  if (!container) throw new Error('Local Supabase database container is not running');
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
}

async function tempUser(email: string, role: string, churchId: string | null) {
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  // The profile row may already exist from the signup trigger; upsert as a safe role first, then set the final role.
  const { error: pErr } = await db.from('profiles').upsert({ id, email, full_name: email, role: 'user', church_id: churchId, assigned_church_id: churchId, is_verified: true });
  if (pErr) throw pErr;
  if (role !== 'user') {
    const { error: rErr } = await db.from('profiles').update({ role }).eq('id', id);
    if (rErr) throw rErr;
  }
  return id;
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function cleanup() {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const ids = (list?.users ?? []).filter((u) => u.email && EMAILS.includes(u.email)).map((u) => u.id);
  if (!ids.length) return;
  await db.from('activity_logs').delete().in('user_id', ids);
  await db.from('activity_logs').delete().in('entity_id', ids);
  for (const id of ids) await db.auth.admin.deleteUser(id);
}

/** Inserts an `admin` profile by switching the guard trigger off for this one statement. */
function forceAdminRole(id: string) {
  psql(`ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_admin_role;
UPDATE public.profiles SET role = 'admin', is_priest = true WHERE id = '${id}';
ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_admin_role;`);
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

test.describe('Admin role retired (migration 062)', () => {
  test('existing admins become Parishioners, keep their church, are logged, and can still sign in', async () => {
    const seed = await getSeed();
    const adminId = await tempUser(EMAILS[0], 'user', seed.churchId);
    forceAdminRole(adminId);
    const { data: before } = await db.from('profiles').select('role,is_priest').eq('id', adminId).single();
    expect(before).toMatchObject({ role: 'admin', is_priest: true });

    psql(migrationsFrom062());

    const { data: after } = await db.from('profiles').select('role,is_priest,church_id,assigned_church_id').eq('id', adminId).single();
    expect(after).toMatchObject({ role: 'user', is_priest: false, church_id: seed.churchId, assigned_church_id: seed.churchId });
    const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    expect(count).toBe(0);

    const { data: logs } = await db.from('activity_logs').select('church_id').eq('action', 'admin_role_retired').eq('entity_id', adminId);
    expect(logs).toHaveLength(1);
    expect(logs![0].church_id).toBe(seed.churchId);

    const client = await signedIn(EMAILS[0]);
    const { data: own } = await client.from('profiles').select('role').eq('id', adminId).single();
    expect(own?.role).toBe('user');
  });

  test('re-running the migration is a no-op', async () => {
    const seed = await getSeed();
    const adminId = await tempUser(EMAILS[0], 'user', seed.churchId);
    forceAdminRole(adminId);
    psql(migrationsFrom062());
    const { data: first } = await db.from('profiles').select('updated_at').eq('id', adminId).single();

    psql(migrationsFrom062());

    const { data: second } = await db.from('profiles').select('role,updated_at').eq('id', adminId).single();
    expect(second).toMatchObject({ role: 'user', updated_at: first!.updated_at });
    const { data: logs } = await db.from('activity_logs').select('id').eq('action', 'admin_role_retired').eq('entity_id', adminId);
    expect(logs).toHaveLength(1);
  });

  test('a profile cannot be given the admin role, with the service role or as the user', async () => {
    const seed = await getSeed();
    const userId = await tempUser(EMAILS[0], 'user', seed.churchId);

    const viaService = await db.from('profiles').update({ role: 'admin' }).eq('id', userId);
    expect(viaService.error?.code).toBe('22023');
    expect(viaService.error?.message).toContain('The Admin role no longer exists');

    const insert = await db.from('profiles').insert({ id: '00000000-0000-0000-0000-0000000000aa', email: 'x@local.test', role: 'admin' });
    expect(insert.error?.code).toBe('22023');

    const client = await signedIn(EMAILS[0]);
    const viaUser = await client.from('profiles').update({ role: 'admin' }).eq('id', userId);
    expect(viaUser.error).not.toBeNull();

    const { data } = await db.from('profiles').select('role').eq('id', userId).single();
    expect(data?.role).toBe('user');
  });

  test('transfer_super_admin demotes the previous owner to a Parishioner and keeps a single Super Admin', async () => {
    // Any leftover Super Admin from another spec would trip the single-Super-Admin index.
    await db.from('profiles').update({ role: 'user' }).eq('role', 'super_admin');
    const seed = await getSeed();
    const ownerId = await tempUser(EMAILS[1], 'super_admin', null);
    const targetId = await tempUser(EMAILS[2], 'user', seed.churchId);

    const owner = await signedIn(EMAILS[1]);
    const { data, error } = await owner.rpc('transfer_super_admin', { target_user_id: targetId });
    expect(error).toBeNull();
    expect(data).toEqual({ success: true });

    const { data: rows } = await db.from('profiles').select('id,role').in('id', [ownerId, targetId]);
    expect(rows?.find((r) => r.id === ownerId)?.role).toBe('user');
    expect(rows?.find((r) => r.id === targetId)?.role).toBe('super_admin');
    const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin');
    expect(count).toBe(1);

    // The old owner is no longer Super Admin, so a second transfer is refused.
    const again = await owner.rpc('transfer_super_admin', { target_user_id: targetId });
    expect(again.data).toMatchObject({ success: false });
  });
});

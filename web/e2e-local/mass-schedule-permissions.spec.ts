import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANON_KEY, LOCAL_URL, PASSWORD, clientAs, getSeed, resetMassSchedules, serviceClient } from './support';

/**
 * Who may change a parish's Mass schedules (migration 058): super_admin, plus the admin and church_admin of that
 * parish. Volunteers, priests and parishioners can read but never write, and nobody writes to another parish.
 */

const db = serviceClient();
const tempEmails: string[] = [];

async function tempUser(label: string, role: string, churchId: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `${label}@local.test`;
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

test.beforeEach(async () => {
  await resetMassSchedules();
});

test.afterAll(async () => {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const user of list?.users ?? []) {
    if (user.email && tempEmails.includes(user.email)) await db.auth.admin.deleteUser(user.id);
  }
  await resetMassSchedules();
});

test.describe('Mass schedule write permissions', () => {
  test('the church admin of a parish can add, edit and delete its Mass schedules', async () => {
    const seed = await getSeed();
    const admin = await clientAs('church_admin');

    const insert = await admin
      .from('mass_schedules')
      .insert({ church_id: seed.churchId, day_of_week: 'Monday', time: '07:00', language: 'English' })
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    const update = await admin.from('mass_schedules').update({ time: '08:00' }).eq('id', insert.data!.id).select('id');
    expect(update.error).toBeNull();
    expect(update.data).toHaveLength(1);

    const remove = await admin.from('mass_schedules').delete().eq('id', insert.data!.id).select('id');
    expect(remove.error).toBeNull();
    expect(remove.data).toHaveLength(1);
  });

  test('an admin of the parish can write too', async () => {
    const seed = await getSeed();
    const admin = await tempUser('admin-schedules', 'admin', seed.churchId);
    const insert = await admin.client
      .from('mass_schedules')
      .insert({ church_id: seed.churchId, day_of_week: 'Tuesday', time: '07:00', language: 'English' });
    expect(insert.error).toBeNull();
  });

  test('a volunteer, a priest and a parishioner can read but not write', async () => {
    const seed = await getSeed();
    const existing = await db
      .from('mass_schedules')
      .insert({ church_id: seed.churchId, day_of_week: 'Wednesday', time: '06:00', language: 'English' })
      .select('id')
      .single();
    expect(existing.error).toBeNull();

    const volunteer = await tempUser('volunteer-schedules', 'volunteer', seed.churchId);
    const clients: SupabaseClient[] = [volunteer.client, await clientAs('priest'), await clientAs('parishioner')];

    for (const client of clients) {
      const read = await client.from('mass_schedules').select('id').eq('id', existing.data!.id);
      expect(read.data).toHaveLength(1);

      const insert = await client
        .from('mass_schedules')
        .insert({ church_id: seed.churchId, day_of_week: 'Thursday', time: '09:00', language: 'English' });
      expect(insert.error?.code).toBe('42501');

      const update = await client.from('mass_schedules').update({ time: '10:00' }).eq('id', existing.data!.id).select('id');
      expect(update.data ?? []).toHaveLength(0);

      const remove = await client.from('mass_schedules').delete().eq('id', existing.data!.id).select('id');
      expect(remove.data ?? []).toHaveLength(0);
    }

    const stillThere = await db.from('mass_schedules').select('time').eq('id', existing.data!.id).single();
    expect(stillThere.data?.time).toMatch(/^06:00/);
  });

  test('a church admin cannot change the schedules of another parish', async () => {
    const seed = await getSeed();
    const stranger = await clientAs('other_admin');
    const insert = await stranger
      .from('mass_schedules')
      .insert({ church_id: seed.churchId, day_of_week: 'Friday', time: '07:00', language: 'English' });
    expect(insert.error?.code).toBe('42501');
  });
});

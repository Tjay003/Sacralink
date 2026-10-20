import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

export const LOCAL_URL = 'http://127.0.0.1:54321';
// Public local-demo keys printed by `npx supabase start`
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const PASSWORD = 'LocalTest#123';

export type Role = 'church_admin' | 'priest' | 'priest2' | 'parishioner' | 'other_admin';

export const USERS: Record<Role, { email: string; fullName: string }> = {
  church_admin: { email: 'admin@local.test', fullName: 'Local Church Admin' },
  priest: { email: 'priest@local.test', fullName: 'Fr. Local Priest' },
  priest2: { email: 'priest2@local.test', fullName: 'Fr. Second Priest' },
  parishioner: { email: 'parishioner@local.test', fullName: 'Local Parishioner' },
  other_admin: { email: 'other-admin@local.test', fullName: 'Other Parish Admin' },
};

/** Guards against ever running these tests against a remote project. */
export function assertLocal(url: string) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to run local e2e against non-local Supabase URL: ${url}`);
  }
}

export function serviceClient(): SupabaseClient {
  assertLocal(LOCAL_URL);
  return createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A client signed in as a seeded user, subject to RLS exactly like the browser. */
export async function clientAs(role: Role): Promise<SupabaseClient> {
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: USERS[role].email, password: PASSWORD });
  if (error) throw error;
  return client;
}

export interface Seed {
  churchId: string;
  otherChurchId: string;
  ids: Record<Role, string>;
}

let cached: Seed | null = null;

/** Looks up the ids written by global-setup. */
export async function getSeed(): Promise<Seed> {
  if (cached) return cached;
  const db = serviceClient();
  const { data: churches, error } = await db.from('churches').select('id,name').in('name', ['Local Test Parish', 'Other Test Parish']);
  if (error) throw error;
  const { data: profiles, error: pErr } = await db.from('profiles').select('id,email').in('email', Object.values(USERS).map((u) => u.email));
  if (pErr) throw pErr;
  const ids = {} as Record<Role, string>;
  for (const role of Object.keys(USERS) as Role[]) {
    const match = profiles?.find((p) => p.email === USERS[role].email);
    if (!match) throw new Error(`Seed profile missing for ${role}; did global-setup run?`);
    ids[role] = match.id;
  }
  cached = {
    churchId: churches!.find((c) => c.name === 'Local Test Parish')!.id,
    otherChurchId: churches!.find((c) => c.name === 'Other Test Parish')!.id,
    ids,
  };
  return cached;
}

export function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inserts an approved Baptism assigned to `priest` and returns its id. Clears earlier test data first. */
export async function createApprovedAppointment(opts: { daysFromToday?: number; time?: string; celebrant?: Role | null } = {}) {
  const seed = await getSeed();
  const db = serviceClient();
  const celebrant = opts.celebrant === undefined ? 'priest' : opts.celebrant;
  const { data, error } = await db
    .from('appointments')
    .insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type: 'Baptism',
      appointment_date: isoDate(opts.daysFromToday ?? 14),
      appointment_time: opts.time ?? '10:00:00',
      status: 'approved',
      priest_id: celebrant ? seed.ids[celebrant] : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Wipes appointments, history and notifications so each test starts clean. */
export async function resetAppointmentData() {
  const db = serviceClient();
  await db.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('appointment_changes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/** Signs in through the real login form. */
export async function loginAs(page: Page, role: Role) {
  await page.goto('/login');
  await page.locator('#email').fill(USERS[role].email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

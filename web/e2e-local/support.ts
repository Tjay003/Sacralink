import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

export interface AppointmentOptions {
  daysFromToday?: number;
  time?: string;
  /** Role of the assigned celebrant; `null` leaves the appointment unassigned. Defaults to `priest`. */
  celebrant?: Role | null;
  serviceType?: string;
  /** Role of the priest the parishioner asked for at booking; omitted leaves the request empty. */
  requestedPriest?: Role;
}

/** Inserts a Baptism for the seeded parishioner in the given status and returns its id. */
async function insertAppointment(status: 'approved' | 'pending', opts: AppointmentOptions) {
  const seed = await getSeed();
  const db = serviceClient();
  const celebrant = opts.celebrant === undefined ? 'priest' : opts.celebrant;
  const { data, error } = await db
    .from('appointments')
    .insert({
      user_id: seed.ids.parishioner,
      church_id: seed.churchId,
      service_type: opts.serviceType ?? 'Baptism',
      appointment_date: isoDate(opts.daysFromToday ?? 14),
      appointment_time: opts.time ?? '10:00:00',
      status,
      priest_id: celebrant ? seed.ids[celebrant] : null,
      requested_priest_id: opts.requestedPriest ? seed.ids[opts.requestedPriest] : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Inserts an approved Baptism assigned to `priest` and returns its id. */
export async function createApprovedAppointment(opts: AppointmentOptions = {}) {
  return insertAppointment('approved', opts);
}

/** Inserts a pending Baptism request (no celebrant unless asked for) and returns its id. */
export async function createPendingAppointment(opts: AppointmentOptions = {}) {
  return insertAppointment('pending', { celebrant: null, ...opts });
}

/** Wipes appointments, history and notifications so each test starts clean. */
export async function resetAppointmentData() {
  const db = serviceClient();
  await db.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('appointment_changes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

/** Removes every day off, leave and blackout row so celebrants start fully available. */
export async function resetPriestAvailability() {
  const { error } = await serviceClient().from('priest_availability').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

/** A recurring weekly day off (0 = Sunday ... 6 = Saturday) for a seeded priest. */
export async function addWeeklyDayOff(role: Role, dayOfWeek: number, reason: string) {
  const seed = await getSeed();
  const { error } = await serviceClient()
    .from('priest_availability')
    .insert({ priest_id: seed.ids[role], church_id: seed.churchId, day_of_week: dayOfWeek, reason });
  if (error) throw error;
}

/** A leave period (inclusive dates, YYYY-MM-DD) for a seeded priest. */
export async function addLeave(role: Role, start: string, end: string, reason: string) {
  const seed = await getSeed();
  const { error } = await serviceClient()
    .from('priest_availability')
    .insert({ priest_id: seed.ids[role], church_id: seed.churchId, blackout_start: start, blackout_end: end, reason });
  if (error) throw error;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Removes every recurring Mass of the seeded parishes so celebrants start with no Mass load. */
export async function resetMassSchedules() {
  const seed = await getSeed();
  const { error } = await serviceClient().from('mass_schedules').delete().in('church_id', [seed.churchId, seed.otherChurchId]);
  if (error) throw error;
}

/** A recurring weekly Mass at the seeded parish; `presiding` leaves the celebrant unset when omitted. */
export async function addMass(dayOfWeekIndex: number, time: string, presiding?: Role) {
  const seed = await getSeed();
  const { error } = await serviceClient()
    .from('mass_schedules')
    .insert({
      church_id: seed.churchId,
      day_of_week: WEEKDAY_NAMES[dayOfWeekIndex],
      time,
      presiding_priest_id: presiding ? seed.ids[presiding] : null,
    });
  if (error) throw error;
}

/** Weekday index (0 = Sunday) of a YYYY-MM-DD date, read as a local calendar date like the app does. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** First offset at or after `fromDays` whose date is not a Sunday (Canon 905 allows three on Sundays, two otherwise). */
export function firstWeekdayOffset(fromDays: number): number {
  let offset = fromDays;
  while (dayOfWeek(isoDate(offset)) === 0) offset += 1;
  return offset;
}

/** Opens the Edit modal of the office appointments table row that contains `rowText`. */
export async function openEdit(page: Page, rowText = 'Baptism') {
  await page.goto('/appointments');
  const row = page.locator('table').locator('tr', { hasText: rowText });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  return { row, dialog: page.getByRole('dialog') };
}

/**
 * Saves a PNG under e2e-screenshots (outside test-results, which Playwright wipes on every run) for the visual review. Full page by default; pass
 * `fullPage: false` to capture only the viewport (needed when a fixed tooltip is anchored to a chip).
 */
export async function capture(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: `e2e-screenshots/${name}.png`, fullPage });
}

/** A fresh browser context signed in as `role`, so one test can look at the same data as several roles. */
export async function pageAs(browser: Browser, role: Role, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...options });
  const page = await context.newPage();
  await loginAs(page, role);
  return page;
}

/** The six starter services every parish begins with, in booking order. */
export const STARTER_SERVICES = ['Baptism', 'Wedding', 'Funeral', 'Confirmation', 'Blessing', 'Other'];

/** The live service type row of a seeded parish by case-insensitive name (deleted rows excluded). */
export async function serviceTypeByName(churchId: string, name: string) {
  const { data, error } = await serviceClient()
    .from('church_service_types')
    .select('*')
    .eq('church_id', churchId)
    .is('deleted_at', null)
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Puts both seeded parishes back to the six starter services with no checklists, so service type specs
 * never leak renamed, hidden or deleted services into the specs that book a plain Baptism.
 */
export async function resetServiceTypes() {
  await resetAppointmentData();
  const seed = await getSeed();
  const db = serviceClient();
  const churchIds = [seed.churchId, seed.otherChurchId];
  const { error: reqErr } = await db.from('sacrament_requirements').delete().in('church_id', churchIds);
  if (reqErr) throw reqErr;
  const { error: typeErr } = await db.from('church_service_types').delete().in('church_id', churchIds);
  if (typeErr) throw typeErr;
  for (const churchId of churchIds) {
    const { error } = await db.rpc('seed_church_service_types', { p_church_id: churchId });
    if (error) throw error;
  }
}

/** Signs in through the real login form. */
export async function loginAs(page: Page, role: Role) {
  await page.goto('/login');
  await page.locator('#email').fill(USERS[role].email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

/** A throwaway account created by a spec: the auth user, its profile and a client signed in as it. */
export interface TempAccount {
  id: string;
  email: string;
  client: SupabaseClient;
}

/**
 * Creates (or recreates) a throwaway user with the given profile role and church and signs a client in as it.
 * `tag` namespaces the email so a spec can find and remove its own accounts; pair with `deleteTempAccounts`.
 */
export async function tempUser(tag: string, label: string, role: string, churchId: string | null): Promise<TempAccount> {
  const db = serviceClient();
  const email = `${tag}-${label}@local.test`;
  // Looked up through profiles: the auth user list is paged and the local database collects many throwaway users
  const { data: stale } = await db.from('profiles').select('id').eq('email', email);
  for (const row of stale ?? []) {
    await db.from('activity_logs').delete().eq('user_id', row.id as string);
    await db.auth.admin.deleteUser(row.id as string);
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  const { error: profileErr } = await db.from('profiles').upsert({
    id,
    email,
    full_name: `Temp ${label}`,
    role,
    is_priest: role === 'priest',
    church_id: churchId,
    assigned_church_id: churchId,
    is_verified: true,
  });
  if (profileErr) throw profileErr;
  const client = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
  return { id, email, client };
}

/** Removes the auth users (and through the cascade their profiles) created by `tempUser`. */
export async function deleteTempAccounts(accounts: Array<TempAccount | null | undefined>) {
  const db = serviceClient();
  for (const account of accounts) {
    if (!account) continue;
    // Audit rows written by the account (a suspension, a deletion) would block removing it
    await db.from('activity_logs').delete().eq('user_id', account.id);
    await db.auth.admin.deleteUser(account.id);
  }
}

/**
 * Makes a throwaway account the only Super Admin (the seed has none, and a hand-tested local database may have one).
 * `restore` deletes the account and puts any previous Super Admin back.
 */
export async function soleSuperAdmin(tag: string): Promise<{ account: TempAccount; restore: () => Promise<void> }> {
  const db = serviceClient();
  const { data: previous } = await db.from('profiles').select('id').eq('role', 'super_admin');
  const previousIds = (previous ?? []).map((p) => p.id as string);
  if (previousIds.length) await db.from('profiles').update({ role: 'user' }).in('id', previousIds);
  const account = await tempUser(tag, 'super-admin', 'super_admin', null);
  return {
    account,
    restore: async () => {
      await deleteTempAccounts([account]);
      if (previousIds.length) await db.from('profiles').update({ role: 'super_admin' }).in('id', previousIds);
    },
  };
}

/** Signs a browser page in as a throwaway account through the real login form. */
export async function loginAsAccount(page: Page, account: TempAccount) {
  await page.goto('/login');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');
}

/**
 * Every migration from 062 on, in production order. Specs that replay migration 062 replay the whole tail with it,
 * because later migrations redefine functions that 062 and 063 also define (replaying one alone would undo them).
 */
export function migrationsFrom062(): string {
  const dir = resolve(process.cwd(), '../supabase/migrations');
  return readdirSync(dir)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) >= 62)
    .sort()
    .map((name) => readFileSync(resolve(dir, name), 'utf8'))
    .join(';\n');
}


/** Resets chat audit log entries in church_chat_logs. */
export async function resetChurchChatLogs(userId?: string) {
  const db = serviceClient();
  if (userId) {
    await db.from('church_chat_logs').delete().eq('user_id', userId);
  } else {
    await db.from('church_chat_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

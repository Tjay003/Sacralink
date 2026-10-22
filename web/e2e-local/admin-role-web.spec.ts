import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PASSWORD, getSeed, serviceClient } from './support';

/**
 * An account that used to be an Admin (converted to a Parishioner by migration 062) must land on the parishioner
 * dashboard with no management links, since the web app no longer has an Admin role branch.
 */

const db = serviceClient();
const MIGRATION = resolve(process.cwd(), '../supabase/migrations/062_retire_admin_role.sql');
// 062 recreates transfer_super_admin without the 063 permission flag, so 063 is replayed right after it (production order).
const MIGRATION_063 = resolve(process.cwd(), '../supabase/migrations/063_database_enforced_role_changes.sql');
const EMAIL = 'converted-admin-web@local.test';

function psql(sql: string) {
  const container = execFileSync('docker', ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
  if (!container) throw new Error('Local Supabase database container is not running');
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
}

async function cleanup() {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const ids = (list?.users ?? []).filter((u) => u.email === EMAIL).map((u) => u.id);
  for (const id of ids) {
    await db.from('activity_logs').delete().eq('user_id', id);
    await db.from('activity_logs').delete().eq('entity_id', id);
    await db.auth.admin.deleteUser(id);
  }
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

test('a converted admin account lands on the parishioner dashboard with no management links', async ({ page }) => {
  const seed = await getSeed();
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  await db.from('profiles').upsert({ id, email: EMAIL, full_name: 'Converted Admin', role: 'user', church_id: seed.churchId, assigned_church_id: seed.churchId, is_verified: true });
  psql(`ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_admin_role;
UPDATE public.profiles SET role = 'admin' WHERE id = '${id}';
ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_admin_role;`);
  psql(readFileSync(MIGRATION, 'utf8') + readFileSync(MIGRATION_063, 'utf8'));

  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard**');

  await expect(page.getByText('Welcome Back')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Church Applications' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'System Announcements' })).toHaveCount(0);
});

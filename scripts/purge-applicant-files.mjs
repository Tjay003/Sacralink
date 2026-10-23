import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Removes parish-applicant ID images and selfies whose retention date has passed (migration 078).
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-applicant-files.mjs
// Run it daily by hand or from a scheduler. It needs the service-role key, so never commit one.

let createClient;
try {
  const mod = await import('@supabase/supabase-js');
  createClient = mod.createClient;
} catch {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const modulePath = resolve(__dirname, '../web/node_modules/@supabase/supabase-js/dist/index.mjs');
  const mod = await import(`file://${modulePath.replace(/\/g, '/')}`);
  createClient = mod.createClient;
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const BUCKET = 'applicant-verification';
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: due, error: dueErr } = await db.rpc('applicant_files_due_for_purge');
if (dueErr) {
  console.error('Could not list files due for removal:', dueErr.message);
  process.exit(1);
}
if (!due.length) {
  console.log('No applicant files are due for removal.');
  process.exit(0);
}

// Files are deleted through the Storage API first; an application is only marked purged once all its files are gone.
const { error: removeErr } = await db.storage.from(BUCKET).remove(due.map((row) => row.file_path));
if (removeErr) {
  console.error('Storage removal failed, nothing was marked as purged:', removeErr.message);
  process.exit(1);
}

const applicationIds = [...new Set(due.map((row) => row.application_id))];
const { data: marked, error: markErr } = await db.rpc('mark_applicant_files_purged', { p_application_ids: applicationIds });
if (markErr) {
  console.error('Files were removed but marking them failed:', markErr.message);
  process.exit(1);
}
console.log(`Removed ${due.length} file(s) for ${marked} application(s).`);

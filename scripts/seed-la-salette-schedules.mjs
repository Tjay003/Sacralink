import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Support running from repo root or scripts dir
let createClient;
try {
  const mod = await import('@supabase/supabase-js');
  createClient = mod.createClient;
} catch {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const modulePath = resolve(__dirname, '../web/node_modules/@supabase/supabase-js/dist/index.mjs');
  const mod = await import(`file://${modulePath.replace(/\\/g, '/')}`);
  createClient = mod.createClient;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oaczurouvaevebpimply.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3p1cm91dmFldmVicGltcGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODQyNjUsImV4cCI6MjA4MzI2MDI2NX0.bA98oV-XWr4znveh5nWlfKeZpcFNEeXy6qhssSi6kFU';
const CHURCH_ID = '9d032df6-ee6d-436e-9965-a0c05f09cd92';

const schedules = [
  { day_of_week: 'Sunday', time: '06:30:00', language: 'Filipino' },
  { day_of_week: 'Sunday', time: '08:30:00', language: 'Filipino' },
  { day_of_week: 'Sunday', time: '10:00:00', language: 'English / Tagalog' },
  { day_of_week: 'Sunday', time: '17:00:00', language: 'Filipino' },
  { day_of_week: 'Sunday', time: '18:30:00', language: 'Filipino' },
  { day_of_week: 'Tuesday', time: '18:00:00', language: 'Filipino' },
  { day_of_week: 'Wednesday', time: '18:00:00', language: 'Filipino' },
  { day_of_week: 'Thursday', time: '18:00:00', language: 'Filipino' },
  { day_of_week: 'Friday', time: '18:00:00', language: 'Filipino' },
  { day_of_week: 'Saturday', time: '18:00:00', language: 'Filipino' }
];

async function seed() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('Authenticating as user2@gmail.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'user2@gmail.com',
    password: 'lolgamers123'
  });

  if (authError) {
    console.error('Authentication failed:', authError);
    process.exit(1);
  }

  console.log(`Authenticated successfully as: ${authData.user.email} (ID: ${authData.user.id})`);

  // Check if rows exist in mass_schedules for church
  const { data: existing, error: checkError } = await supabase
    .from('mass_schedules')
    .select('*')
    .eq('church_id', CHURCH_ID);

  if (checkError) {
    console.error('Error checking mass schedules:', checkError);
    process.exit(1);
  }

  console.log(`Found ${existing?.length || 0} existing schedule(s) for church ${CHURCH_ID}`);

  if (existing && existing.length >= schedules.length) {
    console.log('✅ Mass schedules already seeded for this church. No additional inserts needed.');
    console.table(existing.map(r => ({
      id: r.id,
      day_of_week: r.day_of_week,
      time: r.time,
      language: r.language
    })));
    return;
  }

  // Insert the 10 official schedules
  const toInsert = schedules.map(s => ({
    church_id: CHURCH_ID,
    ...s
  }));

  console.log(`Inserting ${toInsert.length} schedules...`);
  const { data: inserted, error: insertError } = await supabase
    .from('mass_schedules')
    .insert(toInsert)
    .select();

  if (insertError) {
    console.error('Error inserting schedules:', insertError);
    process.exit(1);
  }

  console.log(`Successfully inserted ${inserted.length} rows into mass_schedules:`);
  console.table(inserted.map(r => ({
    id: r.id,
    day_of_week: r.day_of_week,
    time: r.time,
    language: r.language
  })));
}

seed().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

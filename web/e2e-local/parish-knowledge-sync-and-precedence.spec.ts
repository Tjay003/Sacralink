import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSeed,
  loginAs,
  clientAs,
  serviceClient,
  resetMassSchedules,
  resetChurchChatLogs,
  LOCAL_URL,
} from './support';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let fakeGeminiProcess: ChildProcess | null = null;
let edgeFunctionsProcess: ChildProcess | null = null;

async function ensureFakeGeminiRunning() {
  try {
    const res = await fetch('http://127.0.0.1:54399/health');
    if (res.ok) return;
  } catch {
    // Not running, spawn it
  }

  const scriptPath = resolve(__dirname, '../../scripts/fake-gemini.mjs');
  fakeGeminiProcess = spawn('node', [scriptPath], {
    stdio: 'ignore',
    detached: false,
  });

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:54399/health');
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function ensureFunctionsServing() {
  try {
    const res = await fetch(`${LOCAL_URL}/functions/v1/parish-assistant`, { method: 'OPTIONS' });
    if (res.ok) return;
  } catch {
    // Not running, spawn it
  }

  edgeFunctionsProcess = spawn('npx', ['supabase', 'functions', 'serve'], {
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${LOCAL_URL}/functions/v1/parish-assistant`, { method: 'OPTIONS' });
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

test.describe('Knowledge Sync & Precedence (Hybrid SSOT)', () => {
  test.beforeAll(async () => {
    await ensureFakeGeminiRunning();
    await ensureFunctionsServing();
  });

  test.beforeEach(async () => {
    await resetChurchChatLogs();
  });

  test.afterAll(async () => {
    if (fakeGeminiProcess) {
      fakeGeminiProcess.kill();
    }
    if (edgeFunctionsProcess) {
      edgeFunctionsProcess.kill();
    }
    await resetMassSchedules();

    const db = serviceClient();
    const seed = await getSeed();
    await db.from('church_knowledge_chunks').delete().eq('church_id', seed.churchId);
    await db.from('church_knowledge_sections').delete().eq('church_id', seed.churchId);
    await db.from('sacrament_requirements').delete().eq('church_id', seed.churchId);
    await db.from('church_announcements').delete().eq('church_id', seed.churchId);
  });

  test('sync-church-knowledge purges mass_schedule chunks and embeds metadata, requirements, and announcements without embedding mass_schedules', async () => {
    const seed = await getSeed();
    const db = serviceClient();
    const dummyEmbedding = '[' + new Array(768).fill(0.01).join(',') + ']';

    // 1. Manually insert a stale mass_schedule chunk into church_knowledge_chunks
    await db.from('church_knowledge_chunks').insert({
      church_id: seed.churchId,
      content: 'Sunday Mass Schedule: 06:00 AM Stale',
      source_type: 'mass_schedule',
      embedding: dummyEmbedding,
    });

    // 2. Insert recurring mass schedules in mass_schedules table
    await db.from('mass_schedules').insert({
      church_id: seed.churchId,
      day_of_week: 'Sunday',
      time: '09:00:00',
      language: 'Tagalog',
    });

    // 3. Insert knowledge items (announcements, requirements, sections)
    await db.from('sacrament_requirements').insert({
      church_id: seed.churchId,
      service_type: 'Baptism',
      requirement_name: 'PSA Birth Certificate',
      description: 'Original copy required',
      is_required: true,
      display_order: 1,
    });

    await db.from('church_announcements').insert({
      church_id: seed.churchId,
      title: 'Parish Fiesta Novena',
      content: 'Novena masses begin this Friday at 6 PM.',
    });

    await db.from('church_knowledge_sections').insert({
      church_id: seed.churchId,
      title: 'Parish History',
      content: 'Our parish was established in 1954 by missionaries.',
      display_order: 1,
    });

    // 4. Authenticate as church_admin and call sync-church-knowledge
    const client = await clientAs('church_admin');
    const {
      data: { session },
    } = await client.auth.getSession();
    const token = session?.access_token;
    expect(token).toBeTruthy();

    const syncRes = await fetch(`${LOCAL_URL}/functions/v1/sync-church-knowledge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ churchId: seed.churchId }),
    });

    expect(syncRes.status).toBe(200);
    const syncData = await syncRes.json();
    expect(syncData.success).toBe(true);
    expect(syncData.chunksProcessed).toBeGreaterThan(0);

    // 5. Query church_knowledge_chunks and verify mass_schedule is completely purged
    const { data: chunks, error } = await db
      .from('church_knowledge_chunks')
      .select('source_type, content')
      .eq('church_id', seed.churchId);

    expect(error).toBeNull();
    expect(chunks).not.toBeNull();

    const massScheduleChunks = chunks!.filter((c) => c.source_type === 'mass_schedule');
    expect(massScheduleChunks).toHaveLength(0);

    const sourceTypes = new Set(chunks!.map((c) => c.source_type));
    expect(sourceTypes.has('church_info')).toBe(true);
    expect(sourceTypes.has('requirement')).toBe(true);
    expect(sourceTypes.has('announcement')).toBe(true);
    expect(sourceTypes.has('knowledge_section')).toBe(true);
  });

  test('sync-church-knowledge purges lingering mass_schedule chunks even when there are no new chunks to process', async () => {
    const seed = await getSeed();
    const db = serviceClient();
    const dummyEmbedding = '[' + new Array(768).fill(0.01).join(',') + ']';

    // Insert an isolated mass_schedule chunk for otherChurchId
    await db.from('church_knowledge_chunks').insert({
      church_id: seed.otherChurchId,
      content: 'Lingering Mass Schedule: Saturday 5:00 PM',
      source_type: 'mass_schedule',
      embedding: dummyEmbedding,
    });

    // Verify it was inserted
    const { count: beforeCount } = await db
      .from('church_knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', seed.otherChurchId)
      .eq('source_type', 'mass_schedule');
    expect(beforeCount).toBeGreaterThan(0);

    // Authenticate as other_admin and invoke sync
    const client = await clientAs('other_admin');
    const {
      data: { session },
    } = await client.auth.getSession();
    const token = session?.access_token;

    const syncRes = await fetch(`${LOCAL_URL}/functions/v1/sync-church-knowledge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ churchId: seed.otherChurchId }),
    });

    expect(syncRes.status).toBe(200);

    // Verify mass_schedule chunks are 0 afterwards
    const { data: lingeringChunks } = await db
      .from('church_knowledge_chunks')
      .select('id')
      .eq('church_id', seed.otherChurchId)
      .eq('source_type', 'mass_schedule');

    expect(lingeringChunks || []).toHaveLength(0);
  });

  test('Precedence: Parish Assistant strictly answers Mass times from live DB tool and ignores conflicting knowledge notes', async ({
    page,
  }) => {
    const seed = await getSeed();
    const db = serviceClient();

    await resetMassSchedules();
    await db.from('church_knowledge_sections').delete().eq('church_id', seed.churchId);

    // 1. Insert live schedule in mass_schedules (SSOT)
    await db.from('mass_schedules').insert({
      church_id: seed.churchId,
      day_of_week: 'Sunday',
      time: '09:00:00',
      language: 'Tagalog',
    });

    // 2. Insert conflicting outdated schedule into church_knowledge_sections
    await db.from('church_knowledge_sections').insert({
      church_id: seed.churchId,
      title: 'Liturgical Schedule Notes',
      content: 'NOTICE: Sunday Mass is celebrated at 05:00:00 AM only. No other masses are held.',
      display_order: 1,
    });

    // 3. Parishioner asks for Mass times in assistant
    await loginAs(page, 'parishioner');
    await page.goto(`/churches/${seed.churchId}`);

    await page.locator('[data-testid="parish-assistant-button"]').click();
    const panel = page.locator('[data-testid="parish-assistant-panel"]');
    await expect(panel).toBeVisible();

    await page.locator('textarea').fill('What are the Mass schedules?');
    await page.locator('button[aria-label="Send message"]').click();

    // 4. Assert response uses the live database time (09:00:00) and NOT the conflicting knowledge note (05:00:00)
    const reply = page.locator('[data-testid="assistant-reply"]').first();
    await expect(reply).toBeVisible({ timeout: 15000 });
    await expect(reply).toContainText('09:00:00');
    await expect(reply).not.toContainText('05:00:00');
  });
});

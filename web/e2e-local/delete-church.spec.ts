import { test, expect } from '@playwright/test';
import { deleteTempAccounts, isoDate, serviceClient, soleSuperAdmin, tempUser, type TempAccount } from './support';

/**
 * Migration 079: church_deletion_impact and delete_church.
 * Every church, account and row here is created by this spec, so the seeded parishes other specs share are never touched.
 */

const db = serviceClient();
const TAG = 'delchurch';

let superAdmin: TempAccount;
let restoreSuperAdmin: () => Promise<void>;
let accounts: TempAccount[] = [];
const churchIds: string[] = [];
const conversationIds: string[] = [];

async function newChurch(label: string) {
  const { data, error } = await db
    .from('churches')
    .insert({ name: `${TAG} ${label} ${Date.now()}`, address: '1 Test Street', status: 'active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  churchIds.push(data.id);
  return data.id as string;
}

async function profileOf(id: string) {
  const { data, error } = await db.from('profiles').select('role, assigned_church_id, church_id, is_priest').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function count(table: string, column: string, value: string) {
  const { count: total, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  if (error) throw error;
  return total ?? 0;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
});

test.afterAll(async () => {
  if (conversationIds.length) await db.from('conversations').delete().in('id', conversationIds);
  await db.from('activity_logs').delete().eq('action', 'delete_church').eq('user_id', superAdmin.id);
  await deleteTempAccounts(accounts);
  if (churchIds.length) {
    await db.from('activity_logs').delete().in('church_id', churchIds);
    await db.from('churches').delete().in('id', churchIds);
  }
  if (restoreSuperAdmin) await restoreSuperAdmin();
});

test('only the Super Admin can see the impact or delete a church', async () => {
  const churchId = await newChurch('guarded');
  const churchAdmin = await tempUser(TAG, 'guard-admin', 'church_admin', churchId);
  const parishioner = await tempUser(TAG, 'guard-user', 'user', null);
  accounts.push(churchAdmin, parishioner);

  for (const who of [churchAdmin, parishioner]) {
    expect((await who.client.rpc('church_deletion_impact', { p_church_id: churchId })).error).not.toBeNull();
    expect((await who.client.rpc('delete_church', { p_church_id: churchId })).error).not.toBeNull();
  }
  const { data } = await db.from('churches').select('id').eq('id', churchId);
  expect(data).toHaveLength(1);

  const missing = await superAdmin.client.rpc('delete_church', { p_church_id: '00000000-0000-0000-0000-000000000000' });
  expect(missing.error?.message).toContain('not found');
});

test('the impact counts what a deletion removes and who is affected', async () => {
  const churchId = await newChurch('impact');
  const admin = await tempUser(TAG, 'impact-admin', 'church_admin', churchId);
  const priest = await tempUser(TAG, 'impact-priest', 'priest', churchId);
  const volunteer = await tempUser(TAG, 'impact-volunteer', 'volunteer', churchId);
  accounts.push(admin, priest, volunteer);
  await db.from('donations').insert({ user_id: volunteer.id, church_id: churchId, amount: 150 });
  await db.from('donations').insert({ user_id: volunteer.id, church_id: churchId, amount: 50 });

  const { data, error } = await superAdmin.client.rpc('church_deletion_impact', { p_church_id: churchId });
  expect(error).toBeNull();
  expect(data).toMatchObject({ church_admins: 1, priests: 1, volunteers: 1, appointments: 0, donations: 2, donation_total: 200 });
});

test('deleting a church makes its people parishioners and removes the church in one step', async () => {
  const churchId = await newChurch('doomed');
  const otherChurchId = await newChurch('survivor');
  const admin = await tempUser(TAG, 'doomed-admin', 'church_admin', churchId);
  const priest = await tempUser(TAG, 'doomed-priest', 'priest', churchId);
  const volunteer = await tempUser(TAG, 'doomed-volunteer', 'volunteer', churchId);
  const member = await tempUser(TAG, 'doomed-member', 'user', null);
  const otherAdmin = await tempUser(TAG, 'survivor-admin', 'church_admin', otherChurchId);
  accounts.push(admin, priest, volunteer, member, otherAdmin);

  // A parishioner whose home parish is the church
  await db.from('profiles').update({ church_id: churchId }).eq('id', member.id);

  // Rows that cascade away with the church
  const { error: apptErr } = await db.from('appointments').insert({
    user_id: member.id, church_id: churchId, service_type: 'Baptism', appointment_date: isoDate(14), appointment_time: '10:00:00', status: 'pending',
  });
  expect(apptErr).toBeNull();
  const { error: donationErr } = await db.from('donations').insert({ user_id: member.id, church_id: churchId, amount: 100 });
  expect(donationErr).toBeNull();
  const { error: massErr } = await db.from('mass_schedules').insert({ church_id: churchId, day_of_week: 'Sunday', time: '08:00:00' });
  expect(massErr).toBeNull();
  const { error: announcementErr } = await db.from('church_announcements').insert({ church_id: churchId, title: 'Hello', content: 'World', created_by: admin.id });
  expect(announcementErr).toBeNull();

  // The staff channel goes; a parishioner's conversation keeps its history without the church link
  const { data: channel } = await db.from('conversations').insert({ title: `${TAG} staff`, type: 'channel', church_id: churchId }).select('id').single();
  const { data: group } = await db.from('conversations').insert({ title: `${TAG} inquiry`, type: 'group', church_id: churchId }).select('id').single();
  conversationIds.push(channel!.id, group!.id);
  await db.from('conversation_participants').insert([
    { conversation_id: channel!.id, user_id: admin.id },
    { conversation_id: group!.id, user_id: member.id },
  ]);

  // An audit row for the church would block a plain delete
  await db.from('activity_logs').insert({ user_id: admin.id, church_id: churchId, action: 'test_audit_row', entity_type: 'churches', entity_id: churchId, metadata: {} });

  const { data: impact, error } = await superAdmin.client.rpc('delete_church', { p_church_id: churchId });
  expect(error).toBeNull();
  expect(impact).toMatchObject({ church_admins: 1, priests: 1, volunteers: 1, appointments: 1, donations: 1, mass_schedules: 1, announcements: 1, conversations_kept: 1 });

  // Migration 088: The church is archived (not deleted) and its historical records survive!
  const { data: churchRow } = await db.from('churches').select('status, is_active, archived_at, archived_admin_id').eq('id', churchId).single();
  expect(churchRow).toMatchObject({ status: 'archived', is_active: false, archived_admin_id: admin.id });
  expect(churchRow?.archived_at).not.toBeNull();
  expect(await count('appointments', 'church_id', churchId)).toBe(1);
  expect(await count('donations', 'church_id', churchId)).toBe(1);
  expect(await count('mass_schedules', 'church_id', churchId)).toBe(1);
  expect(await count('church_announcements', 'church_id', churchId)).toBe(1);

  // Everyone became a parishioner with no church; the last Church Admin guard did not block it
  for (const person of [admin, priest, volunteer]) {
    expect(await profileOf(person.id)).toMatchObject({ role: 'user', assigned_church_id: null, church_id: null, is_priest: false });
  }
  expect(await profileOf(member.id)).toMatchObject({ role: 'user', church_id: null });

  // Another church and its admin are untouched
  expect(await profileOf(otherAdmin.id)).toMatchObject({ role: 'church_admin', assigned_church_id: otherChurchId });
  expect((await db.from('churches').select('id').eq('id', otherChurchId)).data).toHaveLength(1);

  // The audit trail records the archive action
  const { data: archiveLog } = await db.from('activity_logs').select('user_id, metadata').eq('action', 'archive_church').eq('entity_id', churchId);
  expect(archiveLog).toHaveLength(1);
  expect(archiveLog![0].user_id).toBe(superAdmin.id);

  // Verify restore: former admin is free (role=user, no church), so auto-restore is available
  const { data: restoreStatus } = await superAdmin.client.rpc('church_restore_status', { p_church_id: churchId });
  expect(restoreStatus).toMatchObject({ can_auto_restore: true });

  // Restore the church
  const { data: restoreResult, error: restoreError } = await superAdmin.client.rpc('restore_church', { p_church_id: churchId });
  expect(restoreError).toBeNull();
  expect(restoreResult).toMatchObject({ success: true });

  // Former admin is auto-restored as church_admin
  expect(await profileOf(admin.id)).toMatchObject({ role: 'church_admin', assigned_church_id: churchId });
  const { data: restoredChurch } = await db.from('churches').select('status, is_active, archived_at, archived_admin_id').eq('id', churchId).single();
  expect(restoredChurch).toMatchObject({ status: 'active', is_active: true, archived_at: null, archived_admin_id: null });
});

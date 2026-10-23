import { test, expect } from '@playwright/test';
import {
  clientAs,
  deleteTempAccounts,
  getSeed,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Request-user-deletion ticket (migration 073). Database rules only:
 *  - a Church Admin files it for a person of their own church; the title, subject and lane are set by create_ticket
 *  - other churches, themselves, the Super Admin, short reasons, duplicates and other roles are refused
 *  - 5 open requests per Church Admin, and they do not use up the 3 general platform tickets
 *  - the Super Admin sees it, another Church Admin does not, and it survives the subject being deleted
 */

const db = serviceClient();
const TAG = 'del-req';
const REASON = 'This person left the parish and asked for their data to be removed.';

let seed: Seed;
let churchAdmin: TempAccount;
let priest: TempAccount;
let volunteer: TempAccount;
let parishioner: TempAccount;
let otherChurchUser: TempAccount;
const subjects: TempAccount[] = [];
const accounts: TempAccount[] = [];
let superAdmin: TempAccount;
let restoreSuper: () => Promise<void>;

async function purge() {
  const { error } = await db.from('conversations').delete().eq('category', 'user_deletion_request').like('title', 'Deletion request: Temp %');
  if (error) throw error;
  await db.from('conversations').delete().like('title', `%${TAG}-general%`);
}

async function request(client: TempAccount['client'], subjectId: string | null, reason = REASON, churchId = seed.churchId) {
  return client.rpc('create_ticket', {
    p_lane: 'platform',
    p_church_id: churchId,
    p_category: 'user_deletion_request',
    p_subject: 'Request user deletion',
    p_message: reason,
    p_subject_user_id: subjectId,
  });
}

test.beforeAll(async () => {
  seed = await getSeed();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuper = sole.restore;
  churchAdmin = await tempUser(TAG, 'ca', 'church_admin', seed.churchId);
  priest = await tempUser(TAG, 'priest', 'priest', seed.churchId);
  volunteer = await tempUser(TAG, 'vol', 'volunteer', seed.churchId);
  parishioner = await tempUser(TAG, 'par', 'user', seed.churchId);
  otherChurchUser = await tempUser(TAG, 'other', 'user', seed.otherChurchId);
  accounts.push(churchAdmin, priest, volunteer, parishioner, otherChurchUser);
  await purge();
});

test.afterAll(async () => {
  await purge();
  await deleteTempAccounts([...accounts, ...subjects]);
  await restoreSuper();
});

async function newSubject(label: string) {
  const subject = await tempUser(TAG, label, 'user', seed.churchId);
  subjects.push(subject);
  return subject;
}

test.describe('Request user deletion', () => {
  test('a Church Admin files it for a person of their church, and create_ticket names the subject', async () => {
    const subject = await newSubject('subject-one');
    const { data, error } = await request(churchAdmin.client, subject.id);
    expect(error).toBeNull();
    const ticket = await db
      .from('conversations')
      .select('title, ticket_lane, category, subject_user_id, status')
      .eq('id', data as string)
      .single();
    expect(ticket.data).toMatchObject({
      title: 'Deletion request: Temp subject-one',
      ticket_lane: 'platform',
      category: 'user_deletion_request',
      subject_user_id: subject.id,
      status: 'open',
    });
    const first = await db
      .from('messages')
      .select('content, metadata')
      .eq('conversation_id', data as string)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    expect(first.data?.content).toContain(REASON);
    expect(first.data?.metadata).toMatchObject({ event: 'user_deletion_request', subject_user_id: subject.id });
  });

  test('other churches, yourself, the Super Admin, a short reason and a duplicate are refused', async () => {
    const subject = await newSubject('subject-two');
    expect((await request(churchAdmin.client, otherChurchUser.id)).error?.message).toContain('your own church');
    expect((await request(churchAdmin.client, churchAdmin.id)).error?.message).toContain('yourself');
    expect((await request(churchAdmin.client, superAdmin.id)).error).not.toBeNull();
    expect((await request(churchAdmin.client, subject.id, 'too short')).error).not.toBeNull();
    expect((await request(churchAdmin.client, null)).error).not.toBeNull();

    expect((await request(churchAdmin.client, subject.id)).error).toBeNull();
    expect((await request(churchAdmin.client, subject.id)).error?.message).toContain('already an open deletion request');
  });

  test('a Priest, a Volunteer, a Parishioner and the Super Admin cannot file it', async () => {
    const subject = await newSubject('subject-three');
    for (const account of [priest, volunteer, parishioner, superAdmin]) {
      expect((await request(account.client, subject.id)).error).not.toBeNull();
    }
    const asOtherAdmin = await clientAs('other_admin');
    expect((await request(asOtherAdmin, subject.id)).error).not.toBeNull();
  });

  test('the sixth open request is refused and requests do not use the 3 general platform tickets', async () => {
    const admin = await tempUser(TAG, 'ca-limit', 'church_admin', seed.churchId);
    accounts.push(admin);
    for (let i = 0; i < 5; i += 1) {
      const subject = await newSubject(`limit-${i}`);
      expect((await request(admin.client, subject.id)).error).toBeNull();
    }
    const sixth = await newSubject('limit-5');
    expect((await request(admin.client, sixth.id)).error?.message).toContain('5 open deletion requests');

    for (let i = 0; i < 3; i += 1) {
      const general = await admin.client.rpc('create_ticket', {
        p_lane: 'platform',
        p_church_id: seed.churchId,
        p_category: 'general',
        p_subject: `${TAG}-general ${i}`,
        p_message: 'A general question for the platform team.',
      });
      expect(general.error).toBeNull();
    }
  });

  test('the Super Admin sees it, another Church Admin does not, and it survives the subject being deleted', async () => {
    const subject = await newSubject('subject-four');
    const created = await request(churchAdmin.client, subject.id, `${REASON} Visibility check.`);
    expect(created.error).toBeNull();
    const id = created.data as string;

    const seenBySuper = await superAdmin.client.from('conversations').select('id, subject_user_id').eq('id', id);
    expect(seenBySuper.data).toHaveLength(1);
    const otherAdmin = await clientAs('other_admin');
    const seenByOther = await otherAdmin.from('conversations').select('id').eq('id', id);
    expect(seenByOther.data ?? []).toHaveLength(0);

    const removed = await db.rpc('anonymize_user', { p_user_id: subject.id });
    expect(removed.error).toBeNull();
    const after = await superAdmin.client.from('conversations').select('id, subject_user_id').eq('id', id);
    expect(after.data).toHaveLength(1);
    expect(after.data?.[0].subject_user_id).toBe(subject.id);
  });
});

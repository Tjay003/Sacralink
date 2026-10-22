import { test, expect } from '@playwright/test';
import {
  clientAs,
  deleteTempAccounts,
  getSeed,
  loginAs,
  loginAsAccount,
  serviceClient,
  soleSuperAdmin,
  tempUser,
  type Seed,
  type TempAccount,
} from './support';

/**
 * Ticket lanes and create_ticket (migration 064):
 *  - the database is the only way to create a ticket: it numbers it, picks the participants and enforces roles, categories and limits
 *  - a church-lane ticket reaches only the church's Church Admins; a platform-lane ticket only the Super Admin
 *  - a plain REST insert of a ticket is refused; tickets that existed before the lanes read as church lane
 */

const db = serviceClient();
const TAG = 'tkt-lane';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let parishioner: TempAccount;
let volunteer: TempAccount;
let priest: TempAccount;
let adminA2: TempAccount;
let noAdminChurchId = '';
const accounts: TempAccount[] = [];

async function purgeTickets() {
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

function ticketArgs(overrides: Record<string, unknown> = {}) {
  return {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} subject`,
    p_message: 'A long enough message for the ticket.',
    ...overrides,
  };
}

async function participantIds(conversationId: string): Promise<string[]> {
  const { data, error } = await db.from('conversation_participants').select('user_id').eq('conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purgeTickets();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  parishioner = await tempUser(TAG, 'parishioner', 'user', null);
  volunteer = await tempUser(TAG, 'volunteer', 'volunteer', seed.churchId);
  priest = await tempUser(TAG, 'priest', 'priest', seed.churchId);
  adminA2 = await tempUser(TAG, 'admin-a2', 'church_admin', seed.churchId);
  accounts.push(parishioner, volunteer, priest, adminA2);
  const { data, error } = await db
    .from('churches')
    .insert({ name: `${TAG} Church Without Admin`, address: '2 Test Street', status: 'verified_active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  noAdminChurchId = data.id;
});

test.afterAll(async () => {
  await purgeTickets();
  await deleteTempAccounts(accounts);
  if (noAdminChurchId) await db.from('churches').delete().eq('id', noAdminChurchId);
  await restoreSuperAdmin();
});

test.describe('create_ticket', () => {
  test('a church-lane ticket gets a TCK number from the sequence and only the requester and the Church Admins as participants', async () => {
    const created = await parishioner.client.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} church lane` }));
    expect(created.error).toBeNull();
    const id = created.data as string;

    const { data: ticket } = await db.from('conversations').select('*').eq('id', id).single();
    expect(ticket?.ticket_number).toMatch(/^TCK-\d{6}$/);
    expect(ticket?.ticket_lane).toBe('church');
    expect(ticket?.church_id).toBe(seed.churchId);
    expect(ticket?.status).toBe('open');

    const members = (await participantIds(id)).sort();
    expect(members).toEqual([parishioner.id, seed.ids.church_admin, adminA2.id].sort());
    expect(members).not.toContain(seed.ids.priest);
    expect(members).not.toContain(priest.id);
    expect(members).not.toContain(volunteer.id);

    const { data: messages } = await db.from('messages').select('sender_id, content').eq('conversation_id', id);
    expect(messages).toHaveLength(1);
    expect(messages![0].sender_id).toBe(parishioner.id);

    const adminClient = await clientAs('church_admin');
    const seen = await adminClient.from('conversations').select('id').eq('id', id);
    expect(seen.data).toHaveLength(1);
  });

  test('who may create which lane, and a direct REST insert of a ticket is refused', async () => {
    const asAdmin = await clientAs('church_admin');
    const asPriest = await clientAs('priest');

    // Allowed
    expect((await volunteer.client.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} vol church` }))).error).toBeNull();
    expect(
      (await volunteer.client.rpc('create_ticket', ticketArgs({ p_lane: 'platform', p_subject: `${TAG} vol platform` }))).error,
    ).toBeNull();

    // Refused
    const refusals = await Promise.all([
      parishioner.client.rpc('create_ticket', ticketArgs({ p_lane: 'platform', p_subject: `${TAG} par platform` })),
      asAdmin.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} admin church` })),
      asPriest.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} priest church` })),
      superAdmin.client.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} super church` })),
      superAdmin.client.rpc('create_ticket', ticketArgs({ p_lane: 'platform', p_subject: `${TAG} super platform` })),
      parishioner.client.rpc('create_ticket', ticketArgs({ p_subject: 'ab' })),
      parishioner.client.rpc('create_ticket', ticketArgs({ p_message: 'too short' })),
    ]);
    for (const result of refusals) expect(result.error).not.toBeNull();

    const direct = await parishioner.client.from('conversations').insert({
      title: `${TAG} direct insert`,
      type: 'group',
      church_id: seed.churchId,
      created_by: parishioner.id,
      ticket_number: 'TCK-999999',
      ticket_lane: 'church',
    });
    expect(direct.error).not.toBeNull();
    const bare = await parishioner.client.from('conversations').insert({
      title: `${TAG} direct insert bare`,
      type: 'group',
      church_id: seed.churchId,
      created_by: parishioner.id,
      ticket_number: 'TCK-999998',
    });
    expect(bare.error).not.toBeNull();

    // A ministry group is not a ticket and is still created the old way
    const ministry = await parishioner.client
      .from('conversations')
      .insert({ title: `${TAG} ministry`, type: 'group', church_id: seed.churchId, created_by: parishioner.id })
      .select('id')
      .single();
    expect(ministry.error).toBeNull();
    const { count } = await db.from('conversations').select('id', { count: 'exact', head: true }).like('title', `%${TAG} direct insert%`);
    expect(count).toBe(0);
  });

  test('each role can raise only its own platform categories', async () => {
    const asAdmin = await clientAs('church_admin');
    const platform = (category: string, subject: string) => ticketArgs({ p_lane: 'platform', p_category: category, p_subject: `${TAG} ${subject}` });

    // Priest: no church setup, no deletion request
    expect((await priest.client.rpc('create_ticket', platform('church_setup', 'priest setup'))).error).not.toBeNull();
    expect((await priest.client.rpc('create_ticket', platform('user_deletion_request', 'priest deletion'))).error).not.toBeNull();
    expect((await priest.client.rpc('create_ticket', platform('report_problem', 'priest problem'))).error).toBeNull();

    // Church Admin: setup is fine
    expect((await asAdmin.rpc('create_ticket', platform('church_setup', 'admin setup'))).error).toBeNull();
    expect((await asAdmin.rpc('create_ticket', platform('report_church', 'admin concern'))).error).not.toBeNull();

    // Parishioner: only report_church
    expect((await parishioner.client.rpc('create_ticket', platform('general', 'par general'))).error).not.toBeNull();
    expect((await parishioner.client.rpc('create_ticket', platform('report_person', 'par person'))).error).not.toBeNull();
    expect((await parishioner.client.rpc('create_ticket', platform('report_church', 'par concern'))).error).toBeNull();

    // A church-lane ticket cannot use a platform category
    expect((await parishioner.client.rpc('create_ticket', ticketArgs({ p_category: 'report_problem' }))).error).not.toBeNull();
  });

  test('three open platform tickets is the limit, a resolved one frees a slot, and simultaneous attempts create at most three', async () => {
    const platform = (subject: string) => ticketArgs({ p_lane: 'platform', p_subject: `${TAG} ${subject}` });
    const racer = await tempUser(TAG, 'racer', 'priest', seed.churchId);
    accounts.push(racer);

    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => racer.client.rpc('create_ticket', platform(`race ${n}`))));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    const refused = results.find((r) => r.error)!;
    expect(refused.error!.message).toContain('3 open tickets with the Super Admin');

    const { data: open } = await db.from('conversations').select('id').eq('created_by', racer.id).eq('ticket_lane', 'platform');
    expect(open).toHaveLength(3);

    await db.from('conversations').update({ status: 'resolved' }).eq('id', open![0].id);
    expect((await racer.client.rpc('create_ticket', platform('after resolve'))).error).toBeNull();
    expect((await racer.client.rpc('create_ticket', platform('over again'))).error).not.toBeNull();

    // Deletion requests never use up the 3 (and the 5-request limit is separate). Rows are inserted as the service role.
    const filer = await tempUser(TAG, 'filer', 'church_admin', seed.churchId);
    accounts.push(filer);
    for (let n = 0; n < 5; n++) {
      const { error } = await db.from('conversations').insert({
        title: `${TAG} deletion ${n}`,
        type: 'group',
        church_id: seed.churchId,
        created_by: filer.id,
        category: 'user_deletion_request',
        status: 'open',
        ticket_number: `TCK-80000${n}`,
        ticket_lane: 'platform',
      });
      expect(error).toBeNull();
    }
    for (const n of [1, 2, 3]) expect((await filer.client.rpc('create_ticket', platform(`filer ${n}`))).error).toBeNull();
    expect((await filer.client.rpc('create_ticket', platform('filer 4'))).error).not.toBeNull();

    // A Parishioner may have two open concerns
    const reporter = await tempUser(TAG, 'reporter', 'user', null);
    accounts.push(reporter);
    const concern = (n: number) => ticketArgs({ p_lane: 'platform', p_category: 'report_church', p_subject: `${TAG} concern ${n}` });
    expect((await reporter.client.rpc('create_ticket', concern(1))).error).toBeNull();
    expect((await reporter.client.rpc('create_ticket', concern(2))).error).toBeNull();
    const third = await reporter.client.rpc('create_ticket', concern(3));
    expect(third.error!.message).toContain('2 open concerns');
  });
});

test.describe('privacy and church scope', () => {
  test('a platform ticket is readable only by its requester and the Super Admin; a concern is invisible to the church it is about', async () => {
    const staff = await tempUser(TAG, 'private-admin', 'church_admin', seed.churchId);
    accounts.push(staff);
    const ticket = await staff.client.rpc('create_ticket', ticketArgs({ p_lane: 'platform', p_subject: `${TAG} private staff` }));
    expect(ticket.error).toBeNull();
    const staffTicketId = ticket.data as string;
    expect((await participantIds(staffTicketId)).sort()).toEqual([staff.id, superAdmin.id].sort());

    const reporter = await tempUser(TAG, 'private-reporter', 'user', null);
    accounts.push(reporter);
    const concern = await reporter.client.rpc(
      'create_ticket',
      ticketArgs({ p_lane: 'platform', p_category: 'report_church', p_subject: `${TAG} private concern` }),
    );
    expect(concern.error).toBeNull();
    const concernId = concern.data as string;

    const readers: Array<[string, Awaited<ReturnType<typeof clientAs>>]> = [
      ['own church admin', await clientAs('church_admin')],
      ['second church admin of the same church', adminA2.client],
      ['priest', priest.client],
      ['volunteer', volunteer.client],
      ['other parish admin', await clientAs('other_admin')],
    ];
    for (const [, client] of readers) {
      const conv = await client.from('conversations').select('id').in('id', [staffTicketId, concernId]);
      expect(conv.data ?? []).toHaveLength(0);
      const msgs = await client.from('messages').select('id').in('conversation_id', [staffTicketId, concernId]);
      expect(msgs.data ?? []).toHaveLength(0);
    }

    for (const client of [superAdmin.client, staff.client]) {
      const conv = await client.from('conversations').select('id').eq('id', staffTicketId);
      expect(conv.data).toHaveLength(1);
    }
    expect((await superAdmin.client.from('conversations').select('id').eq('id', concernId)).data).toHaveLength(1);
    expect((await reporter.client.from('conversations').select('id').eq('id', concernId)).data).toHaveLength(1);
  });

  test('a church with no Church Admin refuses a church ticket but accepts a concern, and church_has_admin tells the form', async () => {
    const asked = await parishioner.client.rpc('church_has_admin', { _church_id: noAdminChurchId });
    expect(asked.data).toBe(false);
    expect((await parishioner.client.rpc('church_has_admin', { _church_id: seed.churchId })).data).toBe(true);

    const refused = await parishioner.client.rpc('create_ticket', ticketArgs({ p_church_id: noAdminChurchId, p_subject: `${TAG} no admin` }));
    expect(refused.error!.message).toContain('This church has no administrator yet');

    const reporter = await tempUser(TAG, 'reporter-noadmin', 'user', null);
    accounts.push(reporter);
    const concern = await reporter.client.rpc(
      'create_ticket',
      ticketArgs({ p_lane: 'platform', p_category: 'report_church', p_church_id: noAdminChurchId, p_subject: `${TAG} no admin concern` }),
    );
    expect(concern.error).toBeNull();
    expect((await participantIds(concern.data as string)).sort()).toEqual([reporter.id, superAdmin.id].sort());
  });

  test('changing home church keeps open tickets with the old church and sends new ones to the new church', async () => {
    const mover = await tempUser(TAG, 'mover', 'user', seed.churchId);
    accounts.push(mover);
    const first = await mover.client.rpc('create_ticket', ticketArgs({ p_subject: `${TAG} before move` }));
    expect(first.error).toBeNull();

    await db.from('profiles').update({ church_id: seed.otherChurchId, assigned_church_id: seed.otherChurchId }).eq('id', mover.id);

    const second = await mover.client.rpc('create_ticket', ticketArgs({ p_church_id: seed.otherChurchId, p_subject: `${TAG} after move` }));
    expect(second.error).toBeNull();

    const { data: tickets } = await db.from('conversations').select('id, church_id').in('id', [first.data as string, second.data as string]);
    expect(tickets!.find((t) => t.id === first.data)?.church_id).toBe(seed.churchId);
    expect(tickets!.find((t) => t.id === second.data)?.church_id).toBe(seed.otherChurchId);

    const oldAdmin = await clientAs('church_admin');
    const newAdmin = await clientAs('other_admin');
    expect((await oldAdmin.from('conversations').select('id').eq('id', first.data as string)).data).toHaveLength(1);
    expect((await newAdmin.from('conversations').select('id').eq('id', first.data as string)).data ?? []).toHaveLength(0);
    expect((await newAdmin.from('conversations').select('id').eq('id', second.data as string)).data).toHaveLength(1);
    expect((await oldAdmin.from('conversations').select('id').eq('id', second.data as string)).data ?? []).toHaveLength(0);
  });

  test('a ticket that existed before the lanes reads as church lane', async () => {
    const { data, error } = await db
      .from('conversations')
      .insert({
        title: `${TAG} legacy`,
        type: 'group',
        church_id: seed.churchId,
        created_by: seed.ids.parishioner,
        category: 'general',
        status: 'open',
        ticket_number: 'TCK-123456',
      })
      .select('ticket_lane')
      .single();
    expect(error).toBeNull();
    expect(data?.ticket_lane).toBe('church');
    const { count } = await db.from('conversations').select('id', { count: 'exact', head: true }).not('ticket_number', 'is', null).is('ticket_lane', null);
    expect(count).toBe(0);
  });
});

test.describe('New Ticket form', () => {
  test('a parishioner opens a church ticket and a church admin opens a platform ticket through the real New Ticket button', async ({ page, browser }) => {
    await loginAs(page, 'parishioner');
    await page.goto('/messages');
    await page.getByRole('button', { name: 'New Ticket' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#inquiry-parish').selectOption({ label: 'Local Test Parish' });
    await dialog.locator('#inquiry-subject').fill(`${TAG} ui church`);
    await dialog.locator('#inquiry-message').fill('Please tell me the schedule of the baptism class.');
    await dialog.getByRole('button', { name: 'Send Inquiry' }).click();
    await expect(page).toHaveURL(/conv=/);
    const churchTicket = new URL(page.url()).searchParams.get('conv')!;
    const { data: churchRow } = await db.from('conversations').select('ticket_lane, ticket_number').eq('id', churchTicket).single();
    expect(churchRow?.ticket_lane).toBe('church');
    expect(churchRow?.ticket_number).toMatch(/^TCK-\d{6}$/);

    const adminPage = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await loginAs(adminPage, 'church_admin');
    await adminPage.goto('/messages');
    await adminPage.getByRole('button', { name: 'New Ticket' }).click();
    dialog = adminPage.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Contact the Super Admin' })).toBeVisible();
    await expect(dialog.locator('#inquiry-parish')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Church verification and setup' })).toBeVisible();
    await dialog.locator('#inquiry-subject').fill(`${TAG} ui platform`);
    await dialog.locator('#inquiry-message').fill('Please verify our church so we can publish services.');
    await dialog.getByRole('button', { name: 'Send Inquiry' }).click();
    await expect(adminPage).toHaveURL(/conv=/);
    const platformTicket = new URL(adminPage.url()).searchParams.get('conv')!;
    const { data: platformRow } = await db.from('conversations').select('ticket_lane, church_id').eq('id', platformTicket).single();
    expect(platformRow?.ticket_lane).toBe('platform');
    expect(platformRow?.church_id).toBe(seed.churchId);
    expect((await participantIds(platformTicket)).sort()).toEqual([seed.ids.church_admin, superAdmin.id].sort());

    // The 3-ticket limit shows the readable error in the modal
    const limited = await tempUser(TAG, 'ui-limited', 'priest', seed.churchId);
    accounts.push(limited);
    for (const n of [1, 2, 3]) {
      expect((await limited.client.rpc('create_ticket', ticketArgs({ p_lane: 'platform', p_subject: `${TAG} ui limit ${n}` }))).error).toBeNull();
    }
    const limitedPage = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await loginAsAccount(limitedPage, limited);
    await limitedPage.goto('/messages');
    await limitedPage.getByRole('button', { name: 'New Ticket' }).click();
    dialog = limitedPage.getByRole('dialog');
    await dialog.locator('#inquiry-subject').fill(`${TAG} ui over limit`);
    await dialog.locator('#inquiry-message').fill('This fourth ticket should be refused.');
    await dialog.getByRole('button', { name: 'Send Inquiry' }).click();
    await expect(dialog.getByText('You already have 3 open tickets with the Super Admin')).toBeVisible();
  });
});

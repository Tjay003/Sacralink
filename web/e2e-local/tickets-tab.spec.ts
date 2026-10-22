import { test, expect, type Page } from '@playwright/test';
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
 * Tickets tab placement and role-correct ticket UI on /messages (ticket 12):
 *  - tickets appear only under Tickets; DMs, staff channels and ministry groups never do; a ticket link lands on Tickets
 *  - the status dropdown is for the handler only, a failed change shows an error and keeps the old status
 *  - a ticket is invisible (list, counts, link) to anyone who is not the requester or a handler, until assignment or escalation
 *  - the Church Admin sees only a stub line for an escalated ticket
 *  - New Message offers each role only the people the database allows; Parishioners and Volunteers get New Ticket
 *  - legacy Direct chats are read-only for Parishioners, a blocked user disables the composer
 *  - the no-administrator form state and the "Ask the Super Admin to review" button
 */

const db = serviceClient();
const TAG = 'tkt-tab';
const LIST_TITLES = 'div.divide-y.overflow-y-auto h3';

let seed: Seed;
let restoreSuperAdmin: () => Promise<void>;
let superAdmin: TempAccount;
let parishioner: TempAccount; // no home church: opens church tickets by choosing a church
let churchParishioner: TempAccount; // parishioner of the church: a Church Admin contact
let volunteerRequester: TempAccount;
let unassignedVolunteer: TempAccount;
let assignedPriest: TempAccount;
let otherPriest: TempAccount;
let emptyChurchId = '';
const accounts: TempAccount[] = [];
const conversationIds: string[] = [];

async function purge() {
  if (conversationIds.length) await db.from('conversations').delete().in('id', conversationIds);
  const { error } = await db.from('conversations').delete().like('title', `%${TAG}%`);
  if (error) throw error;
}

async function newTicket(requester: TempAccount, label: string): Promise<string> {
  const { data, error } = await requester.client.rpc('create_ticket', {
    p_lane: 'church',
    p_church_id: seed.churchId,
    p_category: 'general',
    p_subject: `${TAG} ${label}`,
    p_message: 'A long enough message for the ticket.',
  });
  if (error) throw error;
  conversationIds.push(data as string);
  return data as string;
}

async function ticketNumber(id: string): Promise<string> {
  const { data, error } = await db.from('conversations').select('ticket_number').eq('id', id).single();
  if (error) throw error;
  return data.ticket_number as string;
}

async function addParticipant(conversationId: string, userId: string) {
  const { error } = await db.from('conversation_participants').upsert({ conversation_id: conversationId, user_id: userId });
  if (error) throw error;
}

async function newDirect(a: string, b: string, createdBy: string, message: string): Promise<string> {
  const { data, error } = await db.from('conversations').insert({ type: 'direct', created_by: createdBy }).select('id').single();
  if (error) throw error;
  conversationIds.push(data.id);
  const { error: partErr } = await db.from('conversation_participants').insert([a, b].map((user_id) => ({ conversation_id: data.id, user_id })));
  if (partErr) throw partErr;
  const { error: msgErr } = await db.from('messages').insert({ conversation_id: data.id, sender_id: b, content: message });
  if (msgErr) throw msgErr;
  return data.id as string;
}

async function pageFor(page: Page, account: TempAccount | 'church_admin') {
  if (account === 'church_admin') await loginAs(page, 'church_admin');
  else await loginAsAccount(page, account);
}

async function freshPage(page: Page, account: TempAccount | 'church_admin') {
  const context = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await context.newPage();
  await pageFor(other, account);
  return { page: other, close: () => context.close() };
}

async function stubFunctionInstalled(): Promise<boolean> {
  const admin = await clientAs('church_admin');
  const { error } = await admin.rpc('list_escalated_ticket_stubs');
  return !error || error.code !== 'PGRST202';
}

async function reviewFunctionInstalled(): Promise<boolean> {
  const { error } = await parishioner.client.rpc('ticket_request_review', { p_ticket_id: '00000000-0000-0000-0000-000000000000' });
  return !error || error.code !== 'PGRST202';
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  seed = await getSeed();
  await purge();
  const sole = await soleSuperAdmin(TAG);
  superAdmin = sole.account;
  restoreSuperAdmin = sole.restore;
  parishioner = await tempUser(TAG, 'par', 'user', null);
  churchParishioner = await tempUser(TAG, 'par-church', 'user', seed.churchId);
  volunteerRequester = await tempUser(TAG, 'volrequester', 'volunteer', seed.churchId);
  unassignedVolunteer = await tempUser(TAG, 'unassigned', 'volunteer', seed.churchId);
  assignedPriest = await tempUser(TAG, 'assigned-priest', 'priest', seed.churchId);
  otherPriest = await tempUser(TAG, 'other-priest', 'priest', seed.churchId);
  accounts.push(parishioner, churchParishioner, volunteerRequester, unassignedVolunteer, assignedPriest, otherPriest);

  const { data: church, error } = await db
    .from('churches')
    .insert({ name: `${TAG} empty church ${Date.now()}`, address: '1 Test Street', status: 'verified_active', is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  emptyChurchId = church.id;
});

test.afterAll(async () => {
  await purge();
  await deleteTempAccounts(accounts);
  if (restoreSuperAdmin) await restoreSuperAdmin();
  if (emptyChurchId) await db.from('churches').delete().eq('id', emptyChurchId);
});

test.describe('Tab placement', () => {
  test('tickets appear only under Tickets, DMs and ministry groups never do, and a ticket link lands on Tickets', async ({ page }) => {
    const ticketId = await newTicket(parishioner, 'placement');
    await newDirect(parishioner.id, seed.ids.church_admin, parishioner.id, 'A direct hello from the office');
    const { data: group, error } = await db
      .from('conversations')
      .insert({ title: `${TAG} ministry choir`, type: 'group', church_id: seed.churchId, created_by: parishioner.id })
      .select('id')
      .single();
    expect(error).toBeNull();
    conversationIds.push(group!.id);
    await addParticipant(group!.id, parishioner.id);

    await loginAsAccount(page, parishioner);
    await page.goto('/messages');
    const titles = page.locator(LIST_TITLES);

    // All: chats and groups, no ticket
    await expect(titles.filter({ hasText: `${TAG} ministry choir` })).toHaveCount(1);
    await expect(titles.filter({ hasText: 'Local Church Admin' })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${TAG} placement` })).toHaveCount(0);

    // Direct: the chat only
    await page.getByRole('button', { name: 'Direct', exact: true }).click();
    await expect(titles.filter({ hasText: 'Local Church Admin' })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${TAG} ministry choir` })).toHaveCount(0);
    await expect(titles.filter({ hasText: `${TAG} placement` })).toHaveCount(0);

    // Tickets: the ticket only
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(titles.filter({ hasText: `${TAG} placement` })).toHaveCount(1);
    await expect(titles.filter({ hasText: `${TAG} ministry choir` })).toHaveCount(0);
    await expect(titles.filter({ hasText: 'Local Church Admin' })).toHaveCount(0);

    // A link or notification opens the ticket on the Tickets tab
    await page.goto(`/messages?conv=${ticketId}`);
    await expect(page.locator('h2', { hasText: `${TAG} placement` })).toBeVisible();
    await expect(titles.filter({ hasText: `${TAG} placement` })).toHaveCount(1);
    await expect(titles.filter({ hasText: 'Local Church Admin' })).toHaveCount(0);
  });
});

test.describe('Status dropdown', () => {
  test('the Church Admin gets the dropdown; the requester, including a Volunteer requester, gets a read-only badge', async ({ page }) => {
    const parishionerTicket = await newTicket(parishioner, 'dropdown-par');
    const volunteerTicket = await newTicket(volunteerRequester, 'dropdown-vol');

    await loginAs(page, 'church_admin');
    await page.goto(`/messages?conv=${parishionerTicket}`);
    await expect(page.locator('h2', { hasText: `${TAG} dropdown-par` })).toBeVisible();
    await expect(page.locator('select')).toHaveCount(1);
    await page.goto(`/messages?conv=${volunteerTicket}`);
    await expect(page.locator('h2', { hasText: `${TAG} dropdown-vol` })).toBeVisible();
    await expect(page.locator('select')).toHaveCount(1);

    const requesters: Array<[TempAccount, string, string]> = [
      [parishioner, parishionerTicket, 'dropdown-par'],
      [volunteerRequester, volunteerTicket, 'dropdown-vol'],
    ];
    for (const [account, id, label] of requesters) {
      const view = await freshPage(page, account);
      await view.page.goto(`/messages?conv=${id}`);
      await expect(view.page.locator('h2', { hasText: `${TAG} ${label}` })).toBeVisible();
      await expect(view.page.locator('select')).toHaveCount(0);
      await expect(view.page.locator('span.rounded-xl', { hasText: /^Open$/ })).toBeVisible();
      await view.close();
    }
  });

  test('a status change the database refuses shows an error and keeps the old status', async ({ page }) => {
    const ticketId = await newTicket(parishioner, 'revert');

    await loginAs(page, 'church_admin');
    await page.goto(`/messages?conv=${ticketId}`);
    const select = page.locator('select');
    await expect(select).toHaveValue('open');

    // The ticket is resolved behind the page's back, so choosing Resolved is refused ("already resolved")
    const { error } = await db.from('conversations').update({ status: 'resolved' }).eq('id', ticketId);
    expect(error).toBeNull();
    await select.selectOption('resolved');

    await expect(page.getByTestId('ticket-action-error')).toBeVisible();
    await expect(select).toHaveValue('open');
  });
});

test.describe('Who sees a ticket', () => {
  test('an unassigned Priest or Volunteer and the Super Admin see nothing: not the list, the count or the link', async ({ page }) => {
    const ticketId = await newTicket(parishioner, 'hidden');
    // Stale participant rows must grant nothing
    await addParticipant(ticketId, unassignedVolunteer.id);
    await addParticipant(ticketId, otherPriest.id);
    await addParticipant(ticketId, superAdmin.id);

    for (const account of [unassignedVolunteer, otherPriest, superAdmin]) {
      const count = await account.client.rpc('get_my_unread_message_count');
      expect(count.data).toBe(0);
      const rows = await account.client.from('conversations').select('id').eq('id', ticketId);
      expect(rows.data).toEqual([]);
    }

    const view = await freshPage(page, unassignedVolunteer);
    await view.page.goto('/messages');
    await view.page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(view.page.locator(LIST_TITLES).filter({ hasText: `${TAG} hidden` })).toHaveCount(0);
    await view.page.goto(`/messages?conv=${ticketId}`);
    await expect(view.page.getByTestId('conversation-not-found')).toBeVisible();
    await expect(view.page.locator('h2', { hasText: `${TAG} hidden` })).toHaveCount(0);
    await view.close();

    const superView = await freshPage(page, superAdmin);
    await superView.page.goto(`/messages?conv=${ticketId}`);
    await expect(superView.page.getByTestId('conversation-not-found')).toBeVisible();
    await superView.close();
  });

  test('an assigned Priest works the ticket until it is escalated, then it leaves them and the Church Admin; the Super Admin gets it', async ({ page }) => {
    const ticketId = await newTicket(parishioner, 'assigned');
    expect((await db.from('conversations').update({ assigned_to: assignedPriest.id }).eq('id', ticketId)).error).toBeNull();
    await addParticipant(ticketId, assignedPriest.id);

    const priestView = await freshPage(page, assignedPriest);
    await priestView.page.goto(`/messages?conv=${ticketId}`);
    await expect(priestView.page.locator('h2', { hasText: `${TAG} assigned` })).toBeVisible();
    await expect(priestView.page.locator('select')).toHaveCount(1);
    await expect(priestView.page.getByPlaceholder('Type a message...')).toBeVisible();

    // Escalation (what ticket 14 does): the assignee and the Church Admin lose the ticket, the Super Admin gets it
    const escalated = await db
      .from('conversations')
      .update({ escalated_at: new Date().toISOString(), assigned_to: null, status: 'in_progress' })
      .eq('id', ticketId);
    expect(escalated.error).toBeNull();
    await db.from('conversation_participants').delete().eq('conversation_id', ticketId).in('user_id', [assignedPriest.id, seed.ids.church_admin]);
    await addParticipant(ticketId, superAdmin.id);

    await priestView.page.goto(`/messages?conv=${ticketId}`);
    await expect(priestView.page.getByTestId('conversation-not-found')).toBeVisible();
    await priestView.close();

    await loginAs(page, 'church_admin');
    await page.goto(`/messages?conv=${ticketId}`);
    await expect(page.getByTestId('conversation-not-found')).toBeVisible();
    await expect(page.locator('h2', { hasText: `${TAG} assigned` })).toHaveCount(0);

    const superView = await freshPage(page, superAdmin);
    await superView.page.goto(`/messages?conv=${ticketId}`);
    await expect(superView.page.locator('h2', { hasText: `${TAG} assigned` })).toBeVisible();
    await expect(superView.page.locator('select')).toHaveCount(1);
    await expect(superView.page.getByTestId('ticket-lane')).toHaveText('Escalated to Super Admin');
    await superView.close();
  });

  test('the Church Admin sees only a stub line for an escalated ticket, never the assignee, and it vanishes after a send back', async ({ page }) => {
    test.skip(!(await stubFunctionInstalled()), 'list_escalated_ticket_stubs arrives with ticket 14');
    const ticketId = await newTicket(parishioner, 'stub');
    const number = await ticketNumber(ticketId);
    expect((await db.from('conversations').update({ escalated_at: new Date().toISOString() }).eq('id', ticketId)).error).toBeNull();
    await db.from('conversation_participants').delete().eq('conversation_id', ticketId).eq('user_id', seed.ids.church_admin);

    await loginAs(page, 'church_admin');
    await page.goto('/messages');
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    const stub = page.getByTestId('escalated-ticket-stub').filter({ hasText: `${number} · Escalated to Super Admin` });
    await expect(stub).toBeVisible();
    await stub.click();
    await expect(page).not.toHaveURL(/conv=/);
    await expect(page.locator('h2', { hasText: `${TAG} stub` })).toHaveCount(0);

    const priestView = await freshPage(page, assignedPriest);
    await priestView.page.goto('/messages');
    await priestView.page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(priestView.page.getByTestId('escalated-ticket-stub')).toHaveCount(0);
    await priestView.close();

    // Sent back: escalation cleared, the Church Admin is a participant again and reads the ticket normally
    expect((await db.from('conversations').update({ escalated_at: null }).eq('id', ticketId)).error).toBeNull();
    await addParticipant(ticketId, seed.ids.church_admin);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await expect(page.getByTestId('escalated-ticket-stub').filter({ hasText: number })).toHaveCount(0);
    await expect(page.locator(LIST_TITLES).filter({ hasText: `${TAG} stub` })).toHaveCount(1);
  });
});

test.describe('New Message picker', () => {
  test('a Parishioner and a Volunteer get New Ticket (and the staff channel) instead of contacts', async ({ page }) => {
    await loginAsAccount(page, parishioner);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'New message' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Messages to the parish office are tickets so the office can track and answer them.')).toBeVisible();
    await expect(dialog.getByText('Local Church Admin')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Open staff channel' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'New Ticket' }).click();
    await expect(page.locator('h2', { hasText: 'Contact Parish Office' })).toBeVisible();

    const volunteerView = await freshPage(page, unassignedVolunteer);
    await volunteerView.page.goto('/messages');
    await volunteerView.page.getByRole('button', { name: 'New message' }).first().click();
    const volunteerDialog = volunteerView.page.getByRole('dialog');
    await expect(volunteerDialog.getByRole('button', { name: 'New Ticket' })).toBeVisible();
    await expect(volunteerDialog.getByRole('button', { name: 'Open staff channel' })).toBeVisible();
    await expect(volunteerDialog.getByText('Local Church Admin')).toHaveCount(0);
    await volunteerDialog.getByRole('button', { name: 'Open staff channel' }).click();
    await expect(volunteerView.page.locator('h2', { hasText: /Staff Channel/ })).toBeVisible();
    await volunteerView.close();
  });

  test('a Priest, a Church Admin and the Super Admin see exactly the people the matrix allows', async ({ page }) => {
    const names = async (view: Page) => {
      await view.goto('/messages');
      await view.getByRole('button', { name: 'New message' }).first().click();
      const dialog = view.getByRole('dialog');
      await expect(dialog.getByText('Loading directory...')).toHaveCount(0);
      return dialog;
    };

    // Priest: the Church Admin of their church; a parishioner only with a shared appointment (none here)
    const priestView = await freshPage(page, otherPriest);
    const priestDialog = await names(priestView.page);
    await expect(priestDialog.getByText('Local Church Admin', { exact: true })).toBeVisible();
    for (const hidden of ['Other Parish Admin', 'Temp unassigned', 'Temp assigned-priest', 'Temp par-church']) {
      await expect(priestDialog.getByText(hidden, { exact: true })).toHaveCount(0);
    }
    await priestView.close();

    // Church Admin: Super Admin, every Church Admin, and the Priests, Volunteers and Parishioners of their own church
    await loginAs(page, 'church_admin');
    const adminDialog = await names(page);
    for (const shown of ['Temp super-admin', 'Other Parish Admin', 'Temp unassigned', 'Temp other-priest', 'Temp par-church']) {
      await expect(adminDialog.getByText(shown, { exact: true })).toBeVisible();
    }
    await expect(adminDialog.getByText('Temp par', { exact: true })).toHaveCount(0);
    await expect(adminDialog.getByText('Local Church Admin', { exact: true })).toHaveCount(0);

    // Super Admin: Church Admins only
    const superView = await freshPage(page, superAdmin);
    const superDialog = await names(superView.page);
    await expect(superDialog.getByText('Local Church Admin', { exact: true })).toBeVisible();
    await expect(superDialog.getByText('Other Parish Admin', { exact: true })).toBeVisible();
    for (const hidden of ['Temp unassigned', 'Temp other-priest', 'Temp par-church']) {
      await expect(superDialog.getByText(hidden, { exact: true })).toHaveCount(0);
    }
    await superView.close();
  });
});

test.describe('Direct chat states', () => {
  test('a legacy Direct chat is read-only for a Parishioner but not for the Church Admin', async ({ page }) => {
    const chat = await newDirect(parishioner.id, seed.ids.church_admin, parishioner.id, 'The office replied in the old chat');
    const flag = await parishioner.client.rpc('direct_is_legacy', { _conversation_id: chat });
    expect(flag.data).toBe(true);

    await loginAsAccount(page, parishioner);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'Direct', exact: true }).click();
    // The placement test left another chat with the same person, so pick the row by its last message
    await page.locator('div.cursor-pointer', { hasText: 'The office replied in the old chat' }).click();
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: 'The office replied in the old chat' })).toBeVisible();
    await expect(page.getByTestId('legacy-direct-banner')).toContainText('Please open a ticket');
    await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0);
    await page.getByTestId('legacy-direct-banner').getByRole('button', { name: 'New Ticket' }).click();
    await expect(page.locator('h2', { hasText: 'Contact Parish Office' })).toBeVisible();

    const adminView = await freshPage(page, 'church_admin');
    await adminView.page.goto(`/messages?conv=${chat}`);
    await expect(adminView.page.getByPlaceholder('Type a message...')).toBeVisible();
    await expect(adminView.page.getByTestId('legacy-direct-banner')).toHaveCount(0);
    await adminView.close();
  });

  test('a Direct chat with a deleted user keeps its history and disables the composer', async ({ page }) => {
    const other = await tempUser(TAG, 'gone', 'user', seed.churchId);
    accounts.push(other);
    const chat = await newDirect(seed.ids.church_admin, other.id, seed.ids.church_admin, 'Message from someone who is leaving');
    expect((await db.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', other.id)).error).toBeNull();

    await loginAs(page, 'church_admin');
    await page.goto(`/messages?conv=${chat}`);
    await expect(page.locator('p.whitespace-pre-wrap', { hasText: 'Message from someone who is leaving' })).toBeVisible();
    await expect(page.getByTestId('composer-unavailable')).toContainText('This user is no longer available');
    await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0);
  });
});

test.describe('New Ticket form and review request', () => {
  test('a church with no administrator offers only the concern route', async ({ page }) => {
    await loginAsAccount(page, parishioner);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'New Ticket' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#inquiry-parish').selectOption({ value: emptyChurchId });
    await expect(dialog.getByText('This church has no administrator yet')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Baptism' })).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Report a concern about my church' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Send Inquiry' })).toBeDisabled();
  });

  test('the review button shows only on an old, unanswered church ticket, and using it escalates the ticket', async ({ page }) => {
    const oldAge = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const fresh = await newTicket(parishioner, 'review-fresh');
    const old = await newTicket(parishioner, 'review-old');
    const answered = await newTicket(parishioner, 'review-answered');
    for (const id of [old, answered]) {
      expect((await db.from('conversations').update({ created_at: oldAge }).eq('id', id)).error).toBeNull();
    }
    const reply = await db.from('messages').insert({ conversation_id: answered, sender_id: seed.ids.church_admin, content: 'We are on it.' });
    expect(reply.error).toBeNull();

    await loginAsAccount(page, parishioner);
    const button = page.getByRole('button', { name: 'Ask the Super Admin to review' });
    await page.goto(`/messages?conv=${fresh}`);
    await expect(page.locator('h2', { hasText: `${TAG} review-fresh` })).toBeVisible();
    await expect(button).toHaveCount(0);
    await page.goto(`/messages?conv=${answered}`);
    await expect(page.locator('h2', { hasText: `${TAG} review-answered` })).toBeVisible();
    await expect(button).toHaveCount(0);
    await page.goto(`/messages?conv=${old}`);
    await expect(page.locator('h2', { hasText: `${TAG} review-old` })).toBeVisible();
    await expect(button).toBeVisible();

    test.skip(!(await reviewFunctionInstalled()), 'ticket_request_review arrives with ticket 14');
    await button.click();
    await expect(page.getByTestId('ticket-lane')).toHaveText('Escalated to Super Admin');
    await expect(button).toHaveCount(0);
  });
});

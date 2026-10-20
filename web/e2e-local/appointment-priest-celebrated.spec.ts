import { test, expect, type Page } from '@playwright/test';
import {
  capture,
  clientAs,
  createApprovedAppointment,
  createPendingAppointment,
  getSeed,
  loginAs,
  resetAppointmentData,
  serviceClient,
} from './support';

/**
 * Real end-to-end: the celebrant marks his own celebrations from the priest dashboard, and has no
 * other edit power anywhere (UI or database).
 */

const db = serviceClient();

async function appointment(id: string) {
  const { data, error } = await db.from('appointments').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
async function history(id: string) {
  const { data, error } = await db.from('appointment_changes').select('*').eq('appointment_id', id).order('created_at');
  if (error) throw error;
  return data;
}

/** "Today's celebrations" timeline on the priest dashboard. */
function timeline(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: "Today's celebrations" }) });
}

/** The "Needs celebrant attention" queue on the priest dashboard. */
function attentionQueue(page: Page) {
  return page
    .getByRole('heading', { name: 'Needs celebrant attention' })
    .locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]');
}

/** The value shown by a dashboard stat tile. */
function statValue(page: Page, label: string) {
  return page.locator('div.group').filter({ hasText: label }).locator('p.font-serif');
}

test.beforeEach(async () => {
  await resetAppointmentData();
});

test.describe('Priest marks his own appointments celebrated from the dashboard', () => {
  test('today timeline: the button appears once the start time has passed, and marking updates the row and the stats', async ({
    page,
  }) => {
    const seed = await getSeed();
    const started = await createApprovedAppointment({ daysFromToday: 0, time: '00:00:00', serviceType: 'Baptism' });
    const later = await createApprovedAppointment({ daysFromToday: 0, time: '23:59:00', serviceType: 'Wedding' });
    await createApprovedAppointment({ daysFromToday: 0, time: '00:00:00', celebrant: 'priest2', serviceType: 'Confirmation' });
    await loginAs(page, 'priest');

    const today = timeline(page);
    const startedRow = today.locator('div.grid').filter({ hasText: 'Baptism' });
    const laterRow = today.locator('div.grid').filter({ hasText: 'Holy Matrimony' });

    // Only his own two celebrations are on the timeline, not Fr. Second Priest's
    await expect(today.getByRole('button', { name: 'Details' })).toHaveCount(2);
    await expect(today.getByText('Confirmation')).toHaveCount(0);

    // The button shows only for the celebration whose start time has passed
    await expect(startedRow.getByRole('button', { name: 'Mark celebrated' })).toBeVisible();
    await expect(laterRow.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
    await expect(statValue(page, 'Celebrated this year')).toHaveText('0');
    await expect(statValue(page, 'Presiding today')).toHaveText('2');
    await capture(page, 'priest-dashboard-before-marking');

    await startedRow.getByRole('button', { name: 'Mark celebrated' }).click();

    await expect(startedRow).toContainText('Celebrated');
    await expect(startedRow.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
    await expect(statValue(page, 'Celebrated this year')).toHaveText('1');
    await expect(page.getByText('1 celebrated, 1 still to come')).toBeVisible();
    // The marked celebration also leaves the attention queue
    await expect(attentionQueue(page).getByRole('button', { name: 'Mark celebrated' })).toHaveCount(0);
    await capture(page, 'priest-dashboard-after-marking');

    expect((await appointment(started)).status).toBe('completed');
    expect((await appointment(later)).status).toBe('approved');
    const rows = await history(started);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'mark_celebrated', changed_by: seed.ids.priest });

    // Marking a celebration notifies nobody
    const { data: notifications } = await db.from('notifications').select('id');
    expect(notifications).toHaveLength(0);
  });

  test('attention queue: a past approved appointment is "Not yet marked celebrated" and can be marked from there', async ({
    page,
  }) => {
    const seed = await getSeed();
    const past = await createApprovedAppointment({ daysFromToday: -3, serviceType: 'Baptism' });
    const upcoming = await createApprovedAppointment({ daysFromToday: 10, serviceType: 'Wedding' });
    const otherPriests = await createApprovedAppointment({ daysFromToday: -3, celebrant: 'priest2', serviceType: 'Confirmation' });
    await loginAs(page, 'priest');

    const queue = attentionQueue(page);
    await expect(queue.getByText('Not yet marked celebrated')).toHaveCount(1);
    await expect(queue.getByRole('button', { name: 'Mark celebrated' })).toHaveCount(1);
    await expect(queue.getByText('2 open')).toBeVisible();
    await capture(page, 'priest-attention-queue-not-yet-marked');

    await queue.getByRole('button', { name: 'Mark celebrated' }).click();

    await expect(queue.getByText('Not yet marked celebrated')).toHaveCount(0);
    await expect(queue.getByText('1 open')).toBeVisible();

    expect((await appointment(past)).status).toBe('completed');
    expect((await appointment(upcoming)).status).toBe('approved');
    expect((await appointment(otherPriests)).status).toBe('approved');
    const rows = await history(past);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'mark_celebrated', changed_by: seed.ids.priest });
  });

  test('the priest never sees Edit, Approve or Reject, and the database refuses every other edit', async ({ page }) => {
    const mine = await createApprovedAppointment({ daysFromToday: 7, serviceType: 'Baptism' });
    const theirs = await createApprovedAppointment({ daysFromToday: 7, celebrant: 'priest2', serviceType: 'Confirmation' });
    const pending = await createPendingAppointment({ daysFromToday: 9, serviceType: 'Wedding' });
    await loginAs(page, 'priest');

    // The parish appointments page lists everything but offers him no office action
    await page.goto('/appointments');
    const table = page.locator('table');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.getByRole('button', { name: 'Documents' })).toHaveCount(3);
    for (const name of ['Edit', 'Approve', 'Reject', 'Mark celebrated']) {
      await expect(table.getByRole('button', { name, exact: true })).toHaveCount(0);
    }

    // His dashboard lists only his own celebrations
    await page.goto('/dashboard');
    await expect(page.getByText('Upcoming sacramental ministry')).toBeVisible();
    await expect(page.getByText('1 of 1')).toBeVisible();

    // Even calling the functions himself changes nothing
    const priest = await clientAs('priest');
    const seed = await getSeed();
    const attempts = [
      priest.rpc('cancel_appointment', { p_appointment_id: mine, p_reason: 'Not allowed' }),
      priest.rpc('reschedule_appointment', {
        p_appointment_id: mine,
        p_new_date: '2099-01-02',
        p_new_time: '09:00:00',
        p_reason: 'Not allowed',
      }),
      priest.rpc('change_appointment_celebrant', {
        p_appointment_id: mine,
        p_new_priest_id: seed.ids.priest2,
        p_reason: 'Not allowed',
      }),
      priest.rpc('approve_appointment', { p_appointment_id: pending, p_priest_id: seed.ids.priest, p_admin_feedback: null }),
      priest.rpc('reject_appointment', { p_appointment_id: pending, p_admin_feedback: null }),
      priest.rpc('mark_appointment_celebrated', { p_appointment_id: theirs, p_note: null }),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result.error).not.toBeNull();
    }
    await priest.from('appointments').update({ status: 'cancelled' }).eq('id', mine);

    const unchanged = await appointment(mine);
    expect(unchanged.status).toBe('approved');
    expect(unchanged.priest_id).toBe(seed.ids.priest);
    expect((await appointment(theirs)).status).toBe('approved');
    expect((await appointment(pending)).status).toBe('pending');
    const { data: changes } = await db.from('appointment_changes').select('id');
    expect(changes).toHaveLength(0);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & { cancellation_reason?: string | null };

interface MockChange {
  appointment_id: string;
  action: 'cancel' | 'restore';
  reason: string;
  before_values: { status: string };
  after_values: { status: string };
}

const CANCEL_REASON = 'The family requested to move the rite to another parish.';
const RESTORE_REASON = 'The cancellation was entered by mistake.';

/**
 * Replaces the shared appointments REST mock with a small stateful one and mocks the
 * cancel_appointment and restore_appointment RPCs (database functions cannot run in mocked e2e).
 * The mock models the status transitions, the cleared cancellation reason and the change history rows.
 */
async function mockAppointmentEditing(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<{ fn: 'cancel_appointment' | 'restore_appointment'; payload: Record<string, unknown> }> = [];
  const history: MockChange[] = [];

  await page.route('**/rest/v1/appointments*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': `0-${state.length - 1}/${state.length}` },
      body: JSON.stringify(state),
    });
  });

  await page.route('**/rest/v1/rpc/cancel_appointment', async (route) => {
    const payload = route.request().postDataJSON() as { p_appointment_id: string; p_reason: string };
    rpcCalls.push({ fn: 'cancel_appointment', payload });
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) {
      history.push({
        appointment_id: target.id,
        action: 'cancel',
        reason: payload.p_reason,
        before_values: { status: target.status },
        after_values: { status: 'cancelled' },
      });
      target.status = 'cancelled';
      target.cancellation_reason = payload.p_reason;
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/rest/v1/rpc/restore_appointment', async (route) => {
    const payload = route.request().postDataJSON() as { p_appointment_id: string; p_reason: string };
    rpcCalls.push({ fn: 'restore_appointment', payload });
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) {
      history.push({
        appointment_id: target.id,
        action: 'restore',
        reason: payload.p_reason,
        before_values: { status: target.status },
        after_values: { status: 'approved' },
      });
      if (target.status === 'cancelled') target.cancellation_reason = null;
      target.status = 'approved';
    }
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls, history };
}

test.describe('Appointment editing: office restores a Cancelled or Celebrated appointment', () => {
  test('church admin cancels, then restores with a required reason', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, history } = await mockAppointmentEditing(page, MOCK_APPOINTMENTS.slice(0, 2));
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    const edit = row.getByRole('button', { name: 'Edit', exact: true });

    // Cancel first
    await edit.click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason for cancelling').fill(CANCEL_REASON);
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(row.getByText(CANCEL_REASON)).toBeVisible();

    // A cancelled row still offers Edit, and the modal offers only Restore
    await expect(edit).toBeVisible();
    await edit.click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio')).toHaveCount(1);
    await expect(dialog.getByRole('radio', { name: /Restore to approved/ })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: /Cancel appointment/ })).toHaveCount(0);

    // Blank and whitespace-only reasons are blocked inline and nothing is sent
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    await dialog.getByLabel('Reason for restoring').fill('   ');
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    expect(rpcCalls).toHaveLength(1);

    // A valid reason restores it
    await dialog.getByLabel('Reason for restoring').fill(RESTORE_REASON);
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);

    await expect(row.getByText('Cancelled', { exact: true })).toHaveCount(0);
    await expect(row.getByText(CANCEL_REASON)).toHaveCount(0);
    await expect(row.getByText('Approved', { exact: true })).toBeVisible();

    expect(rpcCalls).toEqual([
      { fn: 'cancel_appointment', payload: { p_appointment_id: 'apt-1', p_reason: CANCEL_REASON } },
      { fn: 'restore_appointment', payload: { p_appointment_id: 'apt-1', p_reason: RESTORE_REASON } },
    ]);
    expect(history.map((h) => [h.action, h.before_values.status, h.after_values.status])).toEqual([
      ['cancel', 'approved', 'cancelled'],
      ['restore', 'cancelled', 'approved'],
    ]);

    // Approved again: the full action list is back, without Restore
    await edit.click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: /Cancel appointment/ })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: /Restore to approved/ })).toHaveCount(0);
    await expect(dialog.getByRole('radio')).toHaveCount(4);
  });

  test('a Celebrated row offers only Restore, which returns it to approved', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const celebrated: MockAppointment = { ...MOCK_APPOINTMENTS[0], status: 'completed' };
    const { rpcCalls, history } = await mockAppointmentEditing(page, [celebrated]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByText('Celebrated', { exact: true })).toBeVisible();

    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio')).toHaveCount(1);
    await expect(dialog.getByRole('radio', { name: /Restore to approved/ })).toBeChecked();

    await dialog.getByLabel('Reason for restoring').fill(RESTORE_REASON);
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    await expect(row.getByText('Celebrated', { exact: true })).toHaveCount(0);
    await expect(row.getByText('Approved', { exact: true })).toBeVisible();
    expect(rpcCalls).toEqual([
      { fn: 'restore_appointment', payload: { p_appointment_id: 'apt-1', p_reason: RESTORE_REASON } },
    ]);
    expect(history).toHaveLength(1);
    expect(history[0].before_values).toEqual({ status: 'completed' });
  });

  test('mobile cards offer Restore on a cancelled appointment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticateAs(page, 'church_admin');
    const cancelled: MockAppointment = { ...MOCK_APPOINTMENTS[0], status: 'cancelled', cancellation_reason: CANCEL_REASON };
    const { rpcCalls } = await mockAppointmentEditing(page, [cancelled]);
    await page.goto('/appointments');

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason for restoring').fill(RESTORE_REASON);
    await dialog.getByRole('button', { name: 'Restore to approved', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toHaveLength(1);
    await expect(page.getByText(`Reason: ${CANCEL_REASON}`)).toHaveCount(0);
  });

  test('priests get no Edit button on cancelled or celebrated rows', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointmentEditing(page, [
      { ...MOCK_APPOINTMENTS[0], status: 'cancelled' },
      { ...MOCK_APPOINTMENTS[1], status: 'completed' },
    ]);
    await page.goto('/appointments');
    await expect(page.locator('table').locator('tr', { hasText: 'Baptism' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  });
});

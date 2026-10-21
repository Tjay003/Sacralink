import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & { cancellation_reason?: string | null };

const CANCEL_REASON = 'The family requested to move the rite to another parish.';

/**
 * Replaces the shared appointments REST mock with a small stateful one and mocks the
 * cancel_appointment RPC (database functions cannot run in mocked e2e), recording its payload.
 */
async function mockAppointmentEditing(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<Record<string, unknown>> = [];

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
    rpcCalls.push(payload);
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) {
      target.status = 'cancelled';
      target.cancellation_reason = payload.p_reason;
    }
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls };
}

test.describe('Appointment editing: office cancels an approved appointment', () => {
  test('church admin opens Edit, is blocked without a reason, then cancels with a reason', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockAppointmentEditing(page, MOCK_APPOINTMENTS.slice(0, 2));
    await page.goto('/appointments');

    const table = page.locator('table');
    const approvedRow = table.locator('tr', { hasText: 'Baptism' });
    const pendingRow = table.locator('tr', { hasText: 'Wedding' });

    // Edit shows only on approved appointments
    await expect(approvedRow.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await expect(pendingRow.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);

    await approvedRow.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit appointment' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Cancel appointment/ })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: /Mark celebrated/ })).toBeEnabled();

    // Blank reason is blocked inline and nothing is sent
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    expect(rpcCalls).toHaveLength(0);

    // Whitespace only is also blocked
    await dialog.getByLabel('Reason for cancelling').fill('   ');
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();
    await expect(dialog.getByRole('alert')).toContainText('Please enter a reason');
    expect(rpcCalls).toHaveLength(0);

    // Valid reason sends the RPC and updates the table
    await dialog.getByLabel('Reason for cancelling').fill(CANCEL_REASON);
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([{ p_appointment_id: 'apt-1', p_reason: CANCEL_REASON }]);
    await expect(approvedRow.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(approvedRow.getByText(CANCEL_REASON)).toBeVisible();
    // A cancelled row keeps Edit so the office can restore it (see appointment-restore.spec.ts)
    await expect(approvedRow.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1);
  });

  test('mobile cards show Edit for the office and the cancellation reason afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticateAs(page, 'church_admin');
    const { rpcCalls } = await mockAppointmentEditing(page, MOCK_APPOINTMENTS.slice(0, 2));
    await page.goto('/appointments');

    const editButton = page.getByRole('button', { name: 'Edit', exact: true });
    await expect(editButton).toHaveCount(1);
    await editButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason for cancelling').fill(CANCEL_REASON);
    await dialog.getByRole('button', { name: 'Cancel appointment', exact: true }).last().click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toHaveLength(1);
    // The mobile card follows the (hidden) desktop table in the DOM
    await expect(page.getByText(`Reason: ${CANCEL_REASON}`).last()).toBeVisible();
  });

  test('priests do not see Edit on approved appointments', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockAppointmentEditing(page, MOCK_APPOINTMENTS.slice(0, 2));
    await page.goto('/appointments');

    await expect(page.locator('table').locator('tr', { hasText: 'Baptism' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  });

  test('parishioner card shows Cancelled with the reason and no Edit button', async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    const cancelled: MockAppointment = {
      ...MOCK_APPOINTMENTS[0],
      status: 'cancelled',
      cancellation_reason: CANCEL_REASON,
    };
    await mockAppointmentEditing(page, [cancelled]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Baptism' });
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(row.getByText(`Reason: ${CANCEL_REASON}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  });
});

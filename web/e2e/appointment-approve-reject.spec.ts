import { test, expect, type Page } from '@playwright/test';
import { authenticateAs, MOCK_APPOINTMENTS, MOCK_USERS } from './helpers/mockAuth';

type MockAppointment = (typeof MOCK_APPOINTMENTS)[number] & {
  priest_id?: string | null;
  admin_feedback?: string | null;
};

const CHURCH_ADMIN = MOCK_USERS.church_admin;
const FEEDBACK = 'Please bring the baptismal certificate of the godparents.';

/**
 * Stateful appointments REST mock plus mocked approve_appointment and reject_appointment RPCs
 * (database functions cannot run in mocked e2e). The RPC payloads are recorded and the mock applies
 * the status change the way the functions do. The parishioner and celebrant notifications and the
 * Appointment Change row are written inside the functions, so the browser must never write to
 * appointments or notifications itself: every non-GET request to those tables is recorded.
 */
async function mockApproveReject(page: Page, initial: MockAppointment[]) {
  const state: MockAppointment[] = initial.map((a) => ({ ...a }));
  const rpcCalls: Array<{ fn: 'approve_appointment' | 'reject_appointment'; payload: Record<string, unknown> }> = [];
  const directWrites: string[] = [];

  page.on('request', (request) => {
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    if (isWrite && /\/rest\/v1\/(notifications|appointments)(\?|$)/.test(request.url())) {
      directWrites.push(`${request.method()} ${request.url()}`);
    }
  });

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

  await page.route('**/rest/v1/rpc/approve_appointment', async (route) => {
    const payload = route.request().postDataJSON() as {
      p_appointment_id: string;
      p_priest_id: string | null;
      p_admin_feedback: string | null;
    };
    rpcCalls.push({ fn: 'approve_appointment', payload });
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) {
      target.status = 'approved';
      target.priest_id = payload.p_priest_id;
      target.admin_feedback = payload.p_admin_feedback;
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/rest/v1/rpc/reject_appointment', async (route) => {
    const payload = route.request().postDataJSON() as { p_appointment_id: string; p_admin_feedback: string | null };
    rpcCalls.push({ fn: 'reject_appointment', payload });
    const target = state.find((a) => a.id === payload.p_appointment_id);
    if (target) target.status = 'rejected';
    return route.fulfill({ status: 204, body: '' });
  });

  return { rpcCalls, directWrites };
}

const pendingWedding = () => ({ ...MOCK_APPOINTMENTS[1] }) as MockAppointment;

test.describe('Appointment approval: office approves or rejects a pending request through database functions', () => {
  test('approves without a celebrant through approve_appointment', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockApproveReject(page, [pendingWedding()]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Wedding' });
    await row.getByRole('button', { name: 'Approve', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Approve Sacramental Appointment' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([
      {
        fn: 'approve_appointment',
        payload: { p_appointment_id: 'apt-2', p_priest_id: null, p_admin_feedback: null },
      },
    ]);
    await expect(row.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    expect(directWrites).toEqual([]);
  });

  test('approves with a celebrant and an office note', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockApproveReject(page, [pendingWedding()]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Wedding' });
    await row.getByRole('button', { name: 'Approve', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('#celebrant-select').selectOption(CHURCH_ADMIN.id);
    await dialog.getByLabel(/Admin Instructions/).first().fill(FEEDBACK);
    await dialog.getByRole('button', { name: 'Approve Appointment' }).click();

    await expect(dialog).toHaveCount(0);
    expect(rpcCalls).toEqual([
      {
        fn: 'approve_appointment',
        payload: { p_appointment_id: 'apt-2', p_priest_id: CHURCH_ADMIN.id, p_admin_feedback: FEEDBACK },
      },
    ]);
    // Notifications to the parishioner and the assigned celebrant come from the function only
    expect(directWrites).toEqual([]);
  });

  test('rejects through reject_appointment', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    const { rpcCalls, directWrites } = await mockApproveReject(page, [pendingWedding()]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Wedding' });
    await row.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, Reject' }).click();

    await expect(page.getByRole('button', { name: 'Yes, Reject' })).toHaveCount(0);
    expect(rpcCalls).toEqual([
      { fn: 'reject_appointment', payload: { p_appointment_id: 'apt-2', p_admin_feedback: null } },
    ]);
    await expect(row.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
    expect(directWrites).toEqual([]);
  });

  test('the approve and reject actions are offered only for pending requests', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockApproveReject(page, [MOCK_APPOINTMENTS[0] as MockAppointment, pendingWedding()]);
    await page.goto('/appointments');

    const table = page.locator('table');
    const approved = table.locator('tr', { hasText: 'Baptism' });
    await expect(approved.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await expect(approved.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
    const pending = table.locator('tr', { hasText: 'Wedding' });
    await expect(pending.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    await expect(pending.getByRole('button', { name: 'Reject', exact: true })).toBeVisible();
  });

  test('priests are not offered approve or reject (office only)', async ({ page }) => {
    await authenticateAs(page, 'priest');
    await mockApproveReject(page, [pendingWedding()]);
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Wedding' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
  });

  test('shows an error and keeps the request pending when the database refuses the approval', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockApproveReject(page, [pendingWedding()]);
    await page.route('**/rest/v1/rpc/approve_appointment', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: '42501', message: 'Only the parish office can approve this appointment', details: null, hint: null }),
      });
    });
    const alerts: string[] = [];
    page.on('dialog', async (d) => {
      alerts.push(d.message());
      await d.accept();
    });
    await page.goto('/appointments');

    const row = page.locator('table').locator('tr', { hasText: 'Wedding' });
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve Appointment' }).click();

    await expect.poll(() => alerts).toEqual(['Failed to save appointment changes']);
    await expect(row.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  });

  test('the change history shows approve and reject entries with before and after status', async ({ page }) => {
    await authenticateAs(page, 'church_admin');
    await mockApproveReject(page, [MOCK_APPOINTMENTS[0] as MockAppointment]);
    await page.route('**/rest/v1/appointment_changes*', async (route) => {
      const rows = [
        {
          id: 'chg-2',
          appointment_id: 'apt-1',
          action: 'approve',
          reason: FEEDBACK,
          before_values: { status: 'pending' },
          after_values: { status: 'approved', priest_id: CHURCH_ADMIN.id },
          changed_by: CHURCH_ADMIN.id,
          created_at: '2026-06-01T09:00:00Z',
        },
        {
          id: 'chg-1',
          appointment_id: 'apt-1',
          action: 'reject',
          reason: null,
          before_values: { status: 'pending' },
          after_values: { status: 'rejected' },
          changed_by: CHURCH_ADMIN.id,
          created_at: '2026-05-31T09:00:00Z',
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-1/2' },
        body: JSON.stringify(rows),
      });
    });
    await page.goto('/appointments');

    await page.locator('table').locator('tr', { hasText: 'Baptism' }).getByRole('button', { name: 'Edit', exact: true }).click();
    const items = page.getByRole('dialog').locator('ol > li');
    await expect(items.nth(0)).toContainText('Approved');
    await expect(items.nth(0)).toContainText('Pending → Approved');
    await expect(items.nth(0)).toContainText(`Note: ${FEEDBACK}`);
    await expect(items.nth(1)).toContainText('Rejected');
    await expect(items.nth(1)).toContainText('Pending → Rejected');
  });
});

import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Priest Ministry Suite & Celebrant Hub', () => {

  test.describe('1. Dedicated Priest Celebrant Sanctuary (/dashboard)', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'priest');
      await page.goto('/dashboard');
    });

    test('should render Clergy Greeting with liturgical season and action button', async ({ page }) => {
      // 1. Time-of-day Filipino greeting with the priest's first name
      await expect(page.getByRole('heading', { name: /Magandang (umaga|hapon|gabi), Fr\. Juan/i })).toBeVisible();

      // 2. Liturgical season week & vestment color pills
      await expect(page.getByText(/· Week \d+|Christmas|Holy Week|Paschal Triduum|Pentecost|Lent/).first()).toBeVisible();
      await expect(page.getByText(/vestments/i)).toBeVisible();

      // 3. Action button in header
      const setAvailBtn = page.getByRole('button', { name: /Set availability and leave/i });
      await expect(setAvailBtn).toBeVisible();
    });

    test('should render the three celebrant ministerial stat cards', async ({ page }) => {
      await expect(page.getByText('Presiding today')).toBeVisible();
      await expect(page.getByText('This week')).toBeVisible();
      await expect(page.getByText('Celebrated this year')).toBeVisible();
    });

    test('should render 2-column celebrant layout with liturgical schedule and companion cards', async ({ page }) => {
      // Left Column: Today's celebrations timeline
      await expect(page.getByRole('heading', { name: /Today's celebrations/i })).toBeVisible();

      // Right Column: Availability and rota card
      await expect(page.getByRole('heading', { name: /Availability and rota/i })).toBeVisible();
      await expect(page.getByText(/Every Monday/i)).toBeVisible();
      await expect(page.getByText(/Diocesan Clergy Annual Retreat/i)).toBeVisible();

      // Right Column: Daily verse with ministry note
      await expect(page.getByText(/For your ministry today/i)).toBeVisible();

      // Right Column: Parish bulletin
      await expect(page.getByRole('heading', { name: /Parish bulletin/i })).toBeVisible();

      // Full width: Upcoming sacramental ministry
      await expect(page.getByRole('heading', { name: /Upcoming sacramental ministry/i })).toBeVisible();
    });

    test('should filter upcoming sacramental ministry by sacrament chip and search query', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/Search by name, sacrament or notes/i);
      await expect(searchInput).toBeVisible();
      await searchInput.fill('Baptism');

      const baptismChip = page.getByRole('group', { name: /Filter by sacrament/i }).getByRole('button', { name: /^Baptism/ });
      await baptismChip.click();
      await expect(baptismChip).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('2. Celebrant Attention Queue Widget', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'priest');
      await page.goto('/dashboard');
    });

    test('should triage mocked pastoral and pre-nuptial requests into the attention queue', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Needs celebrant attention/i })).toBeVisible();
      await expect(page.getByText('Pre-nuptial inquiry').first()).toBeVisible();
      await expect(page.getByText('Pastoral counseling').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Review request/i }).first()).toBeVisible();
    });
  });

  test.describe('3. Priest Availability & Leave Management Modal', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'priest');
      await page.goto('/dashboard');
    });

    test('should open Availability & Leave modal and interact with rest day & leave fields', async ({ page }) => {
      // Open modal via header button
      const openBtn = page.getByRole('button', { name: /Set availability and leave/i }).first();
      await openBtn.click();

      // Verify Modal Title
      await expect(page.getByRole('heading', { name: /Clergy Availability & Rota Management/i })).toBeVisible();

      // Verify Weekly Rest Day selector
      await expect(page.locator('#day-off-select')).toBeVisible();

      // Verify Blackout Dates section
      await expect(page.getByText(/Schedule New Leave \/ Retreat Period/i)).toBeVisible();
      await expect(page.getByText(/Start Date/i)).toBeVisible();
      await expect(page.getByText(/End Date/i)).toBeVisible();

      // Close modal
      const closeBtn = page.getByRole('button', { name: /Close/i }).last();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
    });
  });

  test.describe('4. Smart Canon 905 Conflict Solver & Appointments Access', () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAs(page, 'church_admin');
      await page.goto('/appointments');
    });

    test('should render Appointments management page for church administrator', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Appointments/i })).toBeVisible();
      await expect(page.getByText(/San Sebastian Cathedral/i).first()).toBeVisible();
    });
  });

});

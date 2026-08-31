import { test, expect } from '@playwright/test';
import { authenticateAs } from './helpers/mockAuth';

test.describe('Smart Cross-Parish Availability & Nearby Recommender', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'parishioner');
    await page.goto('/churches/church-1/book');
  });

  test('should render booking form for San Sebastian Cathedral', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Book an Appointment/i })).toBeVisible();
    await expect(page.getByText(/San Sebastian Cathedral/i).first()).toBeVisible();
    await expect(page.getByLabel(/Service Type/i)).toBeVisible();
    await expect(page.getByLabel(/Preferred Date/i)).toBeVisible();
    await expect(page.getByLabel(/Preferred Time/i)).toBeVisible();
  });

  test('should detect slot collision and render Smart Recommendations section with dual cards', async ({ page }) => {
    // Fill in a colliding slot (church-1 has an appointment on 2026-09-15 at 10:00 AM)
    const dateInput = page.getByLabel(/Preferred Date/i);
    const timeInput = page.getByLabel(/Preferred Time/i);

    await dateInput.fill('2026-09-15');
    await timeInput.fill('10:00');

    // Verify the smart recommendations section appears
    const recSection = page.getByTestId('smart-recommendations-section');
    await expect(recSection).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Selected Slot Unavailable/i)).toBeVisible();
    await expect(page.getByText(/Recommended Smart Alternatives/i)).toBeVisible();

    // Verify Card A (Same Church alternative) is rendered
    const sameChurchCard = page.getByTestId('recommendation-card-same-church');
    await expect(sameChurchCard).toBeVisible();
    await expect(sameChurchCard.getByRole('button', { name: /Select This Slot/i })).toBeVisible();

    // Verify Card B (Nearby Parish alternative with Haversine distance) is rendered
    const nearbyCard = page.getByTestId('recommendation-card-nearby-church');
    await expect(nearbyCard).toBeVisible();
    await expect(nearbyCard.getByText('Queen of Peace Parish')).toBeVisible();

    // Verify Haversine distance badge is rendered with formatted km
    const distanceBadge = page.getByTestId('nearby-church-distance-badge');
    await expect(distanceBadge).toBeVisible();
    await expect(distanceBadge).toHaveText(/km away/i);

    // Verify submit button indicates slot unavailability
    const submitBtn = page.getByRole('button', { name: /Slot Unavailable/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('should seamlessly update form date and time when selecting Card A (Same Church Slot)', async ({ page }) => {
    const dateInput = page.getByLabel(/Preferred Date/i);
    const timeInput = page.getByLabel(/Preferred Time/i);

    await dateInput.fill('2026-09-15');
    await timeInput.fill('10:00');

    const recSection = page.getByTestId('smart-recommendations-section');
    await expect(recSection).toBeVisible({ timeout: 5000 });

    // Click "Select This Slot" on Card A
    const sameChurchCard = page.getByTestId('recommendation-card-same-church');
    const selectSlotBtn = sameChurchCard.getByRole('button', { name: /Select This Slot/i });
    await selectSlotBtn.click();

    // The time input should now be updated to the alternative slot (e.g. 11:00)
    await expect(timeInput).not.toHaveValue('10:00');

    // The conflict banner should disappear and submit button becomes enabled
    await expect(recSection).not.toBeVisible({ timeout: 5000 });
    const submitBtn = page.getByRole('button', { name: /Submit Request/i });
    await expect(submitBtn).toBeEnabled();
  });

  test('should seamlessly switch parish context when selecting Card B (Nearest Alternative Parish)', async ({ page }) => {
    const dateInput = page.getByLabel(/Preferred Date/i);
    const timeInput = page.getByLabel(/Preferred Time/i);

    await dateInput.fill('2026-09-15');
    await timeInput.fill('10:00');

    const recSection = page.getByTestId('smart-recommendations-section');
    await expect(recSection).toBeVisible({ timeout: 5000 });

    // Click "Select This Parish" on Card B
    const nearbyCard = page.getByTestId('recommendation-card-nearby-church');
    const selectParishBtn = nearbyCard.getByRole('button', { name: /Select This Parish/i });
    await selectParishBtn.click();

    // URL should transition to church-2 booking page
    await expect(page).toHaveURL(/\/churches\/church-2\/book/);

    // Church name heading/text should reflect Queen of Peace Parish
    await expect(page.getByText(/Queen of Peace Parish/i).first()).toBeVisible();

    // Form retains the requested date and time
    await expect(dateInput).toHaveValue('2026-09-15');
    await expect(timeInput).toHaveValue('10:00');

    // At church-2, this slot is available so no conflict is shown
    await expect(page.getByRole('button', { name: /Submit Request/i })).toBeVisible();
  });
});

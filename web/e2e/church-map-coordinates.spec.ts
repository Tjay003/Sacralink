import { test, expect } from '@playwright/test';
import { authenticateAs, setupSupabaseMocks, MOCK_CHURCHES } from './helpers/mockAuth';

test.describe('Ticket 02: Interactive Parish Map & Coordinate Storage', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, 'super_admin');

    // Intercept Nominatim geocoding API with glob pattern
    await page.route('**/*nominatim.openstreetmap.org/search*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            place_id: 101,
            display_name: 'San Jose del Monte City Hall, Bulacan, Central Luzon, Philippines',
            lat: '14.814000',
            lon: '121.046000',
            type: 'city_hall',
          },
          {
            place_id: 102,
            display_name: 'St. Joseph the Worker Parish, CSJDM, Bulacan, Philippines',
            lat: '14.815500',
            lon: '121.047500',
            type: 'church',
          },
        ]),
      });
    });

    await page.route('**/*nominatim.openstreetmap.org/reverse*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          place_id: 201,
          display_name: 'CSJDM Parish Center, San Jose del Monte, Bulacan, Philippines',
        }),
      });
    });
  });

  test('should render the Leaflet map and coordinate inputs in AddChurchPage', async ({ page }) => {
    await page.goto('/churches/add');

    // Heading
    await expect(page.getByRole('heading', { name: 'Add New Church' })).toBeVisible();

    // Map section & controls
    await expect(page.getByText('Parish Map Location & Coordinates')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByRole('button', { name: /Center CSJDM/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use Current GPS/i })).toBeVisible();

    // Coordinate inputs
    const latInput = page.locator('input[placeholder="e.g., 14.813500"]');
    const lngInput = page.locator('input[placeholder="e.g., 121.045300"]');
    await expect(latInput).toBeVisible();
    await expect(lngInput).toBeVisible();
  });

  test('should geocode address queries and update coordinates', async ({ page }) => {
    await page.goto('/churches/add');

    const searchInput = page.locator('input[placeholder*="Search church address"]');
    await expect(searchInput).toBeVisible();

    // Type query and search
    await searchInput.fill('St. Joseph the Worker');
    await page.getByRole('button', { name: /Search Location/i }).click();

    // Wait for dropdown item
    const parishItem = page.getByRole('button', { name: /St. Joseph the Worker Parish/i }).first();
    await expect(parishItem).toBeVisible();

    // Select result
    await parishItem.click();

    // Verify coordinate inputs updated to the geocoded location
    const latInput = page.locator('input[placeholder="e.g., 14.813500"]');
    const lngInput = page.locator('input[placeholder="e.g., 121.045300"]');
    await expect(latInput).toHaveValue('14.815500');
    await expect(lngInput).toHaveValue('121.047500');

    // Verify pin badge
    await expect(page.getByText(/PIN SET: 14.8155, 121.0475/i)).toBeVisible();
  });

  test('should allow manual coordinate entry and fine-tuning', async ({ page }) => {
    await page.goto('/churches/add');

    const latInput = page.locator('input[placeholder="e.g., 14.813500"]');
    const lngInput = page.locator('input[placeholder="e.g., 121.045300"]');

    await latInput.fill('14.825000');
    await lngInput.fill('121.060000');
    await page.getByRole('button', { name: /Apply Coordinates/i }).click();

    // Verify pin badge updated with applied coordinates
    await expect(page.getByText(/PIN SET: 14.8250, 121.0600/i)).toBeVisible();
  });

  test('should pre-load existing coordinates when editing a church', async ({ page }) => {
    await page.goto('/churches/church-1/edit');

    await expect(page.getByRole('heading', { name: 'Edit Church' })).toBeVisible();

    // Check pre-loaded values from MOCK_CHURCHES (church-1: lat 14.8135, lng 121.0453)
    const latInput = page.locator('input[placeholder="e.g., 14.813500"]');
    const lngInput = page.locator('input[placeholder="e.g., 121.045300"]');

    await expect(latInput).toHaveValue('14.813500');
    await expect(lngInput).toHaveValue('121.045300');
    await expect(page.getByText(/PIN SET: 14.8135, 121.0453/i)).toBeVisible();
  });

  test('should submit church form with floating-point coordinates payload', async ({ page }) => {
    let capturedPayload: any = null;

    await authenticateAs(page, 'super_admin');

    // Capture POST payload for churches (registered AFTER authenticateAs so it takes priority)
    await page.route('**/rest/v1/churches*', async (route) => {
      if (route.request().method() === 'POST') {
        capturedPayload = route.request().postDataJSON();
        const newChurchObj = {
          id: 'new-church-id',
          name: 'Our Lady of Lourdes',
          address: 'Tungkong Mangga, CSJDM',
          latitude: 14.8135,
          longitude: 121.0453,
          created_at: '2026-01-01T00:00:00Z',
        };
        const isSingle = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object+json');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(isSingle ? newChurchObj : [newChurchObj]),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CHURCHES),
      });
    });

    await page.goto('/churches/add');

    // Fill form
    await page.locator('input[placeholder="e.g., St. Peter Parish"]').fill('Our Lady of Lourdes');
    await page.locator('textarea[placeholder="Full address of the church"]').fill('Tungkong Mangga, CSJDM');

    // Apply specific coordinates
    const latInput = page.locator('input[placeholder="e.g., 14.813500"]');
    const lngInput = page.locator('input[placeholder="e.g., 121.045300"]');
    await latInput.fill('14.813500');
    await lngInput.fill('121.045300');
    await page.getByRole('button', { name: /Apply Coordinates/i }).click();

    // Submit form and await response
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/rest/v1/churches') && res.request().method() === 'POST'),
      page.getByRole('button', { name: /Create Church/i }).click(),
    ]);

    expect(response.status()).toBe(201);
    expect(capturedPayload).toBeDefined();
    const insertedRecord = Array.isArray(capturedPayload) ? capturedPayload[0] : capturedPayload;
    expect(insertedRecord.latitude).toBe(14.8135);
    expect(insertedRecord.longitude).toBe(121.0453);
    expect(insertedRecord.name).toBe('Our Lady of Lourdes');
  });
});

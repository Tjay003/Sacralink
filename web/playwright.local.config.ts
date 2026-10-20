import { defineConfig, devices } from '@playwright/test';

// Real end-to-end config: a dedicated Vite server in `e2e` mode (web/.env.e2e) talking to the LOCAL
// Supabase stack. Never reuses a server on another port, so it cannot hit the production project.
const PORT = 5174;

export default defineConfig({
  testDir: './e2e-local',
  globalSetup: './e2e-local/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});

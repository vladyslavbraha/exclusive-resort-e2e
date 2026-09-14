import { defineConfig, devices } from '@playwright/test';

// The form posts to a production Pardot handler, so writes are always stubbed in CI (see
// InquiryPage.stubSubmit). BASE_URL lets the same suite target another environment.
const BASE_URL = process.env.BASE_URL ?? 'https://public-site.stage.exclusiveresorts.com';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 45000,
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // CloudFront answers 403 to non-browser agents; a real UA string is required to reach the app.
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  },
  projects: [
    // Functional coverage runs on the two desktop engines the brief asks for.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // The mobile project exists only for the responsive layout check (TC-17). The form renders a
    // separate mobile DOM variant, so the functional specs — written against the desktop form — are
    // intentionally not run here; TC-17 sets its own 375px viewport regardless.
    { name: 'mobile-chromium', use: { ...devices['iPhone SE'] }, grep: /@responsive/ },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import { appDir } from './tests/support/paths';

const PORT = 4173;
// BASE_URL points the suite at any deployed Neblina. Unset, it serves the static export in <app>/out.
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // retries only in CI: locally a flaky test should fail loudly
  workers: 2, // matches the 2-core CI runner and keeps local memory use modest
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx serve "${appDir}/out" -l ${PORT} --no-clipboard`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});

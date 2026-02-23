import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    headless: !!process.env.CI,
    actionTimeout: 15_000,
    navigationTimeout: 90_000,
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});

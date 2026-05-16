import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.visual.js',
  outputDir: 'test-results/visual',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 820, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

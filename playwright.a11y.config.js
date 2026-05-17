import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/a11y',
  testMatch: '**/*.a11y.js',
  outputDir: 'test-results/a11y',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/a11y' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm exec vite -- --host 127.0.0.1 --port 5173',
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
  ],
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.visual.js',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/visual' }]],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.25,
      maxDiffPixelRatio: 0.01,
    },
  },
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

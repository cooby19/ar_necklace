import { expect, test } from '@playwright/test';

const STABLE_MEDIA_CSS = `
  #cameraVideo,
  #threeCanvas,
  #debugCanvas {
    visibility: hidden !important;
  }

  *,
  *::before,
  *::after {
    caret-color: transparent !important;
  }
`;

const SAMPLE_CAPTURE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#fbf8f5"/>
    <circle cx="400" cy="320" r="138" fill="#f1cfd3" opacity="0.72"/>
    <path d="M230 400c42 116 298 116 340 0" fill="none" stroke="#c8a96a" stroke-width="24" stroke-linecap="round"/>
    <circle cx="400" cy="536" r="34" fill="#d9a3aa"/>
  </svg>
`)}`;

async function openStableApp(page) {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('.stage')).toBeVisible();
  await page.locator('.necklace-card').first().waitFor({ state: 'attached' });
  await page.addStyleTag({ content: STABLE_MEDIA_CSS });
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await page.waitForTimeout(200);
}

test('showcase shell remains visually stable', async ({ page }) => {
  await openStableApp(page);

  await expect(page).toHaveScreenshot('showcase-shell.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
  });
});

test('share sheet remains visually stable', async ({ page }) => {
  await openStableApp(page);
  await page.evaluate((sampleCapture) => {
    const shareSheet = document.querySelector('#shareSheet');
    const shareImage = document.querySelector('#shareImage');

    if (!shareSheet || !shareImage) {
      throw new Error('Share sheet elements are missing.');
    }

    shareImage.src = sampleCapture;
    shareSheet.hidden = false;
  }, SAMPLE_CAPTURE);
  await expect(page.locator('.share-card')).toBeVisible();

  await expect(page).toHaveScreenshot('share-sheet.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
  });
});

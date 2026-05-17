import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SAMPLE_CAPTURE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="#fbf8f5"/>
    <circle cx="400" cy="320" r="138" fill="#f1cfd3" opacity="0.72"/>
    <path d="M230 400c42 116 298 116 340 0" fill="none" stroke="#c8a96a" stroke-width="24" stroke-linecap="round"/>
    <circle cx="400" cy="536" r="34" fill="#d9a3aa"/>
  </svg>
`)}`;

async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('.stage')).toBeVisible();
  await page.locator('.necklace-card').first().waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
}

async function expectNoA11yViolations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

function formatViolations(violations) {
  if (!violations.length) return '';

  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `    - ${node.target.join(', ')}: ${node.failureSummary ?? 'No summary'}`)
        .join('\n');
      return `${violation.id} (${violation.impact}) ${violation.help}\n${nodes}`;
    })
    .join('\n\n');
}

test('showcase initial screen has no critical accessibility violations', async ({ page }) => {
  await openApp(page);

  await expectNoA11yViolations(page);
});

test('share sheet state has no critical accessibility violations', async ({ page }) => {
  await openApp(page);
  await page.evaluate((sampleCapture) => {
    const shareSheet = document.querySelector('#shareSheet');
    const shareImage = document.querySelector('#shareImage');
    const experienceColumn = document.querySelector('.experience-column');
    const controls = document.querySelector('.controls');
    const closeButton = document.querySelector('.share-card [data-close-share]');

    if (!shareSheet || !shareImage || !experienceColumn || !controls || !closeButton) {
      throw new Error('Share sheet test state is missing required elements.');
    }

    shareImage.src = sampleCapture;
    shareSheet.hidden = false;

    [experienceColumn, controls].forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });

    closeButton.focus({ preventScroll: true });
  }, SAMPLE_CAPTURE);
  await expect(page.locator('.share-card')).toBeVisible();

  await expectNoA11yViolations(page);
});

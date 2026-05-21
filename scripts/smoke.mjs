import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredBaseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL ?? process.argv[2]);
const shouldCheckResponseHeaders = Boolean(configuredBaseUrl);
const previewPort = Number(process.env.SMOKE_PREVIEW_PORT ?? 4174);
const baseUrl = configuredBaseUrl || `http://127.0.0.1:${previewPort}/`;
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA ?? '';
const expectedVersion = process.env.EXPECTED_VERSION ?? '';
const checks = [];

if (!configuredBaseUrl && !existsSync(path.join(rootDir, 'dist/index.html'))) {
  throw new Error('Missing dist/index.html. Run npm run build before npm run smoke.');
}

const previewServer = configuredBaseUrl ? null : startPreviewServer();
let browser;

try {
  await waitForUrl(baseUrl, previewServer);
  await checkHtmlAndBuiltAssets();
  await checkReleaseMetadata();
  await checkGlbAsset('models/necklace.glb');
  await checkMediapipeAssets();
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  await checkBrowserExperience(browser);

  console.log(`Synthetic smoke checks passed for ${baseUrl}`);
  checks.forEach((check) => console.log(`ok   ${check}`));
} finally {
  if (browser) await browser.close();
  if (previewServer) stopPreviewServer(previewServer);
}

async function checkHtmlAndBuiltAssets() {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`${baseUrl} returned HTTP ${response.status}.`);
  }

  if (shouldCheckResponseHeaders) {
    assertSecurityHeaders(response.headers);
    assertNoCacheHeader(response.headers, 'index.html');
    checks.push('security headers present on index.html');
    checks.push('index.html cache policy requires revalidation');
  }

  const html = await response.text();
  checks.push('index.html reachable');

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => match[1]);
  if (!assetPaths.length) {
    throw new Error('No built JS/CSS assets found in index.html.');
  }

  for (const assetPath of assetPaths) {
    const assetResponse = await assertHeadOrGet(new URL(assetPath, baseUrl));
    if (shouldCheckResponseHeaders) {
      assertLongLivedCache(assetResponse.headers, `built asset ${assetPath}`);
    }
    checks.push(`built asset reachable: ${assetPath}`);
  }
}

async function checkReleaseMetadata() {
  const releaseUrl = new URL('release.json', baseUrl);
  const response = await fetch(releaseUrl);
  if (!response.ok) {
    throw new Error(`${releaseUrl} returned HTTP ${response.status}.`);
  }

  if (shouldCheckResponseHeaders) {
    assertNoCacheHeader(response.headers, 'release.json');
    checks.push('release.json cache policy requires revalidation');
  }

  const metadata = JSON.parse(await response.text());
  checks.push('release.json reachable');

  for (const key of ['version', 'commitSha', 'buildTime', 'environment']) {
    if (!metadata[key]) {
      throw new Error(`release.json is missing ${key}.`);
    }
  }

  if (expectedVersion && metadata.version !== expectedVersion) {
    throw new Error(`Version mismatch: expected ${expectedVersion}, received ${metadata.version}.`);
  }

  if (expectedCommitSha && !metadata.commitSha.startsWith(expectedCommitSha)) {
    throw new Error(`Commit mismatch: expected ${expectedCommitSha}, received ${metadata.commitSha}.`);
  }

  checks.push(`release metadata present: v${metadata.version} ${metadata.commitSha.slice(0, 12)}`);
}

async function checkGlbAsset(assetPath) {
  const url = new URL(assetPath, baseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  if (shouldCheckResponseHeaders) {
    assertLongLivedCache(response.headers, assetPath);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 20) {
    throw new Error(`${assetPath} is too small to be a valid GLB.`);
  }

  const bytes = new Uint8Array(buffer, 0, 12);
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  const view = new DataView(buffer);
  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);

  if (magic !== 'glTF') {
    throw new Error(`${assetPath} has invalid GLB magic header: ${magic}.`);
  }

  if (version !== 2) {
    throw new Error(`${assetPath} is GLB version ${version}; expected glTF 2.0.`);
  }

  if (declaredLength !== buffer.byteLength) {
    throw new Error(`${assetPath} declared ${declaredLength} bytes but returned ${buffer.byteLength} bytes.`);
  }

  checks.push(`GLB header valid: ${assetPath}`);
}

async function checkMediapipeAssets() {
  const assets = [
    'vendor/mediapipe/face_mesh/face_mesh.binarypb',
    'vendor/mediapipe/face_mesh/face_mesh.js',
    'vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets.data',
    'vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js',
    'vendor/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js',
    'vendor/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm',
  ];

  for (const asset of assets) {
    const response = await assertHeadOrGet(new URL(asset, baseUrl));
    if (shouldCheckResponseHeaders) {
      assertLongLivedCache(response.headers, asset);
    }
    checks.push(`MediaPipe asset reachable: ${asset}`);
  }
}

async function checkBrowserExperience(browserInstance) {
  const page = await browserInstance.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForVisible(page, '#app');
  await waitForVisible(page, '.stage');
  await page.waitForFunction(() => window.__AR_NECKLACE_RELEASE__?.version);
  await assertReleaseMetadataExposed(page);
  await waitForVisible(page, '.necklace-card');
  await waitForVisible(page, '#threeCanvas');
  await assertShowcaseCanvasVisible(page);
  checks.push('showcase canvas visible');

  await clickNecklaceCard(page);
  await clickColorSwatch(page);
  await toggleDebug(page);
  await openAndCloseShareSheet(page);

  if (pageErrors.length || consoleErrors.length) {
    throw new Error(
      [
        ...pageErrors.map((message) => `pageerror: ${message}`),
        ...consoleErrors.map((message) => `console error: ${message}`),
      ].join('\n'),
    );
  }

  await page.close();
}

async function assertReleaseMetadataExposed(page) {
  const metadata = await page.evaluate(() => window.__AR_NECKLACE_RELEASE__);
  const reporting = await page.evaluate(() => window.__AR_NECKLACE_ERROR_REPORTING__);

  for (const key of ['version', 'commitSha', 'buildTime', 'environment']) {
    if (!metadata?.[key]) {
      throw new Error(`window.__AR_NECKLACE_RELEASE__ is missing ${key}.`);
    }
  }

  if (!reporting || typeof reporting.enabled !== 'boolean') {
    throw new Error('window.__AR_NECKLACE_ERROR_REPORTING__ is missing public status.');
  }

  checks.push('release and reporting metadata exposed');
}

async function assertShowcaseCanvasVisible(page) {
  const box = await page.locator('#threeCanvas').boundingBox();
  if (!box || box.width < 240 || box.height < 240) {
    throw new Error(`Showcase canvas is not large enough: ${JSON.stringify(box)}.`);
  }

  const style = await page.locator('#threeCanvas').evaluate((canvas) => {
    const computed = window.getComputedStyle(canvas);
    return {
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
    };
  });

  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0) {
    throw new Error(`Showcase canvas is hidden: ${JSON.stringify(style)}.`);
  }
}

async function clickNecklaceCard(page) {
  const card = page.locator('.necklace-card').first();
  await card.click();

  const selected = await card.evaluate((element) => ({
    classSelected: element.classList.contains('is-selected'),
    ariaChecked: element.getAttribute('aria-checked'),
  }));

  if (!selected.classSelected || selected.ariaChecked !== 'true') {
    throw new Error('Necklace card did not enter selected state.');
  }

  checks.push('necklace card interaction works');
}

async function clickColorSwatch(page) {
  await page.waitForFunction(() => {
    const container = document.querySelector('#colorSwatches');
    return container && !container.hasAttribute('hidden') && container.querySelector('[data-color-id]');
  });

  const swatches = page.locator('#colorSwatches [data-color-id]');
  const count = await swatches.count();
  if (count < 2) {
    throw new Error(`Expected at least two color swatches, found ${count}.`);
  }

  const swatch = swatches.nth(1);
  await swatch.click();
  const selected = await swatch.evaluate((element) => ({
    classSelected: element.classList.contains('is-selected'),
    ariaChecked: element.getAttribute('aria-checked'),
  }));

  if (!selected.classSelected || selected.ariaChecked !== 'true') {
    throw new Error('Color swatch did not enter selected state.');
  }

  checks.push('color swatch interaction works');
}

async function toggleDebug(page) {
  await page.locator('[data-mode="ar"]').first().click();
  await waitForVisible(page, '.debug-tool-toggle');
  await page.locator('.debug-tool-toggle').click();

  const isChecked = await page.locator('#debugToggle').isChecked();
  const developerPanelVisible = await page.locator('#developerPanel').isVisible();
  if (!isChecked || !developerPanelVisible) {
    throw new Error('Debug toggle did not expose the developer panel.');
  }

  checks.push('debug toggle interaction works without camera permission');
}

async function openAndCloseShareSheet(page) {
  const sampleCapture = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#fbf8f5"/>
      <path d="M230 400c42 116 298 116 340 0" fill="none" stroke="#c8a96a" stroke-width="24"/>
    </svg>
  `)}`;

  await page.evaluate((captureUrl) => {
    const shareSheet = document.querySelector('#shareSheet');
    const shareImage = document.querySelector('#shareImage');
    if (!shareSheet || !shareImage) {
      throw new Error('Share sheet elements are missing.');
    }

    shareImage.src = captureUrl;
    shareSheet.hidden = false;
  }, sampleCapture);

  await waitForVisible(page, '.share-card');
  await page.locator('.share-card [data-close-share]').click();
  await page.waitForFunction(() => document.querySelector('#shareSheet')?.hidden === true);
  checks.push('share sheet basic interaction works without camera permission');
}

async function waitForVisible(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 30000 });
}

async function assertHeadOrGet(url) {
  let response = await fetch(url, { method: 'HEAD' });
  if (response.status === 405 || response.status === 403) {
    response = await fetch(url);
  }

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  return response;
}

function assertSecurityHeaders(headers) {
  const csp = headers.get('content-security-policy');
  if (!csp) {
    throw new Error('index.html is missing Content-Security-Policy.');
  }

  const normalizedCsp = csp.toLowerCase();
  for (const directive of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
    if (!normalizedCsp.includes(directive)) {
      throw new Error(`Content-Security-Policy is missing directive: ${directive}`);
    }
  }

  const permissionsPolicy = headers.get('permissions-policy');
  if (!permissionsPolicy) {
    throw new Error('index.html is missing Permissions-Policy.');
  }

  if (!/camera=\(self\)/i.test(permissionsPolicy.replace(/\s+/g, ''))) {
    throw new Error(`Permissions-Policy does not allow same-origin camera access: ${permissionsPolicy}`);
  }
}

function assertNoCacheHeader(headers, label) {
  const cacheControl = headers.get('cache-control') ?? '';
  const normalized = cacheControl.toLowerCase();
  if (!normalized.includes('no-cache') || !normalized.includes('must-revalidate')) {
    throw new Error(`${label} should require revalidation, received Cache-Control: ${cacheControl || '(missing)'}`);
  }
}

function assertLongLivedCache(headers, label) {
  const cacheControl = headers.get('cache-control') ?? '';
  const normalized = cacheControl.toLowerCase();
  const maxAge = parseMaxAge(normalized);

  if (!normalized.includes('public') || !normalized.includes('immutable') || maxAge < 31536000) {
    throw new Error(`${label} should be long-lived immutable cache, received Cache-Control: ${cacheControl || '(missing)'}`);
  }
}

function parseMaxAge(cacheControl) {
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/);
  return match ? Number(match[1]) : 0;
}

function startPreviewServer() {
  const output = [];
  const child = spawn(
    'npm',
    ['exec', 'vite', '--', 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    {
      cwd: rootDir,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.smokeOutput = output;

  child.stdout.on('data', (chunk) => {
    output.push(String(chunk));
    if (process.env.SMOKE_DEBUG) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output.push(String(chunk));
    if (process.env.SMOKE_DEBUG) process.stderr.write(chunk);
  });

  return child;
}

async function waitForUrl(url, child = null) {
  const deadline = Date.now() + 120000;
  let lastError;

  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      const output = child.smokeOutput?.join('').trim();
      throw new Error(`Vite preview exited with code ${child.exitCode} before ${url} became reachable.${output ? `\n${output}` : ''}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function stopPreviewServer(child) {
  if (!child.killed) child.kill('SIGTERM');
}

function normalizeBaseUrl(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(rootDir, 'lighthouse-report');
const previewPort = Number(process.env.LIGHTHOUSE_PREVIEW_PORT ?? 4173);
const previewUrl = `http://127.0.0.1:${previewPort}/`;
const thresholds = {
  performance: 0.45,
  accessibility: 0.85,
  'best-practices': 0.85,
  seo: 0.7,
};

if (!existsSync(path.join(rootDir, 'dist/index.html'))) {
  throw new Error('Missing dist/index.html. Run npm run build before npm run lighthouse.');
}

const previewServer = startPreviewServer();
let chrome;

try {
  await waitForUrl(previewUrl);
  chrome = await chromeLauncher.launch({
    chromePath: resolveChromePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const result = await lighthouse(previewUrl, {
    port: chrome.port,
    output: ['json', 'html'],
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttlingMethod: 'provided',
  });

  await writeReports(result.report);
  checkScores(result.lhr.categories);
} finally {
  if (chrome) await chrome.kill();
  stopPreviewServer(previewServer);
}

function startPreviewServer() {
  const child = spawn(
    'npm',
    ['exec', 'vite', '--', 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    {
      cwd: rootDir,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.on('data', (chunk) => {
    if (process.env.LIGHTHOUSE_DEBUG) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    if (process.env.LIGHTHOUSE_DEBUG) process.stderr.write(chunk);
  });

  return child;
}

async function waitForUrl(url) {
  const deadline = Date.now() + 120000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for Vite preview at ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const playwrightChromePath = chromium.executablePath();
  return existsSync(playwrightChromePath) ? playwrightChromePath : undefined;
}

async function writeReports(report) {
  const reports = Array.isArray(report) ? report : [report];
  await mkdir(reportDir, { recursive: true });

  if (reports[0]) {
    await writeFile(path.join(reportDir, 'showcase.json'), reports[0]);
  }

  if (reports[1]) {
    await writeFile(path.join(reportDir, 'showcase.html'), reports[1]);
  }
}

function checkScores(categories) {
  const failures = [];

  console.log('Lighthouse report');
  Object.entries(thresholds).forEach(([categoryId, minimum]) => {
    const score = categories[categoryId]?.score ?? 0;
    const status = score >= minimum ? 'ok' : 'fail';
    console.log(`${status.padEnd(4)} ${categoryId.padEnd(15)} ${(score * 100).toFixed(0)} / ${(minimum * 100).toFixed(0)}`);

    if (score < minimum) {
      failures.push(`${categoryId}: ${(score * 100).toFixed(0)} < ${(minimum * 100).toFixed(0)}`);
    }
  });

  if (failures.length) {
    throw new Error(`Lighthouse thresholds failed: ${failures.join(', ')}`);
  }
}

function stopPreviewServer(child) {
  if (!child.killed) child.kill('SIGTERM');
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

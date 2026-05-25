const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL ?? process.argv[2]);
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA ?? '';
const expectedVersion = process.env.EXPECTED_VERSION ?? '';

if (!baseUrl) {
  throw new Error('Missing SMOKE_BASE_URL. Usage: SMOKE_BASE_URL=https://example.com/ npm run smoke:release');
}

const checks = [];

await checkReleaseMetadata();
await checkHtmlAndBuiltAssets();
await checkGlbAsset('models/necklace.draco.glb');
await checkPublicAsset('draco/draco_wasm_wrapper.js');
await checkPublicAsset('draco/draco_decoder.wasm', { requireWasmMimeType: true });
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh.binarypb');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh.js');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets.data');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm');

console.log(`Smoke checks passed for ${baseUrl}`);
checks.forEach((check) => console.log(`ok   ${check}`));

async function checkHtmlAndBuiltAssets() {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`${baseUrl} returned HTTP ${response.status}.`);
  }

  assertSecurityHeaders(response.headers);
  assertNoCacheHeader(response.headers, 'index.html');
  checks.push('security headers present on index.html');
  checks.push('index.html cache policy requires revalidation');

  const html = await response.text();
  checks.push('index.html reachable');

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => match[1]);
  if (!assetPaths.length) {
    throw new Error('No built assets found in index.html.');
  }

  for (const assetPath of assetPaths) {
    const response = await assertHeadOrGet(new URL(assetPath, baseUrl));
    assertLongLivedCache(response.headers, `built asset ${assetPath}`);
    checks.push(`built asset reachable: ${assetPath}`);
  }
}

async function checkReleaseMetadata() {
  const releaseUrl = new URL('release.json', baseUrl);
  const { response, metadata } = await fetchExpectedReleaseMetadata(releaseUrl);

  assertNoCacheHeader(response.headers, 'release.json');
  checks.push('release.json cache policy requires revalidation');

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

  checks.push(`release metadata matches v${metadata.version} ${metadata.commitSha.slice(0, 12)}`);
}

async function fetchExpectedReleaseMetadata(url) {
  const deadline = Date.now() + 120000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const requestUrl = new URL(url);
      requestUrl.searchParams.set('smoke', String(Date.now()));
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}.`);
      }

      const metadata = JSON.parse(await response.text());
      if (!expectedCommitSha || metadata.commitSha?.startsWith(expectedCommitSha)) {
        return { response, metadata };
      }

      lastError = new Error(`Commit mismatch: expected ${expectedCommitSha}, received ${metadata.commitSha}.`);
    } catch (error) {
      lastError = error;
    }

    await delay(2000);
  }

  throw lastError ?? new Error(`Timed out waiting for release metadata at ${url}.`);
}

async function checkPublicAsset(assetPath, { requireWasmMimeType = false } = {}) {
  const response = await assertHeadOrGet(new URL(assetPath, baseUrl));
  assertLongLivedCache(response.headers, assetPath);
  if (requireWasmMimeType) {
    assertWasmMimeType(response.headers, assetPath);
  }
  checks.push(`public asset reachable: ${assetPath}`);
}

async function checkGlbAsset(assetPath) {
  const url = new URL(assetPath, baseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  assertLongLivedCache(response.headers, assetPath);

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
  for (const directive of [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'",
    "connect-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ]) {
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

function assertWasmMimeType(headers, label) {
  const contentType = headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/wasm')) {
    throw new Error(`${label} should be served as application/wasm, received Content-Type: ${contentType || '(missing)'}`);
  }
}

function parseMaxAge(cacheControl) {
  const match = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/);
  return match ? Number(match[1]) : 0;
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

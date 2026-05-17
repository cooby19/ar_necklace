const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL ?? process.argv[2]);
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA ?? '';
const expectedVersion = process.env.EXPECTED_VERSION ?? '';

if (!baseUrl) {
  throw new Error('Missing SMOKE_BASE_URL. Usage: SMOKE_BASE_URL=https://example.com/ npm run smoke:release');
}

const checks = [];

await checkHtmlAndBuiltAssets();
await checkReleaseMetadata();
await checkPublicAsset('models/necklace.glb');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh.js');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_packed_assets.data');
await checkPublicAsset('vendor/mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm');

console.log(`Smoke checks passed for ${baseUrl}`);
checks.forEach((check) => console.log(`ok   ${check}`));

async function checkHtmlAndBuiltAssets() {
  const html = await fetchText(baseUrl);
  checks.push('index.html reachable');

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => match[1]);
  if (!assetPaths.length) {
    throw new Error('No built assets found in index.html.');
  }

  for (const assetPath of assetPaths) {
    await assertHeadOrGet(new URL(assetPath, baseUrl));
    checks.push(`built asset reachable: ${assetPath}`);
  }
}

async function checkReleaseMetadata() {
  const metadata = await fetchJson(new URL('release.json', baseUrl));
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

async function checkPublicAsset(assetPath) {
  await assertHeadOrGet(new URL(assetPath, baseUrl));
  checks.push(`public asset reachable: ${assetPath}`);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function assertHeadOrGet(url) {
  let response = await fetch(url, { method: 'HEAD' });
  if (response.status === 405 || response.status === 403) {
    response = await fetch(url);
  }

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
}

function normalizeBaseUrl(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kib = 1024;
const mib = kib * 1024;

const budgets = {
  distJsTotal: 900 * kib,
  distJsFile: 640 * kib,
  distCssTotal: 48 * kib,
  distCssFile: 48 * kib,
  modelGlbTotal: 3 * mib,
  modelGlbFile: 2.25 * mib,
  mediapipeTotal: 21 * mib,
  mediapipeAssets: {
    'face_mesh.binarypb': 16 * kib,
    'face_mesh.js': 96 * kib,
    'face_mesh_solution_packed_assets.data': 4.8 * mib,
    'face_mesh_solution_packed_assets_loader.js': 32 * kib,
    'face_mesh_solution_simd_wasm_bin.js': 420 * kib,
    'face_mesh_solution_simd_wasm_bin.wasm': 7 * mib,
    'face_mesh_solution_wasm_bin.js': 420 * kib,
    'face_mesh_solution_wasm_bin.wasm': 7 * mib,
  },
};

const checks = [];

await checkDistAssets();
await checkModelAssets();
await checkMediapipeAssets();

const failures = checks.filter((check) => check.size > check.max);

console.log('Bundle budget report');
checks.forEach((check) => {
  const status = check.size <= check.max ? 'ok' : 'over';
  console.log(`${status.padEnd(4)} ${check.label.padEnd(72)} ${formatBytes(check.size)} / ${formatBytes(check.max)}`);
});

if (failures.length) {
  console.error('\nBundle budget exceeded:');
  failures.forEach((check) => {
    console.error(`- ${check.label}: ${formatBytes(check.size)} > ${formatBytes(check.max)}`);
  });
  process.exitCode = 1;
}

async function checkDistAssets() {
  const assetDir = path.join(rootDir, 'dist/assets');
  const files = await listFiles(assetDir);
  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const cssFiles = files.filter((file) => file.endsWith('.css'));

  if (!jsFiles.length || !cssFiles.length) {
    throw new Error('Missing built JS/CSS assets. Run npm run build before npm run budget.');
  }

  await checkFiles('dist JS asset', jsFiles, budgets.distJsFile);
  await checkFiles('dist CSS asset', cssFiles, budgets.distCssFile);
  checks.push({ label: 'dist/assets total JS', size: await sumSizes(jsFiles), max: budgets.distJsTotal });
  checks.push({ label: 'dist/assets total CSS', size: await sumSizes(cssFiles), max: budgets.distCssTotal });
}

async function checkModelAssets() {
  const modelDir = path.join(rootDir, 'public/models');
  const files = (await listFiles(modelDir)).filter((file) => file.endsWith('.glb'));

  if (!files.length) {
    throw new Error('Missing public/models/*.glb assets.');
  }

  await checkFiles('public model GLB', files, budgets.modelGlbFile);
  checks.push({ label: 'public/models total GLB', size: await sumSizes(files), max: budgets.modelGlbTotal });
}

async function checkMediapipeAssets() {
  const vendorDir = path.join(rootDir, 'public/vendor/mediapipe/face_mesh');
  const files = await listFiles(vendorDir);
  const importantFiles = Object.keys(budgets.mediapipeAssets).map((fileName) => path.join(vendorDir, fileName));

  for (const filePath of importantFiles) {
    const size = await fileSize(filePath);
    const fileName = path.basename(filePath);
    checks.push({
      label: `MediaPipe ${fileName}`,
      size,
      max: budgets.mediapipeAssets[fileName],
    });
  }

  checks.push({ label: 'MediaPipe face_mesh vendored total', size: await sumSizes(files), max: budgets.mediapipeTotal });
}

async function checkFiles(labelPrefix, files, max) {
  for (const filePath of files) {
    checks.push({
      label: `${labelPrefix} ${path.relative(rootDir, filePath)}`,
      size: await fileSize(filePath),
      max,
    });
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function sumSizes(files) {
  const sizes = await Promise.all(files.map(fileSize));
  return sizes.reduce((total, size) => total + size, 0);
}

async function fileSize(filePath) {
  const stats = await stat(filePath);
  return stats.size;
}

function formatBytes(bytes) {
  if (bytes >= mib) return `${(bytes / mib).toFixed(2)} MiB`;
  return `${(bytes / kib).toFixed(1)} KiB`;
}

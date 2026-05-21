import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const viteBasePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? '/');
const releaseMetadata = createReleaseMetadata();

export default defineConfig({
  base: viteBasePath,
  define: {
    __APP_RELEASE_METADATA__: JSON.stringify(releaseMetadata),
  },
  plugins: [releaseMetadataPlugin(releaseMetadata)],
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)),
      },
    ],
  },
  build: {
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith('/node_modules/three/src/Three.js')) return undefined;
          if (id.includes('/node_modules/three/src/')) return 'three-core';
          if (id.includes('/node_modules/three/examples/')) return 'three-extras';
          if (id.includes('/node_modules/')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});

function normalizeBasePath(value) {
  const text = String(value || '/').trim();
  if (!text || text === '/') return '/';
  if (text === './' || text === '.') return './';

  const withLeadingSlash = text.startsWith('/') ? text : `/${text}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function createReleaseMetadata() {
  return {
    version: process.env.npm_package_version ?? packageJson.version,
    commitSha: process.env.GITHUB_SHA ?? getGitCommitSha(),
    buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
    environment: process.env.DEPLOY_ENVIRONMENT ?? 'local',
  };
}

function getGitCommitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function releaseMetadataPlugin(metadata) {
  return {
    name: 'release-metadata',
    writeBundle() {
      const outputDir = path.join(rootDir, 'dist');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'release.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    },
  };
}

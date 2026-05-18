import { RELEASE_METADATA } from './release.js';

export function publicAssetUrl(path) {
  const normalizedPath = String(path).replace(/^\/+/, '');
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${normalizedPath}`;
}

export function versionedPublicAssetUrl(path, metadata = RELEASE_METADATA) {
  const url = publicAssetUrl(path);
  const token = createAssetVersionToken(metadata);
  if (!token) return url;

  return appendQueryParam(url, 'v', token);
}

function createAssetVersionToken(metadata) {
  const version = normalizeTokenPart(metadata.version);
  const commitSha = normalizeTokenPart(metadata.commitSha);
  return [version, commitSha].filter(Boolean).join('-');
}

function normalizeTokenPart(value) {
  const text = String(value ?? '').trim();
  if (!text || text === 'unknown' || text === 'development') return '';
  return text.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
}

function appendQueryParam(url, key, value) {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const separator = urlWithoutHash.includes('?') ? '&' : '?';
  return `${urlWithoutHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

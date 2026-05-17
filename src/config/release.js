const fallbackReleaseMetadata = {
  version: '0.0.0-dev',
  commitSha: 'dev',
  buildTime: 'development',
  environment: 'local',
};

const injectedReleaseMetadata =
  typeof __APP_RELEASE_METADATA__ === 'undefined' ? {} : __APP_RELEASE_METADATA__;

export const RELEASE_METADATA = Object.freeze({
  ...fallbackReleaseMetadata,
  ...injectedReleaseMetadata,
});

export function formatReleaseLabel(metadata = RELEASE_METADATA) {
  const sha = metadata.commitSha === 'unknown' ? metadata.commitSha : metadata.commitSha.slice(0, 12);
  return `v${metadata.version} · ${sha}`;
}

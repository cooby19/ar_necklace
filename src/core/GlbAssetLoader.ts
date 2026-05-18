import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { runtimeErrorReporter } from '../telemetry/RuntimeErrorReporter.js';
import type {
  GlbAssetLoadResult,
  GlbAssetTimings,
  GlbSceneAsset,
  NecklaceAssetLoadTimings,
} from '../types/scene-ports';
import type { NecklaceConfig } from '../types/domain';

export const MAX_GLB_BUFFER_CACHE_ENTRIES = 5;

interface GlbAssetLoaderLogger {
  debug(message?: unknown, ...optionalParams: unknown[]): void;
}

interface GlbAssetLoaderOptions {
  loader?: Pick<GLTFLoader, 'parseAsync'>;
  maxCacheEntries?: number;
  isDev?: boolean;
  logger?: GlbAssetLoaderLogger;
}

interface LoadGlbOptions {
  onFetchComplete?: () => void;
}

export class GlbAssetLoader {
  loader: Pick<GLTFLoader, 'parseAsync'>;
  maxCacheEntries: number;
  isDev: boolean;
  logger: GlbAssetLoaderLogger;
  glbBufferCache: Map<string, ArrayBuffer>;

  constructor({
    loader = new GLTFLoader(),
    maxCacheEntries = MAX_GLB_BUFFER_CACHE_ENTRIES,
    isDev = import.meta.env.DEV,
    logger = console,
  }: GlbAssetLoaderOptions = {}) {
    this.loader = loader;
    this.maxCacheEntries = maxCacheEntries;
    this.isDev = isDev;
    this.logger = logger;
    this.glbBufferCache = new Map();
  }

  async loadGlb(
    url: string,
    signal: AbortSignal,
    { onFetchComplete }: LoadGlbOptions = {},
  ): Promise<GlbAssetLoadResult> {
    const loadStartedAt = performance.now();
    try {
      const glbBuffer = await this.fetchGlbFile(url, signal);
      onFetchComplete?.();
      const fetchCompletedAt = performance.now();
      const gltf = await this.parseGlbFile(glbBuffer.slice(0), url);
      const parseCompletedAt = performance.now();

      return {
        gltf,
        timings: {
          fetchMs: fetchCompletedAt - loadStartedAt,
          parseMs: parseCompletedAt - fetchCompletedAt,
          totalAssetMs: parseCompletedAt - loadStartedAt,
        },
      };
    } catch (error) {
      if (!isAbortError(error)) {
        runtimeErrorReporter.captureError(error, {
          eventType: 'glb.load_failed',
          feature: 'model',
          extra: {
            assetUrl: url,
            elapsedMs: Math.round(performance.now() - loadStartedAt),
          },
        });
      }
      throw error;
    }
  }

  async fetchGlbFile(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
    const cachedBuffer = this.getCachedGlbBuffer(url);
    if (cachedBuffer) return cachedBuffer;

    const cacheMode = this.isDev ? 'no-store' : 'default';
    const response = await fetch(url, { cache: cacheMode, signal });

    if (!response.ok) {
      const error = new Error(`模型檔無法讀取，HTTP ${response.status}`);
      runtimeErrorReporter.captureError(error, {
        eventType: 'asset.http_error',
        feature: 'model',
        extra: {
          assetUrl: url,
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
        },
      });
      throw error;
    }

    const buffer = await response.arrayBuffer();
    this.assertGlbFile(buffer, url, response.headers.get('content-type') ?? '');
    this.setCachedGlbBuffer(url, buffer);
    return buffer;
  }

  getCachedGlbBuffer(url: string): ArrayBuffer | null {
    const buffer = this.glbBufferCache.get(url);
    if (!buffer) return null;

    this.glbBufferCache.delete(url);
    this.glbBufferCache.set(url, buffer);
    return buffer;
  }

  setCachedGlbBuffer(url: string, buffer: ArrayBuffer): void {
    this.glbBufferCache.delete(url);
    this.glbBufferCache.set(url, buffer);
    this.trimGlbBufferCache();
  }

  trimGlbBufferCache(): void {
    while (this.glbBufferCache.size > this.maxCacheEntries) {
      const oldestUrl = this.glbBufferCache.keys().next().value;
      if (!oldestUrl) return;
      this.glbBufferCache.delete(oldestUrl);
    }
  }

  clearCache(): void {
    this.glbBufferCache.clear();
  }

  logLoadTimings(config: NecklaceConfig, timings: NecklaceAssetLoadTimings): void {
    if (!this.isDev) return;

    this.logger.debug('[NecklaceScene] GLB load timing', {
      id: config.id,
      url: config.url,
      fetchMs: Math.round(timings.fetchMs),
      parseMs: Math.round(timings.parseMs),
      prepareMs: Math.round(timings.prepareMs),
      totalMs: Math.round(timings.totalMs),
    });
  }

  assertGlbFile(buffer: ArrayBuffer, url: string, contentType: string): void {
    if (buffer.byteLength < 20) {
      throw new Error(`模型檔太小，無法解析 GLB。請確認檔案位置是 ${url}`);
    }

    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer, 0, 4);
    const magic = String.fromCharCode(...bytes.slice(0, 4));

    if (magic !== 'glTF') {
      const looksLikeHtml = contentType.includes('text/html') || magic.startsWith('<');
      const reason = looksLikeHtml ? '目前路徑回傳 HTML，通常代表檔案不存在或 URL 錯誤' : '檔案標頭不是 GLB';
      throw new Error(`${reason}。請確認檔案位置是 ${url}`);
    }

    const version = view.getUint32(4, true);
    const declaredLength = view.getUint32(8, true);

    if (version !== 2) {
      throw new Error(`GLB 版本 ${version} 不支援，請使用 glTF 2.0 匯出的 .glb。`);
    }

    if (declaredLength !== buffer.byteLength) {
      throw new Error(
        `GLB 檔案長度不完整或已損毀，標頭宣告 ${declaredLength} bytes，實際讀到 ${buffer.byteLength} bytes。`,
      );
    }
  }

  parseGlbFile(buffer: ArrayBuffer, url: string): Promise<GlbSceneAsset> {
    const assetBasePath = url.slice(0, url.lastIndexOf('/') + 1);
    return this.loader.parseAsync(buffer, assetBasePath);
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MAX_GLB_BUFFER_CACHE_ENTRIES = 5;

export class GlbAssetLoader {
  constructor({
    loader = new GLTFLoader(),
    maxCacheEntries = MAX_GLB_BUFFER_CACHE_ENTRIES,
    isDev = import.meta.env.DEV,
    logger = console,
  } = {}) {
    this.loader = loader;
    this.maxCacheEntries = maxCacheEntries;
    this.isDev = isDev;
    this.logger = logger;
    this.glbBufferCache = new Map();
  }

  async loadGlb(url, signal, { onFetchComplete } = {}) {
    const loadStartedAt = performance.now();
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
  }

  async fetchGlbFile(url, signal) {
    const cachedBuffer = this.getCachedGlbBuffer(url);
    if (cachedBuffer) return cachedBuffer;

    const cacheMode = this.isDev ? 'no-store' : 'default';
    const response = await fetch(url, { cache: cacheMode, signal });

    if (!response.ok) {
      throw new Error(`模型檔無法讀取，HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    this.assertGlbFile(buffer, url, response.headers.get('content-type') ?? '');
    this.setCachedGlbBuffer(url, buffer);
    return buffer;
  }

  getCachedGlbBuffer(url) {
    const buffer = this.glbBufferCache.get(url);
    if (!buffer) return null;

    this.glbBufferCache.delete(url);
    this.glbBufferCache.set(url, buffer);
    return buffer;
  }

  setCachedGlbBuffer(url, buffer) {
    this.glbBufferCache.delete(url);
    this.glbBufferCache.set(url, buffer);
    this.trimGlbBufferCache();
  }

  trimGlbBufferCache() {
    while (this.glbBufferCache.size > this.maxCacheEntries) {
      const oldestUrl = this.glbBufferCache.keys().next().value;
      this.glbBufferCache.delete(oldestUrl);
    }
  }

  clearCache() {
    this.glbBufferCache.clear();
  }

  logLoadTimings(config, timings) {
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

  assertGlbFile(buffer, url, contentType) {
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

  parseGlbFile(buffer, url) {
    const assetBasePath = url.slice(0, url.lastIndexOf('/') + 1);
    return this.loader.parseAsync(buffer, assetBasePath);
  }
}

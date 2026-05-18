// @ts-check

import { RELEASE_METADATA } from '../config/release.js';

/** @typedef {import('../types/domain').ReleaseMetadata} ReleaseMetadata */

const REPORTING_DSN = import.meta.env.VITE_ERROR_REPORTING_DSN ?? '';
const REPORTING_SAMPLE_RATE = parseSampleRate(import.meta.env.VITE_ERROR_REPORTING_SAMPLE_RATE);
const REDACTED_VALUE = '[redacted]';
const MAX_EXTRA_DEPTH = 3;
const MAX_STRING_LENGTH = 1200;
const PRIVATE_CONTEXT_KEYS = new Set([
  'blob',
  'cameraFrame',
  'canvas',
  'captureBlob',
  'captureDataUrl',
  'dataUrl',
  'debugData',
  'image',
  'landmarks',
  'latestLandmarks',
  'multiFaceLandmarks',
  'multiFaceWorldLandmarks',
  'video',
]);

/**
 * @typedef {{
 *   dsn?: string,
 *   releaseMetadata?: ReleaseMetadata,
 *   sampleRate?: number,
 *   transport?: (endpoint: string, envelope: string) => Promise<void>,
 *   random?: () => number,
 *   now?: () => Date,
 * }} RuntimeErrorReporterOptions
 */

/**
 * @typedef {{
 *   eventType?: string,
 *   feature?: string,
 *   level?: 'fatal' | 'error' | 'warning' | 'info',
 *   tags?: Record<string, string | number | boolean | null | undefined>,
 *   extra?: Record<string, unknown>,
 *   [key: string]: unknown,
 * }} RuntimeErrorContext
 */

export class RuntimeErrorReporter {
  /** @param {RuntimeErrorReporterOptions} [options] */
  constructor({
    dsn = REPORTING_DSN,
    releaseMetadata = RELEASE_METADATA,
    sampleRate = REPORTING_SAMPLE_RATE,
    transport = sendSentryEnvelope,
    random = Math.random,
    now = () => new Date(),
  } = {}) {
    this.releaseMetadata = releaseMetadata;
    this.sampleRate = sampleRate;
    this.transport = transport;
    this.random = random;
    this.now = now;
    this.sentryDsn = parseSentryDsn(dsn);
    this.globalHandlersInstalled = false;
  }

  /** @returns {boolean} */
  isEnabled() {
    return Boolean(this.sentryDsn);
  }

  /** @returns {{ provider: string, enabled: boolean, release: ReleaseMetadata }} */
  getPublicStatus() {
    return {
      provider: 'sentry-compatible',
      enabled: this.isEnabled(),
      release: this.releaseMetadata,
    };
  }

  /** @returns {void} */
  installGlobalHandlers() {
    if (!this.isEnabled() || this.globalHandlersInstalled || typeof window === 'undefined') return;

    window.addEventListener('error', this.handleWindowError, true);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.globalHandlersInstalled = true;
  }

  /** @returns {void} */
  uninstallGlobalHandlers() {
    if (!this.globalHandlersInstalled || typeof window === 'undefined') return;

    window.removeEventListener('error', this.handleWindowError, true);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.globalHandlersInstalled = false;
  }

  /** @param {ErrorEvent | Event} event */
  handleWindowError = (event) => {
    if (isResourceErrorEvent(event)) {
      const asset = getResourceErrorContext(event.target);
      this.captureMessage('Resource load failed', {
        eventType: 'asset.load_failed',
        feature: 'asset',
        level: 'error',
        extra: asset,
      });
      return;
    }

    const errorEvent = /** @type {ErrorEvent} */ (event);
    this.captureError(errorEvent.error ?? new Error(errorEvent.message || 'Unhandled JavaScript error'), {
      eventType: 'js.error',
      feature: 'runtime',
      extra: {
        filename: redactUrl(errorEvent.filename),
        lineno: errorEvent.lineno,
        colno: errorEvent.colno,
      },
    });
  };

  /** @param {PromiseRejectionEvent} event */
  handleUnhandledRejection = (event) => {
    this.captureError(event.reason ?? new Error('Unhandled promise rejection'), {
      eventType: 'js.unhandledrejection',
      feature: 'runtime',
    });
  };

  /**
   * @param {unknown} error
   * @param {RuntimeErrorContext} [context]
   * @returns {boolean}
   */
  captureError(error, context = {}) {
    const serialized = serializeError(error);
    return this.sendEvent({
      message: serialized.message,
      exception: {
        values: [
          {
            type: serialized.name,
            value: serialized.message,
          },
        ],
      },
      extra: {
        stack: serialized.stack,
        ...getContextExtra(context),
      },
    }, context);
  }

  /**
   * @param {string} message
   * @param {RuntimeErrorContext} [context]
   * @returns {boolean}
   */
  captureMessage(message, context = {}) {
    return this.sendEvent({ message }, context);
  }

  /**
   * @param {Record<string, unknown>} eventBody
   * @param {RuntimeErrorContext} context
   * @returns {boolean}
   */
  sendEvent(eventBody, context) {
    if (!this.isEnabled()) return false;
    if (this.random() > this.sampleRate) return false;

    const event = {
      event_id: createEventId(),
      platform: 'javascript',
      timestamp: this.now().getTime() / 1000,
      level: context.level ?? 'error',
      release: formatReleaseForSentry(this.releaseMetadata),
      environment: this.releaseMetadata.environment,
      tags: sanitizeTags({
        event_type: context.eventType,
        feature: context.feature,
        version: this.releaseMetadata.version,
        commit: this.releaseMetadata.commitSha,
        ...context.tags,
      }),
      contexts: {
        release: {
          version: this.releaseMetadata.version,
          commitSha: this.releaseMetadata.commitSha,
          buildTime: this.releaseMetadata.buildTime,
          environment: this.releaseMetadata.environment,
        },
      },
      ...eventBody,
      extra: sanitizeValue(eventBody.extra ?? {}, 0),
    };

    const dsn = /** @type {ParsedSentryDsn} */ (this.sentryDsn);
    const envelope = createSentryEnvelope(dsn, event);
    this.transport(dsn.endpoint, envelope).catch((error) => {
      console.warn('[error-reporting] delivery failed', error);
    });

    return true;
  }
}

export const runtimeErrorReporter = new RuntimeErrorReporter();

/** @typedef {{ endpoint: string, publicKey: string, dsn: string }} ParsedSentryDsn */

/** @param {string} dsn */
function parseSentryDsn(dsn) {
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const pathSegments = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const projectId = pathSegments.pop();
    const pathPrefix = pathSegments.length ? `/${pathSegments.join('/')}` : '';

    if (!publicKey || !projectId) return null;

    const authParams = new URLSearchParams({
      sentry_key: publicKey,
      sentry_version: '7',
      sentry_client: 'ar-necklace/1.0',
    });

    return {
      dsn,
      publicKey,
      endpoint: `${url.protocol}//${url.host}${pathPrefix}/api/${projectId}/envelope/?${authParams}`,
    };
  } catch {
    console.warn('[error-reporting] invalid VITE_ERROR_REPORTING_DSN; reporting disabled');
    return null;
  }
}

/**
 * @param {string} endpoint
 * @param {string} envelope
 * @returns {Promise<void>}
 */
async function sendSentryEnvelope(endpoint, envelope) {
  await fetch(endpoint, {
    method: 'POST',
    body: envelope,
    keepalive: true,
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
    },
  });
}

/**
 * @param {ParsedSentryDsn} dsn
 * @param {Record<string, unknown>} event
 * @returns {string}
 */
function createSentryEnvelope(dsn, event) {
  const header = {
    dsn: dsn.dsn,
    sent_at: new Date().toISOString(),
  };
  const itemHeader = { type: 'event' };
  return `${JSON.stringify(header)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}\n`;
}

/** @param {unknown} value */
function parseSampleRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(1, Math.max(0, number));
}

/** @param {ReleaseMetadata} metadata */
function formatReleaseForSentry(metadata) {
  const sha = metadata.commitSha && metadata.commitSha !== 'unknown' ? `+${metadata.commitSha.slice(0, 12)}` : '';
  return `web-ar-necklace@${metadata.version}${sha}`;
}

/** @param {RuntimeErrorContext} context */
function getContextExtra(context) {
  const { eventType: _eventType, feature: _feature, level: _level, tags: _tags, extra, ...rest } = context;
  return {
    ...rest,
    ...(extra ?? {}),
  };
}

/** @param {Record<string, unknown>} tags */
function sanitizeTags(tags) {
  /** @type {Record<string, string>} */
  const output = {};

  Object.entries(tags).forEach(([key, value]) => {
    if (value == null) return;
    output[key] = String(value).slice(0, 200);
  });

  return output;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {string} [key]
 * @returns {unknown}
 */
function sanitizeValue(value, depth, key = '') {
  if (PRIVATE_CONTEXT_KEYS.has(key)) return REDACTED_VALUE;
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) return serializeError(value);
  if (isDomLikeValue(value)) return `[${value.constructor.name}]`;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (depth >= MAX_EXTRA_DEPTH) return '[object]';

  /** @type {Record<string, unknown>} */
  const output = {};
  Object.entries(/** @type {Record<string, unknown>} */ (value)).forEach(([childKey, childValue]) => {
    output[childKey] = sanitizeValue(childValue, depth + 1, childKey);
  });
  return output;
}

/** @param {unknown} value */
function isDomLikeValue(value) {
  return (
    typeof Element !== 'undefined' && value instanceof Element
  ) || (
    typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement
  ) || (
    typeof HTMLVideoElement !== 'undefined' && value instanceof HTMLVideoElement
  );
}

/** @param {unknown} error */
function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : safeJsonStringify(error),
    stack: undefined,
  };
}

/** @param {unknown} value */
function safeJsonStringify(value) {
  try {
    return JSON.stringify(sanitizeValue(value, 0)) ?? String(value);
  } catch {
    return String(value);
  }
}

/** @param {Event} event */
function isResourceErrorEvent(event) {
  return event.target instanceof HTMLElement;
}

/** @param {EventTarget | null} target */
function getResourceErrorContext(target) {
  if (!(target instanceof HTMLElement)) return {};

  const tagName = target.tagName.toLowerCase();
  const url =
    target instanceof HTMLScriptElement ? target.src
      : target instanceof HTMLLinkElement ? target.href
        : target instanceof HTMLImageElement ? target.currentSrc || target.src
          : target instanceof HTMLSourceElement ? target.src
            : '';

  return {
    tagName,
    assetUrl: redactUrl(url),
    rel: target instanceof HTMLLinkElement ? target.rel : undefined,
  };
}

/** @param {string | undefined} value */
function redactUrl(value) {
  if (!value) return '';

  try {
    const url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}`;
    }

    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function createEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// @ts-check

/**
 * @typedef {{
 *   necklaceId: string | null,
 *   colorByTarget: Record<string, string>,
 *   colorFallback: string | null,
 * }} UrlState
 */

/**
 * @param {string} [hash]
 * @returns {UrlState}
 */
export function parseUrlState(hash = window.location.hash) {
  const params = new URLSearchParams(normalizeHash(hash));
  /** @type {UrlState} */
  const urlState = {
    necklaceId: null,
    colorByTarget: {},
    colorFallback: null,
  };

  params.forEach((value, key) => {
    if (!value) return;

    if (key === 'n') {
      urlState.necklaceId = value;
      return;
    }

    if (key === 'c') {
      urlState.colorFallback = value;
      return;
    }

    if (key.startsWith('c.')) {
      const targetId = key.slice(2);
      if (targetId) {
        urlState.colorByTarget[targetId] = value;
      }
    }
  });

  return urlState;
}

/**
 * @param {UrlState} urlState
 * @returns {string}
 */
export function serializeUrlState({ necklaceId, colorByTarget = {}, colorFallback }) {
  const params = new URLSearchParams();

  if (necklaceId) {
    params.set('n', necklaceId);
  }

  if (colorFallback) {
    params.set('c', colorFallback);
  }

  Object.keys(colorByTarget)
    .filter((targetId) => targetId && colorByTarget[targetId])
    .sort()
    .forEach((targetId) => {
      params.set(`c.${targetId}`, colorByTarget[targetId]);
    });

  return params.toString();
}

/**
 * @param {{ onHashChange: (urlState: UrlState) => void }} options
 * @returns {() => void}
 */
export function installRouter({ onHashChange }) {
  const handleHashChange = () => {
    onHashChange(parseUrlState());
  };

  window.addEventListener('hashchange', handleHashChange);

  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
}

/**
 * @param {string} hash
 * @returns {string}
 */
function normalizeHash(hash) {
  if (!hash) return '';
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

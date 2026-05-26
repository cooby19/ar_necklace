import { afterEach, describe, expect, it, vi } from 'vitest';
import { installRouter, parseUrlState, serializeUrlState } from './router.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('router parseUrlState', () => {
  it.each([
    ['', { necklaceId: null, colorByTarget: {}, colorFallback: null }],
    ['#', { necklaceId: null, colorByTarget: {}, colorFallback: null }],
    ['#n=foo', { necklaceId: 'foo', colorByTarget: {}, colorFallback: null }],
    ['n=foo', { necklaceId: 'foo', colorByTarget: {}, colorFallback: null }],
    ['#n=foo&c=bar', { necklaceId: 'foo', colorByTarget: {}, colorFallback: 'bar' }],
    [
      '#n=foo&c.metal=citrine&c.gem=amethyst',
      {
        necklaceId: 'foo',
        colorByTarget: { metal: 'citrine', gem: 'amethyst' },
        colorFallback: null,
      },
    ],
    [
      '#n=foo&unknown=value&c.gem=amethyst',
      {
        necklaceId: 'foo',
        colorByTarget: { gem: 'amethyst' },
        colorFallback: null,
      },
    ],
    ['#n=&c=&c.gem=', { necklaceId: null, colorByTarget: {}, colorFallback: null }],
    [
      '#n=crystal%20cone&c.gem=moon%20stone',
      {
        necklaceId: 'crystal cone',
        colorByTarget: { gem: 'moon stone' },
        colorFallback: null,
      },
    ],
  ])('parses %s', (hash, expected) => {
    expect(parseUrlState(hash)).toEqual(expected);
  });
});

describe('router serializeUrlState', () => {
  it('round-trips a populated URL state', () => {
    const urlState = {
      necklaceId: 'crystal-cone-necklace',
      colorByTarget: {
        metal: 'citrine',
        gem: 'amethyst',
      },
      colorFallback: 'rose-quartz',
    };

    expect(parseUrlState(serializeUrlState(urlState))).toEqual(urlState);
  });

  it('omits nulls, empty strings, and empty objects', () => {
    expect(
      serializeUrlState({
        necklaceId: '',
        colorByTarget: {
          gem: '',
        },
        colorFallback: null,
      }),
    ).toBe('');
  });

  it('uses stable key order', () => {
    expect(
      serializeUrlState({
        necklaceId: 'foo',
        colorFallback: 'bar',
        colorByTarget: {
          metal: 'citrine',
          gem: 'amethyst',
          pendant: 'moonstone',
        },
      }),
    ).toBe('n=foo&c=bar&c.gem=amethyst&c.metal=citrine&c.pendant=moonstone');
  });
});

describe('router installRouter', () => {
  it('subscribes to hashchange and returns a disposer', () => {
    const listeners = new Map();
    vi.stubGlobal('window', {
      location: { hash: '#n=foo' },
      addEventListener: vi.fn((eventName, listener) => listeners.set(eventName, listener)),
      removeEventListener: vi.fn(),
    });
    const onHashChange = vi.fn();

    const dispose = installRouter({ onHashChange });
    listeners.get('hashchange')();
    dispose();

    expect(onHashChange).toHaveBeenCalledWith({
      necklaceId: 'foo',
      colorByTarget: {},
      colorFallback: null,
    });
    expect(window.removeEventListener).toHaveBeenCalledWith('hashchange', listeners.get('hashchange'));
  });
});

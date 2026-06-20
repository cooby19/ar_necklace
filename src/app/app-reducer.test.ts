import { describe, expect, it } from 'vitest';
import { APP_MODES, APP_ROUTES, AR_SESSION_STATES, CAMERA_FACING_MODES } from './AppState.js';
import { reduceAppIntent } from './app-reducer';
import { NECKLACES } from '../config/necklaces.js';
import type { AppStateSnapshot } from '../types/domain';

describe('app reducer pure UI intents', () => {
  it('creates an AR idle session transition for mode select into AR', () => {
    const state = createState({
      mode: APP_MODES.SHOWCASE,
      sessionStatus: AR_SESSION_STATES.SHOWCASE,
    });

    expect(reduceAppIntent(state, { type: 'mode/select', mode: APP_MODES.AR })).toEqual({
      kind: 'session-transition',
      nextStatus: AR_SESSION_STATES.AR_IDLE,
      patch: { mode: APP_MODES.AR },
      eventName: 'mode-select',
    });
  });

  it('creates a showcase session transition and moves fit panel back to styles', () => {
    const state = createState({
      mode: APP_MODES.AR,
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
      activePanel: 'fit',
    });

    expect(reduceAppIntent(state, { type: 'mode/select', mode: APP_MODES.SHOWCASE })).toEqual({
      kind: 'session-transition',
      nextStatus: AR_SESSION_STATES.SHOWCASE,
      patch: {
        mode: APP_MODES.SHOWCASE,
        activePanel: 'styles',
      },
      eventName: 'mode-select',
    });
  });

  it('ignores invalid and unchanged mode selections', () => {
    const state = createState({ mode: APP_MODES.AR });

    expect(reduceAppIntent(state, { type: 'mode/select', mode: 'preview' })).toEqual({ kind: 'none' });
    expect(reduceAppIntent(state, { type: 'mode/select', mode: APP_MODES.AR })).toEqual({ kind: 'none' });
  });

  it('switches mode relative to the current snapshot', () => {
    expect(reduceAppIntent(createState({ mode: APP_MODES.SHOWCASE }), { type: 'mode/switch' })).toMatchObject({
      kind: 'session-transition',
      nextStatus: AR_SESSION_STATES.AR_IDLE,
      patch: { mode: APP_MODES.AR },
    });
    expect(reduceAppIntent(createState({ mode: APP_MODES.AR }), { type: 'mode/switch' })).toMatchObject({
      kind: 'session-transition',
      nextStatus: AR_SESSION_STATES.SHOWCASE,
      patch: { mode: APP_MODES.SHOWCASE },
    });
  });

  it('creates a panel selection patch and ignores empty panel names', () => {
    const state = createState({ activePanel: 'styles' });

    expect(reduceAppIntent(state, { type: 'panel/select', panelName: 'fit' })).toEqual({
      kind: 'patch',
      patch: { activePanel: 'fit' },
      eventName: 'panel-select',
    });
    expect(reduceAppIntent(state, { type: 'panel/select', panelName: '' })).toEqual({ kind: 'none' });
  });

  it('creates bottom sheet toggle and set patches', () => {
    const state = createState({ controlsCollapsed: true });

    expect(reduceAppIntent(state, { type: 'bottom-sheet/toggle' })).toEqual({
      kind: 'patch',
      patch: { controlsCollapsed: false },
      eventName: 'bottom-sheet-toggle',
    });
    expect(reduceAppIntent(state, { type: 'bottom-sheet/set', controlsCollapsed: true })).toEqual({
      kind: 'patch',
      patch: { controlsCollapsed: true },
      eventName: 'bottom-sheet-toggle',
    });
  });

  it('creates debug and necklace visibility patches', () => {
    const state = createState({
      debugEnabled: false,
      necklaceVisible: true,
    });

    expect(reduceAppIntent(state, { type: 'debug/toggle', isEnabled: true })).toEqual({
      kind: 'patch',
      patch: { debugEnabled: true },
      eventName: 'debug-toggle',
    });
    expect(reduceAppIntent(state, { type: 'necklace-visibility/toggle', isVisible: false })).toEqual({
      kind: 'patch',
      patch: { necklaceVisible: false },
      eventName: 'necklace-toggle',
    });
  });

  it('does not mutate the input snapshot', () => {
    const state = createState({
      mode: APP_MODES.AR,
      activePanel: 'fit',
      controlsCollapsed: true,
    });
    const before = cloneState(state);

    reduceAppIntent(state, { type: 'mode/select', mode: APP_MODES.SHOWCASE });
    reduceAppIntent(state, { type: 'bottom-sheet/toggle' });
    reduceAppIntent(state, { type: 'debug/toggle', isEnabled: true });

    expect(state).toEqual(before);
  });
});

function createState(overrides: Partial<AppStateSnapshot> = {}): AppStateSnapshot {
  return {
    mode: APP_MODES.SHOWCASE,
    route: APP_ROUTES.EXPERIENCE,
    sessionStatus: AR_SESSION_STATES.SHOWCASE,
    cameraStarted: false,
    cameraFacingMode: CAMERA_FACING_MODES.USER,
    isSwitchingCamera: false,
    modelLoaded: true,
    selectedNecklace: NECKLACES[0],
    selectedColorId: 'rose-quartz',
    selectedColorIdsByTarget: {
      metal: 'rose-quartz',
      pendant: 'rose-quartz',
      gem: 'rose-quartz',
    },
    necklaceVisible: true,
    debugEnabled: false,
    activePanel: 'styles',
    controlsCollapsed: true,
    captureDataUrl: '',
    captureBlob: null,
    adjustments: {
      horizontalOffset: 0,
      verticalOffset: 0,
      scaleMultiplier: 1,
      rotationOffset: 0,
    },
    ...overrides,
  };
}

function cloneState(state: AppStateSnapshot): AppStateSnapshot {
  return {
    ...state,
    selectedColorIdsByTarget: { ...state.selectedColorIdsByTarget },
    adjustments: { ...state.adjustments },
  };
}

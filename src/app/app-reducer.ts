import { APP_MODES, AR_SESSION_STATES } from './AppState.js';
import type { AppIntent } from './app-intents';
import type { AppMode, AppStatePatch, AppStateSnapshot, ArSessionStatus } from '../types/domain';

export type AppReducerResult =
  | {
      kind: 'none';
    }
  | {
      kind: 'patch';
      patch: AppStatePatch;
      eventName: string;
    }
  | {
      kind: 'session-transition';
      nextStatus: ArSessionStatus;
      patch: AppStatePatch;
      eventName: string;
    };

const NO_CHANGE: AppReducerResult = { kind: 'none' };

export function reduceAppIntent(state: AppStateSnapshot, intent: AppIntent): AppReducerResult {
  switch (intent.type) {
    case 'mode/select':
      return reduceModeSelect(state, intent.mode);
    case 'mode/switch':
      return reduceModeSelect(state, state.mode === APP_MODES.AR ? APP_MODES.SHOWCASE : APP_MODES.AR);
    case 'panel/select':
      return intent.panelName ? createPatch({ activePanel: intent.panelName }, 'panel-select') : NO_CHANGE;
    case 'bottom-sheet/toggle':
      return createPatch({ controlsCollapsed: !state.controlsCollapsed }, 'bottom-sheet-toggle');
    case 'bottom-sheet/set':
      return createPatch({ controlsCollapsed: intent.controlsCollapsed }, 'bottom-sheet-toggle');
    case 'debug/toggle':
      return createPatch({ debugEnabled: intent.isEnabled }, 'debug-toggle');
    case 'necklace-visibility/toggle':
      return createPatch({ necklaceVisible: intent.isVisible }, 'necklace-toggle');
    default:
      return assertNever(intent);
  }
}

function reduceModeSelect(
  state: AppStateSnapshot,
  mode: AppMode | string | null | undefined,
): AppReducerResult {
  if (!isAppMode(mode) || state.mode === mode) return NO_CHANGE;

  const patch: AppStatePatch = {
    mode,
  };

  if (mode !== APP_MODES.AR && state.activePanel === 'fit') {
    patch.activePanel = 'styles';
  }

  return {
    kind: 'session-transition',
    nextStatus: mode === APP_MODES.SHOWCASE ? AR_SESSION_STATES.SHOWCASE : AR_SESSION_STATES.AR_IDLE,
    patch,
    eventName: 'mode-select',
  };
}

function createPatch(patch: AppStatePatch, eventName: string): AppReducerResult {
  return {
    kind: 'patch',
    patch,
    eventName,
  };
}

function isAppMode(mode: AppMode | string | null | undefined): mode is AppMode {
  return mode === APP_MODES.SHOWCASE || mode === APP_MODES.AR;
}

function assertNever(intent: never): AppReducerResult {
  throw new Error(`Unhandled app intent: ${JSON.stringify(intent)}`);
}

import { describe, expect, it, vi } from 'vitest';
import {
  APP_MODES,
  AR_SESSION_STATES,
  AppState,
  canTransitionSession,
  createDefaultColorSelection,
  createSessionPatch,
} from './AppState.js';
import { NECKLACES } from '../config/necklaces.js';

describe('AppState AR session lifecycle', () => {
  it('defines expected legal and illegal session transitions', () => {
    expect(canTransitionSession(AR_SESSION_STATES.SHOWCASE, AR_SESSION_STATES.AR_IDLE)).toBe(true);
    expect(canTransitionSession(AR_SESSION_STATES.AR_IDLE, AR_SESSION_STATES.CAMERA_STARTING)).toBe(true);
    expect(canTransitionSession(AR_SESSION_STATES.NO_FACE, AR_SESSION_STATES.TRACKING)).toBe(true);
    expect(canTransitionSession(AR_SESSION_STATES.TRACKING, AR_SESSION_STATES.CAPTURING)).toBe(true);
    expect(canTransitionSession(AR_SESSION_STATES.CAPTURING, AR_SESSION_STATES.SHARING)).toBe(true);

    expect(canTransitionSession(AR_SESSION_STATES.SHOWCASE, AR_SESSION_STATES.CAPTURING)).toBe(false);
    expect(canTransitionSession(AR_SESSION_STATES.AR_IDLE, AR_SESSION_STATES.TRACKING)).toBe(false);
    expect(canTransitionSession(AR_SESSION_STATES.CAPTURING, AR_SESSION_STATES.SHOWCASE)).toBe(false);
  });

  it.each([
    [AR_SESSION_STATES.SHOWCASE, { cameraStarted: false, isSwitchingCamera: false }],
    [AR_SESSION_STATES.AR_IDLE, { cameraStarted: false, isSwitchingCamera: false }],
    [AR_SESSION_STATES.CAMERA_STARTING, {}],
    [AR_SESSION_STATES.NO_FACE, {}],
  ])('keeps session patches limited to durable UI state when entering %s', (nextStatus, expectedPatch) => {
    expect(
      createSessionPatch(nextStatus, {
        cameraStarted: true,
        isSwitchingCamera: true,
      }),
    ).toMatchObject({
      sessionStatus: nextStatus,
      ...expectedPatch,
    });
  });

  it('applies durable session cleanup through real transitions and ignores invalid transitions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const appState = new AppState({ necklaces: NECKLACES });

    appState.set({
      mode: APP_MODES.AR,
      cameraStarted: true,
    });

    const invalidSnapshot = appState.transitionSession(AR_SESSION_STATES.CAPTURING);
    expect(invalidSnapshot.sessionStatus).toBe(AR_SESSION_STATES.SHOWCASE);
    expect(warn).toHaveBeenCalledOnce();

    appState.transitionSession(AR_SESSION_STATES.AR_IDLE);
    expect(appState.getSnapshot()).toMatchObject({
      sessionStatus: AR_SESSION_STATES.AR_IDLE,
      cameraStarted: false,
    });

    appState.transitionSession(AR_SESSION_STATES.CAMERA_STARTING, {
      cameraStarted: true,
    });
    expect(appState.getSnapshot()).toMatchObject({
      sessionStatus: AR_SESSION_STATES.CAMERA_STARTING,
      cameraStarted: true,
    });

    warn.mockRestore();
  });

  it('creates default color selections for all configured targets', () => {
    expect(createDefaultColorSelection(NECKLACES[0])).toEqual({
      metal: 'rose-quartz',
      pendant: 'rose-quartz',
      gem: 'rose-quartz',
    });
  });
});

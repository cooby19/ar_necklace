// @ts-check

import { APP_MODES, APP_ROUTES, AR_SESSION_STATES } from '../AppState.js';

/** @typedef {import('../../types/domain').ArSessionStatus} ArSessionStatus */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */

/**
 * @typedef {{
 *   selectNecklace: (necklaceId: string | null | undefined) => void,
 * }} RouteModelPort
 */

/**
 * @typedef {{
 *   syncModeEffects: () => void,
 * }} RouteModePort
 */

/**
 * @typedef {{
 *   stopCameraSession: (options?: { nextStatus?: ArSessionStatus, eventName?: string }) => void,
 * }} RouteCameraSessionPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   modelCatalog: import('../ModelCatalogService.js').ModelCatalogService,
 *   modelUseCase: RouteModelPort,
 *   modeUseCase: RouteModePort,
 *   cameraSessionUseCase: RouteCameraSessionPort,
 * }} RouteUseCaseOptions
 */

export class RouteUseCase {
  /**
   * @param {RouteUseCaseOptions} options
   */
  constructor({ appState, modelCatalog, modelUseCase, modeUseCase, cameraSessionUseCase }) {
    this.appState = appState;
    this.modelCatalog = modelCatalog;
    this.modelUseCase = modelUseCase;
    this.modeUseCase = modeUseCase;
    this.cameraSessionUseCase = cameraSessionUseCase;
  }

  /**
   * Opens the showcase/AR experience for a style chosen from the gallery.
   * Selecting the style first lets the model start loading before the route flips,
   * and keeps the deep-link hash (`#n=<id>`) in sync via the existing selection path.
   *
   * @param {string | null | undefined} necklaceId
   * @returns {void}
   */
  enterExperience(necklaceId) {
    if (!necklaceId) return;
    if (!this.modelCatalog.getById(necklaceId)) return;

    this.modelUseCase.selectNecklace(necklaceId);
    this.appState.set({ route: APP_ROUTES.EXPERIENCE, mode: APP_MODES.SHOWCASE }, 'enter-experience');
    this.modeUseCase.syncModeEffects();
  }

  /**
   * Returns to the style gallery, tearing down any live camera session first.
   *
   * @returns {void}
   */
  showGallery() {
    if (this.appState.get('cameraStarted')) {
      this.cameraSessionUseCase.stopCameraSession({
        nextStatus: AR_SESSION_STATES.SHOWCASE,
        eventName: 'gallery-camera-stop',
      });
    }

    this.appState.set({ route: APP_ROUTES.GALLERY, mode: APP_MODES.SHOWCASE }, 'show-gallery');
  }
}

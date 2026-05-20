// @ts-check

/** @typedef {import('../../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../../types/domain').WorkflowStatusView} WorkflowStatusView */
/** @typedef {import('../../types/app-ports').AppStatePort} AppStatePort */
/** @typedef {import('../../types/ui-ports').ColorAvailabilityUiModel} ColorAvailabilityUiModel */
/** @typedef {import('../../types/ui-ports').ColorSwatchesUiModel} ColorSwatchesUiModel */

/**
 * @typedef {{
 *   syncNecklaceSelection: (necklaceId: string) => void,
 *   clearError: () => void,
 *   setStatus: (kind: WorkflowStatusView['kind'], label: string, metrics: string) => void,
 *   populateColorSwatches: (model: ColorSwatchesUiModel) => void,
 *   updateColorUiAvailability: (availability: ColorAvailabilityUiModel) => void,
 * }} ModelUiPort
 */

/**
 * @typedef {{
 *   appState: AppStatePort,
 *   ui: ModelUiPort,
 *   modelCatalog: import('../ModelCatalogService.js').ModelCatalogService,
 *   necklaceController: import('../../core/NecklaceController.js').NecklaceController,
 *   rendererLoop: import('../RendererLoop.js').RendererLoop,
 *   applyCalibrationForSelectedNecklace: () => void,
 *   syncModeEffects: () => void,
 *   showError: (message: string) => void,
 * }} ModelUseCaseOptions
 */

export class ModelUseCase {
  /**
   * @param {ModelUseCaseOptions} options
   */
  constructor({
    appState,
    ui,
    modelCatalog,
    necklaceController,
    rendererLoop,
    applyCalibrationForSelectedNecklace,
    syncModeEffects,
    showError,
  }) {
    this.appState = appState;
    this.ui = ui;
    this.modelCatalog = modelCatalog;
    this.necklaceController = necklaceController;
    this.rendererLoop = rendererLoop;
    this.applyCalibrationForSelectedNecklace = applyCalibrationForSelectedNecklace;
    this.syncModeEffects = syncModeEffects;
    this.showError = showError;
  }

  /**
   * @param {string | null | undefined} necklaceId
   * @returns {void}
   */
  selectNecklace(necklaceId) {
    if (!necklaceId) return;

    const next = this.modelCatalog.getById(necklaceId);
    if (!next) return;

    const state = this.getState();
    if (next.id === state.selectedNecklace.id) {
      this.ui.syncNecklaceSelection(next.id);
      return;
    }

    this.appState.set(this.modelCatalog.createSelectionPatch(next), 'necklace-select');
    this.necklaceController.reset();
    this.applyCalibrationForSelectedNecklace();
    this.loadSelectedNecklace();
  }

  /**
   * @param {string | null | undefined} colorId
   * @param {string | null | undefined} targetId
   * @returns {void}
   */
  selectColor(colorId, targetId) {
    if (!colorId) return;

    const state = this.getState();
    const selection = this.modelCatalog.createColorSelection(state, colorId, targetId);
    if (!selection) return;

    this.appState.set(selection.patch, 'color-select');
    this.modelCatalog.applySelectedColors(this.getState(), selection.targetIds);
    this.rendererLoop.requestRender();
  }

  /**
   * @returns {Promise<void>}
   */
  async loadSelectedNecklace() {
    const selectedNecklace = this.appState.get('selectedNecklace');
    this.appState.set({ modelLoaded: false }, 'model-load-start');
    this.ui.clearError();
    this.syncColorAvailability();
    this.ui.setStatus('loading', '款式載入中', selectedNecklace.label);

    try {
      const result = await this.modelCatalog.load(selectedNecklace);
      if (result.status === 'stale') return;

      this.appState.set({ modelLoaded: true }, 'model-load-success');
      const colorDefaultsPatch = this.modelCatalog.ensureColorSelectionForMatchedTargets(this.getState());
      if (colorDefaultsPatch) {
        this.appState.set(colorDefaultsPatch, 'color-target-defaults');
      }
      this.modelCatalog.applySelectedColors(this.getState());
      this.syncColorAvailability();
      this.syncModeEffects();
      this.rendererLoop.requestRender();
    } catch (error) {
      if (isAbortError(error)) return;

      const message =
        `無法載入「${selectedNecklace.label}」模型：${selectedNecklace.url}。` +
        ` 請確認該款式的 .glb 已放在 public/models/，且 catalog URL 設定正確。` +
        ` 原始錯誤：${formatUnknownError(error)}`;
      this.showError(message);
      this.ui.setStatus('error', '模型載入失敗', `請檢查「${selectedNecklace.label}」模型檔`);
      this.syncColorAvailability();
    }
  }

  /**
   * @returns {void}
   */
  syncColorAvailability() {
    const state = this.getState();
    const colorUiModel = this.modelCatalog.buildColorUiModel(state);

    this.ui.populateColorSwatches(colorUiModel.swatches);
    this.ui.updateColorUiAvailability(colorUiModel.availability);
  }

  /**
   * @returns {AppStateSnapshot}
   */
  getState() {
    return this.appState.getSnapshot();
  }
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatUnknownError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isAbortError(error) {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

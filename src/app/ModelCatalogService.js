// @ts-check

import { createDefaultColorSelection } from './AppState.js';

/** @typedef {import('../types/domain').AppStatePatch} AppStatePatch */
/** @typedef {import('../types/domain').AppStateSnapshot} AppStateSnapshot */
/** @typedef {import('../types/domain').ColorOption} ColorOption */
/** @typedef {import('../types/domain').ColorSelectionByTarget} ColorSelectionByTarget */
/** @typedef {import('../types/domain').NecklaceConfig} NecklaceConfig */
/** @typedef {import('../types/scene-ports').NecklaceSceneColorPort} NecklaceSceneColorPort */
/** @typedef {import('../types/ui-ports').ColorUiModel} ColorUiModel */

/** @typedef {'stale' | 'loaded'} ModelLoadStatus */

/**
 * @typedef {{
 *   status: ModelLoadStatus,
 *   necklace: NecklaceConfig,
 *   targetIds?: string[],
 *   hasColorableMaterials?: boolean,
 *   materialHitCount?: number,
 * }} ModelLoadResult
 */

/**
 * @typedef {{
 *   selectedNecklace: NecklaceConfig,
 *   selectedColorId: string,
 *   selectedColorIdsByTarget: ColorSelectionByTarget,
 *   modelLoaded?: boolean,
 * }} ColorSelectionState
 */

/**
 * @typedef {{
 *   patch: AppStatePatch,
 *   targetIds: string[],
 * }} ColorSelectionResult
 */

export class ModelCatalogService {
  /**
   * @param {{ scene: NecklaceSceneColorPort, necklaces: readonly NecklaceConfig[] }} options
   */
  constructor({ scene, necklaces }) {
    this.scene = scene;
    this.necklaces = necklaces;
    this.loadSequence = 0;
  }

  /**
   * @param {string} necklaceId
   * @returns {NecklaceConfig | null}
   */
  getById(necklaceId) {
    return this.necklaces.find((necklace) => necklace.id === necklaceId) ?? null;
  }

  /**
   * @param {NecklaceConfig} necklace
   * @returns {AppStatePatch}
   */
  createSelectionPatch(necklace) {
    return {
      selectedNecklace: necklace,
      selectedColorId: necklace.colorCustomization?.defaultColor ?? '',
      selectedColorIdsByTarget: createDefaultColorSelection(necklace),
    };
  }

  /**
   * @param {NecklaceConfig} necklace
   * @returns {Promise<ModelLoadResult>}
   */
  async load(necklace) {
    const loadId = ++this.loadSequence;
    await this.scene.loadNecklace(necklace);

    if (!this.isLatestLoad(loadId)) {
      return { status: 'stale', necklace };
    }

    return {
      status: 'loaded',
      necklace,
      targetIds: this.getColorableTargets(),
      hasColorableMaterials: this.hasColorableMaterials(),
      materialHitCount: this.getColorableMaterialCount(),
    };
  }

  /**
   * @param {number} loadId
   * @returns {boolean}
   */
  isLatestLoad(loadId) {
    return this.loadSequence === loadId;
  }

  /**
   * @param {AppStateSnapshot} state
   * @returns {ColorUiModel}
   */
  buildColorUiModel(state) {
    const targetIds = state.modelLoaded ? this.getColorableTargets() : [];

    return {
      swatches: {
        necklace: state.selectedNecklace,
        selectedColorIdsByTarget: state.selectedColorIdsByTarget,
        fallbackColorId: state.selectedColorId,
        targetIds,
      },
      availability: {
        necklace: state.selectedNecklace,
        modelLoaded: state.modelLoaded,
        hasColorableMaterials: this.hasColorableMaterials(),
        targetLabels: this.getMatchedColorTargetLabels(state.selectedNecklace),
      },
    };
  }

  /**
   * @param {ColorSelectionState} state
   * @param {string} colorId
   * @param {string | null | undefined} targetId
   * @returns {ColorSelectionResult | null}
   */
  createColorSelection(state, colorId, targetId) {
    const colorOption = getColorOption(state.selectedNecklace, colorId);
    const resolvedTargetId = this.resolveColorSelectionTarget(state.selectedNecklace, targetId);
    if (!colorOption || !resolvedTargetId) return null;

    return {
      patch: {
        selectedColorId: colorOption.id,
        selectedColorIdsByTarget: {
          ...state.selectedColorIdsByTarget,
          [resolvedTargetId]: colorOption.id,
        },
      },
      targetIds: [resolvedTargetId],
    };
  }

  /**
   * @param {ColorSelectionState} state
   * @returns {AppStatePatch | null}
   */
  ensureColorSelectionForMatchedTargets(state) {
    const defaultColorId = state.selectedNecklace.colorCustomization?.defaultColor ?? '';
    if (!defaultColorId) return null;

    const targetIds = this.getColorableTargets();
    const selectedColorIdsByTarget = { ...state.selectedColorIdsByTarget };
    let didChange = false;

    targetIds.forEach((targetId) => {
      if (selectedColorIdsByTarget[targetId]) return;
      selectedColorIdsByTarget[targetId] = defaultColorId;
      didChange = true;
    });

    return didChange ? { selectedColorIdsByTarget } : null;
  }

  /**
   * @param {ColorSelectionState} state
   * @param {string[]} [targetIds]
   * @returns {boolean}
   */
  applySelectedColors(state, targetIds = this.getColorableTargets()) {
    let didApply = false;

    targetIds.forEach((targetId) => {
      const colorId = this.getSelectedColorIdForTarget(state, targetId);
      const colorOption = getColorOption(state.selectedNecklace, colorId);
      if (!colorOption) return;

      didApply = this.scene.applyColor(targetId, colorOption.color) || didApply;
    });

    return didApply;
  }

  /**
   * @param {ColorSelectionState} state
   * @param {string} targetId
   * @returns {string}
   */
  getSelectedColorIdForTarget(state, targetId) {
    return (
      state.selectedColorIdsByTarget?.[targetId] ??
      state.selectedColorId ??
      state.selectedNecklace.colorCustomization?.defaultColor ??
      ''
    );
  }

  /**
   * @param {NecklaceConfig} necklace
   * @param {string | null | undefined} targetId
   * @returns {string}
   */
  resolveColorSelectionTarget(necklace, targetId) {
    const activeTargetIds = this.getColorableTargets();
    if (targetId && activeTargetIds.includes(targetId)) return targetId;
    if (activeTargetIds.length === 1) return activeTargetIds[0];

    const defaultTarget = necklace.colorCustomization?.defaultTarget ?? 'all';
    if (defaultTarget !== 'all' && activeTargetIds.includes(defaultTarget)) return defaultTarget;
    return activeTargetIds[0] ?? '';
  }

  /**
   * @param {NecklaceConfig} necklace
   * @returns {string[]}
   */
  getMatchedColorTargetLabels(necklace) {
    const targetIds = this.getColorableTargets();
    const targets = necklace.colorCustomization?.targets ?? [];
    /** @type {string[]} */
    const labels = [];

    targetIds.forEach((targetId) => {
      const label = targets.find((target) => target.id === targetId)?.label;
      if (label) labels.push(label);
    });

    return labels;
  }

  /**
   * @returns {string[]}
   */
  getColorableTargets() {
    return this.scene.getColorableTargets();
  }

  /**
   * @returns {boolean}
   */
  hasColorableMaterials() {
    return this.scene.hasColorableMaterials();
  }

  /**
   * @returns {number}
   */
  getColorableMaterialCount() {
    return this.scene.getColorableMaterialCount();
  }
}

/**
 * @param {NecklaceConfig} necklace
 * @param {string} colorId
 * @returns {ColorOption | undefined}
 */
function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

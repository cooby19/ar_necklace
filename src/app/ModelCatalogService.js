import { createDefaultColorSelection } from './AppState.js';

export class ModelCatalogService {
  constructor({ scene, necklaces }) {
    this.scene = scene;
    this.necklaces = necklaces;
    this.loadSequence = 0;
  }

  getById(necklaceId) {
    return this.necklaces.find((necklace) => necklace.id === necklaceId) ?? null;
  }

  createSelectionPatch(necklace) {
    return {
      selectedNecklace: necklace,
      selectedColorId: necklace.colorCustomization?.defaultColor ?? '',
      selectedColorIdsByTarget: createDefaultColorSelection(necklace),
    };
  }

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

  isLatestLoad(loadId) {
    return this.loadSequence === loadId;
  }

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

  getSelectedColorIdForTarget(state, targetId) {
    return (
      state.selectedColorIdsByTarget?.[targetId] ??
      state.selectedColorId ??
      state.selectedNecklace.colorCustomization?.defaultColor ??
      ''
    );
  }

  resolveColorSelectionTarget(necklace, targetId) {
    const activeTargetIds = this.getColorableTargets();
    if (targetId && activeTargetIds.includes(targetId)) return targetId;
    if (activeTargetIds.length === 1) return activeTargetIds[0];

    const defaultTarget = necklace.colorCustomization?.defaultTarget ?? 'all';
    if (defaultTarget !== 'all' && activeTargetIds.includes(defaultTarget)) return defaultTarget;
    return activeTargetIds[0] ?? '';
  }

  getMatchedColorTargetLabels(necklace) {
    const targetIds = this.getColorableTargets();
    const targets = necklace.colorCustomization?.targets ?? [];
    return targetIds
      .map((targetId) => targets.find((target) => target.id === targetId)?.label)
      .filter(Boolean);
  }

  getColorableTargets() {
    return this.scene.getColorableTargets();
  }

  hasColorableMaterials() {
    return this.scene.hasColorableMaterials();
  }

  getColorableMaterialCount() {
    return this.scene.getColorableMaterialCount();
  }
}

function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

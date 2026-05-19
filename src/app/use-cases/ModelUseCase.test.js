import { describe, expect, it, vi } from 'vitest';
import { ModelUseCase } from './ModelUseCase.js';
import { NECKLACES } from '../../config/necklaces.js';

describe('ModelUseCase', () => {
  it('selects a different necklace, reapplies calibration, and starts loading', () => {
    const next = { ...NECKLACES[0], id: 'next', label: '下一款' };
    const useCase = createModelUseCase({
      modelCatalog: {
        getById: vi.fn(() => next),
        createSelectionPatch: vi.fn(() => ({ selectedNecklace: next })),
      },
    });

    useCase.selectNecklace(next.id);

    expect(useCase.appState.set).toHaveBeenCalledWith({ selectedNecklace: next }, 'necklace-select');
    expect(useCase.necklaceController.reset).toHaveBeenCalledTimes(1);
    expect(useCase.applyCalibrationForSelectedNecklace).toHaveBeenCalledTimes(1);
    expect(useCase.modelCatalog.load).toHaveBeenCalledWith(next);
  });

  it('syncs unchanged necklace selection without reloading', () => {
    const selected = NECKLACES[0];
    const useCase = createModelUseCase({
      modelCatalog: {
        getById: vi.fn(() => selected),
      },
    });

    useCase.selectNecklace(selected.id);

    expect(useCase.ui.syncNecklaceSelection).toHaveBeenCalledWith(selected.id);
    expect(useCase.modelCatalog.load).not.toHaveBeenCalled();
  });

  it('applies selected color to matched targets and requests render', () => {
    const useCase = createModelUseCase({
      modelCatalog: {
        createColorSelection: vi.fn(() => ({
          patch: {
            selectedColorId: 'amethyst',
            selectedColorIdsByTarget: { gem: 'amethyst' },
          },
          targetIds: ['gem'],
        })),
      },
    });

    useCase.selectColor('amethyst', 'gem');

    expect(useCase.appState.set).toHaveBeenCalledWith(
      {
        selectedColorId: 'amethyst',
        selectedColorIdsByTarget: { gem: 'amethyst' },
      },
      'color-select',
    );
    expect(useCase.modelCatalog.applySelectedColors).toHaveBeenCalledWith(useCase.getState(), ['gem']);
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
  });

  it('loads the selected necklace and syncs color availability', async () => {
    const useCase = createModelUseCase({
      modelCatalog: {
        ensureColorSelectionForMatchedTargets: vi.fn(() => ({
          selectedColorIdsByTarget: { gem: 'rose-quartz' },
        })),
      },
    });

    await useCase.loadSelectedNecklace();

    expect(useCase.appState.set).toHaveBeenNthCalledWith(1, { modelLoaded: false }, 'model-load-start');
    expect(useCase.modelCatalog.load).toHaveBeenCalledWith(NECKLACES[0]);
    expect(useCase.appState.set).toHaveBeenCalledWith({ modelLoaded: true }, 'model-load-success');
    expect(useCase.appState.set).toHaveBeenCalledWith(
      { selectedColorIdsByTarget: { gem: 'rose-quartz' } },
      'color-target-defaults',
    );
    expect(useCase.modelCatalog.applySelectedColors).toHaveBeenCalledWith(useCase.getState());
    expect(useCase.syncModeEffects).toHaveBeenCalledTimes(1);
    expect(useCase.rendererLoop.requestRender).toHaveBeenCalledTimes(1);
    expect(useCase.ui.populateColorSwatches).toHaveBeenCalledTimes(2);
  });

  it('reports non-abort model loading failures', async () => {
    const useCase = createModelUseCase({
      modelCatalog: {
        load: vi.fn(() => Promise.reject(new Error('bad glb'))),
      },
    });

    await useCase.loadSelectedNecklace();

    expect(useCase.showError).toHaveBeenCalledWith(expect.stringContaining('bad glb'));
    expect(useCase.ui.setStatus).toHaveBeenCalledWith('error', '模型載入失敗', '請先放置 necklace.glb');
    expect(useCase.ui.populateColorSwatches).toHaveBeenCalledTimes(2);
  });
});

function createModelUseCase(overrides = {}) {
  const { modelCatalog: modelCatalogOverrides, ...optionOverrides } = overrides;
  let state = {
    selectedNecklace: NECKLACES[0],
    selectedColorId: 'rose-quartz',
    selectedColorIdsByTarget: {},
    modelLoaded: false,
  };
  const setState = (patch = {}) => {
    state = { ...state, ...patch };
    return state;
  };
  const colorUiModel = {
    swatches: {
      necklace: state.selectedNecklace,
      selectedColorIdsByTarget: state.selectedColorIdsByTarget,
      fallbackColorId: state.selectedColorId,
      targetIds: [],
    },
    availability: {
      necklace: state.selectedNecklace,
      modelLoaded: state.modelLoaded,
      hasColorableMaterials: true,
      targetLabels: [],
    },
  };
  const modelCatalog = {
    getById: vi.fn(() => null),
    createSelectionPatch: vi.fn((necklace) => ({ selectedNecklace: necklace })),
    createColorSelection: vi.fn(() => null),
    applySelectedColors: vi.fn(),
    load: vi.fn(() => Promise.resolve({ status: 'loaded', necklace: state.selectedNecklace })),
    ensureColorSelectionForMatchedTargets: vi.fn(() => null),
    buildColorUiModel: vi.fn(() => colorUiModel),
    ...(modelCatalogOverrides ?? {}),
  };

  const useCase = new ModelUseCase({
    appState: {
      get: vi.fn((key) => state[key]),
      getSnapshot: vi.fn(() => state),
      set: vi.fn((patch) => setState(patch)),
    },
    ui: {
      syncNecklaceSelection: vi.fn(),
      clearError: vi.fn(),
      setStatus: vi.fn(),
      populateColorSwatches: vi.fn(),
      updateColorUiAvailability: vi.fn(),
    },
    modelCatalog,
    necklaceController: {
      reset: vi.fn(),
    },
    rendererLoop: {
      requestRender: vi.fn(),
    },
    applyCalibrationForSelectedNecklace: vi.fn(),
    syncModeEffects: vi.fn(),
    showError: vi.fn(),
    ...optionOverrides,
  });

  return useCase;
}

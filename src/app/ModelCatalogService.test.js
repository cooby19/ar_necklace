import { describe, expect, it, vi } from 'vitest';
import { ModelCatalogService } from './ModelCatalogService.js';

const necklace = {
  id: 'logic-necklace',
  label: '邏輯測試款',
  colorCustomization: {
    defaultColor: 'rose-quartz',
    defaultTarget: 'all',
    targets: [
      { id: 'metal', label: '金屬' },
      { id: 'pendant', label: '墜飾' },
      { id: 'gem', label: '寶石' },
    ],
    palette: [
      { id: 'rose-quartz', label: '粉晶', color: '#F6C6D3' },
      { id: 'moonstone', label: '月光石', color: '#AFC8FF' },
    ],
  },
};

function createScene({ targetIds = ['gem'], hasColorableMaterials = true } = {}) {
  return {
    loadNecklace: vi.fn().mockResolvedValue(undefined),
    getColorableTargets: vi.fn(() => targetIds),
    hasColorableMaterials: vi.fn(() => hasColorableMaterials),
    getColorableMaterialCount: vi.fn(() => targetIds.length),
    applyColor: vi.fn(() => true),
  };
}

describe('ModelCatalogService color selection', () => {
  it('creates selection patches from necklace defaults', () => {
    const service = new ModelCatalogService({ scene: createScene(), necklaces: [necklace] });

    expect(service.createSelectionPatch(necklace)).toMatchObject({
      selectedNecklace: necklace,
      selectedColorId: 'rose-quartz',
      selectedColorIdsByTarget: {
        metal: 'rose-quartz',
        pendant: 'rose-quartz',
        gem: 'rose-quartz',
      },
    });
  });

  it('resolves color selection to the active matched target', () => {
    const service = new ModelCatalogService({ scene: createScene({ targetIds: ['gem'] }), necklaces: [necklace] });
    const selection = service.createColorSelection(
      {
        selectedNecklace: necklace,
        selectedColorId: 'rose-quartz',
        selectedColorIdsByTarget: {},
      },
      'moonstone',
      'missing-target',
    );

    expect(selection).toEqual({
      patch: {
        selectedColorId: 'moonstone',
        selectedColorIdsByTarget: {
          gem: 'moonstone',
        },
      },
      targetIds: ['gem'],
    });
  });

  it('reports labels only for matched color targets', () => {
    const service = new ModelCatalogService({
      scene: createScene({ targetIds: ['gem', 'unknown', 'metal'] }),
      necklaces: [necklace],
    });

    expect(service.getMatchedColorTargetLabels(necklace)).toEqual(['寶石', '金屬']);
  });

  it('fills missing matched targets with the default color and applies selected colors', () => {
    const scene = createScene({ targetIds: ['gem', 'metal'] });
    const service = new ModelCatalogService({ scene, necklaces: [necklace] });
    const state = {
      selectedNecklace: necklace,
      selectedColorId: 'moonstone',
      selectedColorIdsByTarget: {
        gem: 'moonstone',
      },
    };

    expect(service.ensureColorSelectionForMatchedTargets(state)).toEqual({
      selectedColorIdsByTarget: {
        gem: 'moonstone',
        metal: 'rose-quartz',
      },
    });

    service.applySelectedColors({
      ...state,
      selectedColorIdsByTarget: {
        gem: 'moonstone',
        metal: 'rose-quartz',
      },
    });

    expect(scene.applyColor).toHaveBeenCalledWith('gem', '#AFC8FF');
    expect(scene.applyColor).toHaveBeenCalledWith('metal', '#F6C6D3');
  });
});

import type {
  ColorSelectionByTarget,
  NecklaceConfig,
  WearAdjustmentPatch,
} from './domain';

export interface UiRuntimeElementsPort {
  stage: HTMLElement;
  video: HTMLVideoElement;
  threeCanvas: HTMLCanvasElement;
  debugCanvas: HTMLCanvasElement;
}

export interface UiRuntimePort {
  elements: UiRuntimeElementsPort;
  showError(message: string): void;
}

export interface ColorSwatchesUiModel {
  necklace: NecklaceConfig;
  selectedColorIdsByTarget: ColorSelectionByTarget;
  fallbackColorId: string;
  targetIds: string[];
}

export interface ColorAvailabilityUiModel {
  necklace: NecklaceConfig;
  modelLoaded: boolean;
  hasColorableMaterials: boolean;
  targetLabels: string[];
}

export interface ColorUiModel {
  swatches: ColorSwatchesUiModel;
  availability: ColorAvailabilityUiModel;
}

export interface TuningControlsReadResult {
  raw: {
    verticalOffset: number;
    scale: number;
    rotation: number;
  };
  adjustments: WearAdjustmentPatch;
}

export interface CalibrationHintOptions {
  isDirty?: boolean;
  isSaved?: boolean;
}

import type {
  AppStateMeta,
  AppStateSnapshot,
  ColorSelectionByTarget,
  DeveloperPanelModel,
  NecklaceConfig,
  WearAdjustmentPatch,
  WorkflowStatusView,
} from './domain';

export interface UiElementsPort {
  stage: HTMLElement;
  video: HTMLVideoElement;
  threeCanvas: HTMLCanvasElement;
  debugCanvas: HTMLCanvasElement;
  startButton: HTMLButtonElement;
  switchCameraButton: HTMLButtonElement;
  stopCameraButton: HTMLButtonElement;
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

export interface UiControllerPort {
  elements: UiElementsPort;
  populateNecklaceSelect(selectedNecklaceId: string): void;
  populateColorSwatches(model: ColorSwatchesUiModel): void;
  syncFromState(state: AppStateSnapshot, meta?: Partial<AppStateMeta>): void;
  canSelectControlPanel(panelName: string): boolean;
  setShowcaseDragging(isDragging: boolean): void;
  setCalibrationDragging(isDragging: boolean): void;
  syncTuningControlsFromAdjustments(adjustments: WearAdjustmentPatch): TuningControlsReadResult;
  setCalibrationHint(message: string, options?: CalibrationHintOptions): void;
  readTuningControls(): TuningControlsReadResult;
  clearError(): void;
  showError(message: string): void;
  setStartButtonLabel(label: string): void;
  setCameraOn(isCameraOn: boolean): void;
  setCaptureDisabled(isDisabled: boolean): void;
  setCaptureBusy(isBusy: boolean): void;
  setStatus(kind: WorkflowStatusView['kind'], label: string, metrics: string): void;
  setShareImage(url: string): void;
  openShareSheet(): void;
  closeShareSheet(): void;
  updateDeveloperPanel(model: DeveloperPanelModel): void;
  updateColorUiAvailability(availability: ColorAvailabilityUiModel): void;
  syncNecklaceSelection(necklaceId: string): void;
  hasCurrentVideoFrame(): boolean;
}

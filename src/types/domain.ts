export type CameraFacingMode = 'user' | 'environment';

export type AppMode = 'showcase' | 'ar';

export type ArSessionStatus =
  | 'showcase'
  | 'arIdle'
  | 'cameraStarting'
  | 'noFace'
  | 'tracking'
  | 'capturing'
  | 'sharing'
  | 'error';

export type ControlPanelName = 'styles' | 'fit' | string;

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type FaceLandmarkList = readonly LandmarkPoint[];

export type FaceLandmarksResult = FaceLandmarkList;

export interface FaceMeshResults {
  multiFaceLandmarks?: readonly FaceLandmarkList[];
  multiFaceWorldLandmarks?: readonly FaceLandmarkList[];
  image?: CanvasImageSource;
}

export type FaceTrackerResultsHandler = (results: FaceMeshResults) => void;

export interface FaceMetrics {
  chin: LandmarkPoint;
  forehead: LandmarkPoint;
  leftCheek: LandmarkPoint;
  rightCheek: LandmarkPoint;
  faceCenter: LandmarkPoint;
  cheekCenter: LandmarkPoint;
  faceWidth: number;
  faceHeight: number;
  roll: number;
  yawSignal: number;
  noseYawSignal: number;
  cheekDepthYawSignal: number;
}

export interface NecklaceDebugData extends FaceMetrics {
  yawSignal: number;
  neckPoint: LandmarkPoint;
  worldPosition: Required<Pick<LandmarkPoint, 'x' | 'y' | 'z'>>;
  scale: number;
  rotationY: number;
  rotationZ: number;
  opacity: number;
}

export interface WearAdjustments {
  horizontalOffset: number;
  verticalOffset: number;
  scaleMultiplier: number;
  rotationOffset: number;
}

export type WearAdjustmentPatch = Partial<WearAdjustments>;

export interface TuningDefaults {
  verticalOffset: number;
  scale: number;
  rotation: number;
}

export interface DebugTuning {
  landmarkSampleStep: number;
  pointRadius: number;
}

export interface InferenceTuning {
  targetFps: number;
  minFps: number;
  maxFps: number;
  adaptiveEnabled: boolean;
  slowFrameRatio: number;
  fastFrameRatio: number;
  adjustCooldownMs: number;
  fpsStep: number;
  averageWindowSize: number;
}

export interface SmoothingTuning {
  position: number;
  scale: number;
  rotation: number;
  yaw: number;
  opacity: number;
}

export interface TrackingTuning {
  neckOffsetFromChin: number;
  necklaceWidthToFaceWidth: number;
  necklaceVerticalLift: number;
  scaleWidthFromFaceHeight: number;
  scaleWidthMinFromHeight: number;
  scaleWidthMaxFromHeight: number;
  sideScaleHeightBlend: number;
  yawStrength: number;
  yawDirection: 1 | -1;
  yawNoseWeight: number;
  yawDepthWeight: number;
  yawDepthStrength: number;
  maxYawRadians: number;
  yawAnchorBlend: number;
  yawPositionShift: number;
  sideViewVerticalLift: number;
  minVisibilityConfidence: number;
  missingFaceFadeStep: number;
  presentFaceFadeStep: number;
  smoothing: SmoothingTuning;
  inference: InferenceTuning;
  debug: DebugTuning;
}

export interface ColorMaterialTuning {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface ColorMeaning {
  keywords?: readonly string[];
  summary?: string;
}

export interface ColorOption {
  id: string;
  label: string;
  color: string;
  meaning?: ColorMeaning;
  material?: ColorMaterialTuning;
}

export interface ColorTarget {
  id: string;
  label: string;
  materialNameIncludes: readonly string[];
}

export interface ColorCustomization {
  defaultColor?: string;
  defaultTarget?: string | 'all';
  targets: readonly ColorTarget[];
  palette: readonly ColorOption[];
}

export interface OccluderPartsConfig {
  nameIncludes: readonly string[];
}

export interface NecklaceTransform {
  baseScale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface NecklaceConfig {
  id: string;
  label: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  preserveAuthorOrigin?: boolean;
  occluderParts?: OccluderPartsConfig;
  colorCustomization?: ColorCustomization;
  transform: NecklaceTransform;
}

export type ColorSelectionByTarget = Record<string, string>;

export interface AppStateSnapshot {
  mode: AppMode;
  sessionStatus: ArSessionStatus;
  cameraStarted: boolean;
  cameraFacingMode: CameraFacingMode;
  isSwitchingCamera: boolean;
  modelLoaded: boolean;
  selectedNecklace: NecklaceConfig;
  selectedColorId: string;
  selectedColorIdsByTarget: ColorSelectionByTarget;
  necklaceVisible: boolean;
  debugEnabled: boolean;
  activePanel: ControlPanelName;
  controlsCollapsed: boolean;
  captureDataUrl: string;
  captureBlob: Blob | null;
  adjustments: WearAdjustments;
}

export type AppStatePatch = Partial<Omit<AppStateSnapshot, 'adjustments'>> & {
  adjustments?: WearAdjustmentPatch;
};

export interface AppStateMeta {
  previous: AppStateSnapshot;
  changes: readonly (keyof AppStatePatch)[];
  eventName: string;
}

export type AppStateListener = (snapshot: AppStateSnapshot, meta: AppStateMeta) => void;

export interface TrackerStats {
  currentFps: number;
  targetFps: number;
  averageInferenceMs: number;
  lastInferenceMs: number;
  skippedFrameCount: number;
  inferenceCount: number;
  schedulerType: 'raf' | 'video-frame';
}

export type RenderSchedulerMode = 'idle' | 'showcase' | 'ar-live' | 'paused';

export interface RenderStats {
  fps: number;
  frameCount: number;
  lastSampleAt: number;
  schedulerMode: RenderSchedulerMode;
  isRunning: boolean;
  isPaused: boolean;
}

export interface RealtimeTrackingSnapshot {
  hasFace: boolean;
  latestLandmarks: FaceLandmarkList | null;
  debugData: NecklaceDebugData | null;
  frameSequence: number;
  trackerStats: TrackerStats;
  renderStats: RenderStats;
  updatedAt: number;
}

export interface RealtimeTrackingFramePatch {
  hasFace?: boolean;
  landmarks?: FaceLandmarkList | null;
  debugData?: NecklaceDebugData | null;
}

export interface DeveloperPanelModel {
  debugData: NecklaceDebugData | null;
  stats: TrackerStats & { renderFps?: number };
  modelUrl?: string;
  materialHitCount?: number;
}

export type TrackingStatusKind = 'idle' | 'tracking' | 'error';

export type StatusViewKind = TrackingStatusKind | 'loading';

export interface WorkflowStatusView {
  kind: StatusViewKind;
  label: string;
  metrics: string;
}

export interface FaceTrackingAdvice {
  id: string;
  kind: TrackingStatusKind;
  label: string;
  message: string;
  priority: number;
}

export interface CaptureResult {
  url: string;
  dataUrl: string;
  blob: Blob;
}

export type ShareStatus = 'shared' | 'unsupported' | 'aborted' | 'empty';

export interface ShareResult {
  status: ShareStatus;
}

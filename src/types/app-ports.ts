import type {
  AppStatePatch,
  AppStateSnapshot,
  ArSessionStatus,
  CaptureResult,
  FaceLandmarkList,
  FaceTrackingAdvice,
  NecklaceDebugData,
  RenderStats,
  ShareResult,
  TrackerStats,
} from './domain';

export interface AppStatePort {
  get<K extends keyof AppStateSnapshot>(key: K): AppStateSnapshot[K];
  getSnapshot(): AppStateSnapshot;
  set(patch: AppStatePatch | null | undefined, eventName?: string): AppStateSnapshot;
  update(
    updater: (snapshot: AppStateSnapshot) => AppStatePatch | null | undefined,
    eventName?: string,
  ): AppStateSnapshot;
  transitionSession(
    nextStatus: ArSessionStatus,
    patch?: AppStatePatch,
    eventName?: string,
  ): AppStateSnapshot;
}

export type CaptureDownloadInput =
  | {
      blob?: Blob | null;
      url?: string;
      dataUrl?: string;
    }
  | string;

export interface CaptureServicePort {
  createCapture(options: { mirrored: boolean }): Promise<CaptureResult>;
  download(capture: CaptureDownloadInput): void;
  share(blob: Blob): Promise<ShareResult>;
}

export interface FaceQualityAdvisorPort {
  getAdvice(input: {
    landmarks?: FaceLandmarkList | null;
    debugData?: NecklaceDebugData | null;
    now?: number;
  }): FaceTrackingAdvice;
}

export interface TrackingModelCatalogPort {
  getColorableMaterialCount(): number;
}

export interface TrackingCalibrationPort {
  hasCalibration(necklaceId: string): boolean;
}

export interface TrackingFeedbackOptions {
  faceQualityAdvisor: FaceQualityAdvisorPort;
  getTrackerStats(): TrackerStats;
  getRenderStats(): RenderStats;
  modelCatalog: TrackingModelCatalogPort;
  calibrationService: TrackingCalibrationPort;
}

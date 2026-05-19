import type {
  AppStatePatch,
  AppStateSnapshot,
  ArSessionStatus,
  CaptureResult,
  ShareResult,
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

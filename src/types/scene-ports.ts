import type {
  FaceLandmarkList,
  LandmarkPoint,
  NecklaceConfig,
  NecklaceDebugData,
} from './domain';

export type WorldPoint = Required<Pick<LandmarkPoint, 'x' | 'y' | 'z'>>;

export interface NecklaceSceneColorPort {
  loadNecklace(necklace: NecklaceConfig): Promise<unknown>;
  getColorableTargets(): string[];
  hasColorableMaterials(): boolean;
  getColorableMaterialCount(): number;
  applyColor(targetId: string, color: string): boolean;
}

export interface NecklaceSceneTrackingPort {
  screenToWorld(point: LandmarkPoint): WorldPoint;
  normalizedSegmentToWorldLength(start: LandmarkPoint, end: LandmarkPoint): number;
  updateTransform(transform: {
    position: WorldPoint;
    scale: number;
    rotationY: number;
    rotationZ: number;
  }): void;
  setOpacity(opacity: number): void;
}

export interface RendererScenePort {
  updateShowcase(now: number): void;
  render(): void;
}

export interface CaptureScenePort {
  renderForCapture(): void;
}

export interface DebugOverlayPort {
  render(landmarks: FaceLandmarkList | null, debugData: NecklaceDebugData | null): void;
}

export interface NecklaceSceneShowcasePort {
  resize(): void;
  setShowcaseMode(isShowcase: boolean): void;
  beginShowcaseDrag(clientX: number): void;
  dragShowcase(clientX: number): void;
  endShowcaseDrag(): void;
}

export interface NecklaceSceneModePort
  extends NecklaceSceneColorPort,
    NecklaceSceneTrackingPort,
    RendererScenePort,
    CaptureScenePort,
    NecklaceSceneShowcasePort {}

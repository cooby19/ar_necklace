import type {
  FaceLandmarkList,
  LandmarkPoint,
  ColorTarget,
  NecklaceConfig,
  NecklaceDebugData,
  OccluderPartsConfig,
} from './domain';
import type { Object3D, Scene, Texture } from 'three';

export type WorldPoint = Required<Pick<LandmarkPoint, 'x' | 'y' | 'z'>>;

export interface StageSize {
  width: number;
  height: number;
}

export type StageSizeReader = () => StageSize;

export interface NecklaceSceneTransform {
  position: WorldPoint;
  scale: number;
  rotationY: number;
  rotationZ: number;
}

export interface GlbSceneAsset {
  scene: Object3D;
}

export interface GlbAssetTimings {
  fetchMs: number;
  parseMs: number;
  totalAssetMs: number;
}

export interface NecklaceAssetLoadTimings {
  fetchMs: number;
  parseMs: number;
  prepareMs: number;
  totalMs: number;
}

export interface GlbAssetLoadResult {
  gltf: GlbSceneAsset;
  timings: GlbAssetTimings;
}

export interface GlbAssetLoaderPort {
  loadGlb(
    url: string,
    signal: AbortSignal,
    options?: { onFetchComplete?: () => void },
  ): Promise<GlbAssetLoadResult>;
  logLoadTimings(config: NecklaceConfig, timings: NecklaceAssetLoadTimings): void;
  clearCache(): void;
}

export interface RendererHostPort {
  scene: Scene;
  environmentMap: Texture | null;
  getStageSize(): StageSize;
  resize(): void;
  render(): void;
  dispose(): void;
}

export interface ModelResourceDisposerPort {
  disposeObject3DResources(root: Object3D): void;
}

export interface MaterialCustomizationPort {
  reset(): void;
  prepareGemMaterials(model: Object3D): void;
  collectColorableMaterials(model: Object3D, targets?: readonly ColorTarget[]): void;
  collectOpacityMaterials(model: Object3D): void;
  getColorableTargets(): string[];
  hasColorableMaterials(): boolean;
  getColorableMaterialCount(): number;
  applyColor(targetId: string, color: string): boolean;
  setOpacity(opacity: number): number;
}

export interface OccluderProcessorPort {
  process(model: Object3D, occluderParts?: OccluderPartsConfig): void;
}

export interface PlacementAdapterPort {
  prepareModel(model: Object3D, config: NecklaceConfig): void;
  setModel(model: Object3D): void;
  getModel(): Object3D | null;
  hasModel(): boolean;
  removeModel(model: Object3D): void;
  clearModel(): void;
  applyAssetTransform(config: NecklaceConfig): void;
  setVisible(isVisible: boolean): void;
  updateTransform(transform: NecklaceSceneTransform): void;
  applyShowcaseTransform(rotationY: number): void;
  screenToWorld(point: LandmarkPoint): WorldPoint;
  normalizedLengthToWorldX(length: number): number;
  normalizedSegmentToWorldLength(start: LandmarkPoint, end: LandmarkPoint): number;
}

export interface ShowcasePresenterPort {
  resetTiming(): void;
  setShowcaseMode(isEnabled: boolean): void;
  beginShowcaseDrag(clientX: number): void;
  dragShowcase(clientX: number): void;
  endShowcaseDrag(): void;
  updateShowcase(time?: number): void;
}

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
  updateTransform(transform: NecklaceSceneTransform): void;
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

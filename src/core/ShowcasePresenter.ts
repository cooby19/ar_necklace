import type { PlacementAdapterPort, ShowcasePresenterPort } from '../types/scene-ports';

interface ShowcasePresenterOptions {
  placement: Pick<PlacementAdapterPort, 'hasModel' | 'applyShowcaseTransform'>;
  setOpacity: (opacity: number) => void;
  autoRotateSpeed?: number;
  dragRotationSpeed?: number;
}

export class ShowcasePresenter implements ShowcasePresenterPort {
  placement: Pick<PlacementAdapterPort, 'hasModel' | 'applyShowcaseTransform'>;
  setOpacity: (opacity: number) => void;
  enabled: boolean;
  isDragging: boolean;
  rotationY: number;
  lastClientX: number;
  lastTime: number;
  autoRotateSpeed: number;
  dragRotationSpeed: number;

  constructor({
    placement,
    setOpacity,
    autoRotateSpeed = 0.00018,
    dragRotationSpeed = 0.012,
  }: ShowcasePresenterOptions) {
    this.placement = placement;
    this.setOpacity = setOpacity;
    this.enabled = false;
    this.isDragging = false;
    this.rotationY = 0;
    this.lastClientX = 0;
    this.lastTime = 0;
    this.autoRotateSpeed = autoRotateSpeed;
    this.dragRotationSpeed = dragRotationSpeed;
  }

  resetTiming(): void {
    this.lastTime = 0;
  }

  setShowcaseMode(isEnabled: boolean): void {
    this.enabled = isEnabled;
    this.isDragging = false;
    this.resetTiming();

    if (!isEnabled) return;

    this.setOpacity(1);
    this.updateShowcaseTransform();
  }

  beginShowcaseDrag(clientX: number): void {
    if (!this.enabled) return;

    this.isDragging = true;
    this.lastClientX = clientX;
  }

  dragShowcase(clientX: number): void {
    if (!this.enabled || !this.isDragging) return;

    const deltaX = clientX - this.lastClientX;
    this.lastClientX = clientX;
    this.rotationY += deltaX * this.dragRotationSpeed;
    this.updateShowcaseTransform();
  }

  endShowcaseDrag(): void {
    this.isDragging = false;
  }

  updateShowcase(time = 0): void {
    if (!this.enabled || !this.placement.hasModel()) return;

    if (!this.isDragging) {
      const previousTime = this.lastTime || time;
      const delta = Math.min(48, Math.max(0, time - previousTime));
      this.rotationY += delta * this.autoRotateSpeed;
    }

    this.lastTime = time;
    this.updateShowcaseTransform();
  }

  updateShowcaseTransform(): void {
    this.placement.applyShowcaseTransform(this.rotationY);
  }
}

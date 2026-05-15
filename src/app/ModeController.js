import {
  APP_MODES,
  CAMERA_FACING_MODES,
  createDefaultColorSelection,
  getCameraLabel,
  getCameraSwitchingLabel,
  isSelfieCamera,
  normalizeFacingMode,
} from './AppState.js';
import { CameraStream } from '../core/CameraStream.js';
import { DebugOverlay } from '../core/DebugOverlay.js';
import { FaceTracker } from '../core/FaceTracker.js';
import { FaceQualityAdvisor } from '../core/FaceQualityAdvisor.js';
import { NecklaceController } from '../core/NecklaceController.js';
import { NecklaceScene } from '../core/NecklaceScene.js';
import { WearCalibration } from '../core/WearCalibration.js';

export class ModeController {
  constructor({ appState, uiController, captureService, necklaces }) {
    this.appState = appState;
    this.ui = uiController;
    this.captureService = captureService;
    this.necklaces = necklaces;
    this.necklaceLoadSequence = 0;
    this.calibrationDrag = null;
    this.calibrationPromptedIds = new Set();
    this.renderStats = {
      fps: 0,
      frameCount: 0,
      lastSampleAt: performance.now(),
    };

    this.camera = new CameraStream(this.ui.elements.video);
    this.scene = new NecklaceScene({
      canvas: this.ui.elements.threeCanvas,
      stageElement: this.ui.elements.stage,
      onError: (message) => this.showError(message),
    });
    this.controller = new NecklaceController(this.scene);
    this.wearCalibration = new WearCalibration();
    this.faceQualityAdvisor = new FaceQualityAdvisor({
      video: this.ui.elements.video,
    });
    this.debugOverlay = new DebugOverlay({
      canvas: this.ui.elements.debugCanvas,
      stageElement: this.ui.elements.stage,
    });
    this.faceTracker = new FaceTracker({
      video: this.ui.elements.video,
      onResults: (results) => this.handleFaceResults(results),
      onError: (error) => this.showError(`Face Mesh 偵測發生錯誤：${error.message ?? error}`),
      onStatsUpdate: () => this.handleFaceTrackerStats(),
    });
  }

  init() {
    const state = this.getState();
    this.ui.populateNecklaceSelect(state.selectedNecklace.id);
    this.ui.populateColorSwatches({
      necklace: state.selectedNecklace,
      selectedColorIdsByTarget: state.selectedColorIdsByTarget,
      fallbackColorId: state.selectedColorId,
      targetIds: [],
    });
    this.ui.syncFromState(state);
    this.applyCalibrationForSelectedNecklace();
    this.syncColorAvailability();
    this.syncModeEffects();
    this.loadSelectedNecklace();
    this.animate();
  }

  selectMode(mode) {
    const state = this.getState();
    if (!Object.values(APP_MODES).includes(mode) || state.mode === mode) return;

    if (mode === APP_MODES.SHOWCASE && state.cameraStarted) {
      this.stopCameraSession();
    }

    const patch = {
      mode,
      lastLandmarks: null,
      lastDebugData: null,
      hasFace: false,
    };

    if (mode !== APP_MODES.AR && state.activePanel === 'fit') {
      patch.activePanel = 'styles';
    }

    this.appState.set(patch, 'mode-select');

    if (mode === APP_MODES.AR) {
      this.scene.setShowcaseMode(false);
      this.controller.reset();
    }

    this.syncModeEffects();
  }

  selectControlPanel(panelName) {
    if (!this.ui.canSelectControlPanel(panelName)) return;
    this.appState.set({ activePanel: panelName }, 'panel-select');
  }

  toggleBottomSheet() {
    this.appState.update((state) => ({ controlsCollapsed: !state.controlsCollapsed }), 'bottom-sheet-toggle');
  }

  handleShowcasePointerDown(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerDown(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

    this.ui.elements.threeCanvas.setPointerCapture?.(event.pointerId);
    this.ui.setShowcaseDragging(true);
    this.scene.beginShowcaseDrag(event.clientX);
  }

  handleShowcasePointerMove(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerMove(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

    this.scene.dragShowcase(event.clientX);
  }

  handleShowcasePointerUp(event) {
    const state = this.getState();
    if (state.mode === APP_MODES.AR) {
      this.handleCalibrationPointerUp(event);
      return;
    }

    if (state.mode !== APP_MODES.SHOWCASE) return;

    this.ui.elements.threeCanvas.releasePointerCapture?.(event.pointerId);
    this.ui.setShowcaseDragging(false);
    this.scene.endShowcaseDrag();
  }

  handleCalibrationPointerDown(event) {
    const state = this.getState();
    if (!state.cameraStarted || !state.modelLoaded || !state.hasFace || !state.necklaceVisible) return;

    this.ui.elements.threeCanvas.setPointerCapture?.(event.pointerId);
    this.calibrationDrag = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    this.ui.setCalibrationDragging(true);
    event.preventDefault();
  }

  handleCalibrationPointerMove(event) {
    if (!this.calibrationDrag || this.calibrationDrag.pointerId !== event.pointerId) return;

    const rect = this.ui.elements.stage.getBoundingClientRect();
    const deltaX = rect.width > 0 ? (event.clientX - this.calibrationDrag.lastClientX) / rect.width : 0;
    const deltaY = rect.height > 0 ? (event.clientY - this.calibrationDrag.lastClientY) / rect.height : 0;
    this.calibrationDrag.lastClientX = event.clientX;
    this.calibrationDrag.lastClientY = event.clientY;

    const state = this.getState();
    this.applyTuning(
      {
        horizontalOffset: (state.adjustments.horizontalOffset ?? 0) + deltaX,
        verticalOffset: (state.adjustments.verticalOffset ?? 0) + deltaY,
      },
      'calibration-drag',
    );
    this.ui.syncTuningControlsFromAdjustments(this.appState.get('adjustments'));
    this.updateCalibrationHint({ dirty: true });
    event.preventDefault();
  }

  handleCalibrationPointerUp(event) {
    if (!this.calibrationDrag || this.calibrationDrag.pointerId !== event.pointerId) return;

    this.ui.elements.threeCanvas.releasePointerCapture?.(event.pointerId);
    this.calibrationDrag = null;
    this.ui.setCalibrationDragging(false);
  }

  async startExperience() {
    this.ui.clearError();
    this.ui.elements.startButton.disabled = true;
    this.ui.elements.switchCameraButton.disabled = true;
    this.ui.elements.stopCameraButton.disabled = true;
    this.ui.setStartButtonLabel('啟動中...');

    try {
      await this.startCameraForMode(this.appState.get('cameraFacingMode'));
      this.appState.set({ cameraStarted: true }, 'camera-start');
      this.ui.setCameraOn(true);
      this.ui.setCaptureDisabled(false);
      this.ui.setStatus('idle', '相機已啟動', '正在尋找臉部');
      this.ui.setStartButtonLabel('相機運作中');
    } catch (error) {
      this.stopCameraSession();
      this.showError(`無法啟動相機：${error.message ?? error}`);
      this.ui.setStatus('error', '相機啟動失敗', '請確認瀏覽器權限與 HTTPS/localhost 環境');
    }
  }

  stopExperience() {
    const state = this.getState();
    if (!state.cameraStarted && !state.isSwitchingCamera) return;

    this.ui.clearError();
    this.stopCameraSession();
    this.ui.setStatus('idle', '相機已關閉', '鏡頭已停止，可重新開啟相機');
  }

  async switchCamera() {
    const state = this.getState();
    if (!state.cameraStarted || state.isSwitchingCamera) return;

    const previousFacingMode = state.cameraFacingMode;
    const nextFacingMode =
      previousFacingMode === CAMERA_FACING_MODES.USER
        ? CAMERA_FACING_MODES.ENVIRONMENT
        : CAMERA_FACING_MODES.USER;

    this.ui.clearError();
    this.appState.set({ isSwitchingCamera: true }, 'camera-switch-start');
    this.ui.setCaptureDisabled(true);
    this.ui.setStatus('idle', '正在切換鏡頭', getCameraSwitchingLabel(nextFacingMode));

    try {
      await this.startCameraForMode(nextFacingMode, { strictFacingMode: true });
      this.ui.setStatus('idle', '鏡頭已切換', this.getActiveCameraLabel());
    } catch (error) {
      const failedLabel = getCameraLabel(nextFacingMode);
      this.showError(`無法切換到${failedLabel}：${error.message ?? error}`);
      this.ui.setStatus('error', '鏡頭切換失敗', `正在恢復${getCameraLabel(previousFacingMode)}`);

      try {
        await this.startCameraForMode(previousFacingMode);
        this.ui.setStatus('idle', '已恢復原鏡頭', this.getActiveCameraLabel());
      } catch (restoreError) {
        this.stopCameraSession();
        this.showError(`鏡頭切換失敗，且無法恢復原鏡頭：${restoreError.message ?? restoreError}`);
        this.ui.setStatus('error', '相機已停止', '請重新啟動相機');
      }
    } finally {
      this.appState.set({ isSwitchingCamera: false }, 'camera-switch-end');
      this.ui.setCaptureDisabled(!this.appState.get('cameraStarted'));
    }
  }

  async startCameraForMode(facingMode, { strictFacingMode = false } = {}) {
    this.faceTracker.stop();
    this.controller.fadeOut();
    this.appState.set(
      {
        hasFace: false,
        lastLandmarks: null,
        lastDebugData: null,
      },
      'camera-session-reset',
    );
    this.faceTracker.setSelfieMode(isSelfieCamera(facingMode));

    await this.camera.start({ facingMode, strictFacingMode });

    const cameraFacingMode = normalizeFacingMode(this.camera.getFacingMode(), facingMode);
    this.appState.set({ cameraFacingMode }, 'camera-facing-mode');
    this.faceTracker.setSelfieMode(isSelfieCamera(cameraFacingMode));
    this.scene.resize();
    this.debugOverlay.resize();
    await this.faceTracker.start();
  }

  stopCameraSession() {
    this.camera.stop();
    this.faceTracker.stop();
    this.controller.reset();
    this.calibrationDrag = null;
    this.ui.setCalibrationDragging(false);
    this.appState.set(
      {
        cameraStarted: false,
        isSwitchingCamera: false,
        hasFace: false,
        lastLandmarks: null,
        lastDebugData: null,
      },
      'camera-stop',
    );
    this.ui.setCameraOn(false);
    this.ui.setCaptureDisabled(true);
    this.ui.elements.startButton.disabled = false;
    this.ui.setStartButtonLabel('開始相機');
  }

  async handleCapture() {
    this.ui.clearError();
    const state = this.getState();

    if (!state.cameraStarted || !this.ui.hasCurrentVideoFrame()) {
      this.ui.setStatus('idle', '尚未開啟相機', '請先啟動相機再拍照');
      return;
    }

    if (!state.hasFace) {
      this.ui.setStatus('idle', '尚未偵測到臉', '請將臉保持在畫面中央後再拍照');
      return;
    }

    if (!state.necklaceVisible) {
      this.ui.setStatus('idle', '項鍊目前隱藏', '請先開啟項鍊預覽再拍照');
      return;
    }

    this.ui.setCaptureDisabled(true);
    this.ui.setCaptureBusy(true);

    try {
      this.scene.renderForCapture();
      const capture = await this.captureService.createCapture({
        mirrored: isSelfieCamera(state.cameraFacingMode),
      });
      this.appState.set(
        {
          captureDataUrl: capture.dataUrl,
          captureBlob: capture.blob,
        },
        'capture-create',
      );
      this.ui.setShareImage(capture.dataUrl);
      this.ui.openShareSheet();
      this.ui.setStatus('tracking', '美圖已產出', '可下載或分享給朋友');
    } catch (error) {
      this.showError(`無法產生美圖：${error.message ?? error}`);
    } finally {
      this.ui.setCaptureDisabled(!this.appState.get('cameraStarted'));
      this.ui.setCaptureBusy(false);
    }
  }

  downloadCapture() {
    const dataUrl = this.appState.get('captureDataUrl');
    if (!dataUrl) return;

    this.captureService.download(dataUrl);
    this.ui.setStatus('idle', '圖片已下載', '可以上傳 Instagram 或傳給朋友');
  }

  async shareCapture() {
    const state = this.getState();
    if (!state.captureBlob) return;

    try {
      const result = await this.captureService.share(state.captureBlob);

      if (result.status === 'shared') {
        this.ui.setStatus('idle', '分享面板已開啟', '選擇 Instagram、訊息或好友');
        return;
      }

      if (result.status === 'unsupported') {
        this.downloadCapture();
        this.ui.setStatus('idle', '此瀏覽器不支援直接分享', '已改為下載圖片');
      }
    } catch (error) {
      this.showError(`分享失敗：${error.message ?? error}`);
    }
  }

  closeShareSheet() {
    this.ui.closeShareSheet();
  }

  selectNecklace(necklaceId) {
    const next = this.necklaces.find((necklace) => necklace.id === necklaceId);
    if (!next) return;

    const state = this.getState();
    if (next.id === state.selectedNecklace.id) {
      this.ui.syncNecklaceSelection(next.id);
      return;
    }

    this.appState.set(
      {
        selectedNecklace: next,
        selectedColorId: next.colorCustomization?.defaultColor ?? '',
        selectedColorIdsByTarget: createDefaultColorSelection(next),
      },
      'necklace-select',
    );
    this.controller.reset();
    this.applyCalibrationForSelectedNecklace();
    this.loadSelectedNecklace();
  }

  selectColor(colorId, targetId) {
    const state = this.getState();
    const colorOption = getColorOption(state.selectedNecklace, colorId);
    const resolvedTargetId = this.resolveColorSelectionTarget(targetId);
    if (!colorOption || !resolvedTargetId) return;

    const selectedColorIdsByTarget = {
      ...state.selectedColorIdsByTarget,
      [resolvedTargetId]: colorOption.id,
    };

    this.appState.set({ selectedColorId: colorOption.id, selectedColorIdsByTarget }, 'color-select');
    this.applySelectedColors([resolvedTargetId]);
  }

  handleDebugToggle(isEnabled) {
    this.appState.set({ debugEnabled: isEnabled }, 'debug-toggle');
    this.debugOverlay.setEnabled(this.appState.get('mode') === APP_MODES.AR && isEnabled);
    this.updateDeveloperPanel();
    this.updateTrackingStatus();
  }

  handleNecklaceToggle(isVisible) {
    this.appState.set({ necklaceVisible: isVisible }, 'necklace-toggle');

    if (!isVisible) {
      this.controller.fadeOut();
    }
  }

  updateTuningFromControls() {
    const tuning = this.ui.readTuningControls();
    this.applyTuning(tuning.adjustments, 'calibration-input');
    this.updateCalibrationHint({ dirty: true });
  }

  saveCalibration() {
    const state = this.getState();
    const didSave = this.wearCalibration.save(state.selectedNecklace.id, state.adjustments);

    if (!didSave) {
      this.ui.setCalibrationHint('localStorage 目前不可用，校準會暫時套用但不會保存。');
      return;
    }

    this.ui.setCalibrationHint('已儲存此款式校準，下次開啟會自動套用。', { isSaved: true });
  }

  resetCalibration() {
    const state = this.getState();
    const defaults = this.wearCalibration.reset(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(defaults);
    this.applyTuning(defaults, 'calibration-reset');
    this.ui.setCalibrationHint('已重設此款式校準，可重新拖曳或調整大小。');
  }

  applyCalibrationForSelectedNecklace() {
    const state = this.getState();
    const calibration = this.wearCalibration.get(state.selectedNecklace.id);
    this.ui.syncTuningControlsFromAdjustments(calibration);
    this.applyTuning(calibration, 'calibration-load');
    this.updateCalibrationHint();
  }

  updateCalibrationHint({ dirty = false } = {}) {
    const state = this.getState();

    if (!this.wearCalibration.isAvailable) {
      this.ui.setCalibrationHint('localStorage 目前不可用，校準會暫時套用但不會保存。', { isDirty: dirty });
      return;
    }

    if (dirty) {
      this.ui.setCalibrationHint('已套用到預覽，記得按「儲存校準」保留此款式設定。', { isDirty: true });
      return;
    }

    if (this.wearCalibration.has(state.selectedNecklace.id)) {
      this.ui.setCalibrationHint('已套用此款式上次儲存的佩戴校準。', { isSaved: true });
      return;
    }

    this.ui.setCalibrationHint('偵測到臉後可拖曳項鍊微調，完成後儲存此款式校準。');
  }

  applyTuning(adjustments, eventName = 'tuning-change') {
    const currentAdjustments = this.appState.get('adjustments') ?? {};
    const normalizedAdjustments = this.wearCalibration.normalize({
      ...currentAdjustments,
      ...adjustments,
    });

    this.appState.set({ adjustments: normalizedAdjustments }, eventName);
    this.controller.setAdjustments(normalizedAdjustments);
  }

  async loadSelectedNecklace() {
    const loadId = ++this.necklaceLoadSequence;
    const selectedNecklace = this.appState.get('selectedNecklace');
    this.appState.set({ modelLoaded: false }, 'model-load-start');
    this.ui.clearError();
    this.syncColorAvailability();
    this.ui.setStatus('loading', '款式載入中', selectedNecklace.label);

    try {
      await this.scene.loadNecklace(selectedNecklace);
      if (!this.isLatestNecklaceLoad(loadId)) return;

      this.appState.set({ modelLoaded: true }, 'model-load-success');
      this.ensureColorSelectionForMatchedTargets();
      this.applySelectedColors();
      this.syncColorAvailability();
      this.syncModeEffects();
    } catch (error) {
      if (!this.isLatestNecklaceLoad(loadId) || error?.name === 'AbortError') return;

      const message =
        `無法載入 ${selectedNecklace.url}。請確認 .glb 已放在 public/models/necklace.glb。` +
        ` 原始錯誤：${error.message ?? error}`;
      this.showError(message);
      this.ui.setStatus('error', '模型載入失敗', '請先放置 necklace.glb');
      this.syncColorAvailability();
    }
  }

  isLatestNecklaceLoad(loadId) {
    return this.necklaceLoadSequence === loadId;
  }

  syncModeEffects() {
    const state = this.getState();
    const isShowcase = state.mode === APP_MODES.SHOWCASE;

    this.debugOverlay.setEnabled(!isShowcase && state.debugEnabled);

    if (isShowcase) {
      this.scene.setShowcaseMode(state.modelLoaded);
      this.ui.setStatus(
        state.modelLoaded ? 'tracking' : 'loading',
        state.modelLoaded ? '模型展示' : '模型載入中',
        state.modelLoaded ? '拖曳旋轉模型，選擇喜歡的色彩' : state.selectedNecklace.label,
      );
      return;
    }

    this.scene.setShowcaseMode(false);

    if (!state.cameraStarted && state.modelLoaded) {
      this.ui.setStatus('idle', 'AR 試戴', '開啟相機後即可即時試戴');
    }
  }

  handleFaceResults(results) {
    const state = this.getState();
    if (state.mode !== APP_MODES.AR) return;

    const landmarks = results.multiFaceLandmarks?.[0] ?? null;
    const hasFace = Boolean(landmarks);

    if (!state.modelLoaded || !landmarks) {
      this.controller.fadeOut();
      this.appState.set(
        {
          lastLandmarks: landmarks,
          hasFace,
          lastDebugData: null,
        },
        'face-results',
      );
      this.updateTrackingStatus();
      this.updateDeveloperPanel();
      return;
    }

    const lastDebugData = this.controller.updateFromLandmarks(landmarks, state.necklaceVisible);
    this.markCalibrationReady();
    this.appState.set(
      {
        lastLandmarks: landmarks,
        hasFace,
        lastDebugData,
      },
      'face-results',
    );
    this.updateTrackingStatus();
    this.updateDeveloperPanel();
  }

  markCalibrationReady() {
    const necklaceId = this.appState.get('selectedNecklace').id;
    if (this.calibrationPromptedIds.has(necklaceId)) return;

    this.calibrationPromptedIds.add(necklaceId);
    if (!this.wearCalibration.has(necklaceId)) {
      this.ui.setCalibrationHint('已偵測到臉，可以直接拖曳項鍊，或用滑桿調整上下與大小。');
    }
  }

  handleFaceTrackerStats() {
    const state = this.getState();
    if (!state.cameraStarted || !state.debugEnabled) return;

    this.updateTrackingStatus();
    this.updateDeveloperPanel();
  }

  updateDeveloperPanel() {
    const state = this.getState();
    this.ui.updateDeveloperPanel({
      debugData: state.lastDebugData,
      stats: {
        ...this.faceTracker.getStats(),
        renderFps: this.renderStats.fps,
      },
      modelUrl: state.selectedNecklace?.url,
      materialHitCount: this.scene.getColorableMaterialCount(),
    });
  }

  updateTrackingStatus() {
    const state = this.getState();
    if (!state.cameraStarted) return;
    const inferenceStats = this.formatInferenceStats();
    const advice = this.faceQualityAdvisor.getAdvice({
      landmarks: state.lastLandmarks,
      debugData: state.lastDebugData,
    });
    const message = this.formatAdviceMessage(advice, inferenceStats, state);

    if (!state.hasFace) {
      this.ui.setStatus(advice.kind, advice.label, message);
      return;
    }

    if (!state.lastDebugData) {
      this.ui.setStatus(advice.kind, advice.label, message);
      return;
    }

    const data = state.lastDebugData;
    this.ui.setStatus(
      advice.kind,
      advice.label,
      state.debugEnabled
        ? `neck x/y: ${data.neckPoint.x.toFixed(3)}, ${data.neckPoint.y.toFixed(3)} · scale ${data.scale.toFixed(2)} · yaw ${data.rotationY.toFixed(2)} · ${inferenceStats}`
        : message,
    );
  }

  formatAdviceMessage(advice, inferenceStats, state) {
    let message = advice.message;

    if (
      advice.id === 'ok' &&
      state.lastDebugData &&
      !this.wearCalibration.has(state.selectedNecklace.id)
    ) {
      message = '可拖曳項鍊微調，完成後按「儲存校準」';
    }

    return state.debugEnabled ? `${message} · ${inferenceStats}` : message;
  }

  formatInferenceStats() {
    const stats = this.faceTracker.getStats();
    const averageMs = stats.averageInferenceMs > 0 ? `${stats.averageInferenceMs.toFixed(0)}ms` : '--ms';
    const schedulerLabel = stats.schedulerType === 'video-frame' ? 'rVFC' : 'RAF';
    return `inference: ${stats.currentFps}fps · avg ${averageMs} · ${schedulerLabel}`;
  }

  syncColorAvailability() {
    const state = this.getState();
    const targetIds = state.modelLoaded ? this.scene.getColorableTargets() : [];

    this.ui.populateColorSwatches({
      necklace: state.selectedNecklace,
      selectedColorIdsByTarget: state.selectedColorIdsByTarget,
      fallbackColorId: state.selectedColorId,
      targetIds,
    });
    this.ui.updateColorUiAvailability({
      necklace: state.selectedNecklace,
      modelLoaded: state.modelLoaded,
      hasColorableMaterials: this.scene.hasColorableMaterials(),
      targetLabels: this.getMatchedColorTargetLabels(),
    });
  }

  getMatchedColorTargetLabels() {
    const state = this.getState();
    const targetIds = this.scene.getColorableTargets();
    const targets = state.selectedNecklace.colorCustomization?.targets ?? [];
    return targetIds
      .map((targetId) => targets.find((target) => target.id === targetId)?.label)
      .filter(Boolean);
  }

  ensureColorSelectionForMatchedTargets() {
    const state = this.getState();
    const defaultColorId = state.selectedNecklace.colorCustomization?.defaultColor ?? '';
    if (!defaultColorId) return;

    const targetIds = this.scene.getColorableTargets();
    const selectedColorIdsByTarget = { ...state.selectedColorIdsByTarget };
    let didChange = false;

    targetIds.forEach((targetId) => {
      if (selectedColorIdsByTarget[targetId]) return;
      selectedColorIdsByTarget[targetId] = defaultColorId;
      didChange = true;
    });

    if (didChange) {
      this.appState.set({ selectedColorIdsByTarget }, 'color-target-defaults');
    }
  }

  applySelectedColors(targetIds = this.scene.getColorableTargets()) {
    const state = this.getState();
    let didApply = false;

    targetIds.forEach((targetId) => {
      const colorId = this.getSelectedColorIdForTarget(state, targetId);
      const colorOption = getColorOption(state.selectedNecklace, colorId);
      if (!colorOption) return;

      didApply = this.scene.applyColor(targetId, colorOption.color) || didApply;
    });

    return didApply;
  }

  getSelectedColorIdForTarget(state, targetId) {
    return (
      state.selectedColorIdsByTarget?.[targetId] ??
      state.selectedColorId ??
      state.selectedNecklace.colorCustomization?.defaultColor ??
      ''
    );
  }

  resolveColorSelectionTarget(targetId) {
    const activeTargetIds = this.scene.getColorableTargets();
    if (targetId && activeTargetIds.includes(targetId)) return targetId;
    if (activeTargetIds.length === 1) return activeTargetIds[0];

    const state = this.getState();
    const defaultTarget = state.selectedNecklace.colorCustomization?.defaultTarget ?? 'all';
    if (defaultTarget !== 'all' && activeTargetIds.includes(defaultTarget)) return defaultTarget;
    return activeTargetIds[0] ?? '';
  }

  getActiveCameraLabel() {
    return `目前使用${getCameraLabel(this.appState.get('cameraFacingMode'))}`;
  }

  showError(message) {
    this.ui.showError(message);
  }

  getState() {
    return this.appState.getSnapshot();
  }

  animate = () => {
    const now = performance.now();
    const state = this.getState();
    this.updateRenderFps(now);

    if (state.mode === APP_MODES.SHOWCASE && state.modelLoaded) {
      this.scene.updateShowcase(now);
    }

    this.scene.render();
    this.debugOverlay.render(state.lastLandmarks, state.lastDebugData);
    if (state.debugEnabled) this.updateDeveloperPanel();
    requestAnimationFrame(this.animate);
  };

  updateRenderFps(now) {
    this.renderStats.frameCount += 1;
    const elapsed = now - this.renderStats.lastSampleAt;
    if (elapsed < 500) return;

    this.renderStats.fps = Math.round((this.renderStats.frameCount * 1000) / elapsed);
    this.renderStats.frameCount = 0;
    this.renderStats.lastSampleAt = now;
  }
}

function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

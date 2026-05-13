import './styles.css';
import { NECKLACES } from './config/necklaces.js';
import { CameraStream } from './core/CameraStream.js';
import { DebugOverlay } from './core/DebugOverlay.js';
import { FaceTracker } from './core/FaceTracker.js';
import { NecklaceController } from './core/NecklaceController.js';
import { NecklaceScene } from './core/NecklaceScene.js';

const elements = {
  stage: document.querySelector('.stage'),
  video: document.querySelector('#cameraVideo'),
  threeCanvas: document.querySelector('#threeCanvas'),
  debugCanvas: document.querySelector('#debugCanvas'),
  stagePlaceholder: document.querySelector('.stage-placeholder'),
  livePill: document.querySelector('.live-pill'),
  captureButton: document.querySelector('#captureButton'),
  modeButtons: document.querySelectorAll('[data-mode]'),
  arSections: document.querySelectorAll('[data-ar-section]'),
  startButton: document.querySelector('#startButton'),
  switchCameraButton: document.querySelector('#switchCameraButton'),
  stopCameraButton: document.querySelector('#stopCameraButton'),
  necklaceToggle: document.querySelector('#necklaceToggle'),
  debugToggle: document.querySelector('#debugToggle'),
  necklaceCards: document.querySelector('#necklaceCards'),
  necklaceSelect: document.querySelector('#necklaceSelect'),
  colorSwatches: document.querySelector('#colorSwatches'),
  colorHint: document.querySelector('#colorHint'),
  colorMeaning: document.querySelector('#colorMeaning'),
  meaningChip: document.querySelector('#meaningChip'),
  meaningTitle: document.querySelector('#meaningTitle'),
  meaningSummary: document.querySelector('#meaningSummary'),
  meaningKeywords: document.querySelector('#meaningKeywords'),
  verticalOffsetRange: document.querySelector('#verticalOffsetRange'),
  verticalOffsetValue: document.querySelector('#verticalOffsetValue'),
  scaleRange: document.querySelector('#scaleRange'),
  scaleValue: document.querySelector('#scaleValue'),
  rotationRange: document.querySelector('#rotationRange'),
  rotationValue: document.querySelector('#rotationValue'),
  resetTuningButton: document.querySelector('#resetTuningButton'),
  shareSheet: document.querySelector('#shareSheet'),
  shareImage: document.querySelector('#shareImage'),
  downloadCaptureButton: document.querySelector('#downloadCaptureButton'),
  shareCaptureButton: document.querySelector('#shareCaptureButton'),
  closeShareButtons: document.querySelectorAll('[data-close-share]'),
  errorBox: document.querySelector('#errorBox'),
  statusPanel: document.querySelector('.status-panel'),
  trackingDot: document.querySelector('#trackingDot'),
  trackingLabel: document.querySelector('#trackingLabel'),
  trackingMetrics: document.querySelector('#trackingMetrics'),
};

const TUNING_DEFAULTS = {
  verticalOffset: 0,
  scale: 100,
  rotation: 0,
};

const CAMERA_FACING_MODES = {
  USER: 'user',
  ENVIRONMENT: 'environment',
};

const APP_MODES = {
  SHOWCASE: 'showcase',
  AR: 'ar',
};

const SHARE_IMAGE_SIZE = 1080;
const SHARE_FILE_NAME = 'soft-jewelry-try-on.png';

const state = {
  mode: APP_MODES.SHOWCASE,
  cameraStarted: false,
  cameraFacingMode: CAMERA_FACING_MODES.USER,
  isSwitchingCamera: false,
  modelLoaded: false,
  hasFace: false,
  lastLandmarks: null,
  lastDebugData: null,
  selectedNecklace: NECKLACES[0],
  selectedColorId: NECKLACES[0]?.colorCustomization?.defaultColor ?? '',
  captureDataUrl: '',
  captureBlob: null,
  adjustments: {
    verticalOffset: 0,
    scaleMultiplier: 1,
    rotationOffset: 0,
  },
};

const camera = new CameraStream(elements.video);
const scene = new NecklaceScene({
  canvas: elements.threeCanvas,
  stageElement: elements.stage,
  onError: showError,
});
const controller = new NecklaceController(scene);
const debugOverlay = new DebugOverlay({
  canvas: elements.debugCanvas,
  stageElement: elements.stage,
});
const faceTracker = new FaceTracker({
  video: elements.video,
  onResults: handleFaceResults,
  onError: (error) => showError(`Face Mesh 偵測發生錯誤：${error.message ?? error}`),
});

init();

function init() {
  populateNecklaceSelect();
  populateColorSwatches();
  wireUi();
  updateTuningFromControls();
  syncModeUi();
  syncCameraUi();
  loadSelectedNecklace();
  animate();
}

function populateNecklaceSelect() {
  elements.necklaceSelect.innerHTML = '';
  elements.necklaceCards.innerHTML = '';

  NECKLACES.forEach((necklace) => {
    const option = document.createElement('option');
    option.value = necklace.id;
    option.textContent = necklace.label;
    elements.necklaceSelect.append(option);

    const card = document.createElement('button');
    card.className = 'necklace-card';
    card.type = 'button';
    card.dataset.necklaceId = necklace.id;
    card.setAttribute('role', 'radio');

    const preview = document.createElement('span');
    preview.className = 'necklace-card__preview';
    preview.setAttribute('aria-hidden', 'true');

    const content = document.createElement('span');
    content.className = 'necklace-card__content';

    const label = document.createElement('strong');
    label.textContent = necklace.label;

    const description = document.createElement('small');
    description.textContent = necklace.description ?? '試戴款式';

    content.append(label, description);
    card.append(preview, content);
    elements.necklaceCards.append(card);
  });

  elements.necklaceSelect.value = state.selectedNecklace.id;
  syncNecklaceCards();
}

function populateColorSwatches() {
  elements.colorSwatches.innerHTML = '';
  const palette = state.selectedNecklace.colorCustomization?.palette ?? [];

  palette.forEach((colorOption) => {
    const button = document.createElement('button');
    button.className = 'color-swatch';
    button.type = 'button';
    button.dataset.colorId = colorOption.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', colorOption.label);
    button.title = colorOption.label;

    const chip = document.createElement('span');
    chip.className = 'color-swatch__chip';
    chip.style.setProperty('--swatch-color', colorOption.color);
    chip.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = colorOption.label;

    button.append(chip, label);
    elements.colorSwatches.append(button);
  });

  syncColorSwatches();
  updateColorMeaning();
  updateColorUiAvailability();
}

function wireUi() {
  elements.modeButtons.forEach((button) => {
    button.addEventListener('click', () => selectMode(button.dataset.mode));
  });

  elements.threeCanvas.addEventListener('pointerdown', handleShowcasePointerDown);
  elements.threeCanvas.addEventListener('pointermove', handleShowcasePointerMove);
  elements.threeCanvas.addEventListener('pointerup', handleShowcasePointerUp);
  elements.threeCanvas.addEventListener('pointercancel', handleShowcasePointerUp);
  elements.threeCanvas.addEventListener('pointerleave', handleShowcasePointerUp);

  elements.startButton.addEventListener('click', startExperience);
  elements.switchCameraButton.addEventListener('click', switchCamera);
  elements.stopCameraButton.addEventListener('click', stopExperience);
  elements.captureButton.addEventListener('click', handleCapture);

  elements.debugToggle.addEventListener('change', () => {
    debugOverlay.setEnabled(state.mode === APP_MODES.AR && elements.debugToggle.checked);
    updateTrackingStatus();
  });

  elements.necklaceToggle.addEventListener('change', () => {
    if (!elements.necklaceToggle.checked) {
      controller.fadeOut();
    }
  });

  elements.necklaceCards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-necklace-id]');
    if (!card) return;
    selectNecklace(card.dataset.necklaceId);
  });

  elements.necklaceSelect.addEventListener('change', () => {
    selectNecklace(elements.necklaceSelect.value);
  });

  elements.colorSwatches.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-color-id]');
    if (!swatch || swatch.disabled) return;
    selectColor(swatch.dataset.colorId);
  });

  elements.verticalOffsetRange.addEventListener('input', updateTuningFromControls);
  elements.scaleRange.addEventListener('input', updateTuningFromControls);
  elements.rotationRange.addEventListener('input', updateTuningFromControls);
  elements.resetTuningButton.addEventListener('click', resetTuningControls);
  elements.downloadCaptureButton.addEventListener('click', downloadCapture);
  elements.shareCaptureButton.addEventListener('click', shareCapture);
  elements.closeShareButtons.forEach((button) => {
    button.addEventListener('click', closeShareSheet);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.shareSheet.hidden) {
      closeShareSheet();
    }
  });
}

function selectNecklace(necklaceId) {
  const next = NECKLACES.find((necklace) => necklace.id === necklaceId);
  if (!next) return;

  if (next.id === state.selectedNecklace.id) {
    elements.necklaceSelect.value = next.id;
    syncNecklaceCards();
    return;
  }

  state.selectedNecklace = next;
  state.selectedColorId = next.colorCustomization?.defaultColor ?? '';
  elements.necklaceSelect.value = next.id;
  syncNecklaceCards();
  populateColorSwatches();
  controller.reset();
  loadSelectedNecklace();
}

function syncNecklaceCards() {
  const cards = elements.necklaceCards.querySelectorAll('[data-necklace-id]');
  cards.forEach((card) => {
    const isSelected = card.dataset.necklaceId === state.selectedNecklace.id;
    card.classList.toggle('is-selected', isSelected);
    card.setAttribute('aria-checked', String(isSelected));
  });
}

function selectColor(colorId) {
  const colorOption = getColorOption(colorId);
  if (!colorOption) return;

  state.selectedColorId = colorOption.id;
  syncColorSwatches();
  updateColorMeaning();
  applySelectedColor();
}

function syncColorSwatches() {
  const swatches = elements.colorSwatches.querySelectorAll('[data-color-id]');
  swatches.forEach((swatch) => {
    const isSelected = swatch.dataset.colorId === state.selectedColorId;
    swatch.classList.toggle('is-selected', isSelected);
    swatch.setAttribute('aria-checked', String(isSelected));
  });
}

function updateColorMeaning() {
  const colorOption = getColorOption(state.selectedColorId);
  const meaning = colorOption?.meaning;

  if (!colorOption || !meaning) {
    elements.colorMeaning.hidden = true;
    return;
  }

  elements.colorMeaning.hidden = false;
  elements.meaningChip.style.setProperty('--meaning-color', colorOption.color);
  elements.meaningTitle.textContent = colorOption.label;
  elements.meaningSummary.textContent = meaning.summary ?? '';
  elements.meaningKeywords.innerHTML = '';

  meaning.keywords?.forEach((keyword) => {
    const tag = document.createElement('span');
    tag.textContent = keyword;
    elements.meaningKeywords.append(tag);
  });
}

function updateColorUiAvailability() {
  const hasPalette = Boolean(state.selectedNecklace.colorCustomization?.palette?.length);
  const hasColorableMaterials = scene.hasColorableMaterials();
  const isAvailable = hasPalette && hasColorableMaterials;
  const swatches = elements.colorSwatches.querySelectorAll('[data-color-id]');

  swatches.forEach((swatch) => {
    swatch.disabled = !isAvailable;
  });

  if (!hasPalette) {
    elements.colorHint.textContent = '這個款式尚未設定可選顏色。';
    return;
  }

  if (!state.modelLoaded) {
    elements.colorHint.textContent = '正在確認這個款式的可換色材質。';
    return;
  }

  if (!hasColorableMaterials) {
    elements.colorHint.textContent = '這個模型目前沒有找到可換色材質，仍可正常試戴。';
    return;
  }

  const targetLabels = getMatchedColorTargetLabels();
  elements.colorHint.textContent = targetLabels.length
    ? `會套用到：${targetLabels.join('、')}。`
    : '可套用到模型中的換色材質。';
}

function getMatchedColorTargetLabels() {
  const targetIds = scene.getColorableTargets();
  const targets = state.selectedNecklace.colorCustomization?.targets ?? [];
  return targetIds
    .map((targetId) => targets.find((target) => target.id === targetId)?.label)
    .filter(Boolean);
}

function applySelectedColor() {
  const colorOption = getColorOption(state.selectedColorId);
  if (!colorOption) return false;

  const target = state.selectedNecklace.colorCustomization?.defaultTarget ?? 'all';
  return scene.applyColor(target, colorOption.color, colorOption.material);
}

function getColorOption(colorId) {
  const palette = state.selectedNecklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

function resetTuningControls() {
  elements.verticalOffsetRange.value = String(TUNING_DEFAULTS.verticalOffset);
  elements.scaleRange.value = String(TUNING_DEFAULTS.scale);
  elements.rotationRange.value = String(TUNING_DEFAULTS.rotation);
  updateTuningFromControls();
}

function updateTuningFromControls() {
  const verticalOffset = Number(elements.verticalOffsetRange.value);
  const scale = Number(elements.scaleRange.value);
  const rotation = Number(elements.rotationRange.value);

  state.adjustments = {
    verticalOffset: verticalOffset / 1000,
    scaleMultiplier: scale / 100,
    rotationOffset: (rotation * Math.PI) / 180,
  };

  controller.setAdjustments(state.adjustments);
  elements.verticalOffsetValue.textContent = formatSignedNumber(verticalOffset);
  elements.scaleValue.textContent = `${scale}%`;
  elements.rotationValue.textContent = `${formatSignedNumber(rotation)}°`;
}

async function loadSelectedNecklace() {
  state.modelLoaded = false;
  clearError();
  updateColorUiAvailability();
  setStatus('loading', '款式載入中', state.selectedNecklace.label);

  try {
    await scene.loadNecklace(state.selectedNecklace);
    state.modelLoaded = true;
    applySelectedColor();
    updateColorUiAvailability();
    syncModeUi();
  } catch (error) {
    const message =
      `無法載入 ${state.selectedNecklace.url}。請確認 .glb 已放在 public/models/necklace.glb。` +
      ` 原始錯誤：${error.message ?? error}`;
    showError(message);
    setStatus('error', '模型載入失敗', '請先放置 necklace.glb');
    updateColorUiAvailability();
  }
}

function selectMode(mode) {
  if (!Object.values(APP_MODES).includes(mode) || state.mode === mode) return;

  if (mode === APP_MODES.SHOWCASE && state.cameraStarted) {
    stopCameraSession();
  }

  state.mode = mode;
  state.lastLandmarks = null;
  state.lastDebugData = null;
  state.hasFace = false;

  if (mode === APP_MODES.AR) {
    scene.setShowcaseMode(false);
    controller.reset();
  }

  syncModeUi();
}

function syncModeUi() {
  const isShowcase = state.mode === APP_MODES.SHOWCASE;

  elements.modeButtons.forEach((button) => {
    const isSelected = button.dataset.mode === state.mode;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });

  elements.arSections.forEach((section) => {
    section.hidden = isShowcase;
  });

  elements.stage.classList.toggle('is-showcase', isShowcase);
  elements.stage.classList.toggle('is-ar-mode', !isShowcase);
  elements.livePill.textContent = isShowcase ? '3D Model' : 'Live AR';
  elements.captureButton.hidden = isShowcase;
  debugOverlay.setEnabled(!isShowcase && elements.debugToggle.checked);

  if (isShowcase) {
    scene.setShowcaseMode(state.modelLoaded);
    setStatus(
      state.modelLoaded ? 'tracking' : 'loading',
      state.modelLoaded ? '模型展示' : '模型載入中',
      state.modelLoaded ? '拖曳旋轉模型，選擇喜歡的色彩' : state.selectedNecklace.label,
    );
    return;
  }

  scene.setShowcaseMode(false);

  if (!state.cameraStarted && state.modelLoaded) {
    setStatus('idle', 'AR 試戴', '開啟相機後即可即時試戴');
  }
}

function handleShowcasePointerDown(event) {
  if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

  elements.threeCanvas.setPointerCapture?.(event.pointerId);
  elements.stage.classList.add('is-dragging-showcase');
  scene.beginShowcaseDrag(event.clientX);
}

function handleShowcasePointerMove(event) {
  if (state.mode !== APP_MODES.SHOWCASE || !state.modelLoaded) return;

  scene.dragShowcase(event.clientX);
}

function handleShowcasePointerUp(event) {
  if (state.mode !== APP_MODES.SHOWCASE) return;

  elements.threeCanvas.releasePointerCapture?.(event.pointerId);
  elements.stage.classList.remove('is-dragging-showcase');
  scene.endShowcaseDrag();
}

async function startExperience() {
  clearError();
  elements.startButton.disabled = true;
  elements.switchCameraButton.disabled = true;
  elements.stopCameraButton.disabled = true;
  elements.startButton.textContent = '啟動中...';

  try {
    await startCameraForMode(state.cameraFacingMode);
    state.cameraStarted = true;
    elements.stage.classList.add('is-camera-on');
    elements.captureButton.disabled = false;
    setStatus('idle', '相機已啟動', '正在尋找臉部');
    elements.startButton.textContent = '相機運作中';
    syncCameraUi();
  } catch (error) {
    stopCameraSession();
    showError(`無法啟動相機：${error.message ?? error}`);
    setStatus('error', '相機啟動失敗', '請確認瀏覽器權限與 HTTPS/localhost 環境');
  }
}

function stopExperience() {
  if (!state.cameraStarted && !state.isSwitchingCamera) return;

  clearError();
  stopCameraSession();
  setStatus('idle', '相機已關閉', '鏡頭已停止，可重新開啟相機');
}

async function switchCamera() {
  if (!state.cameraStarted || state.isSwitchingCamera) return;

  const previousFacingMode = state.cameraFacingMode;
  const nextFacingMode =
    previousFacingMode === CAMERA_FACING_MODES.USER
      ? CAMERA_FACING_MODES.ENVIRONMENT
      : CAMERA_FACING_MODES.USER;

  clearError();
  state.isSwitchingCamera = true;
  elements.captureButton.disabled = true;
  syncCameraUi();
  setStatus('idle', '正在切換鏡頭', getCameraSwitchingLabel(nextFacingMode));

  try {
    await startCameraForMode(nextFacingMode, { strictFacingMode: true });
    setStatus('idle', '鏡頭已切換', getActiveCameraLabel());
  } catch (error) {
    const failedLabel = getCameraLabel(nextFacingMode);
    showError(`無法切換到${failedLabel}：${error.message ?? error}`);
    setStatus('error', '鏡頭切換失敗', `正在恢復${getCameraLabel(previousFacingMode)}`);

    try {
      await startCameraForMode(previousFacingMode);
      setStatus('idle', '已恢復原鏡頭', getActiveCameraLabel());
    } catch (restoreError) {
      stopCameraSession();
      showError(`鏡頭切換失敗，且無法恢復原鏡頭：${restoreError.message ?? restoreError}`);
      setStatus('error', '相機已停止', '請重新啟動相機');
    }
  } finally {
    state.isSwitchingCamera = false;
    elements.captureButton.disabled = !state.cameraStarted;
    syncCameraUi();
  }
}

async function startCameraForMode(facingMode, { strictFacingMode = false } = {}) {
  faceTracker.stop();
  controller.fadeOut();
  state.hasFace = false;
  state.lastLandmarks = null;
  state.lastDebugData = null;
  faceTracker.setSelfieMode(isSelfieCamera(facingMode));

  await camera.start({ facingMode, strictFacingMode });

  state.cameraFacingMode = normalizeFacingMode(camera.getFacingMode(), facingMode);
  faceTracker.setSelfieMode(isSelfieCamera(state.cameraFacingMode));
  syncCameraUi();
  scene.resize();
  debugOverlay.resize();
  await faceTracker.start();
}

function stopCameraSession() {
  camera.stop();
  faceTracker.stop();
  controller.reset();
  state.cameraStarted = false;
  state.isSwitchingCamera = false;
  state.hasFace = false;
  state.lastLandmarks = null;
  state.lastDebugData = null;
  elements.stage.classList.remove('is-camera-on');
  elements.captureButton.disabled = true;
  elements.startButton.disabled = false;
  elements.startButton.textContent = '開始相機';
  syncCameraUi();
}

async function handleCapture() {
  clearError();

  if (!state.cameraStarted || elements.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    setStatus('idle', '尚未開啟相機', '請先啟動相機再拍照');
    return;
  }

  if (!state.hasFace) {
    setStatus('idle', '尚未偵測到臉', '請將臉保持在畫面中央後再拍照');
    return;
  }

  if (!elements.necklaceToggle.checked) {
    setStatus('idle', '項鍊目前隱藏', '請先開啟項鍊預覽再拍照');
    return;
  }

  elements.captureButton.disabled = true;
  elements.captureButton.classList.add('is-capturing');

  try {
    scene.render();
    const captureCanvas = createBrandedCapture();
    state.captureDataUrl = captureCanvas.toDataURL('image/png');
    state.captureBlob = await canvasToBlob(captureCanvas);
    elements.shareImage.src = state.captureDataUrl;
    elements.shareSheet.hidden = false;
    setStatus('tracking', '美圖已產出', '可下載或分享給朋友');
  } catch (error) {
    showError(`無法產生美圖：${error.message ?? error}`);
  } finally {
    elements.captureButton.disabled = !state.cameraStarted;
    elements.captureButton.classList.remove('is-capturing');
  }
}

function createBrandedCapture() {
  const stageRect = elements.stage.getBoundingClientRect();
  const sourceWidth = Math.max(1, Math.round(stageRect.width));
  const sourceHeight = Math.max(1, Math.round(stageRect.height));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;

  const sourceContext = sourceCanvas.getContext('2d');
  drawCoverVideo(sourceContext, elements.video, sourceWidth, sourceHeight, {
    mirrored: isSelfieCamera(state.cameraFacingMode),
  });
  sourceContext.drawImage(elements.threeCanvas, 0, 0, sourceWidth, sourceHeight);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = SHARE_IMAGE_SIZE;
  outputCanvas.height = SHARE_IMAGE_SIZE;
  const outputContext = outputCanvas.getContext('2d');

  outputContext.fillStyle = '#fffaf7';
  outputContext.fillRect(0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
  drawCoverImage(outputContext, sourceCanvas, 0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
  drawShareImagePolish(outputContext, SHARE_IMAGE_SIZE);
  drawBrandLogo(outputContext);

  return outputCanvas;
}

function drawCoverVideo(context, video, width, height, { mirrored = false } = {}) {
  const videoWidth = video.videoWidth || width;
  const videoHeight = video.videoHeight || height;
  const scale = Math.max(width / videoWidth, height / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  if (mirrored) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(video, drawX, drawY, drawWidth, drawHeight);

  if (mirrored) {
    context.restore();
  }
}

function drawCoverImage(context, image, x, y, width, height) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height);
}

function drawShareImagePolish(context, size) {
  const topGradient = context.createLinearGradient(0, 0, 0, size * 0.28);
  topGradient.addColorStop(0, 'rgba(47, 42, 42, 0.2)');
  topGradient.addColorStop(1, 'rgba(47, 42, 42, 0)');
  context.fillStyle = topGradient;
  context.fillRect(0, 0, size, size * 0.32);

  const bottomGradient = context.createLinearGradient(0, size * 0.62, 0, size);
  bottomGradient.addColorStop(0, 'rgba(255, 250, 247, 0)');
  bottomGradient.addColorStop(1, 'rgba(255, 250, 247, 0.72)');
  context.fillStyle = bottomGradient;
  context.fillRect(0, size * 0.58, size, size * 0.42);

  context.strokeStyle = 'rgba(255, 250, 247, 0.72)';
  context.lineWidth = 18;
  context.strokeRect(9, 9, size - 18, size - 18);
}

function drawBrandLogo(context) {
  const x = 56;
  const y = 56;
  const width = 426;
  const height = 78;

  context.save();
  drawRoundedRect(context, x, y, width, height, 24);
  context.fillStyle = 'rgba(255, 250, 247, 0.88)';
  context.fill();
  context.strokeStyle = 'rgba(234, 219, 221, 0.9)';
  context.lineWidth = 2;
  context.stroke();

  context.beginPath();
  context.arc(x + 40, y + 39, 24, 0, Math.PI * 2);
  context.fillStyle = '#c8a96a';
  context.fill();

  context.fillStyle = '#fffaf7';
  context.font = '800 18px Inter, system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.fillText('SJ', x + 28, y + 40);

  context.fillStyle = '#2f2a2a';
  context.font = '800 25px Inter, system-ui, sans-serif';
  context.fillText('Soft Jewelry Studio', x + 82, y + 34);

  context.fillStyle = '#a96f78';
  context.font = '600 15px Inter, system-ui, sans-serif';
  context.fillText('AR Necklace Try-On', x + 84, y + 56);
  context.restore();
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('瀏覽器無法輸出圖片'));
    }, 'image/png');
  });
}

function downloadCapture() {
  if (!state.captureDataUrl) return;

  const link = document.createElement('a');
  link.href = state.captureDataUrl;
  link.download = SHARE_FILE_NAME;
  document.body.append(link);
  link.click();
  link.remove();
  setStatus('idle', '圖片已下載', '可以上傳 Instagram 或傳給朋友');
}

async function shareCapture() {
  if (!state.captureBlob) return;

  const file = new File([state.captureBlob], SHARE_FILE_NAME, { type: 'image/png' });
  const sharePayload = {
    files: [file],
    title: '我的項鍊試戴',
    text: 'Soft Jewelry Studio AR Necklace Try-On',
  };

  if (navigator.canShare?.(sharePayload)) {
    try {
      await navigator.share(sharePayload);
      setStatus('idle', '分享面板已開啟', '選擇 Instagram、訊息或好友');
    } catch (error) {
      if (error.name !== 'AbortError') {
        showError(`分享失敗：${error.message ?? error}`);
      }
    }
    return;
  }

  downloadCapture();
  setStatus('idle', '此瀏覽器不支援直接分享', '已改為下載圖片');
}

function closeShareSheet() {
  elements.shareSheet.hidden = true;
}

function handleFaceResults(results) {
  if (state.mode !== APP_MODES.AR) return;

  const landmarks = results.multiFaceLandmarks?.[0] ?? null;
  state.lastLandmarks = landmarks;
  state.hasFace = Boolean(landmarks);

  if (!state.modelLoaded || !landmarks) {
    controller.fadeOut();
    state.lastDebugData = null;
    updateTrackingStatus();
    return;
  }

  state.lastDebugData = controller.updateFromLandmarks(landmarks, elements.necklaceToggle.checked);
  updateTrackingStatus();
}

function updateTrackingStatus() {
  if (!state.cameraStarted) return;

  if (!state.hasFace) {
    setStatus('idle', '正在尋找臉部', '請將臉保持在畫面中央');
    return;
  }

  if (!state.lastDebugData) {
    setStatus('idle', '貼合準備中', '等待臉部資訊穩定');
    return;
  }

  const data = state.lastDebugData;
  setStatus(
    'tracking',
    '正在試戴',
    elements.debugToggle.checked
      ? `neck x/y: ${data.neckPoint.x.toFixed(3)}, ${data.neckPoint.y.toFixed(3)} · scale ${data.scale.toFixed(2)} · yaw ${data.rotationY.toFixed(2)}`
      : '貼合中，保持自然正面即可',
  );
}

function formatSignedNumber(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function syncCameraUi() {
  const isSelfie = isSelfieCamera(state.cameraFacingMode);
  const nextLabel = isSelfie ? '切換後鏡頭' : '切換前鏡頭';
  elements.stage.classList.toggle('is-selfie-camera', isSelfie);
  elements.switchCameraButton.disabled = !state.cameraStarted || state.isSwitchingCamera;
  elements.stopCameraButton.disabled = !state.cameraStarted || state.isSwitchingCamera;
  elements.switchCameraButton.textContent = state.isSwitchingCamera ? '切換中...' : nextLabel;
  elements.switchCameraButton.setAttribute('aria-label', nextLabel);
}

function normalizeFacingMode(actualFacingMode, fallbackFacingMode) {
  if (actualFacingMode === CAMERA_FACING_MODES.USER || actualFacingMode === CAMERA_FACING_MODES.ENVIRONMENT) {
    return actualFacingMode;
  }

  return fallbackFacingMode;
}

function isSelfieCamera(facingMode) {
  return facingMode !== CAMERA_FACING_MODES.ENVIRONMENT;
}

function getCameraLabel(facingMode) {
  return isSelfieCamera(facingMode) ? '前鏡頭' : '後鏡頭';
}

function getCameraSwitchingLabel(facingMode) {
  return `準備使用${getCameraLabel(facingMode)}`;
}

function getActiveCameraLabel() {
  return `目前使用${getCameraLabel(state.cameraFacingMode)}`;
}

function setStatus(kind, label, metrics) {
  const isPassiveTracking = kind === 'tracking' && label === '正在試戴' && !elements.debugToggle.checked;
  elements.statusPanel.dataset.status = kind;
  elements.statusPanel.classList.toggle('is-passive', isPassiveTracking);
  elements.trackingDot.classList.toggle('is-tracking', kind === 'tracking');
  elements.trackingDot.classList.toggle('is-error', kind === 'error');
  elements.trackingLabel.textContent = label;
  elements.trackingMetrics.textContent = metrics;
}

function showError(message) {
  elements.errorBox.hidden = false;
  elements.errorBox.textContent = message;
  console.error(message);
}

function clearError() {
  elements.errorBox.hidden = true;
  elements.errorBox.textContent = '';
}

function animate() {
  if (state.mode === APP_MODES.SHOWCASE && state.modelLoaded) {
    scene.updateShowcase(performance.now());
  }

  scene.render();
  debugOverlay.render(state.lastLandmarks, state.lastDebugData);
  requestAnimationFrame(animate);
}

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
  startButton: document.querySelector('#startButton'),
  necklaceToggle: document.querySelector('#necklaceToggle'),
  debugToggle: document.querySelector('#debugToggle'),
  necklaceSelect: document.querySelector('#necklaceSelect'),
  errorBox: document.querySelector('#errorBox'),
  trackingDot: document.querySelector('#trackingDot'),
  trackingLabel: document.querySelector('#trackingLabel'),
  trackingMetrics: document.querySelector('#trackingMetrics'),
};

const state = {
  cameraStarted: false,
  modelLoaded: false,
  hasFace: false,
  lastLandmarks: null,
  lastDebugData: null,
  selectedNecklace: NECKLACES[0],
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
  wireUi();
  loadSelectedNecklace();
  animate();
}

function populateNecklaceSelect() {
  elements.necklaceSelect.innerHTML = '';

  NECKLACES.forEach((necklace) => {
    const option = document.createElement('option');
    option.value = necklace.id;
    option.textContent = necklace.label;
    elements.necklaceSelect.append(option);
  });

  elements.necklaceSelect.value = state.selectedNecklace.id;
}

function wireUi() {
  elements.startButton.addEventListener('click', startExperience);

  elements.debugToggle.addEventListener('change', () => {
    debugOverlay.setEnabled(elements.debugToggle.checked);
  });

  elements.necklaceToggle.addEventListener('change', () => {
    if (!elements.necklaceToggle.checked) {
      controller.fadeOut();
    }
  });

  elements.necklaceSelect.addEventListener('change', () => {
    const next = NECKLACES.find((necklace) => necklace.id === elements.necklaceSelect.value);
    if (!next) return;
    state.selectedNecklace = next;
    controller.reset();
    loadSelectedNecklace();
  });
}

async function loadSelectedNecklace() {
  state.modelLoaded = false;
  clearError();
  setStatus('loading', '載入模型中', state.selectedNecklace.url);

  try {
    await scene.loadNecklace(state.selectedNecklace);
    state.modelLoaded = true;
    setStatus('idle', '模型已載入', '可以開始相機');
  } catch (error) {
    const message =
      `無法載入 ${state.selectedNecklace.url}。請確認 .glb 已放在 public/models/necklace.glb。` +
      ` 原始錯誤：${error.message ?? error}`;
    showError(message);
    setStatus('error', '模型載入失敗', '請先放置 necklace.glb');
  }
}

async function startExperience() {
  clearError();
  elements.startButton.disabled = true;
  elements.startButton.textContent = '啟動中...';

  try {
    await camera.start();
    scene.resize();
    debugOverlay.resize();
    await faceTracker.start();
    state.cameraStarted = true;
    setStatus('idle', '相機已啟動', '正在等待臉部偵測');
    elements.startButton.textContent = '相機運作中';
  } catch (error) {
    showError(`無法啟動相機：${error.message ?? error}`);
    setStatus('error', '相機啟動失敗', '請確認瀏覽器權限與 HTTPS/localhost 環境');
    elements.startButton.disabled = false;
    elements.startButton.textContent = '開始相機';
  }
}

function handleFaceResults(results) {
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
    setStatus('idle', '未偵測到臉', '項鍊已平滑淡出');
    return;
  }

  if (!state.lastDebugData) {
    setStatus('idle', '追蹤準備中', '等待 landmarks 穩定');
    return;
  }

  const data = state.lastDebugData;
  setStatus(
    'tracking',
    '正在追蹤',
    `neck x/y: ${data.neckPoint.x.toFixed(3)}, ${data.neckPoint.y.toFixed(3)} · scale ${data.scale.toFixed(2)}`,
  );
}

function setStatus(kind, label, metrics) {
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
  scene.render();
  debugOverlay.render(state.lastLandmarks, state.lastDebugData);
  requestAnimationFrame(animate);
}

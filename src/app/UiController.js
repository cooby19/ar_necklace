import { APP_MODES, isSelfieCamera } from './AppState.js';

export class UiController {
  constructor({ necklaces }) {
    this.necklaces = necklaces;
    this.elements = {
      app: document.querySelector('#app'),
      stage: document.querySelector('.stage'),
      video: document.querySelector('#cameraVideo'),
      threeCanvas: document.querySelector('#threeCanvas'),
      debugCanvas: document.querySelector('#debugCanvas'),
      livePill: document.querySelector('.live-pill'),
      captureButton: document.querySelector('#captureButton'),
      bottomSheetToggle: document.querySelector('#bottomSheetToggle'),
      modeButtons: document.querySelectorAll('[data-mode]'),
      panelTabs: document.querySelectorAll('[data-panel-tab]'),
      controlPanels: document.querySelectorAll('[data-control-panel]'),
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
  }

  bind(handlers) {
    this.elements.modeButtons.forEach((button) => {
      button.addEventListener('click', () => handlers.onModeSelect?.(button.dataset.mode));
    });

    this.elements.panelTabs.forEach((button) => {
      button.addEventListener('click', () => handlers.onPanelSelect?.(button.dataset.panelTab));
    });

    this.elements.bottomSheetToggle.addEventListener('click', () => handlers.onBottomSheetToggle?.());

    this.elements.threeCanvas.addEventListener('pointerdown', (event) => handlers.onShowcasePointerDown?.(event));
    this.elements.threeCanvas.addEventListener('pointermove', (event) => handlers.onShowcasePointerMove?.(event));
    this.elements.threeCanvas.addEventListener('pointerup', (event) => handlers.onShowcasePointerUp?.(event));
    this.elements.threeCanvas.addEventListener('pointercancel', (event) => handlers.onShowcasePointerUp?.(event));
    this.elements.threeCanvas.addEventListener('pointerleave', (event) => handlers.onShowcasePointerUp?.(event));

    this.elements.startButton.addEventListener('click', () => handlers.onStartCamera?.());
    this.elements.switchCameraButton.addEventListener('click', () => handlers.onSwitchCamera?.());
    this.elements.stopCameraButton.addEventListener('click', () => handlers.onStopCamera?.());
    this.elements.captureButton.addEventListener('click', () => handlers.onCapture?.());

    this.elements.debugToggle.addEventListener('change', () => {
      handlers.onDebugToggle?.(this.elements.debugToggle.checked);
    });

    this.elements.necklaceToggle.addEventListener('change', () => {
      handlers.onNecklaceToggle?.(this.elements.necklaceToggle.checked);
    });

    this.elements.necklaceCards.addEventListener('click', (event) => {
      const card = event.target.closest('[data-necklace-id]');
      if (!card) return;
      handlers.onNecklaceSelect?.(card.dataset.necklaceId);
    });

    this.elements.necklaceSelect.addEventListener('change', () => {
      handlers.onNecklaceSelect?.(this.elements.necklaceSelect.value);
    });

    this.elements.colorSwatches.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-color-id]');
      if (!swatch || swatch.disabled) return;
      handlers.onColorSelect?.(swatch.dataset.colorId, swatch.dataset.colorTargetId);
    });

    this.elements.verticalOffsetRange.addEventListener('input', () => handlers.onTuningInput?.());
    this.elements.scaleRange.addEventListener('input', () => handlers.onTuningInput?.());
    this.elements.rotationRange.addEventListener('input', () => handlers.onTuningInput?.());
    this.elements.resetTuningButton.addEventListener('click', () => handlers.onResetTuning?.());
    this.elements.downloadCaptureButton.addEventListener('click', () => handlers.onDownloadCapture?.());
    this.elements.shareCaptureButton.addEventListener('click', () => handlers.onShareCapture?.());

    this.elements.closeShareButtons.forEach((button) => {
      button.addEventListener('click', () => handlers.onCloseShareSheet?.());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.elements.shareSheet.hidden) {
        handlers.onCloseShareSheet?.();
      }
    });
  }

  populateNecklaceSelect(selectedNecklaceId) {
    this.elements.necklaceSelect.innerHTML = '';
    this.elements.necklaceCards.innerHTML = '';

    this.necklaces.forEach((necklace) => {
      const option = document.createElement('option');
      option.value = necklace.id;
      option.textContent = necklace.label;
      this.elements.necklaceSelect.append(option);

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
      this.elements.necklaceCards.append(card);
    });

    this.syncNecklaceSelection(selectedNecklaceId);
  }

  populateColorSwatches({ necklace, selectedColorIdsByTarget = {}, fallbackColorId = '', targetIds = [] }) {
    this.elements.colorSwatches.innerHTML = '';
    const palette = necklace.colorCustomization?.palette ?? [];
    const targets = necklace.colorCustomization?.targets ?? [];
    const targetConfigs = targetIds
      .map((targetId) => targets.find((target) => target.id === targetId))
      .filter(Boolean);

    this.elements.colorSwatches.toggleAttribute('hidden', !palette.length || !targetConfigs.length);

    targetConfigs.forEach((target) => {
      const group = document.createElement('section');
      group.className = 'color-target-group';

      const heading = document.createElement('strong');
      heading.className = 'color-target-group__heading';
      heading.textContent = target.label;

      const swatchGrid = document.createElement('div');
      swatchGrid.className = 'color-target-group__swatches';
      swatchGrid.setAttribute('role', 'radiogroup');
      swatchGrid.setAttribute('aria-label', `${target.label}顏色`);

      palette.forEach((colorOption) => {
        const button = document.createElement('button');
        button.className = 'color-swatch';
        button.type = 'button';
        button.dataset.colorId = colorOption.id;
        button.dataset.colorTargetId = target.id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-label', `${target.label}：${colorOption.label}`);
        button.title = `${target.label}：${colorOption.label}`;

        const chip = document.createElement('span');
        chip.className = 'color-swatch__chip';
        chip.style.setProperty('--swatch-color', colorOption.color);
        chip.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.textContent = colorOption.label;

        button.append(chip, label);
        swatchGrid.append(button);
      });

      group.append(heading, swatchGrid);
      this.elements.colorSwatches.append(group);
    });

    this.syncColorSelection({ selectedColorIdsByTarget, fallbackColorId });
    this.updateColorMeaning(necklace, fallbackColorId);
  }

  syncFromState(state, meta = {}) {
    const changes = meta.changes ?? [];
    const shouldSync = (keys) => !changes.length || keys.some((key) => changes.includes(key));

    if (shouldSync(['mode', 'controlsCollapsed', 'activePanel', 'modelLoaded'])) {
      this.syncModeUi(state);
    }

    if (shouldSync(['cameraStarted', 'isSwitchingCamera', 'cameraFacingMode'])) {
      this.syncCameraUi(state);
    }

    if (shouldSync(['selectedNecklace'])) {
      this.syncNecklaceSelection(state.selectedNecklace.id);
      this.updateColorMeaning(state.selectedNecklace, state.selectedColorId);
    } else if (shouldSync(['selectedColorId', 'selectedColorIdsByTarget'])) {
      this.syncColorSelection({
        selectedColorIdsByTarget: state.selectedColorIdsByTarget,
        fallbackColorId: state.selectedColorId,
      });
      this.updateColorMeaning(state.selectedNecklace, state.selectedColorId);
    }

    if (shouldSync(['necklaceVisible'])) {
      this.elements.necklaceToggle.checked = state.necklaceVisible;
    }

    if (shouldSync(['debugEnabled'])) {
      this.elements.debugToggle.checked = state.debugEnabled;
    }
  }

  syncModeUi(state) {
    const isShowcase = state.mode === APP_MODES.SHOWCASE;

    this.elements.app.classList.toggle('is-showcase-mode', isShowcase);
    this.elements.app.classList.toggle('is-ar-mode', !isShowcase);
    this.elements.app.classList.toggle('is-controls-collapsed', state.controlsCollapsed);

    this.elements.modeButtons.forEach((button) => {
      const isSelected = button.dataset.mode === state.mode;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    this.elements.arSections.forEach((section) => {
      section.hidden = isShowcase;
    });

    this.elements.stage.classList.toggle('is-showcase', isShowcase);
    this.elements.stage.classList.toggle('is-ar-mode', !isShowcase);
    this.elements.livePill.textContent = isShowcase ? '3D Model' : 'Live AR';
    this.elements.captureButton.hidden = isShowcase;
    this.syncBottomSheetUi(state);
    this.syncPanelUi(state);
  }

  syncBottomSheetUi(state) {
    this.elements.app.classList.toggle('is-controls-collapsed', state.controlsCollapsed);
    this.elements.bottomSheetToggle.setAttribute('aria-expanded', String(!state.controlsCollapsed));
    this.elements.bottomSheetToggle.setAttribute(
      'aria-label',
      state.controlsCollapsed ? '展開試戴選項' : '收起試戴選項',
    );
  }

  syncPanelUi(state) {
    this.elements.panelTabs.forEach((button) => {
      const isSelected = button.dataset.panelTab === state.activePanel;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    this.elements.controlPanels.forEach((panel) => {
      const isSelected = panel.dataset.controlPanel === state.activePanel;
      panel.classList.toggle('is-active', isSelected);
      if (isSelected) {
        panel.open = true;
      }
    });
  }

  canSelectControlPanel(panelName) {
    const panel = Array.from(this.elements.controlPanels).find((item) => item.dataset.controlPanel === panelName);
    return Boolean(panel && !panel.hidden);
  }

  syncCameraUi(state) {
    const isSelfie = isSelfieCamera(state.cameraFacingMode);
    const nextLabel = isSelfie ? '切換後鏡頭' : '切換前鏡頭';
    const switchLabel = state.isSwitchingCamera ? '鏡頭切換中' : nextLabel;

    this.elements.stage.classList.toggle('is-selfie-camera', isSelfie);
    this.elements.switchCameraButton.disabled = !state.cameraStarted || state.isSwitchingCamera;
    this.elements.stopCameraButton.disabled = !state.cameraStarted || state.isSwitchingCamera;
    this.elements.switchCameraButton.setAttribute('aria-label', switchLabel);
    this.elements.switchCameraButton.title = switchLabel;
  }

  syncNecklaceSelection(necklaceId) {
    this.elements.necklaceSelect.value = necklaceId;

    const cards = this.elements.necklaceCards.querySelectorAll('[data-necklace-id]');
    cards.forEach((card) => {
      const isSelected = card.dataset.necklaceId === necklaceId;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-checked', String(isSelected));
    });
  }

  syncColorSelection({ selectedColorIdsByTarget = {}, fallbackColorId = '' }) {
    const swatches = this.elements.colorSwatches.querySelectorAll('[data-color-id]');
    swatches.forEach((swatch) => {
      const targetId = swatch.dataset.colorTargetId;
      const selectedColorId = selectedColorIdsByTarget[targetId] ?? fallbackColorId;
      const isSelected = swatch.dataset.colorId === selectedColorId;
      swatch.classList.toggle('is-selected', isSelected);
      swatch.setAttribute('aria-checked', String(isSelected));
    });
  }

  updateColorMeaning(necklace, colorId) {
    const colorOption = getColorOption(necklace, colorId);
    const meaning = colorOption?.meaning;

    if (!colorOption || !meaning) {
      this.elements.colorMeaning.hidden = true;
      return;
    }

    this.elements.colorMeaning.hidden = false;
    this.elements.meaningChip.style.setProperty('--meaning-color', colorOption.color);
    this.elements.meaningTitle.textContent = colorOption.label;
    this.elements.meaningSummary.textContent = meaning.summary ?? '';
    this.elements.meaningKeywords.innerHTML = '';

    meaning.keywords?.forEach((keyword) => {
      const tag = document.createElement('span');
      tag.textContent = keyword;
      this.elements.meaningKeywords.append(tag);
    });
  }

  updateColorUiAvailability({ necklace, modelLoaded, hasColorableMaterials, targetLabels }) {
    const hasPalette = Boolean(necklace.colorCustomization?.palette?.length);
    const isAvailable = hasPalette && hasColorableMaterials;
    const swatches = this.elements.colorSwatches.querySelectorAll('[data-color-id]');

    swatches.forEach((swatch) => {
      swatch.disabled = !isAvailable;
    });

    if (!hasPalette) {
      this.elements.colorHint.textContent = '這個款式尚未設定可選顏色。';
      return;
    }

    if (!modelLoaded) {
      this.elements.colorHint.textContent = '正在確認這個款式的可換色材質。';
      return;
    }

    if (!hasColorableMaterials) {
      this.elements.colorHint.textContent = '這個模型目前沒有找到可換色材質，仍可正常試戴。';
      return;
    }

    this.elements.colorHint.textContent = targetLabels.length
      ? `會套用到：${targetLabels.join('、')}。`
      : '可套用到模型中的換色材質。';
  }

  readTuningControls() {
    const verticalOffset = Number(this.elements.verticalOffsetRange.value);
    const scale = Number(this.elements.scaleRange.value);
    const rotation = Number(this.elements.rotationRange.value);

    this.elements.verticalOffsetValue.textContent = formatSignedNumber(verticalOffset);
    this.elements.scaleValue.textContent = `${scale}%`;
    this.elements.rotationValue.textContent = `${formatSignedNumber(rotation)}°`;

    return {
      raw: {
        verticalOffset,
        scale,
        rotation,
      },
      adjustments: {
        verticalOffset: verticalOffset / 1000,
        scaleMultiplier: scale / 100,
        rotationOffset: (rotation * Math.PI) / 180,
      },
    };
  }

  resetTuningControls(defaults) {
    this.elements.verticalOffsetRange.value = String(defaults.verticalOffset);
    this.elements.scaleRange.value = String(defaults.scale);
    this.elements.rotationRange.value = String(defaults.rotation);
    return this.readTuningControls();
  }

  setStatus(kind, label, metrics) {
    const isPassiveTracking = kind === 'tracking' && label === '正在試戴' && !this.elements.debugToggle.checked;
    this.elements.statusPanel.dataset.status = kind;
    this.elements.statusPanel.classList.toggle('is-passive', isPassiveTracking);
    this.elements.trackingDot.classList.toggle('is-tracking', kind === 'tracking');
    this.elements.trackingDot.classList.toggle('is-error', kind === 'error');
    this.elements.trackingLabel.textContent = label;
    this.elements.trackingMetrics.textContent = metrics;
  }

  setStartButtonLabel(label) {
    this.elements.startButton.replaceChildren();

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    this.elements.startButton.append(icon, document.createTextNode(label));
  }

  setCameraOn(isCameraOn) {
    this.elements.stage.classList.toggle('is-camera-on', isCameraOn);
  }

  setCaptureDisabled(isDisabled) {
    this.elements.captureButton.disabled = isDisabled;
  }

  setCaptureBusy(isBusy) {
    this.elements.captureButton.classList.toggle('is-capturing', isBusy);
  }

  setShowcaseDragging(isDragging) {
    this.elements.stage.classList.toggle('is-dragging-showcase', isDragging);
  }

  setShareImage(dataUrl) {
    this.elements.shareImage.src = dataUrl;
  }

  openShareSheet() {
    this.elements.shareSheet.hidden = false;
  }

  closeShareSheet() {
    this.elements.shareSheet.hidden = true;
  }

  isDebugEnabled() {
    return this.elements.debugToggle.checked;
  }

  hasCurrentVideoFrame() {
    return this.elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  showError(message) {
    this.elements.errorBox.hidden = false;
    this.elements.errorBox.textContent = message;
    console.error(message);
  }

  clearError() {
    this.elements.errorBox.hidden = true;
    this.elements.errorBox.textContent = '';
  }
}

function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

function formatSignedNumber(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

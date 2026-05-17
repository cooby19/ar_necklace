import { APP_MODES, isSelfieCamera } from './AppState.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const PREVIOUS_TABINDEX_ATTRIBUTE = 'data-share-previous-tabindex';

export class UiController {
  constructor({ necklaces }) {
    this.necklaces = necklaces;
    this.eventDisposers = [];
    this.shareFocusReturnElement = null;
    this.elements = {
      app: queryRequired('#app'),
      stage: queryRequired('.stage'),
      video: queryRequired('#cameraVideo'),
      threeCanvas: queryRequired('#threeCanvas'),
      debugCanvas: queryRequired('#debugCanvas'),
      developerPanel: queryRequired('#developerPanel'),
      debugFps: queryRequired('#debugFps'),
      debugInferenceMs: queryRequired('#debugInferenceMs'),
      debugFaceWidth: queryRequired('#debugFaceWidth'),
      debugYaw: queryRequired('#debugYaw'),
      debugScale: queryRequired('#debugScale'),
      debugModelUrl: queryRequired('#debugModelUrl'),
      debugMaterialHits: queryRequired('#debugMaterialHits'),
      debugReleaseVersion: queryRequired('#debugReleaseVersion'),
      livePill: queryRequired('.live-pill'),
      experienceColumn: queryRequired('.experience-column'),
      controls: queryRequired('.controls'),
      captureButton: queryRequired('#captureButton'),
      bottomSheetToggle: queryRequired('#bottomSheetToggle'),
      modeButtons: queryRequiredAll('[data-mode]'),
      panelTabs: queryRequiredAll('[data-panel-tab]'),
      controlPanels: queryRequiredAll('[data-control-panel]'),
      arSections: queryRequiredAll('[data-ar-section]'),
      startButton: queryRequired('#startButton'),
      switchCameraButton: queryRequired('#switchCameraButton'),
      stopCameraButton: queryRequired('#stopCameraButton'),
      necklaceToggle: queryRequired('#necklaceToggle'),
      debugToggle: queryRequired('#debugToggle'),
      necklaceCards: queryRequired('#necklaceCards'),
      necklaceSelect: queryRequired('#necklaceSelect'),
      colorSwatches: queryRequired('#colorSwatches'),
      colorHint: queryRequired('#colorHint'),
      colorMeaning: queryRequired('#colorMeaning'),
      meaningChip: queryRequired('#meaningChip'),
      meaningTitle: queryRequired('#meaningTitle'),
      meaningSummary: queryRequired('#meaningSummary'),
      meaningKeywords: queryRequired('#meaningKeywords'),
      verticalOffsetRange: queryRequired('#verticalOffsetRange'),
      verticalOffsetValue: queryRequired('#verticalOffsetValue'),
      scaleRange: queryRequired('#scaleRange'),
      scaleValue: queryRequired('#scaleValue'),
      rotationRange: queryRequired('#rotationRange'),
      rotationValue: queryRequired('#rotationValue'),
      calibrationHint: queryRequired('#calibrationHint'),
      saveCalibrationButton: queryRequired('#saveCalibrationButton'),
      resetTuningButton: queryRequired('#resetTuningButton'),
      shareSheet: queryRequired('#shareSheet'),
      shareCard: queryRequired('.share-card'),
      shareImage: queryRequired('#shareImage'),
      downloadCaptureButton: queryRequired('#downloadCaptureButton'),
      shareCaptureButton: queryRequired('#shareCaptureButton'),
      closeShareButtons: queryRequiredAll('[data-close-share]'),
      errorBox: queryRequired('#errorBox'),
      statusPanel: queryRequired('.status-panel'),
      trackingDot: queryRequired('#trackingDot'),
      trackingLabel: queryRequired('#trackingLabel'),
      trackingMetrics: queryRequired('#trackingMetrics'),
    };
  }

  bind(handlers) {
    this.destroy();
    const listen = (target, eventName, handler, options) => {
      const dispose = on(target, eventName, handler, options);
      this.eventDisposers.push(dispose);
      return dispose;
    };

    this.elements.modeButtons.forEach((button) => {
      listen(button, 'click', () => handlers.onModeSelect?.(button.dataset.mode));
    });

    this.elements.panelTabs.forEach((button) => {
      listen(button, 'click', () => handlers.onPanelSelect?.(button.dataset.panelTab));
    });

    listen(this.elements.bottomSheetToggle, 'click', () => handlers.onBottomSheetToggle?.());

    listen(this.elements.threeCanvas, 'pointerdown', (event) => handlers.onShowcasePointerDown?.(event));
    listen(this.elements.threeCanvas, 'pointermove', (event) => handlers.onShowcasePointerMove?.(event));
    listen(this.elements.threeCanvas, 'pointerup', (event) => handlers.onShowcasePointerUp?.(event));
    listen(this.elements.threeCanvas, 'pointercancel', (event) => handlers.onShowcasePointerUp?.(event));
    listen(this.elements.threeCanvas, 'pointerleave', (event) => handlers.onShowcasePointerUp?.(event));

    listen(this.elements.startButton, 'click', () => handlers.onStartCamera?.());
    listen(this.elements.switchCameraButton, 'click', () => handlers.onSwitchCamera?.());
    listen(this.elements.stopCameraButton, 'click', () => handlers.onStopCamera?.());
    listen(this.elements.captureButton, 'click', () => handlers.onCapture?.());

    listen(this.elements.debugToggle, 'change', () => {
      handlers.onDebugToggle?.(this.elements.debugToggle.checked);
    });

    listen(this.elements.necklaceToggle, 'change', () => {
      handlers.onNecklaceToggle?.(this.elements.necklaceToggle.checked);
    });

    listen(this.elements.necklaceCards, 'click', (event) => {
      const card = event.target.closest('[data-necklace-id]');
      if (!card) return;
      handlers.onNecklaceSelect?.(card.dataset.necklaceId);
    });

    listen(this.elements.necklaceCards, 'keydown', (event) => {
      const card = event.target.closest('[data-necklace-id]');
      if (!card) return;

      handleRadioKeydown(event, {
        currentItem: card,
        items: [...this.elements.necklaceCards.querySelectorAll('[data-necklace-id]')],
        onSelect: (nextCard) => handlers.onNecklaceSelect?.(nextCard.dataset.necklaceId),
      });
    });

    listen(this.elements.necklaceSelect, 'change', () => {
      handlers.onNecklaceSelect?.(this.elements.necklaceSelect.value);
    });

    listen(this.elements.colorSwatches, 'click', (event) => {
      const swatch = event.target.closest('[data-color-id]');
      if (!swatch || swatch.disabled) return;
      handlers.onColorSelect?.(swatch.dataset.colorId, swatch.dataset.colorTargetId);
    });

    listen(this.elements.colorSwatches, 'keydown', (event) => {
      const swatch = event.target.closest('[data-color-id]');
      if (!swatch || swatch.disabled) return;

      const group = swatch.closest('[role="radiogroup"]');
      if (!group) return;

      handleRadioKeydown(event, {
        currentItem: swatch,
        items: [...group.querySelectorAll('[data-color-id]')].filter((item) => !item.disabled),
        onSelect: (nextSwatch) =>
          handlers.onColorSelect?.(nextSwatch.dataset.colorId, nextSwatch.dataset.colorTargetId),
      });
    });

    listen(this.elements.verticalOffsetRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.scaleRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.rotationRange, 'input', () => handlers.onTuningInput?.());
    listen(this.elements.saveCalibrationButton, 'click', () => handlers.onSaveCalibration?.());
    listen(this.elements.resetTuningButton, 'click', () => handlers.onResetCalibration?.());
    listen(this.elements.downloadCaptureButton, 'click', () => handlers.onDownloadCapture?.());
    listen(this.elements.shareCaptureButton, 'click', () => handlers.onShareCapture?.());

    this.elements.closeShareButtons.forEach((button) => {
      listen(button, 'click', () => handlers.onCloseShareSheet?.());
    });

    listen(document, 'keydown', (event) => {
      if (this.elements.shareSheet.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        handlers.onCloseShareSheet?.();
        return;
      }

      if (event.key === 'Tab') {
        this.trapShareSheetFocus(event);
      }
    });

    listen(document, 'focusin', (event) => {
      if (this.elements.shareSheet.hidden || this.elements.shareCard.contains(event.target)) return;
      this.focusFirstShareSheetControl();
    });
  }

  destroy() {
    const disposers = this.eventDisposers.splice(0);
    disposers.forEach((dispose) => dispose());
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
      card.setAttribute('aria-checked', 'false');
      card.tabIndex = -1;

      const preview = document.createElement('span');
      preview.className = 'necklace-card__preview';
      preview.setAttribute('aria-hidden', 'true');

      if (necklace.thumbnailUrl) {
        preview.classList.add('has-thumbnail');

        const thumbnail = document.createElement('img');
        thumbnail.className = 'necklace-card__thumbnail';
        thumbnail.src = necklace.thumbnailUrl;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.decoding = 'async';
        thumbnail.addEventListener('error', () => {
          preview.classList.remove('has-thumbnail');
          thumbnail.remove();
        });
        preview.append(thumbnail);
      }

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
      heading.id = `color-target-${target.id}-heading`;
      heading.textContent = target.label;

      const swatchGrid = document.createElement('div');
      swatchGrid.className = 'color-target-group__swatches';
      swatchGrid.setAttribute('role', 'radiogroup');
      swatchGrid.setAttribute('aria-labelledby', heading.id);

      palette.forEach((colorOption) => {
        const button = document.createElement('button');
        button.className = 'color-swatch';
        button.type = 'button';
        button.dataset.colorId = colorOption.id;
        button.dataset.colorTargetId = target.id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('aria-label', `${target.label}：${colorOption.label}`);
        button.tabIndex = -1;
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

    if (shouldSync(['mode', 'debugEnabled'])) {
      this.setDeveloperPanelVisible(state.mode === APP_MODES.AR && state.debugEnabled);
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

    const cards = [...this.elements.necklaceCards.querySelectorAll('[data-necklace-id]')];
    const selectedIndex = Math.max(
      0,
      cards.findIndex((card) => card.dataset.necklaceId === necklaceId),
    );

    cards.forEach((card, index) => {
      const isSelected = card.dataset.necklaceId === necklaceId;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-checked', String(isSelected));
      card.tabIndex = index === selectedIndex ? 0 : -1;
    });
  }

  syncColorSelection({ selectedColorIdsByTarget = {}, fallbackColorId = '' }) {
    const groups = this.elements.colorSwatches.querySelectorAll('[role="radiogroup"]');

    groups.forEach((group) => {
      const swatches = [...group.querySelectorAll('[data-color-id]')];
      const selectedIndex = Math.max(
        0,
        swatches.findIndex((swatch) => {
          const targetId = swatch.dataset.colorTargetId;
          const selectedColorId = selectedColorIdsByTarget[targetId] ?? fallbackColorId;
          return swatch.dataset.colorId === selectedColorId;
        }),
      );

      swatches.forEach((swatch, index) => {
        const targetId = swatch.dataset.colorTargetId;
        const selectedColorId = selectedColorIdsByTarget[targetId] ?? fallbackColorId;
        const isSelected = swatch.dataset.colorId === selectedColorId;
        swatch.classList.toggle('is-selected', isSelected);
        swatch.setAttribute('aria-checked', String(isSelected));
        swatch.tabIndex = swatch.disabled ? -1 : index === selectedIndex ? 0 : -1;
      });
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
    this.syncColorSwatchTabIndex(isAvailable);

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

  syncColorSwatchTabIndex(isAvailable) {
    const groups = this.elements.colorSwatches.querySelectorAll('[role="radiogroup"]');

    groups.forEach((group) => {
      const swatches = [...group.querySelectorAll('[data-color-id]')];
      const selectedIndex = Math.max(
        0,
        swatches.findIndex((swatch) => swatch.classList.contains('is-selected')),
      );

      swatches.forEach((swatch, index) => {
        swatch.tabIndex = isAvailable && index === selectedIndex ? 0 : -1;
      });
    });
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

  syncTuningControlsFromAdjustments(adjustments = {}) {
    const verticalOffset = Math.round((adjustments.verticalOffset ?? 0) * 1000);
    const scale = Math.round((adjustments.scaleMultiplier ?? 1) * 100);
    const rotation = Math.round(((adjustments.rotationOffset ?? 0) * 180) / Math.PI);

    this.elements.verticalOffsetRange.value = String(clamp(verticalOffset, -200, 200));
    this.elements.scaleRange.value = String(clamp(scale, 80, 120));
    this.elements.rotationRange.value = String(clamp(rotation, -15, 15));
    return this.readTuningControls();
  }

  setCalibrationHint(message, { isDirty = false, isSaved = false } = {}) {
    this.elements.calibrationHint.textContent = message;
    this.elements.calibrationHint.classList.toggle('is-dirty', isDirty);
    this.elements.calibrationHint.classList.toggle('is-saved', isSaved);
  }

  setCalibrationDragging(isDragging) {
    this.elements.stage.classList.toggle('is-dragging-calibration', isDragging);
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
    this.shareFocusReturnElement = this.elements.captureButton;
    this.elements.shareSheet.hidden = false;
    this.focusFirstShareSheetControl({ immediate: true });
    this.setShareBackgroundInert(true);
  }

  closeShareSheet() {
    this.elements.shareSheet.hidden = true;
    this.setShareBackgroundInert(false);
    this.restoreShareSheetFocus();
  }

  setShareBackgroundInert(isInert) {
    [this.elements.experienceColumn, this.elements.controls].forEach((element) => {
      if (!element) return;
      element.inert = isInert;
      element.toggleAttribute('aria-hidden', isInert);
      setBackgroundFocusableState(element, isInert);
    });
  }

  trapShareSheetFocus(event) {
    const focusableElements = this.getShareSheetFocusableElements();
    if (!focusableElements.length) {
      event.preventDefault();
      this.elements.shareCard.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  focusFirstShareSheetControl({ immediate = false } = {}) {
    const focusTarget = () => {
      const closeButton = this.elements.shareCard.querySelector('[data-close-share]');
      const firstElement = closeButton ?? this.getShareSheetFocusableElements()[0] ?? this.elements.shareCard;
      firstElement.focus({ preventScroll: true });
    };

    if (immediate) {
      focusTarget();
      return;
    }

    requestAnimationFrame(focusTarget);
  }

  restoreShareSheetFocus() {
    requestAnimationFrame(() => {
      const fallbackElement = this.elements.captureButton;
      const target = this.shareFocusReturnElement ?? fallbackElement;
      if (target?.hidden || target?.disabled) return;
      target.focus({ preventScroll: true });
      this.shareFocusReturnElement = null;
    });
  }

  getShareSheetFocusableElements() {
    return getVisibleFocusableElements(this.elements.shareCard);
  }

  setDeveloperPanelVisible(isVisible) {
    this.elements.developerPanel.hidden = !isVisible;
  }

  updateDeveloperPanel({ debugData, stats, modelUrl, materialHitCount }) {
    this.elements.debugFps.textContent = stats?.renderFps ? `${stats.renderFps}` : '--';
    this.elements.debugInferenceMs.textContent =
      stats?.lastInferenceMs > 0 ? `${stats.lastInferenceMs.toFixed(1)} ms` : '-- ms';
    this.elements.debugFaceWidth.textContent = Number.isFinite(debugData?.faceWidth)
      ? debugData.faceWidth.toFixed(3)
      : '--';
    this.elements.debugYaw.textContent = debugData ? `${(debugData.rotationY * 57.2958).toFixed(1)} deg` : '-- deg';
    this.elements.debugScale.textContent = Number.isFinite(debugData?.scale) ? debugData.scale.toFixed(3) : '--';
    this.elements.debugModelUrl.textContent = modelUrl || '--';
    this.elements.debugModelUrl.title = modelUrl || '';
    this.elements.debugMaterialHits.textContent = String(materialHitCount ?? 0);
  }

  setReleaseMetadata(metadata) {
    const shortSha = metadata.commitSha ? metadata.commitSha.slice(0, 12) : 'unknown';
    const releaseLabel = `v${metadata.version ?? '0.0.0'} · ${shortSha}`;
    const releaseTitle = [
      `version: ${metadata.version ?? 'unknown'}`,
      `commit: ${metadata.commitSha ?? 'unknown'}`,
      `buildTime: ${metadata.buildTime ?? 'unknown'}`,
      `environment: ${metadata.environment ?? 'unknown'}`,
    ].join('\n');

    this.elements.debugReleaseVersion.textContent = releaseLabel;
    this.elements.debugReleaseVersion.title = releaseTitle;
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

// DOM lookup and listener helpers.
function queryRequired(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required UI element: ${selector}`);
  }
  return element;
}

function queryRequiredAll(selector, root = document) {
  const elements = [...root.querySelectorAll(selector)];
  if (!elements.length) {
    throw new Error(`Missing required UI element: ${selector}`);
  }
  return elements;
}

function on(target, eventName, handler, options) {
  target.addEventListener(eventName, handler, options);
  return () => target.removeEventListener(eventName, handler, options);
}

// Radio group keyboard helpers.
function handleRadioKeydown(event, { currentItem, items, onSelect }) {
  if (!items.length) return;

  const currentIndex = items.indexOf(currentItem);
  if (currentIndex < 0) return;

  const movement = getRadioKeyMovement(event.key);
  if (movement !== null) {
    event.preventDefault();

    const nextIndex = wrapIndex(currentIndex + movement, items.length);
    selectRadioItem(items[nextIndex], onSelect);
    return;
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    selectRadioItem(event.key === 'Home' ? items[0] : items[items.length - 1], onSelect);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectRadioItem(currentItem, onSelect);
  }
}

function getRadioKeyMovement(key) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -1;
  return null;
}

function selectRadioItem(item, onSelect) {
  item.focus({ preventScroll: true });
  item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  onSelect(item);
}

function wrapIndex(index, length) {
  return (index + length) % length;
}

// Focus and background inertness helpers.
function getVisibleFocusableElements(root) {
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isElementFocusable);
}

function isElementFocusable(element) {
  return !element.disabled && element.tabIndex !== -1 && isElementVisible(element);
}

function isElementVisible(element) {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function setBackgroundFocusableState(root, isInert) {
  root.querySelectorAll(`${FOCUSABLE_SELECTOR}, [${PREVIOUS_TABINDEX_ATTRIBUTE}]`).forEach((element) => {
    if (isInert) {
      if (!element.hasAttribute(PREVIOUS_TABINDEX_ATTRIBUTE)) {
        element.setAttribute(PREVIOUS_TABINDEX_ATTRIBUTE, element.getAttribute('tabindex') ?? '');
      }
      element.tabIndex = -1;
      return;
    }

    if (!element.hasAttribute(PREVIOUS_TABINDEX_ATTRIBUTE)) return;

    const previousTabIndex = element.getAttribute(PREVIOUS_TABINDEX_ATTRIBUTE);
    if (previousTabIndex) {
      element.setAttribute('tabindex', previousTabIndex);
    } else {
      element.removeAttribute('tabindex');
    }
    element.removeAttribute(PREVIOUS_TABINDEX_ATTRIBUTE);
  });
}

// Formatting and small data helpers.
function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

function formatSignedNumber(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

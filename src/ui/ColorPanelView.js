import { handleRadioKeydown, queryRequired } from './domHelpers.js';

export class ColorPanelView {
  constructor() {
    this.elements = {
      colorSwatches: queryRequired('#colorSwatches'),
      colorHint: queryRequired('#colorHint'),
      colorMeaning: queryRequired('#colorMeaning'),
      meaningChip: queryRequired('#meaningChip'),
      meaningTitle: queryRequired('#meaningTitle'),
      meaningSummary: queryRequired('#meaningSummary'),
      meaningKeywords: queryRequired('#meaningKeywords'),
    };
  }

  bind(handlers, listen) {
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
  }

  populate({ necklace, selectedColorIdsByTarget = {}, fallbackColorId = '', targetIds = [] }) {
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
        button.setAttribute('data-color-id', colorOption.id);
        button.setAttribute('data-color-target-id', target.id);
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

    this.syncSelection({ selectedColorIdsByTarget, fallbackColorId });
    this.updateMeaning(necklace, fallbackColorId);
  }

  syncSelection({ selectedColorIdsByTarget = {}, fallbackColorId = '' }) {
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

  updateMeaning(necklace, colorId) {
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

  updateAvailability({ necklace, modelLoaded, hasColorableMaterials, targetLabels }) {
    const hasPalette = Boolean(necklace.colorCustomization?.palette?.length);
    const isAvailable = hasPalette && hasColorableMaterials;
    const swatches = this.elements.colorSwatches.querySelectorAll('[data-color-id]');

    swatches.forEach((swatch) => {
      swatch.disabled = !isAvailable;
    });
    this.syncSwatchTabIndex(isAvailable);

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

  syncSwatchTabIndex(isAvailable) {
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
}

function getColorOption(necklace, colorId) {
  const palette = necklace.colorCustomization?.palette ?? [];
  return palette.find((colorOption) => colorOption.id === colorId);
}

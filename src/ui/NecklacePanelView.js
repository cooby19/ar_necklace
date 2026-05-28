import { handleRadioKeydown, queryRequired } from './domHelpers.js';

export class NecklacePanelView {
  constructor({ necklaces }) {
    this.necklaces = necklaces;
    this.elements = {
      necklaceCards: queryRequired('#necklaceCards'),
      necklaceSelect: queryRequired('#necklaceSelect'),
    };
  }

  bind(handlers, listen) {
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
  }

  populate(selectedNecklaceId) {
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
      card.setAttribute('data-necklace-id', necklace.id);
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

    this.syncSelection(selectedNecklaceId);
  }

  syncSelection(necklaceId) {
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
}

import { queryRequired } from './domHelpers.js';

export class GalleryView {
  constructor({ necklaces }) {
    this.necklaces = necklaces;
    this.elements = {
      galleryScreen: queryRequired('#galleryScreen'),
      galleryCards: queryRequired('#galleryCards'),
      backToGalleryButton: queryRequired('#backToGalleryButton'),
    };
  }

  bind(handlers, listen) {
    listen(this.elements.galleryCards, 'click', (event) => {
      const card = event.target.closest('[data-necklace-id]');
      if (!card) return;
      handlers.onGallerySelect?.(card.dataset.necklaceId);
    });

    listen(this.elements.backToGalleryButton, 'click', () => {
      handlers.onBackToGallery?.();
    });
  }

  populate() {
    this.elements.galleryCards.innerHTML = '';

    this.necklaces.forEach((necklace) => {
      const card = document.createElement('button');
      card.className = 'gallery-card';
      card.type = 'button';
      card.setAttribute('data-necklace-id', necklace.id);

      const preview = document.createElement('span');
      preview.className = 'gallery-card__preview';
      preview.setAttribute('aria-hidden', 'true');

      if (necklace.thumbnailUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.className = 'gallery-card__thumb';
        thumbnail.src = necklace.thumbnailUrl;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.decoding = 'async';
        thumbnail.addEventListener('error', () => {
          thumbnail.remove();
        });
        preview.append(thumbnail);
      }

      const content = document.createElement('span');
      content.className = 'gallery-card__content';

      const label = document.createElement('strong');
      label.className = 'gallery-card__label';
      label.textContent = necklace.label;

      const description = document.createElement('small');
      description.className = 'gallery-card__desc';
      description.textContent = necklace.description ?? '試戴款式';

      content.append(label, description);
      card.append(preview, content);
      this.elements.galleryCards.append(card);
    });
  }

  setVisible(isGallery) {
    this.elements.galleryScreen.hidden = !isGallery;
  }
}

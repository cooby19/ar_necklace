import { afterEach, describe, expect, it, vi } from 'vitest';
import { NECKLACES } from '../config/necklaces.js';
import { cleanupFakeDocument, installFakeDocument } from './test/fakeDom.js';
import { GalleryView } from './GalleryView.js';

const listen = (target, eventName, handler) => target.addEventListener(eventName, handler);

afterEach(() => {
  cleanupFakeDocument();
});

describe('GalleryView', () => {
  it('renders one card per necklace with id, label, description, and thumbnail', () => {
    installFakeDocument();
    const view = new GalleryView({ necklaces: NECKLACES });

    view.populate();

    const cards = view.elements.galleryCards.children;
    expect(cards).toHaveLength(NECKLACES.length);
    expect(cards.map((card) => card.dataset.necklaceId)).toEqual(NECKLACES.map((necklace) => necklace.id));
    expect(cards[0].querySelector('img')?.src).toBe(NECKLACES[0].thumbnailUrl);
  });

  it('invokes onGallerySelect with the necklace id when a card is clicked', () => {
    installFakeDocument();
    const view = new GalleryView({ necklaces: NECKLACES });
    const onGallerySelect = vi.fn();
    view.bind({ onGallerySelect }, listen);
    view.populate();

    const card = view.elements.galleryCards.children[1];
    view.elements.galleryCards.dispatch('click', { target: card });

    expect(onGallerySelect).toHaveBeenCalledWith(NECKLACES[1].id);
  });

  it('invokes onBackToGallery when the back control is clicked', () => {
    installFakeDocument();
    const view = new GalleryView({ necklaces: NECKLACES });
    const onBackToGallery = vi.fn();
    view.bind({ onBackToGallery }, listen);

    view.elements.backToGalleryButton.dispatch('click');

    expect(onBackToGallery).toHaveBeenCalledTimes(1);
  });

  it('toggles gallery screen visibility', () => {
    installFakeDocument();
    const view = new GalleryView({ necklaces: NECKLACES });

    view.setVisible(false);
    expect(view.elements.galleryScreen.hidden).toBe(true);

    view.setVisible(true);
    expect(view.elements.galleryScreen.hidden).toBe(false);
  });
});

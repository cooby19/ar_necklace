import { afterEach, describe, expect, it } from 'vitest';
import { DeveloperPanelView } from './DeveloperPanelView.js';
import { cleanupFakeDocument, installFakeDocument } from './test/fakeDom.js';

afterEach(() => {
  cleanupFakeDocument();
});

describe('DeveloperPanelView', () => {
  it('renders tracking, model, material, and release metadata', () => {
    installFakeDocument();
    const view = new DeveloperPanelView();

    view.update({
      debugData: {
        faceWidth: 0.23456,
        rotationY: 0.5,
        scale: 1.23456,
      },
      stats: {
        renderFps: 58,
        lastInferenceMs: 12.345,
      },
      modelUrl: '/models/necklace.glb',
      materialHitCount: 3,
    });
    view.setReleaseMetadata({
      version: '1.2.3',
      commitSha: 'abcdef1234567890',
      buildTime: '2026-05-28T00:00:00Z',
      environment: 'test',
    });

    expect(view.elements.debugFps.textContent).toBe('58');
    expect(view.elements.debugInferenceMs.textContent).toBe('12.3 ms');
    expect(view.elements.debugFaceWidth.textContent).toBe('0.235');
    expect(view.elements.debugYaw.textContent).toBe('28.6 deg');
    expect(view.elements.debugScale.textContent).toBe('1.235');
    expect(view.elements.debugModelUrl.textContent).toBe('/models/necklace.glb');
    expect(view.elements.debugMaterialHits.textContent).toBe('3');
    expect(view.elements.debugReleaseVersion.textContent).toBe('v1.2.3 · abcdef123456');
    expect(view.elements.debugReleaseVersion.title).toContain('environment: test');
  });
});

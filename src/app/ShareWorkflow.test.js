import { describe, expect, it } from 'vitest';
import { ShareWorkflow } from './ShareWorkflow.js';

function createWorkflow() {
  return new ShareWorkflow({
    captureService: {},
    scene: {},
  });
}

const readyState = {
  cameraStarted: true,
  hasFace: true,
  necklaceVisible: true,
};

describe('ShareWorkflow capture blockers', () => {
  it('blocks capture until the camera has a current frame', () => {
    const workflow = createWorkflow();

    expect(workflow.getCaptureBlocker({ ...readyState, cameraStarted: false }, { hasCurrentVideoFrame: true }))
      .toMatchObject({
        status: 'blocked',
        view: {
          label: '尚未開啟相機',
          metrics: '請先啟動相機再拍照',
        },
      });
    expect(workflow.getCaptureBlocker(readyState, { hasCurrentVideoFrame: false })).toMatchObject({
      status: 'blocked',
      view: {
        label: '尚未開啟相機',
        metrics: '請先啟動相機再拍照',
      },
    });
  });

  it('blocks capture without a detected face', () => {
    const workflow = createWorkflow();

    expect(workflow.getCaptureBlocker({ ...readyState, hasFace: false }, { hasCurrentVideoFrame: true }))
      .toMatchObject({
        status: 'blocked',
        view: {
          label: '尚未偵測到臉',
          metrics: '請將臉保持在畫面中央後再拍照',
        },
      });
  });

  it('blocks capture while necklace preview is hidden', () => {
    const workflow = createWorkflow();

    expect(workflow.getCaptureBlocker({ ...readyState, necklaceVisible: false }, { hasCurrentVideoFrame: true }))
      .toMatchObject({
        status: 'blocked',
        view: {
          label: '項鍊目前隱藏',
          metrics: '請先開啟項鍊預覽再拍照',
        },
      });
  });

  it('allows capture only when camera, frame, face and necklace are all ready', () => {
    const workflow = createWorkflow();

    expect(workflow.getCaptureBlocker(readyState, { hasCurrentVideoFrame: true })).toBeNull();
  });
});

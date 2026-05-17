// @ts-check

const SHARE_IMAGE_SIZE = 1080;
const SHARE_FILE_NAME = 'soft-jewelry-try-on.png';

/** @typedef {import('../types/domain').CaptureResult} CaptureResult */
/** @typedef {import('../types/domain').ShareResult} ShareResult */

export class CaptureService {
  /**
   * @param {{
   *   stageElement: HTMLElement,
   *   videoElement: HTMLVideoElement,
   *   threeCanvas: HTMLCanvasElement,
   * }} options
   */
  constructor({ stageElement, videoElement, threeCanvas }) {
    this.stageElement = stageElement;
    this.videoElement = videoElement;
    this.threeCanvas = threeCanvas;
    this.fileName = SHARE_FILE_NAME;
  }

  /**
   * @param {{ mirrored?: boolean }} [options]
   * @returns {Promise<CaptureResult>}
   */
  async createCapture({ mirrored = false } = {}) {
    const captureCanvas = this.createBrandedCapture({ mirrored });
    const blob = await canvasToBlob(captureCanvas);
    const url = URL.createObjectURL(blob);
    return {
      url,
      dataUrl: url,
      blob,
    };
  }

  /**
   * @param {{ blob?: Blob | null, url?: string, dataUrl?: string } | string} capture
   * @returns {void}
   */
  download(capture) {
    const downloadUrl = this.createDownloadUrl(capture);
    if (!downloadUrl.href) return;

    const link = document.createElement('a');
    link.href = downloadUrl.href;
    link.download = this.fileName;
    document.body.append(link);
    link.click();
    link.remove();

    if (downloadUrl.shouldRevoke) {
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl.href), 0);
    }
  }

  /**
   * @param {{ blob?: Blob | null, url?: string, dataUrl?: string } | string} capture
   * @returns {{ href: string, shouldRevoke: boolean }}
   */
  createDownloadUrl(capture) {
    if (typeof capture === 'string') {
      return { href: capture, shouldRevoke: false };
    }

    if (capture?.blob) {
      return {
        href: URL.createObjectURL(capture.blob),
        shouldRevoke: true,
      };
    }

    return {
      href: capture?.url || capture?.dataUrl || '',
      shouldRevoke: false,
    };
  }

  /**
   * @param {Blob | null | undefined} blob
   * @returns {Promise<ShareResult>}
   */
  async share(blob) {
    if (!blob) return { status: 'empty' };

    const file = new File([blob], this.fileName, { type: 'image/png' });
    const sharePayload = {
      files: [file],
      title: '我的項鍊試戴',
      text: 'Soft Jewelry Studio AR Necklace Try-On',
    };

    if (!navigator.canShare?.(sharePayload)) {
      return { status: 'unsupported' };
    }

    try {
      await navigator.share(sharePayload);
      return { status: 'shared' };
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted' };
      }

      throw error;
    }
  }

  /**
   * @param {{ mirrored: boolean }} options
   * @returns {HTMLCanvasElement}
   */
  createBrandedCapture({ mirrored }) {
    const stageRect = this.stageElement.getBoundingClientRect();
    const sourceWidth = Math.max(1, Math.round(stageRect.width));
    const sourceHeight = Math.max(1, Math.round(stageRect.height));
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = sourceWidth;
    sourceCanvas.height = sourceHeight;

    const sourceContext = getCanvas2dContext(sourceCanvas);
    drawCoverVideo(sourceContext, this.videoElement, sourceWidth, sourceHeight, { mirrored });
    sourceContext.drawImage(this.threeCanvas, 0, 0, sourceWidth, sourceHeight);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = SHARE_IMAGE_SIZE;
    outputCanvas.height = SHARE_IMAGE_SIZE;
    const outputContext = getCanvas2dContext(outputCanvas);

    outputContext.fillStyle = '#fffaf7';
    outputContext.fillRect(0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
    drawCoverImage(outputContext, sourceCanvas, 0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
    drawShareImagePolish(outputContext, SHARE_IMAGE_SIZE);
    drawBrandLogo(outputContext);

    return outputCanvas;
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
function getCanvas2dContext(canvas) {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('瀏覽器無法建立 2D 圖片輸出環境');
  }

  return context;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLVideoElement} video
 * @param {number} width
 * @param {number} height
 * @param {{ mirrored?: boolean }} [options]
 * @returns {void}
 */
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

/**
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLCanvasElement} image
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
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

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} size
 * @returns {void}
 */
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

/**
 * @param {CanvasRenderingContext2D} context
 * @returns {void}
 */
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

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {void}
 */
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

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
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

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isAbortError(error) {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

const SHARE_IMAGE_SIZE = 1080;
const SHARE_FILE_NAME = 'soft-jewelry-try-on.png';

export class CaptureService {
  constructor({ stageElement, videoElement, threeCanvas }) {
    this.stageElement = stageElement;
    this.videoElement = videoElement;
    this.threeCanvas = threeCanvas;
    this.fileName = SHARE_FILE_NAME;
  }

  async createCapture({ mirrored = false } = {}) {
    const captureCanvas = this.createBrandedCapture({ mirrored });
    return {
      dataUrl: captureCanvas.toDataURL('image/png'),
      blob: await canvasToBlob(captureCanvas),
    };
  }

  download(dataUrl) {
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = this.fileName;
    document.body.append(link);
    link.click();
    link.remove();
  }

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
      if (error.name === 'AbortError') {
        return { status: 'aborted' };
      }

      throw error;
    }
  }

  createBrandedCapture({ mirrored }) {
    const stageRect = this.stageElement.getBoundingClientRect();
    const sourceWidth = Math.max(1, Math.round(stageRect.width));
    const sourceHeight = Math.max(1, Math.round(stageRect.height));
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = sourceWidth;
    sourceCanvas.height = sourceHeight;

    const sourceContext = sourceCanvas.getContext('2d');
    drawCoverVideo(sourceContext, this.videoElement, sourceWidth, sourceHeight, { mirrored });
    sourceContext.drawImage(this.threeCanvas, 0, 0, sourceWidth, sourceHeight);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = SHARE_IMAGE_SIZE;
    outputCanvas.height = SHARE_IMAGE_SIZE;
    const outputContext = outputCanvas.getContext('2d');

    outputContext.fillStyle = '#fffaf7';
    outputContext.fillRect(0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
    drawCoverImage(outputContext, sourceCanvas, 0, 0, SHARE_IMAGE_SIZE, SHARE_IMAGE_SIZE);
    drawShareImagePolish(outputContext, SHARE_IMAGE_SIZE);
    drawBrandLogo(outputContext);

    return outputCanvas;
  }
}

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

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { processGlb } = require('gltf-pipeline');

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const modelsDir = path.join(projectRoot, 'public', 'models');
const maxTextureSize = Number.parseInt(process.env.GLB_TEXTURE_MAX_SIZE ?? '512', 10);
const dracoOptions = {
  compressionLevel: 10,
  quantizePositionBits: 14,
  quantizeNormalBits: 10,
  quantizeTexcoordBits: 12,
  unifiedQuantization: true,
};

const glbFiles = await findGlbFiles(modelsDir);

if (glbFiles.length === 0) {
  console.log('No GLB files found in public/models.');
  process.exit(0);
}

const results = [];

for (const inputPath of glbFiles) {
  const parsedPath = path.parse(inputPath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.draco.glb`);
  const inputBuffer = await readFile(inputPath);
  const optimizedInput = await resizeEmbeddedPngTextures(inputBuffer, maxTextureSize);
  const processed = await processGlb(optimizedInput.buffer, {
    resourceDirectory: parsedPath.dir,
    name: `${parsedPath.name}.draco`,
    dracoOptions,
  });

  await writeFile(outputPath, processed.glb);

  const inputBytes = (await stat(inputPath)).size;
  const outputBytes = (await stat(outputPath)).size;
  const reduction = 1 - outputBytes / inputBytes;

  results.push({
    input: path.relative(projectRoot, inputPath),
    output: path.relative(projectRoot, outputPath),
    inputBytes,
    outputBytes,
    reduction,
    textureBytesBefore: optimizedInput.textureBytesBefore,
    textureBytesAfter: optimizedInput.textureBytesAfter,
  });
}

console.table(
  results.map((result) => ({
    input: result.input,
    output: result.output,
    before: result.inputBytes,
    after: result.outputBytes,
    reduction: `${(result.reduction * 100).toFixed(1)}%`,
    textures: `${result.textureBytesBefore} -> ${result.textureBytesAfter}`,
  })),
);

async function findGlbFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findGlbFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.glb') && !entry.name.endsWith('.draco.glb')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function resizeEmbeddedPngTextures(glbBuffer, textureMaxSize) {
  if (!Number.isFinite(textureMaxSize) || textureMaxSize <= 0) {
    return {
      buffer: glbBuffer,
      textureBytesBefore: 0,
      textureBytesAfter: 0,
    };
  }

  const { json, bin } = parseGlb(glbBuffer);
  const imageByBufferView = new Map();

  for (const image of json.images ?? []) {
    if (image.mimeType === 'image/png' && Number.isInteger(image.bufferView)) {
      imageByBufferView.set(image.bufferView, image);
    }
  }

  if (imageByBufferView.size === 0 || !bin) {
    return {
      buffer: glbBuffer,
      textureBytesBefore: 0,
      textureBytesAfter: 0,
    };
  }

  const newBufferViews = [];
  const binaryParts = [];
  let binaryOffset = 0;
  let textureBytesBefore = 0;
  let textureBytesAfter = 0;

  for (const [index, bufferView] of (json.bufferViews ?? []).entries()) {
    const sourceStart = bufferView.byteOffset ?? 0;
    const sourceEnd = sourceStart + bufferView.byteLength;
    const sourceBytes = bin.subarray(sourceStart, sourceEnd);
    const image = imageByBufferView.get(index);
    let outputBytes = sourceBytes;

    if (image) {
      textureBytesBefore += sourceBytes.byteLength;
      outputBytes = await resizePng(sourceBytes, textureMaxSize);
      textureBytesAfter += outputBytes.byteLength;
    }

    const alignedBytes = padBuffer(outputBytes, 0x00);
    newBufferViews.push({
      ...bufferView,
      byteOffset: binaryOffset,
      byteLength: outputBytes.byteLength,
    });
    binaryParts.push(alignedBytes);
    binaryOffset += alignedBytes.byteLength;
  }

  const newBin = Buffer.concat(binaryParts);
  const nextJson = {
    ...json,
    buffers: [{ ...(json.buffers?.[0] ?? {}), byteLength: newBin.byteLength }],
    bufferViews: newBufferViews,
  };

  return {
    buffer: buildGlb(nextJson, newBin),
    textureBytesBefore,
    textureBytesAfter,
  };
}

async function resizePng(pngBuffer, textureMaxSize) {
  const metadata = await sharp(pngBuffer, { limitInputPixels: false }).metadata();

  if (!metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) <= textureMaxSize) {
    return pngBuffer;
  }

  return sharp(pngBuffer, { limitInputPixels: false })
    .resize({
      width: textureMaxSize,
      height: textureMaxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

function parseGlb(glbBuffer) {
  const magic = glbBuffer.toString('ascii', 0, 4);
  const version = glbBuffer.readUInt32LE(4);

  if (magic !== 'glTF' || version !== 2) {
    throw new Error('Only glTF 2.0 GLB files can be compressed.');
  }

  let json = null;
  let bin = null;
  let offset = 12;

  while (offset < glbBuffer.byteLength) {
    const chunkLength = glbBuffer.readUInt32LE(offset);
    const chunkType = glbBuffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(glbBuffer.subarray(chunkStart, chunkEnd).toString('utf8'));
    } else if (chunkType === 0x004e4942) {
      bin = glbBuffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd;
  }

  if (!json) {
    throw new Error('GLB JSON chunk not found.');
  }

  return { json, bin };
}

function buildGlb(json, bin) {
  const jsonChunk = padBuffer(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = padBuffer(bin, 0x00);
  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
  const header = Buffer.alloc(12);
  const jsonHeader = Buffer.alloc(8);
  const binHeader = Buffer.alloc(8);

  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  binHeader.writeUInt32LE(binChunk.byteLength, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

function padBuffer(buffer, padByte) {
  const padding = (4 - (buffer.byteLength % 4)) % 4;
  if (padding === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padding, padByte)]);
}

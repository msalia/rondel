import type { ImageBuffer } from "@/types";

import { DEFAULT_CAPTURE_SIZE } from "@/constants";
import { getOrCreateCanvas } from "@/utils/canvas";

/** Creates an empty RGBA image buffer of the given dimensions. */
export function createBuffer(width: number, height: number): ImageBuffer {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

/** Extracts pixel data from a canvas element into an ImageBuffer. */
export function canvasToBuffer(canvas: HTMLCanvasElement): ImageBuffer {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Unable to get canvas context");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: canvas.width, height: canvas.height };
}

/** Draws an ImageBuffer onto a canvas and returns the canvas element. */
export function bufferToCanvas(buf: ImageBuffer): HTMLCanvasElement {
  const { canvas, ctx } = getOrCreateCanvas(buf.width, "bufferToCanvas");
  canvas.height = buf.height;
  const imageData = ctx.createImageData(buf.width, buf.height);
  imageData.data.set(buf.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Captures a square center-cropped frame from a video element onto a canvas. */
export function captureFrame(video: HTMLVideoElement, targetSize = DEFAULT_CAPTURE_SIZE): HTMLCanvasElement {
  const { canvas, ctx } = getOrCreateCanvas(targetSize, "captureFrame", {
    willReadFrequently: true,
  });

  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, targetSize, targetSize);
  return canvas;
}

/** Captures a video frame and returns it as an ImageBuffer. */
export function captureFrameToBuffer(video: HTMLVideoElement, targetSize = DEFAULT_CAPTURE_SIZE): ImageBuffer {
  const canvas = captureFrame(video, targetSize);
  return canvasToBuffer(canvas);
}

/** Converts RGBA pixel data to a single-channel grayscale array. */
export function toGrayscale(data: Uint8ClampedArray, pixelCount: number): Uint8Array {
  const gray = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
  }
  return gray;
}

/** Flips an image buffer horizontally (mirrors left-to-right). */
export function flipBufferHorizontal(buf: ImageBuffer): ImageBuffer {
  const { width, height, data } = buf;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width, height };
}

/** Returns the average RGB brightness of a pixel, or fallback if out of bounds.
 *  Handles alpha compositing against the specified background brightness. */
export function getPixelBrightness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  bgBrightness = 128,
): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return -1;
  const idx = (iy * width + ix) * 4;
  const a = data[idx + 3];
  if (a === 0) return bgBrightness;
  const raw = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  return a === 255 ? raw : raw * (a / 255) + bgBrightness * (1 - a / 255);
}

/** Samples grayscale from a pre-computed grayscale array, returning fallback if out of bounds. */
export function sampleGray(gray: Uint8Array, width: number, x: number, y: number, fallback = 128): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= gray.length / width) return fallback;
  return gray[iy * width + ix];
}

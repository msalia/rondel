"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBuffer = createBuffer;
exports.canvasToBuffer = canvasToBuffer;
exports.bufferToCanvas = bufferToCanvas;
exports.captureFrame = captureFrame;
exports.captureFrameToBuffer = captureFrameToBuffer;
exports.toGrayscale = toGrayscale;
exports.flipBufferHorizontal = flipBufferHorizontal;
exports.getPixelBrightness = getPixelBrightness;
exports.sampleGray = sampleGray;
const constants_1 = require("../constants");
const canvas_1 = require("./canvas");
/** Creates an empty RGBA image buffer of the given dimensions. */
function createBuffer(width, height) {
    return { data: new Uint8ClampedArray(width * height * 4), width, height };
}
/** Extracts pixel data from a canvas element into an ImageBuffer. */
function canvasToBuffer(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx)
        throw new Error("Unable to get canvas context");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data: imageData.data, width: canvas.width, height: canvas.height };
}
/** Draws an ImageBuffer onto a canvas and returns the canvas element. */
function bufferToCanvas(buf) {
    const { canvas, ctx } = (0, canvas_1.getOrCreateCanvas)(buf.width, "bufferToCanvas");
    canvas.height = buf.height;
    const imageData = ctx.createImageData(buf.width, buf.height);
    imageData.data.set(buf.data);
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
/** Captures a square center-cropped frame from a video element onto a canvas. */
function captureFrame(video, targetSize = constants_1.DEFAULT_CAPTURE_SIZE) {
    const { canvas, ctx } = (0, canvas_1.getOrCreateCanvas)(targetSize, "captureFrame", {
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
function captureFrameToBuffer(video, targetSize = constants_1.DEFAULT_CAPTURE_SIZE) {
    const canvas = captureFrame(video, targetSize);
    return canvasToBuffer(canvas);
}
/** Converts RGBA pixel data to a single-channel grayscale array. */
function toGrayscale(data, pixelCount) {
    const gray = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        gray[i] = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
    }
    return gray;
}
/** Flips an image buffer horizontally (mirrors left-to-right). */
function flipBufferHorizontal(buf) {
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
function getPixelBrightness(data, width, height, x, y, bgBrightness = 128) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height)
        return -1;
    const idx = (iy * width + ix) * 4;
    const a = data[idx + 3];
    if (a === 0)
        return bgBrightness;
    const raw = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    return a === 255 ? raw : raw * (a / 255) + bgBrightness * (1 - a / 255);
}
/** Samples grayscale from a pre-computed grayscale array, returning fallback if out of bounds. */
function sampleGray(gray, width, x, y, fallback = 128) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= width || iy < 0 || iy >= gray.length / width)
        return fallback;
    return gray[iy * width + ix];
}

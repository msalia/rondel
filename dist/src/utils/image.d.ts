import type { ImageBuffer } from "../types";
/** Creates an empty RGBA image buffer of the given dimensions. */
export declare function createBuffer(width: number, height: number): ImageBuffer;
/** Extracts pixel data from a canvas element into an ImageBuffer. */
export declare function canvasToBuffer(canvas: HTMLCanvasElement): ImageBuffer;
/** Draws an ImageBuffer onto a canvas and returns the canvas element. */
export declare function bufferToCanvas(buf: ImageBuffer): HTMLCanvasElement;
/** Captures a square center-cropped frame from a video element onto a canvas. */
export declare function captureFrame(video: HTMLVideoElement, targetSize?: number): HTMLCanvasElement;
/** Captures a video frame and returns it as an ImageBuffer. */
export declare function captureFrameToBuffer(video: HTMLVideoElement, targetSize?: number): ImageBuffer;
/** Converts RGBA pixel data to a single-channel grayscale array. */
export declare function toGrayscale(data: Uint8ClampedArray, pixelCount: number): Uint8Array;
/** Flips an image buffer horizontally (mirrors left-to-right). */
export declare function flipBufferHorizontal(buf: ImageBuffer): ImageBuffer;
/** Returns the average RGB brightness of a pixel, or fallback if out of bounds.
 *  Handles alpha compositing against the specified background brightness. */
export declare function getPixelBrightness(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, bgBrightness?: number): number;
/** Samples grayscale from a pre-computed grayscale array, returning fallback if out of bounds. */
export declare function sampleGray(gray: Uint8Array, width: number, x: number, y: number, fallback?: number): number;

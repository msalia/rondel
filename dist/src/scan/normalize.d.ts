import type { ImageBuffer } from "../types";
/** Resizes an image buffer to a square of the target size using nearest-neighbor sampling. */
export declare function normalizeFrame(frame: ImageBuffer, size?: number): ImageBuffer;

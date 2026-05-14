import type { ImageBuffer } from "../types";
/** Refines the center position of a rectified code by locating the center dot centroid. */
export declare function refineCenterFromDot(buf: ImageBuffer, rings: number, size: number, precomputedGray?: Uint8Array): {
    cx: number;
    cy: number;
};

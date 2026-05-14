import type { ImageBuffer } from "../types";
/** Samples bits from a rectified circular code image using polar coordinates.
 *  Uses multi-point sampling per segment with per-ring adaptive thresholding. */
export declare function samplePolarGrid(frame: ImageBuffer, cx: number, cy: number, codeSize: number, rings?: number, segmentsPerRing?: number, orientationOffset?: number, inverted?: boolean): number[];

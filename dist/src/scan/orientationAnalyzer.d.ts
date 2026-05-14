import type { ImageBuffer, OrientationAnalysis } from "../types";
export type { OrientationAnalysis };
/** Analyzes the orientation ring in a rectified image to determine rotation and reflection. */
export declare function analyzeOrientation(buf: ImageBuffer, rings: number, size: number, numSamples?: number, centerX?: number, centerY?: number, segmentsPerRing?: number, precomputedGray?: Uint8Array): OrientationAnalysis;

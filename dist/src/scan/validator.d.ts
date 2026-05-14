import type { ImageBuffer, ValidationResult } from "../types";
export type { ValidationResult };
/** Validates whether a rectified image looks like a circular code. */
export declare function validateCircularCode(buf: ImageBuffer, rings: number, size: number, threshold?: number, segmentsPerRing?: number, precomputedGray?: Uint8Array): ValidationResult;

import type { DetectionResult, ImageBuffer } from "../types";
/** Detects a circle in an image using Sobel edge detection and Hough transform. */
export declare function detectCircle(buf: ImageBuffer): DetectionResult;

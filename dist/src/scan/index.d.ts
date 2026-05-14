import type { DetectionResult, ImageBuffer, Point, RectifyResult, ScanFrameOptions, ScanFrameResult, ScanOptions, ScanResult } from "../types";
/** Detects a circular code in an image buffer using ML or Hough fallback. */
export declare function detectCode(buf: ImageBuffer): DetectionResult;
/** Returns model-predicted corners or estimates them from detection geometry.
 *  Ensures clockwise winding (TL→TR→BR→BL in screen coords) to prevent reflected warps. */
export declare function resolveCorners(detection: DetectionResult, padding?: number): Point[];
/** Flips an ImageBuffer horizontally. */
export declare function flipHorizontal(buf: ImageBuffer): ImageBuffer;
/** Warps, de-reflects, validates, and analyzes orientation of a detected code. */
export declare function rectifyCode(frame: ImageBuffer, detection: DetectionResult, rings: number, outputSize?: number, segmentsPerRing?: number): RectifyResult;
/** Processes a single frame through the full scan pipeline: detect, rectify, sample, decode. */
export declare function scanFrame(source: HTMLVideoElement | HTMLCanvasElement | ImageBuffer, options?: ScanFrameOptions): ScanFrameResult;
/** Rectifies, validates, samples, and decodes a code from a frame. Throws if invalid. */
export declare function sampleAndDecode(frame: ImageBuffer, detection: DetectionResult, rings: number, segmentsPerRing: number, eccBytes: number, outputSize?: number): string;
/** Scans video frames continuously until a code is decoded via multi-frame consensus. */
export declare function scanFromVideo(video: HTMLVideoElement, options?: ScanOptions): Promise<string>;
/** Processes a single video frame and returns a ScanResult if the code was decoded. */
export declare function processFrame(video: HTMLVideoElement, options?: {
    rings?: number;
    segmentsPerRing?: number;
    eccBytes?: number;
    minFrameScore?: number;
}): ScanResult | null;

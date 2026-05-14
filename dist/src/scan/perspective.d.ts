import type { ImageBuffer, Point } from "../types";
/** Computes a 3x3 homography matrix from four source-destination point pairs. */
export declare function solveHomography(src: Point[], dst: Point[]): number[];
/** Computes the inverse of a 3x3 homography matrix. */
export declare function invertHomography(H: number[]): number[];
/** Warps a source image region into a square output using perspective transform. */
export declare function warpPerspective(src: ImageBuffer, srcCorners: Point[], outputSize: number): ImageBuffer;
/** Estimates four bounding-box corners from a circle center, radius, and angle. */
export declare function estimateCircleCorners(cx: number, cy: number, r: number, padding?: number, angle?: number): Point[];

import type { FrameScore, ImageBuffer } from "../types";
/** Scores frame quality by measuring sharpness and contrast around the code region. */
export declare function scoreFrame(buf: ImageBuffer, cx: number, cy: number, r: number): FrameScore;

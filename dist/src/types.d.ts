/** Options for encoding a circular code. */
export type CircularCodeOptions = {
    rings?: number;
    segmentsPerRing?: number;
    eccBytes?: number;
};
/** Encoded circular code containing bit data and layout dimensions. */
export type EncodedCode = {
    bits: number[];
    rings: number;
    segmentsPerRing: number;
    eccBytes: number;
};
/** A 2D point with x and y coordinates. */
export type Point = {
    x: number;
    y: number;
};
/** Raw RGBA image data with dimensions. */
export type ImageBuffer = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};
/** Result of detecting a circular code in an image. */
export type DetectionResult = {
    cx: number;
    cy: number;
    r: number;
    corners?: Point[];
    confidence: number;
    angle?: number;
};
/** Quality metrics for a captured video frame. */
export type FrameScore = {
    sharpness: number;
    contrast: number;
    overall: number;
};
/** Result of scanning and decoding a single frame. */
export type ScanResult = {
    data: string;
    confidence: number;
    frameScore: FrameScore;
};
/** Result of multi-frame consensus voting across scans. */
export type ConsensusResult = {
    data: string;
    agreement: number;
    frameCount: number;
};
/** Configuration options for the video scanning pipeline. */
export type ScanOptions = {
    rings?: number;
    segmentsPerRing?: number;
    eccBytes?: number;
    minFrameScore?: number;
    consensusSize?: number;
    consensusRequired?: number;
    modelUrl?: string;
};
/** Result of analyzing the orientation ring pattern. */
export type OrientationAnalysis = {
    angle: number;
    reflected: boolean;
    inverted: boolean;
    confidence: number;
};
/** Result of validating whether an image contains a circular code. */
export type ValidationResult = {
    valid: boolean;
    centerDot: boolean;
    ringContrast: boolean;
    segmentPattern: boolean;
    score: number;
};
/** Options for processing a single scan frame. */
export type ScanFrameOptions = {
    rings?: number;
    segmentsPerRing?: number;
    eccBytes?: number;
    captureSize?: number;
    codeSize?: number;
    knownDetection?: DetectionResult;
};
/** Full result from scanning a single frame. */
export type ScanFrameResult = {
    detected: boolean;
    decoded: string | null;
    error: string | null;
    detection: DetectionResult;
    orientation: OrientationAnalysis;
    corners: Point[];
    warped: ImageBuffer;
    rectified: ImageBuffer;
    bits: number[];
    validation: ValidationResult;
    frameScore: FrameScore;
};
/** Result of rectifying a detected code region. */
export type RectifyResult = {
    image: ImageBuffer;
    corners: Point[];
    validation: ValidationResult;
    orientation: OrientationAnalysis;
    center: {
        cx: number;
        cy: number;
    };
};

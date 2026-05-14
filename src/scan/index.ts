import type {
  DetectionResult,
  FrameScore,
  ImageBuffer,
  OrientationAnalysis,
  Point,
  RectifyResult,
  ScanFrameOptions,
  ScanFrameResult,
  ScanOptions,
  ScanResult,
  ValidationResult,
} from "@/types";

import {
  CONFIDENCE_THRESHOLD,
  DEFAULT_CAPTURE_SIZE,
  DEFAULT_CODE_SIZE,
  DEFAULT_CONSENSUS_REQUIRED,
  DEFAULT_CONSENSUS_SIZE,
  DEFAULT_CORNER_PADDING,
  DEFAULT_ECC_BYTES,
  DEFAULT_MIN_FRAME_SCORE,
  DEFAULT_RINGS,
  DEFAULT_SEGMENTS_PER_RING,
  SCAN_TIMEOUT_MS,
} from "@/constants";
import { decode } from "@/core/decoder";
import { detectWithModel, isModelLoaded, loadModel } from "@/ml/detector";
import { refineCenterFromDot } from "@/scan/centerRefine";
import { MultiFrameConsensus } from "@/scan/consensus";
import { detectCircle } from "@/scan/detector";
import { scoreFrame } from "@/scan/frameScorer";
import { analyzeOrientation } from "@/scan/orientationAnalyzer";
import { estimateCircleCorners, warpPerspective } from "@/scan/perspective";
import { samplePolarGrid } from "@/scan/sampler";
import { validateCircularCode } from "@/scan/validator";
import {
  canvasToBuffer,
  captureFrameToBuffer,
  flipBufferHorizontal,
  toGrayscale,
} from "@/utils/image";

/** Detects a circular code in an image buffer using ML or Hough fallback. */
export function detectCode(buf: ImageBuffer): DetectionResult {
  if (isModelLoaded()) {
    const mlResult = detectWithModel(buf);
    if (mlResult) return mlResult;
  }
  return detectCircle(buf);
}

/** Returns model-predicted corners or estimates them from detection geometry.
 *  Ensures clockwise winding (TL→TR→BR→BL in screen coords) to prevent reflected warps. */
export function resolveCorners(
  detection: DetectionResult,
  padding = DEFAULT_CORNER_PADDING,
): Point[] {
  let corners: Point[];
  if (detection.corners && detection.corners.length === 4) {
    corners = detection.corners;
  } else {
    corners = estimateCircleCorners(
      detection.cx,
      detection.cy,
      detection.r,
      padding,
      detection.angle ?? 0,
    );
  }

  // Check winding order via cross product of edge vectors from corner 0.
  // For clockwise winding in screen coords (y-down), cross product should be positive.
  const [c0, c1, , c3] = corners;
  const cross = (c1.x - c0.x) * (c3.y - c0.y) - (c1.y - c0.y) * (c3.x - c0.x);
  if (cross < 0) {
    corners = [corners[0], corners[3], corners[2], corners[1]];
  }

  return corners;
}

/** Flips an ImageBuffer horizontally. */
export function flipHorizontal(buf: ImageBuffer): ImageBuffer {
  return flipBufferHorizontal(buf);
}

/** Warps, de-reflects, validates, and analyzes orientation of a detected code. */
export function rectifyCode(
  frame: ImageBuffer,
  detection: DetectionResult,
  rings: number,
  outputSize = DEFAULT_CODE_SIZE,
  segmentsPerRing = DEFAULT_SEGMENTS_PER_RING,
): RectifyResult {
  const corners = resolveCorners(detection);
  const rectified = warpPerspective(frame, corners, outputSize);
  const gray = toGrayscale(rectified.data, rectified.width * rectified.height);

  const center = refineCenterFromDot(rectified, rings, outputSize, gray);
  const orientation = analyzeOrientation(
    rectified,
    rings,
    outputSize,
    360,
    center.cx,
    center.cy,
    segmentsPerRing,
    gray,
  );

  const validation = validateCircularCode(
    rectified,
    rings,
    outputSize,
    CONFIDENCE_THRESHOLD,
    segmentsPerRing,
    gray,
  );

  return { image: rectified, corners, validation, orientation, center };
}

/** Processes a single frame through the full scan pipeline: detect, rectify, sample, decode. */
export function scanFrame(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBuffer,
  options: ScanFrameOptions = {},
): ScanFrameResult {
  const {
    rings = DEFAULT_RINGS,
    segmentsPerRing = DEFAULT_SEGMENTS_PER_RING,
    eccBytes = DEFAULT_ECC_BYTES,
    captureSize = DEFAULT_CAPTURE_SIZE,
    codeSize = DEFAULT_CODE_SIZE,
  } = options;

  let captured: ImageBuffer;
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    captured = captureFrameToBuffer(source, captureSize);
  } else if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    captured = canvasToBuffer(source);
  } else {
    captured = source as ImageBuffer;
  }

  const detection = options.knownDetection ?? detectCode(captured);
  const detected = detection.confidence >= CONFIDENCE_THRESHOLD;

  const activeDetection: DetectionResult = detected
    ? detection
    : { cx: captured.width / 2, cy: captured.height / 2, r: captured.width * 0.35, confidence: 0 };

  const corners = resolveCorners(activeDetection);
  const warped = warpPerspective(captured, corners, codeSize);

  const rectified = warped;
  const gray = toGrayscale(rectified.data, rectified.width * rectified.height);
  const center = refineCenterFromDot(rectified, rings, codeSize, gray);

  const orientation = analyzeOrientation(
    rectified,
    rings,
    codeSize,
    360,
    center.cx,
    center.cy,
    segmentsPerRing,
    gray,
  );

  const validation = validateCircularCode(
    rectified,
    rings,
    codeSize,
    CONFIDENCE_THRESHOLD,
    segmentsPerRing,
    gray,
  );
  const frameScoreResult = scoreFrame(
    captured,
    activeDetection.cx,
    activeDetection.cy,
    activeDetection.r,
  );

  const bits = samplePolarGrid(
    rectified,
    center.cx,
    center.cy,
    codeSize,
    rings,
    segmentsPerRing,
    orientation.angle,
    orientation.inverted,
  );

  let decoded: string | null = null;
  let error: string | null = null;

  if (validation.valid) {
    try {
      decoded = decode(bits, eccBytes);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
    }
  } else {
    error = `Not a circular code (score=${validation.score.toFixed(2)})`;
  }

  return {
    detected,
    decoded,
    error,
    detection,
    orientation,
    corners,
    warped,
    rectified,
    bits,
    validation,
    frameScore: frameScoreResult,
  };
}

/** Rectifies, validates, samples, and decodes a code from a frame. Throws if invalid. */
export function sampleAndDecode(
  frame: ImageBuffer,
  detection: DetectionResult,
  rings: number,
  segmentsPerRing: number,
  eccBytes: number,
  outputSize = DEFAULT_CODE_SIZE,
): string {
  const {
    image: rectified,
    validation,
    orientation,
    center,
  } = rectifyCode(frame, detection, rings, outputSize, segmentsPerRing);

  if (!validation.valid) {
    throw new Error(`Not a circular code (score=${validation.score.toFixed(2)})`);
  }

  const bits = samplePolarGrid(
    rectified,
    center.cx,
    center.cy,
    outputSize,
    rings,
    segmentsPerRing,
    orientation.angle,
    orientation.inverted,
  );

  return decode(bits, eccBytes);
}

/** Scans video frames continuously until a code is decoded via multi-frame consensus. */
export async function scanFromVideo(
  video: HTMLVideoElement,
  options: ScanOptions = {},
): Promise<string> {
  const {
    rings = DEFAULT_RINGS,
    segmentsPerRing = DEFAULT_SEGMENTS_PER_RING,
    eccBytes = DEFAULT_ECC_BYTES,
    minFrameScore = DEFAULT_MIN_FRAME_SCORE,
    consensusSize = DEFAULT_CONSENSUS_SIZE,
    consensusRequired = DEFAULT_CONSENSUS_REQUIRED,
    modelUrl,
  } = options;

  if (modelUrl && !isModelLoaded()) {
    await loadModel(modelUrl);
  }

  const consensus = new MultiFrameConsensus(consensusSize, consensusRequired);

  return new Promise((resolve, reject) => {
    let running = true;

    function loop() {
      if (!running) return;

      try {
        const result = scanFrame(video, { rings, segmentsPerRing, eccBytes });

        if (result.decoded && result.frameScore.overall >= minFrameScore) {
          const scanResult: ScanResult = {
            data: result.decoded,
            confidence: result.detection.confidence,
            frameScore: result.frameScore,
          };
          const consensusResult = consensus.push(scanResult);
          if (consensusResult) {
            running = false;
            resolve(consensusResult.data);
            return;
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("Cannot read prop")) throw e;
      }

      requestAnimationFrame(loop);
    }

    loop();

    setTimeout(() => {
      if (running) {
        running = false;
        reject(new Error("Scan timed out"));
      }
    }, SCAN_TIMEOUT_MS);
  });
}

/** Processes a single video frame and returns a ScanResult if the code was decoded. */
export function processFrame(
  video: HTMLVideoElement,
  options: {
    rings?: number;
    segmentsPerRing?: number;
    eccBytes?: number;
    minFrameScore?: number;
  } = {},
): ScanResult | null {
  const {
    rings = DEFAULT_RINGS,
    segmentsPerRing = DEFAULT_SEGMENTS_PER_RING,
    eccBytes = DEFAULT_ECC_BYTES,
    minFrameScore = DEFAULT_MIN_FRAME_SCORE,
  } = options;

  const result = scanFrame(video, { rings, segmentsPerRing, eccBytes });

  if (result.decoded && result.frameScore.overall >= minFrameScore) {
    return {
      data: result.decoded,
      confidence: result.detection.confidence,
      frameScore: result.frameScore,
    };
  }

  return null;
}

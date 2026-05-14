"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCode = detectCode;
exports.resolveCorners = resolveCorners;
exports.flipHorizontal = flipHorizontal;
exports.rectifyCode = rectifyCode;
exports.scanFrame = scanFrame;
exports.sampleAndDecode = sampleAndDecode;
exports.scanFromVideo = scanFromVideo;
exports.processFrame = processFrame;
const constants_1 = require("../constants");
const decoder_1 = require("../core/decoder");
const detector_1 = require("../ml/detector");
const consensus_1 = require("./consensus");
const detector_2 = require("./detector");
const frameScorer_1 = require("./frameScorer");
const centerRefine_1 = require("./centerRefine");
const orientationAnalyzer_1 = require("./orientationAnalyzer");
const perspective_1 = require("./perspective");
const sampler_1 = require("./sampler");
const validator_1 = require("./validator");
const image_1 = require("../utils/image");
/** Detects a circular code in an image buffer using ML or Hough fallback. */
function detectCode(buf) {
    if ((0, detector_1.isModelLoaded)()) {
        const mlResult = (0, detector_1.detectWithModel)(buf);
        if (mlResult)
            return mlResult;
    }
    return (0, detector_2.detectCircle)(buf);
}
/** Returns model-predicted corners or estimates them from detection geometry.
 *  Ensures clockwise winding (TL→TR→BR→BL in screen coords) to prevent reflected warps. */
function resolveCorners(detection, padding = constants_1.DEFAULT_CORNER_PADDING) {
    let corners;
    if (detection.corners && detection.corners.length === 4) {
        corners = detection.corners;
    }
    else {
        corners = (0, perspective_1.estimateCircleCorners)(detection.cx, detection.cy, detection.r, padding, detection.angle ?? 0);
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
function flipHorizontal(buf) {
    return (0, image_1.flipBufferHorizontal)(buf);
}
/** Warps, de-reflects, validates, and analyzes orientation of a detected code. */
function rectifyCode(frame, detection, rings, outputSize = constants_1.DEFAULT_CODE_SIZE, segmentsPerRing = constants_1.DEFAULT_SEGMENTS_PER_RING) {
    const corners = resolveCorners(detection);
    const rectified = (0, perspective_1.warpPerspective)(frame, corners, outputSize);
    const gray = (0, image_1.toGrayscale)(rectified.data, rectified.width * rectified.height);
    const center = (0, centerRefine_1.refineCenterFromDot)(rectified, rings, outputSize, gray);
    const orientation = (0, orientationAnalyzer_1.analyzeOrientation)(rectified, rings, outputSize, 360, center.cx, center.cy, segmentsPerRing, gray);
    const validation = (0, validator_1.validateCircularCode)(rectified, rings, outputSize, constants_1.CONFIDENCE_THRESHOLD, segmentsPerRing, gray);
    return { image: rectified, corners, validation, orientation, center };
}
/** Processes a single frame through the full scan pipeline: detect, rectify, sample, decode. */
function scanFrame(source, options = {}) {
    const { rings = constants_1.DEFAULT_RINGS, segmentsPerRing = constants_1.DEFAULT_SEGMENTS_PER_RING, eccBytes = constants_1.DEFAULT_ECC_BYTES, captureSize = constants_1.DEFAULT_CAPTURE_SIZE, codeSize = constants_1.DEFAULT_CODE_SIZE, } = options;
    let captured;
    if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
        captured = (0, image_1.captureFrameToBuffer)(source, captureSize);
    }
    else if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
        captured = (0, image_1.canvasToBuffer)(source);
    }
    else {
        captured = source;
    }
    const detection = options.knownDetection ?? detectCode(captured);
    const detected = detection.confidence >= constants_1.CONFIDENCE_THRESHOLD;
    const activeDetection = detected
        ? detection
        : { cx: captured.width / 2, cy: captured.height / 2, r: captured.width * 0.35, confidence: 0 };
    const corners = resolveCorners(activeDetection);
    const warped = (0, perspective_1.warpPerspective)(captured, corners, codeSize);
    const rectified = warped;
    const gray = (0, image_1.toGrayscale)(rectified.data, rectified.width * rectified.height);
    const center = (0, centerRefine_1.refineCenterFromDot)(rectified, rings, codeSize, gray);
    const orientation = (0, orientationAnalyzer_1.analyzeOrientation)(rectified, rings, codeSize, 360, center.cx, center.cy, segmentsPerRing, gray);
    const validation = (0, validator_1.validateCircularCode)(rectified, rings, codeSize, constants_1.CONFIDENCE_THRESHOLD, segmentsPerRing, gray);
    const frameScoreResult = (0, frameScorer_1.scoreFrame)(captured, activeDetection.cx, activeDetection.cy, activeDetection.r);
    const bits = (0, sampler_1.samplePolarGrid)(rectified, center.cx, center.cy, codeSize, rings, segmentsPerRing, orientation.angle, orientation.inverted);
    let decoded = null;
    let error = null;
    if (validation.valid) {
        try {
            decoded = (0, decoder_1.decode)(bits, eccBytes);
        }
        catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }
    else {
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
function sampleAndDecode(frame, detection, rings, segmentsPerRing, eccBytes, outputSize = constants_1.DEFAULT_CODE_SIZE) {
    const { image: rectified, validation, orientation, center } = rectifyCode(frame, detection, rings, outputSize, segmentsPerRing);
    if (!validation.valid) {
        throw new Error(`Not a circular code (score=${validation.score.toFixed(2)})`);
    }
    const bits = (0, sampler_1.samplePolarGrid)(rectified, center.cx, center.cy, outputSize, rings, segmentsPerRing, orientation.angle, orientation.inverted);
    return (0, decoder_1.decode)(bits, eccBytes);
}
/** Scans video frames continuously until a code is decoded via multi-frame consensus. */
async function scanFromVideo(video, options = {}) {
    const { rings = constants_1.DEFAULT_RINGS, segmentsPerRing = constants_1.DEFAULT_SEGMENTS_PER_RING, eccBytes = constants_1.DEFAULT_ECC_BYTES, minFrameScore = constants_1.DEFAULT_MIN_FRAME_SCORE, consensusSize = constants_1.DEFAULT_CONSENSUS_SIZE, consensusRequired = constants_1.DEFAULT_CONSENSUS_REQUIRED, modelUrl, } = options;
    if (modelUrl && !(0, detector_1.isModelLoaded)()) {
        await (0, detector_1.loadModel)(modelUrl);
    }
    const consensus = new consensus_1.MultiFrameConsensus(consensusSize, consensusRequired);
    return new Promise((resolve, reject) => {
        let running = true;
        function loop() {
            if (!running)
                return;
            try {
                const result = scanFrame(video, { rings, segmentsPerRing, eccBytes });
                if (result.decoded && result.frameScore.overall >= minFrameScore) {
                    const scanResult = {
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
            }
            catch (e) {
                if (e instanceof Error && e.message.includes("Cannot read prop"))
                    throw e;
            }
            requestAnimationFrame(loop);
        }
        loop();
        setTimeout(() => {
            if (running) {
                running = false;
                reject(new Error("Scan timed out"));
            }
        }, constants_1.SCAN_TIMEOUT_MS);
    });
}
/** Processes a single video frame and returns a ScanResult if the code was decoded. */
function processFrame(video, options = {}) {
    const { rings = constants_1.DEFAULT_RINGS, segmentsPerRing = constants_1.DEFAULT_SEGMENTS_PER_RING, eccBytes = constants_1.DEFAULT_ECC_BYTES, minFrameScore = constants_1.DEFAULT_MIN_FRAME_SCORE } = options;
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

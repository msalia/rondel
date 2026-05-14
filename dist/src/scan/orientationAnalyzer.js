"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeOrientation = analyzeOrientation;
const layout_1 = require("../core/layout");
const image_1 = require("../utils/image");
/** Analyzes the orientation ring in a rectified image to determine rotation and reflection. */
function analyzeOrientation(buf, rings, size, numSamples = 360, centerX, centerY, segmentsPerRing = 48, precomputedGray) {
    const { data, width, height } = buf;
    const gray = precomputedGray ?? (0, image_1.toGrayscale)(data, width * height);
    const cx = centerX ?? width / 2;
    const cy = centerY ?? height / 2;
    const radius = (0, layout_1.getOrientationRingRadius)(rings, size);
    const arcs = (0, layout_1.getOrientationArcs)(rings, size, segmentsPerRing);
    // Merge timing arcs (0-2) into one block — at low render resolutions,
    // round caps cause the narrow timing arcs to blend into a single dark band.
    // The separator gap between timing and orientation arcs is wide enough to survive.
    const strokeWidth = (0, layout_1.getRingWidth)(rings, size) * 0.5;
    const capAngle = strokeWidth / (2 * radius);
    const timingBlock = {
        start: arcs[0].start - capAngle,
        end: arcs[2].end + capAngle,
    };
    const orientArcs = arcs.slice(3).map(a => ({
        start: a.start - capAngle,
        end: a.end + capAngle,
    }));
    const visualArcs = [timingBlock, ...orientArcs];
    const samples = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const angle = (i / numSamples) * Math.PI * 2;
        const x = Math.round(cx + radius * Math.cos(angle));
        const y = Math.round(cy + radius * Math.sin(angle));
        if (x >= 0 && x < width && y >= 0 && y < height) {
            samples[i] = gray[y * width + x];
        }
        else {
            samples[i] = 128;
        }
    }
    const sorted = Array.from(samples).sort((a, b) => a - b);
    const lo = sorted[Math.floor(numSamples * 0.1)];
    const hi = sorted[Math.floor(numSamples * 0.9)];
    const threshold = (lo + hi) / 2;
    const dark = new Uint8Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        dark[i] = samples[i] < threshold ? 1 : 0;
    }
    const expectedDark = buildExpectedPattern(visualArcs, numSamples, false);
    const expectedDarkRefl = buildExpectedPattern(visualArcs, numSamples, true);
    let bestNormScore = -1;
    let bestNormAngle = 0;
    let bestNormRefl = false;
    let bestInvScore = -1;
    let bestInvAngle = 0;
    let bestInvRefl = false;
    for (let offset = 0; offset < numSamples; offset++) {
        let score = 0;
        let scoreRefl = 0;
        for (let i = 0; i < numSamples; i++) {
            const si = (i + offset) % numSamples;
            if (dark[si] === expectedDark[i])
                score++;
            if (dark[si] === expectedDarkRefl[i])
                scoreRefl++;
        }
        const angleAtOffset = (offset / numSamples) * Math.PI * 2;
        if (score > bestNormScore) {
            bestNormScore = score;
            bestNormAngle = angleAtOffset;
            bestNormRefl = false;
        }
        const reflMargin = numSamples * 0.03;
        if (scoreRefl > bestNormScore + reflMargin) {
            bestNormScore = scoreRefl;
            bestNormAngle = angleAtOffset;
            bestNormRefl = true;
        }
        const invScore = numSamples - score;
        if (invScore > bestInvScore) {
            bestInvScore = invScore;
            bestInvAngle = angleAtOffset;
            bestInvRefl = false;
        }
        const invScoreRefl = numSamples - scoreRefl;
        if (invScoreRefl > bestInvScore + reflMargin) {
            bestInvScore = invScoreRefl;
            bestInvAngle = angleAtOffset;
            bestInvRefl = true;
        }
    }
    const normContrast = arcContrast(samples, bestNormRefl ? expectedDarkRefl : expectedDark, Math.round((bestNormAngle / (2 * Math.PI)) * numSamples), numSamples);
    const invContrast = arcContrast(samples, bestInvRefl ? expectedDarkRefl : expectedDark, Math.round((bestInvAngle / (2 * Math.PI)) * numSamples), numSamples);
    const MIN_CONTRAST = 20;
    const useInverted = -invContrast > normContrast && -invContrast > MIN_CONTRAST;
    const bestScore = useInverted ? bestInvScore : bestNormScore;
    const bestAngle = useInverted ? bestInvAngle : bestNormAngle;
    const bestReflected = useInverted ? bestInvRefl : bestNormRefl;
    return {
        angle: bestAngle,
        reflected: bestReflected,
        inverted: useInverted,
        confidence: bestScore / numSamples,
    };
}
/** Returns (mean gap brightness - mean arc brightness). Positive = arcs darker than gaps. */
function arcContrast(samples, expected, offset, numSamples) {
    let arcSum = 0, arcN = 0;
    let gapSum = 0, gapN = 0;
    for (let i = 0; i < numSamples; i++) {
        const si = (i + offset) % numSamples;
        if (expected[i] === 1) {
            arcSum += samples[si];
            arcN++;
        }
        else {
            gapSum += samples[si];
            gapN++;
        }
    }
    if (arcN === 0 || gapN === 0)
        return 0;
    return gapSum / gapN - arcSum / arcN;
}
function buildExpectedPattern(arcs, numSamples, reflected) {
    const pattern = new Uint8Array(numSamples);
    const src = reflected ? [...arcs].reverse() : arcs;
    for (const arc of src) {
        const span = arc.end - arc.start;
        const startIdx = reflected
            ? Math.round(((2 * Math.PI - arc.end) / (Math.PI * 2)) * numSamples)
            : Math.round((arc.start / (Math.PI * 2)) * numSamples);
        const count = Math.round((span / (Math.PI * 2)) * numSamples);
        for (let i = 0; i < count; i++) {
            pattern[(startIdx + i + numSamples) % numSamples] = 1;
        }
    }
    return pattern;
}

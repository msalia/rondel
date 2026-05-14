"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCircularCode = validateCircularCode;
const layout_1 = require("../core/layout");
const image_1 = require("../utils/image");
/** Validates whether a rectified image looks like a circular code. */
function validateCircularCode(buf, rings, size, threshold = 0.5, segmentsPerRing = 48, precomputedGray) {
    const { data, width, height } = buf;
    const gray = precomputedGray ?? (0, image_1.toGrayscale)(data, width * height);
    const cx = width / 2;
    const cy = height / 2;
    const centerDot = checkCenterDot(gray, width, cx, cy, rings, size);
    const ringContrast = checkRingContrast(gray, width, cx, cy, rings, size);
    const segmentPattern = checkSegmentPattern(gray, width, cx, cy, rings, size, segmentsPerRing);
    const score = (centerDot ? 0.35 : 0) + (ringContrast ? 0.35 : 0) + (segmentPattern ? 0.3 : 0);
    return {
        valid: score >= threshold,
        centerDot,
        ringContrast,
        segmentPattern,
        score,
    };
}
function checkCenterDot(gray, width, cx, cy, rings, size) {
    const dotRadius = (0, layout_1.getRingWidth)(rings, size) * 0.65;
    const sampleRadius = dotRadius * 0.5;
    let centerSum = 0;
    let centerCount = 0;
    for (let dy = -sampleRadius; dy <= sampleRadius; dy += 2) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx += 2) {
            if (dx * dx + dy * dy > sampleRadius * sampleRadius)
                continue;
            centerSum += (0, image_1.sampleGray)(gray, width, cx + dx, cy + dy);
            centerCount++;
        }
    }
    const centerBrightness = centerCount > 0 ? centerSum / centerCount : 128;
    let bgSum = 0;
    let bgCount = 0;
    const bgRadius = size * 0.45;
    for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2;
        const x = cx + bgRadius * Math.cos(angle);
        const y = cy + bgRadius * Math.sin(angle);
        bgSum += (0, image_1.sampleGray)(gray, width, x, y);
        bgCount++;
    }
    const bgBrightness = bgCount > 0 ? bgSum / bgCount : 200;
    return Math.abs(centerBrightness - bgBrightness) > 30;
}
function checkRingContrast(gray, width, cx, cy, rings, size) {
    const numAngles = 16;
    const ringWidth = (0, layout_1.getRingWidth)(rings, size);
    let transitions = 0;
    for (let a = 0; a < numAngles; a++) {
        const angle = (a / numAngles) * Math.PI * 2;
        let prevBright = 128;
        let transitionsOnRay = 0;
        for (let r = 0; r < rings + 3; r++) {
            const radius = (r + 0.5) * ringWidth;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            const bright = (0, image_1.sampleGray)(gray, width, x, y);
            if (Math.abs(bright - prevBright) > 40)
                transitionsOnRay++;
            prevBright = bright;
        }
        if (transitionsOnRay >= 2)
            transitions++;
    }
    return transitions >= numAngles * 0.4;
}
function checkSegmentPattern(gray, width, cx, cy, rings, size, segmentsPerRing) {
    let ringsWithGaps = 0;
    for (let r = 1; r < rings; r++) {
        const radius = (0, layout_1.getExactRingRadius)(r, rings, size, segmentsPerRing);
        const numSamples = 32;
        const samples = [];
        for (let s = 0; s < numSamples; s++) {
            const angle = (s / numSamples) * Math.PI * 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            samples.push((0, image_1.sampleGray)(gray, width, x, y));
        }
        let darkRuns = 0;
        let lightRuns = 0;
        const median = [...samples].sort((a, b) => a - b)[numSamples >> 1];
        let inDark = samples[0] < median;
        for (let s = 1; s < numSamples; s++) {
            const nowDark = samples[s] < median;
            if (nowDark && !inDark)
                darkRuns++;
            if (!nowDark && inDark)
                lightRuns++;
            inDark = nowDark;
        }
        if (darkRuns >= 2 && lightRuns >= 2)
            ringsWithGaps++;
    }
    return ringsWithGaps >= Math.max(1, (rings - 1) * 0.4);
}

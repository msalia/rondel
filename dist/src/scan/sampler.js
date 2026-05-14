"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.samplePolarGrid = samplePolarGrid;
const layout_1 = require("../core/layout");
const image_1 = require("../utils/image");
/** Samples bits from a rectified circular code image using polar coordinates.
 *  Uses multi-point sampling per segment with per-ring adaptive thresholding. */
function samplePolarGrid(frame, cx, cy, codeSize, rings = 5, segmentsPerRing = 48, orientationOffset = 0, inverted = false) {
    const { data, width, height } = frame;
    const ringWidth = (0, layout_1.getRingWidth)(rings, codeSize);
    const bgBrightness = inverted ? 0 : 255;
    const bits = [];
    for (let r = 0; r < rings; r++) {
        if (!(0, layout_1.isDataRing)(r))
            continue;
        const segs = (0, layout_1.getSegmentsForRing)(r, rings, segmentsPerRing);
        const segAngle = (2 * Math.PI) / segs;
        const centerRadius = (0, layout_1.getExactRingRadius)(r, rings, codeSize, segmentsPerRing);
        const innerRadius = centerRadius - ringWidth * 0.1;
        const outerRadius = centerRadius + ringWidth * 0.1;
        const ringBrightness = [];
        for (let segment = 0; segment < segs; segment++) {
            const segCenter = (0, layout_1.getSegmentAngle)(segment, segs) + segAngle * 0.35 + orientationOffset;
            let sum = 0;
            let count = 0;
            for (const aOff of [-segAngle * 0.1, 0, segAngle * 0.1]) {
                const angle = segCenter + aOff;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                for (const sr of [innerRadius, centerRadius, outerRadius]) {
                    const b = (0, image_1.getPixelBrightness)(data, width, height, cx + sr * cosA, cy + sr * sinA, bgBrightness);
                    if (b >= 0) {
                        sum += b;
                        count++;
                    }
                }
            }
            const avg = count > 0 ? sum / count : 128;
            ringBrightness.push(avg);
        }
        const sorted = Float64Array.from(ringBrightness).sort();
        let maxGap = 0;
        let splitIdx = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i + 1] - sorted[i];
            if (gap > maxGap) {
                maxGap = gap;
                splitIdx = i;
            }
        }
        const threshold = maxGap > 30
            ? (sorted[splitIdx] + sorted[splitIdx + 1]) / 2
            : 128;
        for (let segment = 0; segment < segs; segment++) {
            const dark = ringBrightness[segment] < threshold;
            bits.push((dark !== inverted) ? 1 : 0);
        }
    }
    return bits;
}

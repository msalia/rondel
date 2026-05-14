"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSVG = renderSVG;
const constants_1 = require("../constants");
const layout_1 = require("../core/layout");
const DEFAULT_SIZE = constants_1.DEFAULT_CODE_SIZE;
const DEFAULT_PRIMARY = "#000000";
const DEFAULT_SECONDARY = "#d0d0d0";
const STROKE_WIDTH_RATIO = 0.5;
const CENTER_RADIUS_RATIO = 0.75;
const SECONDARY_SEPARATION = 1;
function svgArc(cx, cy, radius, start, end, strokeWidth) {
    const sweep = end - start;
    if (sweep <= 0)
        return "";
    const largeArc = sweep > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    return `\n        <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}"
          stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"/>`;
}
function findPrimaryRuns(ringBits, segs) {
    const runs = [];
    let i = 0;
    while (i < segs) {
        if (!ringBits[i]) {
            i++;
            continue;
        }
        let runEnd = i + 1;
        while (runEnd < segs && ringBits[runEnd])
            runEnd++;
        runs.push({ startSeg: i, runLen: runEnd - i });
        i = runEnd;
    }
    return runs;
}
function renderDataRings(bits, rings, segmentsPerRing, cx, cy, size, strokeWidth) {
    let primaryPaths = "";
    let secondaryPaths = "";
    let bitIndex = 0;
    for (let r = 0; r < rings; r++) {
        const segs = (0, layout_1.getSegmentsForRing)(r, rings, segmentsPerRing);
        const segAngle = (2 * Math.PI) / segs;
        const radius = (0, layout_1.getExactRingRadius)(r, rings, size, segmentsPerRing);
        if (!(0, layout_1.isDataRing)(r))
            continue;
        const ringBits = [];
        for (let i = 0; i < segs; i++)
            ringBits.push(bits[bitIndex++] ?? 0);
        const primaryArcs = findPrimaryRuns(ringBits, segs);
        for (const arc of primaryArcs) {
            const start = (0, layout_1.getSegmentAngle)(arc.startSeg, segs);
            const end = start + segAngle * (arc.runLen - layout_1.GAP_FRACTION);
            primaryPaths += svgArc(cx, cy, radius, start, end, strokeWidth);
        }
        if (primaryArcs.length === 0) {
            const start = (0, layout_1.getSegmentAngle)(0, segs);
            const end = start + segAngle * (segs - layout_1.GAP_FRACTION);
            secondaryPaths += svgArc(cx, cy, radius, start, end, strokeWidth);
        }
        else {
            for (let j = 0; j < primaryArcs.length; j++) {
                const cur = primaryArcs[j];
                const next = primaryArcs[(j + 1) % primaryArcs.length];
                const gapStartSeg = cur.startSeg + cur.runLen + SECONDARY_SEPARATION;
                const gapEndSeg = j + 1 < primaryArcs.length
                    ? next.startSeg - SECONDARY_SEPARATION
                    : next.startSeg + segs - SECONDARY_SEPARATION;
                const gapLen = gapEndSeg - gapStartSeg;
                if (gapLen < 1)
                    continue;
                const start = (0, layout_1.getSegmentAngle)(gapStartSeg % segs, segs);
                const arcSpan = segAngle * (gapLen - layout_1.GAP_FRACTION);
                secondaryPaths += svgArc(cx, cy, radius, start, start + arcSpan, strokeWidth);
            }
        }
    }
    return { primaryPaths, secondaryPaths };
}
function renderOrientationRing(rings, segmentsPerRing, cx, cy, size, strokeWidth) {
    let paths = "";
    const radius = (0, layout_1.getOrientationRingRadius)(rings, size);
    for (const arc of (0, layout_1.getOrientationArcs)(rings, size, segmentsPerRing)) {
        paths += svgArc(cx, cy, radius, arc.start, arc.end, strokeWidth);
    }
    return paths;
}
/** Renders an encoded circular code as an SVG string. */
function renderSVG(code, opts = {}) {
    const normalized = typeof opts === "number" ? { size: opts } : opts;
    const { size = DEFAULT_SIZE, primary = DEFAULT_PRIMARY, secondary = DEFAULT_SECONDARY, } = normalized;
    const { bits, rings, segmentsPerRing } = code;
    const cx = size / 2;
    const cy = size / 2;
    const ringWidth = (0, layout_1.getRingWidth)(rings, size);
    const strokeWidth = ringWidth * STROKE_WIDTH_RATIO;
    const centerRadius = ringWidth * CENTER_RADIUS_RATIO;
    const { primaryPaths, secondaryPaths } = renderDataRings(bits, rings, segmentsPerRing, cx, cy, size, strokeWidth);
    const orientationPaths = renderOrientationRing(rings, segmentsPerRing, cx, cy, size, strokeWidth);
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${secondary}">${secondaryPaths}
      </g>
      <g stroke="${primary}">${primaryPaths}
      </g>
      <g stroke="${primary}">${orientationPaths}
      </g>
      <circle cx="${cx}" cy="${cy}" r="${centerRadius}" fill="${primary}" />
    </svg>
  `;
}

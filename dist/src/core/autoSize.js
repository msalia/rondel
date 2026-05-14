"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDataBytes = computeDataBytes;
exports.computeNeededBits = computeNeededBits;
exports.minRingsForBits = minRingsForBits;
exports.autoSize = autoSize;
const constants_1 = require("../constants");
const layout_1 = require("./layout");
const modes_1 = require("./modes");
/** Computes the packed data size in bytes (header + mode-packed payload, no ECC). */
function computeDataBytes(input) {
    const mode = (0, modes_1.detectMode)(input);
    const count = mode === modes_1.Mode.BYTE ? new TextEncoder().encode(input).length : input.length;
    const headerBytes = count <= 62 ? 2 : 3;
    const dataBytes = (0, modes_1.packedByteCount)(mode === modes_1.Mode.BYTE ? count : input.length, mode);
    return headerBytes + dataBytes;
}
/** Computes the total bits needed to encode a string (header + packed data + ECC). */
function computeNeededBits(input, eccBytes) {
    return (computeDataBytes(input) + eccBytes) * 8;
}
/** Returns the minimum number of rings needed to hold the given number of bits
 *  within the given range. */
function minRingsForBits(neededBits, segmentsPerRing, minRings = constants_1.AUTO_MIN_RINGS, maxRings = constants_1.AUTO_MAX_RINGS) {
    for (let rings = minRings; rings <= maxRings; rings++) {
        if ((0, layout_1.getTotalSegments)(rings, segmentsPerRing) >= neededBits) {
            return rings;
        }
    }
    return null;
}
/** Auto-selects the smallest grid configuration that fits the input.
 *
 *  Aesthetic constraints: rings [4,8], segments [32,48], ECC [2,8].
 *  Picks the fewest rings, then fills remaining capacity with ECC.
 *
 *  Any parameter can be pinned by passing it explicitly. */
function autoSize(input, opts = {}) {
    const dataBytes = computeDataBytes(input);
    if (opts.segmentsPerRing != null && opts.eccBytes != null) {
        return autoSizeFixed(dataBytes, opts.segmentsPerRing, opts.eccBytes);
    }
    if (opts.segmentsPerRing != null) {
        return autoSizeWithSegments(dataBytes, opts.segmentsPerRing);
    }
    if (opts.eccBytes != null) {
        return autoSizeWithEcc(dataBytes, opts.eccBytes);
    }
    return autoSizeFull(dataBytes);
}
function autoSizeFixed(dataBytes, segmentsPerRing, eccBytes) {
    const neededBits = (dataBytes + eccBytes) * 8;
    const rings = minRingsForBits(neededBits, segmentsPerRing);
    if (rings === null)
        return null;
    const capacityBits = (0, layout_1.getTotalSegments)(rings, segmentsPerRing);
    return { rings, segmentsPerRing, eccBytes, capacityBits, usedBits: neededBits };
}
function autoSizeWithSegments(dataBytes, segmentsPerRing) {
    const neededBits = (dataBytes + constants_1.AUTO_MIN_ECC) * 8;
    const rings = minRingsForBits(neededBits, segmentsPerRing);
    if (rings === null)
        return null;
    const eccBytes = fillEcc(dataBytes, rings, segmentsPerRing);
    const usedBits = (dataBytes + eccBytes) * 8;
    return {
        rings,
        segmentsPerRing,
        eccBytes,
        capacityBits: (0, layout_1.getTotalSegments)(rings, segmentsPerRing),
        usedBits,
    };
}
function autoSizeWithEcc(dataBytes, eccBytes) {
    let best = null;
    for (const segs of constants_1.AUTO_SEGMENT_CANDIDATES) {
        const neededBits = (dataBytes + eccBytes) * 8;
        const rings = minRingsForBits(neededBits, segs);
        if (rings === null)
            continue;
        if (!best || rings < best.rings) {
            best = {
                rings,
                segmentsPerRing: segs,
                eccBytes,
                capacityBits: (0, layout_1.getTotalSegments)(rings, segs),
                usedBits: neededBits,
            };
        }
    }
    return best;
}
function autoSizeFull(dataBytes) {
    let best = null;
    for (const segs of constants_1.AUTO_SEGMENT_CANDIDATES) {
        const minBits = (dataBytes + constants_1.AUTO_MIN_ECC) * 8;
        const rings = minRingsForBits(minBits, segs);
        if (rings === null)
            continue;
        const eccBytes = fillEcc(dataBytes, rings, segs);
        const usedBits = (dataBytes + eccBytes) * 8;
        if (!best || rings < best.rings || (rings === best.rings && eccBytes > best.eccBytes)) {
            best = {
                rings,
                segmentsPerRing: segs,
                eccBytes,
                capacityBits: (0, layout_1.getTotalSegments)(rings, segs),
                usedBits,
            };
        }
    }
    return best;
}
function fillEcc(dataBytes, rings, segmentsPerRing) {
    const totalBytes = Math.floor((0, layout_1.getTotalSegments)(rings, segmentsPerRing) / 8);
    const spare = totalBytes - dataBytes;
    return Math.min(Math.max(spare, constants_1.AUTO_MIN_ECC), constants_1.AUTO_MAX_ECC);
}

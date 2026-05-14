"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAP_FRACTION = void 0;
exports.getRingWidth = getRingWidth;
exports.getOrientationRingRadius = getOrientationRingRadius;
exports.getOrientationArcs = getOrientationArcs;
exports.getRingRadius = getRingRadius;
exports.getExactRingRadius = getExactRingRadius;
exports.getBitArcLength = getBitArcLength;
exports.getSegmentAngle = getSegmentAngle;
exports.isDataRing = isDataRing;
exports.getSegmentsForRing = getSegmentsForRing;
exports.getTotalSegments = getTotalSegments;
/** Fraction of one bit's angular span used as a trailing gap. */
exports.GAP_FRACTION = 0.3;
/** Returns the nominal width of each radial band in pixels. */
function getRingWidth(rings, size) {
    return size / (2 * (rings + 3));
}
/** Returns the radius of the orientation ring used for rotation detection. */
function getOrientationRingRadius(rings, size) {
    return (rings + 1) * getRingWidth(rings, size);
}
/**
 * Returns the orientation ring arcs: a 101010 timing pattern followed by
 * three asymmetric arcs (large, medium, short) for unique orientation.
 *
 * All arcs use the same constant bit arc length as data rings.
 * The angular span of one bit on the orientation ring is L / R_orient.
 */
function getOrientationArcs(rings, size, baseSegments) {
    const R = getOrientationRingRadius(rings, size);
    const L = getBitArcLength(rings, size, baseSegments);
    const bitAngle = L / R;
    const totalBits = Math.floor((2 * Math.PI) / bitAngle);
    const arcs = [];
    let cursor = 0;
    // Timing pattern: 101010 — same trailing gap as data ring arcs
    for (let i = 0; i < 3; i++) {
        arcs.push({
            start: cursor,
            end: cursor + bitAngle * (1 - exports.GAP_FRACTION),
        });
        cursor += 2 * bitAngle;
    }
    // 2-bit separator before orientation arcs
    cursor += 2 * bitAngle;
    const SEPARATOR_BITS = 2;
    const usedBits = 8;
    const minFinalGap = 2;
    const availableForArcs = totalBits - usedBits - SEPARATOR_BITS * 2 - minFinalGap;
    const largeBits = Math.floor((availableForArcs * 4) / 7);
    const mediumBits = Math.floor((availableForArcs * 2) / 7);
    const shortBits = Math.max(3, availableForArcs - largeBits - mediumBits);
    arcs.push({
        start: cursor,
        end: cursor + bitAngle * (largeBits - exports.GAP_FRACTION),
    });
    cursor += (largeBits + SEPARATOR_BITS) * bitAngle;
    arcs.push({
        start: cursor,
        end: cursor + bitAngle * (mediumBits - exports.GAP_FRACTION),
    });
    cursor += (mediumBits + SEPARATOR_BITS) * bitAngle;
    arcs.push({
        start: cursor,
        end: cursor + bitAngle * (shortBits - exports.GAP_FRACTION),
    });
    return arcs;
}
/** Returns the nominal center radius of a ring (evenly spaced). */
function getRingRadius(ring, rings, size) {
    return (ring + 1) * getRingWidth(rings, size);
}
/**
 * Returns the exact ring radius derived from its segment count so that
 * every bit has exactly the same arc length across all rings.
 *
 * Given L = constant arc length per bit (defined by the outermost ring),
 * radius_i = segments_i * L / (2π).
 *
 * This also makes the angular gap (GAP_FRACTION * segAngle) produce a
 * constant arc-length gap = GAP_FRACTION * L across all rings.
 */
function getExactRingRadius(ring, rings, size, baseSegments) {
    const segs = getSegmentsForRing(ring, rings, baseSegments);
    const L = getBitArcLength(rings, size, baseSegments);
    return (segs * L) / (2 * Math.PI);
}
/**
 * Returns the arc length of one bit segment, constant across all rings.
 * Derived from the outermost data ring where segments == baseSegments exactly.
 */
function getBitArcLength(rings, size, baseSegments) {
    const ringWidth = getRingWidth(rings, size);
    return (2 * Math.PI * rings * ringWidth) / baseSegments;
}
/** Returns the starting angle in radians for a segment within a ring. */
function getSegmentAngle(segment, segmentsInRing) {
    return (segment / segmentsInRing) * Math.PI * 2;
}
/** Returns true if the given ring index carries data (not the center dot). */
function isDataRing(ring) {
    return ring > 0;
}
/** Returns the number of segments in a ring, scaling with ring radius.
 *  The outermost data ring is padded so the total across all data rings
 *  is a multiple of 8, eliminating wasted trailing bits. */
function getSegmentsForRing(ring, rings, baseSegments) {
    const raw = Math.max(8, Math.round((baseSegments * (ring + 1)) / rings));
    if (ring !== rings - 1)
        return raw;
    let innerTotal = 0;
    for (let r = 0; r < rings - 1; r++) {
        if (isDataRing(r)) {
            innerTotal += Math.max(8, Math.round((baseSegments * (r + 1)) / rings));
        }
    }
    const pad = (8 - ((innerTotal + raw) % 8)) % 8;
    return raw + pad;
}
/** Returns the total number of data segments across all data rings (always a multiple of 8). */
function getTotalSegments(rings, baseSegments) {
    let total = 0;
    for (let r = 0; r < rings; r++) {
        if (isDataRing(r))
            total += getSegmentsForRing(r, rings, baseSegments);
    }
    return total;
}

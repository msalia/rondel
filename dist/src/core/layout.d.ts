/** Fraction of one bit's angular span used as a trailing gap. */
export declare const GAP_FRACTION = 0.3;
/** Returns the nominal width of each radial band in pixels. */
export declare function getRingWidth(rings: number, size: number): number;
/** Returns the radius of the orientation ring used for rotation detection. */
export declare function getOrientationRingRadius(rings: number, size: number): number;
/** An arc defined by start and end angles in radians. */
export type OrientationArc = {
    start: number;
    end: number;
};
/**
 * Returns the orientation ring arcs: a 101010 timing pattern followed by
 * three asymmetric arcs (large, medium, short) for unique orientation.
 *
 * All arcs use the same constant bit arc length as data rings.
 * The angular span of one bit on the orientation ring is L / R_orient.
 */
export declare function getOrientationArcs(rings: number, size: number, baseSegments: number): OrientationArc[];
/** Returns the nominal center radius of a ring (evenly spaced). */
export declare function getRingRadius(ring: number, rings: number, size: number): number;
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
export declare function getExactRingRadius(ring: number, rings: number, size: number, baseSegments: number): number;
/**
 * Returns the arc length of one bit segment, constant across all rings.
 * Derived from the outermost data ring where segments == baseSegments exactly.
 */
export declare function getBitArcLength(rings: number, size: number, baseSegments: number): number;
/** Returns the starting angle in radians for a segment within a ring. */
export declare function getSegmentAngle(segment: number, segmentsInRing: number): number;
/** Returns true if the given ring index carries data (not the center dot). */
export declare function isDataRing(ring: number): boolean;
/** Returns the number of segments in a ring, scaling with ring radius.
 *  The outermost data ring is padded so the total across all data rings
 *  is a multiple of 8, eliminating wasted trailing bits. */
export declare function getSegmentsForRing(ring: number, rings: number, baseSegments: number): number;
/** Returns the total number of data segments across all data rings (always a multiple of 8). */
export declare function getTotalSegments(rings: number, baseSegments: number): number;

import { describe, it, expect } from "vitest";
import {
  GAP_FRACTION,
  getBitArcLength,
  getExactRingRadius,
  getRingRadius,
  getRingWidth,
  getSegmentAngle,
  getSegmentsForRing,
  getTotalSegments,
  getOrientationRingRadius,
  getOrientationArcs,
  isDataRing,
} from "@/core/layout";
import { DEFAULT_RINGS, DEFAULT_SEGMENTS_PER_RING, DEFAULT_CODE_SIZE } from "@/constants";

const R = DEFAULT_RINGS;
const S = DEFAULT_SEGMENTS_PER_RING;
const SZ = DEFAULT_CODE_SIZE;

describe("layout", () => {
  describe("isDataRing", () => {
    it("ring 0 is not a data ring", () => {
      expect(isDataRing(0)).toBe(false);
    });

    it("rings 1+ are data rings", () => {
      expect(isDataRing(1)).toBe(true);
      expect(isDataRing(2)).toBe(true);
      expect(isDataRing(5)).toBe(true);
    });
  });

  describe("getRingWidth", () => {
    it("accounts for data rings, spacer ring, and orientation ring", () => {
      const width = getRingWidth(R, SZ);
      expect(width).toBeCloseTo(SZ / (2 * (R + 3)), 5);
    });

    it("decreases as ring count increases", () => {
      expect(getRingWidth(3, SZ)).toBeGreaterThan(getRingWidth(R, SZ));
    });
  });

  describe("getSegmentsForRing", () => {
    it("outer ring gets at least base segments (may include byte-alignment padding)", () => {
      expect(getSegmentsForRing(R - 1, R, S)).toBeGreaterThanOrEqual(S);
    });

    it("inner rings get fewer segments proportional to circumference", () => {
      const inner = getSegmentsForRing(0, R, S);
      const outer = getSegmentsForRing(R - 1, R, S);
      expect(inner).toBeLessThan(outer);
    });

    it("enforces minimum of 8 segments", () => {
      expect(getSegmentsForRing(0, 10, 10)).toBeGreaterThanOrEqual(8);
    });

    it("segments scale with ring index", () => {
      const segs = Array.from({ length: R }, (_, r) => getSegmentsForRing(r, R, S));
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]).toBeGreaterThanOrEqual(segs[i - 1]);
      }
    });
  });

  describe("getTotalSegments", () => {
    it("only counts data rings", () => {
      const total = getTotalSegments(R, S);
      const ring0Segs = getSegmentsForRing(0, R, S);
      let manualTotal = 0;
      let totalWithAll = 0;
      for (let r = 0; r < R; r++) {
        totalWithAll += getSegmentsForRing(r, R, S);
        if (isDataRing(r)) manualTotal += getSegmentsForRing(r, R, S);
      }
      expect(total).toBe(manualTotal);
      expect(total).toBe(totalWithAll - ring0Segs);
    });

    it("returns fewer total segments than rings * baseSegments", () => {
      const total = getTotalSegments(R, S);
      expect(total).toBeLessThan(R * S);
    });
  });

  describe("getRingRadius", () => {
    it("inner ring has smaller radius than outer ring", () => {
      const r0 = getRingRadius(0, R, SZ);
      const r4 = getRingRadius(R - 1, R, SZ);
      expect(r0).toBeLessThan(r4);
    });

    it("radius scales linearly with ring index", () => {
      const r0 = getRingRadius(0, R, SZ);
      const r1 = getRingRadius(1, R, SZ);
      const r2 = getRingRadius(2, R, SZ);
      expect(r2 - r1).toBeCloseTo(r1 - r0, 5);
    });
  });

  describe("getSegmentAngle", () => {
    it("first segment starts at 0", () => {
      expect(getSegmentAngle(0, S)).toBe(0);
    });

    it("halfway segment is at PI", () => {
      expect(getSegmentAngle(S / 2, S)).toBeCloseTo(Math.PI, 5);
    });

    it("full rotation is 2*PI", () => {
      expect(getSegmentAngle(S, S)).toBeCloseTo(2 * Math.PI, 5);
    });
  });

  describe("getBitArcLength", () => {
    it("returns 2π * rings * ringWidth / baseSegments", () => {
      const ringWidth = getRingWidth(R, SZ);
      const expected = (2 * Math.PI * R * ringWidth) / S;
      expect(getBitArcLength(R, SZ, S)).toBeCloseTo(expected, 10);
    });

    it("is independent of ring index", () => {
      const L = getBitArcLength(R, SZ, S);
      expect(L).toBeGreaterThan(0);
    });
  });

  describe("getExactRingRadius", () => {
    it("produces identical arc length per bit on every data ring", () => {
      const arcLengths: number[] = [];
      for (let r = 0; r < R; r++) {
        if (!isDataRing(r)) continue;
        const radius = getExactRingRadius(r, R, SZ, S);
        const segs = getSegmentsForRing(r, R, S);
        arcLengths.push((2 * Math.PI * radius) / segs);
      }
      for (let i = 1; i < arcLengths.length; i++) {
        expect(arcLengths[i]).toBeCloseTo(arcLengths[0], 10);
      }
    });

    it("produces identical gap arc length on every data ring", () => {
      const gapLengths: number[] = [];
      for (let r = 0; r < R; r++) {
        if (!isDataRing(r)) continue;
        const radius = getExactRingRadius(r, R, SZ, S);
        const segs = getSegmentsForRing(r, R, S);
        const segAngle = (2 * Math.PI) / segs;
        gapLengths.push(radius * segAngle * GAP_FRACTION);
      }
      for (let i = 1; i < gapLengths.length; i++) {
        expect(gapLengths[i]).toBeCloseTo(gapLengths[0], 10);
      }
    });

    it("outermost data ring is within 10% of nominal getRingRadius", () => {
      const exact = getExactRingRadius(R - 1, R, SZ, S);
      const nominal = getRingRadius(R - 1, R, SZ);
      expect(Math.abs(exact - nominal) / nominal).toBeLessThan(0.1);
    });

    it("inner rings are smaller than outer rings", () => {
      const r1 = getExactRingRadius(1, R, SZ, S);
      const rLast = getExactRingRadius(R - 1, R, SZ, S);
      expect(r1).toBeLessThan(rLast);
    });

    it("works across multiple configurations", () => {
      for (const [rings, base] of [[3, 32], [5, 48], [6, 64]] as const) {
        const L = getBitArcLength(rings, SZ, base);
        for (let r = 0; r < rings; r++) {
          if (!isDataRing(r)) continue;
          const radius = getExactRingRadius(r, rings, SZ, base);
          const segs = getSegmentsForRing(r, rings, base);
          expect((2 * Math.PI * radius) / segs).toBeCloseTo(L, 10);
        }
      }
    });
  });

  describe("getOrientationRingRadius", () => {
    it("is beyond the outermost data ring", () => {
      const outerDataRadius = getRingRadius(R - 1, R, SZ);
      const orientationRadius = getOrientationRingRadius(R, SZ);
      expect(orientationRadius).toBeGreaterThan(outerDataRadius);
    });

    it("equals (rings + 1) * ringWidth", () => {
      const ringWidth = getRingWidth(R, SZ);
      expect(getOrientationRingRadius(R, SZ)).toBeCloseTo((R + 1) * ringWidth, 5);
    });

    it("fits within the SVG bounds", () => {
      const radius = getOrientationRingRadius(R, SZ);
      const strokeHalf = getRingWidth(R, SZ) * 0.5 / 2;
      expect(radius + strokeHalf).toBeLessThan(SZ / 2);
    });
  });

  describe("getOrientationArcs", () => {
    const arcs = getOrientationArcs(R, SZ, S);

    it("returns 6 arcs (3 timing + 3 orientation)", () => {
      expect(arcs).toHaveLength(6);
    });

    it("first 3 arcs are equal-sized timing bits", () => {
      const timingSpans = arcs.slice(0, 3).map((a) => a.end - a.start);
      expect(timingSpans[0]).toBeCloseTo(timingSpans[1], 10);
      expect(timingSpans[1]).toBeCloseTo(timingSpans[2], 10);
    });

    it("timing arcs use same GAP_FRACTION as data ring arcs", () => {
      const orientR = getOrientationRingRadius(R, SZ);
      const L = getBitArcLength(R, SZ, S);
      const bitAngle = L / orientR;
      const expectedSpan = bitAngle * (1 - GAP_FRACTION);
      for (const arc of arcs.slice(0, 3)) {
        expect(arc.end - arc.start).toBeCloseTo(expectedSpan, 10);
      }
    });

    it("orientation arcs are ordered large, medium, short", () => {
      const orientSpans = arcs.slice(3).map((a) => a.end - a.start);
      expect(orientSpans[0]).toBeGreaterThan(orientSpans[1]);
      expect(orientSpans[1]).toBeGreaterThan(orientSpans[2]);
    });

    it("arcs do not overlap", () => {
      for (let i = 1; i < arcs.length; i++) {
        expect(arcs[i].start).toBeGreaterThan(arcs[i - 1].end);
      }
    });

    it("all arcs fit within a full circle", () => {
      expect(arcs[arcs.length - 1].end).toBeLessThan(2 * Math.PI);
    });

    it("all arc lengths are multiples of the bit arc length", () => {
      const orientR = getOrientationRingRadius(R, SZ);
      const L = getBitArcLength(R, SZ, S);
      const bitAngle = L / orientR;
      for (const arc of arcs) {
        const span = arc.end - arc.start;
        const bits = (span / bitAngle) + GAP_FRACTION;
        expect(Math.abs(bits - Math.round(bits))).toBeLessThan(0.01);
      }
    });

    it("pattern is asymmetric for unique orientation", () => {
      const orientSpans = arcs.slice(3).map((a) => a.end - a.start);
      expect(orientSpans[0]).not.toBeCloseTo(orientSpans[1], 3);
      expect(orientSpans[1]).not.toBeCloseTo(orientSpans[2], 3);
      expect(orientSpans[0]).not.toBeCloseTo(orientSpans[2], 3);
    });

    it("works across multiple configurations", () => {
      for (const [rings, base] of [[3, 32], [5, 48], [6, 64]] as const) {
        const a = getOrientationArcs(rings, SZ, base);
        expect(a).toHaveLength(6);
        for (let i = 1; i < a.length; i++) {
          expect(a[i].start).toBeGreaterThan(a[i - 1].end);
        }
        expect(a[a.length - 1].end).toBeLessThan(2 * Math.PI);
      }
    });
  });
});

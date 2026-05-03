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
      const width = getRingWidth(5, 300);
      expect(width).toBeCloseTo(300 / (2 * (5 + 3)), 5);
    });

    it("decreases as ring count increases", () => {
      expect(getRingWidth(3, 300)).toBeGreaterThan(getRingWidth(5, 300));
    });
  });

  describe("getSegmentsForRing", () => {
    it("outer ring gets full base segments", () => {
      expect(getSegmentsForRing(4, 5, 48)).toBe(48);
    });

    it("inner rings get fewer segments proportional to circumference", () => {
      const inner = getSegmentsForRing(0, 5, 48);
      const outer = getSegmentsForRing(4, 5, 48);
      expect(inner).toBeLessThan(outer);
    });

    it("enforces minimum of 8 segments", () => {
      expect(getSegmentsForRing(0, 10, 10)).toBeGreaterThanOrEqual(8);
    });

    it("segments scale with ring index", () => {
      const segs = Array.from({ length: 5 }, (_, r) => getSegmentsForRing(r, 5, 48));
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]).toBeGreaterThanOrEqual(segs[i - 1]);
      }
    });
  });

  describe("getTotalSegments", () => {
    it("only counts data rings", () => {
      const total = getTotalSegments(5, 48);
      const ring0Segs = getSegmentsForRing(0, 5, 48);
      let manualTotal = 0;
      let totalWithAll = 0;
      for (let r = 0; r < 5; r++) {
        totalWithAll += getSegmentsForRing(r, 5, 48);
        if (isDataRing(r)) manualTotal += getSegmentsForRing(r, 5, 48);
      }
      expect(total).toBe(manualTotal);
      expect(total).toBe(totalWithAll - ring0Segs);
    });

    it("returns fewer total segments than rings * baseSegments", () => {
      const total = getTotalSegments(5, 48);
      expect(total).toBeLessThan(5 * 48);
    });
  });

  describe("getRingRadius", () => {
    it("inner ring has smaller radius than outer ring", () => {
      const r0 = getRingRadius(0, 5, 300);
      const r4 = getRingRadius(4, 5, 300);
      expect(r0).toBeLessThan(r4);
    });

    it("radius scales linearly with ring index", () => {
      const r0 = getRingRadius(0, 5, 300);
      const r1 = getRingRadius(1, 5, 300);
      const r2 = getRingRadius(2, 5, 300);
      expect(r2 - r1).toBeCloseTo(r1 - r0, 5);
    });
  });

  describe("getSegmentAngle", () => {
    it("first segment starts at 0", () => {
      expect(getSegmentAngle(0, 48)).toBe(0);
    });

    it("halfway segment is at PI", () => {
      expect(getSegmentAngle(24, 48)).toBeCloseTo(Math.PI, 5);
    });

    it("full rotation is 2*PI", () => {
      expect(getSegmentAngle(48, 48)).toBeCloseTo(2 * Math.PI, 5);
    });
  });

  describe("getBitArcLength", () => {
    it("returns 2π * rings * ringWidth / baseSegments", () => {
      const rings = 5, size = 300, base = 48;
      const ringWidth = getRingWidth(rings, size);
      const expected = (2 * Math.PI * rings * ringWidth) / base;
      expect(getBitArcLength(rings, size, base)).toBeCloseTo(expected, 10);
    });

    it("is independent of ring index", () => {
      const L = getBitArcLength(5, 300, 48);
      expect(L).toBeGreaterThan(0);
    });
  });

  describe("getExactRingRadius", () => {
    it("produces identical arc length per bit on every data ring", () => {
      const rings = 5, size = 300, base = 48;
      const arcLengths: number[] = [];
      for (let r = 0; r < rings; r++) {
        if (!isDataRing(r)) continue;
        const radius = getExactRingRadius(r, rings, size, base);
        const segs = getSegmentsForRing(r, rings, base);
        arcLengths.push((2 * Math.PI * radius) / segs);
      }
      for (let i = 1; i < arcLengths.length; i++) {
        expect(arcLengths[i]).toBeCloseTo(arcLengths[0], 10);
      }
    });

    it("produces identical gap arc length on every data ring", () => {
      const rings = 5, size = 300, base = 48;
      const GAP_FRACTION = 0.3;
      const gapLengths: number[] = [];
      for (let r = 0; r < rings; r++) {
        if (!isDataRing(r)) continue;
        const radius = getExactRingRadius(r, rings, size, base);
        const segs = getSegmentsForRing(r, rings, base);
        const segAngle = (2 * Math.PI) / segs;
        gapLengths.push(radius * segAngle * GAP_FRACTION);
      }
      for (let i = 1; i < gapLengths.length; i++) {
        expect(gapLengths[i]).toBeCloseTo(gapLengths[0], 10);
      }
    });

    it("outermost data ring matches getRingRadius exactly", () => {
      const rings = 5, size = 300, base = 48;
      const exact = getExactRingRadius(rings - 1, rings, size, base);
      const nominal = getRingRadius(rings - 1, rings, size);
      expect(exact).toBeCloseTo(nominal, 10);
    });

    it("inner rings are smaller than outer rings", () => {
      const rings = 5, size = 300, base = 48;
      const r1 = getExactRingRadius(1, rings, size, base);
      const r4 = getExactRingRadius(4, rings, size, base);
      expect(r1).toBeLessThan(r4);
    });

    it("works across multiple configurations", () => {
      for (const [rings, base] of [[3, 32], [5, 48], [6, 64]] as const) {
        const size = 300;
        const L = getBitArcLength(rings, size, base);
        for (let r = 0; r < rings; r++) {
          if (!isDataRing(r)) continue;
          const radius = getExactRingRadius(r, rings, size, base);
          const segs = getSegmentsForRing(r, rings, base);
          expect((2 * Math.PI * radius) / segs).toBeCloseTo(L, 10);
        }
      }
    });
  });

  describe("getOrientationRingRadius", () => {
    it("is beyond the outermost data ring", () => {
      const outerDataRadius = getRingRadius(4, 5, 300);
      const orientationRadius = getOrientationRingRadius(5, 300);
      expect(orientationRadius).toBeGreaterThan(outerDataRadius);
    });

    it("equals (rings + 1) * ringWidth", () => {
      const ringWidth = getRingWidth(5, 300);
      expect(getOrientationRingRadius(5, 300)).toBeCloseTo((5 + 1) * ringWidth, 5);
    });

    it("fits within the SVG bounds", () => {
      const size = 300;
      const radius = getOrientationRingRadius(5, size);
      const strokeHalf = getRingWidth(5, size) * 0.5 / 2;
      expect(radius + strokeHalf).toBeLessThan(size / 2);
    });
  });

  describe("getOrientationArcs", () => {
    const arcs = getOrientationArcs(5, 300, 48);

    it("returns 6 arcs (3 timing + 3 orientation)", () => {
      expect(arcs).toHaveLength(6);
    });

    it("first 3 arcs are equal-sized timing bits", () => {
      const timingSpans = arcs.slice(0, 3).map((a) => a.end - a.start);
      expect(timingSpans[0]).toBeCloseTo(timingSpans[1], 10);
      expect(timingSpans[1]).toBeCloseTo(timingSpans[2], 10);
    });

    it("timing arcs use same GAP_FRACTION as data ring arcs", () => {
      const R = getOrientationRingRadius(5, 300);
      const L = getBitArcLength(5, 300, 48);
      const bitAngle = L / R;
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
      const lastEnd = arcs[arcs.length - 1].end;
      expect(lastEnd).toBeLessThan(2 * Math.PI);
    });

    it("all arc lengths are multiples of the bit arc length", () => {
      const R = getOrientationRingRadius(5, 300);
      const L = getBitArcLength(5, 300, 48);
      const bitAngle = L / R;
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
        const a = getOrientationArcs(rings, 300, base);
        expect(a).toHaveLength(6);
        for (let i = 1; i < a.length; i++) {
          expect(a[i].start).toBeGreaterThan(a[i - 1].end);
        }
        expect(a[a.length - 1].end).toBeLessThan(2 * Math.PI);
      }
    });
  });
});

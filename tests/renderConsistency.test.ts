import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { getSegmentsForRing, getTotalSegments, isDataRing } from "@/core/layout";

describe("render consistency", () => {
  it("encoder produces bits that fit in the grid", () => {
    const code = encode("hello", { rings: 5, segmentsPerRing: 48, eccBytes: 4 });
    const totalSlots = getTotalSegments(code.rings, code.segmentsPerRing);
    expect(code.bits.length).toBeLessThanOrEqual(totalSlots);
  });

  it("bit consumption order matches layout for multiple configs", () => {
    const configs = [
      { rings: 3, segmentsPerRing: 32 },
      { rings: 5, segmentsPerRing: 48 },
      { rings: 6, segmentsPerRing: 64 },
    ];

    for (const cfg of configs) {
      let totalDataSegments = 0;
      for (let r = 0; r < cfg.rings; r++) {
        if (isDataRing(r)) {
          totalDataSegments += getSegmentsForRing(r, cfg.rings, cfg.segmentsPerRing);
        }
      }
      expect(getTotalSegments(cfg.rings, cfg.segmentsPerRing)).toBe(totalDataSegments);
    }
  });

  it("non-data ring segments are not counted in total", () => {
    const rings = 5;
    const base = 48;
    const ring0Segs = getSegmentsForRing(0, rings, base);
    const total = getTotalSegments(rings, base);

    let totalWithRing0 = 0;
    for (let r = 0; r < rings; r++) {
      totalWithRing0 += getSegmentsForRing(r, rings, base);
    }

    expect(total).toBe(totalWithRing0 - ring0Segs);
  });

  it("inner rings always have fewer or equal segments to outer rings", () => {
    for (const base of [32, 48, 64]) {
      for (const rings of [3, 5, 8]) {
        for (let r = 1; r < rings; r++) {
          const prev = getSegmentsForRing(r - 1, rings, base);
          const curr = getSegmentsForRing(r, rings, base);
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }
    }
  });

  it("encode/decode roundtrip works with adaptive segments", () => {
    const configs = [
      { rings: 3, segmentsPerRing: 32, eccBytes: 2, input: "ab" },
      { rings: 5, segmentsPerRing: 48, eccBytes: 4, input: "test" },
      { rings: 6, segmentsPerRing: 64, eccBytes: 4, input: "test" },
    ];

    for (const { input, ...cfg } of configs) {
      const code = encode(input, cfg);
      const output = decode(code.bits, cfg.eccBytes);
      expect(output).toBe(input);
    }
  });
});

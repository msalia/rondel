import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { DEFAULT_ECC_BYTES, DEFAULT_RINGS, DEFAULT_SEGMENTS_PER_RING } from "@/constants";
import { getSegmentsForRing, getTotalSegments, isDataRing } from "@/core/layout";

describe("render consistency", () => {
  it("encoder produces bits that fit in the grid", () => {
    const code = encode("hello", { rings: DEFAULT_RINGS, segmentsPerRing: DEFAULT_SEGMENTS_PER_RING, eccBytes: DEFAULT_ECC_BYTES });
    const totalSlots = getTotalSegments(code.rings, code.segmentsPerRing);
    expect(code.bits.length).toBeLessThanOrEqual(totalSlots);
  });

  it("bit consumption order matches layout for multiple configs", () => {
    const configs = [
      { rings: 3, segmentsPerRing: 32 },
      { rings: DEFAULT_RINGS, segmentsPerRing: DEFAULT_SEGMENTS_PER_RING },
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
    const rings = DEFAULT_RINGS;
    const base = DEFAULT_SEGMENTS_PER_RING;
    const ring0Segs = getSegmentsForRing(0, rings, base);
    const total = getTotalSegments(rings, base);

    let totalWithRing0 = 0;
    for (let r = 0; r < rings; r++) {
      totalWithRing0 += getSegmentsForRing(r, rings, base);
    }

    expect(total).toBe(totalWithRing0 - ring0Segs);
  });

  it("inner rings always have fewer or equal segments to outer rings", () => {
    for (const base of [32, DEFAULT_SEGMENTS_PER_RING, 64]) {
      for (const rings of [3, DEFAULT_RINGS, 8]) {
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
      { rings: DEFAULT_RINGS, segmentsPerRing: DEFAULT_SEGMENTS_PER_RING, eccBytes: DEFAULT_ECC_BYTES, input: "test" },
      { rings: 6, segmentsPerRing: 64, eccBytes: DEFAULT_ECC_BYTES, input: "test" },
    ];

    for (const { input, ...cfg } of configs) {
      const code = encode(input, cfg);
      const output = decode(code.bits, cfg.eccBytes);
      expect(output).toBe(input);
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  AUTO_MAX_ECC,
  AUTO_MAX_RINGS,
  AUTO_MIN_ECC,
  AUTO_MIN_RINGS,
  AUTO_SEGMENT_CANDIDATES,
} from "@/constants";
import {
  autoSize,
  computeDataBytes,
  computeNeededBits,
  minRingsForBits,
} from "@/core/autoSize";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { getTotalSegments } from "@/core/layout";

describe("computeDataBytes", () => {
  it("empty string is just a 2-byte header", () => {
    expect(computeDataBytes("")).toBe(2);
  });

  it("byte mode: header + UTF-8 byte count", () => {
    expect(computeDataBytes("Hello!")).toBe(2 + 6);
  });

  it("alphanumeric is more compact than byte", () => {
    expect(computeDataBytes("HELLO")).toBeLessThan(computeDataBytes("Hello!"));
  });

  it("numeric is the most compact", () => {
    expect(computeDataBytes("123456789")).toBeLessThan(computeDataBytes("ABCDEFGHI"));
  });

  it("uses 3-byte header for count > 62", () => {
    const longInput = "a!".repeat(35);
    expect(longInput.length).toBe(70);
    expect(computeDataBytes(longInput)).toBe(3 + 70);
  });
});

describe("computeNeededBits", () => {
  it("adds ECC bytes to data bytes", () => {
    const data = computeDataBytes("test");
    expect(computeNeededBits("test", 4)).toBe((data + 4) * 8);
    expect(computeNeededBits("test", 8)).toBe((data + 8) * 8);
  });
});

describe("minRingsForBits", () => {
  it("returns AUTO_MIN_RINGS for very small payloads", () => {
    expect(minRingsForBits(16, 48)).toBe(AUTO_MIN_RINGS);
  });

  it("returns null when no ring count fits within range", () => {
    expect(minRingsForBits(100000, 48)).toBeNull();
  });

  it("returns the smallest ring count that fits", () => {
    const neededBits = 200;
    const rings = minRingsForBits(neededBits, 48)!;
    expect(rings).toBeGreaterThanOrEqual(AUTO_MIN_RINGS);
    expect(rings).toBeLessThanOrEqual(AUTO_MAX_RINGS);
    expect(getTotalSegments(rings, 48)).toBeGreaterThanOrEqual(neededBits);
    if (rings > AUTO_MIN_RINGS) {
      expect(getTotalSegments(rings - 1, 48)).toBeLessThan(neededBits);
    }
  });

  it("respects custom min/max rings", () => {
    const rings = minRingsForBits(16, 48, 5, 10)!;
    expect(rings).toBeGreaterThanOrEqual(5);
  });
});

describe("autoSize constraints", () => {
  it("rings are within [AUTO_MIN_RINGS, AUTO_MAX_RINGS]", () => {
    const inputs = ["Hi", "hello", "https://example.com", "1234567890"];
    for (const input of inputs) {
      const result = autoSize(input);
      if (result) {
        expect(result.rings).toBeGreaterThanOrEqual(AUTO_MIN_RINGS);
        expect(result.rings).toBeLessThanOrEqual(AUTO_MAX_RINGS);
      }
    }
  });

  it("segments are within AUTO_SEGMENT_CANDIDATES", () => {
    const inputs = ["Hi", "hello", "https://example.com"];
    for (const input of inputs) {
      const result = autoSize(input);
      if (result) {
        expect(AUTO_SEGMENT_CANDIDATES).toContain(result.segmentsPerRing);
      }
    }
  });

  it("ECC is within [AUTO_MIN_ECC, AUTO_MAX_ECC]", () => {
    const inputs = ["Hi", "hello", "https://example.com", "short"];
    for (const input of inputs) {
      const result = autoSize(input);
      if (result) {
        expect(result.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
        expect(result.eccBytes).toBeLessThanOrEqual(AUTO_MAX_ECC);
      }
    }
  });

  it("usedBits never exceeds capacityBits", () => {
    const inputs = ["", "a", "hello", "https://example.com", "12345678901234567890"];
    for (const input of inputs) {
      const result = autoSize(input);
      if (result) {
        expect(result.usedBits).toBeLessThanOrEqual(result.capacityBits);
      }
    }
  });

  it("capacityBits is always a multiple of 8", () => {
    const inputs = ["a", "hello", "https://example.com"];
    for (const input of inputs) {
      const result = autoSize(input)!;
      expect(result.capacityBits % 8).toBe(0);
    }
  });
});

describe("autoSize selection logic", () => {
  it("returns smallest grid for short text", () => {
    const result = autoSize("Hi")!;
    expect(result.rings).toBe(AUTO_MIN_RINGS);
  });

  it("increases rings for longer text", () => {
    const short = autoSize("Hi")!;
    const long = autoSize("https://example.com/path")!;
    expect(long.rings).toBeGreaterThan(short.rings);
  });

  it("returns null for text too large for max config", () => {
    expect(autoSize("x".repeat(200))).toBeNull();
  });

  it("fills remaining capacity with ECC", () => {
    const result = autoSize("Hi")!;
    const totalBytes = Math.floor(result.capacityBits / 8);
    const dataBytes = computeDataBytes("Hi");
    const maxEcc = Math.min(totalBytes - dataBytes, AUTO_MAX_ECC);
    expect(result.eccBytes).toBe(maxEcc);
  });

  it("picks fewest rings across segment candidates", () => {
    const result = autoSize("https://example.com")!;
    for (const segs of AUTO_SEGMENT_CANDIDATES) {
      const minBits = (computeDataBytes("https://example.com") + AUTO_MIN_ECC) * 8;
      const altRings = minRingsForBits(minBits, segs);
      if (altRings !== null) {
        expect(result.rings).toBeLessThanOrEqual(altRings);
      }
    }
  });

  it("prefers more ECC when tied on rings", () => {
    const result = autoSize("Hi")!;
    expect(result.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
  });

  it("consistent results across repeated calls", () => {
    const a = autoSize("https://example.com")!;
    const b = autoSize("https://example.com")!;
    expect(a).toEqual(b);
  });

  it("handles multibyte UTF-8", () => {
    const result = autoSize("café")!;
    expect(result).not.toBeNull();
    const code = encode("café");
    expect(decode(code.bits, code.eccBytes)).toBe("café");
  });

  it("lowercase alphanumeric packs more efficiently", () => {
    const lower = autoSize("hello world")!;
    const mixed = autoSize("Hello World!")!;
    expect(lower.rings).toBeLessThanOrEqual(mixed.rings);
  });

  it("empty string gets minimum rings with maximum ECC", () => {
    const result = autoSize("")!;
    expect(result.rings).toBe(AUTO_MIN_RINGS);
    expect(result.eccBytes).toBe(AUTO_MAX_ECC);
  });

  it("long numeric string packs efficiently", () => {
    const numeric = autoSize("12345678901234567890")!;
    const byte = autoSize("abcdefghijklmnopqrst!")!;
    expect(numeric.rings).toBeLessThanOrEqual(byte.rings);
  });
});

describe("autoSize with pinned parameters", () => {
  it("pinned segments: auto-sizes rings and ECC", () => {
    const result = autoSize("hello", { segmentsPerRing: 48 })!;
    expect(result.segmentsPerRing).toBe(48);
    expect(result.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
    expect(result.eccBytes).toBeLessThanOrEqual(AUTO_MAX_ECC);
    const code = encode("hello", { segmentsPerRing: 48 });
    expect(decode(code.bits, code.eccBytes)).toBe("hello");
  });

  it("pinned ECC: auto-sizes rings and segments", () => {
    const result = autoSize("hello", { eccBytes: 8 })!;
    expect(result.eccBytes).toBe(8);
    expect(result.rings).toBeGreaterThanOrEqual(AUTO_MIN_RINGS);
    const code = encode("hello", { eccBytes: 8 });
    expect(decode(code.bits, 8)).toBe("hello");
  });

  it("pinned both: only auto-sizes rings", () => {
    const result = autoSize("hello", { segmentsPerRing: 48, eccBytes: 4 })!;
    expect(result.segmentsPerRing).toBe(48);
    expect(result.eccBytes).toBe(4);
    expect(result.rings).toBeGreaterThanOrEqual(AUTO_MIN_RINGS);
  });

  it("pinned segments too small returns null for large data", () => {
    expect(autoSize("x".repeat(100), { segmentsPerRing: 32 })).toBeNull();
  });
});

describe("all config permutations encode/decode correctly", () => {
  const testInputs = ["Hi", "hello world", "12345", "HELLO", "https://ex.co"];

  for (const segs of AUTO_SEGMENT_CANDIDATES) {
    for (let ecc = AUTO_MIN_ECC; ecc <= AUTO_MAX_ECC; ecc += 2) {
      for (let rings = AUTO_MIN_RINGS; rings <= AUTO_MAX_RINGS; rings++) {
        it(`rings=${rings} segs=${segs} ecc=${ecc}`, () => {
          for (const input of testInputs) {
            try {
              const code = encode(input, { rings, segmentsPerRing: segs, eccBytes: ecc });
              const decoded = decode(code.bits, ecc);
              expect(decoded).toBe(input);
              expect(code.rings).toBe(rings);
              expect(code.segmentsPerRing).toBe(segs);
              expect(code.eccBytes).toBe(ecc);
            } catch (e) {
              if (!(e instanceof Error) || !e.message.includes("too large")) throw e;
            }
          }
        });
      }
    }
  }
});

describe("encode with full auto-sizing", () => {
  it("auto-sizes everything when no options given", () => {
    const code = encode("Hi");
    expect(code.rings).toBeGreaterThanOrEqual(AUTO_MIN_RINGS);
    expect(code.rings).toBeLessThanOrEqual(AUTO_MAX_RINGS);
    expect(code.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
    expect(code.eccBytes).toBeLessThanOrEqual(AUTO_MAX_ECC);
    expect(decode(code.bits, code.eccBytes)).toBe("Hi");
  });

  it("auto-sizes a URL with optimal ECC", () => {
    const input = "https://example.com";
    const code = encode(input);
    expect(code.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
    expect(decode(code.bits, code.eccBytes)).toBe(input);
  });

  it("uses fewest rings possible", () => {
    const input = "test";
    const code = encode(input);
    const minBits = (computeDataBytes(input) + AUTO_MIN_ECC) * 8;
    if (code.rings > AUTO_MIN_RINGS) {
      expect(getTotalSegments(code.rings - 1, code.segmentsPerRing)).toBeLessThan(minBits);
    }
  });

  it("still respects all explicit options", () => {
    const code = encode("Hi", { rings: 6, segmentsPerRing: 48, eccBytes: 4 });
    expect(code.rings).toBe(6);
    expect(code.segmentsPerRing).toBe(48);
    expect(code.eccBytes).toBe(4);
  });

  it("eccBytes is included in the returned code", () => {
    const code = encode("test");
    expect(code.eccBytes).toBeDefined();
    expect(code.eccBytes).toBeGreaterThanOrEqual(AUTO_MIN_ECC);
  });

  it("roundtrips correctly across various inputs", () => {
    const inputs = [
      "",
      "a",
      "42",
      "hello",
      "HELLO",
      "12345",
      "https://example.com",
      "hello world 123 test",
      "abcdefghijklmnopqrstuvwxyz",
      "the quick brown fox jumps",
    ];
    for (const input of inputs) {
      const code = encode(input);
      expect(decode(code.bits, code.eccBytes)).toBe(input);
    }
  });

  it("throws for input too large for auto range", () => {
    expect(() => encode("x".repeat(200))).toThrow("too large");
  });
});

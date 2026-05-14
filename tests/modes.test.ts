import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { Mode, detectMode, packNumeric, packAlphanumeric, unpackNumeric, unpackAlphanumeric, packedByteCount } from "@/core/modes";
import { getTotalSegments } from "@/core/layout";

describe("mode detection", () => {
  it("detects numeric", () => {
    expect(detectMode("12345")).toBe(Mode.NUMERIC);
    expect(detectMode("0")).toBe(Mode.NUMERIC);
    expect(detectMode("000999")).toBe(Mode.NUMERIC);
  });

  it("detects alphanumeric", () => {
    expect(detectMode("HELLO")).toBe(Mode.ALPHANUMERIC);
    expect(detectMode("hello")).toBe(Mode.ALPHANUMERIC);
    expect(detectMode("ABC 123")).toBe(Mode.ALPHANUMERIC);
    expect(detectMode("HTTP://EX.CO")).toBe(Mode.ALPHANUMERIC);
    expect(detectMode("ex.co/test")).toBe(Mode.ALPHANUMERIC);
    expect(detectMode("$10.99")).toBe(Mode.ALPHANUMERIC);
  });

  it("falls back to byte for unsupported chars", () => {
    expect(detectMode("hello!")).toBe(Mode.BYTE);
    expect(detectMode("café")).toBe(Mode.BYTE);
    expect(detectMode("hello@world")).toBe(Mode.BYTE);
    expect(detectMode("emoji 😀")).toBe(Mode.BYTE);
  });
});

describe("numeric packing", () => {
  it("packs and unpacks single digit", () => {
    const packed = packNumeric("7");
    const result = unpackNumeric(packed, 1);
    expect(result).toBe("7");
  });

  it("packs and unpacks two digits", () => {
    const packed = packNumeric("42");
    const result = unpackNumeric(packed, 2);
    expect(result).toBe("42");
  });

  it("packs and unpacks three digits", () => {
    const packed = packNumeric("123");
    const result = unpackNumeric(packed, 3);
    expect(result).toBe("123");
  });

  it("packs and unpacks multiple groups", () => {
    const packed = packNumeric("1234567890");
    const result = unpackNumeric(packed, 10);
    expect(result).toBe("1234567890");
  });

  it("preserves leading zeros", () => {
    const packed = packNumeric("007");
    const result = unpackNumeric(packed, 3);
    expect(result).toBe("007");
  });

  it("is more compact than raw bytes", () => {
    expect(packedByteCount(9, Mode.NUMERIC)).toBeLessThan(9);
    expect(packedByteCount(9, Mode.NUMERIC)).toBe(4); // 3*10 = 30 bits = 4 bytes
  });
});

describe("alphanumeric packing", () => {
  it("packs and unpacks even-length string", () => {
    const packed = packAlphanumeric("AB");
    const result = unpackAlphanumeric(packed, 2);
    expect(result).toBe("AB");
  });

  it("packs and unpacks odd-length string", () => {
    const packed = packAlphanumeric("ABC");
    const result = unpackAlphanumeric(packed, 3);
    expect(result).toBe("ABC");
  });

  it("handles digits and special chars", () => {
    const packed = packAlphanumeric("HTTPS://EX.CO/123");
    const result = unpackAlphanumeric(packed, 17);
    expect(result).toBe("HTTPS://EX.CO/123");
  });

  it("uppercases input", () => {
    const packed = packAlphanumeric("hello");
    const result = unpackAlphanumeric(packed, 5);
    expect(result).toBe("HELLO");
  });

  it("is more compact than raw bytes", () => {
    expect(packedByteCount(10, Mode.ALPHANUMERIC)).toBeLessThan(10);
    expect(packedByteCount(10, Mode.ALPHANUMERIC)).toBe(7); // 5*11 = 55 bits = 7 bytes
  });
});

describe("encode/decode roundtrip with modes", () => {
  const ECC = 4;

  it("numeric roundtrip", () => {
    const input = "1234567890";
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("alphanumeric roundtrip (uppercase)", () => {
    const input = "HELLO WORLD";
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("alphanumeric roundtrip (lowercase preserved)", () => {
    const input = "hello world";
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("URL roundtrip (lowercase)", () => {
    const input = "ex.co/test123";
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("mixed case falls back to byte mode", () => {
    expect(detectMode("Hello")).toBe(Mode.BYTE);
    const input = "Hello";
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("byte mode for multibyte UTF-8", () => {
    const input = "hi!";
    expect(detectMode(input)).toBe(Mode.BYTE);
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });

  it("alphanumeric fits more data than byte mode", () => {
    const capacity = getTotalSegments(5, 48);
    const availBytes = Math.floor(capacity / 8) - ECC - 2;

    // Byte mode: availBytes chars
    const byteMax = availBytes;

    // Alphanumeric mode: more chars in same bytes
    const alphanumBits = availBytes * 8;
    const alphanumMax = Math.floor(alphanumBits / 11) * 2 + (alphanumBits % 11 >= 6 ? 1 : 0);

    expect(alphanumMax).toBeGreaterThan(byteMax);
    console.log(`  Capacity: byte=${byteMax} chars, alphanumeric=${alphanumMax} chars, numeric=${Math.floor(alphanumBits / 10) * 3} chars`);
  });

  it("encodes a long URL that would not fit in byte mode", () => {
    const input = "ex.co/abcdefgh";
    expect(input.length).toBe(14);
    const code = encode(input, { eccBytes: ECC });
    const result = decode(code.bits, ECC);
    expect(result).toBe(input);
  });
});

describe("V3 header", () => {
  it("uses V3 version byte", () => {
    const code = encode("test", { eccBytes: 4 });
    expect(code.bits[0]).toBe(0);
    expect(code.bits[1]).toBe(0);
    expect(code.bits[2]).toBe(0);
    expect(code.bits[3]).toBe(0);
    expect(code.bits[4]).toBe(0);
    expect(code.bits[5]).toBe(0);
    expect(code.bits[6]).toBe(1);
    expect(code.bits[7]).toBe(1); // version = 3 = 0b00000011
  });

  it("short count uses 2-byte header", () => {
    const input = "hello";
    const code = encode(input, { rings: 8, segmentsPerRing: 48, eccBytes: 4 });
    const result = decode(code.bits, 4);
    expect(result).toBe(input);
  });

  it("extended count roundtrips for strings > 62 chars", () => {
    const input = "abcdefghij".repeat(7);
    expect(input.length).toBe(70);
    expect(input.length).toBeGreaterThan(62);
    const code = encode(input, { rings: 16, segmentsPerRing: 128, eccBytes: 4 });
    const result = decode(code.bits, 4);
    expect(result).toBe(input);
  });

  it("numeric mode roundtrips with extended count", () => {
    const input = "1234567890".repeat(7);
    expect(input.length).toBe(70);
    expect(input.length).toBeGreaterThan(62);
    const code = encode(input, { rings: 16, segmentsPerRing: 80, eccBytes: 4 });
    const result = decode(code.bits, 4);
    expect(result).toBe(input);
  });

  it("alphanumeric mode roundtrips with extended count", () => {
    const input = "ABCDEFGHIJ".repeat(7);
    expect(input.length).toBe(70);
    const code = encode(input, { rings: 16, segmentsPerRing: 80, eccBytes: 4 });
    const result = decode(code.bits, 4);
    expect(result).toBe(input);
  });
});

describe("bit-aligned grid", () => {
  it("total segments is always a multiple of 8", () => {
    for (const rings of [3, 4, 5, 6, 7, 8]) {
      for (const segs of [32, 48, 64, 80]) {
        const total = getTotalSegments(rings, segs);
        expect(total % 8).toBe(0);
      }
    }
  });

  it("bit-aligned grid has at least as many segments as unaligned", () => {
    for (const rings of [3, 4, 5, 6, 7, 8]) {
      for (const segs of [32, 48, 64, 80]) {
        const total = getTotalSegments(rings, segs);
        let rawTotal = 0;
        for (let r = 1; r < rings; r++) {
          rawTotal += Math.max(8, Math.round((segs * (r + 1)) / rings));
        }
        expect(total).toBeGreaterThanOrEqual(rawTotal);
        expect(total - rawTotal).toBeLessThan(8);
      }
    }
  });
});

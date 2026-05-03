import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";

const ECC = 4;

describe("encode/decode", () => {
  it("roundtrip with short string", () => {
    const input = "hello";
    const code = encode(input, { eccBytes: ECC });
    const output = decode(code.bits, ECC);
    expect(output).toBe(input);
  });

  it("roundtrip with URL", () => {
    const input = "ex.co/test";
    const code = encode(input, { eccBytes: ECC });
    const output = decode(code.bits, ECC);
    expect(output).toBe(input);
  });

  it("roundtrip with custom options", () => {
    const input = "test";
    const code = encode(input, { rings: 5, segmentsPerRing: 48, eccBytes: ECC });
    const output = decode(code.bits, ECC);
    expect(output).toBe(input);
    expect(code.rings).toBe(5);
    expect(code.segmentsPerRing).toBe(48);
  });

  it("roundtrip with empty string", () => {
    const input = "";
    const code = encode(input, { eccBytes: ECC });
    const output = decode(code.bits, ECC);
    expect(output).toBe(input);
  });

  it("roundtrip with unicode", () => {
    const input = "hello";
    const code = encode(input, { eccBytes: ECC });
    const output = decode(code.bits, ECC);
    expect(output).toBe(input);
  });

  it("header contains version and length", () => {
    const input = "abc";
    const code = encode(input, { eccBytes: ECC });
    expect(code.bits.length).toBeGreaterThan(0);
    expect(code.bits.length % 8).toBe(0);
  });

  it("throws when data exceeds grid capacity", () => {
    expect(() => encode("this string is way too long for the grid", { eccBytes: 4 })).toThrow("Data too large");
  });
});

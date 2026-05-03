import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";

describe("e2e", () => {
  const ECC = 4;

  it("encode and decode a URL", () => {
    const input = "ex.co/test";
    const code = encode(input, { eccBytes: ECC });
    const out = decode(code.bits, ECC);
    expect(out).toBe(input);
  });

  it("encode and decode multiple strings", () => {
    const inputs = ["hello", "test1234", "12345678"];

    for (const input of inputs) {
      const code = encode(input, { eccBytes: ECC });
      const out = decode(code.bits, ECC);
      expect(out).toBe(input);
    }
  });
});

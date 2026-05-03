import { describe, it, expect } from "vitest";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { DEFAULT_ECC_BYTES } from "@/constants";

describe("e2e", () => {
  const ECC = DEFAULT_ECC_BYTES;

  it("encode and decode a URL", () => {
    const input = "ex.co/t";
    const code = encode(input, { eccBytes: ECC });
    const out = decode(code.bits, ECC);
    expect(out).toBe(input);
  });

  it("encode and decode multiple strings", () => {
    const inputs = ["hello", "test123", "12345678"];

    for (const input of inputs) {
      const code = encode(input, { eccBytes: ECC });
      const out = decode(code.bits, ECC);
      expect(out).toBe(input);
    }
  });
});

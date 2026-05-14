import { describe, it, expect } from "vitest";
import { encode } from "../src/core/encoder";
import { decode } from "../src/core/decoder";
describe("encode/decode", () => {
    it("roundtrip", () => {
        const input = "hello world";
        const code = encode(input);
        const output = decode(code.bits);
        expect(output).toBe(input);
    });
});

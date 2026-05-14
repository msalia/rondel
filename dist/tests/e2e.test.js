import { encode } from "../src/core/encoder";
import { decode } from "../src/core/decoder";
it("e2e", () => {
    const input = "https://example.com";
    const code = encode(input);
    const out = decode(code.bits);
    expect(out).toBe(input);
});

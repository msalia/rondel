import { bitsToBytes } from "@/core/bitstream";
import { DEFAULT_ECC_BYTES } from "@/constants";
import { Mode, unpackAlphanumeric, unpackNumeric } from "@/core/modes";
import { rsDecode } from "@/ecc/reedSolomon";

/** Decodes a bit array back into a string using Reed-Solomon error correction.
 *  Supports both v1 (byte-only) and v2 (numeric/alphanumeric/byte) formats. */
export function decode(bits: number[], eccBytes = DEFAULT_ECC_BYTES): string {
  const bytes = bitsToBytes(bits);
  const decoded = rsDecode(bytes, eccBytes);

  if (decoded.length < 2) {
    throw new Error("Decoded data too short for header");
  }

  const version = decoded[0];

  if (version === 1) {
    const length = decoded[1];
    if (2 + length > decoded.length) {
      throw new Error(`Invalid payload length: ${length}`);
    }
    return new TextDecoder().decode(decoded.slice(2, 2 + length));
  }

  if (version === 2) {
    const modeByte = decoded[1];
    const modeField = (modeByte >> 6) & 0x3;
    const charCount = modeByte & 0x3f;
    const data = decoded.slice(2);

    if (modeField === Mode.NUMERIC) {
      return unpackNumeric(data, charCount);
    }
    if (modeField === Mode.ALPHANUMERIC || modeField === 3) {
      const text = unpackAlphanumeric(data, charCount);
      return modeField === 3 ? text.toLowerCase() : text;
    }
    // Mode.BYTE
    if (charCount > data.length) {
      throw new Error(`Invalid payload length: ${charCount}`);
    }
    return new TextDecoder().decode(data.slice(0, charCount));
  }

  throw new Error(`Unsupported version: ${version}`);
}

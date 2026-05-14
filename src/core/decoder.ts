import { DEFAULT_ECC_BYTES } from "@/constants";
import { bitsToBytes } from "@/core/bitstream";
import { Mode, unpackAlphanumeric, unpackNumeric } from "@/core/modes";
import { rsDecode } from "@/ecc/reedSolomon";

/** Decodes a bit array back into a string using Reed-Solomon error correction. */
export function decode(bits: number[], eccBytes = DEFAULT_ECC_BYTES): string {
  const bytes = bitsToBytes(bits);
  const decoded = rsDecode(bytes, eccBytes);

  if (decoded.length < 2) {
    throw new Error("Decoded data too short for header");
  }

  const version = decoded[0];
  if (version !== 3) {
    throw new Error(`Unsupported version: ${version}. Only V3 is supported.`);
  }

  const modeByte = decoded[1];
  const modeField = (modeByte >> 6) & 0x3;
  const countField = modeByte & 0x3f;

  let charCount: number;
  let data: Uint8Array;

  if (countField === 0x3f) {
    if (decoded.length < 3) {
      throw new Error("Decoded data too short for extended header");
    }
    charCount = decoded[2];
    data = decoded.slice(3);
  } else {
    charCount = countField;
    data = decoded.slice(2);
  }

  if (modeField === Mode.NUMERIC) {
    return unpackNumeric(data, charCount);
  }
  if (modeField === Mode.ALPHANUMERIC || modeField === 3) {
    const text = unpackAlphanumeric(data, charCount);
    return modeField === 3 ? text.toLowerCase() : text;
  }
  if (charCount > data.length) {
    throw new Error(`Invalid payload length: ${charCount}`);
  }
  return new TextDecoder().decode(data.slice(0, charCount));
}

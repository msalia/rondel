import type { CircularCodeOptions, EncodedCode } from "@/types";

import { DEFAULT_ECC_BYTES, DEFAULT_RINGS, DEFAULT_SEGMENTS_PER_RING } from "@/constants";
import { bytesToBits } from "@/core/bitstream";
import { getTotalSegments } from "@/core/layout";
import {
  detectMode,
  isAllLowercase,
  Mode,
  packAlphanumeric,
  packedByteCount,
  packNumeric,
} from "@/core/modes";
import { rsEncode } from "@/ecc/reedSolomon";

/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte). */
export function encode(input: string, opts: CircularCodeOptions = {}): EncodedCode {
  const {
    rings = DEFAULT_RINGS,
    segmentsPerRing = DEFAULT_SEGMENTS_PER_RING,
    eccBytes = DEFAULT_ECC_BYTES,
  } = opts;

  const mode = detectMode(input);
  let packedData: Uint8Array;

  if (mode === Mode.NUMERIC) {
    packedData = packNumeric(input);
  } else if (mode === Mode.ALPHANUMERIC) {
    packedData = packAlphanumeric(input);
  } else {
    packedData = new TextEncoder().encode(input);
  }

  // Version 2 header: [version, (modeField << 6) | count]
  // modeField: 0=numeric, 1=alphanumeric, 2=byte, 3=alphanumeric+lowercase
  // count: char count for numeric/alphanumeric, byte count for byte mode
  let modeField: number = mode;
  if (mode === Mode.ALPHANUMERIC && isAllLowercase(input)) {
    modeField = 3;
  }
  const count = mode === Mode.BYTE ? packedData.length : input.length;
  const header = new Uint8Array([2, (modeField << 6) | (count & 0x3f)]);
  const payload = new Uint8Array(header.length + packedData.length);
  payload.set(header);
  payload.set(packedData, header.length);

  const encoded = rsEncode(payload, eccBytes);
  const bits = bytesToBits(encoded);

  const capacity = getTotalSegments(rings, segmentsPerRing);
  if (bits.length > capacity) {
    const availBytes = Math.floor(capacity / 8) - eccBytes - 2;
    const maxChars = mode === Mode.BYTE ? availBytes : estimateMaxChars(availBytes, mode);
    throw new Error(
      `Data too large: ${bits.length} bits, grid holds ${capacity}. Max ~${Math.max(0, maxChars)} chars (${modeName(mode)} mode) with ${eccBytes} ECC bytes.`,
    );
  }

  return { bits, rings, segmentsPerRing };
}

function estimateMaxChars(availBytes: number, mode: number): number {
  const availBits = availBytes * 8;
  if (mode === Mode.NUMERIC)
    return Math.floor(availBits / 10) * 3 + (availBits % 10 >= 7 ? 2 : availBits % 10 >= 4 ? 1 : 0);
  if (mode === Mode.ALPHANUMERIC)
    return Math.floor(availBits / 11) * 2 + (availBits % 11 >= 6 ? 1 : 0);
  return availBytes;
}

function modeName(mode: number): string {
  return mode === Mode.NUMERIC ? "numeric" : mode === Mode.ALPHANUMERIC ? "alphanumeric" : "byte";
}

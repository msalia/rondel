import type { CircularCodeOptions, EncodedCode } from "@/types";

import { DEFAULT_ECC_BYTES, DEFAULT_SEGMENTS_PER_RING } from "@/constants";
import { autoSize } from "@/core/autoSize";
import { bytesToBits } from "@/core/bitstream";
import { getTotalSegments } from "@/core/layout";
import { detectMode, isAllLowercase, Mode, packAlphanumeric, packNumeric } from "@/core/modes";
import { rsEncode } from "@/ecc/reedSolomon";

/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte).
 *  When rings/segments/eccBytes are omitted, auto-selects the smallest grid with
 *  optimal error correction that fits the input. */
export function encode(input: string, opts: CircularCodeOptions = {}): EncodedCode {
  let rings: number;
  let segmentsPerRing: number;
  let eccBytes: number;

  if (opts.rings != null && opts.segmentsPerRing != null && opts.eccBytes != null) {
    rings = opts.rings;
    segmentsPerRing = opts.segmentsPerRing;
    eccBytes = opts.eccBytes;
  } else if (opts.rings != null) {
    rings = opts.rings;
    segmentsPerRing = opts.segmentsPerRing ?? DEFAULT_SEGMENTS_PER_RING;
    eccBytes = opts.eccBytes ?? DEFAULT_ECC_BYTES;
  } else {
    const sized = autoSize(input, {
      segmentsPerRing: opts.segmentsPerRing,
      eccBytes: opts.eccBytes,
    });
    if (!sized) {
      throw new Error(
        `Input too large for any supported grid (max 16 rings). Try fewer ECC bytes or more segments.`,
      );
    }
    rings = sized.rings;
    segmentsPerRing = sized.segmentsPerRing;
    eccBytes = sized.eccBytes;
  }

  const mode = detectMode(input);
  let packedData: Uint8Array;

  if (mode === Mode.NUMERIC) {
    packedData = packNumeric(input);
  } else if (mode === Mode.ALPHANUMERIC) {
    packedData = packAlphanumeric(input);
  } else {
    packedData = new TextEncoder().encode(input);
  }

  let modeField: number = mode;
  if (mode === Mode.ALPHANUMERIC && isAllLowercase(input)) {
    modeField = 3;
  }
  const count = mode === Mode.BYTE ? packedData.length : input.length;

  // V3 header: [version=3, (modeField<<6)|countLow, optional extendedCount]
  // count <= 62: 2-byte header (countLow = count)
  // count > 62:  3-byte header (countLow = 0x3F sentinel, byte 2 = actual count)
  let header: Uint8Array;
  if (count <= 62) {
    header = new Uint8Array([3, (modeField << 6) | count]);
  } else {
    if (count > 255) {
      throw new Error(`Count too large: ${count}. Maximum is 255.`);
    }
    header = new Uint8Array([3, (modeField << 6) | 0x3f, count]);
  }

  const payload = new Uint8Array(header.length + packedData.length);
  payload.set(header);
  payload.set(packedData, header.length);

  const encoded = rsEncode(payload, eccBytes);
  const bits = bytesToBits(encoded);

  const capacity = getTotalSegments(rings, segmentsPerRing);
  if (bits.length > capacity) {
    const headerBytes = header.length;
    const availBytes = Math.floor(capacity / 8) - eccBytes - headerBytes;
    const maxChars = mode === Mode.BYTE ? availBytes : estimateMaxChars(availBytes, mode);
    throw new Error(
      `Data too large: ${bits.length} bits, grid holds ${capacity}. Max ~${Math.max(0, maxChars)} chars (${modeName(mode)} mode) with ${eccBytes} ECC bytes.`,
    );
  }

  return { bits, rings, segmentsPerRing, eccBytes };
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

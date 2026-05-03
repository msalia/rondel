import type { CircularCodeOptions, EncodedCode } from "@/types";

import { bytesToBits } from "@/core/bitstream";
import { DEFAULT_ECC_BYTES, DEFAULT_RINGS, DEFAULT_SEGMENTS_PER_RING } from "@/constants";
import { getTotalSegments } from "@/core/layout";
import { rsEncode } from "@/ecc/reedSolomon";

/** Encodes a string into a circular code with Reed-Solomon error correction. */
export function encode(input: string, opts: CircularCodeOptions = {}): EncodedCode {
  const { rings = DEFAULT_RINGS, segmentsPerRing = DEFAULT_SEGMENTS_PER_RING, eccBytes = DEFAULT_ECC_BYTES } = opts;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const header = new Uint8Array([1, data.length]);
  const payload = new Uint8Array([...header, ...data]);
  const encoded = rsEncode(payload, eccBytes);
  const bits = bytesToBits(encoded);

  const capacity = getTotalSegments(rings, segmentsPerRing);
  if (bits.length > capacity) {
    const maxDataBytes = Math.floor(capacity / 8) - eccBytes - 2;
    throw new Error(
      `Data too large: ${bits.length} bits, grid holds ${capacity}. Max ~${Math.max(0, maxDataBytes)} data bytes with ${eccBytes} ECC bytes.`,
    );
  }

  return {
    bits,
    rings,
    segmentsPerRing,
  };
}

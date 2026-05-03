import type { CircularCodeOptions, EncodedCode } from "@/types";

import { bytesToBits } from "@/core/bitstream";
import { getTotalSegments } from "@/core/layout";
import { rsEncode } from "@/ecc/reedSolomon";

/** Encodes a string into a circular code with Reed-Solomon error correction. */
export function encode(input: string, opts: CircularCodeOptions = {}): EncodedCode {
  const { rings = 5, segmentsPerRing = 48, eccBytes = 16 } = opts;
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

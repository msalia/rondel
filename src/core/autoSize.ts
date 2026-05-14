import {
  AUTO_MAX_ECC,
  AUTO_MAX_RINGS,
  AUTO_MIN_ECC,
  AUTO_MIN_RINGS,
  AUTO_SEGMENT_CANDIDATES,
} from "@/constants";
import { getTotalSegments } from "@/core/layout";
import { detectMode, Mode, packedByteCount } from "@/core/modes";

export type AutoSizeResult = {
  rings: number;
  segmentsPerRing: number;
  eccBytes: number;
  capacityBits: number;
  usedBits: number;
};

/** Computes the packed data size in bytes (header + mode-packed payload, no ECC). */
export function computeDataBytes(input: string): number {
  const mode = detectMode(input);
  const count = mode === Mode.BYTE ? new TextEncoder().encode(input).length : input.length;
  const headerBytes = count <= 62 ? 2 : 3;
  const dataBytes = packedByteCount(mode === Mode.BYTE ? count : input.length, mode);
  return headerBytes + dataBytes;
}

/** Computes the total bits needed to encode a string (header + packed data + ECC). */
export function computeNeededBits(input: string, eccBytes: number): number {
  return (computeDataBytes(input) + eccBytes) * 8;
}

/** Returns the minimum number of rings needed to hold the given number of bits
 *  within the given range. */
export function minRingsForBits(
  neededBits: number,
  segmentsPerRing: number,
  minRings = AUTO_MIN_RINGS,
  maxRings = AUTO_MAX_RINGS,
): number | null {
  for (let rings = minRings; rings <= maxRings; rings++) {
    if (getTotalSegments(rings, segmentsPerRing) >= neededBits) {
      return rings;
    }
  }
  return null;
}

/** Auto-selects the smallest grid configuration that fits the input.
 *
 *  Aesthetic constraints: rings [4,8], segments [32,48], ECC [2,8].
 *  Picks the fewest rings, then fills remaining capacity with ECC.
 *
 *  Any parameter can be pinned by passing it explicitly. */
export function autoSize(
  input: string,
  opts: {
    segmentsPerRing?: number;
    eccBytes?: number;
  } = {},
): AutoSizeResult | null {
  const dataBytes = computeDataBytes(input);

  if (opts.segmentsPerRing != null && opts.eccBytes != null) {
    return autoSizeFixed(dataBytes, opts.segmentsPerRing, opts.eccBytes);
  }

  if (opts.segmentsPerRing != null) {
    return autoSizeWithSegments(dataBytes, opts.segmentsPerRing);
  }

  if (opts.eccBytes != null) {
    return autoSizeWithEcc(dataBytes, opts.eccBytes);
  }

  return autoSizeFull(dataBytes);
}

function autoSizeFixed(
  dataBytes: number,
  segmentsPerRing: number,
  eccBytes: number,
): AutoSizeResult | null {
  const neededBits = (dataBytes + eccBytes) * 8;
  const rings = minRingsForBits(neededBits, segmentsPerRing);
  if (rings === null) return null;
  const capacityBits = getTotalSegments(rings, segmentsPerRing);
  return { rings, segmentsPerRing, eccBytes, capacityBits, usedBits: neededBits };
}

function autoSizeWithSegments(dataBytes: number, segmentsPerRing: number): AutoSizeResult | null {
  const neededBits = (dataBytes + AUTO_MIN_ECC) * 8;
  const rings = minRingsForBits(neededBits, segmentsPerRing);
  if (rings === null) return null;
  const eccBytes = fillEcc(dataBytes, rings, segmentsPerRing);
  const usedBits = (dataBytes + eccBytes) * 8;
  return {
    rings,
    segmentsPerRing,
    eccBytes,
    capacityBits: getTotalSegments(rings, segmentsPerRing),
    usedBits,
  };
}

function autoSizeWithEcc(dataBytes: number, eccBytes: number): AutoSizeResult | null {
  let best: AutoSizeResult | null = null;
  for (const segs of AUTO_SEGMENT_CANDIDATES) {
    const neededBits = (dataBytes + eccBytes) * 8;
    const rings = minRingsForBits(neededBits, segs);
    if (rings === null) continue;
    if (!best || rings < best.rings) {
      best = {
        rings,
        segmentsPerRing: segs,
        eccBytes,
        capacityBits: getTotalSegments(rings, segs),
        usedBits: neededBits,
      };
    }
  }
  return best;
}

function autoSizeFull(dataBytes: number): AutoSizeResult | null {
  let best: AutoSizeResult | null = null;

  for (const segs of AUTO_SEGMENT_CANDIDATES) {
    const minBits = (dataBytes + AUTO_MIN_ECC) * 8;
    const rings = minRingsForBits(minBits, segs);
    if (rings === null) continue;

    const eccBytes = fillEcc(dataBytes, rings, segs);
    const usedBits = (dataBytes + eccBytes) * 8;

    if (!best || rings < best.rings || (rings === best.rings && eccBytes > best.eccBytes)) {
      best = {
        rings,
        segmentsPerRing: segs,
        eccBytes,
        capacityBits: getTotalSegments(rings, segs),
        usedBits,
      };
    }
  }

  return best;
}

function fillEcc(dataBytes: number, rings: number, segmentsPerRing: number): number {
  const totalBytes = Math.floor(getTotalSegments(rings, segmentsPerRing) / 8);
  const spare = totalBytes - dataBytes;
  return Math.min(Math.max(spare, AUTO_MIN_ECC), AUTO_MAX_ECC);
}

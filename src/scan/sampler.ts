import type { ImageBuffer } from "@/types";

import {
  getExactRingRadius,
  getRingWidth,
  getSegmentsForRing,
  isDataRing,
} from "@/core/layout";

function pixelBrightness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return -1;
  const idx = (iy * width + ix) * 4;
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
}

/** Samples bits from a rectified circular code image using polar coordinates.
 *  Uses multi-point sampling per segment with per-ring adaptive thresholding. */
export function samplePolarGrid(
  frame: ImageBuffer,
  cx: number,
  cy: number,
  codeSize: number,
  rings = 5,
  segmentsPerRing = 48,
  orientationOffset = 0,
  inverted = false,
): number[] {
  const { data, width, height } = frame;
  const ringWidth = getRingWidth(rings, codeSize);
  const bits: number[] = [];

  for (let r = 0; r < rings; r++) {
    if (!isDataRing(r)) continue;
    const segs = getSegmentsForRing(r, rings, segmentsPerRing);
    const segAngle = (2 * Math.PI) / segs;
    const centerRadius = getExactRingRadius(r, rings, codeSize, segmentsPerRing);
    const innerRadius = centerRadius - ringWidth * 0.1;
    const outerRadius = centerRadius + ringWidth * 0.1;

    const ringBrightness: number[] = [];

    for (let segment = 0; segment < segs; segment++) {
      const segCenter = getSegmentAngle(segment, segs) + segAngle * 0.35 + orientationOffset;

      let sum = 0;
      let count = 0;
      for (const aOff of [-segAngle * 0.1, 0, segAngle * 0.1]) {
        const angle = segCenter + aOff;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        for (const sr of [innerRadius, centerRadius, outerRadius]) {
          const b = pixelBrightness(data, width, height, cx + sr * cosA, cy + sr * sinA);
          if (b >= 0) {
            sum += b;
            count++;
          }
        }
      }

      const avg = count > 0 ? sum / count : 128;
      ringBrightness.push(avg);
    }

    const sorted = Float64Array.from(ringBrightness).sort();
    const lo = sorted[Math.floor(sorted.length * 0.25)];
    const hi = sorted[Math.floor(sorted.length * 0.75)];
    const threshold = hi - lo < 30 ? 128 : (lo + hi) / 2;

    for (let segment = 0; segment < segs; segment++) {
      const dark = ringBrightness[segment] < threshold;
      bits.push((dark !== inverted) ? 1 : 0);
    }
  }

  return bits;
}

function getSegmentAngle(segment: number, segmentsInRing: number): number {
  return (segment / segmentsInRing) * Math.PI * 2;
}

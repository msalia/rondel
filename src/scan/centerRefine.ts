import type { ImageBuffer } from "@/types";

import { getRingWidth } from "@/core/layout";
import { toGrayscale } from "@/utils/image";

/** Refines the center position of a rectified code by locating the center dot centroid. */
export function refineCenterFromDot(
  buf: ImageBuffer,
  rings: number,
  size: number,
): { cx: number; cy: number } {
  const { data, width, height } = buf;
  const gray = toGrayscale(data, width * height);
  const expectedCx = width / 2;
  const expectedCy = height / 2;
  const ringWidth = getRingWidth(rings, size);
  const dotRadius = ringWidth * 0.75;
  const searchRadius = Math.ceil(ringWidth * 2);

  let innerSum = 0, innerN = 0;
  let outerSum = 0, outerN = 0;

  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > searchRadius) continue;
      const x = Math.round(expectedCx + dx);
      const y = Math.round(expectedCy + dy);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const val = gray[y * width + x];
      if (dist <= dotRadius * 0.8) {
        innerSum += val;
        innerN++;
      } else if (dist >= dotRadius * 1.3) {
        outerSum += val;
        outerN++;
      }
    }
  }

  if (innerN === 0 || outerN === 0) {
    return { cx: expectedCx, cy: expectedCy };
  }

  const innerAvg = innerSum / innerN;
  const outerAvg = outerSum / outerN;

  if (Math.abs(innerAvg - outerAvg) < 30) {
    return { cx: expectedCx, cy: expectedCy };
  }

  const dotIsDark = innerAvg < outerAvg;
  const threshold = (innerAvg + outerAvg) / 2;

  let sumX = 0, sumY = 0, weight = 0;
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      if (dx * dx + dy * dy > searchRadius * searchRadius) continue;
      const x = Math.round(expectedCx + dx);
      const y = Math.round(expectedCy + dy);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const val = gray[y * width + x];
      const isDot = dotIsDark ? val < threshold : val > threshold;
      if (isDot) {
        const w = Math.abs(val - threshold);
        sumX += x * w;
        sumY += y * w;
        weight += w;
      }
    }
  }

  if (weight < 1) {
    return { cx: expectedCx, cy: expectedCy };
  }

  return { cx: sumX / weight, cy: sumY / weight };
}

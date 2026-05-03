import type { ImageBuffer, ValidationResult } from "@/types";

import { getExactRingRadius, getRingWidth } from "@/core/layout";
import { sampleGray, toGrayscale } from "@/utils/image";

export type { ValidationResult };

/** Validates whether a rectified image looks like a circular code. */
export function validateCircularCode(
  buf: ImageBuffer,
  rings: number,
  size: number,
  threshold = 0.5,
  segmentsPerRing = 48,
  precomputedGray?: Uint8Array,
): ValidationResult {
  const { data, width, height } = buf;
  const gray = precomputedGray ?? toGrayscale(data, width * height);
  const cx = width / 2;
  const cy = height / 2;

  const centerDot = checkCenterDot(gray, width, cx, cy, rings, size);
  const ringContrast = checkRingContrast(gray, width, cx, cy, rings, size);
  const segmentPattern = checkSegmentPattern(gray, width, cx, cy, rings, size, segmentsPerRing);

  const score = (centerDot ? 0.35 : 0) + (ringContrast ? 0.35 : 0) + (segmentPattern ? 0.3 : 0);

  return {
    valid: score >= threshold,
    centerDot,
    ringContrast,
    segmentPattern,
    score,
  };
}

function checkCenterDot(
  gray: Uint8Array,
  width: number,
  cx: number,
  cy: number,
  rings: number,
  size: number,
): boolean {
  const dotRadius = getRingWidth(rings, size) * 0.65;
  const sampleRadius = dotRadius * 0.5;

  let centerSum = 0;
  let centerCount = 0;
  for (let dy = -sampleRadius; dy <= sampleRadius; dy += 2) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx += 2) {
      if (dx * dx + dy * dy > sampleRadius * sampleRadius) continue;
      centerSum += sampleGray(gray, width, cx + dx, cy + dy);
      centerCount++;
    }
  }
  const centerBrightness = centerCount > 0 ? centerSum / centerCount : 128;

  let bgSum = 0;
  let bgCount = 0;
  const bgRadius = size * 0.45;
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const x = cx + bgRadius * Math.cos(angle);
    const y = cy + bgRadius * Math.sin(angle);
    bgSum += sampleGray(gray, width, x, y);
    bgCount++;
  }
  const bgBrightness = bgCount > 0 ? bgSum / bgCount : 200;

  return Math.abs(centerBrightness - bgBrightness) > 30;
}

function checkRingContrast(
  gray: Uint8Array,
  width: number,
  cx: number,
  cy: number,
  rings: number,
  size: number,
): boolean {
  const numAngles = 16;
  const ringWidth = getRingWidth(rings, size);
  let transitions = 0;

  for (let a = 0; a < numAngles; a++) {
    const angle = (a / numAngles) * Math.PI * 2;
    let prevBright = 128;
    let transitionsOnRay = 0;

    for (let r = 0; r < rings + 3; r++) {
      const radius = (r + 0.5) * ringWidth;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const bright = sampleGray(gray, width, x, y);
      if (Math.abs(bright - prevBright) > 40) transitionsOnRay++;
      prevBright = bright;
    }

    if (transitionsOnRay >= 2) transitions++;
  }

  return transitions >= numAngles * 0.4;
}

function checkSegmentPattern(
  gray: Uint8Array,
  width: number,
  cx: number,
  cy: number,
  rings: number,
  size: number,
  segmentsPerRing: number,
): boolean {
  let ringsWithGaps = 0;

  for (let r = 1; r < rings; r++) {
    const radius = getExactRingRadius(r, rings, size, segmentsPerRing);
    const numSamples = 32;
    const samples: number[] = [];

    for (let s = 0; s < numSamples; s++) {
      const angle = (s / numSamples) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      samples.push(sampleGray(gray, width, x, y));
    }

    let darkRuns = 0;
    let lightRuns = 0;
    const median = [...samples].sort((a, b) => a - b)[numSamples >> 1];

    let inDark = samples[0] < median;
    for (let s = 1; s < numSamples; s++) {
      const nowDark = samples[s] < median;
      if (nowDark && !inDark) darkRuns++;
      if (!nowDark && inDark) lightRuns++;
      inDark = nowDark;
    }

    if (darkRuns >= 2 && lightRuns >= 2) ringsWithGaps++;
  }

  return ringsWithGaps >= Math.max(1, (rings - 1) * 0.4);
}

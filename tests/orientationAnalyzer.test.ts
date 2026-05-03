import { describe, it, expect } from "vitest";
import { analyzeOrientation } from "@/scan/orientationAnalyzer";
import { DEFAULT_CODE_SIZE, DEFAULT_RINGS, DEFAULT_SEGMENTS_PER_RING } from "@/constants";
import { getOrientationArcs, getOrientationRingRadius, getRingWidth } from "@/core/layout";
import { makeWhiteBuffer, makeBlackBuffer } from "./helpers";
import type { ImageBuffer } from "@/types";

const BASE_SEGMENTS = DEFAULT_SEGMENTS_PER_RING;

function drawOrientationRing(
  buf: ImageBuffer,
  rings: number,
  size: number,
  rotationOffset = 0,
  opts: { reflected?: boolean; inverted?: boolean } = {},
): void {
  const cx = size / 2;
  const cy = size / 2;
  const radius = getOrientationRingRadius(rings, size);
  const arcs = getOrientationArcs(rings, size, BASE_SEGMENTS);
  const strokeHalf = getRingWidth(rings, size) * 0.4;
  const orderedArcs = opts.reflected ? [...arcs].reverse() : arcs;
  const color = opts.inverted ? 255 : 0;

  for (const arc of orderedArcs) {
    const start = arc.start + rotationOffset;
    const end = arc.end + rotationOffset;
    for (let y = 0; y < buf.height; y++) {
      for (let x = 0; x < buf.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - radius) > strokeHalf) continue;
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += Math.PI * 2;
        let s = start % (Math.PI * 2);
        let e = end % (Math.PI * 2);
        if (s < 0) s += Math.PI * 2;
        if (e < 0) e += Math.PI * 2;
        const inArc = s < e
          ? angle >= s && angle <= e
          : angle >= s || angle <= e;
        if (inArc) {
          const idx = (y * buf.width + x) * 4;
          buf.data[idx] = color;
          buf.data[idx + 1] = color;
          buf.data[idx + 2] = color;
        }
      }
    }
  }
}

describe("analyzeOrientation", () => {
  const rings = DEFAULT_RINGS;
  const size = DEFAULT_CODE_SIZE;

  it("returns OrientationAnalysis shape", () => {
    const buf = makeWhiteBuffer(size);
    const result = analyzeOrientation(buf, rings, size);
    expect(result).toHaveProperty("angle");
    expect(result).toHaveProperty("reflected");
    expect(result).toHaveProperty("confidence");
    expect(typeof result.angle).toBe("number");
    expect(typeof result.reflected).toBe("boolean");
  });

  it("detects orientation of a drawn ring at angle 0", () => {
    const buf = makeWhiteBuffer(size);
    drawOrientationRing(buf, rings, size, 0);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.angle).toBeCloseTo(0, 0);
    expect(result.reflected).toBe(false);
  });

  it("detects orientation of a ring rotated by PI/2", () => {
    const buf = makeWhiteBuffer(size);
    drawOrientationRing(buf, rings, size, Math.PI / 2);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 0);
  });

  it("has low confidence on a blank image", () => {
    const buf = makeWhiteBuffer(size);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it("has low confidence on a uniform dark image", () => {
    const buf = makeBlackBuffer(size);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it("angle is between 0 and 2*PI", () => {
    const buf = makeWhiteBuffer(size);
    drawOrientationRing(buf, rings, size, 1.5);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.angle).toBeGreaterThanOrEqual(0);
    expect(result.angle).toBeLessThan(2 * Math.PI);
  });

  it("works with 3 rings", () => {
    const buf = makeWhiteBuffer(300);
    drawOrientationRing(buf, 3, 300, 0);
    const result = analyzeOrientation(buf, 3, 300);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("works with 6 rings", () => {
    const buf = makeWhiteBuffer(300);
    drawOrientationRing(buf, 6, 300, 0);
    const result = analyzeOrientation(buf, 6, 300);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("detects inverted code (light arcs on dark background)", () => {
    const buf = makeBlackBuffer(size);
    drawOrientationRing(buf, rings, size, 0, { inverted: true });
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.inverted).toBe(true);
    expect(result.angle).toBeCloseTo(0, 0);
  });

  it("detects inverted code rotated by PI/2", () => {
    const buf = makeBlackBuffer(size);
    drawOrientationRing(buf, rings, size, Math.PI / 2, { inverted: true });
    const result = analyzeOrientation(buf, rings, size);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.inverted).toBe(true);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 0);
  });

  it("normal code is not inverted", () => {
    const buf = makeWhiteBuffer(size);
    drawOrientationRing(buf, rings, size, 0);
    const result = analyzeOrientation(buf, rings, size);
    expect(result.inverted).toBe(false);
  });
});

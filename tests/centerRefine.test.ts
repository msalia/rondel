import { describe, it, expect } from "vitest";
import { refineCenterFromDot } from "@/scan/centerRefine";
import { DEFAULT_CODE_SIZE, DEFAULT_RINGS } from "@/constants";
import { getRingWidth } from "@/core/layout";
import { makeWhiteBuffer, makeBlackBuffer, fillCircle } from "./helpers";

function drawCenterDot(
  buf: ReturnType<typeof makeWhiteBuffer>,
  rings: number,
  size: number,
  dotCx: number,
  dotCy: number,
  inverted = false,
) {
  const ringWidth = getRingWidth(rings, size);
  const dotRadius = ringWidth * 0.75;
  const dotColor = inverted ? 255 : 0;
  fillCircle(buf, dotCx, dotCy, dotRadius, dotColor, dotColor, dotColor);
}

describe("refineCenterFromDot", () => {
  const rings = DEFAULT_RINGS;
  const size = DEFAULT_CODE_SIZE;

  it("returns image center when dot is perfectly centered", () => {
    const buf = makeWhiteBuffer(size);
    drawCenterDot(buf, rings, size, size / 2, size / 2);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2, 0);
    expect(result.cy).toBeCloseTo(size / 2, 0);
  });

  it("detects center dot shifted right by 5px", () => {
    const buf = makeWhiteBuffer(size);
    drawCenterDot(buf, rings, size, size / 2 + 5, size / 2);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2 + 5, 1);
    expect(result.cy).toBeCloseTo(size / 2, 1);
  });

  it("detects center dot shifted left by 6px", () => {
    const buf = makeWhiteBuffer(size);
    drawCenterDot(buf, rings, size, size / 2 - 6, size / 2);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2 - 6, 1);
    expect(result.cy).toBeCloseTo(size / 2, 1);
  });

  it("detects center dot shifted down by 7px", () => {
    const buf = makeWhiteBuffer(size);
    drawCenterDot(buf, rings, size, size / 2, size / 2 + 7);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2, 1);
    expect(result.cy).toBeCloseTo(size / 2 + 7, 1);
  });

  it("detects center dot shifted diagonally by (4, -5)", () => {
    const buf = makeWhiteBuffer(size);
    drawCenterDot(buf, rings, size, size / 2 + 4, size / 2 - 5);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2 + 4, 1);
    expect(result.cy).toBeCloseTo(size / 2 - 5, 1);
  });

  it("works with inverted code (bright dot on dark background)", () => {
    const buf = makeBlackBuffer(size);
    drawCenterDot(buf, rings, size, size / 2 + 4, size / 2 - 3, true);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2 + 4, 1);
    expect(result.cy).toBeCloseTo(size / 2 - 3, 1);
  });

  it("falls back to image center on blank white image", () => {
    const buf = makeWhiteBuffer(size);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2, 0);
    expect(result.cy).toBeCloseTo(size / 2, 0);
  });

  it("falls back to image center on blank black image", () => {
    const buf = makeBlackBuffer(size);
    const result = refineCenterFromDot(buf, rings, size);
    expect(result.cx).toBeCloseTo(size / 2, 0);
    expect(result.cy).toBeCloseTo(size / 2, 0);
  });

  it("works with 3 rings", () => {
    const buf = makeWhiteBuffer(300);
    drawCenterDot(buf, 3, 300, 150 + 5, 150);
    const result = refineCenterFromDot(buf, 3, 300);
    expect(result.cx).toBeCloseTo(150 + 5, 1);
  });

  it("works with 6 rings", () => {
    const buf = makeWhiteBuffer(300);
    drawCenterDot(buf, 6, 300, 150 - 4, 150 + 3);
    const result = refineCenterFromDot(buf, 6, 300);
    expect(result.cx).toBeCloseTo(150 - 4, 1);
    expect(result.cy).toBeCloseTo(150 + 3, 1);
  });

  it("handles random offsets accurately", () => {
    const offsets = [
      { dx: 3, dy: -5 },
      { dx: -6, dy: 2 },
      { dx: 5, dy: 5 },
      { dx: -4, dy: -6 },
      { dx: 0, dy: 7 },
    ];

    for (const { dx, dy } of offsets) {
      const buf = makeWhiteBuffer(size);
      drawCenterDot(buf, rings, size, size / 2 + dx, size / 2 + dy);
      const result = refineCenterFromDot(buf, rings, size);
      expect(result.cx).toBeCloseTo(size / 2 + dx, 0);
      expect(result.cy).toBeCloseTo(size / 2 + dy, 0);
    }
  });
});

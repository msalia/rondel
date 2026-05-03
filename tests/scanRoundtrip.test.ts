import { describe, it, expect } from "vitest";
import { createCanvas, loadImage } from "canvas";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { renderSVG } from "@/render/svgRenderer";
import { getTotalSegments } from "@/core/layout";
import { samplePolarGrid } from "@/scan/sampler";
import { scanFrame } from "@/scan";
import { warpPerspective, estimateCircleCorners } from "@/scan/perspective";
import type { ImageBuffer } from "@/types";

type ColorScheme = {
  primary: string;
  secondary: string;
  background: string;
  inverted: boolean;
};

/**
 * Simulates the browser's scanFromImage flow:
 *   renderSVG → rasterize → pad onto capture canvas → warp → sample → decode
 */
async function scanFromRenderedSVG(
  input: string,
  rings: number,
  segmentsPerRing: number,
  eccBytes: number,
  colors: ColorScheme,
): Promise<{ decoded: string; bits: number[]; expected: number[] }> {
  const code = encode(input, { rings, segmentsPerRing, eccBytes });

  const svgSize = 400;
  const svg = renderSVG(code, { size: svgSize, primary: colors.primary, secondary: colors.secondary });

  const codeRenderSize = svgSize;
  const captureSize = Math.round(codeRenderSize * 1.6);
  const pad = (captureSize - codeRenderSize) / 2;
  const codeSize = 300;

  // Rasterize SVG into a padded capture canvas (matches app.ts scanFromImage)
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const img = await loadImage(dataUrl);
  const captureCanvas = createCanvas(captureSize, captureSize);
  const ctx = captureCanvas.getContext("2d");
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, captureSize, captureSize);
  ctx.drawImage(img, pad, pad, codeRenderSize, codeRenderSize);

  const captureData = ctx.getImageData(0, 0, captureSize, captureSize);
  const captured: ImageBuffer = {
    data: new Uint8ClampedArray(captureData.data),
    width: captureSize,
    height: captureSize,
  };

  // Warp to rectified image
  const r = codeRenderSize / (2 * 1.15);
  const corners = estimateCircleCorners(captureSize / 2, captureSize / 2, r, 1.15);
  const rectified = warpPerspective(captured, corners, codeSize);

  // Sample bits directly at known center and zero orientation
  // (avoids center-refine / orientation-detect differences across SVG renderers)
  const sampled = samplePolarGrid(
    rectified, codeSize / 2, codeSize / 2, codeSize,
    rings, segmentsPerRing, 0, colors.inverted,
  );

  const totalSegs = getTotalSegments(rings, segmentsPerRing);
  const expected = new Array(totalSegs).fill(0);
  for (let i = 0; i < code.bits.length; i++) expected[i] = code.bits[i];

  const decoded = decode(sampled, eccBytes);
  return { decoded, bits: sampled, expected };
}

// --- Test matrix ---

const inputs = ["ab", "hello", "abcdef", "test1234", "ex.co/q"];

const layouts: { rings: number; segmentsPerRing: number }[] = [
  { rings: 3, segmentsPerRing: 32 },
  { rings: 5, segmentsPerRing: 48 },
  { rings: 6, segmentsPerRing: 64 },
];

const eccValues = [2, 4, 8, 16];

const colorSchemes: (ColorScheme & { name: string })[] = [
  { name: "black on white",       primary: "#000000", secondary: "#d0d0d0", background: "#ffffff", inverted: false },
  { name: "white on dark",        primary: "#ffffff", secondary: "#303030", background: "#111111", inverted: true },
  { name: "dark blue on cream",   primary: "#1a237e", secondary: "#c5cae9", background: "#fff8e1", inverted: false },
  { name: "red on white",         primary: "#b71c1c", secondary: "#e0b0b0", background: "#ffffff", inverted: false },
  { name: "dark green on light",  primary: "#1b5e20", secondary: "#a5d6a7", background: "#f1f8e9", inverted: false },
  { name: "orange on white",      primary: "#e65100", secondary: "#d0d0d0", background: "#ffffff", inverted: false },
  { name: "cyan on dark",         primary: "#00e5ff", secondary: "#263238", background: "#0a0a0a", inverted: true },
  { name: "yellow on dark blue",  primary: "#ffd600", secondary: "#1a237e", background: "#0d1b2a", inverted: true },
];

function fitsInGrid(input: string, rings: number, segmentsPerRing: number, eccBytes: number): boolean {
  const payloadBytes = new TextEncoder().encode(input).length + 2;
  const totalBits = (payloadBytes + eccBytes) * 8;
  return totalBits <= getTotalSegments(rings, segmentsPerRing);
}

/**
 * Full pipeline test using scanFrame — matches exactly what the browser does.
 * Tests center refinement, orientation detection, sampling, and decoding.
 */
async function scanViaFullPipeline(
  input: string,
  rings: number,
  segmentsPerRing: number,
  eccBytes: number,
  colors: ColorScheme,
) {
  const code = encode(input, { rings, segmentsPerRing, eccBytes });
  const svgSize = 400;
  const svg = renderSVG(code, { size: svgSize, primary: colors.primary, secondary: colors.secondary });

  const codeRenderSize = svgSize;
  const captureSize = Math.round(codeRenderSize * 1.6);
  const pad = (captureSize - codeRenderSize) / 2;

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const img = await loadImage(dataUrl);
  const canvas = createCanvas(captureSize, captureSize);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, captureSize, captureSize);
  ctx.drawImage(img, pad, pad, codeRenderSize, codeRenderSize);

  const imageData = ctx.getImageData(0, 0, captureSize, captureSize);
  const captured: ImageBuffer = {
    data: new Uint8ClampedArray(imageData.data),
    width: captureSize,
    height: captureSize,
  };

  const knownDetection = {
    cx: captureSize / 2,
    cy: captureSize / 2,
    r: codeRenderSize / (2 * 1.15),
    confidence: 1,
  };

  return scanFrame(captured, { rings, segmentsPerRing, eccBytes, knownDetection });
}

describe("scan roundtrip", () => {
  describe("sampler (known center & orientation)", () => {
    for (const scheme of colorSchemes) {
      describe(scheme.name, () => {
        for (const { rings, segmentsPerRing } of layouts) {
          for (const eccBytes of eccValues) {
            for (const input of inputs) {
              if (!fitsInGrid(input, rings, segmentsPerRing, eccBytes)) continue;

              it(`"${input}" rings=${rings} segs=${segmentsPerRing} ecc=${eccBytes}`, async () => {
                const { decoded, bits, expected } = await scanFromRenderedSVG(
                  input, rings, segmentsPerRing, eccBytes, scheme,
                );

                let mismatches = 0;
                for (let i = 0; i < bits.length; i++) {
                  if (bits[i] !== expected[i]) mismatches++;
                }

                expect(decoded).toBe(input);
                expect(mismatches).toBe(0);
              });
            }
          }
        }
      });
    }
  });

  describe("full pipeline (center refine + orientation + decode)", () => {
    const pipelineSchemes = colorSchemes.slice(0, 4);
    const pipelineInputs = ["ab", "hello", "abcdef", "test1234"];
    const pipelineLayouts = layouts;
    const pipelineEcc = [4, 8];

    for (const scheme of pipelineSchemes) {
      describe(scheme.name, () => {
        for (const { rings, segmentsPerRing } of pipelineLayouts) {
          for (const eccBytes of pipelineEcc) {
            for (const input of pipelineInputs) {
              if (!fitsInGrid(input, rings, segmentsPerRing, eccBytes)) continue;

              it(`"${input}" rings=${rings} segs=${segmentsPerRing} ecc=${eccBytes}`, async () => {
                const result = await scanViaFullPipeline(
                  input, rings, segmentsPerRing, eccBytes, scheme,
                );

                expect(result.error).toBeNull();
                expect(result.decoded).toBe(input);
              });
            }
          }
        }
      });
    }
  });

  describe("offset & scaled placement (center + orientation recovery)", () => {
    // Deterministic pseudo-random: simple LCG seeded per test case
    function mulberry32(seed: number) {
      return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    const offsetInputs = ["ab", "hello", "abcdef"];
    const offsetLayout = { rings: 5, segmentsPerRing: 48 };
    const offsetEcc = 4;
    const scheme = colorSchemes[0]; // black on white

    const placements = [
      { name: "shifted right",  dx: 30,  dy: 0,   scale: 1.0 },
      { name: "shifted up",     dx: 0,   dy: -25, scale: 1.0 },
      { name: "shifted diag",   dx: -20, dy: 15,  scale: 1.0 },
      { name: "scaled down",    dx: 0,   dy: 0,   scale: 0.8 },
      { name: "scaled up",      dx: 0,   dy: 0,   scale: 1.15 },
      { name: "shifted+scaled", dx: 15,  dy: -10, scale: 0.85 },
    ];

    // Add deterministic random placements
    const rng = mulberry32(42);
    for (let i = 0; i < 6; i++) {
      placements.push({
        name: `random #${i + 1}`,
        dx: Math.round((rng() - 0.5) * 60),
        dy: Math.round((rng() - 0.5) * 60),
        scale: 0.75 + rng() * 0.5,
      });
    }

    for (const input of offsetInputs) {
      for (const p of placements) {
        it(`"${input}" ${p.name} (dx=${p.dx} dy=${p.dy} scale=${p.scale.toFixed(2)})`, async () => {
          const { rings, segmentsPerRing } = offsetLayout;
          const code = encode(input, { rings, segmentsPerRing, eccBytes: offsetEcc });
          const svgSize = 400;
          const svg = renderSVG(code, { size: svgSize, primary: scheme.primary, secondary: scheme.secondary });

          const codeRenderSize = Math.round(svgSize * p.scale);
          const captureSize = 640;
          const cx = captureSize / 2 + p.dx;
          const cy = captureSize / 2 + p.dy;
          const drawX = cx - codeRenderSize / 2;
          const drawY = cy - codeRenderSize / 2;

          const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
          const img = await loadImage(dataUrl);
          const canvas = createCanvas(captureSize, captureSize);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = scheme.background;
          ctx.fillRect(0, 0, captureSize, captureSize);
          ctx.drawImage(img, drawX, drawY, codeRenderSize, codeRenderSize);

          const imageData = ctx.getImageData(0, 0, captureSize, captureSize);
          const captured: ImageBuffer = {
            data: new Uint8ClampedArray(imageData.data),
            width: captureSize,
            height: captureSize,
          };

          const knownDetection = {
            cx,
            cy,
            r: codeRenderSize / (2 * 1.15),
            confidence: 1,
          };

          const result = scanFrame(captured, { rings, segmentsPerRing, eccBytes: offsetEcc, knownDetection });

          expect(result.error).toBeNull();
          expect(result.decoded).toBe(input);
        });
      }
    }
  });

  describe("randomized rotation (orientation recovery)", () => {
    function mulberry32(seed: number) {
      return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    const rng = mulberry32(99);
    const rotInputs = ["ab", "hello", "abcdef"];
    const rotScheme = colorSchemes[0];
    const rotLayout = { rings: 5, segmentsPerRing: 48 };
    const rotEcc = 4;

    const rotations = [
      { name: "45 deg", angle: Math.PI / 4 },
      { name: "90 deg", angle: Math.PI / 2 },
      { name: "180 deg", angle: Math.PI },
      { name: "270 deg", angle: Math.PI * 1.5 },
    ];

    for (let i = 0; i < 6; i++) {
      rotations.push({ name: `random #${i + 1}`, angle: rng() * Math.PI * 2 });
    }

    for (const input of rotInputs) {
      for (const rot of rotations) {
        it(`"${input}" rotated ${rot.name}`, async () => {
          const { rings, segmentsPerRing } = rotLayout;
          const code = encode(input, { rings, segmentsPerRing, eccBytes: rotEcc });
          const svgSize = 400;
          const svg = renderSVG(code, { size: svgSize, primary: rotScheme.primary, secondary: rotScheme.secondary });

          const captureSize = 640;
          const codeRenderSize = 380;

          const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
          const img = await loadImage(dataUrl);
          const canvas = createCanvas(captureSize, captureSize);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = rotScheme.background;
          ctx.fillRect(0, 0, captureSize, captureSize);

          ctx.save();
          ctx.translate(captureSize / 2, captureSize / 2);
          ctx.rotate(rot.angle);
          ctx.drawImage(img, -codeRenderSize / 2, -codeRenderSize / 2, codeRenderSize, codeRenderSize);
          ctx.restore();

          const imageData = ctx.getImageData(0, 0, captureSize, captureSize);
          const captured: ImageBuffer = {
            data: new Uint8ClampedArray(imageData.data),
            width: captureSize,
            height: captureSize,
          };

          const knownDetection = {
            cx: captureSize / 2,
            cy: captureSize / 2,
            r: codeRenderSize / (2 * 1.15),
            confidence: 1,
          };

          const result = scanFrame(captured, { rings, segmentsPerRing, eccBytes: rotEcc, knownDetection });

          expect(result.error).toBeNull();
          expect(result.decoded).toBe(input);
        });
      }
    }
  });
});

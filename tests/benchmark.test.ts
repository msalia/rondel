import { describe, it, expect } from "vitest";
import { createCanvas, loadImage } from "canvas";
import { encode } from "@/core/encoder";
import { decode } from "@/core/decoder";
import { renderSVG } from "@/render/svgRenderer";
import { rsEncode, rsDecode } from "@/ecc/reedSolomon";
import { bytesToBits, bitsToBytes } from "@/core/bitstream";
import { getTotalSegments } from "@/core/layout";
import { samplePolarGrid } from "@/scan/sampler";
import { warpPerspective, estimateCircleCorners, solveHomography } from "@/scan/perspective";
import { refineCenterFromDot } from "@/scan/centerRefine";
import { analyzeOrientation } from "@/scan/orientationAnalyzer";
import { validateCircularCode } from "@/scan/validator";
import { scoreFrame } from "@/scan/frameScorer";
import { detectCircle } from "@/scan/detector";
import { scanFrame } from "@/scan";
import { toGrayscale } from "@/utils/image";
import type { ImageBuffer } from "@/types";

// --- Harness ---

type BenchResult = { median: number; p95: number; ops: number };

function bench(fn: () => void, iterations = 200): BenchResult {
  // warmup
  for (let i = 0; i < 10; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const ops = Math.round(1000 / median);
  return { median, p95, ops };
}

async function benchAsync(fn: () => Promise<void>, iterations = 50): Promise<BenchResult> {
  for (let i = 0; i < 3; i++) await fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const ops = Math.round(1000 / median);
  return { median, p95, ops };
}

function report(name: string, r: BenchResult, budgetMs: number): void {
  const status = r.p95 <= budgetMs ? "PASS" : "SLOW";
  console.log(
    `  ${status} ${name.padEnd(40)} p50=${r.median.toFixed(2)}ms  p95=${r.p95.toFixed(2)}ms  ${r.ops} ops/s  (budget: ${budgetMs}ms)`,
  );
}

// --- Fixtures ---

const TEXT = "hello";
const RINGS = 5;
const SEGMENTS = 48;
const ECC = 8;
const CODE_SIZE = 300;

const encoded = encode(TEXT, { rings: RINGS, segmentsPerRing: SEGMENTS, eccBytes: ECC });
const svg = renderSVG(encoded, { size: 400 });

const payload = new Uint8Array([1, TEXT.length, ...new TextEncoder().encode(TEXT)]);
const rsEncoded = rsEncode(payload, ECC);

const totalSegs = getTotalSegments(RINGS, SEGMENTS);
const paddedBits = new Array(totalSegs).fill(0);
for (let i = 0; i < encoded.bits.length; i++) paddedBits[i] = encoded.bits[i];

function makeTestBuffer(size: number): ImageBuffer {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * 255;
    data[i + 1] = Math.random() * 255;
    data[i + 2] = Math.random() * 255;
    data[i + 3] = 255;
  }
  return { data, width: size, height: size };
}

const testBuf300 = makeTestBuffer(300);
const testBuf320 = makeTestBuffer(320);

// Pre-render SVG to ImageBuffer for scan benchmarks
let rectifiedBuf: ImageBuffer;
let capturedBuf: ImageBuffer;

// --- Benchmarks ---

describe("performance benchmarks", () => {
  // Prepare rendered image once
  it("setup: render SVG to pixel buffer", async () => {
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const img = await loadImage(dataUrl);

    const captureSize = 640;
    const codeRenderSize = 400;
    const pad = (captureSize - codeRenderSize) / 2;
    const canvas = createCanvas(captureSize, captureSize);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, captureSize, captureSize);
    ctx.drawImage(img, pad, pad, codeRenderSize, codeRenderSize);
    const imageData = ctx.getImageData(0, 0, captureSize, captureSize);
    capturedBuf = { data: new Uint8ClampedArray(imageData.data), width: captureSize, height: captureSize };

    const corners = estimateCircleCorners(captureSize / 2, captureSize / 2, codeRenderSize / (2 * 1.15), 1.15);
    rectifiedBuf = warpPerspective(capturedBuf, corners, CODE_SIZE);
  });

  // --- Encoding pipeline ---

  describe("encoding", () => {
    it("encode (string → bits)", () => {
      const r = bench(() => encode(TEXT, { rings: RINGS, segmentsPerRing: SEGMENTS, eccBytes: ECC }));
      report("encode", r, 1);
      expect(r.p95).toBeLessThan(1);
    });

    it("rsEncode (payload → codeword)", () => {
      const r = bench(() => rsEncode(payload, ECC));
      report("rsEncode", r, 0.5);
      expect(r.p95).toBeLessThan(0.5);
    });

    it("rsDecode (codeword → payload, no errors)", () => {
      const r = bench(() => rsDecode(rsEncoded, ECC));
      report("rsDecode (clean)", r, 0.5);
      expect(r.p95).toBeLessThan(0.5);
    });

    it("rsDecode (codeword → payload, with errors)", () => {
      const corrupted = new Uint8Array(rsEncoded);
      corrupted[0] ^= 0xff;
      corrupted[3] ^= 0x42;
      const r = bench(() => rsDecode(corrupted, ECC));
      report("rsDecode (2 errors)", r, 1);
      expect(r.p95).toBeLessThan(1);
    });

    it("bytesToBits", () => {
      const data = new Uint8Array(20);
      const r = bench(() => bytesToBits(data), 500);
      report("bytesToBits (20 bytes)", r, 0.1);
      expect(r.p95).toBeLessThan(0.1);
    });

    it("bitsToBytes", () => {
      const bits = new Array(160).fill(0).map(() => Math.round(Math.random()));
      const r = bench(() => bitsToBytes(bits), 500);
      report("bitsToBytes (160 bits)", r, 0.1);
      expect(r.p95).toBeLessThan(0.1);
    });

    it("decode (bits → string)", () => {
      const r = bench(() => decode(paddedBits, ECC));
      report("decode", r, 1);
      expect(r.p95).toBeLessThan(1);
    });
  });

  // --- Rendering ---

  describe("rendering", () => {
    it("renderSVG (300px)", () => {
      const r = bench(() => renderSVG(encoded, { size: 300 }));
      report("renderSVG (300px)", r, 3);
      expect(r.p95).toBeLessThan(3);
    });

    it("renderSVG (600px)", () => {
      const r = bench(() => renderSVG(encoded, { size: 600 }));
      report("renderSVG (600px)", r, 3);
      expect(r.p95).toBeLessThan(3);
    });
  });

  // --- Scan pipeline components ---

  describe("scan pipeline", () => {
    it("toGrayscale (300x300)", () => {
      const r = bench(() => toGrayscale(testBuf300.data, 300 * 300), 500);
      report("toGrayscale (300x300)", r, 2);
      expect(r.p95).toBeLessThan(2);
    });

    it("solveHomography", () => {
      const src = [{ x: 120, y: 120 }, { x: 520, y: 120 }, { x: 520, y: 520 }, { x: 120, y: 520 }];
      const dst = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }];
      const r = bench(() => solveHomography(src, dst), 500);
      report("solveHomography", r, 0.1);
      expect(r.p95).toBeLessThan(0.1);
    });

    it("warpPerspective (640→300)", () => {
      const corners = estimateCircleCorners(320, 320, 174, 1.15);
      const r = bench(() => warpPerspective(capturedBuf, corners, CODE_SIZE), 100);
      report("warpPerspective (640→300)", r, 20);
      expect(r.p95).toBeLessThan(20);
    });

    it("refineCenterFromDot", () => {
      const r = bench(() => refineCenterFromDot(rectifiedBuf, RINGS, CODE_SIZE));
      report("refineCenterFromDot", r, 3);
      expect(r.p95).toBeLessThan(3);
    });

    it("analyzeOrientation", () => {
      const r = bench(() => analyzeOrientation(rectifiedBuf, RINGS, CODE_SIZE, 360, 150, 150, SEGMENTS));
      report("analyzeOrientation", r, 5);
      expect(r.p95).toBeLessThan(5);
    });

    it("validateCircularCode", () => {
      const r = bench(() => validateCircularCode(rectifiedBuf, RINGS, CODE_SIZE, 0.5, SEGMENTS));
      report("validateCircularCode", r, 3);
      expect(r.p95).toBeLessThan(3);
    });

    it("scoreFrame", () => {
      const r = bench(() => scoreFrame(capturedBuf, 320, 320, 174));
      report("scoreFrame", r, 5);
      expect(r.p95).toBeLessThan(5);
    });

    it("samplePolarGrid", () => {
      const r = bench(() => samplePolarGrid(rectifiedBuf, 150, 150, CODE_SIZE, RINGS, SEGMENTS, 0, false));
      report("samplePolarGrid", r, 3);
      expect(r.p95).toBeLessThan(3);
    });

    it("detectCircle (Hough)", () => {
      const r = bench(() => detectCircle(testBuf320), 50);
      report("detectCircle (Hough, 320px)", r, 30);
      expect(r.p95).toBeLessThan(30);
    });
  });

  // --- Full pipeline ---

  describe("full pipeline", () => {
    it("scanFrame (ImageBuffer, no ML)", () => {
      const knownDetection = { cx: 320, cy: 320, r: 174, confidence: 1 };
      const r = bench(
        () => scanFrame(capturedBuf, { rings: RINGS, segmentsPerRing: SEGMENTS, eccBytes: ECC, knownDetection }),
        100,
      );
      report("scanFrame (known detection)", r, 25);
      expect(r.p95).toBeLessThan(25);
    });

    it("encode + renderSVG + rasterize + scanFrame roundtrip", async () => {
      const r = await benchAsync(async () => {
        const code = encode(TEXT, { rings: RINGS, segmentsPerRing: SEGMENTS, eccBytes: ECC });
        const svgStr = renderSVG(code, { size: 400 });
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgStr).toString("base64")}`;
        const img = await loadImage(dataUrl);
        const captureSize = 640;
        const pad = (captureSize - 400) / 2;
        const canvas = createCanvas(captureSize, captureSize);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, captureSize, captureSize);
        ctx.drawImage(img, pad, pad, 400, 400);
        const imageData = ctx.getImageData(0, 0, captureSize, captureSize);
        const captured: ImageBuffer = { data: new Uint8ClampedArray(imageData.data), width: captureSize, height: captureSize };
        const knownDetection = { cx: captureSize / 2, cy: captureSize / 2, r: 400 / (2 * 1.15), confidence: 1 };
        const result = scanFrame(captured, { rings: RINGS, segmentsPerRing: SEGMENTS, eccBytes: ECC, knownDetection });
        if (!result.decoded) throw new Error("roundtrip failed");
      }, 30);
      report("full roundtrip (encode→render→rasterize→scan)", r, 60);
      expect(r.p95).toBeLessThan(60);
    });
  });
});

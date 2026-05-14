# Rondel

A circular barcode format that encodes arbitrary text into concentric ring patterns. Renders as SVG, scans from camera or image using ML detection, perspective correction, and algorithmic orientation recovery. Includes Reed-Solomon error correction over GF(256).

## What Is a Rondel?

A rondel is a 2D barcode arranged as concentric rings of arc segments around a central dot. Each arc segment represents one bit — dark (primary color) for 1, light (secondary color) for 0. The code is read by identifying the center, determining the orientation, and sampling each segment's brightness.

### Anatomy

```
┌─────────────────────────────────────────┐
│          Orientation Ring               │
│  ┌───────────────────────────────────┐  │
│  │       Data Ring N (outermost)     │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │     ...                     │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │    Data Ring 2        │  │  │  │
│  │  │  │  ┌─────────────────┐  │  │  │  │
│  │  │  │  │   Data Ring 1   │  │  │  │  │
│  │  │  │  │  ┌───────────┐  │  │  │  │  │
│  │  │  │  │  │  Ring 0   │  │  │  │  │  │
│  │  │  │  │  │ (spacer)  │  │  │  │  │  │
│  │  │  │  │  │   ● dot   │  │  │  │  │  │
│  │  │  │  │  └───────────┘  │  │  │  │  │
│  │  │  │  └─────────────────┘  │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Center dot** — solid filled circle at the geometric center. Used as a detection anchor and for sub-pixel center refinement during scanning.

**Ring 0 (spacer)** — the innermost ring carries no data. It provides visual separation between the center dot and the first data ring.

**Data rings 1..N** — each ring is divided into arc segments. The number of segments per ring scales with circumference: inner rings have fewer segments, outer rings have more. This keeps arc lengths approximately constant across all rings, preventing inner-ring segments from becoming too small to scan reliably. The outermost data ring is padded so the total segment count is always a multiple of 8, eliminating wasted trailing bits.

**Orientation ring** — sits outside the outermost data ring. Contains a fixed pattern of asymmetric arcs that allows the scanner to determine:
- **Rotation angle** (0-360 degrees, ~1 degree resolution)
- **Reflection** (mirror-flipped codes)
- **Polarity** (normal dark-on-light vs inverted light-on-dark)

### Ring Layout Math

The layout uses a constant arc length across all rings. Given `rings` total rings and `baseSegments` segments on the outermost data ring:

```
ringWidth       = size / (2 * (rings + 3))
bitArcLength L  = 2π * rings * ringWidth / baseSegments
segmentsForRing(r) = max(8, round(baseSegments * (r + 1) / rings))
exactRadius(r)     = segmentsForRing(r) * L / (2π)
```

This means each bit occupies the same arc length `L` regardless of which ring it's on. Inner rings (smaller radius) get fewer segments; outer rings get more. The minimum of 8 segments prevents degenerate inner rings.

Each segment has an active arc and a trailing gap:

```
segmentAngle = 2π / segmentsInRing
activeArc    = segmentAngle * (1 - GAP_FRACTION)     // GAP_FRACTION = 0.3
gap          = segmentAngle * GAP_FRACTION
```

### Orientation Ring

The orientation ring sits at radius `(rings + 1) * ringWidth` and contains:

1. **Timing pattern** — three alternating on/off arcs (101010) at the same bit arc length as data rings
2. **Separator** — 2-bit gap
3. **Three asymmetric arcs** — large (~57% of remaining space), medium (~29%), and short (~14%)

The asymmetric arc lengths create a unique angular fingerprint. The scanner correlates sampled brightness around the ring against the expected pattern at every 1-degree offset. The offset with the best correlation gives the rotation angle. Mirror reflection reverses the arc order, and inverted polarity flips dark/light — both are tested during correlation.

### Reed-Solomon Error Correction

Data integrity uses Reed-Solomon codes over GF(256) with primitive polynomial `x^8 + x^4 + x^3 + x^2 + 1` (0x11D).

**Encoding:** The generator polynomial `g(x) = (x - α^0)(x - α^1)...(x - α^(n-1))` produces `eccBytes` parity symbols appended to the data. With `eccBytes` parity bytes, the code can correct up to `floor(eccBytes / 2)` byte errors.

**Decoding pipeline:**
1. **Syndrome calculation** — evaluate received polynomial at each root of `g(x)` via Horner's method
2. **Berlekamp-Massey** — find the error locator polynomial `σ(x)` from the syndromes
3. **Chien search** — find roots of `σ(x)` by evaluating at all 255 non-zero field elements; roots indicate error positions
4. **Forney algorithm** — compute error magnitudes from the error evaluator polynomial `Ω(x)` and the formal derivative `σ'(x)`

### Data Format (V3)

The encoder wraps input text in a binary envelope with automatic mode selection:

```
[version: 1 byte = 0x03] [mode+count: 1 byte] [extended count: 0-1 bytes] [packed data: N bytes] [RS parity: eccBytes]
```

**Header format:**
- Byte 0: version (always 3)
- Byte 1: `(modeField << 6) | countLow`
  - `countLow <= 62`: count is `countLow`, header is 2 bytes
  - `countLow == 63` (0x3F): count is in byte 2 (0-255), header is 3 bytes

**Encoding modes** — automatically selected for optimal density:

| Mode | Field | Packing | Bits/char |
|------|-------|---------|-----------|
| Numeric | 0 | 3 digits → 10 bits | ~3.33 |
| Alphanumeric | 1 | 2 chars → 11 bits (A-Z, 0-9, space, `$%*+-./:`) | ~5.5 |
| Byte | 2 | raw UTF-8 | 8.0 |
| Alphanumeric + lowercase | 3 | same as alphanumeric, lowercased on decode | ~5.5 |

The byte sequence is converted to a bit stream (MSB first) and mapped to ring segments starting from ring 1 segment 0.

### Auto-Sizing

When `encode()` is called without explicit `rings`, `segmentsPerRing`, or `eccBytes`, the encoder auto-selects the optimal configuration:

1. Compute packed data size (header + mode-packed payload)
2. Search across segment candidates to find the fewest rings that fit
3. Fill remaining grid capacity with ECC bytes for maximum error correction

**Default auto-sizing ranges** (configurable in `constants.ts`):

| Parameter | Range | Default |
|-----------|-------|---------|
| `AUTO_MIN_RINGS` / `AUTO_MAX_RINGS` | 4-8 | — |
| `AUTO_SEGMENT_CANDIDATES` | [32, 48] | — |
| `AUTO_MIN_ECC` / `AUTO_MAX_ECC` | 2-8 bytes | — |

**Auto-size examples:**

| Input | Rings | Segments | ECC | Capacity |
|-------|-------|----------|-----|----------|
| `"Hi"` | 4 | 48 | 8 | 112 bits |
| `"hello"` | 4 | 48 | 8 | 112 bits |
| `"1234567890"` | 4 | 48 | 7 | 112 bits |
| `"https://example.com"` | 6 | 48 | 4 | 160 bits |

### Capacity Table

Grid capacity in characters by configuration (byte mode / alphanumeric mode):

| Rings | Segs=32 | Segs=48 |
|-------|---------|---------|
| 4 | 5 / 6 (ecc=2) | 10 / 14 (ecc=2) |
| 5 | 8 / 10 | 13 / 18 |
| 6 | 10 / 14 | 16 / 22 |
| 7 | 12 / 16 | 20 / 28 |
| 8 | 14 / 20 | 23 / 32 |

## Rendering

### SVG Renderer

`renderSVG(code, options)` produces an SVG string with three layers:

1. **Secondary arcs** — fill the gaps between primary arcs. A `SECONDARY_SEPARATION` of 1 segment is left between primary and secondary arcs.
2. **Primary arcs** — consecutive 1-bits are merged into single long arcs with `stroke-linecap="round"`.
3. **Orientation ring arcs** — the timing pattern and three asymmetric arcs.
4. **Center dot** — filled circle at the center.

**Options:**
- `size` — SVG dimensions in pixels (default 300)
- `primary` — foreground/arc color (default `#000000`)
- `secondary` — background arc color (default `#d0d0d0`)

### Canvas Renderer

`renderCanvas(code, size)` generates an SVG string via `renderSVG`, loads it as an image blob, and draws it to an HTML canvas.

## Scanning Pipeline

The scanning pipeline converts a camera frame (or rendered image) back to the encoded text:

1. **Detection** — ML (YOLOv8n-Pose with 4 corner keypoints) or Hough circle fallback
2. **Perspective correction** — 4-point homography to a 300x300 square
3. **Center refinement** — sub-pixel centroid from the center dot
4. **Orientation analysis** — rotation, reflection, polarity from the asymmetric ring
5. **Validation** — center dot, ring contrast, and segment pattern checks
6. **Polar grid sampling** — 9-point sampling per segment with adaptive threshold
7. **Decode** — Reed-Solomon error correction and payload extraction
8. **Multi-frame consensus** — weighted majority voting across frames for camera scanning

## Project Structure

```
src/
  core/           Encoder, decoder, bitstream, layout math, auto-sizing
  ecc/            GF(256) arithmetic and Reed-Solomon codec
  render/         SVG renderer and Canvas renderer
  scan/           Detection, orientation, sampling, perspective, consensus, validation
  ml/             TensorFlow.js model loader, YOLO inference
  react/          useCircularScanner hook
  utils/          ImageBuffer ops, canvas conversion, grayscale, math
  types.ts        Shared type definitions
  constants.ts    All configurable defaults including auto-sizing ranges
  index.ts        Public API exports

tests/            773 tests across 24 test files
debug/            Browser debug app with pipeline visualization
models/           Trained TF.js detection model
training/         YOLOv8-Pose training scripts (Python)
scripts/          Dataset generation, build tooling
```

## Quick Start

```bash
npm install
npm run build
npm test
```

## Usage

### Encode and Render (Auto-Sized)

```typescript
import { encode, renderSVG } from "@msalia/rondel";

// Auto-selects rings, segments, and ECC for optimal fit
const code = encode("https://example.com");

const svg = renderSVG(code, {
  size: 400,
  primary: "#1a237e",
  secondary: "#c5cae9",
});

document.getElementById("container").innerHTML = svg;
```

### Encode with Explicit Options

```typescript
const code = encode("https://example.com", {
  rings: 6,
  segmentsPerRing: 48,
  eccBytes: 4,
});
```

### Decode from Bits

```typescript
import { decode } from "@msalia/rondel";

// eccBytes must match what the encoder used
const text = decode(code.bits, code.eccBytes);
```

### Auto-Size Without Encoding

```typescript
import { autoSize } from "@msalia/rondel";

const result = autoSize("https://example.com");
// { rings: 6, segmentsPerRing: 48, eccBytes: 4, capacityBits: 160, usedBits: 160 }
```

### Scan a Single Frame

```typescript
import { scanFrame } from "@msalia/rondel";

const result = scanFrame(imageBuffer, {
  rings: 6,
  segmentsPerRing: 48,
  eccBytes: 4,
});
if (result.decoded) {
  console.log(result.decoded);
}
```

### Scan from Video

```typescript
import { scanFromVideo } from "@msalia/rondel";

const result = await scanFromVideo(video, {
  modelUrl: "/models/circular_code/model.json",
  consensusRequired: 3,
});
```

### React Hook

```tsx
import { useCircularScanner } from "@msalia/rondel";

function Scanner() {
  const { videoRef, result, scanning } = useCircularScanner({
    modelUrl: "/models/circular_code/model.json",
  });

  return (
    <div>
      <video ref={videoRef} />
      {result && <p>Found: {result.data}</p>}
    </div>
  );
}
```

## Training the ML Detector

The detector uses a YOLOv8n-Pose model that predicts a bounding box plus 4 corner keypoints per detected code.

### Prerequisites

Python 3.9+ with ultralytics:

```bash
cd training
bash setup_venv.sh
source venv/bin/activate
```

### Step 1: Generate Training Data

```bash
npm run build
npm run generate-dataset
```

Produces 12,000 images (8,000 positive + 4,000 negative) with an 85/15 train/val split. Positive samples span the full auto-sizing range:

- Ring counts from `AUTO_MIN_RINGS` to `AUTO_MAX_RINGS` (default 4-8)
- Segment counts from `AUTO_SEGMENT_CANDIDATES` (default [32, 48])
- ECC bytes from `AUTO_MIN_ECC` to `AUTO_MAX_ECC` (default 2-8)
- Full 3D perspective transforms (pitch, yaw, roll)
- Varied colors, noise, lighting gradients, blur, and background clutter
- ~35% inverted polarity

### Step 2: Train

```bash
npm run train
```

### Step 3: Verify

```bash
npx vitest run tests/model.test.ts
```

## Performance

Benchmarks measured on Apple M-series, Node.js, single-threaded. Run with `npx vitest run tests/benchmark.test.ts`.

### Encoding Pipeline

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `encode` (string → bits) | 0.01ms | 0.02ms | 118,000+ |
| `rsEncode` (payload → codeword) | <0.01ms | <0.01ms | 452,000+ |
| `rsDecode` (no errors) | <0.01ms | <0.01ms | 400,000+ |
| `rsDecode` (2 byte errors) | 0.02ms | 0.06ms | 41,000+ |
| `decode` (bits → string) | 0.01ms | 0.01ms | 118,000+ |
| `bytesToBits` / `bitsToBytes` | <0.01ms | <0.01ms | 347,000+ |

### Rendering

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `renderSVG` (300px) | 0.02ms | 0.03ms | 50,000+ |
| `renderSVG` (600px) | 0.02ms | 0.02ms | 57,000+ |

### Scan Pipeline

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `toGrayscale` (300x300) | 0.24ms | 0.26ms | 4,100+ |
| `solveHomography` | 0.02ms | 0.02ms | 62,000+ |
| `warpPerspective` (→300) | 1.73ms | 1.94ms | 577+ |
| `refineCenterFromDot` | 0.27ms | 0.30ms | 3,700+ |
| `analyzeOrientation` | 0.84ms | 0.94ms | 1,187+ |
| `validateCircularCode` | 0.26ms | 0.30ms | 3,800+ |
| `scoreFrame` | 0.51ms | 0.64ms | 1,968+ |
| `samplePolarGrid` | 0.07ms | 0.16ms | 13,400+ |
| `detectCircle` (Hough, 320px) | 6.41ms | 6.65ms | 156+ |

### End-to-End

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `scanFrame` (known detection) | 3.4ms | 4.4ms | ~297 |
| Full roundtrip (encode→render→rasterize→scan) | 3.9ms | 5.0ms | ~259 |

The scan pipeline bottleneck is `warpPerspective` (bilinear interpolation over 90K pixels). With known detection (skipping Hough), the full decode runs at ~297 fps — well above the 30 fps camera rate.

## API Reference

### Encoding

| Function | Description |
|----------|-------------|
| `encode(input, opts?)` | Encode text to `EncodedCode`. Auto-sizes when opts are omitted. |
| `decode(bits, eccBytes?)` | Decode bit array back to text via RS error correction |
| `autoSize(input, opts?)` | Compute optimal (rings, segments, eccBytes) without encoding |
| `computeDataBytes(input)` | Compute packed data size in bytes (header + payload, no ECC) |
| `computeNeededBits(input, ecc)` | Compute total bits needed (data + ECC) |
| `minRingsForBits(bits, segs)` | Find minimum rings for a given bit count and segment count |
| `rsEncode(data, eccBytes?)` | Raw Reed-Solomon encode |
| `rsDecode(data, eccBytes?)` | Raw Reed-Solomon decode with error correction |

### Rendering

| Function | Description |
|----------|-------------|
| `renderSVG(code, opts?)` | Render as SVG string with configurable colors |
| `renderCanvas(code, size?)` | Render to canvas element |

### Scanning

| Function | Description |
|----------|-------------|
| `scanFrame(source, opts?)` | Full pipeline: detect, warp, orient, sample, decode |
| `scanFromVideo(video, opts?)` | Scan video with multi-frame consensus |
| `processFrame(video, opts?)` | Process single frame, return result if decoded |
| `rectifyCode(frame, detection, rings, size?)` | Warp + orient + validate |
| `detectCode(buf)` | ML detection with Hough fallback |
| `analyzeOrientation(buf, rings, size)` | Rotation, reflection, polarity |
| `samplePolarGrid(frame, cx, cy, ...)` | Extract bits from rectified image |
| `loadModel(path?)` | Load TF.js detection model |

### Key Types

```typescript
type EncodedCode = {
  bits: number[];
  rings: number;
  segmentsPerRing: number;
  eccBytes: number;
};

type AutoSizeResult = {
  rings: number;
  segmentsPerRing: number;
  eccBytes: number;
  capacityBits: number;
  usedBits: number;
};

type CircularCodeOptions = {
  rings?: number;          // omit for auto-sizing
  segmentsPerRing?: number; // omit for auto-sizing
  eccBytes?: number;       // omit for auto-sizing
};
```

### Constants

All configurable in `src/constants.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `AUTO_MIN_RINGS` | 4 | Auto-sizing minimum rings |
| `AUTO_MAX_RINGS` | 8 | Auto-sizing maximum rings |
| `AUTO_MIN_ECC` | 2 | Auto-sizing minimum ECC bytes |
| `AUTO_MAX_ECC` | 8 | Auto-sizing maximum ECC bytes |
| `AUTO_SEGMENT_CANDIDATES` | [32, 48] | Auto-sizing segment options |
| `DEFAULT_RINGS` | 5 | Default when rings is explicit but unset |
| `DEFAULT_SEGMENTS_PER_RING` | 48 | Default when segments is explicit but unset |
| `DEFAULT_ECC_BYTES` | 4 | Default when ECC is explicit but unset |

# Circular Code

A circular barcode format that encodes arbitrary text into concentric ring patterns. Renders as SVG, scans from camera or image using ML detection, perspective correction, and algorithmic orientation recovery. Includes Reed-Solomon error correction over GF(256).

## What Is a Circular Code?

A circular code is a 2D barcode arranged as concentric rings of arc segments around a central dot. Each arc segment represents one bit — dark (primary color) for 1, light (secondary color) for 0. The code is read by identifying the center, determining the orientation, and sampling each segment's brightness.

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

**Data rings 1..N** — each ring is divided into arc segments. The number of segments per ring scales with circumference: inner rings have fewer segments, outer rings have more. This keeps arc lengths approximately constant across all rings, preventing inner-ring segments from becoming too small to scan reliably.

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

The gap provides visual separation between adjacent segments and prevents anti-aliasing bleed from making adjacent segments indistinguishable.

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

### Data Format

The encoder wraps input text in a binary envelope:

```
[version: 1 byte] [length: 1 byte] [UTF-8 data: N bytes] [RS parity: eccBytes]
```

This byte sequence is converted to a bit stream (MSB first) and mapped to ring segments starting from ring 1 segment 0, proceeding through all segments of each ring before moving to the next ring. Unused grid segments beyond the encoded bits are rendered as secondary-color arcs.

## Rendering

### SVG Renderer

`renderSVG(code, options)` produces an SVG string with three layers:

1. **Secondary arcs** (gray by default) — fill the gaps between primary arcs, providing visual continuity. A `SECONDARY_SEPARATION` of 1 segment is left between primary and secondary arcs.

2. **Primary arcs** (black by default) — consecutive 1-bits are merged into single long arcs with `stroke-linecap="round"`. This reduces SVG path count and produces cleaner visuals.

3. **Orientation ring arcs** — the timing pattern and three asymmetric arcs, drawn with the primary color.

4. **Center dot** — filled circle at the center.

The stroke color is set on the parent `<g>` element, not on individual paths. The SVG has no background fill — transparency allows embedding on any background. During scanning, transparent pixels are composited against the expected background color.

**Options:**
- `size` — SVG dimensions in pixels (default 300)
- `primary` — foreground/arc color (default `#000000`)
- `secondary` — background arc color (default `#d0d0d0`)

### Canvas Renderer

`renderCanvas(code, size)` generates an SVG string via `renderSVG`, loads it as an image blob, and draws it to an HTML canvas. This delegates all layout logic to the SVG renderer for consistency.

## Scanning Pipeline

The scanning pipeline converts a camera frame (or rendered image) back to the encoded text. It runs in several stages:

### 1. Detection

**ML detection** (primary): A YOLOv8n-Pose model predicts a bounding box and 4 corner keypoints for each detected code. The corner keypoints define the perspective-warped quadrilateral needed for accurate dewarping.

**Hough circle detection** (fallback): When the ML model is not loaded, a classical Hough circle transform finds circular candidates. Corner positions are estimated from the circle geometry.

### 2. Perspective Correction (Warp)

A 4-point homography maps the detected quadrilateral to a square output image (default 300x300). The homography is solved from 4 source-destination point pairs using Gaussian elimination. Pixel values are bilinearly interpolated for smooth output.

```
Captured frame (arbitrary perspective)
    ↓ solveHomography(dstCorners, srcCorners)
    ↓ warpPerspective(source, corners, outputSize)
Rectified square image (300x300)
```

### 3. Center Refinement

`refineCenterFromDot` locates the center dot's centroid in the rectified image. It:
1. Samples pixels in the inner region (within `dotRadius * 0.8`) and outer annulus (beyond `dotRadius * 1.3`)
2. Determines if the dot is darker or lighter than surroundings
3. Computes a weighted centroid of all dot-like pixels within `dotRadius * 2`

The search radius is kept tight to avoid contamination from nearby data ring arcs.

### 4. Orientation Analysis

`analyzeOrientation` samples 360 brightness values around the orientation ring radius, thresholds them into dark/light, and cross-correlates against the expected arc pattern.

The correlation tests four hypotheses simultaneously:
- Normal orientation at each offset
- Reflected (mirror) orientation at each offset
- Normal inverted (light-on-dark) at each offset
- Reflected inverted at each offset

The hypothesis with the highest correlation score wins. Arc contrast (mean gap brightness minus mean arc brightness) disambiguates normal from inverted polarity.

### 5. Validation

`validateCircularCode` checks three structural features:
- **Center dot** — brightness difference between center region and outer background > 30
- **Ring contrast** — radial rays show >= 2 brightness transitions in >= 40% of sampled angles
- **Segment pattern** — rings show alternating dark/light runs (>= 2 each) in >= 40% of data rings

Each check contributes to a weighted score (0.35 + 0.35 + 0.3). The code is considered valid if the score >= 0.5.

### 6. Polar Grid Sampling

`samplePolarGrid` extracts bit values from the rectified image:

1. For each data ring, compute the center radius using `getExactRingRadius`
2. For each segment in the ring, sample 9 points: 3 angular offsets × 3 radial offsets
3. Average the brightness across all sample points for that segment
4. Compute a per-ring adaptive threshold using the largest-gap method on sorted brightness values
5. Classify each segment as dark (below threshold) or light (above)
6. Apply the inverted flag: `bit = (dark !== inverted) ? 1 : 0`

**Alpha handling:** Transparent pixels (alpha = 0) are composited against the expected background brightness — white (255) for normal codes, black (0) for inverted codes. Semi-transparent pixels are alpha-blended against the background. This handles SVG regions where no arc is drawn (the `SECONDARY_SEPARATION` gaps).

**Threshold algorithm:** Sort all brightness values for the ring. Find the largest gap between consecutive sorted values. If the gap exceeds 30, place the threshold at its midpoint. Otherwise fall back to 128. This correctly separates primary arcs from secondary/background regardless of absolute brightness, supporting colored codes (e.g., dark blue on cream, orange on white).

### 7. Decode

The sampled bits are grouped into bytes (MSB first) and passed through the Reed-Solomon decoder. If syndromes are all zero, the data is error-free. Otherwise, Berlekamp-Massey + Chien search + Forney corrects up to `floor(eccBytes / 2)` byte errors. The header (version + length) is validated, and the UTF-8 payload is extracted.

### 8. Multi-Frame Consensus

For live video scanning, `MultiFrameConsensus` accumulates decoded results across frames with weighted majority voting. A result is emitted when `consensusRequired` frames agree on the same decoded text. Frame quality scoring (Laplacian sharpness + contrast) prioritizes sharp, high-contrast frames.

## Project Structure

```
src/
  core/           Encoder, decoder, bitstream, layout math
  ecc/            GF(256) arithmetic and Reed-Solomon codec
  render/         SVG renderer and Canvas renderer
  scan/           Detection, orientation, sampling, perspective, consensus, validation
  ml/             TensorFlow.js model loader, YOLO inference
  react/          useCircularScanner hook
  utils/          ImageBuffer ops, canvas conversion, grayscale, math
  types.ts        Shared type definitions
  index.ts        Public API exports

tests/            607 tests across 21 test files
example/          Browser demo app with debug pipeline view
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

### Encode and Render

```typescript
import { encode, renderSVG } from "circular-code";

const code = encode("https://example.com", {
  rings: 5,
  segmentsPerRing: 48,
  eccBytes: 16,
});

const svg = renderSVG(code, {
  size: 400,
  primary: "#1a237e",    // dark blue arcs
  secondary: "#c5cae9",  // light blue background arcs
});

document.getElementById("container").innerHTML = svg;
```

### Decode from Bits

```typescript
import { decode } from "circular-code";
const text = decode(bits, 16);
```

### Scan a Single Frame

```typescript
import { scanFrame } from "circular-code";

const result = scanFrame(videoElement);
if (result.decoded) {
  console.log(result.decoded);
}
```

### Scan from Video

```typescript
import { scanFromVideo } from "circular-code";

const result = await scanFromVideo(video, {
  modelUrl: "/models/circular_code/model.json",
  consensusRequired: 3,
});
```

### React Hook

```tsx
import { useCircularScanner } from "circular-code";

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

The detector uses a YOLOv8n-Pose model that predicts a bounding box plus 4 corner keypoints per detected code. The keypoints define the perspective-warped quadrilateral for direct homography dewarping. Rotation and polarity are handled algorithmically after rectification.

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

Produces 12,000 images (8,000 positive + 4,000 negative) with an 85/15 train/val split. Positive samples use the SVG renderer with:

- Randomly generated text (URLs, phrases, alphanumeric tokens, numbers)
- Varied ring/segment configs (3-6 rings, 32/48/64 segments)
- Full 3D perspective transforms (pitch, yaw, roll with focal-length projection)
- Dual-color rendering with configurable primary/secondary colors
- Noise, lighting gradients, blur, and background clutter
- ~35% inverted polarity (light codes on dark backgrounds)

Hard negative samples include concentric circles, bullseyes, spirals, clock faces, dashed rings, QR-like grids, and center-dot patterns.

Output structure:

```
dataset/
  images/train/    Training images (320x320 PNG)
  images/val/      Validation images
  labels/train/    YOLO-Pose labels (class cx cy w h + 4 keypoints)
  labels/val/      Validation labels
  data.yaml        YOLO dataset config with kpt_shape: [4, 3]
```

### Step 2: Train

```bash
npm run train
```

This sets up the Python environment, trains a YOLOv8n-pose model, and exports the best checkpoint to TF.js format.

Training options:

```bash
npm run train -- --epochs 40 --batch-size 32
npm run train -- --resume runs/pose/circular_code/weights/best.pt
npm run train -- --base-model yolov8s-pose.pt  # larger backbone
```

To re-export without retraining:

```bash
npm run export-model
npm run export-model -- --checkpoint path/to/best.pt
```

### Step 3: Verify

```bash
npx vitest run tests/model.test.ts
```

Loads the TF.js model, runs inference on sampled images, and checks classification accuracy (>= 80%) and bounding box quality.

### End-to-End

```bash
npm install && npm run build && npm test
npm run generate-dataset
npm run train -- --epochs 40
npx vitest run tests/model.test.ts
npm run example  # browser demo
```

## Performance

Benchmarks measured on Apple M-series, Node.js, single-threaded. Run with `npx vitest run tests/benchmark.test.ts`. Each benchmark has a p95 budget that fails CI if exceeded.

### Encoding Pipeline

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `encode` (string → bits) | 0.01ms | 0.02ms | 85,000+ |
| `rsEncode` (payload → codeword) | <0.01ms | 0.01ms | 270,000+ |
| `rsDecode` (no errors) | 0.01ms | 0.01ms | 180,000+ |
| `rsDecode` (2 byte errors) | 0.03ms | 0.07ms | 38,000+ |
| `decode` (bits → string) | 0.01ms | 0.01ms | 116,000+ |
| `bytesToBits` / `bitsToBytes` | <0.01ms | <0.01ms | 350,000+ |

### Rendering

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `renderSVG` (300px) | 0.03ms | 0.04ms | 39,000+ |
| `renderSVG` (600px) | 0.02ms | 0.03ms | 46,000+ |

### Scan Pipeline Components

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `toGrayscale` (300x300) | 0.25ms | 0.27ms | 4,000+ |
| `solveHomography` | 0.02ms | 0.02ms | 59,000+ |
| `warpPerspective` (640→300) | 1.9ms | 2.1ms | 530+ |
| `refineCenterFromDot` | 0.27ms | 0.28ms | 3,700+ |
| `analyzeOrientation` | 0.86ms | 0.97ms | 1,160+ |
| `validateCircularCode` | 0.27ms | 0.29ms | 3,700+ |
| `scoreFrame` | 0.52ms | 0.64ms | 1,900+ |
| `samplePolarGrid` | 0.08ms | 0.16ms | 13,000+ |
| `detectCircle` (Hough, 320px) | 6.6ms | 10.1ms | 150+ |

### End-to-End

| Operation | p50 | p95 | ops/s |
|-----------|-----|-----|-------|
| `scanFrame` (known detection) | 3.5ms | 4.4ms | 287 |
| Full roundtrip (encode→render→rasterize→scan) | 5.5ms | 7.6ms | 181 |

The scan pipeline bottleneck is `warpPerspective` (bilinear interpolation over 90K pixels). With known detection (skipping Hough), the full decode runs at ~280 fps — well above the 30 fps camera rate.

## API Reference

### Encoding

| Function | Description |
|----------|-------------|
| `encode(input, opts?)` | Encode text to `EncodedCode` with bit pattern and layout |
| `decode(bits, eccBytes?)` | Decode bit array back to text via RS error correction |
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
| `analyzeOrientation(buf, rings, size)` | Rotation, reflection, polarity from orientation ring |
| `samplePolarGrid(frame, cx, cy, ...)` | Extract bits from rectified image |
| `loadModel(path?)` | Load TF.js detection model |

### Key Types

```typescript
type EncodedCode = { bits: number[]; rings: number; segmentsPerRing: number };

type DetectionResult = {
  cx: number; cy: number; r: number;
  corners?: Point[];  // 4 keypoints for homography
  confidence: number;
};

type OrientationAnalysis = {
  angle: number;       // radians
  reflected: boolean;
  inverted: boolean;
  confidence: number;
};

type ScanFrameResult = {
  detected: boolean;
  decoded: string | null;
  error: string | null;
  detection: DetectionResult;
  orientation: OrientationAnalysis;
  bits: number[];
  validation: ValidationResult;
};
```

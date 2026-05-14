"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const canvas_1 = require("canvas");
const constants_1 = require("../src/constants");
const encoder_1 = require("../src/core/encoder");
const svgRenderer_1 = require("../src/render/svgRenderer");
const OUT_DIR = "./dataset";
const SIZE = 320;
const POSITIVE_COUNT = 8000;
const NEGATIVE_COUNT = 4000;
const VAL_RATIO = 0.15;
const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALNUM = ALPHA + "0123456789";
const URL_TLDS = ["com", "org", "net", "io", "dev", "co", "app"];
const URL_WORDS = [
    "app",
    "link",
    "go",
    "my",
    "get",
    "try",
    "use",
    "open",
    "run",
    "dev",
    "api",
    "hub",
    "lab",
    "bit",
    "one",
];
function randomChars(charset, len) {
    let s = "";
    for (let i = 0; i < len; i++)
        s += charset[Math.floor(Math.random() * charset.length)];
    return s;
}
function randomString() {
    const type = Math.random();
    if (type < 0.25) {
        const tld = URL_TLDS[Math.floor(Math.random() * URL_TLDS.length)];
        const word = URL_WORDS[Math.floor(Math.random() * URL_WORDS.length)];
        const path = Math.random() > 0.5 ? `/${randomChars(ALNUM, randomInt(2, 6))}` : "";
        return `https://${word}.${tld}${path}`;
    }
    if (type < 0.5) {
        const wordCount = randomInt(2, 4);
        const words = [];
        for (let i = 0; i < wordCount; i++)
            words.push(randomChars(ALPHA.slice(0, 26), randomInt(2, 7)));
        return words.join(" ");
    }
    if (type < 0.75) {
        return randomChars(ALNUM, randomInt(4, 12));
    }
    return randomChars("0123456789", randomInt(4, 10));
}
function random(min, max) {
    return Math.random() * (max - min) + min;
}
function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}
function randomColor(minBright, maxBright) {
    const r = randomInt(minBright, maxBright);
    const g = randomInt(minBright, maxBright);
    const b = randomInt(minBright, maxBright);
    return `rgb(${r},${g},${b})`;
}
function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) {
        r = c;
        g = x;
    }
    else if (h < 120) {
        r = x;
        g = c;
    }
    else if (h < 180) {
        g = c;
        b = x;
    }
    else if (h < 240) {
        g = x;
        b = c;
    }
    else if (h < 300) {
        r = x;
        b = c;
    }
    else {
        r = c;
        b = x;
    }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function randomDarkSaturatedColor() {
    const h = randomInt(0, 359);
    const s = random(0.6, 1.0);
    const l = random(0.15, 0.35);
    const [r, g, b] = hslToRgb(h, s, l);
    return `rgb(${r},${g},${b})`;
}
function randomBrightColor() {
    const h = randomInt(0, 359);
    const s = random(0.6, 1.0);
    const l = random(0.6, 0.85);
    const [r, g, b] = hslToRgb(h, s, l);
    return `rgb(${r},${g},${b})`;
}
function randomDarkMutedColor() {
    const h = randomInt(0, 359);
    const s = random(0.1, 0.4);
    const l = random(0.08, 0.2);
    const [r, g, b] = hslToRgb(h, s, l);
    return `rgb(${r},${g},${b})`;
}
function randomLightTintColor(baseColor) {
    const match = baseColor.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (match) {
        const br = parseInt(match[1]), bg = parseInt(match[2]), bb = parseInt(match[3]);
        const t = random(0.65, 0.85);
        return `rgb(${Math.round(br + (255 - br) * t)},${Math.round(bg + (255 - bg) * t)},${Math.round(bb + (255 - bb) * t)})`;
    }
    return `rgb(${randomInt(200, 240)},${randomInt(200, 240)},${randomInt(200, 240)})`;
}
async function drawCircularCode(ctx, code, cx, cy, codeSize, fgColor, secColor) {
    const svg = (0, svgRenderer_1.renderSVG)(code, {
        size: Math.round(codeSize),
        primary: fgColor,
        secondary: secColor,
    });
    const img = await (0, canvas_1.loadImage)(Buffer.from(svg));
    ctx.drawImage(img, cx - codeSize / 2, cy - codeSize / 2);
}
function addBackgroundNoise(ctx, w, h) {
    const numShapes = randomInt(0, 8);
    for (let i = 0; i < numShapes; i++) {
        ctx.fillStyle = randomColor(100, 240);
        ctx.globalAlpha = random(0.1, 0.4);
        const shapeType = randomInt(0, 2);
        if (shapeType === 0) {
            ctx.fillRect(random(0, w), random(0, h), random(10, 80), random(10, 80));
        }
        else if (shapeType === 1) {
            ctx.beginPath();
            ctx.arc(random(0, w), random(0, h), random(5, 40), 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            ctx.beginPath();
            ctx.moveTo(random(0, w), random(0, h));
            ctx.lineTo(random(0, w), random(0, h));
            ctx.lineTo(random(0, w), random(0, h));
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
function addNoisePixels(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const noiseLevel = random(0, 25);
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + random(-noiseLevel, noiseLevel)));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + random(-noiseLevel, noiseLevel)));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + random(-noiseLevel, noiseLevel)));
    }
    ctx.putImageData(imageData, 0, 0);
}
function applyBrightnessVariation(ctx, w, h) {
    const gradient = ctx.createLinearGradient(random(0, w), random(0, h), random(0, w), random(0, h));
    gradient.addColorStop(0, `rgba(255,255,255,${random(0, 0.15)})`);
    gradient.addColorStop(1, `rgba(0,0,0,${random(0, 0.15)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}
function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}
function buildPerspectiveTransform(cx, cy, codeSize, rotation, pitchDeg, yawDeg) {
    const pitch = (pitchDeg * Math.PI) / 180;
    const yaw = (yawDeg * Math.PI) / 180;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const half = codeSize / 2;
    const localCorners = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
    ];
    const focalLength = SIZE * 2.5;
    const projected = localCorners.map(([lx, ly]) => {
        let x = lx * cosR - ly * sinR;
        let y = lx * sinR + ly * cosR;
        let z = 0;
        const x2 = x;
        const y2 = y * cosP - z * sinP;
        const z2 = y * sinP + z * cosP;
        const x3 = x2 * cosY + z2 * sinY;
        const y3 = y2;
        const z3 = -x2 * sinY + z2 * cosY;
        const depth = focalLength + z3;
        const scale = focalLength / Math.max(depth, 1);
        return [cx + x3 * scale, cy + y3 * scale];
    });
    const scaleX = cosY * cosR;
    const skewX = -cosY * sinR;
    const skewY = cosP * sinR + sinP * sinY * cosR;
    const scaleY = cosP * cosR - sinP * sinY * sinR;
    return {
        matrix: [scaleX, skewY, skewX, scaleY, 0, 0],
        corners: projected,
    };
}
async function generatePositive(index, split) {
    const canvas = (0, canvas_1.createCanvas)(SIZE, SIZE);
    const ctx = canvas.getContext("2d");
    const inverted = Math.random() < 0.35;
    const bgColor = inverted
        ? Math.random() < 0.3
            ? randomDarkMutedColor()
            : randomColor(0, 60)
        : Math.random() < 0.3
            ? `rgb(${randomInt(230, 255)},${randomInt(220, 250)},${randomInt(210, 245)})`
            : randomColor(180, 255);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBackgroundNoise(ctx, SIZE, SIZE);
    let code;
    for (;;) {
        try {
            const rings = randomInt(constants_1.AUTO_MIN_RINGS, constants_1.AUTO_MAX_RINGS);
            const segmentsPerRing = constants_1.AUTO_SEGMENT_CANDIDATES[randomInt(0, constants_1.AUTO_SEGMENT_CANDIDATES.length - 1)];
            const eccBytes = randomInt(constants_1.AUTO_MIN_ECC, constants_1.AUTO_MAX_ECC);
            code = (0, encoder_1.encode)(randomString(), { rings, segmentsPerRing, eccBytes });
            break;
        }
        catch {
            // text too large for this config — retry with new random combo
        }
    }
    const codeSize = random(100, 220);
    const cx = SIZE / 2 + random(-40, 40);
    const cy = SIZE / 2 + random(-40, 40);
    const rotation = random(0, Math.PI * 2);
    const pitchDeg = random(-30, 30);
    const yawDeg = random(-30, 30);
    const { matrix, corners } = buildPerspectiveTransform(cx, cy, codeSize, rotation, pitchDeg, yawDeg);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    const colored = Math.random() < 0.4;
    let fgColor;
    let secColor;
    if (colored) {
        if (inverted) {
            fgColor = randomBrightColor();
            secColor = randomDarkMutedColor();
        }
        else {
            fgColor = randomDarkSaturatedColor();
            secColor = randomLightTintColor(fgColor);
        }
    }
    else if (inverted) {
        const fgBright = randomInt(200, 255);
        fgColor = `rgb(${fgBright},${fgBright},${fgBright})`;
        const secBright = randomInt(30, Math.max(40, fgBright - 40));
        secColor = `rgb(${secBright},${secBright},${secBright})`;
    }
    else {
        const fgBright = randomInt(0, 60);
        fgColor = `rgb(${fgBright},${fgBright},${fgBright})`;
        const secBright = randomInt(Math.min(fgBright + 40, 200), 230);
        secColor = `rgb(${secBright},${secBright},${secBright})`;
    }
    await drawCircularCode(ctx, code, 0, 0, codeSize, fgColor, secColor);
    ctx.restore();
    applyBrightnessVariation(ctx, SIZE, SIZE);
    addNoisePixels(ctx, SIZE, SIZE);
    if (random(0, 1) > 0.7) {
        const tmpCanvas = (0, canvas_1.createCanvas)(SIZE, SIZE);
        const tmpCtx = tmpCanvas.getContext("2d");
        tmpCtx.filter = `blur(${random(0.5, 2)}px)`;
        tmpCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(tmpCanvas, 0, 0);
    }
    const imgPath = path_1.default.join(OUT_DIR, "images", split, `${index}.png`);
    fs_1.default.writeFileSync(imgPath, canvas.toBuffer());
    // Compute bounding box from corners
    const xs = corners.map(([x]) => x / SIZE);
    const ys = corners.map(([, y]) => y / SIZE);
    const bboxCx = clamp01((Math.min(...xs) + Math.max(...xs)) / 2);
    const bboxCy = clamp01((Math.min(...ys) + Math.max(...ys)) / 2);
    const bboxW = clamp01(Math.max(...xs) - Math.min(...xs));
    const bboxH = clamp01(Math.max(...ys) - Math.min(...ys));
    // YOLO-Pose: class cx cy w h kp1x kp1y kp1v kp2x kp2y kp2v kp3x kp3y kp3v kp4x kp4y kp4v
    const kps = corners
        .map(([x, y]) => `${clamp01(x / SIZE).toFixed(6)} ${clamp01(y / SIZE).toFixed(6)} 2`)
        .join(" ");
    const labelLine = `0 ${bboxCx.toFixed(6)} ${bboxCy.toFixed(6)} ${bboxW.toFixed(6)} ${bboxH.toFixed(6)} ${kps}`;
    const labelPath = path_1.default.join(OUT_DIR, "labels", split, `${index}.txt`);
    fs_1.default.writeFileSync(labelPath, labelLine);
}
function drawConcentricCircles(ctx, cx, cy, maxR) {
    const numRings = randomInt(3, 7);
    const ringWidth = maxR / numRings;
    ctx.strokeStyle = randomColor(0, 80);
    ctx.lineWidth = random(2, 5);
    for (let i = 1; i <= numRings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, i * ringWidth, 0, Math.PI * 2);
        ctx.stroke();
    }
}
function drawBullseye(ctx, cx, cy, maxR) {
    const numRings = randomInt(3, 6);
    const ringWidth = maxR / numRings;
    for (let i = numRings; i >= 1; i--) {
        ctx.fillStyle = i % 2 === 0 ? randomColor(180, 255) : randomColor(0, 80);
        ctx.beginPath();
        ctx.arc(cx, cy, i * ringWidth, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawSpiral(ctx, cx, cy, maxR) {
    ctx.strokeStyle = randomColor(0, 80);
    ctx.lineWidth = random(2, 4);
    ctx.beginPath();
    const turns = random(3, 6);
    for (let t = 0; t < turns * Math.PI * 2; t += 0.1) {
        const r = (t / (turns * Math.PI * 2)) * maxR;
        const x = cx + r * Math.cos(t);
        const y = cy + r * Math.sin(t);
        if (t === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }
    ctx.stroke();
}
function drawClockFace(ctx, cx, cy, maxR) {
    ctx.strokeStyle = randomColor(0, 80);
    ctx.lineWidth = random(2, 4);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const innerR = maxR * 0.85;
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
        ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
        ctx.stroke();
    }
    ctx.fillStyle = randomColor(0, 80);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.05, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 2; i++) {
        const angle = random(0, Math.PI * 2);
        const len = random(0.4, 0.8) * maxR;
        ctx.lineWidth = random(2, 5);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + len * Math.cos(angle), cy + len * Math.sin(angle));
        ctx.stroke();
    }
}
function drawDashedRings(ctx, cx, cy, maxR) {
    const numRings = randomInt(3, 6);
    const ringWidth = maxR / numRings;
    ctx.strokeStyle = randomColor(0, 80);
    ctx.lineWidth = random(2, 5);
    for (let i = 1; i <= numRings; i++) {
        const r = i * ringWidth;
        const numDashes = randomInt(4, 12);
        const dashAngle = (Math.PI * 2) / numDashes;
        for (let d = 0; d < numDashes; d++) {
            const start = d * dashAngle + random(0, 0.1);
            const end = start + dashAngle * random(0.3, 0.7);
            ctx.beginPath();
            ctx.arc(cx, cy, r, start, end);
            ctx.stroke();
        }
    }
}
function drawCenterDotWithRings(ctx, cx, cy, maxR) {
    ctx.fillStyle = randomColor(0, 60);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = randomColor(0, 80);
    ctx.lineWidth = random(2, 4);
    const numRings = randomInt(2, 5);
    for (let i = 1; i <= numRings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (i / numRings) * maxR, 0, Math.PI * 2);
        ctx.stroke();
    }
}
function drawQRLikeGrid(ctx, cx, cy, maxR) {
    const gridSize = randomInt(5, 10);
    const cellSize = (maxR * 2) / gridSize;
    const startX = cx - maxR;
    const startY = cy - maxR;
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (Math.random() > 0.5) {
                ctx.fillStyle = randomColor(0, 60);
                ctx.fillRect(startX + col * cellSize, startY + row * cellSize, cellSize, cellSize);
            }
        }
    }
    ctx.strokeStyle = randomColor(0, 60);
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, maxR * 2, maxR * 2);
}
const HARD_NEGATIVE_TYPES = [
    drawConcentricCircles,
    drawBullseye,
    drawSpiral,
    drawClockFace,
    drawDashedRings,
    drawCenterDotWithRings,
    drawQRLikeGrid,
];
function generateNegative(index, split) {
    const canvas = (0, canvas_1.createCanvas)(SIZE, SIZE);
    const ctx = canvas.getContext("2d");
    const bgColor = randomColor(150, 255);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, SIZE, SIZE);
    addBackgroundNoise(ctx, SIZE, SIZE);
    const cx = SIZE / 2 + random(-40, 40);
    const cy = SIZE / 2 + random(-40, 40);
    const maxR = random(40, 110);
    const drawFn = HARD_NEGATIVE_TYPES[randomInt(0, HARD_NEGATIVE_TYPES.length - 1)];
    drawFn(ctx, cx, cy, maxR);
    if (random(0, 1) > 0.5) {
        for (let i = 0; i < randomInt(1, 4); i++) {
            ctx.strokeStyle = randomColor(0, 150);
            ctx.lineWidth = random(1, 3);
            ctx.beginPath();
            ctx.moveTo(random(0, SIZE), random(0, SIZE));
            ctx.lineTo(random(0, SIZE), random(0, SIZE));
            ctx.stroke();
        }
    }
    addNoisePixels(ctx, SIZE, SIZE);
    const imgPath = path_1.default.join(OUT_DIR, "images", split, `${index}.png`);
    fs_1.default.writeFileSync(imgPath, canvas.toBuffer());
    const labelPath = path_1.default.join(OUT_DIR, "labels", split, `${index}.txt`);
    fs_1.default.writeFileSync(labelPath, "");
}
async function main() {
    for (const split of ["train", "val"]) {
        fs_1.default.mkdirSync(path_1.default.join(OUT_DIR, "images", split), { recursive: true });
        fs_1.default.mkdirSync(path_1.default.join(OUT_DIR, "labels", split), { recursive: true });
    }
    const posValStart = Math.floor(POSITIVE_COUNT * (1 - VAL_RATIO));
    const negValStart = Math.floor(NEGATIVE_COUNT * (1 - VAL_RATIO));
    console.log(`Generating ${POSITIVE_COUNT} positive samples...`);
    for (let i = 0; i < POSITIVE_COUNT; i++) {
        const split = i < posValStart ? "train" : "val";
        await generatePositive(i, split);
        if ((i + 1) % 200 === 0) {
            console.log(`  ${i + 1}/${POSITIVE_COUNT}`);
        }
    }
    console.log(`Generating ${NEGATIVE_COUNT} negative samples...`);
    for (let i = 0; i < NEGATIVE_COUNT; i++) {
        const split = i < negValStart ? "train" : "val";
        generateNegative(POSITIVE_COUNT + i, split);
        if ((i + 1) % 100 === 0) {
            console.log(`  ${i + 1}/${NEGATIVE_COUNT}`);
        }
    }
    const dataYaml = `path: ${path_1.default.resolve(OUT_DIR)}
train: images/train
val: images/val

kpt_shape: [4, 3]

nc: 1
names:
  0: circular_code
`;
    fs_1.default.writeFileSync(path_1.default.join(OUT_DIR, "data.yaml"), dataYaml);
    const manifest = {
        total: POSITIVE_COUNT + NEGATIVE_COUNT,
        positive: POSITIVE_COUNT,
        negative: NEGATIVE_COUNT,
        imageSize: SIZE,
        labelFormat: "yolo-pose: class cx cy w h kp1x kp1y kp1v kp2x kp2y kp2v kp3x kp3y kp3v kp4x kp4y kp4v",
        classMap: { 0: "circular_code" },
        keypointNames: ["top_left", "top_right", "bottom_right", "bottom_left"],
        trainCount: posValStart + negValStart,
        valCount: POSITIVE_COUNT - posValStart + (NEGATIVE_COUNT - negValStart),
    };
    fs_1.default.writeFileSync(path_1.default.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Done. ${POSITIVE_COUNT + NEGATIVE_COUNT} samples written to ${OUT_DIR}/`);
    console.log(`  Train: ${manifest.trainCount}, Val: ${manifest.valCount}`);
}
main();

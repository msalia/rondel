"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFrame = normalizeFrame;
/** Resizes an image buffer to a square of the target size using nearest-neighbor sampling. */
function normalizeFrame(frame, size = 320) {
    if (frame.width === size && frame.height === size)
        return frame;
    const out = new Uint8ClampedArray(size * size * 4);
    const scaleX = frame.width / size;
    const scaleY = frame.height / size;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sx = Math.min(Math.floor(x * scaleX), frame.width - 1);
            const sy = Math.min(Math.floor(y * scaleY), frame.height - 1);
            const srcIdx = (sy * frame.width + sx) * 4;
            const dstIdx = (y * size + x) * 4;
            out[dstIdx] = frame.data[srcIdx];
            out[dstIdx + 1] = frame.data[srcIdx + 1];
            out[dstIdx + 2] = frame.data[srcIdx + 2];
            out[dstIdx + 3] = frame.data[srcIdx + 3];
        }
    }
    return { data: out, width: size, height: size };
}

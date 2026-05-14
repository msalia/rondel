"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateCanvas = getOrCreateCanvas;
const cache = new Map();
/** Returns a cached canvas and context of the given size, creating one if needed. */
function getOrCreateCanvas(size, key = "default", ctxOptions) {
    let entry = cache.get(key);
    if (!entry || entry.canvas.width !== size || entry.canvas.height !== size) {
        const canvas = entry?.canvas ?? document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", ctxOptions);
        if (!ctx) {
            throw new Error(`Unable to get canvas context for "${key}"`);
        }
        entry = { canvas, ctx };
        cache.set(key, entry);
    }
    return entry;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.degToRad = degToRad;
exports.radToDeg = radToDeg;
exports.distance = distance;
/** Clamps a value between a minimum and maximum. */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/** Converts degrees to radians. */
function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}
/** Converts radians to degrees. */
function radToDeg(radians) {
    return (radians * 180) / Math.PI;
}
/** Returns the Euclidean distance between two points. */
function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_TABLE = exports.EXP_TABLE = void 0;
exports.gfMul = gfMul;
exports.gfDiv = gfDiv;
exports.gfPow = gfPow;
exports.gfInverse = gfInverse;
exports.gfPolyMul = gfPolyMul;
exports.gfPolyEval = gfPolyEval;
exports.gfPolyScale = gfPolyScale;
exports.gfPolyAdd = gfPolyAdd;
exports.generatorPoly = generatorPoly;
const GF_SIZE = 256;
const PRIM_POLY = 0x11d;
/** Exponentiation lookup table for GF(256) arithmetic. */
exports.EXP_TABLE = new Uint8Array(512);
/** Logarithm lookup table for GF(256) arithmetic. */
exports.LOG_TABLE = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
    exports.EXP_TABLE[i] = x;
    exports.LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 256)
        x ^= PRIM_POLY;
}
for (let i = 255; i < 512; i++) {
    exports.EXP_TABLE[i] = exports.EXP_TABLE[i - 255];
}
/** Multiplies two elements in GF(256). */
function gfMul(a, b) {
    if (a === 0 || b === 0)
        return 0;
    return exports.EXP_TABLE[exports.LOG_TABLE[a] + exports.LOG_TABLE[b]];
}
/** Divides two elements in GF(256). */
function gfDiv(a, b) {
    if (b === 0)
        throw new Error("Division by zero in GF(256)");
    if (a === 0)
        return 0;
    return exports.EXP_TABLE[(exports.LOG_TABLE[a] - exports.LOG_TABLE[b] + 255) % 255];
}
/** Raises a GF(256) element to the given power. */
function gfPow(a, n) {
    if (a === 0)
        return 0;
    return exports.EXP_TABLE[(exports.LOG_TABLE[a] * n) % 255];
}
/** Returns the multiplicative inverse of a GF(256) element. */
function gfInverse(a) {
    if (a === 0)
        throw new Error("Zero has no inverse in GF(256)");
    return exports.EXP_TABLE[255 - exports.LOG_TABLE[a]];
}
/** Multiplies two polynomials over GF(256). */
function gfPolyMul(p, q) {
    const result = new Array(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) {
        for (let j = 0; j < q.length; j++) {
            result[i + j] ^= gfMul(p[i], q[j]);
        }
    }
    return result;
}
/** Evaluates a GF(256) polynomial at a given point using Horner's method. */
function gfPolyEval(poly, x) {
    let result = poly[0];
    for (let i = 1; i < poly.length; i++) {
        result = gfMul(result, x) ^ poly[i];
    }
    return result;
}
/** Scales all coefficients of a GF(256) polynomial by a scalar. */
function gfPolyScale(poly, scalar) {
    return poly.map((c) => gfMul(c, scalar));
}
/** Adds two polynomials over GF(256) via XOR. */
function gfPolyAdd(p, q) {
    const result = new Array(Math.max(p.length, q.length)).fill(0);
    const pOff = result.length - p.length;
    const qOff = result.length - q.length;
    for (let i = 0; i < p.length; i++)
        result[pOff + i] ^= p[i];
    for (let i = 0; i < q.length; i++)
        result[qOff + i] ^= q[i];
    return result;
}
/** Builds the Reed-Solomon generator polynomial for a given number of ECC symbols. */
function generatorPoly(nsym) {
    let g = [1];
    for (let i = 0; i < nsym; i++) {
        g = gfPolyMul(g, [1, exports.EXP_TABLE[i]]);
    }
    return g;
}

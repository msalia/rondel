"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsEncode = rsEncode;
exports.rsDecode = rsDecode;
const galoisField_1 = require("./galoisField");
const constants_1 = require("../constants");
/** Encodes data with Reed-Solomon error correction parity bytes. */
function rsEncode(data, eccBytes = constants_1.DEFAULT_ECC_BYTES) {
    const gen = (0, galoisField_1.generatorPoly)(eccBytes);
    const output = new Uint8Array(data.length + eccBytes);
    output.set(data);
    const dividend = new Array(data.length + eccBytes).fill(0);
    for (let i = 0; i < data.length; i++)
        dividend[i] = data[i];
    for (let i = 0; i < data.length; i++) {
        const coef = dividend[i];
        if (coef === 0)
            continue;
        for (let j = 1; j < gen.length; j++) {
            dividend[i + j] ^= (0, galoisField_1.gfMul)(gen[j], coef);
        }
    }
    for (let i = 0; i < eccBytes; i++) {
        output[data.length + i] = dividend[data.length + i];
    }
    return output;
}
/** Decodes and corrects errors in a Reed-Solomon encoded message. */
function rsDecode(received, eccBytes = constants_1.DEFAULT_ECC_BYTES) {
    const n = received.length;
    const msg = Array.from(received);
    const syndromes = [];
    for (let i = 0; i < eccBytes; i++) {
        let val = 0;
        for (let j = 0; j < n; j++) {
            val = (0, galoisField_1.gfMul)(val, galoisField_1.EXP_TABLE[i]) ^ msg[j];
        }
        syndromes.push(val);
    }
    if (syndromes.every((s) => s === 0)) {
        return new Uint8Array(msg.slice(0, n - eccBytes));
    }
    const sigma = berlekampMassey(syndromes, eccBytes);
    const numErrors = sigma.length - 1;
    if (numErrors * 2 > eccBytes) {
        throw new Error("Too many errors to correct");
    }
    const errorPositions = chienSearch(sigma, n);
    if (errorPositions.length !== numErrors) {
        throw new Error(`Found ${errorPositions.length} errors but expected ${numErrors}`);
    }
    const omega = computeOmega(syndromes, sigma, eccBytes);
    applyForney(msg, errorPositions, sigma, omega, n);
    return new Uint8Array(msg.slice(0, n - eccBytes));
}
function berlekampMassey(syndromes, nsym) {
    let C = [1];
    let B = [1];
    let L = 0;
    let m = 1;
    let b = 1;
    for (let step = 0; step < nsym; step++) {
        let d = syndromes[step];
        for (let j = 1; j <= L; j++) {
            d ^= (0, galoisField_1.gfMul)(C[j], syndromes[step - j]);
        }
        if (d === 0) {
            m++;
        }
        else if (2 * L <= step) {
            const T = [...C];
            const coef = (0, galoisField_1.gfDiv)(d, b);
            while (C.length < B.length + m)
                C.push(0);
            for (let j = 0; j < B.length; j++) {
                C[j + m] ^= (0, galoisField_1.gfMul)(coef, B[j]);
            }
            L = step + 1 - L;
            B = T;
            b = d;
            m = 1;
        }
        else {
            const coef = (0, galoisField_1.gfDiv)(d, b);
            while (C.length < B.length + m)
                C.push(0);
            for (let j = 0; j < B.length; j++) {
                C[j + m] ^= (0, galoisField_1.gfMul)(coef, B[j]);
            }
            m++;
        }
    }
    return C;
}
function evalPolyLE(poly, x) {
    let result = 0;
    let xPow = 1;
    for (const coef of poly) {
        result ^= (0, galoisField_1.gfMul)(coef, xPow);
        xPow = (0, galoisField_1.gfMul)(xPow, x);
    }
    return result;
}
function chienSearch(sigma, msgLen) {
    const numErrors = sigma.length - 1;
    const positions = [];
    for (let i = 0; i < 255; i++) {
        if (evalPolyLE(sigma, galoisField_1.EXP_TABLE[i]) === 0) {
            const pos = (255 - i) % 255;
            if (pos < msgLen) {
                positions.push(pos);
            }
        }
    }
    return positions;
}
function computeOmega(syndromes, sigma, nsym) {
    const omega = new Array(nsym).fill(0);
    for (let i = 0; i < nsym; i++) {
        for (let j = 0; j < sigma.length; j++) {
            if (i + j < nsym) {
                omega[i + j] ^= (0, galoisField_1.gfMul)(syndromes[i], sigma[j]);
            }
        }
    }
    return omega;
}
function applyForney(msg, errorPositions, sigma, omega, n) {
    for (const pos of errorPositions) {
        const X = galoisField_1.EXP_TABLE[pos];
        const Xinv = (0, galoisField_1.gfInverse)(X);
        const omegaVal = evalPolyLE(omega, Xinv);
        let sigmaPrime = 0;
        let xPow = 1;
        for (let j = 1; j < sigma.length; j += 2) {
            sigmaPrime ^= (0, galoisField_1.gfMul)(sigma[j], xPow);
            xPow = (0, galoisField_1.gfMul)(xPow, (0, galoisField_1.gfMul)(Xinv, Xinv));
        }
        if (sigmaPrime === 0) {
            throw new Error("Cannot compute error magnitude");
        }
        const Y = (0, galoisField_1.gfMul)(X, (0, galoisField_1.gfDiv)(omegaVal, sigmaPrime));
        const arrayIdx = n - 1 - pos;
        if (arrayIdx >= 0 && arrayIdx < n) {
            msg[arrayIdx] ^= Y;
        }
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToBits = bytesToBits;
exports.bitsToBytes = bitsToBytes;
/** Converts an iterable of bytes into an array of individual bits. */
function bytesToBits(bytes) {
    const bits = [];
    for (const byte of bytes) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);
        }
    }
    return bits;
}
/** Converts an array of bits back into a Uint8Array of bytes. */
function bitsToBytes(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        let value = 0;
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
            value = (value << 1) | (bits[byteIndex * 8 + bitIndex] ?? 0);
        }
        bytes[byteIndex] = value;
    }
    return bytes;
}

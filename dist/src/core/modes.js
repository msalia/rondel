"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mode = void 0;
exports.detectMode = detectMode;
exports.isAllLowercase = isAllLowercase;
exports.packedByteCount = packedByteCount;
exports.packNumeric = packNumeric;
exports.packAlphanumeric = packAlphanumeric;
exports.unpackNumeric = unpackNumeric;
exports.unpackAlphanumeric = unpackAlphanumeric;
/** Encoding modes for packing characters more efficiently than raw UTF-8. */
exports.Mode = {
    NUMERIC: 0,
    ALPHANUMERIC: 1,
    BYTE: 2,
};
const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
/** Detects the most efficient encoding mode for the input string.
 *  Mixed-case strings (e.g., "Hello") fall back to byte mode since
 *  alphanumeric only preserves all-upper or all-lower case. */
function detectMode(input) {
    if (/^\d+$/.test(input))
        return exports.Mode.NUMERIC;
    const lower = input.toLowerCase();
    const upper = input.toUpperCase();
    if (input !== lower && input !== upper)
        return exports.Mode.BYTE;
    for (let i = 0; i < upper.length; i++) {
        if (ALPHANUMERIC_CHARS.indexOf(upper[i]) === -1)
            return exports.Mode.BYTE;
    }
    return exports.Mode.ALPHANUMERIC;
}
/** Returns true if the string is entirely lowercase (no uppercase letters). */
function isAllLowercase(input) {
    return input === input.toLowerCase() && input !== input.toUpperCase();
}
/** Returns the number of packed data bytes for a string in the given mode. */
function packedByteCount(charCount, mode) {
    if (mode === exports.Mode.NUMERIC) {
        const fullGroups = Math.floor(charCount / 3);
        const remainder = charCount % 3;
        const bits = fullGroups * 10 + (remainder === 2 ? 7 : remainder === 1 ? 4 : 0);
        return Math.ceil(bits / 8);
    }
    if (mode === exports.Mode.ALPHANUMERIC) {
        const pairs = Math.floor(charCount / 2);
        const odd = charCount % 2;
        const bits = pairs * 11 + odd * 6;
        return Math.ceil(bits / 8);
    }
    return charCount;
}
function bitsToPackedBytes(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
        let val = 0;
        for (let b = 0; b < 8; b++) {
            val = (val << 1) | (bits[i * 8 + b] ?? 0);
        }
        bytes[i] = val;
    }
    return bytes;
}
/** Packs a numeric string (digits only) into bytes. 3 digits → 10 bits. */
function packNumeric(input) {
    const bits = [];
    for (let i = 0; i < input.length; i += 3) {
        const group = input.slice(i, i + 3);
        const val = parseInt(group, 10);
        const numBits = group.length === 3 ? 10 : group.length === 2 ? 7 : 4;
        for (let b = numBits - 1; b >= 0; b--) {
            bits.push((val >> b) & 1);
        }
    }
    return bitsToPackedBytes(bits);
}
/** Packs an alphanumeric string into bytes. 2 chars → 11 bits. Input is uppercased. */
function packAlphanumeric(input) {
    const upper = input.toUpperCase();
    const bits = [];
    for (let i = 0; i < upper.length; i += 2) {
        const c1 = ALPHANUMERIC_CHARS.indexOf(upper[i]);
        if (i + 1 < upper.length) {
            const c2 = ALPHANUMERIC_CHARS.indexOf(upper[i + 1]);
            const val = c1 * 45 + c2;
            for (let b = 10; b >= 0; b--)
                bits.push((val >> b) & 1);
        }
        else {
            for (let b = 5; b >= 0; b--)
                bits.push((c1 >> b) & 1);
        }
    }
    return bitsToPackedBytes(bits);
}
/** Unpacks numeric data bytes back to a digit string. */
function unpackNumeric(data, charCount) {
    const bits = [];
    for (const byte of data) {
        for (let b = 7; b >= 0; b--)
            bits.push((byte >> b) & 1);
    }
    let result = "";
    let bitIdx = 0;
    let remaining = charCount;
    while (remaining >= 3) {
        let val = 0;
        for (let b = 0; b < 10; b++)
            val = (val << 1) | (bits[bitIdx++] ?? 0);
        result += val.toString().padStart(3, "0");
        remaining -= 3;
    }
    if (remaining === 2) {
        let val = 0;
        for (let b = 0; b < 7; b++)
            val = (val << 1) | (bits[bitIdx++] ?? 0);
        result += val.toString().padStart(2, "0");
    }
    else if (remaining === 1) {
        let val = 0;
        for (let b = 0; b < 4; b++)
            val = (val << 1) | (bits[bitIdx++] ?? 0);
        result += val.toString();
    }
    return result;
}
/** Unpacks alphanumeric data bytes back to a string (uppercased). */
function unpackAlphanumeric(data, charCount) {
    const bits = [];
    for (const byte of data) {
        for (let b = 7; b >= 0; b--)
            bits.push((byte >> b) & 1);
    }
    let result = "";
    let bitIdx = 0;
    let remaining = charCount;
    while (remaining >= 2) {
        let val = 0;
        for (let b = 0; b < 11; b++)
            val = (val << 1) | (bits[bitIdx++] ?? 0);
        result += ALPHANUMERIC_CHARS[Math.floor(val / 45)];
        result += ALPHANUMERIC_CHARS[val % 45];
        remaining -= 2;
    }
    if (remaining === 1) {
        let val = 0;
        for (let b = 0; b < 6; b++)
            val = (val << 1) | (bits[bitIdx++] ?? 0);
        result += ALPHANUMERIC_CHARS[val];
    }
    return result;
}

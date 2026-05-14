"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decode = decode;
const constants_1 = require("../constants");
const bitstream_1 = require("./bitstream");
const modes_1 = require("./modes");
const reedSolomon_1 = require("../ecc/reedSolomon");
/** Decodes a bit array back into a string using Reed-Solomon error correction. */
function decode(bits, eccBytes = constants_1.DEFAULT_ECC_BYTES) {
    const bytes = (0, bitstream_1.bitsToBytes)(bits);
    const decoded = (0, reedSolomon_1.rsDecode)(bytes, eccBytes);
    if (decoded.length < 2) {
        throw new Error("Decoded data too short for header");
    }
    const version = decoded[0];
    if (version !== 3) {
        throw new Error(`Unsupported version: ${version}. Only V3 is supported.`);
    }
    const modeByte = decoded[1];
    const modeField = (modeByte >> 6) & 0x3;
    const countField = modeByte & 0x3f;
    let charCount;
    let data;
    if (countField === 0x3f) {
        if (decoded.length < 3) {
            throw new Error("Decoded data too short for extended header");
        }
        charCount = decoded[2];
        data = decoded.slice(3);
    }
    else {
        charCount = countField;
        data = decoded.slice(2);
    }
    if (modeField === modes_1.Mode.NUMERIC) {
        return (0, modes_1.unpackNumeric)(data, charCount);
    }
    if (modeField === modes_1.Mode.ALPHANUMERIC || modeField === 3) {
        const text = (0, modes_1.unpackAlphanumeric)(data, charCount);
        return modeField === 3 ? text.toLowerCase() : text;
    }
    if (charCount > data.length) {
        throw new Error(`Invalid payload length: ${charCount}`);
    }
    return new TextDecoder().decode(data.slice(0, charCount));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decode = decode;
const bitstream_1 = require("./bitstream");
const constants_1 = require("../constants");
const modes_1 = require("./modes");
const reedSolomon_1 = require("../ecc/reedSolomon");
/** Decodes a bit array back into a string using Reed-Solomon error correction.
 *  Supports both v1 (byte-only) and v2 (numeric/alphanumeric/byte) formats. */
function decode(bits, eccBytes = constants_1.DEFAULT_ECC_BYTES) {
    const bytes = (0, bitstream_1.bitsToBytes)(bits);
    const decoded = (0, reedSolomon_1.rsDecode)(bytes, eccBytes);
    if (decoded.length < 2) {
        throw new Error("Decoded data too short for header");
    }
    const version = decoded[0];
    if (version === 1) {
        const length = decoded[1];
        if (2 + length > decoded.length) {
            throw new Error(`Invalid payload length: ${length}`);
        }
        return new TextDecoder().decode(decoded.slice(2, 2 + length));
    }
    if (version === 2) {
        const modeByte = decoded[1];
        const modeField = (modeByte >> 6) & 0x3;
        const charCount = modeByte & 0x3f;
        const data = decoded.slice(2);
        if (modeField === modes_1.Mode.NUMERIC) {
            return (0, modes_1.unpackNumeric)(data, charCount);
        }
        if (modeField === modes_1.Mode.ALPHANUMERIC || modeField === 3) {
            const text = (0, modes_1.unpackAlphanumeric)(data, charCount);
            return modeField === 3 ? text.toLowerCase() : text;
        }
        // Mode.BYTE
        if (charCount > data.length) {
            throw new Error(`Invalid payload length: ${charCount}`);
        }
        return new TextDecoder().decode(data.slice(0, charCount));
    }
    throw new Error(`Unsupported version: ${version}`);
}

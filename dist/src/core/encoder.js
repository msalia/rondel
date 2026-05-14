"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = encode;
const constants_1 = require("../constants");
const bitstream_1 = require("./bitstream");
const layout_1 = require("./layout");
const modes_1 = require("./modes");
const reedSolomon_1 = require("../ecc/reedSolomon");
/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte). */
function encode(input, opts = {}) {
    const { rings = constants_1.DEFAULT_RINGS, segmentsPerRing = constants_1.DEFAULT_SEGMENTS_PER_RING, eccBytes = constants_1.DEFAULT_ECC_BYTES, } = opts;
    const mode = (0, modes_1.detectMode)(input);
    let packedData;
    if (mode === modes_1.Mode.NUMERIC) {
        packedData = (0, modes_1.packNumeric)(input);
    }
    else if (mode === modes_1.Mode.ALPHANUMERIC) {
        packedData = (0, modes_1.packAlphanumeric)(input);
    }
    else {
        packedData = new TextEncoder().encode(input);
    }
    // Version 2 header: [version, (modeField << 6) | count]
    // modeField: 0=numeric, 1=alphanumeric, 2=byte, 3=alphanumeric+lowercase
    // count: char count for numeric/alphanumeric, byte count for byte mode
    let modeField = mode;
    if (mode === modes_1.Mode.ALPHANUMERIC && (0, modes_1.isAllLowercase)(input)) {
        modeField = 3;
    }
    const count = mode === modes_1.Mode.BYTE ? packedData.length : input.length;
    const header = new Uint8Array([2, (modeField << 6) | (count & 0x3f)]);
    const payload = new Uint8Array(header.length + packedData.length);
    payload.set(header);
    payload.set(packedData, header.length);
    const encoded = (0, reedSolomon_1.rsEncode)(payload, eccBytes);
    const bits = (0, bitstream_1.bytesToBits)(encoded);
    const capacity = (0, layout_1.getTotalSegments)(rings, segmentsPerRing);
    if (bits.length > capacity) {
        const availBytes = Math.floor(capacity / 8) - eccBytes - 2;
        const maxChars = mode === modes_1.Mode.BYTE ? availBytes : estimateMaxChars(availBytes, mode);
        throw new Error(`Data too large: ${bits.length} bits, grid holds ${capacity}. Max ~${Math.max(0, maxChars)} chars (${modeName(mode)} mode) with ${eccBytes} ECC bytes.`);
    }
    return { bits, rings, segmentsPerRing };
}
function estimateMaxChars(availBytes, mode) {
    const availBits = availBytes * 8;
    if (mode === modes_1.Mode.NUMERIC)
        return Math.floor(availBits / 10) * 3 + (availBits % 10 >= 7 ? 2 : availBits % 10 >= 4 ? 1 : 0);
    if (mode === modes_1.Mode.ALPHANUMERIC)
        return Math.floor(availBits / 11) * 2 + (availBits % 11 >= 6 ? 1 : 0);
    return availBytes;
}
function modeName(mode) {
    return mode === modes_1.Mode.NUMERIC ? "numeric" : mode === modes_1.Mode.ALPHANUMERIC ? "alphanumeric" : "byte";
}

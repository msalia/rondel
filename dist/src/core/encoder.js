"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = encode;
const constants_1 = require("../constants");
const autoSize_1 = require("./autoSize");
const bitstream_1 = require("./bitstream");
const layout_1 = require("./layout");
const modes_1 = require("./modes");
const reedSolomon_1 = require("../ecc/reedSolomon");
/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte).
 *  When rings/segments/eccBytes are omitted, auto-selects the smallest grid with
 *  optimal error correction that fits the input. */
function encode(input, opts = {}) {
    let rings;
    let segmentsPerRing;
    let eccBytes;
    if (opts.rings != null && opts.segmentsPerRing != null && opts.eccBytes != null) {
        rings = opts.rings;
        segmentsPerRing = opts.segmentsPerRing;
        eccBytes = opts.eccBytes;
    }
    else if (opts.rings != null) {
        rings = opts.rings;
        segmentsPerRing = opts.segmentsPerRing ?? constants_1.DEFAULT_SEGMENTS_PER_RING;
        eccBytes = opts.eccBytes ?? constants_1.DEFAULT_ECC_BYTES;
    }
    else {
        const sized = (0, autoSize_1.autoSize)(input, {
            segmentsPerRing: opts.segmentsPerRing,
            eccBytes: opts.eccBytes,
        });
        if (!sized) {
            throw new Error(`Input too large for any supported grid (max 16 rings). Try fewer ECC bytes or more segments.`);
        }
        rings = sized.rings;
        segmentsPerRing = sized.segmentsPerRing;
        eccBytes = sized.eccBytes;
    }
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
    let modeField = mode;
    if (mode === modes_1.Mode.ALPHANUMERIC && (0, modes_1.isAllLowercase)(input)) {
        modeField = 3;
    }
    const count = mode === modes_1.Mode.BYTE ? packedData.length : input.length;
    // V3 header: [version=3, (modeField<<6)|countLow, optional extendedCount]
    // count <= 62: 2-byte header (countLow = count)
    // count > 62:  3-byte header (countLow = 0x3F sentinel, byte 2 = actual count)
    let header;
    if (count <= 62) {
        header = new Uint8Array([3, (modeField << 6) | count]);
    }
    else {
        if (count > 255) {
            throw new Error(`Count too large: ${count}. Maximum is 255.`);
        }
        header = new Uint8Array([3, (modeField << 6) | 0x3f, count]);
    }
    const payload = new Uint8Array(header.length + packedData.length);
    payload.set(header);
    payload.set(packedData, header.length);
    const encoded = (0, reedSolomon_1.rsEncode)(payload, eccBytes);
    const bits = (0, bitstream_1.bytesToBits)(encoded);
    const capacity = (0, layout_1.getTotalSegments)(rings, segmentsPerRing);
    if (bits.length > capacity) {
        const headerBytes = header.length;
        const availBytes = Math.floor(capacity / 8) - eccBytes - headerBytes;
        const maxChars = mode === modes_1.Mode.BYTE ? availBytes : estimateMaxChars(availBytes, mode);
        throw new Error(`Data too large: ${bits.length} bits, grid holds ${capacity}. Max ~${Math.max(0, maxChars)} chars (${modeName(mode)} mode) with ${eccBytes} ECC bytes.`);
    }
    return { bits, rings, segmentsPerRing, eccBytes };
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

/** Decodes a bit array back into a string using Reed-Solomon error correction.
 *  Supports both v1 (byte-only) and v2 (numeric/alphanumeric/byte) formats. */
export declare function decode(bits: number[], eccBytes?: number): string;

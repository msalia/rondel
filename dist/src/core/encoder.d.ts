import type { CircularCodeOptions, EncodedCode } from "../types";
/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte). */
export declare function encode(input: string, opts?: CircularCodeOptions): EncodedCode;

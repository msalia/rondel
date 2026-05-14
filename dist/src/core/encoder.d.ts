import type { CircularCodeOptions, EncodedCode } from "../types";
/** Encodes a string into a circular code with Reed-Solomon error correction.
 *  Automatically selects the most efficient encoding mode (numeric, alphanumeric, or byte).
 *  When rings/segments/eccBytes are omitted, auto-selects the smallest grid with
 *  optimal error correction that fits the input. */
export declare function encode(input: string, opts?: CircularCodeOptions): EncodedCode;

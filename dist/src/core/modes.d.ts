/** Encoding modes for packing characters more efficiently than raw UTF-8. */
export declare const Mode: {
    readonly NUMERIC: 0;
    readonly ALPHANUMERIC: 1;
    readonly BYTE: 2;
};
export type ModeType = (typeof Mode)[keyof typeof Mode];
/** Detects the most efficient encoding mode for the input string.
 *  Mixed-case strings (e.g., "Hello") fall back to byte mode since
 *  alphanumeric only preserves all-upper or all-lower case. */
export declare function detectMode(input: string): ModeType;
/** Returns true if the string is entirely lowercase (no uppercase letters). */
export declare function isAllLowercase(input: string): boolean;
/** Returns the number of packed data bytes for a string in the given mode. */
export declare function packedByteCount(charCount: number, mode: ModeType): number;
/** Packs a numeric string (digits only) into bytes. 3 digits → 10 bits. */
export declare function packNumeric(input: string): Uint8Array;
/** Packs an alphanumeric string into bytes. 2 chars → 11 bits. Input is uppercased. */
export declare function packAlphanumeric(input: string): Uint8Array;
/** Unpacks numeric data bytes back to a digit string. */
export declare function unpackNumeric(data: Uint8Array, charCount: number): string;
/** Unpacks alphanumeric data bytes back to a string (uppercased). */
export declare function unpackAlphanumeric(data: Uint8Array, charCount: number): string;

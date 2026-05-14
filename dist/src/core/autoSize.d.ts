export type AutoSizeResult = {
    rings: number;
    segmentsPerRing: number;
    eccBytes: number;
    capacityBits: number;
    usedBits: number;
};
/** Computes the packed data size in bytes (header + mode-packed payload, no ECC). */
export declare function computeDataBytes(input: string): number;
/** Computes the total bits needed to encode a string (header + packed data + ECC). */
export declare function computeNeededBits(input: string, eccBytes: number): number;
/** Returns the minimum number of rings needed to hold the given number of bits
 *  within the given range. */
export declare function minRingsForBits(neededBits: number, segmentsPerRing: number, minRings?: number, maxRings?: number): number | null;
/** Auto-selects the smallest grid configuration that fits the input.
 *
 *  Aesthetic constraints: rings [4,8], segments [32,48], ECC [2,8].
 *  Picks the fewest rings, then fills remaining capacity with ECC.
 *
 *  Any parameter can be pinned by passing it explicitly. */
export declare function autoSize(input: string, opts?: {
    segmentsPerRing?: number;
    eccBytes?: number;
}): AutoSizeResult | null;

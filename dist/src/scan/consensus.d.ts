import type { ConsensusResult, ScanResult } from "../types";
/** Accumulates scan results across frames and returns a result when consensus is reached. */
export declare class MultiFrameConsensus {
    private buffer;
    private readonly bufferSize;
    private readonly requiredAgreement;
    constructor(bufferSize?: number, requiredAgreement?: number);
    /** Adds a scan result and returns consensus if agreement threshold is met. */
    push(result: ScanResult): ConsensusResult | null;
    /** Checks the current buffer for consensus without adding a new result. */
    evaluate(): ConsensusResult | null;
    /** Clears all buffered scan results. */
    reset(): void;
    /** Returns the number of results currently in the buffer. */
    get size(): number;
}

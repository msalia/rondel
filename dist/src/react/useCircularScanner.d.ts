import type { ConsensusResult, ScanOptions } from "../types";
/** React hook for scanning circular codes from a camera feed. */
export declare function useCircularScanner(options?: ScanOptions): {
    videoRef: import("react").RefObject<HTMLVideoElement | null>;
    result: ConsensusResult | null;
    scanning: boolean;
};

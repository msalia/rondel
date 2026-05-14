/** Default number of concentric rings (including the ring-0 spacer). */
export declare const DEFAULT_RINGS = 5;
/** Default number of segments on the outermost data ring. */
export declare const DEFAULT_SEGMENTS_PER_RING = 48;
/** Default number of Reed-Solomon error correction bytes. */
export declare const DEFAULT_ECC_BYTES = 4;
/** Default output size (pixels) for rectified/rendered images. */
export declare const DEFAULT_CODE_SIZE = 300;
/** Default capture size (pixels) for video frame capture. */
export declare const DEFAULT_CAPTURE_SIZE = 320;
/** Minimum detection confidence to consider a code found. */
export declare const CONFIDENCE_THRESHOLD = 0.5;
/** Default padding factor for corner estimation from circle geometry. */
export declare const DEFAULT_CORNER_PADDING = 1.15;
/** Default minimum frame quality score for accepting a decode. */
export declare const DEFAULT_MIN_FRAME_SCORE = 0.3;
/** Default rolling buffer size for multi-frame consensus. */
export declare const DEFAULT_CONSENSUS_SIZE = 7;
/** Default number of agreeing frames required for consensus. */
export declare const DEFAULT_CONSENSUS_REQUIRED = 3;
/** Video scan timeout in milliseconds. */
export declare const SCAN_TIMEOUT_MS = 30000;

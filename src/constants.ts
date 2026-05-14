/** Default number of concentric rings (including the ring-0 spacer). */
export const DEFAULT_RINGS = 5;

/** Default number of segments on the outermost data ring. */
export const DEFAULT_SEGMENTS_PER_RING = 48;

/** Default number of Reed-Solomon error correction bytes. */
export const DEFAULT_ECC_BYTES = 4;

/** Default output size (pixels) for rectified/rendered images. */
export const DEFAULT_CODE_SIZE = 300;

/** Default capture size (pixels) for video frame capture. */
export const DEFAULT_CAPTURE_SIZE = 320;

/** Minimum detection confidence to consider a code found. */
export const CONFIDENCE_THRESHOLD = 0.5;

/** Default padding factor for corner estimation from circle geometry. */
export const DEFAULT_CORNER_PADDING = 1.15;

/** Default minimum frame quality score for accepting a decode. */
export const DEFAULT_MIN_FRAME_SCORE = 0.3;

/** Default rolling buffer size for multi-frame consensus. */
export const DEFAULT_CONSENSUS_SIZE = 7;

/** Default number of agreeing frames required for consensus. */
export const DEFAULT_CONSENSUS_REQUIRED = 3;

/** Video scan timeout in milliseconds. */
export const SCAN_TIMEOUT_MS = 30_000;

/** Auto-sizing: minimum number of rings. */
export const AUTO_MIN_RINGS = 4;

/** Auto-sizing: maximum number of rings. */
export const AUTO_MAX_RINGS = 8;

/** Auto-sizing: minimum ECC bytes. */
export const AUTO_MIN_ECC = 2;

/** Auto-sizing: maximum ECC bytes. */
export const AUTO_MAX_ECC = 8;

/** Auto-sizing: segment counts to search across. */
export const AUTO_SEGMENT_CANDIDATES = [32, 48] as const;

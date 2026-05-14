"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_SEGMENT_CANDIDATES = exports.AUTO_MAX_ECC = exports.AUTO_MIN_ECC = exports.AUTO_MAX_RINGS = exports.AUTO_MIN_RINGS = exports.SCAN_TIMEOUT_MS = exports.DEFAULT_CONSENSUS_REQUIRED = exports.DEFAULT_CONSENSUS_SIZE = exports.DEFAULT_MIN_FRAME_SCORE = exports.DEFAULT_CORNER_PADDING = exports.CONFIDENCE_THRESHOLD = exports.DEFAULT_CAPTURE_SIZE = exports.DEFAULT_CODE_SIZE = exports.DEFAULT_ECC_BYTES = exports.DEFAULT_SEGMENTS_PER_RING = exports.DEFAULT_RINGS = void 0;
/** Default number of concentric rings (including the ring-0 spacer). */
exports.DEFAULT_RINGS = 5;
/** Default number of segments on the outermost data ring. */
exports.DEFAULT_SEGMENTS_PER_RING = 48;
/** Default number of Reed-Solomon error correction bytes. */
exports.DEFAULT_ECC_BYTES = 4;
/** Default output size (pixels) for rectified/rendered images. */
exports.DEFAULT_CODE_SIZE = 300;
/** Default capture size (pixels) for video frame capture. */
exports.DEFAULT_CAPTURE_SIZE = 320;
/** Minimum detection confidence to consider a code found. */
exports.CONFIDENCE_THRESHOLD = 0.5;
/** Default padding factor for corner estimation from circle geometry. */
exports.DEFAULT_CORNER_PADDING = 1.15;
/** Default minimum frame quality score for accepting a decode. */
exports.DEFAULT_MIN_FRAME_SCORE = 0.3;
/** Default rolling buffer size for multi-frame consensus. */
exports.DEFAULT_CONSENSUS_SIZE = 7;
/** Default number of agreeing frames required for consensus. */
exports.DEFAULT_CONSENSUS_REQUIRED = 3;
/** Video scan timeout in milliseconds. */
exports.SCAN_TIMEOUT_MS = 30000;
/** Auto-sizing: minimum number of rings. */
exports.AUTO_MIN_RINGS = 4;
/** Auto-sizing: maximum number of rings. */
exports.AUTO_MAX_RINGS = 8;
/** Auto-sizing: minimum ECC bytes. */
exports.AUTO_MIN_ECC = 2;
/** Auto-sizing: maximum ECC bytes. */
exports.AUTO_MAX_ECC = 8;
/** Auto-sizing: segment counts to search across. */
exports.AUTO_SEGMENT_CANDIDATES = [32, 48];

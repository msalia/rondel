"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCircularScanner = useCircularScanner;
const react_1 = require("react");
const constants_1 = require("../constants");
const detector_1 = require("../ml/detector");
const scan_1 = require("../scan");
const consensus_1 = require("../scan/consensus");
/** React hook for scanning circular codes from a camera feed. */
function useCircularScanner(options = {}) {
    const videoRef = (0, react_1.useRef)(null);
    const [result, setResult] = (0, react_1.useState)(null);
    const [scanning, setScanning] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let running = true;
        let rafId = 0;
        const consensus = new consensus_1.MultiFrameConsensus(options.consensusSize ?? constants_1.DEFAULT_CONSENSUS_SIZE, options.consensusRequired ?? constants_1.DEFAULT_CONSENSUS_REQUIRED);
        const minFrameScore = options.minFrameScore ?? constants_1.DEFAULT_MIN_FRAME_SCORE;
        async function start() {
            if (options.modelUrl && !(0, detector_1.isModelLoaded)()) {
                await (0, detector_1.loadModel)(options.modelUrl);
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            if (!videoRef.current || !running) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
            rafId = requestAnimationFrame(loop);
        }
        function loop() {
            if (!running || !videoRef.current)
                return;
            try {
                const frame = (0, scan_1.scanFrame)(videoRef.current, {
                    rings: options.rings,
                    segmentsPerRing: options.segmentsPerRing,
                    eccBytes: options.eccBytes,
                });
                if (frame.decoded && frame.frameScore.overall >= minFrameScore) {
                    const consensusResult = consensus.push({
                        data: frame.decoded,
                        confidence: frame.detection.confidence,
                        frameScore: frame.frameScore,
                    });
                    if (consensusResult) {
                        setResult(consensusResult);
                        setScanning(false);
                        return;
                    }
                }
            }
            catch (e) {
                if (e instanceof Error && e.message.includes("Cannot read prop"))
                    throw e;
            }
            rafId = requestAnimationFrame(loop);
        }
        start();
        return () => {
            running = false;
            cancelAnimationFrame(rafId);
            setScanning(false);
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject;
                stream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);
    return { videoRef, result, scanning };
}

import type { ConsensusResult, ScanOptions } from "@/types";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_CONSENSUS_REQUIRED, DEFAULT_CONSENSUS_SIZE, DEFAULT_MIN_FRAME_SCORE } from "@/constants";
import { isModelLoaded, loadModel } from "@/ml/detector";
import { scanFrame } from "@/scan";
import { MultiFrameConsensus } from "@/scan/consensus";

/** React hook for scanning circular codes from a camera feed. */
export function useCircularScanner(options: ScanOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [result, setResult] = useState<ConsensusResult | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let running = true;
    let rafId = 0;
    const consensus = new MultiFrameConsensus(
      options.consensusSize ?? DEFAULT_CONSENSUS_SIZE,
      options.consensusRequired ?? DEFAULT_CONSENSUS_REQUIRED,
    );
    const minFrameScore = options.minFrameScore ?? DEFAULT_MIN_FRAME_SCORE;

    async function start() {
      if (options.modelUrl && !isModelLoaded()) {
        await loadModel(options.modelUrl);
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
      if (!running || !videoRef.current) return;

      try {
        const frame = scanFrame(videoRef.current, {
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
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("Cannot read prop")) throw e;
      }

      rafId = requestAnimationFrame(loop);
    }

    start();

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      setScanning(false);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoRef, result, scanning };
}

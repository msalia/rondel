"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiFrameConsensus = void 0;
/** Accumulates scan results across frames and returns a result when consensus is reached. */
class MultiFrameConsensus {
    constructor(bufferSize = 7, requiredAgreement = 3) {
        this.buffer = [];
        this.bufferSize = bufferSize;
        this.requiredAgreement = requiredAgreement;
    }
    /** Adds a scan result and returns consensus if agreement threshold is met. */
    push(result) {
        this.buffer.push(result);
        if (this.buffer.length > this.bufferSize) {
            this.buffer.shift();
        }
        return this.evaluate();
    }
    /** Checks the current buffer for consensus without adding a new result. */
    evaluate() {
        const counts = new Map();
        for (const entry of this.buffer) {
            const existing = counts.get(entry.data) ?? { count: 0, totalScore: 0 };
            existing.count++;
            existing.totalScore += entry.frameScore.overall;
            counts.set(entry.data, existing);
        }
        let bestData = null;
        let bestCount = 0;
        let bestScore = 0;
        for (const [data, { count, totalScore }] of counts) {
            if (count > bestCount || (count === bestCount && totalScore > bestScore)) {
                bestData = data;
                bestCount = count;
                bestScore = totalScore;
            }
        }
        if (bestData !== null && bestCount >= this.requiredAgreement) {
            return {
                data: bestData,
                agreement: bestCount / this.buffer.length,
                frameCount: this.buffer.length,
            };
        }
        return null;
    }
    /** Clears all buffered scan results. */
    reset() {
        this.buffer = [];
    }
    /** Returns the number of results currently in the buffer. */
    get size() {
        return this.buffer.length;
    }
}
exports.MultiFrameConsensus = MultiFrameConsensus;

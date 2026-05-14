"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_INPUT_SIZE = void 0;
exports.loadModel = loadModel;
exports.loadModelFromFiles = loadModelFromFiles;
exports.isModelLoaded = isModelLoaded;
exports.getLoadedModel = getLoadedModel;
exports.runModelPrediction = runModelPrediction;
exports.parseDetections = parseDetections;
exports.detectWithModel = detectWithModel;
const tf = __importStar(require("@tensorflow/tfjs"));
/** Input image size expected by the YOLO model. */
exports.MODEL_INPUT_SIZE = 320;
let model = null;
/** Loads a TF.js model from a URL or file path. */
async function loadModel(modelPath = "/models/circular_code/model.json") {
    if (typeof window === "undefined" && !modelPath.startsWith("http")) {
        const { loadModelFromDisk } = await Promise.resolve().then(() => __importStar(require("./nodeLoader")));
        model = await loadModelFromDisk(modelPath);
    }
    else {
        model = await loadModelFromSource(modelPath);
    }
}
/** Loads a model from in-memory buffers. */
async function loadModelFromFiles(modelJSON, weightSpecs, weightData) {
    model = await loadModelFromSource(tf.io.fromMemory({ modelTopology: modelJSON, weightSpecs, weightData }));
}
async function loadModelFromSource(source) {
    try {
        return await tf.loadGraphModel(source);
    }
    catch {
        return await tf.loadLayersModel(source);
    }
}
/** Returns true if a detection model has been loaded. */
function isModelLoaded() {
    return model !== null;
}
/** Returns the loaded model instance, or null. */
function getLoadedModel() {
    return model;
}
/** Runs a model prediction on a tensor input and returns the primary output tensor. */
function runModelPrediction(mdl, input) {
    const pred = mdl.predict(input);
    if (Array.isArray(pred))
        return pred[0];
    if (pred instanceof tf.Tensor)
        return pred;
    const values = Object.values(pred);
    return values[0];
}
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
/** Parses YOLO output tensor into the best detection above a confidence threshold. */
function parseDetections(outputData, outputShape, frameW, frameH, confThreshold) {
    const channels = outputShape[1];
    const numCandidates = outputShape[2];
    const threshold = confThreshold ?? 0.5;
    // Determine format by channel count:
    // Standard YOLO:     [1, 5, N] = cx, cy, w, h, class
    // YOLO-OBB:          [1, 6, N] = cx, cy, w, h, angle, class
    // YOLO-Pose (4 kps): [1, 17, N] = cx, cy, w, h, class, 4*(x,y,conf)
    // Pose channels = 5 + numKeypoints*3, where numKeypoints*3 is divisible by 3
    const extraChannels = channels - 5;
    const hasPose = extraChannels >= 3 && extraChannels % 3 === 0;
    const hasAngle = !hasPose && channels === 6;
    const confChannel = hasAngle ? 5 : 4;
    const numKeypoints = hasPose ? extraChannels / 3 : 0;
    let bestConf = threshold;
    let bestIdx = -1;
    for (let i = 0; i < numCandidates; i++) {
        const raw = outputData[confChannel * numCandidates + i];
        const conf = sigmoid(raw);
        if (conf > bestConf) {
            bestConf = conf;
            bestIdx = i;
        }
    }
    if (bestIdx < 0)
        return null;
    const cx = outputData[0 * numCandidates + bestIdx];
    const cy = outputData[1 * numCandidates + bestIdx];
    const w = outputData[2 * numCandidates + bestIdx];
    const h = outputData[3 * numCandidates + bestIdx];
    const scaleX = frameW / exports.MODEL_INPUT_SIZE;
    const scaleY = frameH / exports.MODEL_INPUT_SIZE;
    const result = {
        cx: cx * scaleX,
        cy: cy * scaleY,
        r: Math.min(w * scaleX, h * scaleY) / 2,
        confidence: bestConf,
    };
    if (hasAngle) {
        result.angle = outputData[4 * numCandidates + bestIdx];
    }
    if (hasPose && numKeypoints >= 4) {
        const corners = [];
        for (let kp = 0; kp < 4; kp++) {
            const xCh = 5 + kp * 3;
            const yCh = 6 + kp * 3;
            corners.push({
                x: outputData[xCh * numCandidates + bestIdx] * scaleX,
                y: outputData[yCh * numCandidates + bestIdx] * scaleY,
            });
        }
        result.corners = corners;
    }
    return result;
}
function bufferToTensor(buf) {
    const { data, width, height } = buf;
    const floats = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
        const src = i * 4;
        const dst = i * 3;
        floats[dst] = data[src] / 255.0;
        floats[dst + 1] = data[src + 1] / 255.0;
        floats[dst + 2] = data[src + 2] / 255.0;
    }
    return tf.tensor4d(floats, [1, height, width, 3]);
}
/** Runs the loaded ML model on an ImageBuffer and returns a detection result. */
function detectWithModel(buf) {
    if (!model)
        return null;
    let result = null;
    tf.tidy(() => {
        const input = buf.width === exports.MODEL_INPUT_SIZE && buf.height === exports.MODEL_INPUT_SIZE
            ? bufferToTensor(buf)
            : bufferToTensor(buf).resizeBilinear([exports.MODEL_INPUT_SIZE, exports.MODEL_INPUT_SIZE]);
        const pred = runModelPrediction(model, input);
        const data = pred.dataSync();
        const shape = pred.shape;
        result = parseDetections(data, shape, buf.width, buf.height);
    });
    return result;
}

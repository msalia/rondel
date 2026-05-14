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
exports.loadModelFromDisk = loadModelFromDisk;
const tf = __importStar(require("@tensorflow/tfjs"));
async function loadModelFromDisk(modelJsonPath) {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const raw = fs.readFileSync(modelJsonPath, "utf-8");
    const modelJSON = JSON.parse(raw);
    const dir = path.dirname(modelJsonPath);
    const manifest = modelJSON.weightsManifest[0];
    const shardPaths = manifest.paths;
    const buffers = shardPaths.map((p) => fs.readFileSync(path.join(dir, p)));
    const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const weightData = new ArrayBuffer(totalBytes);
    const view = new Uint8Array(weightData);
    let offset = 0;
    for (const buf of buffers) {
        view.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), offset);
        offset += buf.byteLength;
    }
    const weightSpecs = manifest.weights;
    if (modelJSON.format === "graph-model" || modelJSON.modelTopology?.node) {
        return await tf.loadGraphModel(tf.io.fromMemory(modelJSON.modelTopology, weightSpecs, weightData));
    }
    else {
        return await tf.loadLayersModel(tf.io.fromMemory({
            modelTopology: modelJSON.modelTopology,
            weightSpecs,
            weightData,
        }));
    }
}

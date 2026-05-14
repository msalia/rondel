import type { DetectionResult, ImageBuffer } from "../types";
import * as tf from "@tensorflow/tfjs";
/** Input image size expected by the YOLO model. */
export declare const MODEL_INPUT_SIZE = 320;
/** Loads a TF.js model from a URL or file path. */
export declare function loadModel(modelPath?: string): Promise<void>;
/** Loads a model from in-memory buffers. */
export declare function loadModelFromFiles(modelJSON: object, weightSpecs: tf.io.WeightsManifestEntry[], weightData: ArrayBuffer): Promise<void>;
/** Returns true if a detection model has been loaded. */
export declare function isModelLoaded(): boolean;
/** Returns the loaded model instance, or null. */
export declare function getLoadedModel(): tf.GraphModel | tf.LayersModel | null;
/** Runs a model prediction on a tensor input and returns the primary output tensor. */
export declare function runModelPrediction(mdl: tf.GraphModel | tf.LayersModel, input: tf.Tensor): tf.Tensor;
/** Parses YOLO output tensor into the best detection above a confidence threshold. */
export declare function parseDetections(outputData: Float32Array | Int32Array | Uint8Array, outputShape: number[], frameW: number, frameH: number, confThreshold?: number): DetectionResult | null;
/** Runs the loaded ML model on an ImageBuffer and returns a detection result. */
export declare function detectWithModel(buf: ImageBuffer): DetectionResult | null;

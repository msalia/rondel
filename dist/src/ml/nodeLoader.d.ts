import * as tf from "@tensorflow/tfjs";
export declare function loadModelFromDisk(modelJsonPath: string): Promise<tf.GraphModel | tf.LayersModel>;

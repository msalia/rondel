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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tf = __importStar(require("@tensorflow/tfjs"));
const canvas_1 = require("canvas");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATASET_DIR = "./dataset";
const MODEL_OUT = "./models/circular_code";
const IMAGE_SIZE = 96;
const BATCH_SIZE = 32;
const EPOCHS = 20;
const LEARNING_RATE = 0.002;
const VALIDATION_SPLIT = 0.15;
function loadManifest() {
    const raw = fs_1.default.readFileSync(path_1.default.join(DATASET_DIR, "manifest.json"), "utf-8");
    return JSON.parse(raw);
}
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
async function preloadDataset() {
    const manifest = loadManifest();
    const indices = shuffle(Array.from({ length: manifest.total }, (_, i) => i));
    const valCount = Math.floor(indices.length * VALIDATION_SPLIT);
    const allPixels = new Float32Array(manifest.total * IMAGE_SIZE * IMAGE_SIZE * 3);
    const allLabels = [];
    console.log(`Preloading ${manifest.total} images at ${IMAGE_SIZE}x${IMAGE_SIZE}...`);
    for (let s = 0; s < indices.length; s++) {
        const idx = indices[s];
        const imgPath = path_1.default.join(DATASET_DIR, "images", `${idx}.png`);
        const lblPath = path_1.default.join(DATASET_DIR, "labels", `${idx}.txt`);
        const img = await (0, canvas_1.loadImage)(imgPath);
        const canvas = (0, canvas_1.createCanvas)(IMAGE_SIZE, IMAGE_SIZE);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        const pixels = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
        const offset = s * IMAGE_SIZE * IMAGE_SIZE * 3;
        for (let i = 0; i < IMAGE_SIZE * IMAGE_SIZE; i++) {
            allPixels[offset + i * 3] = pixels.data[i * 4] / 255;
            allPixels[offset + i * 3 + 1] = pixels.data[i * 4 + 1] / 255;
            allPixels[offset + i * 3 + 2] = pixels.data[i * 4 + 2] / 255;
        }
        const parts = fs_1.default.readFileSync(lblPath, "utf-8").trim().split(" ").map(Number);
        allLabels.push(parts);
        if ((s + 1) % 500 === 0)
            console.log(`  ${s + 1}/${manifest.total}`);
    }
    const trainCount = manifest.total - valCount;
    const trainX = tf.tensor4d(allPixels.slice(0, trainCount * IMAGE_SIZE * IMAGE_SIZE * 3), [trainCount, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const trainY = tf.tensor2d(allLabels.slice(0, trainCount));
    const valX = tf.tensor4d(allPixels.slice(trainCount * IMAGE_SIZE * IMAGE_SIZE * 3), [valCount, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const valY = tf.tensor2d(allLabels.slice(trainCount));
    console.log(`Train: ${trainCount}, Val: ${valCount}\n`);
    return { trainX, trainY, valX, valY };
}
function buildModel() {
    const model = tf.sequential();
    model.add(tf.layers.conv2d({
        inputShape: [IMAGE_SIZE, IMAGE_SIZE, 3],
        filters: 16,
        kernelSize: 3,
        strides: 2,
        padding: "same",
        activation: "relu",
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        strides: 2,
        padding: "same",
        activation: "relu",
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.conv2d({
        filters: 64,
        kernelSize: 3,
        strides: 2,
        padding: "same",
        activation: "relu",
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.globalAveragePooling2d({}));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: 7, activation: "linear" }));
    return model;
}
function combinedLoss(yTrue, yPred) {
    const classTrue = yTrue.slice([0, 0], [-1, 1]);
    const classPred = yPred.slice([0, 0], [-1, 1]);
    const classLoss = tf.losses.sigmoidCrossEntropy(classTrue, classPred);
    const bboxTrue = yTrue.slice([0, 1], [-1, 4]);
    const bboxPred = yPred.slice([0, 1], [-1, 4]);
    const mask = classTrue.squeeze();
    const bboxDiff = bboxTrue.sub(bboxPred).square().sum(-1);
    const bboxLoss = bboxDiff.mul(mask).mean();
    const angleTrue = yTrue.slice([0, 5], [-1, 2]);
    const anglePred = yPred.slice([0, 5], [-1, 2]);
    const angleDiff = angleTrue.sub(anglePred).square().sum(-1);
    const angleLoss = angleDiff.mul(mask).mean();
    return classLoss.add(bboxLoss.mul(5)).add(angleLoss.mul(2));
}
async function train() {
    const { trainX, trainY, valX, valY } = await preloadDataset();
    const model = buildModel();
    model.summary();
    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: combinedLoss,
    });
    let bestValLoss = Infinity;
    const modelOutPath = `file://${path_1.default.resolve(MODEL_OUT)}`;
    console.log("\nStarting training...\n");
    await model.fit(trainX, trainY, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        shuffle: true,
        validationData: [valX, valY],
        callbacks: {
            onEpochEnd: async (epoch, logs) => {
                const trainLoss = logs?.loss?.toFixed(4) ?? "?";
                const valLoss = logs?.val_loss?.toFixed(4) ?? "?";
                console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${trainLoss} - val_loss: ${valLoss}`);
                if (logs?.val_loss != null && logs.val_loss < bestValLoss) {
                    bestValLoss = logs.val_loss;
                    await model.save(modelOutPath);
                    console.log(`  Saved best model (val_loss: ${bestValLoss.toFixed(4)})`);
                }
            },
        },
    });
    trainX.dispose();
    trainY.dispose();
    valX.dispose();
    valY.dispose();
    console.log(`\nTraining complete. Best val_loss: ${bestValLoss.toFixed(4)}`);
    console.log(`Model saved to ${MODEL_OUT}/`);
}
train().catch(console.error);

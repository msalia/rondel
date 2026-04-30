#!/usr/bin/env python3
"""
Export a trained YOLOv8 checkpoint to TensorFlow.js format.

Usage:
    python training/export.py
    python training/export.py --checkpoint runs/pose/runs/train/circular_code/weights/best.pt
    python training/export.py --output ./models/circular_code
"""

import argparse
import os
import shutil
import ssl
import sys
import types

ssl._create_default_https_context = ssl._create_unverified_context

from ultralytics import YOLO

IMAGE_SIZE = 320

CHECKPOINT_CANDIDATES = [
    os.path.join("runs", "pose", "runs", "train", "circular_code", "weights", "best.pt"),
    os.path.join("runs", "pose", "circular_code", "weights", "best.pt"),
    os.path.join("runs", "train", "circular_code", "weights", "best.pt"),
]


def main():
    parser = argparse.ArgumentParser(description="Export trained model to TF.js")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=None,
        help="Path to .pt checkpoint (auto-detected if omitted)",
    )
    parser.add_argument(
        "--output", default="./models/circular_code", help="TF.js model output directory"
    )
    args = parser.parse_args()

    if args.checkpoint:
        best_pt = args.checkpoint
    else:
        best_pt = next((p for p in CHECKPOINT_CANDIDATES if os.path.exists(p)), None)

    if not best_pt or not os.path.exists(best_pt):
        print(f"Error: checkpoint not found. Searched: {CHECKPOINT_CANDIDATES}")
        return

    print(f"Checkpoint: {best_pt}")
    print("Exporting to TensorFlow SavedModel + TF.js...")

    best_model = YOLO(best_pt)
    best_model.export(format="saved_model", imgsz=IMAGE_SIZE)

    saved_model_dir = os.path.join(os.path.dirname(best_pt), "best_saved_model")
    tfjs_dir = os.path.join(os.path.dirname(best_pt), "best_web_model")

    sys.modules["tensorflow_decision_forests"] = types.ModuleType("tensorflow_decision_forests")
    from tensorflowjs.converters import converter

    converter.convert([
        "--input_format=tf_saved_model",
        "--output_format=tfjs_graph_model",
        "--signature_name=serving_default",
        "--saved_model_tags=serve",
        "--weight_shard_size_bytes=4194304",
        saved_model_dir,
        tfjs_dir,
    ])

    os.makedirs(args.output, exist_ok=True)
    for f in os.listdir(tfjs_dir):
        if f.endswith((".json", ".bin")):
            src = os.path.join(tfjs_dir, f)
            dst = os.path.join(args.output, f)
            shutil.copy2(src, dst)
            size = os.path.getsize(dst)
            print(f"  {f} ({size:,} bytes)")

    print(f"\nDone! TF.js model exported to {args.output}/")


if __name__ == "__main__":
    main()

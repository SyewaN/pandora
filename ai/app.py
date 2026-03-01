from __future__ import annotations

import json
import os
import random
import threading
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_IMPORT_ERROR = None
forecaster = None
model_config = None
training_lock = threading.Lock()
training_state: Dict[str, Any] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "last_error": None,
    "last_result": None,
}

try:
    from model import LSTMForecaster, ModelConfig

    ROOT = Path(__file__).resolve().parent.parent
    model_config = ModelConfig(
        model_path=os.getenv("AI_MODEL_PATH", str(ROOT / "ai" / "model" / "lstm_model.h5")),
        scaler_path=os.getenv("AI_SCALER_PATH", str(ROOT / "ai" / "model" / "scaler.pkl")),
        sequence_length=int(os.getenv("AI_SEQUENCE_LENGTH", "10")),
        forecast_steps=int(os.getenv("AI_FORECAST_STEPS", "3")),
        features=3,
    )
    forecaster = LSTMForecaster(model_config)
    forecaster.load()
except Exception as exc:  # pylint: disable=broad-except
    MODEL_IMPORT_ERROR = str(exc)


def _demo_predict(seed: Dict[str, float], steps: int = 3) -> Dict[str, Any]:
    return {
        "predictions": [
            {
                "tds": seed["tds"] * (1 + random.uniform(-0.1, 0.1)),
                "temperature": seed["temperature"] * (1 + random.uniform(-0.05, 0.05)),
                "moisture": seed["moisture"] * (1 + random.uniform(-0.1, 0.1)),
            }
            for _ in range(steps)
        ],
        "anomaly_score": random.uniform(0, 1),
        "confidence": random.uniform(0.7, 0.95),
        "mode": "demo",
    }


def _payload_to_sequence(payload: Dict[str, Any], seq_len: int) -> List[Dict[str, float]]:
    if isinstance(payload.get("sequence"), list) and payload["sequence"]:
        return payload["sequence"]

    seed = {
        "tds": float(payload.get("tds", 0)),
        "temperature": float(payload.get("temperature", 25)),
        "moisture": float(payload.get("moisture", 350)),
    }
    return [seed for _ in range(seq_len)]


def _load_training_matrix(minimum_required: int) -> np.ndarray:
    data_path = Path(os.getenv("AI_DATA_PATH", str(Path(__file__).resolve().parent.parent / "data" / "measurements.json")))
    rows: List[List[float]] = []

    if data_path.exists():
        with data_path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
        if isinstance(raw, list):
            for item in raw:
                try:
                    rows.append(
                        [
                            float(item["tds"]),
                            float(item["temperature"]),
                            float(item["moisture"]),
                        ]
                    )
                except (KeyError, TypeError, ValueError):
                    continue

    if len(rows) >= minimum_required:
        return np.array(rows, dtype=float)

    # Fallback synthetic dataset for demo training.
    length = max(300, minimum_required + 20)
    base = np.arange(length)
    rng = np.random.default_rng(seed=42)
    tds = 450 + 40 * np.sin(base / 12) + rng.normal(0, 12, size=length)
    temperature = 24 + 4 * np.sin(base / 24) + rng.normal(0, 0.8, size=length)
    moisture = 360 + 35 * np.cos(base / 16) + rng.normal(0, 10, size=length)
    return np.column_stack([tds, temperature, moisture]).astype(float)


@app.route("/health", methods=["GET"])
def health():
    mode = "demo"
    model_loaded = False

    if forecaster is not None:
        mode = "demo" if forecaster.is_demo_mode else "model"
        model_loaded = forecaster.model is not None

    return jsonify(
        {
            "status": "healthy",
            "service": "obruk-ai",
            "mode": mode,
            "model_loaded": model_loaded,
            "model_error": MODEL_IMPORT_ERROR,
        }
    )


@app.route("/model/info", methods=["GET"])
def model_info():
    if forecaster is None or model_config is None:
        return jsonify(
            {
                "success": False,
                "error": "LSTM model stack is unavailable.",
                "details": MODEL_IMPORT_ERROR,
            }
        ), 503

    return jsonify(
        {
            "success": True,
            "data": {
                "mode": "demo" if forecaster.is_demo_mode else "model",
                "model_loaded": forecaster.model is not None,
                "sequence_length": model_config.sequence_length,
                "forecast_steps": model_config.forecast_steps,
                "model_path": model_config.model_path,
                "scaler_path": model_config.scaler_path,
            },
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json(silent=True) or {}

        if forecaster is None or model_config is None:
            seed = {
                "tds": float(payload.get("tds", 0)),
                "temperature": float(payload.get("temperature", 25)),
                "moisture": float(payload.get("moisture", 350)),
            }
            return jsonify({"success": True, "data": _demo_predict(seed)})

        sequence = _payload_to_sequence(payload, model_config.sequence_length)
        result = forecaster.predict(sequence)
        return jsonify({"success": True, "data": result})
    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/train", methods=["POST"])
def train():
    # Backward-compatible alias to async training start.
    return train_start()


def _train_worker(epochs: int, batch_size: int) -> None:
    try:
        minimum_required = model_config.sequence_length + model_config.forecast_steps + 20
        matrix = _load_training_matrix(minimum_required)
        metrics = forecaster.train(matrix, epochs=epochs, batch_size=batch_size)
        forecaster.load()
        training_state["last_result"] = {
            "metrics": metrics,
            "rows_used": int(len(matrix)),
            "mode": "demo" if forecaster.is_demo_mode else "model",
        }
        training_state["last_error"] = None
    except Exception as exc:  # pylint: disable=broad-except
        training_state["last_error"] = str(exc)
        training_state["last_result"] = None
    finally:
        training_state["running"] = False
        training_state["finished_at"] = datetime.utcnow().isoformat() + "Z"
        training_lock.release()


@app.route("/train/start", methods=["POST"])
def train_start():
    if forecaster is None or model_config is None:
        return jsonify(
            {
                "success": False,
                "error": "LSTM model stack is unavailable on this runtime.",
                "details": MODEL_IMPORT_ERROR,
            }
        ), 503

    if not training_lock.acquire(blocking=False):
        return jsonify({"success": False, "error": "Training already in progress."}), 409

    payload = request.get_json(silent=True) or {}
    epochs = int(payload.get("epochs", 10))
    batch_size = int(payload.get("batch_size", 16))

    training_state["running"] = True
    training_state["started_at"] = datetime.utcnow().isoformat() + "Z"
    training_state["finished_at"] = None
    training_state["last_error"] = None
    training_state["last_result"] = None

    thread = threading.Thread(target=_train_worker, args=(epochs, batch_size), daemon=True)
    thread.start()

    return jsonify(
        {
            "success": True,
            "message": "Training started in background.",
            "data": {"running": True, "epochs": epochs, "batch_size": batch_size},
        }
    )


@app.route("/train/status", methods=["GET"])
def train_status():
    return jsonify({"success": True, "data": training_state})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

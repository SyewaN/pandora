"""
Standalone training script for LSTM model.

Reads measurements from JSON; if insufficient data exists, it generates synthetic
sensor series so the training pipeline can be demonstrated end-to-end.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd

from model import LSTMForecaster, ModelConfig


def load_measurements(data_path: Path) -> pd.DataFrame:
    """Loads measurement records from disk into a normalized DataFrame."""
    if not data_path.exists():
        return pd.DataFrame(columns=["tds", "temperature", "moisture"])

    with data_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    if not isinstance(raw, list):
        return pd.DataFrame(columns=["tds", "temperature", "moisture"])

    frame = pd.DataFrame(raw)
    required_columns = ["tds", "temperature", "moisture"]
    if not all(column in frame.columns for column in required_columns):
        return pd.DataFrame(columns=required_columns)

    return frame[required_columns].dropna().astype(float)


def generate_demo_data(length: int = 240) -> pd.DataFrame:
    """Generates realistic synthetic signals for training fallback."""
    rng = np.random.default_rng(seed=42)
    base = np.arange(length)

    tds = 450 + 40 * np.sin(base / 12) + rng.normal(0, 12, size=length)
    temperature = 24 + 4 * np.sin(base / 24) + rng.normal(0, 0.8, size=length)
    moisture = 360 + 35 * np.cos(base / 16) + rng.normal(0, 10, size=length)

    data = np.column_stack(
        [
            np.clip(tds, 0, 5000),
            np.clip(temperature, -20, 60),
            np.clip(moisture, 0, 1000),
        ]
    )
    return pd.DataFrame(data, columns=["tds", "temperature", "moisture"])


def main() -> None:
    """Trains and saves LSTM model artifacts."""
    project_root = Path(__file__).resolve().parent.parent
    data_path = project_root / "data" / "measurements.json"

    model_config = ModelConfig(
        model_path=os.getenv("AI_MODEL_PATH", str(project_root / "ai" / "model" / "lstm_model.h5")),
        scaler_path=os.getenv("AI_SCALER_PATH", str(project_root / "ai" / "model" / "scaler.pkl")),
        sequence_length=int(os.getenv("AI_SEQUENCE_LENGTH", "10")),
        forecast_steps=int(os.getenv("AI_FORECAST_STEPS", "3")),
        features=3,
    )

    records = load_measurements(data_path)
    minimum_required = model_config.sequence_length + model_config.forecast_steps + 20

    if len(records) < minimum_required:
        print(
            f"[train.py] Insufficient real records ({len(records)}). "
            "Generating synthetic demo data for training."
        )
        records = generate_demo_data(length=300)

    training_data = records[["tds", "temperature", "moisture"]].values

    forecaster = LSTMForecaster(model_config)
    metrics = forecaster.train(training_data, epochs=30, batch_size=16)

    print("[train.py] Training finished successfully.")
    print(f"[train.py] Metrics: {metrics}")
    print(f"[train.py] Model saved: {model_config.model_path}")
    print(f"[train.py] Scaler saved: {model_config.scaler_path}")


if __name__ == "__main__":
    main()

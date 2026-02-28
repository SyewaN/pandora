"""
LSTM forecasting model module.

This module encapsulates model lifecycle:
- data normalization with MinMaxScaler
- LSTM network build/train
- save/load model and scaler
- prediction with anomaly score output
"""
from __future__ import annotations

import os
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.models import load_model


@dataclass
class ModelConfig:
    """Holds tunable model/runtime parameters loaded from environment."""

    model_path: str
    scaler_path: str
    sequence_length: int = 10
    forecast_steps: int = 3
    features: int = 3


class LSTMForecaster:
    """Provides train/predict APIs and demo fallback for missing model files."""

    def __init__(self, config: ModelConfig) -> None:
        self.config = config
        self.scaler = MinMaxScaler()
        self.model = None
        self.is_demo_mode = True

    def build_model(self) -> Sequential:
        """Builds a compact LSTM network suitable for small sensor sequences."""
        model = Sequential(
            [
                LSTM(64, return_sequences=True, input_shape=(self.config.sequence_length, self.config.features)),
                Dropout(0.2),
                LSTM(32, return_sequences=False),
                Dropout(0.2),
                Dense(32, activation="relu"),
                Dense(self.config.forecast_steps * self.config.features, activation="linear"),
            ]
        )
        model.compile(optimizer="adam", loss="mse", metrics=["mae"])
        return model

    def _prepare_training_data(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Converts raw feature rows into sliding windows for supervised learning."""
        if len(data) <= self.config.sequence_length + self.config.forecast_steps:
            raise ValueError("Insufficient rows for training windows.")

        scaled = self.scaler.fit_transform(data)
        x_rows: List[np.ndarray] = []
        y_rows: List[np.ndarray] = []

        horizon = self.config.forecast_steps
        seq = self.config.sequence_length

        for idx in range(len(scaled) - seq - horizon + 1):
            x_window = scaled[idx : idx + seq]
            y_window = scaled[idx + seq : idx + seq + horizon].reshape(-1)
            x_rows.append(x_window)
            y_rows.append(y_window)

        return np.array(x_rows), np.array(y_rows)

    def train(self, data: np.ndarray, epochs: int = 30, batch_size: int = 16) -> Dict[str, Any]:
        """Trains model, then persists model and scaler to disk."""
        x_train, y_train = self._prepare_training_data(data)
        self.model = self.build_model()

        history = self.model.fit(
            x_train,
            y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=0.2,
            verbose=1,
        )

        os.makedirs(os.path.dirname(self.config.model_path), exist_ok=True)
        self.model.save(self.config.model_path)
        joblib.dump(self.scaler, self.config.scaler_path)
        self.is_demo_mode = False

        return {
            "epochs": epochs,
            "final_loss": float(history.history["loss"][-1]),
            "final_mae": float(history.history["mae"][-1]),
        }

    def load(self) -> bool:
        """Loads model and scaler if files exist; otherwise leaves demo mode active."""
        model_exists = os.path.exists(self.config.model_path)
        scaler_exists = os.path.exists(self.config.scaler_path)

        if model_exists and scaler_exists:
            self.model = load_model(self.config.model_path)
            self.scaler = joblib.load(self.config.scaler_path)
            self.is_demo_mode = False
            return True

        self.model = None
        self.is_demo_mode = True
        return False

    def _demo_prediction(self, sequence: np.ndarray) -> Dict[str, Any]:
        """Generates deterministic-ish random predictions from the latest point."""
        latest = sequence[-1]
        predictions = []

        for _ in range(self.config.forecast_steps):
            predictions.append(
                {
                    "tds": float(max(0, min(5000, latest[0] + random.uniform(-30, 30)))),
                    "temperature": float(max(-20, min(60, latest[1] + random.uniform(-1.2, 1.2)))),
                    "moisture": float(max(0, min(1000, latest[2] + random.uniform(-20, 20)))),
                }
            )

        anomaly_score = float(random.uniform(0.05, 0.35))
        return {"predictions": predictions, "anomaly_score": anomaly_score, "mode": "demo"}

    def predict(self, sequence: List[Dict[str, float]]) -> Dict[str, Any]:
        """Predicts next N points and computes anomaly score from reconstruction delta."""
        if len(sequence) == 0:
            raise ValueError("Sequence cannot be empty.")

        points = np.array(
            [[row["tds"], row["temperature"], row["moisture"]] for row in sequence],
            dtype=float,
        )

        if self.model is None or self.is_demo_mode:
            return self._demo_prediction(points)

        if len(points) < self.config.sequence_length:
            raise ValueError(f"Sequence requires at least {self.config.sequence_length} rows.")

        seq = points[-self.config.sequence_length :]
        scaled = self.scaler.transform(seq)
        x_input = np.expand_dims(scaled, axis=0)
        y_scaled = self.model.predict(x_input, verbose=0)[0]
        y_scaled = y_scaled.reshape(self.config.forecast_steps, self.config.features)
        y_pred = self.scaler.inverse_transform(y_scaled)

        predictions = [
            {
                "tds": float(row[0]),
                "temperature": float(row[1]),
                "moisture": float(row[2]),
            }
            for row in y_pred
        ]

        expected = points[-1]
        actual_next = y_pred[0]
        anomaly_score = float(np.linalg.norm(actual_next - expected) / 1000.0)

        return {
            "predictions": predictions,
            "anomaly_score": round(min(max(anomaly_score, 0.0), 1.0), 4),
            "mode": "model",
        }

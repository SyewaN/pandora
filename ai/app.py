"""
Flask AI service entrypoint.

Exposes model health/info and prediction endpoints for backend integration.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict

from flask import Flask, jsonify, request

from model import LSTMForecaster, ModelConfig


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("obruk-ai")


def _to_bool(value: str) -> bool:
    """Converts string-based env values to boolean."""
    return value.strip().lower() in {"1", "true", "yes", "on"}


def create_app() -> Flask:
    """Creates and configures Flask app instance."""
    app = Flask(__name__)

    config = ModelConfig(
        model_path=os.getenv("AI_MODEL_PATH", "./ai/model/lstm_model.h5"),
        scaler_path=os.getenv("AI_SCALER_PATH", "./ai/model/scaler.pkl"),
        sequence_length=int(os.getenv("AI_SEQUENCE_LENGTH", "10")),
        forecast_steps=int(os.getenv("AI_FORECAST_STEPS", "3")),
        features=3,
    )

    forecaster = LSTMForecaster(config)
    loaded = forecaster.load()
    force_demo = _to_bool(os.getenv("AI_DEMO_MODE", "true"))

    if force_demo:
        forecaster.is_demo_mode = True

    logger.info(
        "AI service initialized | model_loaded=%s | demo_mode=%s",
        loaded,
        forecaster.is_demo_mode,
    )

    @app.get("/")
    def root() -> Any:
        """Simple root endpoint for quick manual checks."""
        return jsonify(
            {
                "service": "obruk-ai",
                "status": "ok",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )

    @app.get("/health")
    def health() -> Any:
        """Returns runtime health and model mode details."""
        return jsonify(
            {
                "service": "obruk-ai",
                "status": "healthy",
                "mode": "demo" if forecaster.is_demo_mode else "model",
                "sequence_length": config.sequence_length,
                "forecast_steps": config.forecast_steps,
            }
        )

    @app.get("/model/info")
    def model_info() -> Any:
        """Returns model metadata for operational debugging."""
        return jsonify(
            {
                "loaded": forecaster.model is not None,
                "mode": "demo" if forecaster.is_demo_mode else "model",
                "model_path": config.model_path,
                "scaler_path": config.scaler_path,
                "sequence_length": config.sequence_length,
                "forecast_steps": config.forecast_steps,
            }
        )

    @app.post("/predict")
    def predict() -> Any:
        """Runs forecast on sequence payload and returns anomaly score."""
        try:
            payload: Dict[str, Any] = request.get_json(silent=True) or {}
            sequence = payload.get("sequence")

            if not isinstance(sequence, list) or len(sequence) == 0:
                return jsonify({"success": False, "message": "`sequence` must be a non-empty list."}), 400

            for item in sequence:
                if not all(key in item for key in ("tds", "temperature", "moisture")):
                    return jsonify({"success": False, "message": "Each item must include tds/temperature/moisture."}), 400

            result = forecaster.predict(sequence)
            return jsonify({"success": True, **result}), 200
        except ValueError as error:
            logger.warning("Predict validation error: %s", error)
            return jsonify({"success": False, "message": str(error)}), 400
        except Exception as error:  # pylint: disable=broad-except
            logger.exception("Predict failed: %s", error)
            return jsonify({"success": False, "message": "Prediction failed."}), 500

    return app


if __name__ == "__main__":
    application = create_app()
    host = os.getenv("AI_HOST", "0.0.0.0")
    port = int(os.getenv("AI_PORT", "5000"))
    application.run(host=host, port=port)

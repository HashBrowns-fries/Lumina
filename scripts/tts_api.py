#!/usr/bin/env python3
"""
VoxCPM TTS API 服务
为 Lumina 阅读器提供文字转语音功能
"""

import os
import sys
import io
import re
import logging
import threading
import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Add VoxCPM source to path
VOXCPM_SRC = os.path.join(os.path.dirname(__file__), "..", "VoxCPM", "src")
if os.path.isdir(VOXCPM_SRC):
    sys.path.insert(0, os.path.abspath(VOXCPM_SRC))

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global state
model = None
model_loading = False
model_error = None
model_sample_rate = 16000
model_device = "unknown"
generate_lock = threading.Lock()
stop_requested = threading.Event()

MODEL_ID = os.environ.get("VOXCPM_MODEL_ID", "openbmb/VoxCPM-0.5B")
DEVICE = os.environ.get("VOXCPM_DEVICE", None)  # None = auto
MAX_SENTENCE_LEN = 200


def load_model():
    global model, model_loading, model_error, model_sample_rate, model_device
    model_loading = True
    model_error = None
    try:
        from voxcpm import VoxCPM

        logger.info(f"Loading VoxCPM model: {MODEL_ID}")
        model = VoxCPM.from_pretrained(
            MODEL_ID,
            load_denoiser=False,
            optimize=True,
            device=DEVICE,
        )
        model_sample_rate = model.tts_model.sample_rate
        model_device = str(model.tts_model.device)
        logger.info(
            f"Model loaded: sample_rate={model_sample_rate}, device={model_device}"
        )
    except Exception as e:
        model_error = str(e)
        logger.error(f"Failed to load model: {e}")
    finally:
        model_loading = False


def split_sentences(text: str) -> list[str]:
    """Split text into sentences for long paragraph handling."""
    parts = re.split(r"(?<=[.!?。！？；;])\s*", text)
    sentences = []
    buf = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(buf) + len(part) < MAX_SENTENCE_LEN:
            buf = f"{buf} {part}" if buf else part
        else:
            if buf:
                sentences.append(buf)
            buf = part
    if buf:
        sentences.append(buf)
    return sentences if sentences else [text]


def generate_audio(text: str, voice_style: str, cfg_value: float, timesteps: int) -> np.ndarray:
    """Generate audio for text, splitting long texts into sentences."""
    if voice_style:
        full_text = f"({voice_style}){text}"
    else:
        full_text = text

    sentences = split_sentences(full_text)
    if len(sentences) <= 1:
        return model.generate(
            text=full_text,
            cfg_value=cfg_value,
            inference_timesteps=timesteps,
            normalize=True,
        )

    # For multi-sentence, only prepend voice style to the first sentence
    chunks = []
    for i, sent in enumerate(sentences):
        if stop_requested.is_set():
            break
        if i == 0 and voice_style and not sent.startswith("("):
            sent = f"({voice_style}){sent}"
        wav = model.generate(
            text=sent,
            cfg_value=cfg_value,
            inference_timesteps=timesteps,
            normalize=True,
        )
        chunks.append(wav)
        # Small silence gap between sentences
        chunks.append(np.zeros(int(model_sample_rate * 0.3), dtype=np.float32))

    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks)


@app.route("/tts/generate", methods=["POST"])
def tts_generate():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503

    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    voice_style = data.get("voice_style", "")
    cfg_value = float(data.get("cfg_value", 2.0))
    timesteps = int(data.get("inference_timesteps", 10))

    stop_requested.clear()

    with generate_lock:
        try:
            wav = generate_audio(text, voice_style, cfg_value, timesteps)
            buf = io.BytesIO()
            sf.write(buf, wav, model_sample_rate, format="WAV", subtype="PCM_16")
            buf.seek(0)
            return Response(buf.read(), mimetype="audio/wav")
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return jsonify({"error": str(e)}), 500


@app.route("/tts/status", methods=["GET"])
def tts_status():
    return jsonify(
        {
            "ready": model is not None and not model_loading,
            "loading": model_loading,
            "model_name": MODEL_ID,
            "sample_rate": model_sample_rate,
            "device": model_device,
            "error": model_error,
        }
    )


@app.route("/tts/stop", methods=["POST"])
def tts_stop():
    stop_requested.set()
    return jsonify({"status": "ok"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})


if __name__ == "__main__":
    port = int(os.environ.get("TTS_PORT", 3009))
    # Load model in background thread so server starts immediately
    threading.Thread(target=load_model, daemon=True).start()
    logger.info(f"Starting TTS API server on port {port}")
    app.run(host="127.0.0.1", port=port, debug=False)

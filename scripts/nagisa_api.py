#!/usr/bin/env python3
"""
Nagisa API 服务
为 Lumina 提供日语分词和词性标注
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

tagger = None


def get_tagger():
    global tagger
    if tagger is None:
        import nagisa
        tagger = nagisa
        logger.info("Nagisa tagger loaded")
    return tagger


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "nagisa"})


@app.route("/api/tokenize", methods=["POST"])
def tokenize():
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400

    try:
        tgr = get_tagger()
        result = tgr.tagging(text)
        tokens = [
            {"surface": word, "pos": pos}
            for word, pos in zip(result.words, result.postags)
        ]
        return jsonify({"success": True, "tokens": tokens, "raw_text": text})
    except Exception as e:
        logger.error(f"Tokenization failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("NAGISA_PORT", 3010))
    logger.info(f"Starting Nagisa API server on port {port}")
    app.run(host="127.0.0.1", port=port, debug=False)

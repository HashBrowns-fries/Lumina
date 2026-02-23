#!/usr/bin/env python3
"""
梵语API服务
基于 Dharma Mitra 提供高精度分析
"""

import os
import json
import logging
import time

from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


class SanskritProcessor:
    """梵语处理器，基于 Dharma Mitra API"""

    def __init__(self):
        self.vidyut_transliterate = None
        self.dharmamitra = None
        self.initialized = False
        self.initialize()

    def initialize(self):
        # 初始化转写功能
        try:
            from vidyut.lipi import transliterate, Scheme

            # 方案名称映射 - only schemes that exist in vidyut
            scheme_map = {
                "devanagari": Scheme.Devanagari,
                "iast": Scheme.Iast,
                "slp1": Scheme.Slp1,
                "itrans": Scheme.Itrans,
                "velthuis": Scheme.Velthuis,
                "wx": Scheme.Wx,
                "harvardkyoto": Scheme.HarvardKyoto,
                "bengali": Scheme.Bengali,
                "gurmukhi": Scheme.Gurmukhi,
                "gujarati": Scheme.Gujarati,
                "tamil": Scheme.Tamil,
                "telugu": Scheme.Telugu,
                "kannada": Scheme.Kannada,
                "malayalam": Scheme.Malayalam,
                "tibetan": Scheme.Tibetan,
            }

            def safe_transliterate(text, f, t):
                from_scheme = scheme_map.get(f.lower(), Scheme.Devanagari)
                to_scheme = scheme_map.get(t.lower(), Scheme.Iast)
                return transliterate(text, from_scheme, to_scheme)

            self.vidyut_transliterate = safe_transliterate
            logger.info("转写功能初始化成功")
        except Exception as e:
            logger.warning(f"转写功能初始化失败: {e}")
            self.vidyut_transliterate = None

        # 初始化 Dharma Mitra API
        try:
            from dharmamitra_sanskrit_grammar import DharmamitraSanskritProcessor

            self.dharmamitra = DharmamitraSanskritProcessor()
            logger.info("Dharma Mitra API 初始化成功")
        except Exception as e:
            logger.warning(f"Dharma Mitra 初始化失败: {e}")
            self.dharmamitra = None

        self.initialized = True
        logger.info("组件初始化完成")

    def transliterate(self, text: str, from_scheme: str, to_scheme: str) -> dict:
        """转写文本"""
        if not self.vidyut_transliterate:
            return {"success": False, "error": "转写功能未初始化"}

        try:
            result = self.vidyut_transliterate(text, from_scheme, to_scheme)
            return {
                "success": True,
                "original": text,
                "transliterated": result,
                "from_scheme": from_scheme,
                "to_scheme": to_scheme,
            }
        except Exception as e:
            logger.error(f"转写失败: {e}")
            return {"success": False, "error": str(e)}

    def analyze(self, text: str, mode: str = "unsandhied-lemma-morphosyntax") -> dict:
        """使用 Dharma Mitra 分析文本"""
        if not self.dharmamitra:
            return {"success": False, "error": "Dharma Mitra 未初始化"}

        try:
            start_time = time.time()
            logger.info(f"[Dharma Mitra] 分析: {text}")

            results = self.dharmamitra.process_batch(
                [text], mode=mode, human_readable_tags=True
            )

            if not results or len(results) == 0:
                return {"success": False, "error": "无返回结果"}

            result = results[0]
            grammatical_analysis = result.get("grammatical_analysis", [])

            segments = []
            for ga in grammatical_analysis:
                segment = {
                    "original": text,
                    "unsandhied": ga.get("unsandhied", ""),
                    "lemma": ga.get("lemma", ""),
                    "tag": ga.get("tag", ""),
                    "meanings": ga.get("meanings", []),
                }
                segments.append(segment)

            processing_time = int((time.time() - start_time) * 1000)

            # 推断Sandhi规则
            unsandhied_parts = [seg.get("unsandhied", "") for seg in segments]
            sandhi_rules = self.infer_sandhi_rules(text, unsandhied_parts)

            return {
                "success": True,
                "input": text,
                "segments": segments,
                "segment_count": len(segments),
                "sandhi_rules": sandhi_rules,
                "processing_time_ms": processing_time,
            }

        except Exception as e:
            logger.error(f"[Dharma Mitra] 分析失败: {e}")
            return {"success": False, "error": str(e)}

    def infer_sandhi_rules(self, original: str, parts: list) -> list:
        """推断Sandhi规则"""
        rules = []

        if len(parts) < 2:
            return rules

        # 常见的Sandhi规则
        sandhi_patterns = [
            # Guṇa
            (r"a(.+)i", r"a\1e", "Guṇa: a→e (before i)"),
            (r"a(.+)u", r"a\1o", "Guṇa: a→o (before u)"),
            (r"a(.+)f", r"a\1ar", "Guṇa: a→ar (before f)"),
            (r"a(.+)x", r"a\1al", "Guṇa: a→al (before x)"),
            # Vṛddhi
            (r"a(.+)A", r"a\1A", "Vṛddhi: a→ā"),
            (r"a(.+)i", r"a\1ai", "Vṛddhi: a→ai"),
            (r"a(.+)u", r"a\1au", "Vṛddhi: a→au"),
            # Visarga
            (r"aH(.+)k", r"aM k", "Visarga: aḥ→aṃ before voiceless stops"),
            (r"aH(.+)c", r"aS c", "Visarga: aḥ→aś before palatals"),
            (r"aH(.+)t", r"aH t", "Visarga: aḥ before dental stops"),
            # 半元音
            (r"i(.+)a", r"ya", "半元音: i→y before vowels"),
            (r"u(.+)a", r"va", "半元音: u→v before vowels"),
        ]

        # 简单的模式匹配
        import re

        for i in range(len(parts) - 1):
            first = parts[i]
            second = parts[i + 1]

            # 检查是否有Guṇa
            if first.endswith("a") and second.startswith("i"):
                rules.append(f"Part {i + 1}: Guṇa - a + i → e")
            elif first.endswith("a") and second.startswith("u"):
                rules.append(f"Part {i + 1}: Guṇa - a + u → o")
            elif first.endswith("a") and second.startswith("a"):
                rules.append(f"Part {i + 1}: Guṇa - a + a → ā")
            # Visarga
            elif first.endswith("aḥ") or first.endswith("as"):
                rules.append(f"Part {i + 1}: Visarga - ḥ → before consonant")
            # 半元音
            elif first.endswith("i") and second.startswith("a"):
                rules.append(f"Part {i + 1}: Semivowel - i → y")
            elif first.endswith("u") and second.startswith("a"):
                rules.append(f"Part {i + 1}: Semivowel - u → v")

        if not rules:
            rules.append("Compound word (Sandhi applied)")

        return rules


processor = SanskritProcessor()


@app.route("/api/transliterate", methods=["POST"])
def transliterate():
    """转写文本"""
    data = request.get_json()
    text = data.get("text", "")
    from_scheme = data.get("from", "devanagari")
    to_scheme = data.get("to", "iast")

    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400

    result = processor.transliterate(text, from_scheme, to_scheme)
    return jsonify(result)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """分析梵语文本"""
    data = request.get_json()
    text = data.get("text", "")
    mode = data.get("mode", "unsandhied-lemma-morphosyntax")

    if not text:
        return jsonify({"success": False, "error": "No text provided"}), 400

    result = processor.analyze(text, mode)
    return jsonify(result)


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    """健康检查"""
    return jsonify(
        {
            "status": "ok",
            "dharmamitra": processor.dharmamitra is not None,
            "transliterate": processor.vidyut_transliterate is not None,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3008))
    app.run(host="0.0.0.0", port=port, debug=True)

#!/usr/bin/env python3
"""
梵语Sandhi处理API服务
基于vidyut库提供REST API
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import time

from flask import Flask, request, jsonify
from flask_cors import CORS

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 启用CORS


class SanskritProcessor:
    """梵语处理器"""

    def __init__(self):
        self.chedaka = None
        self.sandhi_splitter = None
        self.sanskrit_parser = None
        self.initialized = False
        self.initialize()

    def initialize(self):
        """初始化处理器"""
        try:
            # 尝试导入vidyut
            import vidyut

            logger.info("vidyut库可用")

            # 尝试初始化Sanskrit Parser (用于形态素分割)
            try:
                from sanskrit_parser import Parser as SanskritParser

                self.sanskrit_parser = SanskritParser()
                logger.info("成功加载 sanskrit_parser")
            except ImportError as e:
                logger.warning(f"无法导入 sanskrit_parser: {e}")
                self.sanskrit_parser = None

            # 尝试初始化Sandhi Splitter
            try:
                from vidyut.sandhi import Splitter

                sandhi_rules_path = self._find_sandhi_rules_file()
                if sandhi_rules_path:
                    try:
                        self.sandhi_splitter = Splitter.from_csv(str(sandhi_rules_path))
                        logger.info(
                            f"成功加载Sandhi分词器，使用规则: {sandhi_rules_path}"
                        )
                    except Exception as e:
                        logger.warning(f"加载Sandhi分词器失败: {e}")
                        self.sandhi_splitter = None
            except ImportError as e:
                logger.warning(f"无法导入Sandhi Splitter: {e}")

            # 尝试初始化Chedaka（分词器）
            # 注意：可能需要数据文件
            try:
                from vidyut.cheda import Chedaka

                # 尝试查找数据文件
                data_path = self._find_data_file()
                if data_path:
                    try:
                        self.chedaka = Chedaka(str(data_path))
                        logger.info(f"成功加载分词器，使用数据: {data_path}")
                    except Exception as e:
                        logger.warning(f"加载分词器失败，使用降级模式: {e}")
                        self.chedaka = None
                else:
                    # 尝试不提供路径（如果允许）
                    try:
                        self.chedaka = Chedaka()
                        logger.info("成功加载分词器（无数据文件）")
                    except TypeError:
                        logger.warning("分词器需要数据文件，使用降级模式")
                        self.chedaka = None
            except ImportError as e:
                logger.warning(f"无法导入Chedaka: {e}")
                self.chedaka = None

            self.initialized = True

        except ImportError:
            logger.warning("vidyut库不可用，使用降级模式")
            self.chedaka = None
            self.initialized = True

    def _find_data_file(self) -> Optional[Path]:
        """查找数据文件"""
        possible_locations = [
            Path.home() / ".vidyut" / "data",
            Path("/usr/local/share/vidyut"),
            Path("/usr/share/vidyut"),
            Path(".") / "data" / "vidyut",
            Path("data") / "vidyut",
            Path(__file__).parent.parent / "data" / "vidyut",
        ]

        for location in possible_locations:
            if location.exists():
                for ext in [".bin", ".model", ".zip"]:
                    for file in location.rglob(f"*{ext}"):
                        if "cheda" in file.name.lower() or "model" in file.name.lower():
                            return file
                return location

        return None

    def _find_sandhi_rules_file(self) -> Optional[Path]:
        """查找Sandhi规则文件"""
        possible_locations = [
            Path.home() / ".vidyut" / "data" / "sandhi" / "rules.csv",
            Path("/usr/local/share/vidyut") / "sandhi" / "rules.csv",
            Path("/usr/share/vidyut") / "sandhi" / "rules.csv",
            Path("data") / "vidyut" / "sandhi" / "rules.csv",
            Path(__file__).parent.parent / "data" / "vidyut" / "sandhi" / "rules.csv",
        ]

        for location in possible_locations:
            if location.exists():
                return location

        return None

    def split_sandhi(self, word: str, mode: str = "sandhi") -> Dict[str, Any]:
        """
        拆分Sandhi复合词或词素分割

        Args:
            word: 梵语单词（天城文）
            mode: 模式 - "sandhi" (Sandhi规则拆分) 或 "morpheme" (词素分割用于查词典)

        Returns:
            拆分结果
        """
        start_time = time.time()

        if mode == "morpheme":
            return self._split_morpheme(word, start_time)

        # 默认使用Sandhi拆分模式
        # 优先使用Sandhi Splitter
        if self.sandhi_splitter:
            try:
                slp1_word = self._devanagari_to_slp1(word)
                parts = self._split_using_sandhi(slp1_word)

                if parts and len(parts) > 1:
                    devanagari_parts = [self._slp1_to_devanagari(p) for p in parts]
                    return {
                        "original": word,
                        "parts": devanagari_parts,
                        "part_count": len(parts),
                        "success": True,
                        "source": "vidyut_sandhi",
                        "processing_time_ms": int((time.time() - start_time) * 1000),
                    }
            except Exception as e:
                logger.error(f"vidyut sandhi拆分失败: {e}")

        # 尝试使用Chedaka分词器
        if self.chedaka:
            try:
                slp1_word = self._devanagari_to_slp1(word)
                tokens = self.chedaka.run(slp1_word)
                slp1_parts = [token.text for token in tokens]
                parts = [self._slp1_to_devanagari(p) for p in slp1_parts]

                return {
                    "original": word,
                    "parts": parts,
                    "part_count": len(parts),
                    "success": True,
                    "source": "vidyut",
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                }
            except Exception as e:
                logger.error(f"vidyut拆分失败: {e}")

        return self._rule_based_split(word, start_time)

    def _split_morpheme(self, word: str, start_time: float) -> Dict[str, Any]:
        """词素分割 - 用于词典查询"""
        # 优先尝试整个词（如果是简单词或动词变形）
        # 先尝试 sanskrit_parser with fewer splits
        if self.sanskrit_parser:
            try:
                slp1_word = self._devanagari_to_slp1(word)
                result = self.sanskrit_parser.split(slp1_word, limit=10)

                if result and len(result) > 0:
                    # 找到最佳拆分：不超过3个部分，且每个部分至少2个字符
                    for split_result in result:
                        slp1_parts = [str(p) for p in split_result.parts]
                        parts = [self._slp1_to_devanagari(p) for p in slp1_parts]

                        # 过滤：至少2个部分，每个部分至少2个字符
                        valid_parts = [p for p in parts if len(p) >= 2]
                        if len(valid_parts) >= 2 and len(valid_parts) <= 3:
                            return {
                                "original": word,
                                "parts": valid_parts,
                                "part_count": len(valid_parts),
                                "success": True,
                                "source": "sanskrit_parser",
                                "processing_time_ms": int(
                                    (time.time() - start_time) * 1000
                                ),
                            }

                    # 如果没找到合适的，取第一个有效结果
                    for split_result in result:
                        slp1_parts = [str(p) for p in split_result.split]
                        parts = [self._slp1_to_devanagari(p) for p in slp1_parts]
                        # 过滤掉单字符
                        valid_parts = [p for p in parts if len(p) >= 2]
                        if valid_parts:
                            return {
                                "original": word,
                                "parts": valid_parts,
                                "part_count": len(valid_parts),
                                "success": True,
                                "source": "sanskrit_parser",
                                "processing_time_ms": int(
                                    (time.time() - start_time) * 1000
                                ),
                            }
            except Exception as e:
                logger.error(f"sanskrit_parser词素分割失败: {e}")

        # 尝试使用Chedaka分词器
        if self.chedaka:
            try:
                slp1_word = self._devanagari_to_slp1(word)
                tokens = self.chedaka.run(slp1_word)
                slp1_parts = [token.text for token in tokens]
                parts = [self._slp1_to_devanagari(p) for p in slp1_parts]

                if len(parts) > 1:
                    return {
                        "original": word,
                        "parts": parts,
                        "part_count": len(parts),
                        "success": True,
                        "source": "chedaka",
                        "processing_time_ms": int((time.time() - start_time) * 1000),
                    }
            except Exception as e:
                logger.error(f"Chedaka词素分割失败: {e}")

        # 如果无法有效分割，返回原词
        return {
            "original": word,
            "parts": [word],
            "part_count": 1,
            "success": True,
            "source": "no_split",
            "processing_time_ms": int((time.time() - start_time) * 1000),
        }

    def _rule_based_morpheme_split(
        self, word: str, start_time: float
    ) -> Dict[str, Any]:
        """基于规则的词素分割"""
        import re

        # 常见词素模式（词根+后缀）
        morpheme_patterns = [
            # 名词后缀
            (r"(.+)([अआ]मिति)$", r"\1 \2"),  # -amiti
            (r"(.+)([अआ]न)$", r"\1 \2"),  # -ana
            (r"(.+)([इई]न)$", r"\1 \2"),  # -ina
            (r"(.+)([उऊ]न)$", r"\1 \2"),  # -una
            (r"(.+)([त]्व)$", r"\1 \2"),  # -tva
            (r"(.+)([त]ा)$", r"\1 \2"),  # -ta
            (r"(.+)([न]ी)$", r"\1 \2"),  # -ni
            # 动词后缀
            (r"(.+)([अआ]ति)$", r"\1 \2"),  # -ati
            (r"(.+)([इई]ति)$", r"\1 \2"),  # -iti
            (r"(.+)([उऊ]ति)$", r"\1 \2"),  # -uti
            (r"(.+)([ए]ति)$", r"\1 \2"),  # -eti
            (r"(.+)([ओ]ति)$", r"\1 \2"),  # -oti
            # 复合词
            (r"(.+)([अआ]यन)$", r"\1 \2"),  # -ayana
            (r"(.+)([इई]य)$", r"\1 \2"),  # -iya
            (r"(.+)([उऊ]य)$", r"\1 \2"),  # -uya
        ]

        parts = [word]

        for pattern, replacement in morpheme_patterns:
            if re.search(pattern, word):
                split_word = re.sub(pattern, replacement, word)
                parts = [p.strip() for p in split_word.split() if p.strip()]
                if len(parts) > 1:
                    break

        # 如果无法分割，返回原词并标记
        return {
            "original": word,
            "parts": parts,
            "part_count": len(parts),
            "success": True,
            "source": "rule_morpheme",
            "processing_time_ms": int((time.time() - start_time) * 1000),
        }

    def _split_using_sandhi(self, slp1_word: str) -> List[str]:
        """使用Sandhi Splitter拆分词"""
        if not self.sandhi_splitter:
            return []

        # 尝试在每个可能的位置拆分
        best_parts = [slp1_word]

        for i in range(1, len(slp1_word)):
            try:
                splits = self.sandhi_splitter.split_at(slp1_word, i)
                if splits:
                    # 取第一个有效的拆分
                    for split in splits:
                        first = split.first
                        second = split.second
                        if first and second:
                            # 递归拆分每个部分
                            first_parts = self._split_using_sandhi(first)
                            second_parts = self._split_using_sandhi(second)
                            result = first_parts + second_parts
                            if len(result) > len(best_parts):
                                best_parts = result
            except Exception:
                continue

        return best_parts

    def _devanagari_to_slp1(self, text: str) -> str:
        """将Devanagari转换为SLP1"""
        try:
            from vidyut.lipi import Scheme, transliterate

            return transliterate(text, Scheme.Devanagari, Scheme.Slp1)
        except Exception as e:
            logger.warning(f"Devanagari转SLP1失败，使用简单映射: {e}")
            return self._simple_devanagari_to_slp1(text)

    def _slp1_to_devanagari(self, text: str) -> str:
        """将SLP1转换为Devanagari"""
        try:
            from vidyut.lipi import Scheme, transliterate

            return transliterate(text, Scheme.Slp1, Scheme.Devanagari)
        except Exception as e:
            logger.warning(f"SLP1转Devanagari失败，使用简单映射: {e}")
            return self._simple_slp1_to_devanagari(text)

    def _simple_devanagari_to_slp1(self, text: str) -> str:
        """简单的Devanagari到SLP1映射"""
        mapping = {
            "अ": "a",
            "आ": "A",
            "इ": "i",
            "ई": "I",
            "उ": "u",
            "ऊ": "U",
            "ऋ": "f",
            "ॠ": "F",
            "ऌ": "l",
            "ॡ": "L",
            "ए": "e",
            "ऐ": "ai",
            "ओ": "o",
            "औ": "au",
            "क": "k",
            "ख": "K",
            "ग": "g",
            "घ": "G",
            "ङ": "N",
            "च": "c",
            "छ": "C",
            "ज": "j",
            "झ": "J",
            "ञ": "Y",
            "ट": "T",
            "ठ": "T",
            "ड": "D",
            "ढ": "D",
            "ण": "n",
            "त": "t",
            "थ": "T",
            "द": "d",
            "ध": "D",
            "न": "n",
            "प": "p",
            "फ": "P",
            "ब": "b",
            "भ": "B",
            "म": "m",
            "य": "y",
            "र": "r",
            "ल": "l",
            "व": "v",
            "श": "z",
            "ष": "S",
            "स": "s",
            "ह": "h",
            "ं": "M",
            "ः": "H",
            "्": "",
            "ा": "A",
            "ि": "i",
            "ी": "I",
            "ु": "u",
            "ू": "U",
            "े": "e",
            "ै": "ai",
            "ो": "o",
            "ौ": "au",
            "।": ".",
            "॥": "..",
        }
        result = []
        i = 0
        while i < len(text):
            matched = False
            # 尝试匹配2字符
            if i + 1 < len(text):
                two_char = text[i : i + 2]
                if two_char in mapping:
                    result.append(mapping[two_char])
                    i += 2
                    matched = True
                    continue
            # 匹配单字符
            if text[i] in mapping:
                result.append(mapping[text[i]])
            else:
                result.append(text[i])
            i += 1
        return "".join(result)

    def _simple_slp1_to_devanagari(self, text: str) -> str:
        """简单的SLP1到Devanagari映射"""
        mapping = {
            "a": "अ",
            "A": "आ",
            "i": "इ",
            "I": "ई",
            "u": "उ",
            "U": "ऊ",
            "f": "ऋ",
            "F": "ॠ",
            "l": "ऌ",
            "L": "ॡ",
            "e": "ए",
            "ai": "ऐ",
            "o": "ओ",
            "au": "औ",
            "k": "क",
            "K": "ख",
            "g": "ग",
            "G": "घ",
            "N": "ङ",
            "c": "च",
            "C": "छ",
            "j": "ज",
            "J": "झ",
            "Y": "ञ",
            "T": "ट",
            "W": "ठ",
            "D": "ड",
            "Q": "ढ",
            "N": "ण",
            "t": "त",
            "T": "थ",
            "d": "द",
            "D": "ध",
            "n": "न",
            "p": "प",
            "P": "फ",
            "b": "ब",
            "B": "भ",
            "m": "म",
            "y": "य",
            "r": "र",
            "l": "ल",
            "v": "व",
            "z": "श",
            "S": "ष",
            "s": "स",
            "h": "ह",
            "M": "ं",
            "H": "ः",
        }
        result = []
        i = 0
        while i < len(text):
            matched = False
            # 尝试匹配2字符
            if i + 1 < len(text):
                two_char = text[i : i + 2]
                if two_char in mapping:
                    result.append(mapping[two_char])
                    i += 2
                    matched = True
                    continue
            # 匹配单字符
            if text[i] in mapping:
                result.append(mapping[text[i]])
            else:
                result.append(text[i])
            i += 1
        return "".join(result)

    def _rule_based_split(self, word: str, start_time: float) -> Dict[str, Any]:
        """基于规则的拆分"""
        import re

        # 常见Sandhi规则
        rules = [
            # 元音连写: a + i -> e, a + u -> o 等
            (r"([अआ])([इई])", r"\1 \2"),  # a/i
            (r"([अआ])([उऊ])", r"\1 \2"),  # a/u
            (r"([इई])([अआ])", r"\1 \2"),  # i/a
            (r"([उऊ])([अआ])", r"\1 \2"),  # u/a
            # 辅音连写: 词尾辅音 + 词首元音
            (r"([क-ह]्)([अ-औ])", r"\1 \2"),
            # 常见复合词模式
            (r"(.+?)([अआ]य)", r"\1 \2"),  # X + Aya
            (r"(.+?)([इई]क)", r"\1 \2"),  # X + Ika
            (r"(.+?)([उऊ]क)", r"\1 \2"),  # X + Uka
            # 名词结尾
            (r"(.+)([अआ]म्)$", r"\1 \2"),  # -am
            (r"(.+)([इई]म्)$", r"\1 \2"),  # -im
            (r"(.+)([उऊ]म्)$", r"\1 \2"),  # -um
            (r"(.+)([अआ]ः)$", r"\1 \2"),  # -ah
            (r"(.+)([इई]ः)$", r"\1 \2"),  # -ih
            (r"(.+)([उऊ]ः)$", r"\1 \2"),  # -uh
        ]

        parts = [word]  # 默认不拆分

        for pattern, replacement in rules:
            if re.search(pattern, word):
                # 应用拆分
                split_word = re.sub(pattern, replacement, word)
                parts = [p.strip() for p in split_word.split() if p.strip()]
                if len(parts) > 1:
                    break

        # 如果还是单个部分，尝试在常见连接处拆分
        if len(parts) == 1:
            # 尝试在常见连接字符处拆分
            connectors = ["ा", "ि", "ी", "ु", "ू", "े", "ै", "ो", "ौ", "ं", "ः", "्"]
            for connector in connectors:
                if connector in word:
                    idx = word.index(connector)
                    if idx > 0 and idx < len(word) - 1:
                        parts = [word[:idx], word[idx:]]
                        break

        return {
            "original": word,
            "parts": parts,
            "part_count": len(parts),
            "success": True,
            "source": "rule_based",
            "processing_time_ms": int((time.time() - start_time) * 1000),
            "warning": "使用基于规则的拆分，准确性有限",
        }

    def transliterate(
        self, text: str, from_scheme: str = "devanagari", to_scheme: str = "iast"
    ) -> str:
        """转写文本"""
        try:
            from vidyut.lipi import Scheme, transliterate

            scheme_map = {
                "devanagari": Scheme.Devanagari,
                "iast": Scheme.Iast,
                "slp1": Scheme.Slp1,
                "itrans": Scheme.Itrans,
            }

            from_scheme_enum = scheme_map.get(from_scheme.lower(), Scheme.Devanagari)
            to_scheme_enum = scheme_map.get(to_scheme.lower(), Scheme.Iast)

            return transliterate(text, from_scheme_enum, to_scheme_enum)

        except Exception as e:
            logger.error(f"转写失败: {e}")
            return text


# 全局处理器实例
processor = SanskritProcessor()


# API路由
@app.route("/health", methods=["GET"])
def health():
    """健康检查"""
    return jsonify(
        {
            "status": "healthy",
            "service": "sanskrit-sandhi-api",
            "timestamp": time.time(),
            "initialized": processor.initialized,
            "has_chedaka": processor.chedaka is not None,
        }
    )


@app.route("/api/split", methods=["POST", "GET"])
def split_sandhi():
    """拆分Sandhi端点"""
    try:
        # 获取输入
        if request.method == "POST":
            data = request.get_json()
            word = data.get("word", "")
        else:
            word = request.args.get("word", "")

        if not word:
            return jsonify({"success": False, "error": "缺少word参数"}), 400

        # 处理
        result = processor.split_sandhi(word)

        return jsonify(result)

    except Exception as e:
        logger.error(f"API错误: {e}")
        return jsonify(
            {
                "success": False,
                "error": str(e),
                "original": word if "word" in locals() else "",
            }
        ), 500


@app.route("/api/transliterate", methods=["POST", "GET"])
def transliterate():
    """转写端点"""
    try:
        if request.method == "POST":
            data = request.get_json()
            text = data.get("text", "")
            from_scheme = data.get("from", "devanagari")
            to_scheme = data.get("to", "iast")
        else:
            text = request.args.get("text", "")
            from_scheme = request.args.get("from", "devanagari")
            to_scheme = request.args.get("to", "iast")

        if not text:
            return jsonify({"success": False, "error": "缺少text参数"}), 400

        # 处理
        result = processor.transliterate(text, from_scheme, to_scheme)

        return jsonify(
            {
                "success": True,
                "original": text,
                "transliterated": result,
                "from_scheme": from_scheme,
                "to_scheme": to_scheme,
            }
        )

    except Exception as e:
        logger.error(f"转写API错误: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/batch-split", methods=["POST"])
def batch_split():
    """批量拆分端点"""
    try:
        data = request.get_json()
        words = data.get("words", [])

        if not isinstance(words, list):
            return jsonify({"success": False, "error": "words参数必须是数组"}), 400

        results = {}
        for word in words:
            results[word] = processor.split_sandhi(word)

        return jsonify({"success": True, "results": results, "count": len(words)})

    except Exception as e:
        logger.error(f"批量拆分API错误: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    # 启动服务器
    port = int(os.environ.get("PORT", 3007))
    host = os.environ.get("HOST", "127.0.0.1")

    logger.info(f"启动梵语Sandhi API服务: http://{host}:{port}")
    logger.info(f"可用端点:")
    logger.info(f"  GET  /health")
    logger.info(f"  GET  /api/split?word=<梵语单词>")
    logger.info(f"  POST /api/split (JSON: {{'word': '<梵语单词>'}})")
    logger.info(f"  GET  /api/transliterate?text=<文本>&from=<源方案>&to=<目标方案>")
    logger.info(f"  POST /api/batch-split (JSON: {{'words': [<单词列表>]}})")

    app.run(host=host, port=port, debug=False)

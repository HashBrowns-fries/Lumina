#!/usr/bin/env python3
"""
梵语Sandhi处理服务
基于vidyut库提供专业的Sandhi拆分和形态分析
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import time
import functools

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class SanskritSandhiService:
    """梵语Sandhi处理服务"""

    def __init__(self, data_dir: Optional[str] = None):
        """
        初始化Sandhi服务

        Args:
            data_dir: 数据目录路径，如果为None则使用默认位置
        """
        self.data_dir = self._get_data_dir(data_dir)
        self.chedaka = None
        self.kosha = None
        self._initialized = False

        logger.info(f"初始化SanskritSandhiService，数据目录: {self.data_dir}")

    def _get_data_dir(self, data_dir: Optional[str]) -> Path:
        """获取数据目录路径"""
        if data_dir:
            return Path(data_dir)

        # 默认数据目录：项目根目录下的 data/vidyut
        project_root = Path(__file__).parent.parent
        default_dir = project_root / "data" / "vidyut"

        return default_dir

    def initialize(self, force_download: bool = False) -> bool:
        """
        初始化服务，下载数据并加载模型

        Args:
            force_download: 是否强制重新下载数据

        Returns:
            是否初始化成功
        """
        try:
            import vidyut

            # 1. 确保数据目录存在
            self.data_dir.mkdir(parents=True, exist_ok=True)

            # 2. 下载数据（如果需要）
            data_path = self._download_data(force_download)
            if not data_path:
                logger.error("数据下载失败")
                return False

            # 3. 初始化分词器 (Chedaka)
            self._init_chedaka(data_path)

            # 4. 初始化词典 (Kosha) - 可选
            self._init_kosha(data_path)

            self._initialized = True
            logger.info("SanskritSandhiService 初始化成功")
            return True

        except Exception as e:
            logger.error(f"初始化失败: {e}", exc_info=True)
            return False

    def _download_data(self, force_download: bool) -> Optional[Path]:
        """下载数据文件"""
        try:
            import vidyut

            data_file = self.data_dir / "vidyut-data.zip"

            # 检查数据文件是否已存在
            if data_file.exists() and not force_download:
                logger.info(f"使用现有数据文件: {data_file}")
                return data_file

            logger.info("下载vidyut数据文件...")

            # 调用下载函数
            # 注意：vidyut.download_data可能需要参数，暂时假设无参数
            result = vidyut.download_data(str(self.data_dir))

            # 检查结果
            if data_file.exists():
                logger.info(f"数据文件下载成功: {data_file}")
                return data_file
            else:
                # 可能下载到其他位置，尝试在目录中查找
                for file in self.data_dir.glob("*.zip"):
                    if "vidyut" in file.name.lower():
                        logger.info(f"找到数据文件: {file}")
                        return file

                logger.warning("未找到数据文件，可能下载失败")
                return None

        except Exception as e:
            logger.error(f"下载数据失败: {e}", exc_info=True)
            return None

    def _init_chedaka(self, data_path: Path):
        """初始化分词器"""
        try:
            from vidyut.cheda import Chedaka

            # 提取数据目录（可能是zip文件或目录）
            if data_path.suffix == ".zip":
                # 如果是zip文件，需要解压或使用特定路径
                # vidyut可能期望解压后的目录
                data_dir = data_path.parent / "vidyut-data"
                if not data_dir.exists():
                    # 尝试自动解压
                    import zipfile

                    with zipfile.ZipFile(data_path, "r") as zip_ref:
                        zip_ref.extractall(data_dir)
                    logger.info(f"解压数据到: {data_dir}")

                # 查找模型文件
                model_files = list(data_dir.rglob("*.bin"))
                if model_files:
                    model_path = model_files[0]
                    self.chedaka = Chedaka(str(model_path))
                    logger.info(f"加载分词器模型: {model_path}")
                else:
                    # 如果没有找到特定文件，尝试使用目录
                    self.chedaka = Chedaka(str(data_dir))
                    logger.info(f"加载分词器使用目录: {data_dir}")
            else:
                # 数据路径是目录
                self.chedaka = Chedaka(str(data_path))
                logger.info(f"加载分词器: {data_path}")

        except Exception as e:
            logger.error(f"初始化分词器失败: {e}", exc_info=True)
            # 创建虚拟分词器用于降级处理
            self.chedaka = None

    def _init_kosha(self, data_path: Path):
        """初始化词典"""
        try:
            from vidyut.kosha import Kosha

            # 类似地查找词典文件
            if data_path.suffix == ".zip":
                data_dir = data_path.parent / "vidyut-data"
                if not data_dir.exists():
                    return

                # 查找词典文件
                dict_files = list(data_dir.rglob("*.bin"))
                if dict_files:
                    dict_path = dict_files[0]
                    self.kosha = Kosha(str(dict_path))
                    logger.info(f"加载词典: {dict_path}")

        except Exception as e:
            logger.warning(f"初始化词典失败（可选功能）: {e}")
            self.kosha = None

    def split_sandhi(self, word: str, detailed: bool = False) -> Dict[str, Any]:
        """
        拆分Sandhi复合词

        Args:
            word: 梵语单词（天城文）
            detailed: 是否返回详细信息

        Returns:
            拆分结果
        """
        start_time = time.time()

        if not self._initialized or not self.chedaka:
            return self._fallback_split(word, detailed)

        try:
            # 分词
            segments = self.chedaka.segment(word)

            # 提取部分
            parts = []
            morphological_info = []

            for seg in segments:
                part_text = seg.text
                parts.append(part_text)

                # 尝试获取形态信息
                morph_data = {}
                if hasattr(seg, "morphology"):
                    morph_data = seg.morphology
                elif hasattr(seg, "tags"):
                    morph_data = seg.tags

                morphological_info.append(
                    {
                        "text": part_text,
                        "morphology": morph_data,
                        "position": len(parts) - 1,
                    }
                )

            # 构建结果
            result = {
                "original": word,
                "parts": parts,
                "part_count": len(parts),
                "success": True,
                "source": "vidyut",
                "processing_time_ms": int((time.time() - start_time) * 1000),
            }

            if detailed:
                result["morphological_info"] = morphological_info

                # 尝试获取词典信息
                if self.kosha:
                    dictionary_entries = []
                    for part in parts:
                        entries = self._lookup_dictionary(part)
                        dictionary_entries.append({"part": part, "entries": entries})
                    result["dictionary_entries"] = dictionary_entries

            logger.debug(f"Sandhi拆分: {word} → {parts}")
            return result

        except Exception as e:
            logger.error(f"Sandhi拆分失败 {word}: {e}")
            return self._fallback_split(word, detailed)

    def _lookup_dictionary(self, word: str) -> List[Dict]:
        """查询词典"""
        if not self.kosha:
            return []

        try:
            entries = self.kosha.get(word)
            # 转换结果为可序列化格式
            return [self._format_dictionary_entry(entry) for entry in entries]
        except Exception as e:
            logger.debug(f"词典查询失败 {word}: {e}")
            return []

    def _format_dictionary_entry(self, entry) -> Dict:
        """格式化词典条目"""
        # 根据vidyut.kosha的实际结构调整
        return {
            "word": getattr(entry, "word", ""),
            "lemma": getattr(entry, "lemma", ""),
            "pos": getattr(entry, "pos", ""),
            "meaning": getattr(entry, "meaning", ""),
            "metadata": getattr(entry, "metadata", {}),
        }

    def _fallback_split(self, word: str, detailed: bool) -> Dict[str, Any]:
        """降级拆分（当vidyut不可用时使用简单规则）"""
        # 这里可以实现一些简单的规则，或者返回空结果
        # 暂时返回基础拆分

        # 简单规则：尝试在常见连接处拆分
        import re

        # 常见Sandhi连接模式
        patterns = [
            # 元音连写
            r"([अ-औ])([अ-औ])",
            # 辅音连写
            r"([क-ह]्?)([अ-औ])",
            # 常见结尾
            r"(.*)([अइउएओ]म्)$",
            r"(.*)([अइउएओ]ः)$",
            r"(.*)([अइउएओ]न्)$",
        ]

        parts = [word]  # 默认不拆分

        for pattern in patterns:
            match = re.match(pattern, word)
            if match and match.group(1) and match.group(2):
                parts = [match.group(1), match.group(2)]
                break

        result = {
            "original": word,
            "parts": parts,
            "part_count": len(parts),
            "success": True,
            "source": "fallback",
            "processing_time_ms": 0,
        }

        if detailed:
            result["warning"] = "使用降级拆分规则，建议初始化vidyut以获得更好结果"

        logger.warning(f"使用降级拆分: {word} → {parts}")
        return result

    def transliterate(
        self, text: str, from_scheme: str = "devanagari", to_scheme: str = "iast"
    ) -> str:
        """
        转写文本

        Args:
            text: 要转写的文本
            from_scheme: 源方案 (devanagari, iast, slp1, itrans, etc.)
            to_scheme: 目标方案

        Returns:
            转写后的文本
        """
        try:
            from vidyut.lipi import Scheme, transliterate

            # 映射方案名称到Scheme枚举
            scheme_map = {
                "devanagari": Scheme.Devanagari,
                "iast": Scheme.Iast,
                "slp1": Scheme.Slp1,
                "itrans": Scheme.Itrans,
                "velthuis": Scheme.Velthuis,
                "wx": Scheme.Wx,
                "hk": Scheme.Hk,
                "harvardkyoto": Scheme.Hk,
                "bengali": Scheme.Bengali,
                "gurmukhi": Scheme.Gurmukhi,
                "gujarati": Scheme.Gujarati,
                "oriya": Scheme.Oriya,
                "tamil": Scheme.Tamil,
                "telugu": Scheme.Telugu,
                "kannada": Scheme.Kannada,
                "malayalam": Scheme.Malayalam,
                "tibetan": Scheme.Tibetan,
            }

            from_scheme_enum = scheme_map.get(from_scheme.lower(), Scheme.Devanagari)
            to_scheme_enum = scheme_map.get(to_scheme.lower(), Scheme.Iast)

            result = transliterate(text, from_scheme_enum, to_scheme_enum)
            return result

        except Exception as e:
            logger.error(f"转写失败: {e}")
            return text

    def analyze_morphology(self, word: str) -> Dict[str, Any]:
        """
        分析单词的形态

        Args:
            word: 梵语单词

        Returns:
            形态分析结果
        """
        if not self._initialized:
            return {"success": False, "error": "服务未初始化"}

        # 先拆分
        split_result = self.split_sandhi(word, detailed=True)

        # 添加更多形态分析
        result = {
            "word": word,
            "split_result": split_result,
            "morphological_features": {},
        }

        # TODO: 基于vidyut添加更多分析
        return result


# 全局服务实例
_sandhi_service = None


def get_sandhi_service(data_dir: Optional[str] = None) -> SanskritSandhiService:
    """获取全局Sandhi服务实例"""
    global _sandhi_service

    if _sandhi_service is None:
        _sandhi_service = SanskritSandhiService(data_dir)

    return _sandhi_service


def initialize_service(
    data_dir: Optional[str] = None, force_download: bool = False
) -> bool:
    """初始化全局服务"""
    service = get_sandhi_service(data_dir)
    return service.initialize(force_download)


if __name__ == "__main__":
    # 命令行接口
    import argparse

    parser = argparse.ArgumentParser(description="梵语Sandhi处理服务")
    parser.add_argument("--init", action="store_true", help="初始化服务（下载数据）")
    parser.add_argument("--data-dir", help="数据目录路径")
    parser.add_argument(
        "--force-download", action="store_true", help="强制重新下载数据"
    )
    parser.add_argument("--split", help="拆分Sandhi单词")
    parser.add_argument("--transliterate", help="转写文本")
    parser.add_argument("--from-scheme", default="devanagari", help="源转写方案")
    parser.add_argument("--to-scheme", default="iast", help="目标转写方案")
    parser.add_argument("--detailed", action="store_true", help="显示详细信息")

    args = parser.parse_args()

    # 初始化服务
    if args.init or args.split or args.transliterate:
        success = initialize_service(args.data_dir, args.force_download)
        if not success:
            print("服务初始化失败")
            sys.exit(1)

    # 处理命令
    if args.split:
        service = get_sandhi_service()
        result = service.split_sandhi(args.split, args.detailed)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.transliterate:
        service = get_sandhi_service()
        result = service.transliterate(
            args.transliterate, args.from_scheme, args.to_scheme
        )
        print(result)

    else:
        # 默认显示帮助
        parser.print_help()

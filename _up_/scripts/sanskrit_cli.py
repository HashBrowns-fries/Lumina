#!/usr/bin/env python3
"""
梵语处理命令行接口
用于Node.js后端调用
"""

import sys
import json
import argparse
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from sandhi_api import SanskritProcessor


def main():
    parser = argparse.ArgumentParser(description="梵语Sandhi处理命令行接口")
    parser.add_argument(
        "--action",
        required=True,
        choices=["split", "transliterate", "health"],
        help="操作类型",
    )
    parser.add_argument("--word", help="要拆分的梵语单词")
    parser.add_argument(
        "--mode",
        default="sandhi",
        choices=["sandhi", "morpheme"],
        help="拆分模式: sandhi或morpheme",
    )
    parser.add_argument("--text", help="要转写的文本")
    parser.add_argument("--from-scheme", default="devanagari", help="源转写方案")
    parser.add_argument("--to-scheme", default="iast", help="目标转写方案")
    parser.add_argument("--json", action="store_true", help="输出JSON格式")

    args = parser.parse_args()

    # 初始化处理器
    processor = SanskritProcessor()

    result = {}

    try:
        if args.action == "split":
            if not args.word:
                print("错误: --word 参数必需", file=sys.stderr)
                sys.exit(1)

            split_result = processor.split_sandhi(args.word, mode=args.mode)
            result = {
                "success": True,
                "action": "split",
                "mode": args.mode,
                "word": args.word,
                "result": split_result,
            }

        elif args.action == "transliterate":
            if not args.text:
                print("错误: --text 参数必需", file=sys.stderr)
                sys.exit(1)

            transliterated = processor.transliterate(
                args.text, args.from_scheme, args.to_scheme
            )
            result = {
                "success": True,
                "action": "transliterate",
                "original": args.text,
                "transliterated": transliterated,
                "from_scheme": args.from_scheme,
                "to_scheme": args.to_scheme,
            }

        elif args.action == "health":
            result = {
                "success": True,
                "action": "health",
                "initialized": processor.initialized,
                "has_chedaka": processor.chedaka is not None,
                "service": "sanskrit-processor",
            }

        # 输出结果
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            # 人性化输出
            if result.get("success"):
                print(f"成功: {result['action']}")
                if "result" in result:
                    print(f"  单词: {result['word']}")
                    print(f"  模式: {result.get('mode', 'sandhi')}")
                    print(f"  拆分: {result['result']['parts']}")
                    print(f"  来源: {result['result']['source']}")
                elif "transliterated" in result:
                    print(f"  原文: {result['original']}")
                    print(f"  转写: {result['transliterated']}")
                elif "initialized" in result:
                    print(f"  初始化: {result['initialized']}")
                    print(f"  分词器: {'可用' if result['has_chedaka'] else '不可用'}")
            else:
                print(f"失败: {result.get('error', '未知错误')}")

        sys.exit(0)

    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "action": args.action if "args" in locals() else "unknown",
        }

        if args.json:
            print(json.dumps(error_result, ensure_ascii=False))
        else:
            print(f"错误: {e}", file=sys.stderr)

        sys.exit(1)


if __name__ == "__main__":
    main()

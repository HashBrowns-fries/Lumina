#!/usr/bin/env python3
"""
下载vidyut数据文件
"""

import os
import sys
import zipfile
import shutil
from pathlib import Path
import urllib.request
import tempfile

# 配置
DATA_URLS = [
    "https://github.com/ambuda-org/vidyut/releases/download/py-0.4.0/data-0.4.0.zip",
    "https://github.com/ambuda-org/vidyut-py/releases/download/0.4.0/data-0.4.0.zip",
    "https://github.com/ambuda-org/vidyut-py/releases/download/0.3.0/data-0.3.0.zip",
]
DATA_DIR = Path(__file__).parent.parent / "data" / "vidyut"


def download_file(url: str, dest_path: Path) -> bool:
    """下载文件"""
    print(f"下载: {url}")
    print(f"保存到: {dest_path}")

    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_file:
            tmp_path = tmp_file.name

        # 下载
        print("开始下载...")
        urllib.request.urlretrieve(url, tmp_path)

        # 移动到目标位置
        shutil.move(tmp_path, dest_path)
        print("下载完成")
        return True

    except Exception as e:
        print(f"下载失败: {e}")
        # 清理临时文件
        if "tmp_path" in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return False


def extract_zip(zip_path: Path, extract_dir: Path) -> bool:
    """解压ZIP文件"""
    print(f"解压: {zip_path}")
    print(f"到目录: {extract_dir}")

    try:
        # 确保目标目录存在
        extract_dir.mkdir(parents=True, exist_ok=True)

        # 解压
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            # 获取文件列表
            file_list = zip_ref.namelist()
            print(f"找到 {len(file_list)} 个文件/目录")

            # 解压所有文件
            zip_ref.extractall(extract_dir)

        print("解压完成")

        # 列出解压的文件
        print("\n解压内容:")
        for root, dirs, files in os.walk(extract_dir):
            level = root.replace(str(extract_dir), "").count(os.sep)
            indent = " " * 2 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = " " * 2 * (level + 1)
            for file in files[:10]:  # 最多显示10个文件
                print(f"{subindent}{file}")
            if len(files) > 10:
                print(f"{subindent}... 和 {len(files) - 10} 个其他文件")
            if not files and not dirs:
                print(f"{subindent}(空)")

        return True

    except Exception as e:
        print(f"解压失败: {e}")
        return False


def check_existing_data() -> bool:
    """检查是否已有数据文件"""
    print("检查现有数据文件...")

    if not DATA_DIR.exists():
        print(f"数据目录不存在: {DATA_DIR}")
        return False

    # 检查目录是否为空
    items = list(DATA_DIR.iterdir())
    if not items:
        print("数据目录为空")
        return False

    print(f"数据目录包含 {len(items)} 个项目")
    for item in items:
        size = ""
        if item.is_file():
            size = f" ({item.stat().st_size / 1024 / 1024:.2f} MB)"
        print(f"  - {item.name}{'/' if item.is_dir() else ''}{size}")

    # 检查是否有模型文件
    model_extensions = [".bin", ".model", ".zip", ".pb", ".ckpt"]
    model_files = []
    for item in DATA_DIR.rglob("*"):
        if item.is_file() and any(
            item.suffix.lower() == ext for ext in model_extensions
        ):
            model_files.append(item)

    if model_files:
        print(f"找到 {len(model_files)} 个可能的模型文件")
        return True

    # 检查是否有vidyut-data目录结构
    if (DATA_DIR / "vidyut-data").exists():
        print("找到vidyut-data目录结构")
        return True

    return len(items) > 0


def main():
    print("vidyut数据文件下载工具")
    print("=" * 60)

    # 检查现有数据
    if check_existing_data():
        print("\n⚠️  数据目录已包含文件")
        response = input("是否继续下载并覆盖? (y/N): ").strip().lower()
        if response != "y":
            print("取消下载")
            return

    # 创建数据目录
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 下载ZIP文件到临时位置
    zip_path = DATA_DIR / "data-0.4.0.zip"

    # 尝试多个URL
    download_success = False
    for data_url in DATA_URLS:
        print(f"\n尝试URL: {data_url}")
        if download_file(data_url, zip_path):
            download_success = True
            break
        else:
            print(f"URL失败: {data_url}")

    if not download_success:
        print("所有URL下载失败，退出")
        sys.exit(1)

    # 解压
    if not extract_zip(zip_path, DATA_DIR):
        print("解压失败，退出")
        sys.exit(1)

    # 清理ZIP文件（可选）
    print("\n清理ZIP文件...")
    try:
        zip_path.unlink()
        print("已删除ZIP文件")
    except Exception as e:
        print(f"警告: 无法删除ZIP文件: {e}")

    print("\n✅ 数据文件下载完成!")
    print(f"数据目录: {DATA_DIR}")

    # 测试数据文件是否可用
    print("\n测试数据文件...")
    test_data_access()


def test_data_access():
    """测试数据文件访问"""
    try:
        import vidyut
        from vidyut.cheda import Chedaka

        print("测试Chedaka初始化...")
        try:
            # 尝试使用数据目录
            chedaka = Chedaka(str(DATA_DIR))
            print("✅ Chedaka初始化成功!")

            # 测试分词
            test_word = "रामायणम्"
            print(f"测试分词: {test_word}")
            segments = chedaka.segment(test_word)
            parts = [seg.text for seg in segments]
            print(f"  结果: {parts}")

            return True

        except Exception as e:
            print(f"❌ Chedaka初始化失败: {e}")

            # 尝试在子目录中查找数据文件
            print("搜索数据文件...")
            for root, dirs, files in os.walk(DATA_DIR):
                for file in files:
                    if file.endswith(".bin") or "model" in file.lower():
                        model_path = Path(root) / file
                        print(f"  尝试模型文件: {model_path}")
                        try:
                            chedaka = Chedaka(str(model_path))
                            print(f"  ✅ 使用 {model_path} 成功!")
                            return True
                        except Exception as e2:
                            print(f"  ❌ 失败: {e2}")

            return False

    except ImportError as e:
        print(f"❌ 无法导入vidyut: {e}")
        return False


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
启动服务并进行简单测试
"""

import subprocess
import time
import requests
import sys
import os
import signal


def start_server():
    """启动Flask服务器"""
    print("启动增强梵语API服务...")

    # 使用uv运行
    cmd = ["uv", "run", "enhanced_sanskrit_api.py"]

    # 启动子进程
    proc = subprocess.Popen(
        cmd,
        cwd=os.path.dirname(os.path.abspath(__file__)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True,
    )

    # 等待服务器启动
    print("等待服务器启动...")
    time.sleep(5)

    return proc


def test_endpoints():
    """测试API端点"""
    base_url = "http://localhost:3008"

    print(f"\n测试API端点...")

    # 测试健康检查
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✓ 健康检查: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  状态: {data.get('status')}")
            print(f"  初始化: {data.get('initialized')}")
            print(f"  组件: {data.get('components', {})}")
    except Exception as e:
        print(f"✗ 健康检查失败: {e}")
        return False

    # 测试获取方案列表
    try:
        response = requests.get(f"{base_url}/api/schemes", timeout=5)
        print(f"✓ 方案列表: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  方案数量: {data.get('count', 0)}")
    except Exception as e:
        print(f"✗ 方案列表失败: {e}")

    # 测试转写功能
    try:
        payload = {"text": "भवति", "from": "devanagari", "to": "iast"}
        response = requests.post(
            f"{base_url}/api/transliterate", json=payload, timeout=10
        )
        print(f"✓ 转写测试: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"  结果: {data.get('transliterated', 'N/A')}")
    except Exception as e:
        print(f"✗ 转写测试失败: {e}")

    # 测试词形生成（新参数过滤功能）
    try:
        payload = {
            "dhatu": "BU",
            "gana": "bhvadi",
            "lakara": "lat",
            "prayoga": "kartari",
            "purusha": "prathama",
            "vacana": "eka",
            "pada": "parasmaipada",
        }
        response = requests.post(f"{base_url}/api/generate", json=payload, timeout=10)
        print(f"✓ 词形生成测试: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                forms = data.get("forms", [])
                print(f"  生成词形数量: {len(forms)}")
                if forms:
                    print(f"  第一个词形: {forms[0].get('text', 'N/A')}")
                    print(
                        f"  参数: lakara={data.get('lakara')}, purusha={data.get('purusha')}"
                    )
            else:
                print(f"  错误: {data.get('error', 'N/A')}")
    except Exception as e:
        print(f"✗ 词形生成测试失败: {e}")

    return True


def main():
    print("=" * 60)
    print("增强梵语API服务测试")
    print("=" * 60)

    # 启动服务器
    proc = start_server()

    try:
        # 测试端点
        success = test_endpoints()

        if success:
            print(f"\n{'=' * 60}")
            print("服务启动成功！")
            print("前端可以连接到: http://localhost:3008")
            print(f"{'=' * 60}")

            # 保持服务器运行
            print("\n按Ctrl+C停止服务器...")
            proc.wait()
        else:
            print("\n服务测试失败")
            proc.terminate()

    except KeyboardInterrupt:
        print("\n\n停止服务器...")
        proc.terminate()
        proc.wait()
    except Exception as e:
        print(f"\n错误: {e}")
        proc.terminate()
        proc.wait()
        sys.exit(1)


if __name__ == "__main__":
    main()

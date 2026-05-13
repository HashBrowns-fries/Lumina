#!/usr/bin/env python3
"""
GazeFollower 校准脚本 - 按照官方文档实现
"""

import sys
import os
import time

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

API_BASE = "http://127.0.0.1:8765"

CALIB_DIR = os.path.expanduser("~/.lumina")
CALIB_DONE_FILE = os.path.join(CALIB_DIR, "calibration_done.txt")

log_path = os.path.join(os.path.expanduser("~"), "lumina_calibration.log")


def log(msg):
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n")


def mark_calibration_done():
    os.makedirs(CALIB_DIR, exist_ok=True)
    with open(CALIB_DONE_FILE, "w") as f:
        f.write(str(time.time()))


log("校准脚本启动")

import pygame
from gazefollower import GazeFollower


def main():
    try:
        # 按照官方文档: init pygame
        pygame.init()
        win = pygame.display.set_mode((1920, 1080), pygame.FULLSCREEN)

        # init GazeFollower
        log("创建 GazeFollower")
        gf = GazeFollower()

        # previewing
        log("预览摄像头...")
        gf.preview(win=win)

        # calibrating
        log("开始校准，请跟随窗口中的点...")
        gf.calibrate(win=win)

        # 校准完成标记
        log("校准完成！")
        mark_calibration_done()

        # sampling
        log("开始采样...")
        gf.start_sampling()
        pygame.time.wait(100)  # 等待缓存一些样本

        log("正在运行，按 ESC 键退出")

        # 保持运行，持续获取 gaze 数据
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False

            # 获取 gaze 数据
            gaze_info = gf.get_gaze_info()
            if gaze_info and gaze_info.status:
                # 使用 filtered_gaze_coordinates
                gx = int(gaze_info.filtered_gaze_coordinates[0])
                gy = int(gaze_info.filtered_gaze_coordinates[1])

                # 显示
                print(f"Gaze: ({gx}, {gy})", end="\r")

                # 发送到 API
                try:
                    import requests

                    requests.post(
                        f"{API_BASE}/api/gaze/external_data",
                        json={"x": gx, "y": gy, "timestamp": time.time()},
                        timeout=0.5,
                    )
                except:
                    pass

            pygame.display.flip()

        # 停止
        pygame.time.wait(100)
        gf.stop_sampling()

        # 保存数据
        data_dir = "./data"
        os.makedirs(data_dir, exist_ok=True)
        gf.save_data(os.path.join(data_dir, "calibration_data.csv"))

        log("数据已保存")

    except KeyboardInterrupt:
        log("用户中断")
    except Exception as e:
        import traceback

        log(f"错误: {e}")
        traceback.print_exc()
    finally:
        try:
            gf.release()
        except:
            pass
        try:
            pygame.quit()
        except:
            pass
        log("结束")


if __name__ == "__main__":
    main()

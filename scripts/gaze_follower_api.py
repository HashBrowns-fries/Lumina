#!/usr/bin/env python3
"""
GazeFollower API 服务
为 Lumina 阅读器提供眼动追踪功能
"""

import os
import sys
import json
import logging
import threading
import time
import pygame
import multiprocessing as mp
from pathlib import Path
from typing import Dict, Any
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

gaze_follower = None
gaze_data = {"x": 0, "y": 0, "fixation": False, "timestamp": 0, "valid": False}
reading_stats = {
    "reading_speed": 0,
    "avg_dwell_time": 0,
    "regression_rate": 0,
    "total_time": 0,
    "fixation_count": 0,
    "saccade_count": 0,
    "words_read": 0,
    "regression_count": 0,
    "progression_count": 0,
}
is_running = False
is_calibrated = False
last_stats_time = None
last_gaze_x = None

CALIB_DIR = os.path.expanduser("~/.lumina")
CALIB_DONE_FILE = os.path.join(CALIB_DIR, "calibration_done.txt")


def check_calibration_done():
    return os.path.exists(CALIB_DONE_FILE)


data_lock = threading.Lock()
gaze_lock = threading.Lock()

calibration_queue = mp.Queue()
gaze_queue = mp.Queue()


def gaze_sampling_thread(gf, screen_width, screen_height):
    """后台采样线程，持续获取 gaze 数据"""
    global gaze_data
    logger.info("Gaze 采样线程启动")
    while is_running and gf and gf.running:
        try:
            data = gf.get_gaze_info()
            if (
                data
                and hasattr(data, "cali_gaze_coordinates")
                and data.cali_gaze_coordinates is not None
            ):
                x, y = data.cali_gaze_coordinates
                x = float(x) if hasattr(x, "__float__") else x
                y = float(y) if hasattr(y, "__float__") else y

                with gaze_lock:
                    gaze_data = {
                        "x": x,
                        "y": y,
                        "fixation": getattr(data, "fixation", False),
                        "timestamp": time.time(),
                        "valid": True,
                    }
        except Exception as e:
            logger.debug(f"Gaze 采样错误: {e}")
        time.sleep(0.05)
    logger.info("Gaze 采样线程结束")


def calibration_process(queue, gaze_queue):
    """校准进程"""
    try:
        pygame.init()
        from gazefollower import GazeFollower
        from gazefollower.face_alignment import MediaPipeFaceAlignment

        gf = GazeFollower(face_alignment=MediaPipeFaceAlignment())

        # 运行校准
        gf.calibrate()

        # 保存校准模型
        if hasattr(gf, "calibration") and hasattr(gf.calibration, "save_model"):
            gf.calibration.save_model()
            logger.info("校准模型已保存")

        # 标记校准完成
        os.makedirs(CALIB_DIR, exist_ok=True)
        with open(CALIB_DONE_FILE, "w") as f:
            f.write("calibrated")

        # 校准完成，开始采样
        gf.start_sampling()

        # 持续发送数据
        while True:
            try:
                data = gf.get_gaze_info()
                if (
                    data
                    and hasattr(data, "cali_gaze_coordinates")
                    and data.cali_gaze_coordinates is not None
                ):
                    x, y = data.cali_gaze_coordinates
                    # Handle numpy types
                    x = float(x) if hasattr(x, "__float__") else x
                    y = float(y) if hasattr(y, "__float__") else y
                    gaze_queue.put(
                        {
                            "x": x,
                            "y": y,
                            "fixation": getattr(data, "fixation", False),
                            "timestamp": time.time(),
                            "valid": True,
                        }
                    )
            except:
                pass
            time.sleep(0.1)

    except Exception as e:
        logger.error(f"校准进程错误: {e}")
    finally:
        try:
            pygame.quit()
        except:
            pass


class GazeTracker:
    def __init__(self):
        self.gf = None
        self.running = False
        self.screen_width = 1920
        self.screen_height = 1080
        self.sampling_thread = None
        self.should_sample = False

    def initialize(self, screen_width: int = 1920, screen_height: int = 1080):
        try:
            from gazefollower import GazeFollower
            from gazefollower.face_alignment import MediaPipeFaceAlignment

            self.screen_width = screen_width
            self.screen_height = screen_height
            self.gf = GazeFollower(face_alignment=MediaPipeFaceAlignment())
            logger.info("GazeFollower 初始化成功")
            return True
        except Exception as e:
            logger.error(f"GazeFollower 初始化失败: {e}")
            return False

    def start_sampling(self):
        if self.gf:
            self.gf.start_sampling()
            self.running = True
            logger.info("开始采样")
            self.should_sample = True
            self.sampling_thread = threading.Thread(
                target=gaze_sampling_thread,
                args=(self.gf, self.screen_width, self.screen_height),
                daemon=True,
            )
            self.sampling_thread.start()
            logger.info("采样线程已启动")

    def stop_sampling(self):
        self.should_sample = False
        if self.gf:
            self.gf.stop_sampling()
            self.running = False
            logger.info("停止采样")

    def get_gaze(self) -> Dict[str, Any]:
        global gaze_data
        with gaze_lock:
            return (
                gaze_data.copy()
                if gaze_data
                else {
                    "x": 0,
                    "y": 0,
                    "fixation": False,
                    "timestamp": time.time(),
                    "valid": False,
                }
            )

    def release(self):
        self.should_sample = False
        if self.gf:
            try:
                self.gf.release()
            except:
                pass
            self.gf = None
            self.running = False


def calculate_reading_stats(new_gaze: Dict[str, Any]) -> Dict[str, Any]:
    global reading_stats, last_stats_time, last_gaze_x, last_was_fixation

    with data_lock:
        current_time = time.time()

        # 第一次调用时初始化
        if last_stats_time is None:
            last_stats_time = current_time
            last_gaze_x = new_gaze.get("x", 0)
            last_was_fixation = new_gaze.get("fixation", False)
            return reading_stats.copy()

        current_x = new_gaze.get("x", 0)
        current_fixation = new_gaze.get("fixation", False)

        # 使用实际时间差而不是计数
        if new_gaze.get("valid", False):
            time_diff = current_time - last_stats_time
            reading_stats["total_time"] += time_diff

            reading_stats["fixation_count"] += 1 if current_fixation else 0

            # 检测回视：当从注视转为扫视时
            if last_was_fixation and not current_fixation and last_gaze_x is not None:
                reading_stats["saccade_count"] += 1
                # 回视：眼睛从右向左移动（x 减少）
                if current_x < last_gaze_x - 10:  # 阈值10像素
                    reading_stats["regression_count"] += 1
                # 顺视：眼睛从左向右移动（x 增加）
                elif current_x > last_gaze_x + 10:
                    reading_stats["progression_count"] += 1

            last_gaze_x = current_x
            last_was_fixation = current_fixation
            last_stats_time = current_time

        # 计算平均注视时间（秒）
        if reading_stats["total_time"] > 0:
            reading_stats["avg_dwell_time"] = (
                reading_stats["fixation_count"] / reading_stats["total_time"]
            )

        # 计算回视率
        total_saccades = (
            reading_stats["regression_count"] + reading_stats["progression_count"]
        )
        if total_saccades > 0:
            reading_stats["regression_rate"] = (
                reading_stats["regression_count"] / total_saccades
            )

        reading_stats["reading_speed"] = max(
            0,
            int(reading_stats["words_read"] / max(1, reading_stats["total_time"] / 60)),
        )
        return reading_stats.copy()


last_was_fixation = False


calibration_proc = None
gaze_proc = None


@app.route("/api/gaze/start", methods=["POST"])
def start_gaze():
    global \
        gaze_follower, \
        is_running, \
        is_calibrated, \
        calibration_proc, \
        gaze_proc, \
        reading_stats, \
        last_stats_time

    if is_running:
        return jsonify({"status": "already_running"})

    # 重置统计数据
    reading_stats = {
        "reading_speed": 0,
        "avg_dwell_time": 0,
        "regression_rate": 0,
        "total_time": 0,
        "fixation_count": 0,
        "saccade_count": 0,
        "words_read": 0,
        "regression_count": 0,
        "progression_count": 0,
    }
    last_stats_time = None
    last_gaze_x = None
    last_was_fixation = False

    data = request.get_json() or {}
    screen_width = data.get("screenWidth", 1920)
    screen_height = data.get("screenHeight", 1080)

    try:
        pygame.init()
        pygame.display.set_mode((screen_width, screen_height), pygame.RESIZABLE)

        gaze_follower = GazeTracker()
        if not gaze_follower.initialize(screen_width, screen_height):
            return jsonify(
                {"status": "error", "message": "GazeFollower 初始化失败"}
            ), 500

        is_running = True
        # 检查是否已有校准文件
        calib_done = check_calibration_done()
        is_calibrated = calib_done
        logger.info(f"眼动追踪已启动, 校准状态: {is_calibrated}")

        if is_calibrated:
            return jsonify(
                {"status": "started", "message": "眼动追踪已启动，已加载之前的校准"}
            )
        else:
            return jsonify(
                {"status": "started", "message": "眼动追踪已启动，请先进行校准"}
            )
    except Exception as e:
        logger.error(f"启动失败: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/gaze/stop", methods=["POST"])
def stop_gaze():
    global gaze_follower, is_running, is_calibrated, calibration_proc, gaze_proc

    try:
        if calibration_proc and calibration_proc.is_alive():
            calibration_proc.terminate()
        if gaze_proc and gaze_proc.is_alive():
            gaze_proc.terminate()

        if gaze_follower:
            gaze_follower.stop_sampling()
            gaze_follower.release()

        is_running = False
        is_calibrated = False
        logger.info("眼动追踪已停止")

        return jsonify({"status": "stopped"})
    except Exception as e:
        logger.error(f"停止失败: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/gaze/calibrate", methods=["POST"])
def calibrate():
    global gaze_follower, is_calibrated, calibration_proc, gaze_proc

    if not gaze_follower:
        return jsonify({"status": "error", "message": "GazeFollower 未启动"}), 400

    if is_calibrated:
        return jsonify({"status": "already_calibrated", "message": "已经校准过了"})

    try:
        # 启动校准进程
        calibration_proc = mp.Process(
            target=calibration_process, args=(calibration_queue, gaze_queue)
        )
        calibration_proc.start()

        logger.info("校准进程已启动")

        return jsonify(
            {"status": "calibrating", "message": "校准窗口已打开，请在窗口中完成校准"}
        )

    except Exception as e:
        logger.error(f"校准启动失败: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/gaze/reset_calibration", methods=["POST"])
def reset_calibration():
    """重置校准状态"""
    global is_calibrated

    try:
        if os.path.exists(CALIB_DONE_FILE):
            os.remove(CALIB_DONE_FILE)

        if is_calibrated and gaze_follower:
            gaze_follower.stop_sampling()

        is_calibrated = False
        logger.info("校准状态已重置")

        return jsonify({"status": "ok", "message": "校准已重置"})
    except Exception as e:
        logger.error(f"重置校准失败: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/gaze/status", methods=["GET"])
def get_status():
    global is_running, is_calibrated, calibration_proc, gaze_proc

    # 检查校准是否完成（通过标记文件）
    calib_done = check_calibration_done()

    # 如果发现校准完成标记，自动开始采样
    if calib_done and not is_calibrated and is_running:
        if gaze_follower and not gaze_follower.running:
            try:
                gaze_follower.start_sampling()
                is_calibrated = True
                logger.info("检测到校准标记，自动开始采样")
            except Exception as e:
                logger.error(f"自动开始采样失败: {e}")

    return jsonify(
        {
            "running": is_running,
            "calibrated": is_calibrated,
            "calibration_file_exists": calib_done,
        }
    )


@app.route("/api/gaze/external_data", methods=["POST"])
def external_gaze_data():
    """接收来自校准脚本的外部 gaze 数据"""
    global gaze_data, is_calibrated

    try:
        json_data = request.get_json()

        x = float(json_data.get("x", 0))
        y = float(json_data.get("y", 0))
        ts = float(json_data.get("timestamp", time.time()))

        with gaze_lock:
            gaze_data = {
                "x": x,
                "y": y,
                "fixation": False,
                "timestamp": ts,
                "valid": True,
            }
        is_calibrated = True

        return jsonify({"status": "ok", "received": {"x": x, "y": y}})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/gaze/test_data", methods=["GET"])
def test_data():
    """测试用 - 直接返回 gaze_data"""
    with gaze_lock:
        return jsonify(
            gaze_data.copy()
            if gaze_data
            else {"x": 0, "y": 0, "fixation": False, "timestamp": 0, "valid": False}
        )


@app.route("/api/gaze/data", methods=["GET"])
def get_data():
    """获取实时视线数据"""
    global gaze_data, is_running

    with gaze_lock:
        current_gaze = (
            gaze_data.copy()
            if gaze_data
            else {
                "x": 0,
                "y": 0,
                "fixation": False,
                "timestamp": time.time(),
                "valid": False,
            }
        )

    if current_gaze.get("valid"):
        stats = calculate_reading_stats(current_gaze)
        return jsonify(
            {
                "x": current_gaze.get("x", 0),
                "y": current_gaze.get("y", 0),
                "fixation": current_gaze.get("fixation", False),
                "timestamp": current_gaze.get("timestamp", time.time()),
                "valid": current_gaze.get("valid", False),
                **stats,
            }
        )

    if not is_running:
        return jsonify(
            {
                "x": 0,
                "y": 0,
                "fixation": False,
                "timestamp": time.time(),
                "valid": False,
                "reading_speed": 0,
                "avg_dwell_time": 0,
                "regression_rate": 0,
                "total_time": 0,
            }
        )

    return jsonify(
        {
            "x": 0,
            "y": 0,
            "fixation": False,
            "timestamp": time.time(),
            "valid": False,
            "reading_speed": 0,
            "avg_dwell_time": 0,
            "regression_rate": 0,
            "total_time": 0,
        }
    )


@app.route("/api/gaze/words_read", methods=["POST"])
def words_read():
    global reading_stats
    data = request.get_json() or {}
    count = data.get("count", 1)
    with data_lock:
        reading_stats["words_read"] += count
    return jsonify({"status": "ok", "words_read": reading_stats["words_read"]})


@app.route("/api/gaze/reset_stats", methods=["POST"])
def reset_stats():
    global reading_stats, last_stats_time, last_gaze_x, last_was_fixation
    with data_lock:
        reading_stats = {
            "reading_speed": 0,
            "avg_dwell_time": 0,
            "regression_rate": 0,
            "total_time": 0,
            "fixation_count": 0,
            "saccade_count": 0,
            "words_read": 0,
            "regression_count": 0,
            "progression_count": 0,
        }
        last_stats_time = None
        last_gaze_x = None
        last_was_fixation = False
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    logger.info("启动 GazeFollower API 服务在端口 8765")
    app.run(host="127.0.0.1", port=8765, debug=False)

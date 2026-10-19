#!/usr/bin/env python3
"""
神秘商店海报生成脚本
用法：
  1. 在仓库根目录启动静态服务器：python3 -m http.server 8765
  2. 运行本脚本：python3 poster/screenshot_poster.py
依赖：playwright, Pillow
  pip install playwright pillow
  playwright install chromium
"""
import os
from playwright.sync_api import sync_playwright

# 基于脚本所在目录定位文件
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)

URL = "http://localhost:8765/poster/poster.html"
OUT = os.path.join(SCRIPT_DIR, "mystery_shop_poster.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        viewport={"width": 1920, "height": 4480},
        device_scale_factor=1,
    )
    page.goto(URL, wait_until="networkidle")
    # 等待字体加载 + 二维码生成
    page.wait_for_timeout(3000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(1500)

    # 截取 .poster 元素
    el = page.query_selector(".poster")
    el.screenshot(path=OUT, type="png")
    print(f"screenshot saved: {OUT}")

    # 验证尺寸
    from PIL import Image
    img = Image.open(OUT)
    print(f"size: {img.size}")
    browser.close()

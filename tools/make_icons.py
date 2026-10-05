# 앱 아이콘(🥚 알 그림) 만들기
# 그림 라이브러리 없이 순수 파이썬으로 PNG 파일을 직접 만듦
# 실행: python tools/make_icons.py   (monster-idle 폴더에서)
# 색이나 크기를 바꾸고 다시 실행하면 icons/ 폴더의 그림이 새로 만들어짐

import math
import os
import struct
import zlib

# ===== 색 (빨강, 초록, 파랑: 0~255) =====
BACKGROUND = (253, 246, 227)  # 게임 배경과 같은 크림색
SHADOW = (232, 220, 196)      # 알 밑 그림자
EGG_LIGHT = (255, 255, 250)   # 알 밝은 부분
EGG_DARK = (240, 228, 205)    # 알 어두운 부분 (오른쪽 아래)
OUTLINE = (201, 187, 165)     # 알 테두리
SPOTS = [                     # 알 반점: (가로 위치, 세로 위치, 크기, 색) — 위치는 알 기준 -1~1
    (-0.35, -0.25, 0.20, (244, 162, 97)),
    (0.30, 0.05, 0.26, (155, 111, 201)),
    (-0.20, 0.45, 0.16, (139, 191, 106)),
    (0.15, -0.60, 0.12, (244, 162, 97)),
]

SAMPLES = 3  # 한 픽셀을 3×3으로 나눠 보고 평균 → 테두리가 계단처럼 깨지지 않음


def egg_inside(x, y, cx, cy, width, height):
    """(x, y)가 알 안에 있는지 확인하고, 알 기준 좌표(-1~1)를 돌려줌 (밖이면 None)"""
    v = (y - cy) / (height / 2)  # 위 -1 ~ 아래 1
    if v <= -1 or v >= 1:
        return None
    # 알 모양: 아래쪽이 조금 더 통통하도록 폭에 (1 + 0.18 × v)를 곱함
    half_width = (width / 2) * math.sqrt(1 - v * v) * (1 + 0.18 * v)
    u = (x - cx) / (width / 2)
    if abs(x - cx) > half_width:
        return None
    return u, v


def mix(a, b, t):
    """색 a와 b를 t(0~1) 비율로 섞기"""
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def color_at(x, y, size, egg_scale):
    """그림의 한 점 (x, y) 색 정하기"""
    cx = size / 2
    height = size * egg_scale
    width = height * 0.76
    cy = size / 2 - height * 0.02

    # 알 밑 그림자 (납작한 타원)
    sx = (x - cx) / (width * 0.48)
    sy = (y - (cy + height * 0.47)) / (height * 0.06)
    color = SHADOW if sx * sx + sy * sy <= 1 else BACKGROUND

    outer = egg_inside(x, y, cx, cy, width, height)
    if outer is None:
        return color

    line = size * 0.012  # 테두리 두께
    inner = egg_inside(x, y, cx, cy, width - line * 2, height - line * 2)
    if inner is None:
        return OUTLINE

    u, v = inner
    # 왼쪽 위는 밝게, 오른쪽 아래는 어둡게 (입체감)
    shade = min(max((u * 0.6 + v * 0.8 + 0.4) / 1.8, 0), 1)
    color = mix(EGG_LIGHT, EGG_DARK, shade)

    # 반점
    for spot_u, spot_v, radius, spot_color in SPOTS:
        du = u - spot_u
        dv = (v - spot_v) * (height / width)  # 세로로 늘어나지 않게 비율 맞춤
        if du * du + dv * dv <= radius * radius:
            color = mix(spot_color, EGG_DARK, shade * 0.3)
    return color


def make_image(size, egg_scale):
    """size×size 그림을 픽셀 줄 목록으로 만들기"""
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            total = [0.0, 0.0, 0.0]
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    c = color_at(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES, size, egg_scale)
                    for i in range(3):
                        total[i] += c[i]
            count = SAMPLES * SAMPLES
            row += bytes(round(t / count) for t in total)
        rows.append(bytes(row))
    return rows


def save_png(path, rows, size):
    """픽셀 줄들을 PNG 파일로 저장 (PNG 형식 규칙대로 조각을 이어 붙임)"""
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\x00" + row for row in rows)  # 줄마다 앞에 0(필터 없음)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))  # 8비트 RGB
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


# 만들 아이콘 목록: (파일 이름, 크기, 알 크기 비율)
# maskable: 안드로이드가 동그라미·둥근 네모 등으로 잘라 내도 알이 안 잘리게 작게 그림
ICONS = [
    ("icon-192.png", 192, 0.72),
    ("icon-512.png", 512, 0.72),
    ("icon-maskable-512.png", 512, 0.56),
    ("apple-touch-icon.png", 180, 0.72),
]

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for name, size, egg_scale in ICONS:
        path = os.path.join(out_dir, name)
        save_png(path, make_image(size, egg_scale), size)
        print("만듦:", os.path.normpath(path))

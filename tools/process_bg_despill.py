"""离线清理第二章战场绿幕，仅移除与画布边缘连通的绿幕像素。"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def process(src, dst, quality=92):
    image = Image.open(src).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32)
    red, green, blue = rgb.transpose(2, 0, 1)
    excess = green - np.maximum(red, blue)

    # 只把明显偏绿的像素作为泛洪候选，再从四边取连通区域。
    candidate = excess >= 24
    labels, _ = ndimage.label(candidate, structure=np.ones((3, 3), dtype=np.uint8))
    border_labels = np.unique(np.concatenate((
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]
    )))
    border_labels = border_labels[border_labels != 0]
    keyed = np.isin(labels, border_labels)

    alpha = np.full(excess.shape, 255.0, dtype=np.float32)
    alpha[keyed] = 0

    # 对绿幕边缘外侧一像素做轻柔透明过渡，压住抗锯齿留下的绿轮廓。
    edge = ndimage.binary_dilation(keyed, structure=np.ones((3, 3), dtype=np.uint8)) & ~keyed
    edge_alpha = np.clip((24.0 - np.maximum(excess, 0.0)) / 24.0, 0.0, 1.0) * 255.0
    alpha[edge] = np.minimum(alpha[edge], edge_alpha[edge])

    # 对一像素边缘做轻微内缩/羽化，保持内部细节与整体轮廓。
    foreground = ~keyed
    eroded = ndimage.binary_erosion(foreground, structure=np.ones((3, 3), dtype=np.uint8), border_value=1)
    inner_edge = foreground & ~eroded & ~edge
    alpha[inner_edge] = np.minimum(alpha[inner_edge], 238.0)

    # 只在透明边缘附近去绿，避免改变场景内其他颜色。
    clean_rgb = rgb.transpose(2, 0, 1).copy()
    despill = alpha < 255
    clean_rgb[1, despill] = np.minimum(green[despill], np.maximum(red[despill], blue[despill]))

    out = np.dstack((clean_rgb.transpose(1, 2, 0), alpha)).clip(0, 255).astype(np.uint8)
    invisible = out[..., 3] < 8
    out[invisible] = 0
    Image.fromarray(out).save(dst, "WEBP", quality=int(quality), method=6, lossless=True)
    print(f"saved {dst}: {out.shape[1]}x{out.shape[0]}, webp quality {quality}")


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else "art/gemini/第二章_战场_绿幕.png"
    target = sys.argv[2] if len(sys.argv) > 2 else "art/bg/chapter2_battlefield.webp"
    output_quality = int(sys.argv[3]) if len(sys.argv) > 3 else 92
    process(source, target, output_quality)

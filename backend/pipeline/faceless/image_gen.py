"""Generate images using Flux via OpenRouter API."""

import os
import time
import base64
import httpx
from PIL import Image

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = "black-forest-labs/flux.2-klein-4b"

# Final video size
VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920


def _generate_one(prompt: str, output_path: str, index: int, retries: int = 2) -> str:
    """Generate a single image via Flux on OpenRouter. Returns output_path on success."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "modalities": ["image"],
        "messages": [{"role": "user", "content": prompt}],
    }

    for attempt in range(retries + 1):
        try:
            start = time.time()
            r = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120)
            elapsed = round(time.time() - start, 1)

            if r.status_code != 200:
                print(f"[ImageGen] Image {index+1} attempt {attempt+1}: HTTP {r.status_code}")
                if attempt < retries:
                    time.sleep(3)
                    continue
                return _create_fallback(output_path, index)

            data = r.json()
            images = data.get("choices", [{}])[0].get("message", {}).get("images", [])
            if not images:
                print(f"[ImageGen] Image {index+1} attempt {attempt+1}: No images in response")
                if attempt < retries:
                    time.sleep(3)
                    continue
                return _create_fallback(output_path, index)

            url = images[0].get("image_url", {}).get("url", "")
            if not url.startswith("data:image/"):
                print(f"[ImageGen] Image {index+1}: Unexpected image URL format")
                return _create_fallback(output_path, index)

            b64 = url.split(",", 1)[1]
            img_bytes = base64.b64decode(b64)

            raw_path = output_path.rsplit(".", 1)[0] + "_raw.png"
            with open(raw_path, "wb") as f:
                f.write(img_bytes)

            img = Image.open(raw_path).convert("RGB")
            img = img.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.LANCZOS)
            img.save(output_path, "JPEG", quality=92)
            os.remove(raw_path)

            size_kb = os.path.getsize(output_path) // 1024
            print(f"[ImageGen] Image {index+1} saved in {elapsed}s: {output_path} ({size_kb}KB)")
            return output_path

        except Exception as e:
            print(f"[ImageGen] Image {index+1} attempt {attempt+1} error: {e}")
            if attempt < retries:
                time.sleep(3)

    return _create_fallback(output_path, index)


def _create_fallback(output_path: str, index: int) -> str:
    """Gradient fallback if generation fails."""
    from PIL import ImageDraw

    palettes = [
        ((10, 30, 60), (40, 80, 120)),
        ((20, 50, 30), (60, 120, 80)),
        ((40, 20, 50), (100, 50, 120)),
        ((50, 20, 20), (120, 50, 40)),
        ((20, 40, 50), (50, 100, 120)),
    ]
    top, bottom = palettes[index % len(palettes)]
    img = Image.new("RGB", (VIDEO_WIDTH, VIDEO_HEIGHT))
    draw = ImageDraw.Draw(img)
    for y in range(VIDEO_HEIGHT):
        ratio = y / VIDEO_HEIGHT
        r = int(top[0] + (bottom[0] - top[0]) * ratio)
        g = int(top[1] + (bottom[1] - top[1]) * ratio)
        b = int(top[2] + (bottom[2] - top[2]) * ratio)
        draw.line([(0, y), (VIDEO_WIDTH, y)], fill=(r, g, b))
    img.save(output_path, quality=92)
    print(f"[ImageGen] Fallback gradient saved: {output_path}")
    return output_path


def generate_segment_images(segments: list, output_dir: str) -> list:
    """
    Generate AI images for all segments sequentially via Flux.
    Each image takes ~8-10 seconds.
    """
    os.makedirs(output_dir, exist_ok=True)

    paths = []
    total = len(segments)
    for i, seg in enumerate(segments):
        prompt = seg.get("image_prompt", "Beautiful landscape, cinematic, warm colors")
        path = os.path.join(output_dir, f"scene_{i}.jpg")
        print(f"[ImageGen] Generating image {i+1}/{total}...")
        _generate_one(prompt, path, i)
        paths.append(path)
        if i < total - 1:
            time.sleep(1)

    print(f"[ImageGen] All {total} images generated.")
    return paths

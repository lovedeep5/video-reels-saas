"""Generate images using Google Gemini (nano-banana) via OpenRouter API."""

import os
import re
import time
import base64
import httpx
from PIL import Image

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# Gemini image models via OpenRouter (nano-banana)
# flash = good quality + fast, pro = best quality (used as fallback on failure)
MODEL_FLASH = "google/gemini-2.5-flash-preview-05-20"
MODEL_PRO   = "google/gemini-2.0-flash-exp:free"

VIDEO_WIDTH  = 1080
VIDEO_HEIGHT = 1920

NEGATIVE_PROMPT = "blurry, deformed, bad anatomy, wrong hands, extra limbs, watermark, text overlay, signature, low quality, pixelated, distorted face, disfigured"


def _generate_one(prompt: str, output_path: str, index: int, retries: int = 2) -> str:
    """Generate a single image via Gemini on OpenRouter. Returns output_path on success."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vidtoreels.com",
    }

    # Gemini needs modalities + the negative prompt injected into the prompt text
    full_prompt = f"{prompt}\n\nAvoid: {NEGATIVE_PROMPT}"

    models_to_try = [MODEL_FLASH, MODEL_PRO]

    for attempt in range(retries + 1):
        for model in models_to_try:
            try:
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": full_prompt}],
                    "modalities": ["image", "text"],
                    "max_tokens": 4096,
                }
                start = time.time()
                r = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=120)
                elapsed = round(time.time() - start, 1)

                if r.status_code != 200:
                    print(f"[ImageGen] img={index+1} model={model} attempt={attempt+1}: HTTP {r.status_code}")
                    continue

                data = r.json()
                msg = data.get("choices", [{}])[0].get("message", {})

                # OpenRouter returns images in message.images array
                images = msg.get("images", [])
                url = ""
                if images:
                    img_entry = images[0]
                    img_url_field = img_entry.get("image_url", "")
                    if isinstance(img_url_field, str):
                        url = img_url_field
                    elif isinstance(img_url_field, dict):
                        url = img_url_field.get("url", "")

                # Fallback: check content for inline base64
                if not url:
                    content_text = msg.get("content", "")
                    if isinstance(content_text, str):
                        m = re.search(r"data:image/[^;]+;base64,([A-Za-z0-9+/=]+)", content_text)
                        if m:
                            url = f"data:image/png;base64,{m.group(1)}"

                if not url or not url.startswith("data:image/"):
                    print(f"[ImageGen] img={index+1} model={model}: no image in response")
                    continue

                # Decode and save
                b64 = url.split(",", 1)[1]
                img_bytes = base64.b64decode(b64)

                raw_path = output_path.rsplit(".", 1)[0] + "_raw.png"
                with open(raw_path, "wb") as f:
                    f.write(img_bytes)

                img = Image.open(raw_path).convert("RGB")
                # Center-crop to 9:16 portrait then resize to final video dimensions
                w, h = img.size
                target_ratio = VIDEO_WIDTH / VIDEO_HEIGHT  # 0.5625
                current_ratio = w / h
                if current_ratio > target_ratio:
                    new_w = int(h * target_ratio)
                    left = (w - new_w) // 2
                    img = img.crop((left, 0, left + new_w, h))
                else:
                    new_h = int(w / target_ratio)
                    top = (h - new_h) // 2
                    img = img.crop((0, top, w, top + new_h))
                img = img.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.LANCZOS)
                img.save(output_path, "JPEG", quality=92)
                os.remove(raw_path)

                size_kb = os.path.getsize(output_path) // 1024
                print(f"[ImageGen] img={index+1} saved in {elapsed}s via {model}: {size_kb}KB")
                return output_path

            except Exception as e:
                print(f"[ImageGen] img={index+1} model={model} attempt={attempt+1} error: {e}")

        if attempt < retries:
            time.sleep(4)

    return _create_fallback(output_path, index)


def _create_fallback(output_path: str, index: int) -> str:
    """Gradient fallback if all generation attempts fail."""
    from PIL import ImageDraw
    palettes = [
        ((10, 30, 60),  (40, 80,  120)),
        ((20, 50, 30),  (60, 120,  80)),
        ((40, 20, 50),  (100, 50, 120)),
        ((50, 20, 20),  (120, 50,  40)),
        ((20, 40, 50),  (50,  100, 120)),
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
    """Generate AI images for all segments sequentially via Gemini."""
    os.makedirs(output_dir, exist_ok=True)
    paths = []
    total = len(segments)
    for i, seg in enumerate(segments):
        prompt = seg.get("image_prompt", "Beautiful cinematic scene, warm colors, vertical portrait")
        path = os.path.join(output_dir, f"scene_{i}.jpg")
        print(f"[ImageGen] Generating {i+1}/{total}...")
        _generate_one(prompt, path, i)
        paths.append(path)
        if i < total - 1:
            time.sleep(2)  # rate limit buffer
    print(f"[ImageGen] All {total} images generated.")
    return paths

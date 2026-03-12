"""Generate images using Stable Horde (free, community-powered SDXL)."""

import os
import time
import httpx
from PIL import Image

HORDE_URL = "https://stablehorde.net/api/v2"
ANON_KEY = "0000000000"  # anonymous access (free)

# Generation size (9:16 portrait) — smaller for faster generation
IMG_WIDTH = 576
IMG_HEIGHT = 1024
# Final video size
VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920


def _submit_job(prompt: str, index: int) -> str:
    """Submit an image generation job. Returns job ID."""
    payload = {
        "prompt": prompt,
        "params": {
            "width": IMG_WIDTH,
            "height": IMG_HEIGHT,
            "steps": 25,
            "cfg_scale": 7.5,
            "sampler_name": "k_euler",
        },
        "nsfw": False,
        "models": ["AlbedoBase XL (SDXL)"],
    }
    headers = {"apikey": ANON_KEY}
    r = httpx.post(f"{HORDE_URL}/generate/async", json=payload, headers=headers, timeout=15)
    r.raise_for_status()
    job_id = r.json()["id"]
    print(f"[ImageGen] Job {index+1} submitted: {job_id}")
    return job_id


def _poll_and_download(job_id: str, output_path: str, index: int, max_wait: int = 300) -> str:
    """Poll for job completion and download the image."""
    start = time.time()
    while time.time() - start < max_wait:
        r = httpx.get(f"{HORDE_URL}/generate/check/{job_id}", timeout=10)
        status = r.json()
        if status.get("done", False):
            break
        wait = status.get("wait_time", 0)
        queue = status.get("queue_position", 0)
        elapsed = int(time.time() - start)
        print(f"[ImageGen] Image {index+1}: queue={queue}, ~{wait}s remaining (elapsed: {elapsed}s)")
        time.sleep(5)
    else:
        print(f"[ImageGen] Image {index+1}: Timed out after {max_wait}s")
        return _create_fallback(output_path, index)

    # Fetch result
    r = httpx.get(f"{HORDE_URL}/generate/status/{job_id}", timeout=15)
    gens = r.json().get("generations", [])
    if not gens:
        print(f"[ImageGen] Image {index+1}: No generations returned")
        return _create_fallback(output_path, index)

    img_url = gens[0].get("img", "")
    img_r = httpx.get(img_url, timeout=30, follow_redirects=True)

    # Save and convert to JPEG at video resolution
    raw_path = output_path.rsplit(".", 1)[0] + "_raw.webp"
    with open(raw_path, "wb") as f:
        f.write(img_r.content)

    img = Image.open(raw_path).convert("RGB")
    img = img.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.LANCZOS)
    img.save(output_path, "JPEG", quality=92)
    os.remove(raw_path)

    print(f"[ImageGen] Image {index+1} saved: {output_path} ({os.path.getsize(output_path)//1024}KB)")
    return output_path


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
    Generate AI images for all segments.
    Submits all jobs in parallel, then polls/downloads sequentially.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Submit all jobs at once
    jobs = []
    for i, seg in enumerate(segments):
        prompt = seg.get("image_prompt", "Beautiful landscape, cinematic, warm colors")
        try:
            job_id = _submit_job(prompt, i)
            jobs.append((job_id, i))
        except Exception as e:
            print(f"[ImageGen] Submit failed for image {i+1}: {e}")
            jobs.append((None, i))
        time.sleep(1)

    print(f"[ImageGen] {len([j for j, _ in jobs if j])} jobs submitted, waiting for results...")

    # Poll and download each
    paths = []
    for job_id, i in jobs:
        path = os.path.join(output_dir, f"scene_{i}.jpg")
        if job_id:
            _poll_and_download(job_id, path, i)
        else:
            _create_fallback(path, i)
        paths.append(path)

    return paths

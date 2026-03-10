"""FFmpeg video renderer — crops and scales each clip to 9:16."""
import subprocess
from pathlib import Path
from typing import Optional


def render_clip(
    source_path: str,
    output_path: str,
    start_time: float,
    duration: float,
    crop_params: dict,
) -> bool:
    """
    Render a single reel clip: seek → crop to 9:16 → scale → H.264/AAC.
    Returns True on success.
    """
    try:
        vf = (
            f"crop={crop_params['crop_w']}:{crop_params['crop_h']}"
            f":{crop_params['crop_x']}:{crop_params['crop_y']},"
            f"scale={crop_params['out_w']}:{crop_params['out_h']}"
        )

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-i", source_path,
            "-t", str(duration),
            "-vf", vf,
            "-c:v", "libx264",
            "-crf", "23",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print(f"[processor] FFmpeg error:\n{result.stderr[-2000:]}")
            return False
        return True

    except subprocess.TimeoutExpired:
        print("[processor] FFmpeg timed out")
        return False
    except Exception as e:
        print(f"[processor] render_clip error: {e}")
        return False


def check_ffmpeg() -> bool:
    """Return True if ffmpeg is available on PATH."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

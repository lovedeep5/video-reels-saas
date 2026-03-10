"""
FFmpeg video renderer — crops and scales each clip to the target ratio.

Supports two layouts determined by tracker.get_crop_params():
  single  — one speaker, smooth horizontal tracking via per-second crop expression
  dual    — two speakers, split-screen stacked vertically (top / bottom halves)
"""
import subprocess
from pathlib import Path


def render_clip(
    source_path: str,
    output_path: str,
    start_time: float,
    duration: float,
    crop_params: dict,
) -> bool:
    """
    Render a single reel clip.
    crop_params comes from tracker.get_crop_params() — see that module for schema.
    Returns True on success.
    """
    layout = crop_params.get("layout", "single")

    try:
        if layout == "dual":
            return _render_dual(source_path, output_path, start_time, duration, crop_params)
        else:
            return _render_single(source_path, output_path, start_time, duration, crop_params)
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


# ── Single speaker ────────────────────────────────────────────────────────────

def _render_single(source_path, output_path, start_time, duration, crop_params):
    """
    Single-speaker render.
    If crop_x_expr is set, use per-second smooth tracking (eval=frame).
    Otherwise use a static crop position.
    """
    out_w = crop_params["out_w"]
    out_h = crop_params["out_h"]
    cw    = crop_params["crop_w"]
    ch    = crop_params["crop_h"]
    cy    = crop_params["crop_y"]
    expr  = crop_params.get("crop_x_expr")

    if expr:
        # Dynamic tracking: crop x changes each second following the speaker
        crop_filter = f"crop={cw}:{ch}:{expr}:{cy}:eval=frame"
    else:
        # Static crop (portrait source or no tracking needed)
        cx = crop_params["crop_x"]
        crop_filter = f"crop={cw}:{ch}:{cx}:{cy}"

    vf = f"{crop_filter},scale={out_w}:{out_h}"

    return _run_ffmpeg(source_path, output_path, start_time, duration, vf)


# ── Dual speaker (split-screen) ───────────────────────────────────────────────

def _render_dual(source_path, output_path, start_time, duration, crop_params):
    """
    Dual-speaker split-screen render.

    Layout:
      ┌─────────────┐
      │  Speaker A  │  top half    (left speaker in original frame)
      ├─────────────┤
      │  Speaker B  │  bottom half (right speaker in original frame)
      └─────────────┘

    Each half: crop_w × crop_h from source → scaled to out_w × (out_h // 2).
    Final output: out_w × out_h via vstack.
    """
    out_w    = crop_params["out_w"]
    out_h    = crop_params["out_h"]
    cw       = crop_params["crop_w"]
    ch       = crop_params["crop_h"]
    cy       = crop_params["crop_y"]
    crop_x_a = crop_params["crop_x_a"]
    crop_x_b = crop_params["crop_x_b"]
    half_h   = out_h // 2

    # Each half is scaled to out_w × half_h
    filter_complex = (
        f"[0:v]crop={cw}:{ch}:{crop_x_a}:{cy},scale={out_w}:{half_h}[top];"
        f"[0:v]crop={cw}:{ch}:{crop_x_b}:{cy},scale={out_w}:{half_h}[bot];"
        f"[top][bot]vstack=inputs=2[v]"
    )

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", source_path,
        "-t", str(duration),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "0:a",
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]

    print(f"[processor] dual split-screen render — speaker A x={crop_x_a}, B x={crop_x_b}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        print(f"[processor] FFmpeg dual error:\n{result.stderr[-2000:]}")
        return False
    return True


# ── Shared ffmpeg runner ──────────────────────────────────────────────────────

def _run_ffmpeg(source_path, output_path, start_time, duration, vf):
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

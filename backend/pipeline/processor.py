"""
FFmpeg video renderer — crops and scales each clip to the target ratio.

Dispatch logic based on crop_params["scenario"]:
  no_face                            -> _render_letterbox        (fit whole video, black bars)
  single_speaker + tracking_segments -> _render_concat_tracking  (concat filter, no eval=frame)
  dual_speaker   + dual_faces        -> _render_dual_speaker     (both speakers stacked top/bottom)
  anything else                      -> _render_static           (group bounding box crop)
"""
import subprocess
from pathlib import Path


def render_clip(
    source_path: str,
    output_path: str,
    start_time: float,
    duration: float,
    crop_params: dict,
    subtitle_path: str | None = None,
) -> bool:
    """
    Render a single reel clip. Dispatches to the right strategy based on scenario.
    subtitle_path: optional path to an ASS file to burn into the output.
    Returns True on success.
    """
    try:
        scenario = crop_params.get("scenario", "no_face")
        segments = crop_params.get("tracking_segments")
        dual     = crop_params.get("dual_faces")

        if scenario == "no_face":
            return _render_letterbox(source_path, output_path, start_time, duration, crop_params, subtitle_path)
        elif scenario == "single_speaker" and segments:
            return _render_concat_tracking(source_path, output_path, start_time, duration, crop_params, subtitle_path)
        elif scenario == "dual_speaker" and dual:
            return _render_dual_speaker(source_path, output_path, start_time, duration, crop_params, subtitle_path)
        else:
            return _render_static(source_path, output_path, start_time, duration, crop_params, subtitle_path)

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


# ── Render strategies ─────────────────────────────────────────────────────────

def _render_letterbox(source_path, output_path, start_time, duration, crop_params, subtitle_path=None) -> bool:
    """
    No-face fallback: fit the entire video frame into the target aspect ratio,
    preserving original aspect ratio with black bars (letterbox/pillarbox).
    No cropping -- the full frame is always visible.
    """
    ow = crop_params["out_w"]
    oh = crop_params["out_h"]

    vf = (
        f"scale={ow}:{oh}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={ow}:{oh}:(ow-iw)/2:(oh-ih)/2:color=black"
    )
    if subtitle_path:
        vf += f",subtitles='{subtitle_path}'"

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", source_path,
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-crf", "20", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    return _run_ffmpeg(cmd)


def _render_static(source_path, output_path, start_time, duration, crop_params, subtitle_path=None) -> bool:
    """
    Bounding-box crop render. Used for group scenario and fallback.
    """
    cw = crop_params["crop_w"]
    ch = crop_params["crop_h"]
    cx = crop_params["crop_x"]
    cy = crop_params["crop_y"]
    ow = crop_params["out_w"]
    oh = crop_params["out_h"]

    vf = f"crop={cw}:{ch}:{cx}:{cy},scale={ow}:{oh}:flags=lanczos"
    if subtitle_path:
        vf += f",subtitles='{subtitle_path}'"

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", source_path,
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-crf", "20", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    return _run_ffmpeg(cmd)


def _render_concat_tracking(source_path, output_path, start_time, duration, crop_params, subtitle_path=None) -> bool:
    """
    Single-speaker smooth tracking via ffmpeg filter_complex concat.
    Each tracking segment gets its own static crop position. No eval=frame needed.
    Uses trim (not -ss) so timestamps are frame-accurate.
    """
    segments = crop_params["tracking_segments"]
    cw = crop_params["crop_w"]
    ch = crop_params["crop_h"]
    ow = crop_params["out_w"]
    oh = crop_params["out_h"]
    n  = len(segments)

    filter_parts = []
    for i, seg in enumerate(segments):
        abs_start = start_time + seg["start_sec"]
        abs_end   = start_time + seg["end_sec"]
        cx = seg["crop_x"]
        cy = seg["crop_y"]

        filter_parts.append(
            f"[0:v]trim=start={abs_start}:end={abs_end},"
            f"setpts=PTS-STARTPTS,"
            f"crop={cw}:{ch}:{cx}:{cy},"
            f"scale={ow}:{oh}:flags=lanczos[v{i}]"
        )
        filter_parts.append(
            f"[0:a]atrim=start={abs_start}:end={abs_end},"
            f"asetpts=PTS-STARTPTS[a{i}]"
        )

    v_labels = "".join(f"[v{i}][a{i}]" for i in range(n))

    if subtitle_path:
        filter_parts.append(f"{v_labels}concat=n={n}:v=1:a=1[outv_pre][outa]")
        filter_parts.append(f"[outv_pre]subtitles='{subtitle_path}'[outv]")
    else:
        filter_parts.append(f"{v_labels}concat=n={n}:v=1:a=1[outv][outa]")

    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-filter_complex", ";".join(filter_parts),
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264", "-crf", "20", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    return _run_ffmpeg(cmd)


def _render_dual_speaker(source_path, output_path, start_time, duration, crop_params, subtitle_path=None) -> bool:
    """
    Podcast dual-speaker: both speakers shown in the same 9:16 frame,
    stacked vertically -- left speaker on top, right speaker on bottom.
    Each gets half the output height (out_h // 2).
    """
    dual   = crop_params["dual_faces"]
    ow     = crop_params["out_w"]
    oh     = crop_params["out_h"]
    half_h = oh // 2

    l = dual["left"]
    r = dual["right"]
    abs_end = start_time + duration

    vstack_out = "[outv_pre]" if subtitle_path else "[outv]"

    filter_complex = (
        # Top half -- left speaker
        f"[0:v]trim=start={start_time}:end={abs_end},setpts=PTS-STARTPTS,"
        f"crop={l['crop_w']}:{l['crop_h']}:{l['crop_x']}:{l['crop_y']},"
        f"scale={ow}:{half_h}:flags=lanczos[top];"

        # Bottom half -- right speaker
        f"[0:v]trim=start={start_time}:end={abs_end},setpts=PTS-STARTPTS,"
        f"crop={r['crop_w']}:{r['crop_h']}:{r['crop_x']}:{r['crop_y']},"
        f"scale={ow}:{half_h}:flags=lanczos[bot];"

        # Stack both halves
        f"[top][bot]vstack=inputs=2{vstack_out};"

        # Audio passthrough
        f"[0:a]atrim=start={start_time}:end={abs_end},asetpts=PTS-STARTPTS[outa]"
    )

    if subtitle_path:
        filter_complex += f";[outv_pre]subtitles='{subtitle_path}'[outv]"

    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264", "-crf", "20", "-preset", "fast",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]
    return _run_ffmpeg(cmd)


def _run_ffmpeg(cmd: list) -> bool:
    """Run an ffmpeg command, print stderr on failure. Returns True on success."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print(f"[processor] FFmpeg error:\n{result.stderr[-3000:]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("[processor] FFmpeg timed out")
        return False
    except Exception as e:
        print(f"[processor] FFmpeg exception: {e}")
        return False

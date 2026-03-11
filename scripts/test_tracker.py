"""
Local test script for the face tracker + renderer.

Usage:
    python scripts/test_tracker.py <video_path> <start_time> <end_time> [ratio]

    ratio defaults to 9:16, supports: 9:16, 1:1, 4:5, 16:9

Example:
    python scripts/test_tracker.py C:/videos/podcast.mp4 30 90 9:16

Output:
    scripts/output/test_clip.mp4
"""
import sys
import json
import subprocess
from pathlib import Path

# Add repo root to path so backend modules are importable (same as run_job.py)
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.pipeline.tracker import get_crop_params
from backend.pipeline.processor import render_clip

RATIO_MAP = {
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
    "4:5":  (1080, 1350),
    "16:9": (1920, 1080),
}


def probe_video(path: str) -> dict:
    """Return {width, height, duration} via ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr[:500]}")

    data = json.loads(result.stdout)
    width = height = duration = 0
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = int(stream.get("width", 0))
            height = int(stream.get("height", 0))
            dur = stream.get("duration") or data.get("format", {}).get("duration", 0)
            duration = float(dur)
            break
    return {"width": width, "height": height, "duration": duration}


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    video_path = sys.argv[1]
    start_time = float(sys.argv[2])
    end_time   = float(sys.argv[3])
    ratio      = sys.argv[4] if len(sys.argv) > 4 else "9:16"

    if not Path(video_path).exists():
        print(f"[error] File not found: {video_path}")
        sys.exit(1)

    if ratio not in RATIO_MAP:
        print(f"[error] Unknown ratio '{ratio}'. Choose from: {', '.join(RATIO_MAP)}")
        sys.exit(1)

    out_w, out_h = RATIO_MAP[ratio]

    print(f"\n{'='*60}")
    print(f"  Video:      {video_path}")
    print(f"  Clip:       {start_time}s -> {end_time}s  ({end_time - start_time:.1f}s)")
    print(f"  Output:     {ratio}  ({out_w}x{out_h})")
    print(f"{'='*60}\n")

    # Probe dimensions
    print("[probe] Reading video info...")
    info = probe_video(video_path)
    src_w, src_h = info["width"], info["height"]
    print(f"[probe] Source: {src_w}x{src_h}, duration={info['duration']:.1f}s")

    if src_w == 0 or src_h == 0:
        print("[probe] WARNING: Could not read dimensions, defaulting to 1920x1080")
        src_w, src_h = 1920, 1080

    if end_time > info["duration"] > 0:
        print(f"[probe] WARNING: end_time {end_time}s exceeds video duration {info['duration']:.1f}s")
        end_time = info["duration"]

    # Show raw face data for diagnostics
    print("\n[diag] Sampling faces...")
    from backend.pipeline.tracker import _sample_frames_all_faces
    per_frame = _sample_frames_all_faces(video_path, start_time, end_time)
    face_counts = [len(f) for f in per_frame]
    print(f"[diag] Face count per second: {face_counts}")
    if per_frame:
        for i, faces in enumerate(per_frame[:10]):  # first 10 seconds
            if faces:
                positions = [(f[0], f[2]) for f in faces]  # (cx, width)
                print(f"[diag]   t={i}s: {len(faces)} face(s) at cx={[p[0] for p in positions]} w={[p[1] for p in positions]}")

    # Run tracker
    print("\n[tracker] Detecting faces and classifying scenario...")
    crop_params = get_crop_params(video_path, start_time, end_time, src_w, src_h, out_w, out_h)

    scenario = crop_params.get("scenario", "unknown")
    print(f"\n[tracker] Scenario: {scenario.upper()}")
    print(f"[tracker] Crop:     {crop_params['crop_w']}x{crop_params['crop_h']} @ ({crop_params['crop_x']}, {crop_params['crop_y']})")

    segments = crop_params.get("tracking_segments")
    if segments:
        print(f"[tracker] Tracking segments: {len(segments)}")
        for i, seg in enumerate(segments):
            print(f"           [{i}] {seg['start_sec']:.1f}s-{seg['end_sec']:.1f}s crop_x={seg['crop_x']}")

    dual = crop_params.get("dual_faces")
    if dual:
        print(f"[tracker] Left face:  crop_x={dual['left']['crop_x']}")
        print(f"[tracker] Right face: crop_x={dual['right']['crop_x']}")

    # Render
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / "test_clip.mp4")

    print(f"\n[render] Rendering to {output_path} ...")
    success = render_clip(
        source_path=video_path,
        output_path=output_path,
        start_time=start_time,
        duration=end_time - start_time,
        crop_params=crop_params,
    )

    if success and Path(output_path).exists():
        size_mb = Path(output_path).stat().st_size / 1024 / 1024
        print(f"[render] SUCCESS — {output_path} ({size_mb:.1f} MB)")
        print(f"\nOpen the file to review:")
        print(f"  {Path(output_path).resolve()}\n")
    else:
        print("[render] FAILED — check ffmpeg errors above")
        sys.exit(1)


if __name__ == "__main__":
    main()

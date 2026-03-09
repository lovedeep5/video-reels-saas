"""Download YouTube/online videos using yt-dlp."""
import os
from pathlib import Path


def download_video(url: str, output_dir: Path, job_id: int) -> dict:
    """
    Download video from URL. Returns dict with:
      path: str — local file path
      title: str — video title
      duration: float — duration in seconds
    Raises RuntimeError on failure.
    """
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp not installed. Run: pip install yt-dlp")

    out_template = str(output_dir / f"source_{job_id}.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]",
        "outtmpl": out_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "overwrites": True,  # always re-download; prevents stale file reuse when job IDs are recycled
    }

    print(f"[downloader] job_id={job_id} downloading: {url}")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    # Find downloaded file
    for ext in ("mp4", "mkv", "webm", "avi"):
        candidate = output_dir / f"source_{job_id}.{ext}"
        if candidate.exists():
            return {
                "path": str(candidate),
                "title": info.get("title", "Untitled"),
                "duration": float(info.get("duration") or 0),
            }

    raise RuntimeError("Downloaded file not found after yt-dlp completed")


def get_video_info(path: str) -> dict:
    """Get video duration and dimensions using ffprobe."""
    import subprocess, json

    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    data = json.loads(result.stdout)
    duration = float(data.get("format", {}).get("duration", 0))

    width = height = 0
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = stream.get("width", 0)
            height = stream.get("height", 0)
            break

    return {"duration": duration, "width": width, "height": height}

"""Download YouTube/online videos using yt-dlp."""
import os
from pathlib import Path


# Error messages that indicate YouTube is blocking the download
BOT_DETECTION_PHRASES = [
    "sign in to confirm",
    "sign in to confirm you're not a bot",
    "this video is private",
    "age-restricted",
    "http error 403",
    "members-only",
    "video unavailable",
    "cookies",
    "login required",
    "this video requires payment",
]


class BotDetectionError(RuntimeError):
    """Raised when yt-dlp fails due to YouTube bot/auth blocking."""
    pass


def _is_bot_detection(error_msg: str) -> bool:
    lower = error_msg.lower()
    return any(phrase in lower for phrase in BOT_DETECTION_PHRASES)


def _ydl_opts(out_template: str, cookie_file: str | None) -> dict:
    opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best",
        "outtmpl": out_template,
        "merge_output_format": "mp4",
        "quiet": False,
        "no_warnings": False,
        "noplaylist": True,
        "overwrites": True,
        "extractor_args": {"youtube": {"player_client": ["web", "ios"]}},
        "js_runtimes": {"node": {}},
    }
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def _find_downloaded_file(output_dir: Path, job_id: str) -> str | None:
    for ext in ("mp4", "mkv", "webm", "avi"):
        candidate = output_dir / f"source_{job_id}.{ext}"
        if candidate.exists():
            return str(candidate)
    return None


def download_video(
    url: str,
    output_dir: Path,
    job_id: str,
    cookie_file: str | None = None,
) -> dict:
    """
    Download video from URL. Returns dict with:
      path: str — local file path
      title: str — video title
      duration: float — duration in seconds

    Raises BotDetectionError if YouTube blocks the download (auth required).
    Raises RuntimeError on other failures.

    cookie_file: path to a Netscape cookies file. If provided and valid, used
      directly. If None, downloads without cookies (works for most public videos).
    """
    try:
        import yt_dlp
    except ImportError:
        raise RuntimeError("yt-dlp not installed. Run: pip install yt-dlp")

    out_template = str(output_dir / f"source_{job_id}.%(ext)s")

    # Validate cookie file
    resolved_cookie = None
    if cookie_file and os.path.exists(cookie_file) and os.path.getsize(cookie_file) > 100:
        resolved_cookie = cookie_file

    print(f"[downloader] job_id={job_id} cookies={'yes' if resolved_cookie else 'none'} url={url}")

    try:
        with yt_dlp.YoutubeDL(_ydl_opts(out_template, resolved_cookie)) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as e:
        msg = str(e)
        if _is_bot_detection(msg):
            raise BotDetectionError(msg)
        raise RuntimeError(msg)

    path = _find_downloaded_file(output_dir, job_id)
    if not path:
        raise RuntimeError("Downloaded file not found after yt-dlp completed")

    return {
        "path": path,
        "title": info.get("title", "Untitled"),
        "duration": float(info.get("duration") or 0),
    }


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

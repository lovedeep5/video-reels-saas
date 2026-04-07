"""Download YouTube/online videos using yt-dlp.

Strategy:
  1. Try without cookies using multiple player clients (works for most public videos)
  2. If auth error and cookies are available, retry with cookies
  3. If no cookies and auth error, raise BotDetectionError with helpful message
"""
import os
from pathlib import Path


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

# Ordered from least to most aggressive — try each until one works
PLAYER_CLIENT_STRATEGIES = [
    ["web"],
    ["ios"],
    ["android"],
    ["web", "ios"],
    ["tv_embedded"],
]


class BotDetectionError(RuntimeError):
    """Raised when yt-dlp fails due to YouTube bot/auth blocking."""
    pass


def _is_bot_detection(error_msg: str) -> bool:
    lower = error_msg.lower()
    return any(phrase in lower for phrase in BOT_DETECTION_PHRASES)


def _ydl_opts(out_template: str, player_clients: list, cookie_file: str | None = None) -> dict:
    opts = {
        "format": "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/bestvideo+bestaudio/best",
        "outtmpl": out_template,
        "merge_output_format": "mp4",
        "quiet": False,
        "no_warnings": False,
        "noplaylist": True,
        "overwrites": True,
        "extractor_args": {"youtube": {"player_client": player_clients}},
        "js_runtimes": {"node": {}},
        "socket_timeout": 30,
    }
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def _find_downloaded_file(output_dir: Path, job_id: str) -> str | None:
    for ext in ("mp4", "mkv", "webm", "avi", "mov"):
        candidate = output_dir / f"source_{job_id}.{ext}"
        if candidate.exists():
            return str(candidate)
    return None


def _try_download(url: str, out_template: str, output_dir: Path, job_id: str, cookie_file: str | None) -> dict:
    """Attempt download with multiple player clients. Raises BotDetectionError or RuntimeError."""
    import yt_dlp

    last_error = ""
    for clients in PLAYER_CLIENT_STRATEGIES:
        try:
            print(f"[downloader] trying clients={clients} cookies={'yes' if cookie_file else 'no'}")
            with yt_dlp.YoutubeDL(_ydl_opts(out_template, clients, cookie_file)) as ydl:
                info = ydl.extract_info(url, download=True)

            path = _find_downloaded_file(output_dir, job_id)
            if not path:
                raise RuntimeError("Downloaded file not found after yt-dlp completed")

            return {
                "path": path,
                "title": info.get("title", "Untitled"),
                "duration": float(info.get("duration") or 0),
            }
        except Exception as e:
            last_error = str(e)
            if _is_bot_detection(last_error):
                # No point trying more clients if auth is the issue
                raise BotDetectionError(last_error)
            print(f"[downloader] clients={clients} failed: {last_error[:100]}")

    raise RuntimeError(f"All player clients failed. Last error: {last_error[:300]}")


def download_video(
    url: str,
    output_dir: Path,
    job_id: str,
    cookie_file: str | None = None,
) -> dict:
    """
    Download video from URL.

    Strategy:
      1. Try without cookies first (multiple player clients)
      2. If auth error and cookies available → retry with cookies
      3. If auth error and no cookies → raise BotDetectionError with clear message

    Returns dict: {path, title, duration}
    Raises BotDetectionError | RuntimeError.
    """
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        raise RuntimeError("yt-dlp not installed. Run: pip install yt-dlp")

    out_template = str(output_dir / f"source_{job_id}.%(ext)s")

    # Validate cookie file
    valid_cookie = None
    if cookie_file and os.path.exists(cookie_file) and os.path.getsize(cookie_file) > 100:
        valid_cookie = cookie_file

    print(f"[downloader] job={job_id} url={url[:80]} cookies_available={'yes' if valid_cookie else 'no'}")

    # Attempt 1: without cookies (works for most public videos)
    try:
        return _try_download(url, out_template, output_dir, job_id, cookie_file=None)
    except BotDetectionError as e:
        if not valid_cookie:
            raise BotDetectionError(
                "This video requires YouTube authentication. "
                "Please upload your YouTube cookies in Settings → Advanced."
            ) from e
        print(f"[downloader] Cookie-free failed, retrying with cookies: {str(e)[:80]}")

    # Attempt 2: with cookies (for age-restricted / members-only / private videos)
    try:
        return _try_download(url, out_template, output_dir, job_id, cookie_file=valid_cookie)
    except BotDetectionError as e:
        raise BotDetectionError(
            "YouTube is blocking this download even with cookies. "
            "Try refreshing your cookies or check if the video is accessible."
        ) from e


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

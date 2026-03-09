import os
import subprocess
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).parent.parent

# ── FFmpeg auto-detection ─────────────────────────────────────────────────────
_WINGET_FFMPEG = Path.home() / "AppData/Local/Microsoft/WinGet/Packages"
_FFMPEG_SEARCH_DIRS = [
    _WINGET_FFMPEG,
    Path("C:/ffmpeg/bin"),
    Path("C:/Program Files/ffmpeg/bin"),
]

def _find_and_register_ffmpeg():
    """Add FFmpeg bin dir to PATH if not already on PATH."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return  # already on PATH
    except FileNotFoundError:
        pass

    for search_root in _FFMPEG_SEARCH_DIRS:
        if not search_root.exists():
            continue
        for ffmpeg_exe in search_root.rglob("ffmpeg.exe"):
            bin_dir = str(ffmpeg_exe.parent)
            os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
            return

_find_and_register_ffmpeg()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    WHISPER_MODEL: str = "base"

    # ── Clerk auth ────────────────────────────────────────────────────────────
    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = ""   # e.g. https://<your-clerk-domain>/.well-known/jwks.json
    # Comma-separated list of allowed frontend origins for the `azp` JWT claim.
    # Example: "http://localhost:3000,https://yourdomain.com"
    CLERK_AUTHORIZED_PARTIES: str = "http://localhost:3000"

    # ── AI clip selection ─────────────────────────────────────────────────────
    OPENROUTER_API_KEY: str = ""  # set in .env — enables LLM-based clip selection

    # AWS S3 storage
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: str = ""

    # Payment provider abstraction — swap "razorpay" for any provider later
    PAYMENT_PROVIDER: str = "razorpay"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite:///{BASE_DIR}/storage/app.db"

    @property
    def UPLOAD_DIR(self) -> Path:
        return BASE_DIR / "storage" / "uploads"

    @property
    def OUTPUT_DIR(self) -> Path:
        return BASE_DIR / "storage" / "output"

    @property
    def TEMP_DIR(self) -> Path:
        return BASE_DIR / "storage" / "temp"


settings = Settings()

# Ensure storage directories exist
for _d in [settings.UPLOAD_DIR, settings.OUTPUT_DIR, settings.TEMP_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# ── Output ratio presets ──────────────────────────────────────────────────────
# Each entry: ratio_key → (out_w, out_h)
# out_w/out_h must be even numbers (H.264 requirement)
RATIO_PRESETS: dict[str, tuple[int, int]] = {
    "9:16": (1080, 1920),   # Instagram Reels, YouTube Shorts, TikTok, Facebook Reels
    "1:1":  (1080, 1080),   # Instagram Square, Facebook Feed
    "4:5":  (1080, 1350),   # Instagram Portrait Feed
    "16:9": (1920, 1080),   # YouTube, Twitter/X Landscape
    "4:3":  (1440, 1080),   # Facebook Classic, general landscape
}
DEFAULT_RATIO = "9:16"


def parse_ratio(ratio: str) -> tuple[int, int]:
    """
    Return (out_w, out_h) for a ratio string.
    Accepts presets like '9:16' or custom like '3:4'.
    Output is capped at 1920px on the longer side, rounded to even.
    """
    if ratio in RATIO_PRESETS:
        return RATIO_PRESETS[ratio]
    try:
        w_str, h_str = ratio.split(":")
        w, h = int(w_str), int(h_str)
        if w <= 0 or h <= 0:
            raise ValueError
        max_dim = 1920
        if w >= h:
            out_w = max_dim
            out_h = round(max_dim * h / w)
        else:
            out_h = max_dim
            out_w = round(max_dim * w / h)
        # H.264 requires even dimensions
        out_w = out_w + (out_w % 2)
        out_h = out_h + (out_h % 2)
        return out_w, out_h
    except Exception:
        return RATIO_PRESETS[DEFAULT_RATIO]


# ── Subscription plan definitions ─────────────────────────────────────────────
PLANS: dict = {
    "free": {
        "name": "Free",
        "price": 0,
        "currency": "INR",
        "clips_per_video": 3,
        "videos_per_month": 2,
        "max_duration_seconds": 0,  # 0 = no limit
        "razorpay_plan_id": None,
        "features": ["3 clips per video", "2 videos/month", "No duration limit"],
    },
    "pro": {
        "name": "Pro",
        "price": 1499,
        "currency": "INR",
        "clips_per_video": 10,
        "videos_per_month": 20,
        "max_duration_seconds": 3600,
        "razorpay_plan_id": None,
        "features": ["10 clips per video", "20 videos/month", "Max 60 min video"],
    },
    "business": {
        "name": "Business",
        "price": 3999,
        "currency": "INR",
        "clips_per_video": 20,
        "videos_per_month": -1,
        "max_duration_seconds": 10800,
        "razorpay_plan_id": None,
        "features": ["20 clips per video", "Unlimited videos", "Max 3 hr video", "Priority queue"],
    },
}

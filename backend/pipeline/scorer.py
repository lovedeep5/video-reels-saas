"""
Importance scorer — selects the best N non-overlapping clips from a video.

Scoring criteria (no external API needed):
  - Speech density: words per second (from Whisper transcript)
  - Audio energy: RMS amplitude per second (from ffmpeg-extracted audio)
  - Combined weighted score → sliding window → NMS selection
"""
import subprocess
import numpy as np
from pathlib import Path
from typing import Optional


def compute_audio_energy(video_path: str, temp_dir: str) -> np.ndarray:
    """
    Extract mono audio and compute RMS energy per second.
    Returns numpy array of shape (duration_seconds,).
    Falls back to zeros if ffmpeg/scipy unavailable.
    """
    import uuid, os
    audio_path = str(Path(temp_dir) / f"energy_{uuid.uuid4().hex}.wav")
    try:
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ar", "16000", "-ac", "1", "-vn",
            audio_path,
        ]
        subprocess.run(cmd, capture_output=True, check=True)

        from scipy.io import wavfile
        sr, audio = wavfile.read(audio_path)
        audio = audio.astype(np.float32) / 32768.0

        energy = []
        for i in range(0, len(audio), sr):
            chunk = audio[i: i + sr]
            if len(chunk) > 0:
                energy.append(float(np.sqrt(np.mean(chunk ** 2))))
        return np.array(energy, dtype=np.float32)

    except Exception as e:
        print(f"[scorer] Audio energy failed: {e}")
        return np.zeros(1, dtype=np.float32)
    finally:
        try:
            Path(audio_path).unlink(missing_ok=True)
        except Exception:
            pass


def select_best_clips(
    duration: float,
    segments: list[dict],
    energy: np.ndarray,
    n_clips: int = 5,
    clip_duration: float = 35.0,
    min_clip: float = 28.0,
    max_clip: float = 42.0,
    stride: float = 3.0,
) -> list[dict]:
    """
    Slide a window over the video and pick the top N non-overlapping clips.

    Returns list of dicts:
      [{"start": float, "end": float, "score": float, "transcript": str}, ...]
    """
    if duration < min_clip:
        # Video shorter than minimum clip: return entire video as one clip
        text = " ".join(s["text"] for s in segments)
        return [{"start": 0.0, "end": duration, "score": 1.0, "transcript": text}]

    windows = []
    t = 0.0
    while t + min_clip <= duration:
        end = min(t + clip_duration, duration)
        actual_duration = end - t
        if actual_duration < min_clip:
            break

        # Speech density score
        words = sum(
            len(s["text"].split())
            for s in segments
            if s["start"] < end and s["end"] > t
        )
        speech_score = words / actual_duration

        # Audio energy score
        e_start = int(t)
        e_end = min(int(end), len(energy))
        energy_score = float(np.mean(energy[e_start:e_end])) if e_end > e_start else 0.0

        # Gather transcript for this window
        transcript = " ".join(
            s["text"].strip()
            for s in segments
            if s["start"] < end and s["end"] > t
        )

        windows.append({
            "start": t,
            "end": end,
            "speech_score": speech_score,
            "energy_score": energy_score,
            "transcript": transcript,
        })
        t += stride

    if not windows:
        text = " ".join(s["text"] for s in segments)
        return [{"start": 0.0, "end": min(clip_duration, duration), "score": 1.0, "transcript": text}]

    # Normalize and combine scores
    max_speech = max(w["speech_score"] for w in windows) or 1.0
    max_energy = max(w["energy_score"] for w in windows) or 1.0

    for w in windows:
        w["score"] = 0.65 * (w["speech_score"] / max_speech) + 0.35 * (w["energy_score"] / max_energy)

    windows.sort(key=lambda x: x["score"], reverse=True)

    # Non-maximum suppression — avoid overlapping clips
    selected = []
    for w in windows:
        overlap = False
        for s in selected:
            overlap_len = min(w["end"], s["end"]) - max(w["start"], s["start"])
            if overlap_len > clip_duration * 0.25:  # allow 25% overlap at most
                overlap = True
                break
        if not overlap:
            selected.append(w)
        if len(selected) >= n_clips:
            break

    # Sort chronologically
    selected.sort(key=lambda x: x["start"])
    return selected

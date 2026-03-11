"""
Audio transcription using faster-whisper (primary) or openai-whisper (fallback).
faster-whisper works on Python 3.14, uses ctranslate2 — no PyTorch required.
"""
import subprocess
import uuid
from pathlib import Path
from typing import Optional

_whisper_model = None
_backend: Optional[str] = None  # "faster" | "openai" | None


def _detect_backend() -> Optional[str]:
    global _backend
    if _backend is not None:
        return _backend
    try:
        from faster_whisper import WhisperModel  # noqa: F401
        _backend = "faster"
        return _backend
    except ImportError:
        pass
    try:
        import whisper  # noqa: F401
        _backend = "openai"
        return _backend
    except ImportError:
        pass
    _backend = ""
    return None


def _check_whisper() -> bool:
    return bool(_detect_backend())


def _load_model(model_name: str):
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    backend = _detect_backend()
    if backend == "faster":
        from faster_whisper import WhisperModel
        # int8 runs on CPU without GPU; tiny/base/small/medium/large
        _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
    elif backend == "openai":
        import whisper
        _whisper_model = whisper.load_model(model_name)
    return _whisper_model


def transcribe(video_path: str, model_name: str = "base", temp_dir: Optional[str] = None, task: str = "transcribe") -> list[dict]:
    """
    Transcribe audio from video. Returns list of segments:
      [{"start": float, "end": float, "text": str}, ...]
    task="transcribe" keeps the original language.
    task="translate"  forces English output (any source language -> English).
    Returns empty list if no Whisper backend is available.
    """
    if not _check_whisper():
        print("[transcriber] No Whisper backend available — subtitles skipped")
        return []

    audio_path = None
    try:
        # Extract audio to WAV (16kHz mono) — faster and more reliable
        if temp_dir:
            audio_path = str(Path(temp_dir) / f"audio_{uuid.uuid4().hex}.wav")
            _extract_audio(video_path, audio_path)
            source = audio_path
        else:
            source = video_path

        model = _load_model(model_name)
        backend = _detect_backend()

        if backend == "faster":
            raw_segments, _ = model.transcribe(source, beam_size=5, language=None, task=task)
            segments = [
                {"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
                for s in raw_segments
            ]
        else:
            result = model.transcribe(source, verbose=False, task=task)
            segments = [
                {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
                for s in result.get("segments", [])
            ]

        print(f"[transcriber] Transcribed {len(segments)} segments via {backend}-whisper")
        return segments

    except Exception as e:
        print(f"[transcriber] Warning: transcription failed: {e}")
        return []
    finally:
        if audio_path:
            try:
                Path(audio_path).unlink(missing_ok=True)
            except Exception:
                pass


def _extract_audio(video_path: str, output_path: str):
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-ar", "16000", "-ac", "1", "-vn",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Audio extraction failed: {result.stderr}")


def generate_ass(
    segments: list[dict],
    start_offset: float,
    end_offset: float,
    out_w: int = 1080,
    out_h: int = 1920,
) -> str:
    """
    Generate ASS subtitle content for a clip [start_offset, end_offset].
    Uses proper PlayResX/Y so text stays within the output frame and wraps correctly.
    Timestamps are re-zeroed relative to start_offset.
    """
    margin_h = max(40, int(out_w * 0.055))   # ~60px left/right on 1080w
    margin_v = max(60, int(out_h * 0.045))   # ~86px from bottom on 1920h
    font_size = max(38, int(out_w * 0.048))  # ~52px on 1080w — readable on phone

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {out_w}\n"
        f"PlayResY: {out_h}\n"
        "WrapStyle: 0\n"           # smart word-wrap at PlayResX boundary
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{font_size},"
        "&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"  # white text, black outline, semi-transparent bg
        f"1,0,0,0,100,100,0,0,1,3,1,2,"                 # Bold=1, Outline=3, Shadow=1, Align=bottom-center
        f"{margin_h},{margin_h},{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    events = []
    for seg in segments:
        s_start, s_end = seg["start"], seg["end"]
        if s_end <= start_offset or s_start >= end_offset:
            continue
        adj_start = max(s_start - start_offset, 0.0)
        adj_end = min(s_end - start_offset, end_offset - start_offset)
        text = seg["text"].strip()
        if not text:
            continue
        events.append(
            f"Dialogue: 0,{_ass_time(adj_start)},{_ass_time(adj_end)},"
            f"Default,,0,0,0,,{text}"
        )

    return header + "\n".join(events)


# Keep generate_srt as alias used in tests
def generate_srt(segments: list[dict], start_offset: float, end_offset: float) -> str:
    """Legacy SRT generator — kept for test compatibility."""
    lines = []
    idx = 1
    for seg in segments:
        s_start, s_end = seg["start"], seg["end"]
        if s_end <= start_offset or s_start >= end_offset:
            continue
        adj_start = max(s_start - start_offset, 0.0)
        adj_end = min(s_end - start_offset, end_offset - start_offset)
        text = seg["text"].strip()
        if not text:
            continue
        lines.append(str(idx))
        lines.append(f"{_srt_time(adj_start)} --> {_srt_time(adj_end)}")
        lines.append(text)
        lines.append("")
        idx += 1
    return "\n".join(lines)


def _ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)  # centiseconds
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

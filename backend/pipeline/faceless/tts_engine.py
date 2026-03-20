"""Text-to-speech using edge-tts (free Microsoft TTS) with multiple natural voices."""

import asyncio
import os
import edge_tts

# Voice definitions: name → (edge_tts_id, rate_adjustment, pitch_adjustment)
VOICES = {
    # ── English ──────────────────────────────────────────
    "jack":    ("en-US-GuyNeural", "-5%", "+0Hz"),
    "emma":    ("en-US-EmmaMultilingualNeural", "-3%", "+0Hz"),
    "andrew":  ("en-US-AndrewMultilingualNeural", "-3%", "+0Hz"),
    "aria":    ("en-US-AriaNeural", "-2%", "+0Hz"),
    "ryan":    ("en-GB-RyanNeural", "-4%", "+0Hz"),
    "sonia":   ("en-GB-SoniaNeural", "-3%", "+0Hz"),
    # ── English Horror (deep pitch + slow rate) ──────────
    "phantom": ("en-US-GuyNeural", "-25%", "-10Hz"),
    "whisper": ("en-US-AriaNeural", "-15%", "-5Hz"),
    "shadow":  ("en-GB-RyanNeural", "-30%", "-15Hz"),
    # ── Hindi ────────────────────────────────────────────
    "madhur":  ("hi-IN-MadhurNeural", "-3%", "+0Hz"),
    "swara":   ("hi-IN-SwaraNeural", "-3%", "+0Hz"),
    "bhoot":   ("hi-IN-MadhurNeural", "-25%", "-10Hz"),
    # ── Indian English ───────────────────────────────────
    "prabhat": ("en-IN-PrabhatNeural", "-3%", "+0Hz"),
    "neerja":  ("en-IN-NeerjaNeural", "-3%", "+0Hz"),
}

# Which voices produce Hindi output (script gen writes in Hindi for these)
HINDI_VOICES = {"madhur", "swara", "bhoot"}


async def _generate_audio(text: str, output_path: str, voice_id: str, rate: str, pitch: str = "+0Hz"):
    """Generate audio file from text with rate and pitch control."""
    communicate = edge_tts.Communicate(text, voice_id, rate=rate, pitch=pitch)
    await communicate.save(output_path)


def generate_segment_audios(segments: list, output_dir: str, voice_name: str = "andrew") -> list:
    """
    Generate audio for each script segment using the selected voice.
    Returns list of audio file paths.
    """
    os.makedirs(output_dir, exist_ok=True)

    voice_id, rate, pitch = VOICES.get(voice_name, VOICES["andrew"])
    print(f"[TTS] Using voice: {voice_name} ({voice_id}, rate={rate}, pitch={pitch})")

    paths = []
    for i, seg in enumerate(segments):
        path = os.path.join(output_dir, f"segment_{i}.mp3")
        asyncio.run(_generate_audio(seg["text"], path, voice_id, rate, pitch))
        size_kb = os.path.getsize(path) // 1024
        print(f"[TTS] Segment {i+1}: {size_kb}KB")
        paths.append(path)

    return paths

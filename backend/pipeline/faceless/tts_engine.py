"""Text-to-speech using edge-tts (free Microsoft TTS) with multiple natural voices."""

import asyncio
import os
import edge_tts

# Voice definitions: name → (edge_tts_id, rate_adjustment, pitch_adjustment)
VOICES = {
    # ── English (Natural) ──────────────────────────────────
    "jack":       ("en-US-GuyNeural", "-5%", "+0Hz"),        # Deep male narrator
    "emma":       ("en-US-EmmaMultilingualNeural", "-3%", "+0Hz"),  # Warm female
    "andrew":     ("en-US-AndrewMultilingualNeural", "-3%", "+0Hz"),  # Natural male
    "aria":       ("en-US-AriaNeural", "-2%", "+0Hz"),       # Expressive female
    "ryan":       ("en-GB-RyanNeural", "-4%", "+0Hz"),       # British male
    "sonia":      ("en-GB-SoniaNeural", "-3%", "+0Hz"),      # British female
    "brian":      ("en-US-BrianNeural", "-3%", "+0Hz"),      # Clear male narrator
    "ava":        ("en-US-AvaNeural", "-2%", "+0Hz"),        # Natural female (newest)
    "christopher":("en-US-ChristopherNeural", "-4%", "+0Hz"),# Formal male
    "roger":      ("en-US-RogerNeural", "-5%", "+0Hz"),      # Deep authoritative male

    # ── English Horror (subtle — creepy, not robotic) ──────
    "phantom":    ("en-US-GuyNeural", "-12%", "-4Hz"),       # Deeper, measured pace
    "whisper":    ("en-US-AriaNeural", "-8%", "-2Hz"),       # Slightly eerie female
    "shadow":     ("en-GB-RyanNeural", "-15%", "-6Hz"),      # Dark British narrator
    "dread":      ("en-US-RogerNeural", "-10%", "-3Hz"),     # Ominous deep voice
    "crypt":      ("en-US-ChristopherNeural", "-12%", "-5Hz"),  # Cold formal horror

    # ── Hindi (no rate/pitch modification — sounds most natural) ──
    "madhur":     ("hi-IN-MadhurNeural", "+0%", "+0Hz"),     # Hindi male
    "swara":      ("hi-IN-SwaraNeural", "+0%", "+0Hz"),      # Hindi female (best quality)
    "bhoot":      ("hi-IN-MadhurNeural", "+0%", "+0Hz"),     # Hindi horror (natural voice, horror via script/music)

    # ── Indian English ───────────────────────────────────────
    "prabhat":    ("en-IN-PrabhatNeural", "-3%", "+0Hz"),    # Indian English male
    "neerja":     ("en-IN-NeerjaNeural", "-3%", "+0Hz"),     # Indian English female
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

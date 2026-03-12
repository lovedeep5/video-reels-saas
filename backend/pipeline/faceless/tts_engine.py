"""Text-to-speech using edge-tts (free Microsoft TTS) with multiple natural voices."""

import asyncio
import os
import edge_tts

# Voice definitions: name → (edge_tts_id, rate_adjustment)
VOICES = {
    "jack":   ("en-US-GuyNeural", "-5%"),
    "emma":   ("en-US-EmmaMultilingualNeural", "-3%"),
    "andrew": ("en-US-AndrewMultilingualNeural", "-3%"),
    "aria":   ("en-US-AriaNeural", "-2%"),
    "ryan":   ("en-GB-RyanNeural", "-4%"),
    "sonia":  ("en-GB-SoniaNeural", "-3%"),
}


async def _generate_audio(text: str, output_path: str, voice_id: str, rate: str):
    """Generate audio file from text."""
    communicate = edge_tts.Communicate(text, voice_id, rate=rate)
    await communicate.save(output_path)


def generate_segment_audios(segments: list, output_dir: str, voice_name: str = "andrew") -> list:
    """
    Generate audio for each script segment using the selected voice.
    Returns list of audio file paths.
    """
    os.makedirs(output_dir, exist_ok=True)

    voice_id, rate = VOICES.get(voice_name, VOICES["andrew"])
    print(f"[TTS] Using voice: {voice_name} ({voice_id}, rate={rate})")

    paths = []
    for i, seg in enumerate(segments):
        path = os.path.join(output_dir, f"segment_{i}.mp3")
        asyncio.run(_generate_audio(seg["text"], path, voice_id, rate))
        size_kb = os.path.getsize(path) // 1024
        print(f"[TTS] Segment {i+1}: {size_kb}KB")
        paths.append(path)

    return paths

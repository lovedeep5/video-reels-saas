"""Assemble faceless video: AI backgrounds + subtitle overlay + audio narration.

- Background images: slow Ken Burns zoom + crossfade transitions
- Subtitles: bottom-positioned, 2 lines max, clean readable captions
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import (
    ImageClip,
    AudioFileClip,
    CompositeVideoClip,
)

FPS = 24
WIDTH = 1080
HEIGHT = 1920
CROSSFADE = 0.6

# Subtitle config — max 2 lines, ~4 words per line
MAX_WORDS_PER_LINE = 4
MAX_LINES = 2
WORDS_PER_CHUNK = MAX_WORDS_PER_LINE * MAX_LINES  # 8 words shown at a time


def _get_font(size: int):
    """Get a bold font — tries common paths on Linux (EC2) and Windows."""
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _split_into_chunks(text: str) -> list:
    """Split narration text into display chunks of ~8 words (2 lines x 4 words)."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), WORDS_PER_CHUNK):
        chunk_words = words[i:i + WORDS_PER_CHUNK]
        # Split chunk into 2 lines
        mid = min(MAX_WORDS_PER_LINE, len(chunk_words))
        line1 = " ".join(chunk_words[:mid])
        line2 = " ".join(chunk_words[mid:]) if len(chunk_words) > mid else ""
        chunks.append((line1, line2))
    return chunks if chunks else [("", "")]


def _create_subtitle_frame(
    line1: str, line2: str, title: str = "",
    seg_index: int = 0, total_segs: int = 3
) -> np.ndarray:
    """Create a transparent subtitle overlay frame."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Bottom gradient for readability
    grad_top = HEIGHT - 400
    for y in range(grad_top, HEIGHT):
        alpha = int(160 * ((y - grad_top) / (HEIGHT - grad_top)) ** 0.7)
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, alpha))

    # Title at top-left with accent bar
    if title:
        title_font = _get_font(28)
        draw.rounded_rectangle(
            [(40, 65), (44, 95)], radius=2, fill=(255, 200, 60, 255)
        )
        draw.text(
            (56, 80), title.upper(), font=title_font,
            fill=(255, 255, 255, 200), anchor="lm",
        )

    # Subtitle text — 2 lines at bottom
    sub_font = _get_font(52)
    line_height = 68
    base_y = HEIGHT - 240

    for idx, line in enumerate([line1, line2]):
        if not line:
            continue
        y = base_y + idx * line_height
        # Strong shadow for readability on any background
        for ox, oy in [(3, 3), (-1, -1), (2, 0), (0, 2)]:
            draw.text(
                (WIDTH // 2 + ox, y + oy), line, font=sub_font,
                fill=(0, 0, 0, 220), anchor="mm",
            )
        draw.text(
            (WIDTH // 2, y), line, font=sub_font,
            fill=(255, 255, 255, 255), anchor="mm",
        )

    # Progress dots at very bottom
    dot_y = HEIGHT - 80
    dot_spacing = 30
    start_x = WIDTH // 2 - (total_segs - 1) * dot_spacing // 2
    for d in range(total_segs):
        dx = start_x + d * dot_spacing
        if d == seg_index:
            draw.rounded_rectangle(
                [(dx - 10, dot_y - 3), (dx + 10, dot_y + 3)],
                radius=3, fill=(255, 200, 60, 255),
            )
        else:
            draw.ellipse(
                [(dx - 3, dot_y - 3), (dx + 3, dot_y + 3)],
                fill=(255, 255, 255, 60),
            )

    return np.array(img)


def _create_subtitle_clips(
    text: str, total_duration: float, title: str = "",
    seg_index: int = 0, total_segs: int = 3
) -> list:
    """Create multiple subtitle clips that cycle through text chunks over the segment duration."""
    chunks = _split_into_chunks(text)
    chunk_dur = total_duration / len(chunks)

    clips = []
    for i, (line1, line2) in enumerate(chunks):
        frame = _create_subtitle_frame(line1, line2, title, seg_index, total_segs)
        clip = ImageClip(frame, duration=chunk_dur, is_mask=False)
        clip = clip.with_start(i * chunk_dur)
        clips.append(clip)

    return clips


def _create_bg_clip(image_path: str, duration: float) -> ImageClip:
    """Background image with slow Ken Burns zoom."""
    clip = ImageClip(image_path, duration=duration)
    clip = clip.resized(lambda t, d=duration: 1.0 + 0.06 * (t / d))
    return clip


def _fade_in(get_frame, t, fade_duration):
    """Smooth fade-in for crossfade transitions."""
    frame = get_frame(t)
    if t < fade_duration:
        ratio = t / fade_duration
        factor = ratio * ratio * (3 - 2 * ratio)
        return (frame * factor).astype(np.uint8)
    return frame


def assemble_video(
    image_paths: list,
    audio_paths: list,
    segments: list,
    output_path: str,
    title: str = "",
) -> str:
    """
    Assemble faceless video:
    - AI-generated background images with Ken Burns zoom + crossfade
    - Word-chunked subtitle overlay (2 lines, 4 words each)
    - Audio narration
    """
    segment_clips = []
    total_segs = len(segments)

    for i, (img_path, audio_path, seg) in enumerate(
        zip(image_paths, audio_paths, segments)
    ):
        audio = AudioFileClip(audio_path)
        dur = audio.duration

        print(f"[Assembler] Segment {i+1}: {dur:.1f}s — \"{seg['text'][:60]}...\"")

        bg_clip = _create_bg_clip(img_path, dur)
        sub_clips = _create_subtitle_clips(
            seg["text"], dur, title=title, seg_index=i, total_segs=total_segs
        )

        composite = CompositeVideoClip(
            [bg_clip] + sub_clips, size=(WIDTH, HEIGHT)
        )
        composite = composite.with_duration(dur)
        composite = composite.with_audio(audio)
        segment_clips.append(composite)

    # Concatenate with crossfade
    if len(segment_clips) > 1:
        crossfaded = [segment_clips[0]]
        for clip in segment_clips[1:]:
            clip = clip.with_start(crossfaded[-1].end - CROSSFADE)
            clip = clip.transform(
                lambda get_frame, t, fade=CROSSFADE: _fade_in(get_frame, t, fade)
            )
            crossfaded.append(clip)

        total_dur = crossfaded[-1].end
        final = CompositeVideoClip(crossfaded, size=(WIDTH, HEIGHT))
        final = final.with_duration(total_dur)
    else:
        final = segment_clips[0]

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    final.write_videofile(
        output_path,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        logger="bar",
    )

    print(f"[Assembler] Video saved: {output_path}")
    return output_path

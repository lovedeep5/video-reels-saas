"""Assemble faceless video: AI backgrounds + text overlay + audio narration.

- Background images: slow Ken Burns zoom + crossfade transitions
- Text overlay: stable, centered, no zoom
- Subtitles: word-by-word animated captions (Instagram/TikTok style)
"""

import os
import textwrap
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


def _get_font(size: int):
    """Get a font — tries common paths on Linux (EC2) and Windows."""
    font_paths = [
        # Linux (EC2 Ubuntu)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-Bold.ttf",
        # Windows
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _create_text_overlay(
    text: str, title: str = "", seg_index: int = 0, total_segs: int = 3
) -> np.ndarray:
    """Create a transparent text overlay (RGBA numpy array)."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Semi-transparent dark strip behind text for readability
    strip_y = HEIGHT // 2 - 160
    strip_h = 320
    draw.rounded_rectangle(
        [(40, strip_y), (WIDTH - 40, strip_y + strip_h)],
        radius=20,
        fill=(0, 0, 0, 150),
    )

    # Title at top
    if title:
        title_font = _get_font(42)
        # Shadow
        draw.text(
            (WIDTH // 2 + 2, 102),
            title.upper(),
            font=title_font,
            fill=(0, 0, 0, 200),
            anchor="mm",
        )
        draw.text(
            (WIDTH // 2, 100),
            title.upper(),
            font=title_font,
            fill=(255, 220, 100, 255),
            anchor="mm",
        )

    # Main narration text — centered, wrapped
    main_font = _get_font(56)
    wrapped = textwrap.fill(text, width=26)
    lines = wrapped.split("\n")
    line_height = 72

    y_start = HEIGHT // 2 - (len(lines) * line_height) // 2
    for i, line in enumerate(lines):
        y = y_start + i * line_height
        # Shadow layers for depth
        for ox, oy in [(3, 3), (2, 2)]:
            draw.text(
                (WIDTH // 2 + ox, y + oy),
                line,
                font=main_font,
                fill=(0, 0, 0, 200),
                anchor="mm",
            )
        draw.text(
            (WIDTH // 2, y), line, font=main_font, fill=(255, 255, 255, 255), anchor="mm"
        )

    # Progress dots at bottom
    dot_y = HEIGHT - 180
    dot_spacing = 40
    start_x = WIDTH // 2 - (total_segs - 1) * dot_spacing // 2
    for d in range(total_segs):
        dx = start_x + d * dot_spacing
        color = (255, 220, 100, 255) if d == seg_index else (255, 255, 255, 80)
        draw.ellipse([(dx - 8, dot_y - 8), (dx + 8, dot_y + 8)], fill=color)

    return np.array(img)


def _create_text_clip(
    text: str, duration: float, title: str = "", seg_index: int = 0, total_segs: int = 3
) -> ImageClip:
    """Create a stable text overlay clip."""
    overlay = _create_text_overlay(text, title, seg_index, total_segs)
    return ImageClip(overlay, duration=duration, is_mask=False)


def _create_bg_clip(image_path: str, duration: float) -> ImageClip:
    """Background image with slow Ken Burns zoom."""
    clip = ImageClip(image_path, duration=duration)
    clip = clip.resized(lambda t, d=duration: 1.0 + 0.08 * (t / d))
    return clip


def _fade_in(get_frame, t, fade_duration):
    """Smooth fade-in for crossfade transitions."""
    frame = get_frame(t)
    if t < fade_duration:
        ratio = t / fade_duration
        factor = ratio * ratio * (3 - 2 * ratio)  # smoothstep
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
    - Stable text overlay
    - Audio narration
    """
    segment_clips = []
    total_segs = len(segments)

    for i, (img_path, audio_path, seg) in enumerate(
        zip(image_paths, audio_paths, segments)
    ):
        audio = AudioFileClip(audio_path)
        dur = audio.duration

        print(f"[Assembler] Segment {i+1}: {dur:.1f}s")

        bg_clip = _create_bg_clip(img_path, dur)
        text_clip = _create_text_clip(
            seg["text"], dur, title=title, seg_index=i, total_segs=total_segs
        )

        composite = CompositeVideoClip([bg_clip, text_clip], size=(WIDTH, HEIGHT))
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

"""
LLM-based clip selector using OpenRouter API.

Sends the full transcript (with timestamps) to Claude via OpenRouter and asks
it to identify the N most engaging segments suitable for short-form social media.

Falls back gracefully to audio energy scoring if:
  - OPENROUTER_API_KEY is not set
  - Transcription produced no segments
  - API call fails
  - Response is unparseable
"""
import json
import re
from typing import Optional

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openrouter/free"


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def _build_transcript_text(segments: list[dict]) -> str:
    """Format segments as: [MM:SS] text"""
    return "\n".join(
        f"[{_fmt_time(seg['start'])}] {seg['text'].strip()}"
        for seg in segments
    )


def _remove_overlaps(clips: list[dict], max_overlap_ratio: float = 0.25) -> list[dict]:
    """
    Greedy NMS — keep a clip only if it doesn't heavily overlap with
    any already-selected clip. Clips must be pre-sorted by score (desc)
    or by whatever priority order the caller wants.
    """
    selected = []
    for clip in clips:
        overlap = False
        clip_len = clip["end"] - clip["start"]
        for kept in selected:
            overlap_len = min(clip["end"], kept["end"]) - max(clip["start"], kept["start"])
            if overlap_len > 0 and clip_len > 0:
                if overlap_len / clip_len > max_overlap_ratio:
                    overlap = True
                    break
        if not overlap:
            selected.append(clip)
    return selected


def _parse_llm_response(text: str, duration: float, n_clips: int) -> list[dict]:
    """Extract, validate, and deduplicate JSON clip list from Claude's response."""
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON array found in response")

    clips = json.loads(json_match.group())
    validated = []

    for clip in clips:
        start = float(clip.get("start_seconds", clip.get("start", 0)))
        end = float(clip.get("end_seconds", clip.get("end", 0)))
        reason = clip.get("reason", clip.get("why", ""))

        if end <= start or (end - start) < 10:
            continue
        start = max(0.0, start)
        end = min(end, duration)

        validated.append({
            "start": round(start, 1),
            "end": round(end, 1),
            "score": 1.0,
            "transcript": reason,
        })

    # Remove overlapping clips, then sort chronologically
    deduped = _remove_overlaps(validated)
    deduped.sort(key=lambda x: x["start"])

    print(f"[llm_scorer] After overlap removal: {len(deduped)}/{len(validated)} clips kept")
    return deduped[:n_clips]


def select_clips_with_llm(
    segments: list[dict],
    duration: float,
    n_clips: int,
    video_title: Optional[str] = None,
    clip_duration: float = 35.0,
) -> list[dict]:
    """
    Ask Claude (via OpenRouter) to pick the N best clips from the transcript.
    Returns list of {start, end, score, transcript} or empty list on any failure.
    """
    import requests
    import os

    # Read directly from env — avoids pydantic_settings caching issues on EC2
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    print(f"[llm_scorer] API key present: {bool(api_key)} length: {len(api_key)}")

    if not api_key:
        print("[llm_scorer] No OPENROUTER_API_KEY — skipping LLM scoring")
        return []

    if not segments:
        print("[llm_scorer] No transcript segments — skipping LLM scoring")
        return []

    transcript = _build_transcript_text(segments)
    total_minutes = int(duration // 60)
    title_line = f'Title: "{video_title}"\n' if video_title else ""

    prompt = f"""You are a social media content expert. Your job is to find the best short clips from a video transcript.

{title_line}Video length: {total_minutes} minutes
Clips needed: {n_clips}
Target clip length: {int(clip_duration)}-{int(clip_duration + 10)} seconds each

TRANSCRIPT (format [MM:SS] text):
{transcript}

TASK:
Identify the {n_clips} most engaging, valuable segments from this transcript for short-form social media (Instagram Reels, TikTok, YouTube Shorts).

Prioritize segments that:
- Contain a complete insight, story, or strong opinion
- Have a clear hook and payoff within the clip
- Make sense without prior context
- Are emotionally resonant, surprising, or highly actionable
- Deliver a memorable quote or key moment

Rules:
- Each clip must be {int(clip_duration)}-{int(clip_duration + 10)} seconds long
- Never cut mid-sentence — align to complete thoughts
- Do not pick overlapping clips

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {{
    "start_seconds": <number>,
    "end_seconds": <number>,
    "reason": "<one sentence: why this clip is great>"
  }}
]"""

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://vidtoreels.com",
                "X-Title": "VidToReels",
            },
            json={
                "model": DEFAULT_MODEL,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        response.raise_for_status()

        data = response.json()
        response_text = data["choices"][0]["message"]["content"]
        print(f"[llm_scorer] OpenRouter response received ({len(response_text)} chars)")

        clips = _parse_llm_response(response_text, duration, n_clips)
        print(f"[llm_scorer] Selected {len(clips)} clips via LLM")
        return clips

    except Exception as e:
        print(f"[llm_scorer] LLM scoring failed: {e}")
        return []

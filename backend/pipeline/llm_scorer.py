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
DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free"


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
        hook = clip.get("hook", "")
        reason = clip.get("reason", clip.get("why", ""))
        transcript_text = f"{hook} | {reason}".strip(" |") if hook else reason

        if end <= start or (end - start) < 15:
            continue
        start = max(0.0, start)
        end = min(end, duration)

        validated.append({
            "start": round(start, 1),
            "end": round(end, 1),
            "score": 1.0,
            "transcript": transcript_text,
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

    prompt = f"""You are a world-class short-form video editor and viral content strategist with deep expertise in Instagram Reels, TikTok, and YouTube Shorts. Your task is to identify the {n_clips} clips most likely to go viral from the transcript below.

{title_line}Total video length: {total_minutes} minutes
Number of clips to select: {n_clips}
Target clip duration: {int(clip_duration)}–{int(clip_duration + 15)} seconds each

TRANSCRIPT (timestamps in [MM:SS] format, each line is one spoken segment):
{transcript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT MAKES A CLIP VIRAL — RANK THESE HIGHEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. STRONG HOOK in the first 3 seconds — the clip opens with a surprising statement, bold claim, rhetorical question, or an emotional moment that stops the scroll
2. SELF-CONTAINED story or argument — viewer does NOT need to have watched anything before this clip to understand and enjoy it
3. HIGH EMOTION — humor, shock, inspiration, controversy, vulnerability, awe, or relatability
4. CLEAR PAYOFF — the clip builds to a satisfying conclusion, punchline, revelation, or call-to-action
5. QUOTABLE or SHAREABLE — contains a memorable one-liner, counterintuitive insight, or universally relatable truth
6. HIGH INFORMATION DENSITY — packs a genuine insight, useful tip, or compelling story into a short window
7. CONFLICT or TENSION — disagreement, challenge, problem being solved, or stakes being raised

ALSO PRIORITIZE:
- Personal stories with specific details (names, numbers, moments)
- Moments where the speaker is most passionate or emphatic
- Surprising statistics, counterintuitive facts, or "wait — what?" moments
- Step-by-step tips that are immediately actionable
- Strong opinions stated with conviction
- Moments that spark curiosity ("here's what nobody tells you about X")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT BOUNDARY RULES — FOLLOW EXACTLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. START on a complete sentence boundary — never begin mid-sentence or mid-thought. The first word must be the start of a new sentence.
2. END on a complete sentence boundary — never cut off mid-sentence. The last word must end a complete sentence (ends with . ? ! or a natural pause).
3. The clip must feel COMPLETE — it should not feel like it was cut from the middle of a larger point with no resolution.
4. NO overlapping clips — each clip must cover a unique portion of the video.
5. Clip duration must be between {int(clip_duration)} and {int(clip_duration + 15)} seconds. Do not go shorter (too rushed) or longer (loses attention).
6. Prefer not to start a clip in the first 30 seconds — intros are usually weak. However, if the video opens with a strong hook or a complete standalone moment (or if you need to fill all {n_clips} requested clips), the first 30 seconds is allowed.
7. Spread clips across different parts of the video when possible — avoid clustering all clips in one section.
8. If a segment is weak on its own (e.g., just "yeah, exactly, mmhm"), expand to the nearest complete thought that gives it context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO DETERMINE START/END SECONDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Each transcript line begins with a timestamp [MM:SS]. Convert MM:SS to total seconds (MM×60 + SS).
- The start_seconds should match or be just before the timestamp of the first line of your clip.
- The end_seconds should match or be just after the timestamp of the LAST line of your clip, allowing the sentence to finish naturally. Add 1–3 seconds of buffer so the final word is not cut off.
- Double-check: end_seconds − start_seconds must be between {int(clip_duration)} and {int(clip_duration + 15)}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond ONLY with a valid JSON array. No markdown, no explanation, no extra text before or after.

[
  {{
    "start_seconds": <integer>,
    "end_seconds": <integer>,
    "hook": "<the opening words of this clip — first 5–10 words spoken>",
    "reason": "<2 sentences: what makes this clip viral-worthy and why the boundaries are correct>"
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
                "max_tokens": 2048,
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

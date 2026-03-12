"""Generate a short narration script + image prompts using OpenRouter."""

import os
import json
import httpx

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Free models first, then paid fallback
MODELS = [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-v3.2-20251201",
    "openai/gpt-4o-mini",
]

# Style descriptions for image prompt injection
STYLE_PROMPTS = {
    "ghibli": "Studio Ghibli anime style, warm colors, detailed hand-painted background, soft lighting, Miyazaki aesthetic",
    "anime": "modern anime illustration, vibrant colors, crisp linework, dramatic lighting, detailed background",
    "cartoon": "western cartoon style, bold colors, clean shapes, playful composition, Pixar-inspired",
    "comic": "comic book illustration style, bold ink outlines, halftone dots, dramatic angles, vivid colors",
    "realistic": "photorealistic digital art, cinematic lighting, 8k detail, depth of field, dramatic atmosphere",
    "watercolor": "soft watercolor painting, gentle washes of color, artistic brush strokes, dreamy ethereal mood",
}


def _call_openrouter(messages: list, max_tokens: int = 800) -> str:
    """Try multiple models with fallback."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    for model in MODELS:
        try:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.8,
                "max_tokens": max_tokens,
            }
            r = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            print(f"[ScriptGen] Using model: {model}")
            return content
        except Exception as e:
            print(f"[ScriptGen] Model {model} failed: {e}, trying next...")
    raise RuntimeError("All models failed")


def generate_script(topic: str, duration_seconds: int = 30, style: str = "ghibli") -> dict:
    """
    Generate a narration script with image prompts for each segment.
    Returns: {"title": str, "segments": [{"text": str, "duration": float, "image_prompt": str}]}
    """
    # Scale segments based on duration
    if duration_seconds <= 15:
        num_segments = 3
    elif duration_seconds <= 30:
        num_segments = 5
    else:
        num_segments = 8

    seg_dur = round(duration_seconds / num_segments, 1)
    style_desc = STYLE_PROMPTS.get(style, STYLE_PROMPTS["ghibli"])

    segments_json = ", ".join([
        f'{{"text": "narration text", "duration": {seg_dur}, "image_prompt": "detailed visual scene description"}}'
        for _ in range(num_segments)
    ])

    prompt = f"""You are a professional short-form video scriptwriter. Write a captivating narration script for a {duration_seconds}-second faceless video about: "{topic}"

Rules:
- Split into exactly {num_segments} segments of ~{seg_dur}s each
- Each segment: 1-2 compelling sentences
- Total word count ~{duration_seconds * 2} words (roughly 2 words per second of speech)
- Start with a strong hook to grab attention instantly
- Build tension/curiosity through the middle
- End with a satisfying conclusion or call-to-action
- Use vivid, descriptive language

For EACH segment, also write an image_prompt that describes a visual scene. The image_prompt should:
- Describe the scene visually (subjects, setting, mood, colors, composition)
- Include this style: "{style_desc}"
- Be specific enough to generate a beautiful, unique image
- Each scene should visually differ from the others

Return ONLY valid JSON, no markdown, no code blocks:
{{"title": "short catchy title", "segments": [{segments_json}]}}"""

    content = _call_openrouter([{"role": "user", "content": prompt}], max_tokens=1200)

    # Clean up potential markdown code fences
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    content = content.strip()

    script = json.loads(content)

    # Inject style into image prompts if not already present
    for seg in script["segments"]:
        if style_desc.split(",")[0].lower() not in seg["image_prompt"].lower():
            seg["image_prompt"] = f'{seg["image_prompt"]}, {style_desc}'

    print(f"[ScriptGen] Generated: {script['title']} ({len(script['segments'])} segments)")
    for i, seg in enumerate(script["segments"]):
        print(f"  Seg {i+1} ({seg['duration']}s): {seg['text'][:80]}...")

    return script

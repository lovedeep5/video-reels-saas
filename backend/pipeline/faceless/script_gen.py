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
    "comic": "comic book art style, thick bold ink outlines, flat cel shading, muted color palette with strong shadows, noir comic aesthetic, dramatic panel composition, graphic novel illustration",
    "creepy-comic": "creepy comic book illustration, dark muted colors, unsettling character expressions, horror comic art style, thick ink outlines, eerie shadows, vintage horror comic aesthetic",
    "modern-cartoon": "modern cartoon illustration, stylized characters with exaggerated features, bold colors, clean digital art, trendy urban aesthetic, detailed background, contemporary cartoon style",
    "disney": "Disney Pixar 3D animation style, soft warm lighting, photorealistic 3D rendering, charming character design, cozy indoor setting, subsurface scattering on skin, Pixar movie quality",
    "ghibli": "Studio Ghibli hand-painted anime style, warm golden lighting, lush detailed nature backgrounds, soft pastel colors, whimsical atmosphere, Miyazaki aesthetic, watercolor texture",
    "anime": "modern Japanese anime illustration, dramatic shading, vibrant saturated colors, detailed character design, crisp linework, dynamic composition, manga art style, detailed clothing and accessories",
    "painting": "classical oil painting style, rich warm tones, dramatic chiaroscuro lighting, detailed brushwork visible, Renaissance-inspired composition, museum quality portrait, old master technique",
    "dark-fantasy": "dark fantasy illustration, epic dramatic lighting with aurora borealis, medieval gothic aesthetic, detailed armor and weapons, mystical atmosphere, ravens and dark imagery, cinematic fantasy art",
    "lego": "LEGO minifigure 3D render style, plastic toy aesthetic, bright primary colors, simple round heads with printed faces, blocky proportions, studio lighting on plastic surface, LEGO brick world",
    "polaroid": "vintage Polaroid photograph aesthetic, warm film grain, soft focus bokeh, nostalgic warm color grading, natural candid portrait photography, fairy lights background, retro film camera look",
    "realistic": "hyperrealistic cinematic photography, golden hour natural lighting, shallow depth of field, 8K detail, real-world setting, photojournalistic style, professional DSLR camera quality",
    "fantastic": "fantastical digital art, surreal underwater or otherworldly environment, volumetric light rays, ethereal glowing atmosphere, epic scale, concept art quality, cinematic wide composition",
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

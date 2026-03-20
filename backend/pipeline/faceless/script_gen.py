"""Generate a short narration script + detailed image prompts using OpenRouter."""

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


def _enhance_image_prompt(scene_description: str, style: str, style_desc: str) -> str:
    """Use LLM to generate a detailed, Flux-optimized image prompt for one scene."""
    prompt = f"""You are an expert at writing prompts for AI image generation (Flux model).

Given this scene description: "{scene_description}"
Art style: {style}

Write a single detailed image generation prompt that will produce a stunning vertical portrait image. Rules:
- Describe the EXACT visual scene: subject, setting, lighting, mood, colors, composition
- The image must work in VERTICAL PORTRAIT orientation (9:16 tall format) — compose subjects centered vertically
- Include specific visual details (textures, materials, atmosphere)
- Include this style at the end: {style_desc}
- Add "vertical portrait composition, tall format" at the end
- Keep it under 100 words
- Return ONLY the prompt text, nothing else"""

    try:
        result = _call_openrouter([{"role": "user", "content": prompt}], max_tokens=200)
        return result.strip().strip('"').strip("'")
    except Exception as e:
        print(f"[ScriptGen] Image prompt enhancement failed: {e}")
        return f"{scene_description}, {style_desc}, vertical portrait composition, tall format"


SCRIPT_TYPE_INSTRUCTIONS = {
    "story": "Write as a compelling NARRATIVE STORY with a clear beginning, rising tension, climax, and satisfying ending. Use dramatic storytelling language, paint vivid scenes, and make the listener feel like they're experiencing the events.",
    "facts": "Write as an engaging FACTS video. Start each key fact with a hook like 'Did you know...' or 'Here's something terrifying...'. Make each fact surprising and memorable. End with a mind-blowing conclusion.",
    "explainer": "Write as a clear EXPLAINER that breaks down HOW or WHY something works. Use simple analogies, build understanding step by step, and end with an 'aha moment' that ties everything together.",
    "listicle": "Write as a TOP LIST countdown. Number each item. Start with the least impressive and build to the most shocking/interesting. Create suspense between items. End with '#1' being truly unforgettable.",
    "horror": "Write as a HORROR/CREEPY narration. Build dread slowly. Use short, punchy sentences for tension. Describe unsettling details. Make the listener feel uneasy. End with a chilling twist or unresolved mystery.",
    "motivation": "Write as a MOTIVATIONAL speech. Start with a relatable struggle. Build through overcoming obstacles. Use powerful, energetic language. End with a strong call-to-action that inspires immediate change.",
}


def generate_script(topic: str, duration_seconds: int = 30, style: str = "ghibli", script_type: str = "story", variation_hint: str = "") -> dict:
    """
    Generate a narration script with image prompts for each segment.
    variation_hint: optional instruction to ensure unique content (used by automation).
    Returns: {"title": str, "segments": [{"text": str, "duration": float, "image_prompt": str}]}
    """
    if duration_seconds <= 15:
        num_segments = 3
    elif duration_seconds <= 30:
        num_segments = 5
    else:
        num_segments = 8

    seg_dur = round(duration_seconds / num_segments, 1)
    style_desc = STYLE_PROMPTS.get(style, STYLE_PROMPTS["ghibli"])

    segments_json = ", ".join([
        f'{{"text": "narration text", "duration": {seg_dur}, "scene_description": "brief visual scene description"}}'
        for _ in range(num_segments)
    ])

    type_instruction = SCRIPT_TYPE_INSTRUCTIONS.get(script_type, SCRIPT_TYPE_INSTRUCTIONS["story"])

    variation_block = ""
    if variation_hint:
        variation_block = f"""
IMPORTANT — UNIQUENESS REQUIREMENT:
{variation_hint}
You MUST pick a completely different angle, different facts, different story, or different perspective than any previous video about this topic. Be creative and surprising.
"""

    prompt = f"""You are a professional short-form video scriptwriter. Write a captivating narration script for a {duration_seconds}-second faceless video about: "{topic}"

SCRIPT STYLE: {type_instruction}
{variation_block}
Rules:
- Split into exactly {num_segments} segments of ~{seg_dur}s each
- Each segment: 1-2 compelling sentences
- Total word count ~{duration_seconds * 2} words (roughly 2 words per second of speech)
- Start with an IRRESISTIBLE hook — the first 3 seconds must grab attention
- Build tension/curiosity through the middle
- End with a powerful conclusion that makes the viewer want more
- Use vivid, descriptive, emotional language — write for the EAR not the eye

For EACH segment, write a scene_description (NOT an image prompt) that describes what should be shown visually:
- What is the main subject? (person, creature, object, landscape)
- What is the setting? (location, time of day, weather)
- What is the mood? (dark, bright, peaceful, intense)
- Keep it to 1-2 sentences describing the visual scene

Return ONLY valid JSON, no markdown, no code blocks:
{{"title": "short catchy title", "segments": [{segments_json}]}}"""

    content = _call_openrouter([{"role": "user", "content": prompt}], max_tokens=1200)

    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    content = content.strip()

    script = json.loads(content)

    # Enhance each scene_description into a detailed Flux image prompt
    print(f"[ScriptGen] Enhancing {len(script['segments'])} image prompts for style: {style}...")
    for i, seg in enumerate(script["segments"]):
        scene = seg.pop("scene_description", seg.get("image_prompt", ""))
        seg["image_prompt"] = _enhance_image_prompt(scene, style, style_desc)
        print(f"  Prompt {i+1}: {seg['image_prompt'][:100]}...")

    print(f"[ScriptGen] Generated: {script['title']} ({len(script['segments'])} segments)")
    for i, seg in enumerate(script["segments"]):
        print(f"  Seg {i+1} ({seg['duration']}s): {seg['text'][:80]}...")

    return script

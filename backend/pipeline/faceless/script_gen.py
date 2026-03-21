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
                "temperature": 0.85,
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


# ─── Type-specific system prompts (research-backed formulas) ────────────────

SCRIPT_TYPE_INSTRUCTIONS = {
    "story": """You are a master storyteller like MrBallen. Write a NARRATIVE STORY using this exact structure:

FORMULA (Slow Escalation):
1. HOOK (Segment 1): Drop the viewer into the most dramatic moment mid-action. No greetings, no "today we'll talk about." Start with danger, mystery, or shock. Example: "At 3 AM, the security camera caught something that shouldn't exist."
2. CONTEXT (Segment 2): Rewind. Who, where, when. Establish normalcy with sensory details — what did it smell like, sound like, feel like?
3. RISING ACTION (Segments 3-4): Small oddities escalate into real danger. Use SHORT SENTENCES to build pace. Each sentence should make the viewer think "wait, what?"
4. CLIMAX (Segment 4-5): Peak tension. Fastest pacing. Reveal the truth. Make it hit HARD.
5. AFTERMATH (Final Segment): A chilling final thought, unresolved mystery, or perspective shift. Leave the viewer thinking.

TECHNIQUES YOU MUST USE:
- Open Loop: Raise a question in segment 1 that you don't answer until segment 4-5
- Sensory Detail: "Her hands shook so badly she couldn't turn the key" NOT "She was scared"
- Pattern Interrupt: Shift tone at least once (calm to urgent, or serious to eerily quiet)
- Write for the EAR: Short sentences mixed with longer ones. Conversational. Like telling a friend at a bar.""",

    "facts": """You are a viral facts video creator like Bright Side. Write an engaging FACTS video using this formula:

FORMULA (Surprise Cascade):
1. HOOK (Segment 1): Lead with the MOST MIND-BLOWING fact. "The ocean is so deep that if you dropped Mount Everest in it, the peak wouldn't even break the surface." NO generic intros.
2. FACT CHAIN (Segments 2-4): Each fact must be more surprising than the last. Start each with a curiosity trigger: "Here's what nobody tells you..." / "Scientists were shocked to find..." / "This next one sounds fake, but..."
3. CONNECTOR PHRASES between facts: "But that's nothing compared to..." / "And it gets even crazier..." — never just list facts flatly.
4. FINALE (Final Segment): Save a fact so surprising it feels impossible. End with a question that makes the viewer want to share: "Makes you wonder what else we haven't discovered yet."

TECHNIQUES YOU MUST USE:
- Each fact must have a "WOW" reaction moment — if it doesn't surprise, cut it
- Use COMPARISONS to make numbers feel real: "That's enough to fill 500 Olympic swimming pools"
- Rhetorical questions between facts: "But have you ever wondered WHY?"
- Emotional oscillation: alternate between "that's amazing" and "that's terrifying" facts""",

    "explainer": """You are a brilliant explainer like Kurzgesagt. Write a clear EXPLAINER video using this formula:

FORMULA (Question-Driven Simplification):
1. HOOK (Segment 1): Open with a counterintuitive question or claim that challenges assumptions. "What if everything you know about sleep is wrong?"
2. FOUNDATION (Segment 2): The simplest possible explanation of the base concept. Use ONE powerful metaphor or analogy.
3. THE TWIST (Segment 3): "But here's where it gets interesting..." Add the layer of complexity that makes this topic fascinating.
4. IMPLICATIONS (Segment 4): Why should the viewer care? Scale it to THEIR life. Make it personal.
5. PERSPECTIVE SHIFT (Final Segment): The "whoa" moment. A realization that changes how they see the world. End with wonder, not a summary.

TECHNIQUES YOU MUST USE:
- Metaphors over jargon: "Think of DNA like a recipe book" NOT "DNA contains nucleotide sequences"
- Build from simple to complex — never dump complexity upfront
- "You" language throughout — make the viewer feel personally involved
- One BIG perspective shift at the end that justifies the entire video""",

    "listicle": """You are a master list creator like WatchMojo. Write a TOP LIST countdown using this formula:

FORMULA (Reverse Countdown):
1. HOOK (Segment 1): Announce what's coming with maximum intrigue. "These are the 5 most [adjective] [things] ever [discovered/recorded/attempted] — and number 1 will genuinely disturb you."
2. ITEMS (Segments 2-4): Build from least to most extreme. Each item gets:
   - A mini-hook: one sentence that makes you NEED to hear more
   - The core revelation: 1-2 sentences of the actual content
   - A transition tease: "But the next one makes this look tame..."
3. NUMBER ONE (Second-to-last Segment): Give this EXTRA weight. Build it up. Deliver the biggest payoff.
4. OUTRO (Final Segment): Callback to the hook. "And THAT is why [topic] will never be the same." End with engagement bait: "Which one shocked you the most?"

TECHNIQUES YOU MUST USE:
- Each item must feel like an escalation — never let energy drop
- Use specific numbers and details: "In 1983, at exactly 2:47 AM..." NOT "One time..."
- Contrast items: "While that was terrifying, the next one is just plain weird"
- The #1 item should feel like a genuine reveal, not predictable""",

    "horror": """You are a horror narrator like Mr. Nightmare and Lazy Masquerade. Write a HORROR narration using this exact structure:

FORMULA (Slow Dread Escalation):
1. COLD OPEN (Segment 1): Drop into the SCARIEST moment. A fragment of the climax. Then cut away. "The door was already open. And the smell — she'd never forget that smell." Leave it unresolved.
2. NORMALCY (Segment 2): Rewind. Establish the setting with hyper-specific sensory details. Everything is FINE. The contrast makes the horror hit harder. Describe sounds, textures, temperatures.
3. UNEASE (Segment 3): Subtle wrongness. Things that COULD be explained... but feel off. "The neighbor's dog hadn't barked in three days. The mailbox was overflowing." Short. Measured. Let the silence between sentences do the work.
4. FALSE SCARE (Segment 4): Build to a scare — then reveal it's nothing. The viewer relaxes. "It was just the wind." This makes the REAL scare hit 3x harder.
5. REAL HORROR (Segment 5): NOW unleash the actual threat. Sentences get SHORTER. Pacing ACCELERATES. "She turned. It was there. Right behind the curtain. Breathing."
6. AFTERMATH (Final Segment): DON'T resolve everything. Leave something unexplained. End on DREAD, not relief. "They found her car the next morning. Engine still running. Driver's seat empty. And on the dashboard — a single photograph of her sleeping."

TECHNIQUES YOU MUST USE:
- Sensory horror: describe what things SMELL, SOUND, and FEEL like — not just what they look like
- Short sentences = terror. Long sentences = calm. Use sentence length as a fear dial.
- NEVER use the word "scary" or "terrifying" — SHOW the horror through details
- The false scare in the middle is CRITICAL — without it, the real scare has no contrast
- End with an image, not an explanation. Let the viewer's imagination do the rest.""",

    "motivation": """You are a motivational speaker combining Gary Vee's energy with Stoic philosophy. Write a MOTIVATION video using this formula:

FORMULA (Pain → Reframe → Power):
1. HOOK (Segment 1): Hit the viewer's PAIN POINT directly. Second person. Present tense. "You've been grinding for months and nothing's changed. You're starting to wonder if it's even worth it." Make them feel SEEN.
2. VALIDATION (Segment 2): Don't lecture — EMPATHIZE first. "Most people feel exactly like you do. And here's the thing — that feeling? It's not weakness. It's the gap between where you are and where you know you should be."
3. THE REFRAME (Segment 3): Introduce the principle that changes EVERYTHING. Use a specific story or example. "Marcus Aurelius ruled the Roman Empire during a plague, a war, and a famine — simultaneously. His secret wasn't motivation. It was this..."
4. APPLICATION (Segment 4): Make it ACTIONABLE. "Here's exactly what to do starting tonight. Not next week. Tonight."
5. EMPOWERMENT (Final Segment): End in PRESENT TENSE. Not "you will become" but "you ARE becoming." Make the viewer feel powerful RIGHT NOW. "The person who keeps showing up, even when it hurts — that's who you already are."

TECHNIQUES YOU MUST USE:
- "You" in every segment — this is PERSONAL, not a lecture
- Validate before advising — never start with "you should"
- Use ONE powerful historical/real story as proof, not generic "believe in yourself"
- End with present tense empowerment, not future promises
- Short punchy sentences for impact: "You show up. You do the work. You don't quit." """,
}


def generate_script(topic: str, duration_seconds: int = 30, style: str = "ghibli", script_type: str = "story", variation_hint: str = "", language: str = "English") -> dict:
    """
    Generate a narration script with image prompts for each segment.
    variation_hint: optional instruction to ensure unique content (used by automation).
    Returns: {"title": str, "segments": [{"text": str, "duration": float, "image_prompt": str}]}
    """
    if duration_seconds <= 15:
        num_segments = 3
    elif duration_seconds <= 30:
        num_segments = 5
    elif duration_seconds <= 60:
        num_segments = 8
    else:
        num_segments = 12

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

    lang_instruction = ""
    if language != "English":
        lang_instruction = f"\nLANGUAGE: Write ALL narration text in {language}. The script MUST be entirely in {language}. Use natural, fluent {language} — not translated English.\n"

    prompt = f"""You are a professional short-form video scriptwriter who creates scripts for viral faceless YouTube/Instagram channels.

TOPIC: "{topic}"
VIDEO LENGTH: {duration_seconds} seconds ({num_segments} segments of ~{seg_dur}s each)

{type_instruction}
{variation_block}{lang_instruction}

CRITICAL RULES — FOLLOW EXACTLY:
1. Split into exactly {num_segments} segments of ~{seg_dur}s each
2. Each segment: 1-3 SHORT, PUNCHY sentences. Write for speaking, not reading.
3. Total word count: ~{int(duration_seconds * 2.5)} words (roughly 2.5 words per second)
4. NEVER start with "Hey everyone" or "Welcome to" or "In today's video" — that's instant viewer drop-off
5. First segment MUST be an irresistible hook that creates a curiosity gap or drops into action
6. Use OPEN LOOPS: raise questions early, answer them later
7. Every 2-3 segments, add a PATTERN INTERRUPT: a tonal shift, rhetorical question, or unexpected detail
8. Use SENSORY language: describe what things look, sound, smell, feel like — don't just state facts
9. End with something that makes the viewer FEEL something — not a summary
10. Write like you're telling this to a FRIEND, not presenting to a classroom

VISUAL SCENES:
For EACH segment, write a scene_description (NOT an image prompt) — a 1-2 sentence description of what should appear visually:
- What is the main subject? (person, creature, object, landscape)
- What is the setting? (location, time of day, weather, atmosphere)
- What is the mood/emotion of the scene?

Return ONLY valid JSON, no markdown, no code blocks:
{{"title": "short catchy title (max 8 words)", "segments": [{segments_json}]}}"""

    content = _call_openrouter([
        {"role": "system", "content": "You write viral video scripts. Your scripts are known for hooks that stop people scrolling, open loops that keep them watching, and endings that make them share. You never write generic, Wikipedia-style content. Every sentence serves a purpose: hook, build tension, deliver payoff."},
        {"role": "user", "content": prompt}
    ], max_tokens=1500)

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

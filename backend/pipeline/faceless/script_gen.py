"""Generate a short narration script + detailed image prompts using OpenRouter.

Pipeline:
  1. Web search (if factual/news topic) — grounded context
  2. Expand topic → detailed creative brief (GPT-4o-mini)
  3. Extract named characters → canonical visual descriptions
  4. Generate segmented script + per-scene descriptions
  5. Enhance each scene → character-aware Flux image prompt
"""

import os
import re
import json
import httpx

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Free models first, paid fallback for script generation
MODELS = [
    "google/gemini-2.5-flash",
    "deepseek/deepseek-v3.2-20251201",
    "openai/gpt-4o-mini",
]

# Best reasoning model for topic expansion + entity extraction (runs once per video)
ENHANCE_MODEL = "openai/gpt-4o-mini"

# Style descriptions injected into every image prompt
STYLE_PROMPTS = {
    "comic":         "comic book art style, thick bold ink outlines, flat cel shading, muted color palette with strong shadows, noir comic aesthetic, dramatic panel composition, graphic novel illustration",
    "creepy-comic":  "creepy comic book illustration, dark muted colors, unsettling character expressions, horror comic art style, thick ink outlines, eerie shadows, vintage horror comic aesthetic",
    "modern-cartoon":"modern cartoon illustration, stylized characters with exaggerated features, bold colors, clean digital art, trendy urban aesthetic, detailed background, contemporary cartoon style",
    "disney":        "Disney Pixar 3D animation style, soft warm lighting, photorealistic 3D rendering, charming character design, cozy atmosphere, subsurface scattering on skin, Pixar movie quality",
    "ghibli":        "Studio Ghibli hand-painted anime style, warm golden lighting, lush detailed nature backgrounds, soft pastel colors, whimsical atmosphere, Miyazaki aesthetic, watercolor texture",
    "anime":         "modern Japanese anime illustration, dramatic shading, vibrant saturated colors, detailed character design, crisp linework, dynamic composition, manga art style",
    "painting":      "classical oil painting style, rich warm tones, dramatic chiaroscuro lighting, detailed brushwork visible, Renaissance-inspired composition, museum quality portrait, old master technique",
    "dark-fantasy":  "dark fantasy illustration, epic dramatic lighting, medieval gothic aesthetic, detailed armor and weapons, mystical atmosphere, cinematic fantasy art, deep shadows and glowing highlights",
    "lego":          "LEGO minifigure 3D render style, plastic toy aesthetic, bright primary colors, simple round heads with printed faces, blocky proportions, studio lighting, LEGO brick world",
    "polaroid":      "vintage Polaroid photograph aesthetic, warm film grain, soft focus bokeh, nostalgic warm color grading, natural candid portrait photography, retro film camera look",
    "realistic":     "hyperrealistic cinematic photography, golden hour natural lighting, shallow depth of field, 8K detail, photojournalistic style, professional DSLR camera quality",
    "fantastic":     "fantastical digital art, surreal otherworldly environment, volumetric light rays, ethereal glowing atmosphere, epic scale, concept art quality, cinematic wide composition",
}


# ─── LLM helpers ────────────────────────────────────────────────────────────

def _call_openrouter(messages: list, max_tokens: int = 800, model: str | None = None) -> str:
    """Call OpenRouter with fallback across models."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    models_to_try = [model] if model else MODELS
    for m in models_to_try:
        try:
            payload = {
                "model": m,
                "messages": messages,
                "temperature": 0.8,
                "max_tokens": max_tokens,
            }
            r = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=40)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            print(f"[ScriptGen] model={m}")
            return content
        except Exception as e:
            print(f"[ScriptGen] {m} failed: {e}")
    raise RuntimeError("All models failed")


# ─── Stage 1: Web search ─────────────────────────────────────────────────────

def _maybe_search(topic: str) -> str:
    """
    Search via SerpAPI for real-world context if the topic is factual/news.
    Returns a brief research block or "" if not applicable / search fails.
    """
    # Ask the LLM: does this topic benefit from real facts?
    try:
        answer = _call_openrouter([
            {"role": "user", "content": f'Does this video topic require real-world facts, recent news, or historical accuracy to be credible? Topic: "{topic}"\nReply with ONLY: yes or no'}
        ], max_tokens=5, model=ENHANCE_MODEL).strip().lower()
    except Exception:
        return ""

    if not answer.startswith("yes"):
        return ""

    serpapi_key = os.environ.get("SERPAPI_KEY", "")
    if not serpapi_key:
        print("[ScriptGen] SERPAPI_KEY not set — skipping web search")
        return ""

    try:
        r = httpx.get(
            "https://serpapi.com/search.json",
            params={"q": topic, "api_key": serpapi_key, "num": 4, "hl": "en"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        snippets = []
        for result in data.get("organic_results", [])[:4]:
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            if title or snippet:
                snippets.append(f"- {title}: {snippet[:200]}")
        research = "\n".join(snippets)
        print(f"[ScriptGen] SerpAPI returned {len(snippets)} results for: {topic}")
        return research
    except Exception as e:
        print(f"[ScriptGen] SerpAPI search failed (non-fatal): {e}")
        return ""


# ─── Stage 2: Topic expansion → creative brief ───────────────────────────────

def _expand_topic(topic: str, script_type: str, research: str) -> str:
    """
    Expand a short user topic into a detailed creative brief.
    This locks in the subject so the script never drifts off-topic.
    """
    research_block = ""
    if research:
        research_block = f"\n\nRESEARCH CONTEXT (use these facts, don't invent):\n{research}"

    prompt = f"""You are a creative director for short-form video content.

A creator wants to make a {script_type} video about: "{topic}"{research_block}

Write a CREATIVE BRIEF (100-150 words) that includes:
1. The core story/subject — exactly what this video is about (do NOT change or drift from "{topic}")
2. Key characters, people, or figures involved — with brief context
3. The main visual opportunities — what scenes can be shown?
4. The emotional arc — what should the viewer feel?
5. One surprising or little-known angle that makes this compelling

Be specific. Do not be generic. This brief will guide the entire video script and every image generated.
Return ONLY the brief text, no headings, no JSON."""

    try:
        brief = _call_openrouter(
            [{"role": "user", "content": prompt}],
            max_tokens=300,
            model=ENHANCE_MODEL,
        ).strip()
        print(f"[ScriptGen] Creative brief: {brief[:120]}...")
        return brief
    except Exception as e:
        print(f"[ScriptGen] Brief expansion failed (non-fatal): {e}")
        return topic  # Fall back to raw topic — still better than nothing


# ─── Stage 3: Character / entity extraction ──────────────────────────────────

def _extract_entities(creative_brief: str) -> dict:
    """
    Extract named characters, gods, historical figures, or famous people from the
    creative brief and return their canonical visual descriptions.

    Example output:
    {
      "Hanuman": "An anthropomorphic deity with red-orange fur and a muscular build. Wears a dhoti
                  and carries a mace (gada). Has an elongated jaw, devoted eyes, and wears sacred
                  thread. Often depicted mid-leap or lifting mountains.",
      "Einstein": "Wild white dishevelled hair, thick white mustache. Deep-set dark eyes. Usually
                   wears a rumpled brown or grey suit with a tie. Older gentleman with a kind but
                   intense expression."
    }
    Returns {} if no named entities found.
    """
    prompt = f"""You are helping an AI image generator produce accurate visuals.

From this creative brief, identify ALL named characters, gods, mythological figures, historical persons, or famous people:

"{creative_brief}"

For EACH named entity, write 2-3 sentences describing their EXACT canonical visual appearance:
- Physical features (build, skin tone, face, hair)
- Clothing and accessories they are known for
- Any iconic items they carry or are associated with
- Visual style cues (for mythological figures: traditional iconography)

If a name is unknown to you, invent visually consistent fictional traits and note "(fictional)".
If no named entities exist, return an empty JSON object.

Return ONLY valid JSON:
{{"Name": "visual description", "Name2": "visual description"}}"""

    try:
        raw = _call_openrouter(
            [{"role": "user", "content": prompt}],
            max_tokens=400,
            model=ENHANCE_MODEL,
        ).strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = re.sub(r"```[a-z]*\n?", "", raw).strip()
        entities = json.loads(raw)
        if entities:
            print(f"[ScriptGen] Entities found: {list(entities.keys())}")
        return entities
    except Exception as e:
        print(f"[ScriptGen] Entity extraction failed (non-fatal): {e}")
        return {}


# ─── Stage 5: Per-scene image prompt ────────────────────────────────────────

def _build_image_prompt(scene_description: str, style: str, style_desc: str, entities: dict) -> str:
    """
    Build a detailed, character-accurate Flux image prompt.
    Injects canonical character descriptions so Flux knows exactly who/what to draw.
    """
    # Inject descriptions for any entity mentioned in this scene
    entity_context = ""
    for name, description in entities.items():
        if name.lower() in scene_description.lower():
            entity_context += f"\nCharacter — {name}: {description}"

    prompt = f"""You are an expert AI image prompt engineer for the Flux image model.

Scene to illustrate: "{scene_description}"
Art style: {style}{entity_context}

Write ONE detailed image generation prompt (under 90 words). Rules:
- Start with the most important visual element
- Describe the EXACT subject with specifics (not "a warrior" — use the character description above)
- Include: setting, lighting, mood, colors, camera angle
- Enforce VERTICAL PORTRAIT composition (9:16 tall) — subjects centered vertically
- End with: {style_desc}, vertical portrait, 9:16
- Return ONLY the prompt text, nothing else"""

    try:
        result = _call_openrouter(
            [{"role": "user", "content": prompt}],
            max_tokens=180,
        )
        return result.strip().strip('"').strip("'")
    except Exception as e:
        print(f"[ScriptGen] Image prompt failed: {e}")
        # Fallback: inject entity descriptions manually
        entity_str = " ".join(f"{n}: {d}" for n, d in entities.items() if n.lower() in scene_description.lower())
        return f"{scene_description}. {entity_str} {style_desc}, vertical portrait, 9:16"


# ─── Script type system prompts ─────────────────────────────────────────────

SCRIPT_TYPE_INSTRUCTIONS = {
    "story": """You are a master storyteller like MrBallen. Write a gripping NARRATIVE STORY.

FORMULA (Slow Escalation):
1. HOOK (Seg 1): Drop into the most dramatic moment. No intros. Start with danger, mystery, or shock.
2. CONTEXT (Seg 2): Rewind. Establish who, where, when with sensory detail.
3. RISING ACTION (Segs 3-4): Small oddities escalate. Short sentences build pace.
4. CLIMAX (Segs 4-5): Peak tension. Reveal the truth. Make it hit HARD.
5. AFTERMATH (Final): Chilling final thought or unresolved mystery.

TECHNIQUES: Open loops, sensory language, pattern interrupts, conversational tone.""",

    "facts": """You are a viral facts creator like Bright Side. Write a FACTS COUNTDOWN.

FORMULA (Surprise Cascade):
1. HOOK: Lead with the most mind-blowing fact. No generic intro.
2. FACT CHAIN: Each fact must top the previous. Use connectors: "But that's nothing compared to..."
3. COMPARISONS: Make numbers tangible ("fills 500 Olympic pools")
4. FINALE: Save the most shocking fact for last. End with a question.

TECHNIQUES: "WOW" moments, rhetorical questions, alternate amazing/terrifying facts.""",

    "explainer": """You are a brilliant explainer like Kurzgesagt. Write a CLEAR EXPLAINER.

FORMULA (Question-Driven):
1. HOOK: Counterintuitive question or claim that challenges assumptions.
2. FOUNDATION: Simplest explanation using ONE powerful metaphor.
3. THE TWIST: "But here's where it gets interesting..." — add the fascinating layer.
4. IMPLICATIONS: Why should the viewer personally care?
5. PERSPECTIVE SHIFT: End with a "whoa" realization, not a summary.

TECHNIQUES: Metaphors over jargon, "you" language, build from simple to complex.""",

    "listicle": """You are a master list creator like WatchMojo. Write a TOP LIST countdown.

FORMULA (Reverse Countdown):
1. HOOK: Announce the list with maximum intrigue — "and number 1 will disturb you."
2. ITEMS (least to most extreme): Each gets a mini-hook, the reveal, and a tease.
3. #1 ITEM: Give it extra weight. Biggest payoff.
4. OUTRO: Callback to the hook. End with engagement bait.

TECHNIQUES: Escalation every item, specific details, contrast items.""",

    "horror": """You are a horror narrator like Mr. Nightmare. Write HORROR narration.

FORMULA (Slow Dread):
1. COLD OPEN: Drop into the scariest moment. Then cut away. Leave it unresolved.
2. NORMALCY: Rewind. Establish hyper-specific sensory details. Everything is fine.
3. UNEASE: Subtle wrongness. Short sentences. "The dog hadn't barked in three days."
4. FALSE SCARE: Build to a scare — reveal it's nothing. Then the REAL horror hits 3x harder.
5. REAL HORROR: Short sentences. Pacing accelerates. Unleash the actual threat.
6. AFTERMATH: Leave something unexplained. End on dread, not relief.

TECHNIQUES: Sensory details, sentence length as fear dial, NEVER say "scary" — SHOW it.""",

    "motivation": """You are a motivational speaker combining Gary Vee and Stoic philosophy.

FORMULA (Pain → Reframe → Power):
1. HOOK: Hit the viewer's pain point. Second person. Present tense. Make them feel SEEN.
2. VALIDATION: Empathize first. "Most people feel exactly like you do."
3. REFRAME: One principle that changes everything. Use a specific historical story.
4. APPLICATION: Make it actionable. "Here's exactly what to do starting TONIGHT."
5. EMPOWERMENT: End in PRESENT TENSE. "You ARE becoming." Make them feel powerful NOW.

TECHNIQUES: "You" in every segment, validate before advising, specific real story as proof.""",
}


# ─── Main entry point ────────────────────────────────────────────────────────

def generate_script(
    topic: str,
    duration_seconds: int = 30,
    style: str = "ghibli",
    script_type: str = "story",
    variation_hint: str = "",
    language: str = "English",
) -> dict:
    """
    Full pipeline: web search → creative brief → entities → script → image prompts.
    Returns: {"title": str, "segments": [{"text": str, "duration": float, "image_prompt": str}]}
    """
    print(f"[ScriptGen] Starting: topic='{topic}' type={script_type} style={style} dur={duration_seconds}s")

    # Segment count based on duration
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

    # ── Stage 1: Web search ─────────────────────────────────────────────────
    research = _maybe_search(topic)

    # ── Stage 2: Expand topic to creative brief ─────────────────────────────
    creative_brief = _expand_topic(topic, script_type, research)

    # ── Stage 3: Extract entity descriptions ────────────────────────────────
    entities = _extract_entities(creative_brief)

    # ── Stage 4: Generate segmented script ──────────────────────────────────
    type_instruction = SCRIPT_TYPE_INSTRUCTIONS.get(script_type, SCRIPT_TYPE_INSTRUCTIONS["story"])

    variation_block = ""
    if variation_hint:
        variation_block = f"\nUNIQUENESS REQUIREMENT: {variation_hint}\nPick a completely different angle than any previous video on this topic.\n"

    lang_instruction = ""
    if language != "English":
        lang_instruction = f"\nLANGUAGE: Write ALL narration text in {language}. Entirely in {language}, fluent — not translated English.\n"

    segments_template = ", ".join(
        f'{{"text": "narration", "duration": {seg_dur}, "scene_description": "visual scene"}}'
        for _ in range(num_segments)
    )

    script_prompt = f"""You are a professional short-form video scriptwriter for viral faceless channels.

CREATIVE BRIEF (this is what the video is about — do NOT change the subject):
{creative_brief}

VIDEO FORMAT: {duration_seconds} seconds, {num_segments} segments of ~{seg_dur}s each
SCRIPT TYPE: {script_type.upper()}

{type_instruction}
{variation_block}{lang_instruction}

CRITICAL RULES:
1. The video MUST be specifically about: "{topic}" — no drifting to unrelated subjects
2. Exactly {num_segments} segments, each ~{seg_dur}s
3. Total ~{int(duration_seconds * 2.5)} words (2.5 words/second), punchy sentences, written for the EAR
4. NEVER open with "Hey everyone", "Welcome", or "In today's video"
5. First segment = irresistible hook with curiosity gap
6. Every 2-3 segments: pattern interrupt (tonal shift, rhetorical question, unexpected detail)
7. Use SENSORY language — what does it look/sound/smell/feel like?
8. End with something the viewer FEELS, not a summary

VISUAL SCENES — for EACH segment, write a scene_description:
- Describe the EXACT visual: subject (use character names from the brief), setting, mood
- Be specific — "Hanuman mid-leap above the Himalayas at dawn" not "a figure jumping"
- The scene must match what the narration is describing

Return ONLY valid JSON, no markdown:
{{"title": "catchy title max 8 words", "segments": [{segments_template}]}}"""

    content = _call_openrouter([
        {"role": "system", "content": "You write viral video scripts. Every sentence has a purpose: hook, build tension, deliver payoff. You never write generic content. You stay strictly on the given topic."},
        {"role": "user", "content": script_prompt},
    ], max_tokens=1800)

    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"```[a-z]*\n?", "", content).strip()
        content = content.rstrip("`").strip()

    script = json.loads(content)

    # ── Stage 5: Enhance scene descriptions → character-aware image prompts ─
    print(f"[ScriptGen] Building {len(script['segments'])} image prompts (entities: {list(entities.keys())})...")
    for i, seg in enumerate(script["segments"]):
        scene = seg.pop("scene_description", seg.get("image_prompt", ""))
        seg["image_prompt"] = _build_image_prompt(scene, style, style_desc, entities)
        print(f"  Prompt {i+1}: {seg['image_prompt'][:100]}...")

    print(f"[ScriptGen] Done: '{script['title']}' ({len(script['segments'])} segs)")
    for i, seg in enumerate(script["segments"]):
        print(f"  Seg {i+1} ({seg['duration']}s): {seg['text'][:80]}...")

    return script

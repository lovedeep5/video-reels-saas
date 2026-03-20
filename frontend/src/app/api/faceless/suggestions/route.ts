import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestions: [] });

  const { category, script_type } = await req.json();

  const prompt = `Generate 6 unique, specific, attention-grabbing video topic ideas for a short-form ${script_type || "story"} video in the "${category}" category.

Rules:
- Each topic should be specific and intriguing (not generic)
- Make them clickbait-worthy but honest
- Topics should work as standalone video scripts
- Return ONLY a JSON array of strings, no markdown, no explanation

Example format: ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6"]`;

  for (const model of MODELS) {
    try {
      const r = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.9, max_tokens: 300 }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      let content = data.choices?.[0]?.message?.content || "[]";
      content = content.trim();
      if (content.startsWith("```")) {
        content = content.split("\n").slice(1).join("\n").replace(/```$/, "").trim();
      }
      const suggestions = JSON.parse(content);
      if (Array.isArray(suggestions)) {
        return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
      }
    } catch { continue; }
  }

  return NextResponse.json({ suggestions: [] });
}

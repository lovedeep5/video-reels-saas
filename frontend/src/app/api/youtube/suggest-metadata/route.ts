import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript, video_title, clip_index, duration } = await req.json();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const prompt = `You are a YouTube Shorts expert. Generate optimized metadata for a short video clip.

Video title: ${video_title || "Unknown"}
Clip number: ${clip_index + 1}
Duration: ~${Math.round(duration || 30)}s
Transcript excerpt: ${transcript || "(no transcript)"}

Return ONLY valid JSON with this exact shape:
{
  "title": "catchy title under 70 chars",
  "description": "2-3 sentence description with relevant details",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response (model may wrap it in markdown)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    const meta = JSON.parse(match[0]);

    return NextResponse.json({
      title: String(meta.title ?? "").slice(0, 100),
      description: String(meta.description ?? "").slice(0, 5000),
      tags: (Array.isArray(meta.tags) ? meta.tags : []).map(String).slice(0, 15),
    });
  } catch (e) {
    console.error("[suggest-metadata] error:", e);
    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}

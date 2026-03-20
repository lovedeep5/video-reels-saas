import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jobsCol } from "@/lib/mongodb";
import { enqueueJob } from "@/lib/sqs";
import { getPlan, BILLABLE_STATUSES } from "@/lib/plans";

const VALID_STYLES = ["comic", "creepy-comic", "modern-cartoon", "disney", "ghibli", "anime", "painting", "dark-fantasy", "lego", "polaroid", "realistic", "fantastic"];
const VALID_VOICES = ["jack", "emma", "andrew", "aria", "ryan", "sonia"];
const VALID_SCRIPT_TYPES = ["story", "facts", "explainer", "listicle", "horror", "motivation"];
const VALID_DURATIONS = [10, 15, 30, 60];
const VALID_MUSIC = ["none", "upbeat-happy", "epic-cinematic", "dark-suspense", "emotional-piano", "chill-lounge", "motivation-rock", "fantasy-orchestra", "dark-cyberpunk", "nature-ambient", "groovy-trap", "energetic-action", "slow-motion"];
const VALID_TEXT_STYLES = ["bold-stroke", "red-highlight", "karaoke", "sleek", "beast", "elegant"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    topic,
    script_type = "story",
    style = "ghibli",
    voice = "andrew",
    duration = 30,
    music = "none",
    text_style = "bold-stroke",
    count = 1,
    auto_publish,
  } = body;

  // Validation
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return NextResponse.json({ error: "Topic must be at least 3 characters" }, { status: 400 });
  }
  if (!VALID_STYLES.includes(style)) {
    return NextResponse.json({ error: `Invalid style. Choose from: ${VALID_STYLES.join(", ")}` }, { status: 400 });
  }
  if (!VALID_VOICES.includes(voice)) {
    return NextResponse.json({ error: `Invalid voice. Choose from: ${VALID_VOICES.join(", ")}` }, { status: 400 });
  }
  if (!VALID_DURATIONS.includes(duration)) {
    return NextResponse.json({ error: `Invalid duration. Choose from: ${VALID_DURATIONS.join(", ")}` }, { status: 400 });
  }
  if (!VALID_MUSIC.includes(music)) {
    return NextResponse.json({ error: `Invalid music. Choose from: ${VALID_MUSIC.join(", ")}` }, { status: 400 });
  }
  if (!VALID_TEXT_STYLES.includes(text_style)) {
    return NextResponse.json({ error: `Invalid text style. Choose from: ${VALID_TEXT_STYLES.join(", ")}` }, { status: 400 });
  }

  const videoCount = Math.min(Math.max(1, Number(count) || 1), 5);

  // Plan limits — admins bypass
  const plan = getPlan(user.plan);
  if (!user.is_admin && plan.videos_per_month !== -1) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const jobs = await jobsCol();
    const used = await jobs.countDocuments({
      user_id: user._id,
      created_at: { $gte: startOfMonth },
      status: { $in: [...BILLABLE_STATUSES] },
    });

    if (used + videoCount > plan.videos_per_month) {
      return NextResponse.json(
        {
          error: `Monthly limit: ${used}/${plan.videos_per_month} used. Cannot create ${videoCount} more. Upgrade your plan.`,
        },
        { status: 403 }
      );
    }
  }

  // Create jobs (one per video requested)
  const jobs = await jobsCol();
  const jobIds: string[] = [];

  for (let i = 0; i < videoCount; i++) {
    // Build auto_publish_config if provided and plan allows it
    let autoPublishConfig: { platforms: { platform: "youtube" | "instagram"; channel_id: string }[]; visibility?: string } | undefined;
    if (auto_publish && Array.isArray(auto_publish.platforms) && auto_publish.platforms.length > 0) {
      const planData = getPlan(user.plan);
      if (user.is_admin || ("auto_publish" in planData && planData.auto_publish)) {
        const validPlatforms = auto_publish.platforms
          .filter((p: { platform: string }) => p.platform === "youtube" || p.platform === "instagram")
          .map((p: { platform: string; channel_id: string }) => ({
            platform: p.platform as "youtube" | "instagram",
            channel_id: p.channel_id,
          }));
        if (validPlatforms.length > 0) {
          autoPublishConfig = { platforms: validPlatforms, visibility: auto_publish.visibility };
        }
      }
    }

    const result = await jobs.insertOne({
      user_id: user._id!,
      status: "queued",
      source_type: "faceless",
      clips_requested: 1,
      output_ratio: "9:16",
      faceless_topic: topic.trim(),
      faceless_script_type: VALID_SCRIPT_TYPES.includes(script_type) ? script_type : "story",
      faceless_style: style,
      faceless_voice: voice,
      faceless_duration: duration,
      faceless_music: music,
      faceless_text_style: text_style,
      ...(autoPublishConfig ? { auto_publish_config: autoPublishConfig } : {}),
      progress: 0,
      progress_message: "Queued",
      retry_count: 0,
      created_at: new Date(),
    });

    const jobId = result.insertedId.toHexString();
    jobIds.push(jobId);
    await enqueueJob(jobId);
  }

  return NextResponse.json(
    {
      job_ids: jobIds,
      message: `${videoCount} faceless video${videoCount > 1 ? "s" : ""} queued`,
    },
    { status: 201 }
  );
}

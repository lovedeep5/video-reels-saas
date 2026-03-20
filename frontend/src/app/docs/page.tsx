"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Code block with copy button ───────────────────────────────────────────────

function Code({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-700 my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-500 font-mono uppercase tracking-wide">{lang}</span>
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <><span className="text-green-400">✓</span> Copied</>
          ) : (
            <><span>⧉</span> Copy</>
          )}
        </button>
      </div>
      <pre className="bg-gray-950 p-5 overflow-x-auto text-sm font-mono leading-relaxed text-gray-200 whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

// ── Method badge ──────────────────────────────────────────────────────────────

function Method({ m }: { m: "GET" | "POST" | "DELETE" }) {
  const colors = {
    GET: "bg-blue-900/60 text-blue-300 border-blue-800",
    POST: "bg-green-900/60 text-green-300 border-green-800",
    DELETE: "bg-red-900/60 text-red-300 border-red-800",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border font-mono ${colors[m]}`}>
      {m}
    </span>
  );
}

// ── Param table ───────────────────────────────────────────────────────────────

function ParamRow({
  name, type, required, desc,
}: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="py-2.5 pr-4 align-top">
        <code className="text-sm text-indigo-300 font-mono">{name}</code>
        {required && <span className="ml-1.5 text-xs text-red-400">required</span>}
      </td>
      <td className="py-2.5 pr-4 align-top">
        <code className="text-xs text-gray-500 font-mono">{type}</code>
      </td>
      <td className="py-2.5 text-sm text-gray-400 leading-relaxed">{desc}</td>
    </tr>
  );
}

function ParamTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-2 pr-4 font-medium">Parameter</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-white mb-4 mt-2 pb-3 border-b border-gray-800">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-white mb-3 mt-6">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 leading-relaxed mb-3">{children}</p>;
}

function Callout({ type = "info", children }: { type?: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-950/40 border-blue-800 text-blue-200",
    warn: "bg-yellow-950/40 border-yellow-800 text-yellow-200",
    tip:  "bg-green-950/40 border-green-800 text-green-200",
  };
  const icons = { info: "ℹ", warn: "⚠", tip: "✓" };
  return (
    <div className={`flex gap-3 border rounded-lg px-4 py-3 my-4 text-sm leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 font-bold">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview",      label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "quickstart",   label: "Quickstart" },
  {
    label: "Endpoints",
    children: [
      { id: "submit-faceless", label: "Create Faceless Video" },
      { id: "list-jobs",      label: "List Jobs" },
      { id: "get-job",        label: "Get Job" },
      { id: "download-clip",  label: "Download Clip" },
      { id: "retry-job",      label: "Retry Job" },
      { id: "check-usage",    label: "Check Usage" },
      { id: "schedule",       label: "Schedule Publish" },
      { id: "automations",    label: "Automations" },
    ],
  },
  { id: "job-statuses",  label: "Job Statuses" },
  { id: "error-codes",   label: "Errors" },
  { id: "rate-limits",   label: "Plan Limits" },
];

function Sidebar({ active }: { active: string }) {
  return (
    <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-0.5">
      {NAV.map((item) =>
        "children" in item ? (
          <div key={item.label}>
            <span className="block text-xs text-gray-500 uppercase tracking-widest font-semibold px-3 py-2 mt-4">
              {item.label}
            </span>
            {(item.children ?? []).map((child) => (
              <a
                key={child.id}
                href={`#${child.id}`}
                className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  active === child.id
                    ? "text-white bg-indigo-600/20 border-l-2 border-indigo-500"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {child.label}
              </a>
            ))}
          </div>
        ) : (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${
              active === item.id
                ? "text-white bg-indigo-600/20 border-l-2 border-indigo-500"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {item.label}
          </a>
        )
      )}
    </nav>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  // Track active section with IntersectionObserver
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
              VidToReels
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-sm text-gray-300 font-medium">API Documentation</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/keys" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Get API Key →
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-12">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 hidden lg:block">
          <Sidebar active={active} />
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* ── Overview ─────────────────────────────────────────── */}
          <Section id="overview">
            <H2>Overview</H2>
            <P>
              The VidToReels API lets you submit YouTube videos for clip extraction, create AI faceless videos from a topic,
              monitor job status, and download the results — all programmatically.
              Use it to integrate AI video generation into your own apps, automation workflows (n8n, Zapier, Make), or scripts.
            </P>
            <div className="grid sm:grid-cols-2 gap-4 my-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Base URL</div>
                <code className="text-sm text-indigo-300 font-mono">https://vidtoreels.com/api</code>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">Response format</div>
                <code className="text-sm text-indigo-300 font-mono">JSON</code>
              </div>
            </div>
          </Section>

          {/* ── Authentication ───────────────────────────────────── */}
          <Section id="authentication">
            <H2>Authentication</H2>
            <P>
              All API requests must include your API key. Keys are prefixed with{" "}
              <code className="text-indigo-300 font-mono text-sm">vr_live_</code>.
              Pass it in either header:
            </P>
            <Code lang="bash">{`
# Option 1 — X-API-Key header (recommended)
X-API-Key: vr_live_xxxxxxxxxxxxxxxxxxxxxxxx

# Option 2 — Bearer token
Authorization: Bearer vr_live_xxxxxxxxxxxxxxxxxxxxxxxx
            `}</Code>

            <H3>Getting your API key</H3>
            <P>
              1. Sign in to your{" "}
              <Link href="/dashboard" className="text-indigo-400 hover:underline">dashboard</Link>
              .<br />
              2. Click <strong className="text-white">API Keys</strong> in the left sidebar.<br />
              3. Click <strong className="text-white">Create key</strong>, give it a name and optional expiry.<br />
              4. Copy the key — it is only shown once.
            </P>
            <Callout type="warn">
              Keep your API key secret. Never commit it to source control or expose it in client-side code.
              If compromised, revoke it from the dashboard immediately.
            </Callout>
          </Section>

          {/* ── Quickstart ───────────────────────────────────────── */}
          <Section id="quickstart">
            <H2>Quickstart</H2>
            <P>
              Create an AI faceless video, poll until it is done, then download the result.
            </P>

            <H3>1 — Create a video</H3>
            <Code lang="bash">{`
curl -X POST https://vidtoreels.com/api/faceless/submit \\
  -H "X-API-Key: vr_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "5 terrifying facts about the deep ocean",
    "script_type": "horror",
    "style": "dark-fantasy",
    "voice": "emma",
    "duration": 30,
    "music": "dark-suspense"
  }'
            `}</Code>
            <Code lang="json">{`
{
  "job_ids": ["6641a2f3c4e1b90012345678"],
  "message": "1 faceless video queued"
}
            `}</Code>

            <H3>2 — Poll until completed</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs/6641a2f3c4e1b90012345678 \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>
            <P>
              Repeat every 15 seconds until <code className="text-indigo-300 font-mono text-sm">status</code> is{" "}
              <code className="text-green-400 font-mono text-sm">&quot;completed&quot;</code> or{" "}
              <code className="text-red-400 font-mono text-sm">&quot;failed&quot;</code>.
            </P>

            <H3>3 — Download the video</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs/6641a2f3c4e1b90012345678/clips/0/download \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>
            <Code lang="json">{`
{
  "url": "https://vidtoreel-bucket.s3.ap-south-1.amazonaws.com/users/.../clip_1.mp4?..."
}
            `}</Code>

            <H3>Full example in Python</H3>
            <Code lang="python">{`
import time, requests

API_KEY = "vr_live_xxxxxxxx"
BASE    = "https://vidtoreels.com/api"
headers = {"X-API-Key": API_KEY}

# 1. Create video
resp = requests.post(f"{BASE}/faceless/submit", headers=headers, json={
    "topic": "The mystery of the Bermuda Triangle",
    "script_type": "story",
    "style": "dark-fantasy",
    "voice": "andrew",
    "duration": 30,
    "music": "epic-cinematic",
})
job_id = resp.json()["job_ids"][0]
print(f"Job created: {job_id}")

# 2. Poll
while True:
    job = requests.get(f"{BASE}/jobs/{job_id}", headers=headers).json()
    print(f"  {job['status']} — {job['progress']}%")
    if job["status"] in ("completed", "failed"):
        break
    time.sleep(15)

# 3. Download
if job["status"] == "completed":
    dl = requests.get(f"{BASE}/jobs/{job_id}/clips/0/download", headers=headers).json()
    open("video.mp4", "wb").write(requests.get(dl["url"]).content)
    print("Saved video.mp4")
            `}</Code>
          </Section>

          {/* ── ENDPOINTS ────────────────────────────────────────── */}

          {/* Create Faceless Video */}
          <Section id="submit-faceless">
            <H2>Create Faceless Video</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="POST" />
              <code className="text-sm font-mono text-gray-200">/api/faceless/submit</code>
            </div>
            <P>
              Generate an AI-powered faceless video from scratch. Provide a topic and the AI writes a script,
              generates images, adds voiceover and background music, and assembles a complete vertical video.
            </P>

            <H3>Request body</H3>
            <ParamTable>
              <ParamRow name="topic" type="string" required desc="The topic or story for the video. At least 3 characters. e.g. &quot;5 amazing facts about black holes&quot;" />
              <ParamRow name="script_type" type="string" desc={`Script format. One of: "story" (default), "facts", "explainer", "listicle", "horror", "motivation".`} />
              <ParamRow name="style" type="string" desc={`Visual style. One of: "creepy-comic" (default), "comic", "modern-cartoon", "disney", "ghibli", "anime", "painting", "dark-fantasy", "lego", "polaroid", "realistic", "fantastic".`} />
              <ParamRow name="voice" type="string" desc={`Narrator voice. One of: "andrew" (default), "jack", "emma", "aria", "ryan", "sonia".`} />
              <ParamRow name="duration" type="integer" desc="Target video duration in seconds. One of: 10, 15, 30 (default), 60." />
              <ParamRow name="music" type="string" desc={`Background music. One of: "none" (default), "upbeat-happy", "epic-cinematic", "dark-suspense", "emotional-piano", "chill-lounge", "motivation-rock", "fantasy-orchestra", "dark-cyberpunk", "nature-ambient", "groovy-trap", "energetic-action", "slow-motion".`} />
              <ParamRow name="auto_publish" type="object" desc={`Optional. Auto-post when video is ready. Format: { "platforms": [{"platform": "youtube", "channel_id": "..."}], "visibility": "public" }`} />
            </ParamTable>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl -X POST https://vidtoreels.com/api/faceless/submit \\
  -H "X-API-Key: vr_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "5 terrifying deep sea creatures",
    "style": "realistic",
    "voice": "emma",
    "duration": 30,
    "music": "suspenseful"
  }'
            `}</Code>

            <H3>Response</H3>
            <Code lang="json">{`
{
  "job_ids": ["6641a2f3c4e1b90012345678"],
  "message": "1 faceless video queued"
}
            `}</Code>

            <Callout type="tip">
              Faceless videos appear in the same job list as YouTube clips. Use the{" "}
              <a href="#get-job" className="underline">Get Job</a> endpoint to poll for completion,
              then <a href="#download-clip" className="underline">Download Clip</a> (clip index 0) to get the video.
            </Callout>

            <H3>Full example in Python</H3>
            <Code lang="python">{`
import time, requests

API_KEY = "vr_live_xxxxxxxx"
BASE    = "https://vidtoreels.com/api"
headers = {"X-API-Key": API_KEY}

# 1. Create faceless video
resp = requests.post(f"{BASE}/faceless/submit", headers=headers, json={
    "topic": "The mystery of the Bermuda Triangle",
    "style": "cinematic",
    "voice": "andrew",
    "duration": 60,
    "music": "mysterious",
})
job_id = resp.json()["job_ids"][0]
print(f"Job created: {job_id}")

# 2. Poll until done
while True:
    job = requests.get(f"{BASE}/jobs/{job_id}", headers=headers).json()
    print(f"  {job['status']} — {job['progress']}%")
    if job["status"] in ("completed", "failed"):
        break
    time.sleep(15)

# 3. Download the video
if job["status"] == "completed":
    dl = requests.get(f"{BASE}/jobs/{job_id}/clips/0/download", headers=headers).json()
    data = requests.get(dl["url"]).content
    open("faceless_video.mp4", "wb").write(data)
    print("Saved faceless_video.mp4")
            `}</Code>
          </Section>

          {/* List Jobs */}
          <Section id="list-jobs">
            <H2>List Jobs</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="GET" />
              <code className="text-sm font-mono text-gray-200">/api/jobs</code>
            </div>
            <P>Returns your 50 most recent jobs, sorted by creation date (newest first).</P>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>

            <H3>Response</H3>
            <Code lang="json">{`
[
  {
    "id": "6641a2f3c4e1b90012345678",
    "status": "completed",
    "progress": 100,
    "progress_message": "Done",
    "source_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "video_title": "Never Gonna Give You Up",
    "video_duration": 213,
    "clips_requested": 5,
    "output_ratio": "9:16",
    "created_at": "2024-05-13T10:22:11.000Z",
    "completed_at": "2024-05-13T10:27:44.000Z",
    "clips": [
      {
        "id": 0,
        "clip_index": 0,
        "duration": 38.4,
        "start_time": 12.0,
        "end_time": 50.4,
        "importance_score": 0.92,
        "transcript_excerpt": "never gonna give you up never gonna let you down..."
      }
    ]
  }
]
            `}</Code>
          </Section>

          {/* Get Job */}
          <Section id="get-job">
            <H2>Get Job</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="GET" />
              <code className="text-sm font-mono text-gray-200">/api/jobs/{"{job_id}"}</code>
            </div>
            <P>
              Fetch the current status and result of a single job. Poll this endpoint every
              10–15 seconds until <code className="text-indigo-300 font-mono text-sm">status</code> is{" "}
              <code className="text-green-400 font-mono text-sm">"completed"</code> or{" "}
              <code className="text-red-400 font-mono text-sm">"failed"</code>.
            </P>

            <H3>Path parameters</H3>
            <ParamTable>
              <ParamRow name="job_id" type="string" required desc="The job ID returned from the Submit Job endpoint." />
            </ParamTable>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs/6641a2f3c4e1b90012345678 \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>

            <H3>Response — in progress</H3>
            <Code lang="json">{`
{
  "id": "6641a2f3c4e1b90012345678",
  "status": "processing",
  "progress": 45,
  "progress_message": "Selecting best clips...",
  "video_title": "Never Gonna Give You Up",
  "video_duration": 213,
  "clips": []
}
            `}</Code>

            <H3>Response — completed</H3>
            <Code lang="json">{`
{
  "id": "6641a2f3c4e1b90012345678",
  "status": "completed",
  "progress": 100,
  "progress_message": "Done",
  "video_title": "Never Gonna Give You Up",
  "video_duration": 213,
  "clips_requested": 5,
  "output_ratio": "9:16",
  "created_at": "2024-05-13T10:22:11.000Z",
  "completed_at": "2024-05-13T10:27:44.000Z",
  "clips": [
    {
      "id": 0,
      "clip_index": 0,
      "duration": 38.4,
      "start_time": 12.0,
      "end_time": 50.4,
      "importance_score": 0.92,
      "transcript_excerpt": "never gonna give you up..."
    },
    {
      "id": 1,
      "clip_index": 1,
      "duration": 32.1,
      "start_time": 88.5,
      "end_time": 120.6,
      "importance_score": 0.85,
      "transcript_excerpt": "inside we both know what's been going on..."
    }
  ]
}
            `}</Code>

            <H3>Response — failed</H3>
            <Code lang="json">{`
{
  "id": "6641a2f3c4e1b90012345678",
  "status": "failed",
  "progress": 0,
  "error_message": "YouTube blocked this download. Sync your YouTube cookies using the Chrome extension on a desktop browser, then retry.",
  "error_type": "cookie_required",
  "clips": []
}
            `}</Code>
          </Section>

          {/* Download Clip */}
          <Section id="download-clip">
            <H2>Download Clip</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="GET" />
              <code className="text-sm font-mono text-gray-200">/api/jobs/{"{job_id}"}/clips/{"{clip_index}"}/download</code>
            </div>
            <P>
              Get a pre-signed S3 URL for downloading a specific clip. The URL is valid for
              <strong className="text-white"> 1 hour</strong> and can be fetched with any HTTP client
              — no authentication required on the S3 URL itself.
            </P>

            <H3>Path parameters</H3>
            <ParamTable>
              <ParamRow name="job_id" type="string" required desc="The job ID." />
              <ParamRow name="clip_index" type="integer" required desc="Zero-based clip index (0 = first clip, 1 = second, etc.). Use the clip_index field from the job response." />
            </ParamTable>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs/6641a2f3c4e1b90012345678/clips/0/download \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>

            <H3>Response</H3>
            <Code lang="json">{`
{
  "url": "https://vidtoreel-bucket.s3.ap-south-1.amazonaws.com/users/xxx/jobs/yyy/clip_0.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&..."
}
            `}</Code>

            <H3>Download the file</H3>
            <Code lang="bash">{`
# One-liner: get URL then download
URL=$(curl -s https://vidtoreels.com/api/jobs/JOB_ID/clips/0/download \\
  -H "X-API-Key: vr_live_xxxxxxxx" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -o clip_1.mp4 "$URL"
            `}</Code>

            <Callout type="tip">
              The clip is only available after the job <code className="font-mono">status === "completed"</code>.
              Calling this endpoint on an in-progress or failed job will return a 404.
            </Callout>
          </Section>

          {/* Retry Job */}
          <Section id="retry-job">
            <H2>Retry Job</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="POST" />
              <code className="text-sm font-mono text-gray-200">/api/jobs/{"{job_id}"}/retry</code>
            </div>
            <P>
              Re-queue a failed job with the same settings. A new job is created (new ID),
              the old job is removed, and the new job enters the queue immediately.
            </P>
            <Callout type="info">
              Retrying a job creates a fresh job and uses a credit from your monthly limit.
            </Callout>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl -X POST https://vidtoreels.com/api/jobs/6641a2f3c4e1b90012345678/retry \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>

            <H3>Response</H3>
            <Code lang="json">{`
{
  "message": "Retrying as new job",
  "new_job_id": "6641b3a4d5f2c10023456789"
}
            `}</Code>
          </Section>

          {/* Check Usage */}
          <Section id="check-usage">
            <H2>Check Usage</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="GET" />
              <code className="text-sm font-mono text-gray-200">/api/jobs/usage</code>
            </div>
            <P>Returns your usage for the current calendar month.</P>

            <H3>Example request</H3>
            <Code lang="bash">{`
curl https://vidtoreels.com/api/jobs/usage \\
  -H "X-API-Key: vr_live_xxxxxxxx"
            `}</Code>

            <H3>Response</H3>
            <Code lang="json">{`
{
  "videos_used": 7,
  "videos_limit": 20,
  "clips_per_video": 10,
  "plan": "pro"
}
            `}</Code>
            <P>
              <code className="text-indigo-300 font-mono text-sm">videos_limit: -1</code> means
              unlimited (Business plan).
            </P>
          </Section>

          {/* Schedule Publish */}
          <Section id="schedule">
            <H2>Schedule Publish</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="POST" />
              <code className="text-sm font-mono text-gray-200">/api/schedule</code>
            </div>
            <P>
              Schedule a completed video to be published to YouTube or Instagram at a specific time.
              Requires Creator, Pro, or Business plan.
            </P>

            <H3>Request body</H3>
            <ParamTable>
              <ParamRow name="job_id" type="string" required desc="ID of a completed job." />
              <ParamRow name="clip_index" type="integer" required desc="Zero-based clip index (usually 0 for faceless videos)." />
              <ParamRow name="platform" type="string" required desc={`"youtube" or "instagram".`} />
              <ParamRow name="channel_id" type="string" required desc="ID of a connected channel from your settings." />
              <ParamRow name="scheduled_at" type="string" required desc="ISO 8601 datetime for when to publish. Must be at least 1 minute in the future." />
              <ParamRow name="title" type="string" desc="Video title (YouTube) or caption (Instagram)." />
              <ParamRow name="description" type="string" desc="YouTube description." />
              <ParamRow name="tags" type="string[]" desc="YouTube tags array." />
              <ParamRow name="visibility" type="string" desc={`YouTube visibility: "public" (default), "unlisted", or "private".`} />
            </ParamTable>

            <H3>Example</H3>
            <Code lang="bash">{`
curl -X POST https://vidtoreels.com/api/schedule \\
  -H "X-API-Key: vr_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "6641a2f3c4e1b90012345678",
    "clip_index": 0,
    "platform": "youtube",
    "channel_id": "ch_abc123",
    "scheduled_at": "2026-03-22T14:00:00Z",
    "title": "5 Terrifying Deep Sea Facts",
    "visibility": "public"
  }'
            `}</Code>

            <H3>List scheduled publishes</H3>
            <div className="flex items-center gap-3 mb-3">
              <Method m="GET" />
              <code className="text-sm font-mono text-gray-200">/api/schedule</code>
            </div>
            <P>Returns all your scheduled publishes. Filter with <code className="text-indigo-300 font-mono text-sm">?status=scheduled</code> or <code className="text-indigo-300 font-mono text-sm">?platform=youtube</code>.</P>

            <H3>Cancel a scheduled publish</H3>
            <div className="flex items-center gap-3 mb-3">
              <Method m="DELETE" />
              <code className="text-sm font-mono text-gray-200">/api/schedule/{"{id}"}</code>
            </div>
            <P>Cancels a scheduled publish (only if status is still &quot;scheduled&quot;).</P>
          </Section>

          {/* Automations */}
          <Section id="automations">
            <H2>Automations</H2>
            <div className="flex items-center gap-3 mb-4">
              <Method m="POST" />
              <code className="text-sm font-mono text-gray-200">/api/automations</code>
            </div>
            <P>
              Create a daily recurring automation. The system generates a unique video every day at your
              chosen time and auto-publishes to your channels. Requires Pro or Business plan.
            </P>

            <H3>Request body</H3>
            <ParamTable>
              <ParamRow name="name" type="string" required desc="Display name for this automation." />
              <ParamRow name="topics" type="string[]" required desc="Array of topics. System rotates through them daily with unique angles." />
              <ParamRow name="script_type" type="string" desc={`Script format: "story", "facts", "horror", etc.`} />
              <ParamRow name="style" type="string" desc="Visual style (same options as Create Faceless Video)." />
              <ParamRow name="voice" type="string" desc="Narrator voice." />
              <ParamRow name="music" type="string" desc="Background music track." />
              <ParamRow name="duration" type="integer" desc="Video duration in seconds." />
              <ParamRow name="post_hour" type="integer" required desc="Hour (0-23 UTC) to publish each day." />
              <ParamRow name="platforms" type="array" required desc={`Publishing targets. e.g. [{"platform": "youtube", "channel_id": "..."}]`} />
              <ParamRow name="visibility" type="string" desc={`YouTube visibility. Default: "public".`} />
            </ParamTable>

            <H3>Example</H3>
            <Code lang="bash">{`
curl -X POST https://vidtoreels.com/api/automations \\
  -H "X-API-Key: vr_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Daily Horror",
    "topics": ["Deep ocean terrors", "Haunted places"],
    "script_type": "horror",
    "style": "creepy-comic",
    "voice": "emma",
    "duration": 30,
    "music": "dark-suspense",
    "post_hour": 14,
    "platforms": [{"platform": "youtube", "channel_id": "ch_abc123"}],
    "visibility": "public"
  }'
            `}</Code>

            <H3>Other automation endpoints</H3>
            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-3"><Method m="GET" /><code className="text-sm font-mono text-gray-200">/api/automations</code><span className="text-sm text-gray-400">— List all automations</span></div>
              <div className="flex items-center gap-3"><Method m="GET" /><code className="text-sm font-mono text-gray-200">/api/automations/{"{id}"}</code><span className="text-sm text-gray-400">— Get detail + recent runs</span></div>
              <div className="flex items-center gap-3"><Method m="POST" /><code className="text-sm font-mono text-gray-200">PATCH /api/automations/{"{id}"}</code><span className="text-sm text-gray-400">— Update or pause/resume</span></div>
              <div className="flex items-center gap-3"><Method m="DELETE" /><code className="text-sm font-mono text-gray-200">/api/automations/{"{id}"}</code><span className="text-sm text-gray-400">— Delete automation</span></div>
            </div>
          </Section>

          {/* Job Statuses */}
          <Section id="job-statuses">
            <H2>Job Statuses</H2>
            <P>A job progresses through these statuses in order:</P>
            <div className="space-y-2">
              {[
                { status: "queued",      color: "text-yellow-300", desc: "Job created, waiting for a worker to pick it up (~1–3 min)." },
                { status: "starting",    color: "text-yellow-300", desc: "EC2 worker is being launched." },
                { status: "downloading", color: "text-blue-300",   desc: "Downloading the video from the URL." },
                { status: "processing",  color: "text-blue-300",   desc: "Transcribing, scoring clips with AI, selecting best moments." },
                { status: "rendering",   color: "text-purple-300", desc: "FFmpeg is rendering and cropping each clip." },
                { status: "completed",   color: "text-green-300",  desc: "All clips are ready to download." },
                { status: "failed",      color: "text-red-300",    desc: "Job failed. Check error_message for the reason. Retryable." },
              ].map(({ status, color, desc }) => (
                <div key={status} className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <code className={`text-sm font-mono font-bold shrink-0 ${color}`}>{status}</code>
                  <span className="text-sm text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
            <Callout type="info">
              Typical end-to-end time is <strong className="text-white">4–8 minutes</strong> for a
              1-hour video: ~1 min EC2 startup + ~2 min download + ~2 min transcription + ~1 min rendering.
            </Callout>
          </Section>

          {/* Error Codes */}
          <Section id="error-codes">
            <H2>Errors</H2>
            <P>
              All errors return a JSON body with an <code className="text-indigo-300 font-mono text-sm">error</code> field
              and an appropriate HTTP status code.
            </P>
            <Code lang="json">{`
{
  "error": "Monthly video limit reached (20/20). Upgrade your plan."
}
            `}</Code>

            <div className="space-y-2 mt-4">
              {[
                { code: "401", status: "Unauthorized",  desc: "Missing or invalid API key." },
                { code: "400", status: "Bad Request",   desc: "Missing required field (e.g. url) or invalid job ID format." },
                { code: "403", status: "Forbidden",     desc: "Monthly video limit reached for your plan." },
                { code: "404", status: "Not Found",     desc: "Job or clip not found (or doesn't belong to your account)." },
                { code: "500", status: "Server Error",  desc: "Unexpected server error. Contact support if it persists." },
              ].map(({ code, status, desc }) => (
                <div key={code} className="flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <code className="text-sm font-mono font-bold text-red-400 shrink-0 w-8">{code}</code>
                  <span className="text-sm text-gray-300 font-medium shrink-0 w-32">{status}</span>
                  <span className="text-sm text-gray-400">{desc}</span>
                </div>
              ))}
            </div>

            <H3>YouTube download errors</H3>
            <P>
              If a job fails with <code className="text-indigo-300 font-mono text-sm">error_type: "cookie_required"</code>,
              YouTube is blocking the download. Fix: install the VidToReels Chrome extension, sync your
              YouTube cookies, then retry the job.
            </P>
          </Section>

          {/* Plan Limits */}
          <Section id="rate-limits">
            <H2>Plan Limits</H2>
            <P>Limits are enforced per account, not per API key.</P>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-800 rounded-xl overflow-hidden">
                <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Videos / month</th>
                    <th className="text-left px-4 py-3">Max duration</th>
                    <th className="text-left px-4 py-3">Scheduling</th>
                    <th className="text-left px-4 py-3">Automations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr className="bg-gray-950">
                    <td className="px-4 py-3 font-medium text-gray-300">Starter (Free)</td>
                    <td className="px-4 py-3 text-gray-400">2</td>
                    <td className="px-4 py-3 text-gray-400">30s</td>
                    <td className="px-4 py-3 text-gray-500">—</td>
                    <td className="px-4 py-3 text-gray-500">—</td>
                  </tr>
                  <tr className="bg-gray-950">
                    <td className="px-4 py-3 font-medium text-cyan-300">Creator</td>
                    <td className="px-4 py-3 text-gray-400">15</td>
                    <td className="px-4 py-3 text-gray-400">3 min</td>
                    <td className="px-4 py-3 text-green-400">Yes</td>
                    <td className="px-4 py-3 text-gray-500">—</td>
                  </tr>
                  <tr className="bg-gray-950">
                    <td className="px-4 py-3 font-medium text-blue-300">Pro</td>
                    <td className="px-4 py-3 text-gray-400">50</td>
                    <td className="px-4 py-3 text-gray-400">10 min</td>
                    <td className="px-4 py-3 text-green-400">Yes</td>
                    <td className="px-4 py-3 text-green-400">Yes</td>
                  </tr>
                  <tr className="bg-gray-950">
                    <td className="px-4 py-3 font-medium text-purple-300">Business</td>
                    <td className="px-4 py-3 text-gray-400">Unlimited</td>
                    <td className="px-4 py-3 text-gray-400">60 min</td>
                    <td className="px-4 py-3 text-green-400">Yes</td>
                    <td className="px-4 py-3 text-green-400">Yes</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Callout type="tip">
              Upgrade your plan at{" "}
              <Link href="/billing" className="underline text-green-300">vidtoreels.com/billing</Link>.
              Usage resets on the 1st of each calendar month.
            </Callout>
          </Section>

          {/* Footer */}
          <div className="border-t border-gray-800 pt-8 mt-8 text-center">
            <p className="text-gray-500 text-sm mb-4">
              Questions? Issues? Email us or open an issue on GitHub.
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link href="/" className="text-gray-500 hover:text-white transition-colors">Home</Link>
              <Link href="/dashboard" className="text-gray-500 hover:text-white transition-colors">Dashboard</Link>
              <Link href="/billing" className="text-gray-500 hover:text-white transition-colors">Pricing</Link>
              <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

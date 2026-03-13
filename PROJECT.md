# VidToReels — Project Overview

**Live**: https://vidtoreels.com
**Repo**: https://github.com/lovedeep5/video-reels-saas

Two core features:
1. **YouTube to Clips** — Paste a YouTube URL, AI picks the best moments, renders vertical clips
2. **AI Faceless Videos** — Type a topic, AI writes script, generates images, adds voiceover + music

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend + API | Next.js 16 (TypeScript) on Vercel | `frontend/` |
| Auth | Clerk (JWT) + API keys (`vr_live_*`) | |
| Database | MongoDB Atlas | `vidtoreels` db |
| Job Queue | AWS SQS → Lambda → EC2 Spot | t3.small workers |
| AI/LLM | OpenRouter API | Free models with fallback |
| Image Gen | Stable Horde (free SDXL) | Community GPUs |
| TTS | Edge-TTS (free Microsoft) | 6 voices |
| Storage | AWS S3 (`vidtoreel-bucket`) | |
| Payments | Razorpay | INR pricing |
| IaC | Terraform (state in S3) | CI via GitHub Actions |
| DNS/CDN | Cloudflare → Vercel | |

---

## Architecture

```
User → vidtoreels.com (Cloudflare → Vercel)
          ↓
     Next.js API routes (Clerk auth, MongoDB, SQS)
          ↓
     AWS SQS queue
          ↓
     Lambda dispatcher (starts EC2 Spot per job, max 10 concurrent)
          ↓
     EC2 Spot t3.small (clones repo, installs deps, runs pipeline)
          ↓
     S3 clips → user downloads / publishes to YouTube / Instagram
```

Recovery Lambda runs every 30min — finds stuck jobs, re-queues up to 3 times.

---

## Feature 1: YouTube to Clips

### Pipeline (runs on EC2)
```
1. Download video         → yt-dlp (iOS player_client to bypass bot detection)
2. Transcribe audio       → faster-whisper (tiny model, runs locally)
3. AI selects best clips  → OpenRouter LLM (Llama 3.3 70B free)
4. Generate YT metadata   → OpenRouter LLM (title, description, tags per clip)
5. Render vertical clips  → ffmpeg (face-tracking crop via OpenCV)
6. Upload to S3           → boto3
```

### AI Models
| Step | Model | Provider | Cost |
|---|---|---|---|
| Clip selection | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter | Free |
| YouTube metadata | `openrouter/free` | OpenRouter | Free |
| Fallback scoring | Audio energy (scipy peak detection) | Local | Free |

### Output Formats
- 9:16 (1080x1920) — vertical, default
- 1:1 (1080x1080) — square
- 4:5 (1080x1350) — Instagram feed
- 16:9 (1920x1080) — landscape

### Optional: Burned-in Subtitles
- Whisper transcription → ASS subtitle file → ffmpeg burns into clip
- Auto-translates non-English audio to English

---

## Feature 2: AI Faceless Videos

### Pipeline (runs on EC2)
```
1. Script Generation      → OpenRouter LLM (Gemini Flash Lite → fallback chain)
2. Text-to-Speech         → Edge-TTS (free Microsoft Azure voices)
3. AI Image Generation    → Stable Horde SDXL (free community GPUs)
4. Video Assembly         → MoviePy (Ken Burns zoom + crossfade + text overlay)
5. YouTube metadata       → OpenRouter LLM (same as regular clips)
6. Upload to S3           → boto3
```

### Step 1: Script Generation
- **Model fallback chain** (all via OpenRouter):
  1. `google/gemini-2.5-flash-lite` (free)
  2. `google/gemini-2.5-flash` (free)
  3. `deepseek/deepseek-v3.2` (free)
  4. `openai/gpt-4o-mini` (paid, last resort)
- **Output**: JSON → `{ title, segments: [{ text, duration, image_prompt }] }`
- **Style injection**: Each visual style (ghibli, anime, cartoon, comic, realistic, watercolor) has a prompt suffix appended to every image prompt

### Step 2: Text-to-Speech
- **Engine**: Edge-TTS — free, no API key, uses Microsoft Azure voices
- **6 Voices**:
  | Name | Voice ID | Accent |
  |---|---|---|
  | Jack | en-US-GuyNeural | American male |
  | Emma | en-US-EmmaMultilingualNeural | American female |
  | Andrew | en-US-AndrewMultilingualNeural | American male |
  | Aria | en-US-AriaNeural | American female |
  | Ryan | en-GB-RyanNeural | British male |
  | Sonia | en-GB-SoniaNeural | British female |
- Speed slightly reduced (-2% to -5%) for natural narration feel
- Output: one MP3 per script segment

### Step 3: AI Image Generation
- **API**: Stable Horde — free, community-powered GPU network
- **Model**: AlbedoBase XL (SDXL)
- **Access**: Anonymous key `0000000000` (no account needed)
- **Generation**: 576x1024 → upscaled to 1080x1920 via Pillow
- **Params**: 25 steps, cfg_scale 7.5, k_euler sampler
- **Parallel**: All jobs submitted at once, polled sequentially (5min timeout each)
- **Fallback**: Gradient placeholder if generation fails

### Step 4: Video Assembly
- **Engine**: MoviePy 2.0
- **Resolution**: 1080x1920 @ 24fps
- **Ken Burns**: Slow zoom 1.0→1.08 on each image
- **Transitions**: 0.6s crossfade between segments
- **Text**: Word-wrapped subtitles rendered with Pillow at bottom
- **Encoding**: libx264 + AAC

### User Options (Frontend)
| Setting | Options |
|---|---|
| Category | Mythology, Scary Stories, History, Science, Kids, Motivation, Custom |
| Visual Style | Ghibli, Anime, Cartoon, Comic, Cinematic, Watercolor |
| Voice | Jack, Emma, Andrew, Aria, Ryan, Sonia (with preview audio) |
| Music | Happy Rhythm, Suspenseful, Peaceful, Epic Cinematic, Mysterious, Energetic, None |
| Text Style | Bold Stroke, Red Highlight, Karaoke, Sleek, Beast, Elegant |
| Duration | 10s, 15s, 30s, 60s |

---

## Feature 3: YouTube Publishing

```
Completed clip → user clicks "YouTube" → publish modal
  → Pre-filled with AI-generated title, description, tags
  → User edits, picks visibility or schedules
  → POST /api/jobs/{id}/clips/{clipId}/publish-youtube
    → Refreshes Google OAuth2 token
    → Downloads clip from S3
    → Uploads via YouTube Data API v3 (resumable upload)
    → Stores youtube_video_id + youtube_url in MongoDB
```

- OAuth scopes: `youtube.upload`, `youtube.readonly`
- Refresh token stored in user doc
- Supports: publish now (public/unlisted/private) or schedule for later

---

## Feature 4: Instagram Reels Publishing

```
Completed clip → user clicks "Instagram" → caption modal
  → POST /api/jobs/{id}/clips/{clipId}/publish-instagram
    → Extends Meta long-lived token (60-day tokens)
    → Generates 10-min pre-signed S3 URL
    → Creates Instagram media container (media_type=REELS)
    → Polls until FINISHED → publishes
    → Stores instagram_media_id + instagram_url
```

- Meta Business OAuth: `instagram_basic`, `instagram_content_publish`, `pages_show_list`
- Long-lived tokens auto-extended on each publish

---

## Feature 5: Public API

**Base URL**: `https://vidtoreels.com/api`
**Docs**: `https://vidtoreels.com/docs`
**Auth**: `X-API-Key: vr_live_xxxxxxxx`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/videos/submit-url` | Submit YouTube URL for clip extraction |
| POST | `/faceless/submit` | Create AI faceless video from topic |
| GET | `/jobs` | List recent jobs (50 most recent) |
| GET | `/jobs/{id}` | Get job status + clips |
| GET | `/jobs/{id}/clips/{i}/download` | Pre-signed S3 download URL (1hr) |
| POST | `/jobs/{id}/retry` | Retry a failed job |
| GET | `/jobs/usage` | Monthly usage stats |

---

## Plans & Pricing

| Plan | Price | Videos/month | Clips/video | Max duration |
|---|---|---|---|---|
| Free | ₹0 | 2 | 3 | Unlimited |
| Pro | ₹1,499/mo | 20 | 10 | 60 min |
| Business | ₹3,999/mo | Unlimited | 20 | 3 hr |

---

## Cost Per Video (Marginal)

| Service | Cost | Notes |
|---|---|---|
| EC2 Spot t3.small | ~$0.005/hr | ~5 min per job |
| LLM (OpenRouter) | $0 | Free models (Llama 3.3, Gemini Flash) |
| Image Gen (Stable Horde) | $0 | Community SDXL |
| TTS (Edge-TTS) | $0 | Free Microsoft voices |
| Whisper | $0 | Runs locally on EC2 |
| S3 Storage | ~$0.023/GB/mo | |

**Total: ~$0.001–0.01 per video** (almost entirely EC2 Spot time)

---

## CI/CD

- **Frontend**: Push `frontend/` to main → GitHub Actions → `vercel deploy --prod`
- **Infrastructure**: Push `terraform/` or `lambdas/` to main → GitHub Actions → `terraform apply`
- **Processing**: Push to main → EC2 workers clone fresh repo on next job (no deploy needed)

---

## Development

```bash
# Local dev
cd frontend && npm run dev

# Check EC2 worker logs
bash logs.sh <job_id>

# Deploy infra manually
bash deploy.sh apply
```

See `CLAUDE.md` for detailed file map, MongoDB schema, and how-to guides.

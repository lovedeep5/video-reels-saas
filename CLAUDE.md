# VidToReels — Claude Reference

Quick orientation for Claude. Read this before touching any file.

---

## What This Is

SaaS where users submit a YouTube URL → AI picks the best moments → downloads short vertical clips.
Live at **vidtoreels.com** (Cloudflare → Vercel).

---

## Stack (current, production)

| Layer | Tech | Location |
|---|---|---|
| Frontend + API | Next.js 16, TypeScript, Vercel | `frontend/` |
| Auth | Clerk (JWT in API routes) | `frontend/src/lib/auth-helpers.ts` |
| Database | MongoDB Atlas (`vidtoreels` db) | `frontend/src/lib/mongodb.ts` |
| Job Queue | AWS SQS | `frontend/src/lib/sqs.ts` |
| Dispatcher | AWS Lambda (Python 3.11) | `lambdas/dispatcher/handler.py` |
| Recovery | AWS Lambda (Python 3.11) | `lambdas/recovery/handler.py` |
| Processing | AWS EC2 Spot t3.small | `processing/run_job.py` |
| AI Scoring | OpenRouter LLM | `backend/pipeline/llm_scorer.py` |
| Video tools | yt-dlp + ffmpeg | `backend/pipeline/downloader.py` |
| Storage | AWS S3 (`vidtoreel-bucket`) | — |
| Secrets | AWS SSM Parameter Store | `terraform/ssm.tf` |
| IaC | Terraform (state in S3) | `terraform/` |
| CI — Frontend | GitHub Actions → Vercel | `.github/workflows/vercel.yml` |
| CI — Infra | GitHub Actions → Terraform | `.github/workflows/terraform.yml` |
| Payments | Razorpay | `frontend/src/app/api/billing/` |

**Important:** The `backend/` directory is the OLD FastAPI server — it is NOT deployed.
It only exists because `processing/run_job.py` imports `backend/pipeline/*` on EC2 workers.

---

## Job Lifecycle

```
User submits URL
  → /api/videos/submit-url  (Next.js route)
      creates job in MongoDB (status: "queued")
      sends job_id to SQS
  → SQS triggers Lambda dispatcher
      counts running EC2s (tag Purpose=vidtoreels-job)
      if >= 10: hides SQS message 5min (rate limit)
      else: updates job → "starting", calls ec2.run_instances() Spot
  → EC2 UserData (bash script in lambdas/dispatcher/handler.py _build_userdata())
      1. installs ffmpeg, aws-cli, python deps
      2. fetches secrets from SSM
      3. git clone https://github.com/lovedeep5/video-reels-saas.git
      4. python processing/run_job.py
         - downloads video (yt-dlp, ios player_client to bypass bot detection)
         - transcribes (whisper)
         - LLM selects best clips (OpenRouter)
         - renders clips (ffmpeg, face-tracking crop)
         - uploads to S3
         - updates MongoDB → "completed"
      5. trap EXIT: always pushes logs to CloudWatch, marks failed if non-zero exit
      6. shutdown -h now (InstanceInitiatedShutdownBehavior=terminate)
  → Recovery Lambda (EventBridge every 30min)
      finds jobs stuck in [queued >35min, or starting/downloading/processing/rendering >35min]
      checks if EC2 is still alive
      re-queues up to 3 times, then permanently fails
```

---

## Key Files — What Each One Does

### Frontend API routes (`frontend/src/app/api/`)

| File | Purpose |
|---|---|
| `auth/me/route.ts` | Returns current user (Clerk JWT → MongoDB user lookup) |
| `videos/submit-url/route.ts` | Validates URL, checks plan limits, creates job, enqueues to SQS |
| `jobs/route.ts` | Lists user's jobs (GET) |
| `jobs/[id]/route.ts` | Get job detail (GET), delete failed job (DELETE) |
| `jobs/[id]/retry/route.ts` | Reset failed/stuck job to queued, re-enqueue to SQS |
| `jobs/[id]/clips/[clipId]/download/route.ts` | Generates pre-signed S3 URL for clip download |
| `jobs/usage/route.ts` | Returns videos_used/videos_limit for the month |
| `billing/plans/route.ts` | Returns plan definitions |
| `billing/subscribe/route.ts` | Creates Razorpay order |
| `billing/verify-payment/route.ts` | Verifies Razorpay signature, upgrades user plan |
| `billing/webhook/route.ts` | Razorpay webhook (subscription events) |
| `billing/cancel/route.ts` | Cancels user subscription |
| `keys/route.ts` | List API keys (GET), create API key (POST) |
| `keys/[id]/route.ts` | Revoke API key (DELETE) |

### Frontend lib (`frontend/src/lib/`)

| File | Purpose |
|---|---|
| `api.ts` | Axios instance + Clerk token interceptor. All API call helpers (`jobsApi`, `videoApi`, `billingApi`, `keysApi`) |
| `auth-helpers.ts` | `getCurrentUser(req)` — verifies Clerk JWT or API key, returns MongoDB user doc |
| `mongodb.ts` | MongoDB singleton client + collection helpers (`jobsCol()`, `usersCol()`) |
| `sqs.ts` | `enqueueJob(jobId)` — sends message to SQS |
| `plans.ts` | Plan definitions (`PLANS`), `getPlan()`, `BILLABLE_STATUSES` |
| `auth.ts` | Client-side Clerk helpers |

### Frontend components

| File | Purpose |
|---|---|
| `ClerkTokenSync.tsx` | Sets `window.__clerkGetToken` (used by axios interceptor) |
| `ClipCard.tsx` | Renders a single clip with download button |
| `ProcessingProgress.tsx` | Progress bar for in-progress jobs |
| `VideoUploader.tsx` | URL submission form |
| `Navbar.tsx` | Top nav with user menu |

### Frontend pages

| Path | File |
|---|---|
| `/dashboard` | `app/dashboard/page.tsx` — job list |
| `/dashboard/jobs/[id]` | `app/dashboard/jobs/[id]/page.tsx` — job detail + clips + retry/delete buttons |
| `/dashboard/keys` | `app/dashboard/keys/page.tsx` — API key management |
| `/billing` | `app/billing/page.tsx` — plan selection + Razorpay checkout |

### Lambda functions

| File | Purpose |
|---|---|
| `lambdas/dispatcher/handler.py` | SQS trigger → RunInstances. `_build_userdata()` generates EC2 bootstrap script |
| `lambdas/recovery/handler.py` | EventBridge cron → finds stale jobs, re-queues or permanently fails |

### Processing (runs on EC2)

| File | Purpose |
|---|---|
| `processing/run_job.py` | Main worker: download → transcribe → LLM select → render → upload → complete |
| `backend/pipeline/downloader.py` | yt-dlp wrapper. Uses `ios` player_client to bypass YouTube bot detection |
| `backend/pipeline/transcriber.py` | Whisper transcription |
| `backend/pipeline/llm_scorer.py` | OpenRouter LLM to pick best clip moments |
| `backend/pipeline/scorer.py` | Fallback audio energy scoring (if LLM fails) |
| `backend/pipeline/tracker.py` | Face-tracking crop params for vertical video |
| `backend/pipeline/processor.py` | ffmpeg render_clip() |

### Terraform (`terraform/`)

| File | What it manages |
|---|---|
| `main.tf` | Provider, S3 backend (`vidtoreel-bucket/terraform/state.tfstate`), Ubuntu AMI lookup |
| `sqs.tf` | `vidtoreels-jobs` queue (3600s visibility) + DLQ, SQS usage policy |
| `lambda.tf` | Dispatcher + Recovery Lambdas, CloudWatch log groups, EventBridge schedule |
| `iam.tf` | Lambda roles, EC2 instance profile, all IAM policies |
| `ec2.tf` | Security group for EC2 workers |
| `ssm.tf` | 12 SSM SecureString params (all have `prevent_destroy = true`) |
| `outputs.tf` | SQS URL, Lambda ARNs, S3 bucket name |
| `variables.tf` | All input variables including `repo_url` |

---

## MongoDB Schema (current)

### `users` collection
```
{
  _id: ObjectId,
  clerk_id: "user_xxx",           // Clerk user ID
  email: "user@example.com",
  name: "Full Name",
  plan: "free" | "pro" | "business",
  api_keys: [{ id, name, key_hash, key_prefix, is_active, created_at, last_used_at, expires_at }],
  created_at: Date
}
```

### `jobs` collection
```
{
  _id: ObjectId,
  user_id: ObjectId,
  status: "queued" | "starting" | "downloading" | "processing" | "rendering" | "completed" | "failed",
  source_type: "url",
  source_url: "https://youtube.com/watch?v=xxx",
  video_title: "Video Title",
  video_duration: 600,             // seconds
  clips_requested: 5,
  output_ratio: "9:16",            // "9:16" | "1:1" | "4:5" | "16:9"
  progress: 0-100,
  progress_message: "Transcribing...",
  error_message: "...",            // set on failure
  output_clips: ["users/{uid}/jobs/{jid}/clip_1.mp4", ...],  // S3 keys
  retry_count: 0,
  ec2_instance_id: "i-xxx",
  created_at: Date,
  started_at: Date,
  completed_at: Date
}
```

### Plans (`frontend/src/lib/plans.ts`)
```
free:     clips_per_video=3,  videos_per_month=2,  max_duration_seconds=0 (unlimited)
pro:      clips_per_video=10, videos_per_month=20, max_duration_seconds=3600 (1hr)
business: clips_per_video=20, videos_per_month=-1, max_duration_seconds=10800 (3hr)
```
`BILLABLE_STATUSES` = all statuses (queued through failed) — count increments on submission.

---

## CI/CD

### On push to `main` with changes in `frontend/`
`.github/workflows/vercel.yml` → `vercel deploy --prod --token $VERCEL_TOKEN`

### On push to `main` with changes in `terraform/` or `lambdas/`
`.github/workflows/terraform.yml`:
1. Builds lambda packages (`pip install --platform manylinux2014_x86_64 -t build/`)
2. `terraform init` (S3 backend)
3. `terraform plan`
4. `terraform apply -auto-approve` (push to main only; PRs only plan)

### GitHub Secrets required
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MONGODB_URI`, `CLERK_SECRET_KEY`,
`CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES`, `APP_SECRET_KEY`, `OPENROUTER_API_KEY`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

---

## AWS Infrastructure (live)

- **Region**: ap-south-1 (Mumbai)
- **S3 bucket**: `vidtoreel-bucket` (pre-existing, not in Terraform)
- **SQS queue**: `vidtoreels-jobs` (URL in SSM + Vercel env)
- **EC2 Spot**: t3.small, Ubuntu 22.04, subnet `subnet-043745df464232d4e`
- **CloudWatch logs**: `/vidtoreels/ec2-workers/job-<id>` (14-day retention)
- **SSM params**: all under `/vidtoreels/*` prefix
- **Terraform state**: `s3://vidtoreel-bucket/terraform/state.tfstate`

### Viewing EC2 worker logs
```bash
# Set env vars first:
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

bash logs.sh                  # list recent log streams
bash logs.sh <job_id>         # full log for a specific job
```

---

## Common Tasks

### Add a new API route
1. Create `frontend/src/app/api/<path>/route.ts`
2. Use `getCurrentUser(req)` from `@/lib/auth-helpers` for auth
3. Use `jobsCol()` / `usersCol()` from `@/lib/mongodb` for DB
4. Add helper to `frontend/src/lib/api.ts` if frontend needs to call it

### Add a new plan
Edit `frontend/src/lib/plans.ts` — the `PLANS` const is used everywhere (frontend + processing/run_job.py has a copy).
**Also update the copy in `processing/run_job.py` lines 40-44.**

### Change EC2 worker bootstrap
Edit `_build_userdata()` in `lambdas/dispatcher/handler.py`.
Push to main → GitHub Actions runs `terraform apply` → new Lambda deployed.

### Change processing pipeline
Edit files in `backend/pipeline/` or `processing/run_job.py`.
Push to main → EC2 workers clone fresh on next job (no deploy needed).

### Add a new Terraform resource
Edit the relevant `.tf` file in `terraform/`.
Push to main → GitHub Actions runs `terraform apply`.

### Deploy manually (local)
```bash
# Make sure terraform/terraform.tfvars exists (gitignored) with all secrets
bash deploy.sh apply
```

---

## Known Issues / Gotchas

1. **YouTube bot detection**: Fixed with `extractor_args: {youtube: {player_client: ["ios"]}}` in `downloader.py`. If it breaks again, try `tv_embedded` or `android`.

2. **EC2 cold start ~3min**: Each job downloads deps fresh. Can be reduced to ~30s with a pre-baked AMI (set `worker_ami_id` in tfvars).

3. **Cloudflare caching**: API routes have `Cache-Control: no-store` in `next.config.ts`. If API returns stale responses, purge Cloudflare cache.

4. **Recovery Lambda**: Runs every 30min. Catches both stuck `queued` jobs (by `created_at`) and stuck processing jobs (by `started_at`). Retries up to 3 times.

5. **Plan limits**: `videos_per_month: -1` means unlimited (business plan). The usage query skips the limit check when `-1`.

6. **Retry button**: Shows on `failed` AND `starting` status jobs (stuck-starting jobs can be retried from the UI).

7. **`backend/` is not deployed**: Only used by EC2 workers via `sys.path.insert(0, REPO_ROOT / "backend")` in `run_job.py`.

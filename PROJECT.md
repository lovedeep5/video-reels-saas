# VidToReels SaaS — Project & Deployment Reference

## What It Does

SaaS platform where users submit a YouTube URL, the platform downloads the video,
splits it into short viral reels using AI clip scoring (OpenRouter LLM), and
delivers the output clips via S3 download links.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 16 (App Router, TypeScript) on Vercel |
| Auth | Clerk (frontend SDK + JWT verification in API routes) |
| Database | MongoDB Atlas (`vidtoreels` db, `cluster0.tarryme.mongodb.net`) |
| Job Queue | AWS SQS (ap-south-1) |
| Job Dispatcher | AWS Lambda (Python 3.11) — triggered by SQS |
| Video Processing | AWS EC2 Spot t3.small — spun up per job, self-terminates |
| File Storage | AWS S3 (`vidtoreel-bucket`, ap-south-1) |
| Crash Recovery | AWS Lambda (Python 3.11) — EventBridge cron every 30min |
| Secrets | AWS SSM Parameter Store (SecureString) |
| IaC | Terraform (state in S3: `vidtoreel-bucket/terraform/state.tfstate`) |
| CI/CD — Frontend | Vercel (auto-deploy on push to GitHub main) |
| CI/CD — Infra | GitHub Actions (terraform apply on push to main) |
| Payments | Razorpay |

---

## Architecture Flow

```
User submits YouTube URL
        ↓
Next.js API route (/api/videos/submit-url)
  - Verifies Clerk JWT
  - Creates job doc in MongoDB (status: queued)
  - Sends job_id to SQS
        ↓
AWS SQS — Job Queue
  - visibility_timeout: 3600s (1 job can run for up to 1hr)
  - DLQ after 3 failed deliveries
        ↓
AWS Lambda — Dispatcher (triggered by SQS, batch_size=1)
  - Counts EC2s tagged Purpose=vidtoreels-job
  - If >= 10 running: hides message 5min, returns batchItemFailure (rate limiting)
  - If < 10: updates job status → "starting", calls ec2.run_instances() with Spot config
        ↓
AWS EC2 Spot t3.small (UserData script)
  1. git pull latest processing/ code from GitHub
  2. pip install -r requirements.txt
  3. python run_job.py <job_id>
     - Downloads YouTube video (yt-dlp)
     - Splits into clips (ffmpeg)
     - Scores clips with LLM (OpenRouter)
     - Uploads top clips to S3
     - Updates MongoDB job → "completed"
  4. sudo shutdown -h now  (InstanceInitiatedShutdownBehavior=terminate)
        ↓
AWS Lambda — Recovery (EventBridge every 30min)
  - Finds jobs in [starting, downloading, processing, rendering] older than 35min
  - Checks if their EC2 is still alive (describe_instances by tag)
  - If EC2 dead + retry_count < 3: re-queues to SQS, retry_count++
  - If retry_count >= 3: marks job permanently failed
```

---

## Repository Structure

```
video-reels-saas/
├── frontend/                    # Next.js app (deployed to Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # login, register pages (Clerk)
│   │   │   ├── dashboard/      # jobs/, keys/, upload/ pages
│   │   │   ├── billing/        # Razorpay billing page
│   │   │   ├── status/         # job status page
│   │   │   └── api/            # Next.js API routes (replaces FastAPI)
│   │   ├── components/
│   │   │   ├── ClerkTokenSync.tsx
│   │   │   └── Navbar.tsx
│   │   └── lib/
│   │       ├── api.ts           # axios instance with Clerk token interceptor
│   │       ├── mongodb.ts       # MongoDB singleton client (TODO)
│   │       ├── sqs.ts           # SQS send helper (TODO)
│   │       └── auth-helpers.ts  # Clerk JWT + API key verify (TODO)
├── backend/                     # FastAPI (being replaced by Next.js API routes)
│   ├── auth.py                  # Clerk JWT + API key auth
│   ├── routers/                 # auth, billing, jobs, keys, videos
│   └── requirements.txt
├── lambdas/
│   ├── dispatcher/
│   │   ├── handler.py           # SQS trigger → RunInstances
│   │   └── requirements.txt     # pymongo==4.7.3
│   └── recovery/
│       ├── handler.py           # EventBridge → stale job requeue
│       └── requirements.txt     # pymongo==4.7.3
├── processing/                  # Runs on EC2 workers (TODO)
│   ├── run_job.py               # Main worker entry point
│   └── startup.sh               # EC2 UserData bootstrap
├── terraform/                   # All AWS infrastructure as code
│   ├── main.tf                  # Provider, S3 backend, AMI lookup
│   ├── variables.tf             # All input variables
│   ├── sqs.tf                   # SQS queue + DLQ
│   ├── lambda.tf                # Dispatcher + Recovery Lambdas
│   ├── iam.tf                   # IAM roles + EC2 instance profile
│   ├── ec2.tf                   # Security group + launch template
│   ├── ssm.tf                   # 12 SSM params (prevent_destroy=true)
│   ├── outputs.tf               # SQS URL, Lambda ARNs, etc.
│   └── terraform.tfvars.example # Template — copy to terraform.tfvars for local
└── .github/
    └── workflows/
        └── terraform.yml        # CI: plan on PR, apply on push to main
```

---

## MongoDB Collections

### `users`
```json
{
  "_id": ObjectId,
  "clerk_id": "user_xxx",
  "email": "user@example.com",
  "plan": "free|pro|enterprise",
  "api_keys": ["vr_live_xxx"],
  "created_at": ISODate
}
```

### `jobs`
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "youtube_url": "https://youtube.com/watch?v=xxx",
  "status": "queued|starting|downloading|processing|rendering|completed|failed",
  "retry_count": 0,
  "ec2_instance_id": "i-xxx",
  "output_clips": ["s3://vidtoreel-bucket/clips/xxx.mp4"],
  "error": null,
  "created_at": ISODate,
  "started_at": ISODate,
  "completed_at": ISODate
}
```

---

## Next.js API Routes (replacing FastAPI)

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/me` | GET | Return current user info |
| `/api/jobs` | GET | List user's jobs |
| `/api/jobs` | POST | Submit new job (→ SQS) |
| `/api/jobs/[id]` | GET | Get single job status |
| `/api/videos/submit-url` | POST | Validate URL + submit job |
| `/api/keys` | GET | List API keys |
| `/api/keys` | POST | Create API key |
| `/api/keys/[id]` | DELETE | Revoke API key |
| `/api/billing/create-order` | POST | Create Razorpay order |
| `/api/billing/webhook` | POST | Razorpay webhook handler |

---

## Environment Variables

### Vercel (frontend + API routes)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
MONGODB_URI=mongodb+srv://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
SQS_JOB_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/385105852622/vidtoreels-jobs
S3_BUCKET=vidtoreel-bucket
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

### EC2 Workers (pulled from SSM at runtime, path prefix `/vidtoreels/`)
```
MONGODB_URI, MONGODB_DB_NAME, S3_BUCKET, JOB_QUEUE_URL,
CLERK_SECRET_KEY, CLERK_JWKS_URL, CLERK_AUTHORIZED_PARTIES,
SECRET_KEY, OPENROUTER_API_KEY, RAZORPAY_*
```

---

## GitHub Actions Secrets (for Terraform CI)

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | Admin IAM user key |
| `AWS_SECRET_ACCESS_KEY` | Admin IAM user secret |
| `MONGODB_URI` | Atlas connection string |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint |
| `CLERK_AUTHORIZED_PARTIES` | `https://vidtoreels.com,http://localhost:3000` |
| `APP_SECRET_KEY` | Internal signing key |
| `OPENROUTER_API_KEY` | LLM API key |
| `RAZORPAY_KEY_ID` | Razorpay key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |

---

## Deployment Steps (first time)

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Vercel (auto)
- Linked to GitHub repo `video-reels-saas-frontend`
- Auto-deploys on push to `main`
- Add Vercel env vars from the table above

### 3. GitHub Actions Secrets
- Go to repo → Settings → Secrets and variables → Actions
- Add all secrets from the table above
- Push to `main` triggers `terraform apply` automatically

### 4. After Terraform Apply
- Note SQS queue URL from CI output
- Add `SQS_JOB_QUEUE_URL` to Vercel env vars
- Redeploy Vercel (or it picks up on next push)

### 5. EC2 AMI (optional, improves cold start from ~3min to ~30s)
```bash
# Launch a t3.small with Ubuntu 22.04
# SSH in and run:
sudo apt update && sudo apt install -y python3-pip ffmpeg git
pip3 install yt-dlp pymongo boto3 openai
# Create AMI from this instance
# Set worker_ami_id in terraform.tfvars / GitHub secret TF_VAR_worker_ami_id
```

---

## Cost Estimate (light usage)

| Service | Cost |
|---|---|
| Vercel (frontend + API) | Free (hobby plan) |
| MongoDB Atlas | Free (M0 cluster) |
| SQS | ~$0 (first 1M requests/month free) |
| Lambda | ~$0 (first 1M invocations/month free) |
| EC2 Spot t3.small | ~$0.007/hr per job (~$0.35 for 50 jobs) |
| S3 | ~$0.023/GB |
| **Total for light usage** | **< $5/month** |

---

## Key Decisions

1. **FastAPI → Next.js API routes**: eliminates separate backend server, runs on Vercel for free
2. **SQLite → MongoDB Atlas**: required for Vercel (no persistent filesystem), free tier generous
3. **EC2 Spot over Lambda for processing**: video processing needs > 15min, needs ffmpeg, needs disk
4. **Self-terminating EC2**: `sudo shutdown -h now` + `InstanceInitiatedShutdownBehavior=terminate` — no IAM terminate permission needed on the instance itself
5. **SQS 10-job cap**: Lambda counts live EC2s with tag `Purpose=vidtoreels-job` before launching new ones
6. **prevent_destroy on SSM params**: protects secrets from accidental `terraform destroy`
7. **S3 bucket pre-existing**: not managed by Terraform, immune to destroy

---

## What's Done vs Pending

### Done
- [x] Next.js frontend (dashboard, jobs, keys, billing, auth pages)
- [x] Clerk auth integration (frontend + backend)
- [x] Terraform infra files (SQS, Lambda, EC2, IAM, SSM)
- [x] Lambda dispatcher handler
- [x] Lambda recovery handler
- [x] GitHub Actions workflow (plan on PR, apply on push)
- [x] Vercel deployment (vidtoreels.com via Cloudflare DNS)
- [x] MongoDB Atlas cluster

### Pending
- [ ] Next.js API routes (`frontend/src/app/api/`)
- [ ] `frontend/src/lib/mongodb.ts` singleton
- [ ] `frontend/src/lib/sqs.ts` helper
- [ ] `frontend/src/lib/auth-helpers.ts`
- [ ] `processing/run_job.py` EC2 worker
- [ ] `processing/startup.sh` UserData script
- [ ] Frontend components updated to call `/api/*` (currently call `localhost:8000`)
- [ ] GitHub Secrets added (for terraform CI)
- [ ] Vercel env vars added

# VidToReels SaaS

Convert long YouTube videos into short viral clips using AI.

**Live**: https://vidtoreels.com
**Repo**: https://github.com/lovedeep5/video-reels-saas
**Stack**: Next.js 16 → MongoDB Atlas → AWS SQS → Lambda → EC2 Spot → S3

---

## Architecture

```
User → vidtoreels.com (Cloudflare → Vercel)
          ↓
     Next.js API routes
     (Clerk auth, MongoDB, SQS)
          ↓
     AWS SQS queue
          ↓
     Lambda dispatcher
     (starts EC2 Spot per job)
          ↓
     EC2 Spot t3.small
     (yt-dlp + whisper + ffmpeg + OpenRouter LLM)
          ↓
     S3 clips → user downloads
```

See `CLAUDE.md` for detailed architecture, file map, and how-to guides.

---

## Plans

| Plan | Price | Clips/video | Videos/month | Max duration |
|---|---|---|---|---|
| Free | ₹0 | 3 | 2 | Unlimited |
| Pro | ₹1,499/mo | 10 | 20 | 60 min |
| Business | ₹3,999/mo | 20 | Unlimited | 3 hr |

---

## Development

```bash
# Local dev (starts frontend on :3000)
cd frontend && npm run dev

# Deploy infra changes
# Push terraform/ or lambdas/ changes to main → GitHub Actions auto-applies

# Deploy frontend changes
# Push frontend/ changes to main → GitHub Actions auto-deploys to Vercel

# Check EC2 worker logs
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
bash logs.sh <job_id>
```

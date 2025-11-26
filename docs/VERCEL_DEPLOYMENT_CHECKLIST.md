# Vercel Deployment Checklist

Your project is now configured for Vercel deployment with S3 storage. Follow this checklist to ensure a successful deployment.

## Phase 1: AWS Setup (15 minutes)

### ✅ S3 Bucket Creation
- [ ] Create S3 bucket: `spec-driven-artifacts-{unique-suffix}`
- [ ] Select region (recommend: `us-east-1`)
- [ ] Keep "Block all public access" checked
- [ ] Configure CORS policy with your Vercel domain
- [ ] **Bucket name saved**: ________________

### ✅ IAM Credentials (Development)
- [ ] Create IAM user: `spec-driven-dev-s3`
- [ ] Attach `AmazonS3FullAccess` policy
- [ ] Generate access key
- [ ] **Access Key ID saved**: ________________
- [ ] **Secret Access Key saved**: ________________ (⚠️ Save immediately!)

### ✅ IAM Credentials (Production) - RECOMMENDED
- [ ] Create second IAM user: `spec-driven-prod-s3`
- [ ] Create second S3 bucket: `spec-driven-artifacts-production`
- [ ] Generate separate access keys for production
- [ ] **Prod Access Key ID**: ________________
- [ ] **Prod Secret Access Key**: ________________

---

## Phase 2: Local Development Setup (5 minutes)

### ✅ Environment Configuration
1. Create/update `.env.local` in project root:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=spec-driven-artifacts-xxx
```

2. **Verify configuration**:
   ```bash
   node scripts/verify-s3-config.js
   ```
   You should see all ✅ checks pass

### ✅ Test Locally
```bash
# Start dev server
npm run dev

# Create a test project via web UI
# Check that files appear in S3 console
```

---

## Phase 3: Vercel Deployment (10 minutes)

### ✅ Vercel Project Setup
- [ ] Project imported to Vercel (or create new)
- [ ] GitHub repository connected
- [ ] Auto-deployments enabled

### ✅ Environment Variables
Go to **Vercel Dashboard** → **Settings** → **Environment Variables**

Add for **All Environments** (Production, Preview, Development):

| Variable | Value | Source |
|----------|-------|--------|
| `AWS_REGION` | `us-east-1` | Your choice |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | `...` | IAM credentials |
| `S3_BUCKET_NAME` | `spec-driven-artifacts-xxx` | Bucket name |
| `DATABASE_URL` | `postgresql://...` | Neon |
| `NEXT_PUBLIC_APP_URL` | `https://spec-driven.vercel.app` | Your domain |
| `AUTH_BASE_URL` | `https://spec-driven.vercel.app` | Your domain |
| `JWT_SECRET` | `(random 32+ chars)` | Generated |
| `GEMINI_API_KEY` | Your key | Google Cloud |
| `ALLOWED_ORIGINS` | `https://spec-driven.vercel.app` | Your domain |

**Generate JWT_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ✅ Deployment
1. Go to **Deployments** tab
2. Click latest deployment → **⋯** → **Redeploy**
3. Or push a commit to main branch (auto-deploys)
4. Wait for build to complete (~3-5 minutes)

---

## Phase 4: Verification (10 minutes)

### ✅ Post-Deployment Tests
- [ ] Visit your Vercel URL (e.g., `https://spec-driven.vercel.app`)
- [ ] Can sign up and create account
- [ ] Can create a new project
- [ ] No errors in Vercel logs

### ✅ Verify S3 Integration
1. Create a test project via web UI
2. Check AWS S3 Console → Your bucket
3. You should see:
   ```
   projects/
   └── test-project-slug/
       ├── project_idea.txt
       └── metadata/
           └── metadata.json
   ```
4. Files appearing = ✅ S3 integration working!

### ✅ Check Logs
```bash
# In Vercel dashboard, click Deployments → Latest
# Click on deployment and check Function Logs
# Should see: "File uploaded to S3" or similar success messages
```

---

## Phase 5: Monitoring (Ongoing)

### ✅ AWS Billing
- [ ] Monitor AWS Billing Dashboard: https://console.aws.amazon.com/billing
- [ ] Set up cost alerts (free tier should cost ~$0)
- [ ] Review S3 usage monthly

### ✅ Error Tracking
- [ ] Check Vercel logs for S3 errors
- [ ] Monitor database performance
- [ ] Watch for failed uploads in application logs

### ✅ Security
- [ ] Review IAM user permissions (should be S3 only)
- [ ] Rotate credentials every 90 days
- [ ] Keep production credentials separate from development

---

## Troubleshooting

### "S3 is not configured" error on Vercel
**Cause**: Environment variables not set in Vercel dashboard

**Fix**:
1. Go to Vercel Settings → Environment Variables
2. Add all S3 variables
3. Redeploy: Deployments → Latest → Redeploy

### "Access Denied" uploading files
**Cause**: IAM user doesn't have S3 permissions

**Fix**:
1. Go to IAM Console → Users
2. Click the user name
3. Check "AmazonS3FullAccess" policy is attached
4. If not, add it and try again

### Files not appearing in S3
**Cause**: Wrong bucket name or credentials

**Verification**:
1. Verify bucket name in Vercel env variables
2. Run `node scripts/verify-s3-config.js` locally
3. Check IAM credentials are correct (test with AWS CLI)

### "Bucket doesn't exist" errors
**Cause**: Typo in bucket name

**Fix**:
1. Check exact bucket name in AWS S3 Console
2. Update in Vercel environment variables
3. Verify bucket exists in same region as `AWS_REGION` variable

---

## What's Been Done

✅ **TypeScript Errors Fixed** - db-lock.ts compilation errors resolved

✅ **S3 Integration Added**:
- S3 service module: `src/lib/s3-storage.ts`
- Updated project utilities to use S3
- Updated API routes for S3 uploads
- Async file operations instead of sync

✅ **Environment Setup**:
- `.env.example` updated with S3 variables
- `.env.production` updated with S3 variables
- Verification script: `scripts/verify-s3-config.js`

✅ **Documentation**:
- Complete S3 setup guide: `S3_SETUP_GUIDE.md`
- This deployment checklist

---

## Next Immediate Steps

1. **Create AWS credentials** (if you haven't already)
   - Follow "Phase 1" above or see `S3_SETUP_GUIDE.md`

2. **Update `.env.local`** with your S3 credentials
   ```bash
   # Copy from .env.example and fill in your values
   cp .env.example .env.local
   # Edit .env.local and add your actual credentials
   ```

3. **Run verification**:
   ```bash
   node scripts/verify-s3-config.js
   ```

4. **Test locally**:
   ```bash
   npm run dev
   ```

5. **Deploy to Vercel**:
   - Add environment variables in Vercel dashboard
   - Redeploy or push commit to main

---

## Estimated Costs (12 months)

**With Free Tier** (most projects):
- Storage: Free (up to 5 GB)
- Requests: Free (limited)
- **Total: $0**

**Beyond Free Tier** (large projects):
- Storage: ~$0.023/GB/month
- 100 projects × 500 KB = ~$1/month

---

## Support Resources

- **S3 Detailed Setup**: See `S3_SETUP_GUIDE.md`
- **AWS Documentation**: https://docs.aws.amazon.com/s3/
- **Vercel Docs**: https://vercel.com/docs
- **Project Schema**: `backend/lib/schema.ts`
- **API Routes**: `src/app/api/projects/`

---

## Emergency Contacts

If deployment fails:
1. Check Vercel logs (Deployments → Latest)
2. Check AWS S3 Console for bucket/credentials
3. Review error messages in `scripts/verify-s3-config.js`
4. See troubleshooting section above

---

**Status**: ✅ Ready for Vercel deployment

**Last Updated**: 2025-11-22

Good luck with your deployment! 🚀

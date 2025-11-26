# AWS S3 Quick Reference

## URLs You'll Need

| Service | URL |
|---------|-----|
| AWS Console | https://console.aws.amazon.com |
| S3 Console | https://s3.console.aws.amazon.com |
| IAM Console | https://console.aws.amazon.com/iam |
| Billing Dashboard | https://console.aws.amazon.com/billing |
| Vercel Dashboard | https://vercel.com/dashboard |

---

## Step-by-Step (Ultra-Quick Version)

### 1. Create S3 Bucket (5 min)
```
1. Go to S3 Console
2. Click "Create bucket"
3. Name: spec-driven-artifacts-{unique}
4. Region: us-east-1
5. Block public access: ✓ (keep checked)
6. Click "Create bucket"
```

### 2. Create IAM User (5 min)
```
1. Go to IAM Console
2. Users → Create user
3. Username: spec-driven-dev-s3
4. Don't create console access (uncheck)
5. Next → Attach policies directly
6. Search: AmazonS3FullAccess → check it
7. Create user
```

### 3. Get Credentials (2 min)
```
1. Click the user you created
2. Security credentials tab
3. Create access key
4. Application outside AWS
5. Create access key
6. COPY AND SAVE THE TWO KEYS IMMEDIATELY
```

### 4. Local Setup (2 min)
```
Create .env.local:
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=spec-driven-artifacts-xxx
```

### 5. Verify (1 min)
```bash
node scripts/verify-s3-config.js
```

### 6. Test (5 min)
```bash
npm run dev
# Create test project in web UI
# Check S3 console - files should appear
```

### 7. Vercel Deploy (5 min)
```
1. Vercel Dashboard
2. Settings → Environment Variables
3. Add same 4 S3 variables
4. Add: DATABASE_URL, NEXT_PUBLIC_APP_URL, etc.
5. Redeploy
```

---

## Commands You'll Use

```bash
# Verify configuration
node scripts/verify-s3-config.js

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

---

## Environment Variables Needed

### Required (All Environments)
```
AWS_REGION                 # e.g., us-east-1
AWS_ACCESS_KEY_ID         # From IAM user
AWS_SECRET_ACCESS_KEY     # From IAM user (⚠️ secret!)
S3_BUCKET_NAME            # Your bucket name
```

### Also Required (Vercel Only)
```
DATABASE_URL              # From Neon
NEXT_PUBLIC_APP_URL       # Your Vercel domain
AUTH_BASE_URL             # Same as above
JWT_SECRET                # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GEMINI_API_KEY            # From Google Cloud
ALLOWED_ORIGINS           # Your domain
```

---

## Credentials Checklist

Save these immediately in a password manager or secure note:

```
Bucket Name: ___________________________
Region: ___________________________
Access Key ID: ___________________________
Secret Access Key: ___________________________

Production Bucket: ___________________________
Production Access Key: ___________________________
Production Secret: ___________________________
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `S3 credentials not configured` | Check .env.local has all 4 variables |
| `Access Denied` | Check IAM user has S3 permissions |
| `NoSuchBucket` | Check bucket name spelling and region |
| `Vercel deployment fails` | Check env vars in Vercel dashboard |
| Can't find Access Key | Delete it, create a new one |

---

## Files Changed

```
✅ CREATED:
  src/lib/s3-storage.ts
  scripts/verify-s3-config.js
  S3_SETUP_GUIDE.md
  VERCEL_DEPLOYMENT_CHECKLIST.md
  AWS_S3_QUICK_REFERENCE.md

✅ MODIFIED:
  package.json (added AWS SDK)
  src/app/api/lib/project-utils.ts (now async, uses S3)
  src/app/api/projects/route.ts (uses S3)
  src/lib/db-lock.ts (fixed TypeScript errors)
  .env.example (added S3 variables)
  .env.production (added S3 variables)
```

---

## Security Reminders

- ⚠️ **NEVER** commit .env.local to git
- ⚠️ **NEVER** share Access Keys
- ⚠️ Secret Access Key shown only once - save immediately
- ⚠️ Use different credentials for production
- ✅ Rotate credentials every 90 days
- ✅ Use IAM users, not root credentials

---

## What Gets Stored in S3

```
spec-driven-artifacts/
├── projects/
│   └── project-slug/
│       ├── project_idea.txt
│       └── metadata/
│           └── metadata.json
│       └── specs/
│           └── PHASE_NAME/
│               └── v1/
│                   ├── file1.md
│                   ├── file2.ts
│                   └── ...
```

---

## Cost Check

```
Free Tier:
  • 5 GB storage
  • Limited requests
  • For 12 months
  • Total: $0

Small Project (typical):
  • ~100 MB storage
  • ~1,000 requests/month
  • Total: <$1/month
```

---

## Next: Open S3_SETUP_GUIDE.md

For step-by-step detailed instructions with screenshots!

---

**Stuck?** Check [S3_SETUP_GUIDE.md](./S3_SETUP_GUIDE.md) troubleshooting section

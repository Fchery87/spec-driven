# AWS S3 Setup Guide for Spec-Driven

This guide walks you through setting up AWS S3 for file storage and configuring it with your Spec-Driven application. This is required for Vercel deployment since Vercel uses ephemeral file systems.

## Table of Contents
1. [AWS Account Setup](#aws-account-setup)
2. [Create S3 Bucket](#create-s3-bucket)
3. [Create IAM User & Credentials](#create-iam-user--credentials)
4. [Local Development Setup](#local-development-setup)
5. [Vercel Deployment Setup](#vercel-deployment-setup)
6. [Testing S3 Integration](#testing-s3-integration)
7. [Troubleshooting](#troubleshooting)

---

## AWS Account Setup

If you don't have an AWS account yet:
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow the registration steps
4. Verify your identity (email or phone)
5. Add a payment method

You'll be eligible for AWS Free Tier benefits:
- **S3**: 5 GB of storage free for 12 months
- **Data Transfer**: 1 GB free per month for 12 months
- **Requests**: Limited free tier for API calls

---

## Create S3 Bucket

### Step 1: Access S3 Console
1. Log into [AWS Console](https://console.aws.amazon.com)
2. Search for "S3" and click the S3 service
3. Click "Create bucket"

### Step 2: Configure Bucket
**Bucket name**: `spec-driven-artifacts-{your-unique-suffix}`
- Bucket names must be globally unique across all AWS accounts
- Use lowercase letters, numbers, and hyphens only
- Example: `spec-driven-artifacts-abc123xyz`

**Region**: Choose closest to your users (or `us-east-1` for default)

**Block Public Access**: Keep all boxes **checked** ✓
- This ensures your artifacts are private and only accessible with credentials
- You don't need public read access since we'll use AWS credentials

**Click "Create bucket"**

### Step 3: Configure CORS (for browser uploads/downloads)
If you plan to upload files from the browser:

1. Click your bucket name
2. Go to **Permissions** tab
3. Scroll down to **Cross-origin resource sharing (CORS)**
4. Click **Edit**
5. Paste this policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://your-vercel-domain.vercel.app"
    ],
    "ExposeHeaders": ["ETag", "x-amz-version-id"],
    "MaxAgeSeconds": 3000
  }
]
```

6. Click **Save changes**

---

## Create IAM User & Credentials

### Why a separate IAM user?
- **Security best practice**: Don't use root AWS account credentials
- **Least privilege**: Restrict to only S3 access
- **Easy rotation**: Can disable/regenerate keys without affecting other services

### Step 1: Access IAM Console
1. Go to [IAM Console](https://console.aws.amazon.com/iam)
2. Click **Users** in the sidebar
3. Click **Create user**

### Step 2: Create User for Development
**Username**: `spec-driven-dev-s3`

- Uncheck "Provide user access to the AWS Management Console"
- Click **Next**

### Step 3: Set Permissions
- Click **Attach policies directly**
- Search for `AmazonS3FullAccess`
- **Check the box** next to it (allows all S3 operations on this bucket)
- Click **Next** → **Create user**

### Step 4: Create Access Keys
1. Click the user you just created
2. Go to **Security credentials** tab
3. Scroll to **Access keys** section
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. Click **Create access key**

**⚠️ IMPORTANT: Save these immediately!**
- **Access Key ID**: (starts with `AKIA...`)
- **Secret Access Key**: (you can only see this once)

If you lose the Secret Access Key, you must delete this key and create a new one.

### Step 5: Create Production IAM User (Optional but Recommended)
Repeat steps 1-4 for production:
- **Username**: `spec-driven-prod-s3`
- **Bucket**: `spec-driven-artifacts-production`
- Use separate credentials for production environment

This way, if dev credentials are compromised, production is still secure.

---

## Local Development Setup

### Step 1: Update Your `.env.local`

Create or update `.env.local` with your S3 credentials:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key-here
S3_BUCKET_NAME=spec-driven-artifacts-your-suffix
```

**⚠️ CRITICAL**:
- **NEVER commit `.env.local` to git** (it's in `.gitignore`)
- `.env.local` is only for your local machine
- Each developer gets their own credentials

### Step 2: Test Connection Locally

```bash
# Make sure your .env.local is set
source .env.local  # or just reload your terminal

# Try to build the project
npm run build
```

If you see errors about S3 configuration, double-check:
- All three variables are set correctly in `.env.local`
- No extra spaces or quotes around values
- Bucket name matches exactly (case-sensitive)

### Step 3: Test a Project Creation (Optional)

Start the dev server:
```bash
npm run dev
```

1. Create a new project via the web UI
2. Check the console logs for S3 upload confirmation
3. Verify in AWS S3 console that files appear in your bucket

---

## Vercel Deployment Setup

### Step 1: Connect Vercel to GitHub
If not already done:
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Select your `spec-driven` repository
5. Click "Import"

### Step 2: Add Environment Variables
1. In Vercel dashboard, go to **Settings** → **Environment Variables**
2. Add these variables (values from your IAM credentials):

| Name | Value | Example |
|------|-------|---------|
| `AWS_REGION` | Your S3 region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | From IAM Access Key | `AKIA2Z7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | From IAM Secret Key | `wJalrXUtnFEMI/K7MDENG+example` |
| `S3_BUCKET_NAME` | Your bucket name | `spec-driven-artifacts-prod` |
| `DATABASE_URL` | Neon connection string | `postgresql://...` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel domain | `https://spec-driven.vercel.app` |
| `AUTH_BASE_URL` | Same as above | `https://spec-driven.vercel.app` |
| `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | `a1b2c3d4e5...` |

**Select Environment**: Production, Preview, Development (check all three for S3 variables)

### Step 3: Deploy
1. Go to **Deployments** tab
2. Click the three dots (⋯) on latest deployment
3. Click **Redeploy**
4. Or simply push a commit to trigger auto-deploy

---

## Testing S3 Integration

### Local Testing Checklist
- [ ] `.env.local` has all three S3 variables
- [ ] Can create a new project without errors
- [ ] Project metadata appears in S3 bucket
- [ ] Can download artifacts

### Production Testing (After Vercel Deploy)
1. Deploy your app to Vercel
2. Create a test project via the web UI
3. Go to AWS S3 console → your bucket
4. You should see:
   ```
   projects/
   └── test-project-slug/
       ├── project_idea.txt
       └── metadata.json
   ```
5. If files appear, S3 integration is working!

### Verify in AWS Console
1. Go to [S3 Console](https://s3.console.aws.amazon.com/)
2. Click your bucket name
3. You should see a `projects/` folder with your test project

---

## Troubleshooting

### "S3 credentials not configured"
- **Problem**: You see warning in logs about S3 not configured
- **Solution**: Check `.env.local` has all three variables set correctly
- **Check**: `echo $AWS_ACCESS_KEY_ID` (should print your key, not empty)

### "Access Denied" errors
- **Problem**: 403 Forbidden when trying to upload
- **Solution**:
  - Verify IAM user has `AmazonS3FullAccess` policy attached
  - Check bucket name is spelled correctly
  - Verify credentials are for the correct AWS account
- **Re-generate**: Delete the access key and create a new one

### "NoSuchBucket" errors
- **Problem**: Bucket doesn't exist
- **Solution**:
  - Check bucket name in `.env` matches exactly (case-sensitive)
  - Bucket might be in different AWS region
  - Verify bucket wasn't deleted

### S3 Bucket not showing files
- **Problem**: Files not appearing in AWS console after upload
- **Solution**:
  - Wait a few seconds (eventual consistency)
  - Refresh the S3 console page
  - Check you're looking in the right bucket
  - Verify IAM user has ListBucket permission

### Development works, Production fails
- **Problem**: Works locally but fails on Vercel
- **Solution**:
  - Check all environment variables are set in Vercel dashboard
  - Verify `S3_BUCKET_NAME` is different for production (recommended)
  - Check production IAM credentials have S3 access
  - Review Vercel build logs for specific error messages

### CORS errors when uploading from browser
- **Problem**: "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Solution**: Update S3 bucket CORS policy with your Vercel domain
- **Example**: Change `https://your-vercel-domain.vercel.app` to your actual domain

---

## Cost Estimation

### Free Tier (12 months)
- 5 GB storage free
- 20,000 GET requests free
- 2,000 PUT/POST/DELETE requests free

### Beyond Free Tier (approximate pricing)
- **Storage**: $0.023 per GB/month (US)
- **GET requests**: $0.0004 per 1,000 requests
- **PUT requests**: $0.005 per 1,000 requests

### Example: 100 projects with 10 artifacts each
- **Storage**: ~50 MB = $0.001/month
- **Monthly requests**: ~1,000 uploads + 2,000 downloads = <$0.01/month
- **Total**: Less than $1/month

---

## Next Steps

1. ✅ Create S3 bucket and IAM user (you're here!)
2. ✅ Set up local development with `.env.local`
3. ✅ Test locally
4. ⬜ Deploy to Vercel with environment variables
5. ⬜ Test production deployment
6. ⬜ Monitor costs in AWS Billing dashboard

---

## Security Best Practices

✅ **DO**:
- Use different credentials for dev and production
- Rotate credentials every 90 days
- Keep Secret Access Key secret (never commit to git)
- Use IAM users instead of root credentials
- Enable S3 bucket versioning for backup
- Enable S3 server-side encryption

❌ **DON'T**:
- Commit credentials to git
- Use root AWS credentials
- Share credentials via email/Slack
- Use the same credentials for development and production
- Make bucket public
- Disable encryption

---

## Reference Links

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Pricing Calculator](https://calculator.aws/)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

**Questions?** Check the project README or AWS documentation for more details!

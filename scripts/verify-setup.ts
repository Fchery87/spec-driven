#!/usr/bin/env tsx
/**
 * Comprehensive Setup Verification Script
 * Verifies that Neon Database, Drizzle ORM, Better-Auth, and Cloudflare R2 are properly configured
 *
 * Run with: npm run verify-setup
 */

// Load environment variables before any checks
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });

console.log('🔍 Spec-Driven Platform - Setup Verification\n');
console.log('='.repeat(60));

// Check Environment Variables
console.log('\n📋 Step 1: Checking Environment Variables...\n');

const requiredEnvVars = [
  { name: 'DATABASE_URL', description: 'Neon PostgreSQL connection string' },
  { name: 'BETTER_AUTH_SECRET', description: 'Better-Auth secret key' },
  { name: 'NEXT_PUBLIC_APP_URL', description: 'Public app URL' },
];

const optionalEnvVars = [
  { name: 'CLOUDFLARE_ACCOUNT_ID', alt: 'R2_ACCOUNT_ID', description: 'Cloudflare R2 account ID' },
  { name: 'CLOUDFLARE_ACCESS_KEY_ID', alt: 'R2_ACCESS_KEY_ID', description: 'Cloudflare R2 access key' },
  { name: 'CLOUDFLARE_SECRET_ACCESS_KEY', alt: 'R2_SECRET_ACCESS_KEY', description: 'Cloudflare R2 secret key' },
  { name: 'R2_BUCKET_NAME', description: 'R2 bucket name' },
  { name: 'GEMINI_API_KEY', description: 'Google Gemini API key (LLM)' },
  { name: 'OPENAI_API_KEY', description: 'OpenAI API key (LLM)' },
  { name: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API key (LLM)' },
];

let missingRequired = 0;
let missingOptional = 0;

// Check required variables
requiredEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  if (value && value.length > 0) {
    console.log(`✅ ${name.padEnd(30)} - ${description}`);
  } else {
    console.log(`❌ ${name.padEnd(30)} - ${description} (MISSING)`);
    missingRequired++;
  }
});

console.log('');

// Check optional variables
console.log('📦 Optional Configuration:\n');
optionalEnvVars.forEach(({ name, alt, description }) => {
  const value = process.env[name] || (alt && process.env[alt]);
  const envName = alt ? `${name} or ${alt}` : name;
  if (value && value.length > 0) {
    console.log(`✅ ${envName.padEnd(45)} - ${description}`);
  } else {
    console.log(`⚠️  ${envName.padEnd(45)} - ${description} (Optional)`);
    missingOptional++;
  }
});

// Configuration Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Configuration Summary:\n');

if (missingRequired === 0) {
  console.log('✅ All required environment variables are configured');
} else {
  console.log(`❌ Missing ${missingRequired} required environment variable(s)`);
  console.log('   Please check your .env file and copy from .env.example');
}

if (missingOptional > 0) {
  console.log(`⚠️  ${missingOptional} optional variable(s) not configured`);
  console.log('   These are needed for specific features (R2 storage, LLM providers)');
}

// Database Configuration Check
console.log('\n' + '='.repeat(60));
console.log('\n🗄️  Step 2: Database Configuration Check...\n');

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  // Parse database URL to check format
  try {
    const url = new URL(databaseUrl);
    console.log('✅ Database URL format valid');
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);

    // Check for required SSL parameters
    const params = new URLSearchParams(url.search);
    if (params.has('sslmode')) {
      console.log(`✅ SSL mode: ${params.get('sslmode')}`);
    } else {
      console.log('⚠️  SSL mode not specified (recommended: sslmode=require)');
    }
  } catch (error) {
    console.log('❌ Invalid DATABASE_URL format');
  }
} else {
  console.log('❌ DATABASE_URL not configured');
}

// R2 Storage Configuration Check
console.log('\n' + '='.repeat(60));
console.log('\n☁️  Step 3: Cloudflare R2 Storage Check...\n');

const r2AccountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const r2AccessKey = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID;
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const r2Bucket = process.env.R2_BUCKET_NAME;

if (r2AccountId && r2AccessKey && r2SecretKey && r2Bucket) {
  console.log('✅ R2 configuration complete');
  console.log(`   Account ID: ${r2AccountId.substring(0, 8)}...`);
  console.log(`   Bucket: ${r2Bucket}`);
  console.log('   R2 endpoint will be: https://' + r2AccountId + '.r2.cloudflarestorage.com');
} else {
  console.log('⚠️  R2 configuration incomplete');
  console.log('   R2 is optional for local development (uses filesystem fallback)');
  console.log('   Required for production deployments');
  if (!r2AccountId) console.log('   Missing: R2_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID');
  if (!r2AccessKey) console.log('   Missing: R2_ACCESS_KEY_ID or CLOUDFLARE_ACCESS_KEY_ID');
  if (!r2SecretKey) console.log('   Missing: R2_SECRET_ACCESS_KEY or CLOUDFLARE_SECRET_ACCESS_KEY');
  if (!r2Bucket) console.log('   Missing: R2_BUCKET_NAME');
}

// Better-Auth Configuration Check
console.log('\n' + '='.repeat(60));
console.log('\n🔐 Step 4: Better-Auth Configuration Check...\n');

const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_BASE_URL;

if (authSecret && authSecret.length >= 32) {
  console.log('✅ Authentication secret configured (length >= 32 characters)');
} else if (authSecret) {
  console.log('⚠️  Authentication secret too short (should be >= 32 characters)');
  console.log('   Generate a new one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
} else {
  console.log('❌ Authentication secret not configured');
}

if (appUrl) {
  console.log(`✅ App URL configured: ${appUrl}`);
} else {
  console.log('❌ NEXT_PUBLIC_APP_URL not configured');
}

// LLM Configuration Check
console.log('\n' + '='.repeat(60));
console.log('\n🤖 Step 5: LLM Provider Configuration Check...\n');

const llmProviders = [
  { name: 'Gemini', key: process.env.GEMINI_API_KEY },
  { name: 'OpenAI', key: process.env.OPENAI_API_KEY },
  { name: 'Anthropic', key: process.env.ANTHROPIC_API_KEY },
  { name: 'Groq', key: process.env.GROQ_API_KEY },
  { name: 'DeepSeek', key: process.env.DEEPSEEK_API_KEY },
];

const configuredProviders = llmProviders.filter(p => p.key && p.key.length > 0);

if (configuredProviders.length > 0) {
  console.log(`✅ ${configuredProviders.length} LLM provider(s) configured:`);
  configuredProviders.forEach(p => console.log(`   - ${p.name}`));
} else {
  console.log('⚠️  No LLM providers configured');
  console.log('   At least one LLM provider is required for AI-driven orchestration');
  console.log('   Configure in .env or via Admin UI');
}

// Files and Directories Check
console.log('\n' + '='.repeat(60));
console.log('\n📁 Step 6: Required Files and Directories...\n');

const fs = require('fs');
const path = require('path');

const requiredPaths = [
  { path: 'backend/lib/schema.ts', desc: 'Database schema' },
  { path: 'backend/lib/drizzle.ts', desc: 'Drizzle ORM connection' },
  { path: 'src/lib/auth.ts', desc: 'Better-Auth configuration' },
  { path: 'src/lib/r2-storage.ts', desc: 'R2 storage service' },
  { path: 'drizzle.config.ts', desc: 'Drizzle config' },
  { path: 'orchestrator_spec.yml', desc: 'Orchestrator specification' },
];

requiredPaths.forEach(({ path: filePath, desc }) => {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath.padEnd(35)} - ${desc}`);
  } else {
    console.log(`❌ ${filePath.padEnd(35)} - ${desc} (MISSING)`);
  }
});

// Final Summary
console.log('\n' + '='.repeat(60));
console.log('\n🎯 Final Status:\n');

if (missingRequired === 0 && databaseUrl && authSecret && configuredProviders.length > 0) {
  console.log('✅ Core setup complete! Your application is ready to run.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Start the development server: npm run dev');
  console.log('  2. Visit http://localhost:3000');
  console.log('  3. Create an account and start creating projects');
} else {
  console.log('⚠️  Setup incomplete. Please address the following:\n');

  if (missingRequired > 0) {
    console.log('❌ Missing required environment variables');
    console.log('   → Copy .env.example to .env and fill in required values\n');
  }

  if (!authSecret || authSecret.length < 32) {
    console.log('❌ Better-Auth secret not properly configured');
    console.log('   → Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  }

  if (configuredProviders.length === 0) {
    console.log('❌ No LLM providers configured');
    console.log('   → Add at least one API key (GEMINI_API_KEY, OPENAI_API_KEY, etc.)\n');
  }
}

console.log('');
console.log('For detailed setup instructions, see: README.md');
console.log('');
console.log('='.repeat(60));

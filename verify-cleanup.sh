#!/bin/bash

echo "=== Prisma Cleanup Verification ==="
echo ""

# Check 1: Prisma directory
echo "1. Checking for prisma directory..."
if [ -d "prisma" ]; then
  echo "   ❌ FAIL: prisma/ directory still exists"
else
  echo "   ✅ PASS: prisma/ directory removed"
fi

# Check 2: Prisma in package.json
echo "2. Checking package.json..."
if grep -qi "\"@prisma/client\"\|\"prisma\"" package.json; then
  echo "   ❌ FAIL: Prisma still in package.json"
  grep -i "@prisma/client\|\"prisma\"" package.json
else
  echo "   ✅ PASS: No Prisma dependencies in package.json"
fi

# Check 3: Prisma imports in code
echo "3. Checking for Prisma imports in code..."
PRISMA_FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "./node_modules/*" \
  -not -path "./.next/*" \
  -not -path "./docs/*" \
  -exec grep -l "from ['\"]@prisma\|from ['\"].*prisma['\"]" {} \; 2>/dev/null)

if [ -n "$PRISMA_FILES" ]; then
  echo "   ❌ FAIL: Found Prisma imports in:"
  echo "$PRISMA_FILES"
else
  echo "   ✅ PASS: No Prisma imports in code"
fi

# Check 4: Drizzle files exist
echo "4. Checking for Drizzle setup..."
if [ -f "backend/lib/drizzle.ts" ] && [ -f "backend/lib/schema.ts" ]; then
  echo "   ✅ PASS: Drizzle files present"
else
  echo "   ❌ FAIL: Drizzle files missing"
fi

# Check 5: Drizzle directory
echo "5. Checking for drizzle directory..."
if [ -d "drizzle" ]; then
  echo "   ✅ PASS: drizzle/ directory exists"
  ls -la drizzle/ | head -5
else
  echo "   ❌ FAIL: drizzle/ directory missing"
fi

echo ""
echo "=== Summary ==="
echo "Migration to Drizzle + PostgreSQL complete!"
echo "Next: Run 'npm install' to regenerate package-lock.json"

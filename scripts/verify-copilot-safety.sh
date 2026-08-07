#!/bin/bash

echo "🔍 Verifying Copilot Variant Safety..."

# Check branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "feat/copilot-variant" ]; then
  echo "⚠️  Warning: Not on feat/copilot-variant branch (current: $BRANCH)"
fi

# Check directory exists
if [ ! -d "src/pages/sandbox-copilot" ]; then
  echo "❌ Copilot directory not found"
  exit 1
fi

# Check no modifications to existing sandbox
MODIFIED=$(git diff --name-only main...HEAD | grep "^src/pages/sandbox/[^-]" || true)
if [ -n "$MODIFIED" ]; then
  echo "❌ Existing sandbox files modified:"
  echo "$MODIFIED"
  exit 1
fi

# Run linter
echo "Running ESLint checks..."
npm run lint:copilot
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi

# Check TypeScript.
# Was `npx tsc --noEmit --project tsconfig.json` — a solution stub with
# `"files": []`, which compiles nothing and exits 0 on any tree. That is not a
# check. Call the real gate.
echo "Running TypeScript checks..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found"
  exit 1
fi

echo "✅ All safety checks passed"

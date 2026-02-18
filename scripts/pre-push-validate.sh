#!/usr/bin/env bash
# pre-push-validate.sh — Gate that catches deployment failures before push.
# Exit non-zero on any failure. Runs all checks (no early abort).
set -euo pipefail

FAILURES=0
REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git branch --show-current)"
# Files that would be pushed (diff against upstream, fall back to HEAD~1)
UPSTREAM="$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || true)"
if [ -n "$UPSTREAM" ]; then
  CHANGED_FILES="$(git diff --name-only "$UPSTREAM"..HEAD 2>/dev/null || echo '(no upstream diff)')"
else
  CHANGED_FILES="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo '(initial commit)')"
fi

header() { printf '\n\033[1;34m── %s ──\033[0m\n' "$1"; }
pass()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
fail()   { printf '  \033[31m✗ %s\033[0m\n' "$1"; FAILURES=$((FAILURES + 1)); }
skip()   { printf '  \033[33m⊘ %s\033[0m\n' "$1"; }

# ─── Check 1: Branch guard ────────────────────────────────────────────
header "Check 1 — Branch guard"

PUSH_TO_MAIN=0

# When invoked as a git pre-push hook, stdin provides ref info:
#   <local ref> <local sha> <remote ref> <remote sha>
if [ ! -t 0 ]; then
  while IFS=' ' read -r _local_ref _local_sha remote_ref _remote_sha; do
    if [ "$remote_ref" = "refs/heads/main" ]; then
      PUSH_TO_MAIN=1
    fi
  done
fi

# Also block if current branch is main (direct invocation)
if [ "$BRANCH" = "main" ]; then
  PUSH_TO_MAIN=1
fi

if [ "$PUSH_TO_MAIN" -eq 1 ]; then
  fail "Push to main blocked. Merge via PR only."
else
  pass "Branch '$BRANCH' OK (not pushing to main)"
fi

# ─── Check 2: TypeScript compilation ──────────────────────────────────
header "Check 2 — TypeScript compilation"

if npm run typecheck 2>&1; then
  pass "TypeScript compilation succeeded"
else
  fail "TypeScript compilation failed"
fi

# ─── Check 3: Test suite (changed test files) ───────────────────────
header "Check 3 — Test suite (changed test files)"

TEST_OUTPUT_FILE="$(mktemp /tmp/pre-push-test-XXXXXX)"

# Find changed test/spec files in the commit range
CHANGED_TEST_FILES=""
if [ -n "$UPSTREAM" ]; then
  CHANGED_TEST_FILES="$(git diff --name-only "$UPSTREAM"..HEAD -- '*.spec.*' '*.test.*' 2>/dev/null || true)"
else
  CHANGED_TEST_FILES="$(git diff --name-only HEAD~1 HEAD -- '*.spec.*' '*.test.*' 2>/dev/null || true)"
fi

if [ -z "$CHANGED_TEST_FILES" ]; then
  skip "No test files changed — skipping tests"
else
  echo "  Running changed test files:"
  echo "$CHANGED_TEST_FILES" | while IFS= read -r f; do echo "    $f"; done
  # shellcheck disable=SC2086
  if NODE_OPTIONS=--max-old-space-size=4096 npx vitest run $CHANGED_TEST_FILES --bail=1 2>&1 | tee "$TEST_OUTPUT_FILE"; then
    pass "Test suite passed (changed test files)"
    rm -f "$TEST_OUTPUT_FILE"
  else
    fail "Test suite failed (last 40 lines below)"
    echo ""
    tail -40 "$TEST_OUTPUT_FILE"
    echo ""
    echo "  Full output: $TEST_OUTPUT_FILE"
  fi
fi

# ─── Check 4: Stale .js detection ─────────────────────────────────────
header "Check 4 — Stale .js in src/"

STALE_JS=0
while IFS= read -r js_file; do
  ts_file="${js_file%.js}.ts"
  tsx_file="${js_file%.js}.tsx"
  if git ls-files --error-unmatch "$ts_file" >/dev/null 2>&1 || \
     git ls-files --error-unmatch "$tsx_file" >/dev/null 2>&1; then
    echo "    stale: $js_file (co-located .ts/.tsx exists)"
    STALE_JS=1
  fi
done < <(git ls-files -- 'src/**/*.js' 'src/*.js' 2>/dev/null | sort -u)

if [ "$STALE_JS" -eq 1 ]; then
  fail "Stale .js files found with co-located .ts/.tsx"
else
  pass "No stale .js files detected"
fi

# ─── Check 5: Dependency audit ─────────────────────────────────────────
header "Check 5 — Dependency audit (file: references)"

# Known intentional file: references (monorepo local packages)
KNOWN_FILE_REFS="packages/olumi-schemas"

UNEXPECTED_FILE_REFS=0

check_file_ref() {
  local file="$1"
  local line="$2"
  local known=0
  for ref in $KNOWN_FILE_REFS; do
    if echo "$line" | grep -q "$ref"; then
      known=1
      break
    fi
  done
  if [ "$known" -eq 0 ]; then
    echo "    unexpected file: reference in $file:"
    echo "      $line"
    UNEXPECTED_FILE_REFS=1
  fi
}

# Check package.json
while IFS= read -r line; do
  check_file_ref "package.json" "$line"
done < <(grep -n '"file:' "$REPO_ROOT/package.json" 2>/dev/null || true)

# Check package-lock.json (full scan)
while IFS= read -r line; do
  check_file_ref "package-lock.json" "$line"
done < <(grep -n '"file:' "$REPO_ROOT/package-lock.json" 2>/dev/null || true)

if [ "$UNEXPECTED_FILE_REFS" -eq 1 ]; then
  fail "Unexpected file: dependency references found"
else
  pass "No unexpected file: references (known: @talchain/schemas → packages/olumi-schemas)"
fi

# ─── Check 6: OpenAPI freshness ────────────────────────────────────────
header "Check 6 — OpenAPI freshness"

# Detect OpenAPI/Swagger generation scripts in package.json or scripts/
OPENAPI_SCRIPT=""
if grep -qE '"(openapi|swagger|generate:api|generate:openapi|generate:swagger)' "$REPO_ROOT/package.json" 2>/dev/null; then
  OPENAPI_SCRIPT="$(grep -oE '"(openapi|swagger|generate:api|generate:openapi|generate:swagger)[^"]*"' "$REPO_ROOT/package.json" | head -1 | tr -d '"')"
fi
if [ -z "$OPENAPI_SCRIPT" ] && ls "$REPO_ROOT/scripts/"*openapi* "$REPO_ROOT/scripts/"*swagger* 2>/dev/null | head -1 >/dev/null 2>&1; then
  OPENAPI_SCRIPT="$(ls "$REPO_ROOT/scripts/"*openapi* "$REPO_ROOT/scripts/"*swagger* 2>/dev/null | head -1)"
fi

if [ -n "$OPENAPI_SCRIPT" ]; then
  echo "  Found generation script: $OPENAPI_SCRIPT"
  # Run generation and check for uncommitted diff
  if npm run "$OPENAPI_SCRIPT" 2>&1 >/dev/null; then
    if git diff --quiet; then
      pass "OpenAPI spec is up to date"
    else
      fail "OpenAPI spec is stale — regenerated files differ from committed"
      git diff --stat
    fi
  else
    fail "OpenAPI generation script failed"
  fi
else
  skip "No OpenAPI/Swagger generation script detected in package.json or scripts/. Skipped."
fi

# ─── Check 7: Summary ──────────────────────────────────────────────────
header "Summary"

echo "  Branch:        $BRANCH"
echo "  Changed files: $(echo "$CHANGED_FILES" | wc -l | tr -d ' ') file(s)"
echo ""

if [ "$FAILURES" -eq 0 ]; then
  printf '  \033[1;32m▸ ALL CHECKS PASSED\033[0m\n'
  exit 0
else
  printf '  \033[1;31m▸ %d CHECK(S) FAILED\033[0m\n' "$FAILURES"
  exit 1
fi

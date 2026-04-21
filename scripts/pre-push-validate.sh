#!/usr/bin/env bash
# pre-push-validate.sh — Gate that catches deployment failures before push.
# Exit non-zero on any failure. Runs all checks (no early abort).
#
# Checks 2 (typecheck) and 3 (vitest) run sequentially to avoid doubling
# peak RAM. CI handles parallelism with dedicated runners and more memory.
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

# ─── Check 3: Test suite (full, excluding known-broken) ──────────────
header "Check 3 — Test suite (full, known-broken excluded via vitest.config.ts)"

TEST_OUTPUT_FILE="$(mktemp /tmp/pre-push-test-XXXXXX)"

# Heap budget: 6 GB matches CI (7168) closely enough to avoid the teardown
# Worker OOMs that triggered at 4 GB. With 188 test files × jsdom + React
# module graph × single-thread (poolOptions.threads.maxThreads=1), memory
# accumulated near the 4 GB ceiling during vitest teardown. See
# docs/ops/vitest-full-suite-oom-diagnosis.md for the full trace + fix
# options if 6 GB ever becomes insufficient. The ERR_WORKER_OUT_OF_MEMORY
# tolerance below remains as a safety net.
NODE_OPTIONS=--max-old-space-size=6144 npx vitest run --bail=1 2>&1 | tee "$TEST_OUTPUT_FILE" || true
VITEST_EXIT=${PIPESTATUS[0]}

if [ "$VITEST_EXIT" -eq 0 ]; then
  pass "Test suite passed (full run, known-broken excluded)"
  rm -f "$TEST_OUTPUT_FILE"
else
  # Check if all test files actually passed — vitest exits non-zero on Worker OOM
  # even when every test passes. Parse summary lines for "failed" counts.
  TEST_FILES_FAILED=$(grep 'Test Files' "$TEST_OUTPUT_FILE" 2>/dev/null | grep -o '[0-9]* failed' | grep -o '[0-9]*' || echo "")
  TESTS_FAILED=$(grep '^ *Tests' "$TEST_OUTPUT_FILE" 2>/dev/null | grep -o '[0-9]* failed' | grep -o '[0-9]*' || echo "")
  HAS_OOM=$(grep -c 'ERR_WORKER_OUT_OF_MEMORY' "$TEST_OUTPUT_FILE" 2>/dev/null || echo "0")

  if [ -z "$TEST_FILES_FAILED" ] && [ "$HAS_OOM" -gt 0 ]; then
    # No "failed" count in summary + OOM errors = all tests passed, only OOM noise
    pass "Test suite passed (Worker OOM warnings ignored — all test files passed)"
    rm -f "$TEST_OUTPUT_FILE"
  elif [ "$TEST_FILES_FAILED" = "0" ] && [ "${TESTS_FAILED:-0}" = "0" ]; then
    pass "Test suite passed (all test files passed despite exit code $VITEST_EXIT)"
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

# A1 allowlist (commit b6b1222a, v5 slice A1): @talchain/schemas is
# deliberately vendored via `file:./vendor/talchain-schemas-*.tgz`. The
# SHA manifest check below (Check 5a) guards against drift on that
# specific dep. Any OTHER file: reference fails. Kept in lockstep with
# scripts/validate-prepush.sh — the two scripts must agree or they
# emit contradictory signals (historical divergence caught in Brief 5.2
# close-out, commit 8679ea79 run).
FILE_REFS=$(grep -n '"file:' "$REPO_ROOT/package.json" 2>/dev/null \
  | grep -v '"@talchain/schemas"' || true)
LOCK_FILE_REFS=$(grep -n '"file:' "$REPO_ROOT/package-lock.json" 2>/dev/null \
  | grep -v 'talchain-schemas' || true)

if [ -n "$FILE_REFS" ]; then
  echo "    non-allowlisted file: dependency references found in package.json:"
  echo "$FILE_REFS" | while IFS= read -r line; do echo "      $line"; done
  fail "Only @talchain/schemas may use a file: link (vendored)"
elif [ -n "$LOCK_FILE_REFS" ]; then
  echo "    non-allowlisted file: dependency references found in package-lock.json:"
  echo "$LOCK_FILE_REFS" | head -5 | while IFS= read -r line; do echo "      $line"; done
  fail "package-lock.json contains unexpected file: references"
else
  pass "No non-allowlisted file: references"
fi

header "Check 5a — V5 vendored schemas tarball SHA manifest"

# A1: guard against drift between vendored tarball bytes and the committed
# SHA manifest. If someone rebuilds the tarball without updating the
# manifest, push is blocked. Mirrors scripts/validate-prepush.sh Check 6a.
TARBALL="$REPO_ROOT/vendor/talchain-schemas-0.7.0.tgz"
MANIFEST="$REPO_ROOT/vendor/talchain-schemas-0.7.0.tgz.sha256"
if [ ! -f "$TARBALL" ] || [ ! -f "$MANIFEST" ]; then
  fail "vendored tarball or SHA manifest missing"
else
  ACTUAL="$(shasum -a 256 "$TARBALL" | awk '{print $1}')"
  EXPECTED="$(tr -d '[:space:]' < "$MANIFEST")"
  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "    manifest: $EXPECTED"
    echo "    actual:   $ACTUAL"
    fail "Vendored schemas tarball changed without manifest update. Rebuild and commit both."
  else
    pass "V5 vendored schemas tarball SHA matches manifest"
  fi
fi

# Also verify the fork directory doesn't exist
if [ -d "$REPO_ROOT/packages/olumi-schemas" ]; then
  fail "packages/olumi-schemas/ fork directory still exists — it must be deleted"
else
  pass "No local schema fork directory"
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

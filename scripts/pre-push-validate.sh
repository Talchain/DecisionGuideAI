#!/usr/bin/env bash
# pre-push-validate.sh — Gate that catches deployment failures before push.
# Exit non-zero on any failure. Runs all checks (no early abort).
#
# Checks 2 (typecheck) and 3 (vitest) run sequentially to avoid doubling
# peak RAM. CI handles parallelism with dedicated runners and more memory.
set -euo pipefail

# Resolve the package runner. This repo is pnpm-only (`packageManager` in
# package.json; pnpm-lock.yaml is the only tracked lockfile). npm remains ONLY
# as a last-resort fallback and must announce itself loudly, never substitute
# silently: npm ignores pnpm-lock.yaml and can resolve a different dependency
# tree than the one CI installs. Kept in lockstep with validate-prepush.sh.
if command -v pnpm &>/dev/null; then
  PKG_RUN=(pnpm run)
  PKG_EXEC=(pnpm exec)
else
  printf '\033[1;33m⚠ WARNING: pnpm not found on PATH — falling back to npm/npx.\n'
  printf '  This repo is pnpm-only (package.json "packageManager" pins pnpm;\n'
  printf '  pnpm-lock.yaml is the only tracked lockfile). npm is OFF-CONTRACT here:\n'
  printf '  it does not read pnpm-lock.yaml, so it may typecheck/test against a\n'
  printf '  different dependency tree. Install pnpm (e.g. `corepack enable`) and\n'
  printf '  re-run before trusting this result.\033[0m\n'
  if ! command -v npm &>/dev/null; then
    printf '\033[1;31mNeither pnpm nor npm found on PATH — cannot run the gate.\033[0m\n' >&2
    exit 1
  fi
  PKG_RUN=(npm run)
  PKG_EXEC=(npx --no-install)
fi

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

if "${PKG_RUN[@]}" typecheck 2>&1; then
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
NODE_OPTIONS=--max-old-space-size=6144 "${PKG_EXEC[@]}" vitest run --bail=1 2>&1 | tee "$TEST_OUTPUT_FILE" || true
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
# The lockfile arm audits pnpm-lock.yaml — the repo's ONLY lockfile. Until
# 2026-07-30 it grepped package-lock.json, which does not exist here, so the
# arm passed vacuously: an absence assertion that could never see a presence.
# See scripts/validate-prepush.sh Check 6 for the serialisation notes; the two
# blocks are kept in lockstep.
FILE_REFS=$(grep -n '"file:' "$REPO_ROOT/package.json" 2>/dev/null \
  | grep -v '"@talchain/schemas"' || true)

PNPM_LOCKFILE="$REPO_ROOT/pnpm-lock.yaml"
LOCK_REF_PATTERN="[[:space:]'\"@]file:"
# Allowlist: exempt only refs whose file: TARGET is the vendored schemas
# tarball (any version — Check 5a pins the bytes via the SHA manifest).
ALLOWED_LOCK_REF="file:(\./)?vendor/talchain-schemas-[^/[:space:]]*\.tgz"
LOCK_AUDIT_BROKEN=0
LOCK_FILE_REFS=""
if [ ! -f "$PNPM_LOCKFILE" ]; then
  LOCK_AUDIT_BROKEN=1
  fail "pnpm-lock.yaml not found — the lockfile file:-ref audit cannot run (this repo is pnpm-only)"
elif ! grep -aqE "${LOCK_REF_PATTERN}(\./)?vendor/talchain-schemas-" "$PNPM_LOCKFILE"; then
  # Positive control: the pattern must SEE the one known file: ref (the
  # vendored schemas tarball) before its verdict on all others means anything.
  LOCK_AUDIT_BROKEN=1
  fail "Lockfile audit positive control failed: pattern cannot see the vendored @talchain/schemas file: ref in pnpm-lock.yaml — serialisation or pattern drift; the audit would be vacuous"
else
  LOCK_FILE_REFS=$(grep -anE "$LOCK_REF_PATTERN" "$PNPM_LOCKFILE" \
    | grep -vE "$ALLOWED_LOCK_REF" || true)
fi

if [ -n "$FILE_REFS" ]; then
  echo "    non-allowlisted file: dependency references found in package.json:"
  echo "$FILE_REFS" | while IFS= read -r line; do echo "      $line"; done
  fail "Only @talchain/schemas may use a file: link (vendored)"
elif [ -n "$LOCK_FILE_REFS" ]; then
  echo "    non-allowlisted file: dependency references found in pnpm-lock.yaml:"
  echo "$LOCK_FILE_REFS" | head -5 | while IFS= read -r line; do echo "      $line"; done
  fail "pnpm-lock.yaml contains unexpected file: references"
elif [ "$LOCK_AUDIT_BROKEN" -eq 1 ]; then
  : # already failed above — do not print a pass for an audit that could not run
else
  pass "No non-allowlisted file: references"
fi

header "Check 5a — V5 vendored schemas tarball SHA manifest"

# A1: guard against drift between vendored tarball bytes and the committed
# SHA manifest. If someone rebuilds the tarball without updating the manifest,
# push is blocked.
#
# DELEGATED, deliberately — do not re-implement the comparison here.
# This check previously duplicated validate-prepush.sh Check 6a line for line,
# including its defect: `tr -d '[:space:]' < "$MANIFEST"` collapses the
# standard two-column shasum format (`<hash>  <filename>`) into the hash
# CONCATENATED with the filename, which can never equal a bare 64-char hash.
# Both copies therefore always failed once the manifest gained the filename
# column — every push from schemas 0.29.0 (2026-07-28, #513) onward. The
# duplication is what let one defect break two gates, so the two now share
# ONE implementation instead of mirroring each other.
#
# scripts/check-vendor-sha.mjs is the single source of truth. It derives the
# tarball name from package.json's dependency field, accepts BOTH manifest
# formats (`<hash>` and `<hash>  <filename>`), asserts the hash is 64 hex
# chars, and prints a remediation block on mismatch.
if node "$REPO_ROOT/scripts/check-vendor-sha.mjs"; then
  pass "V5 vendored schemas tarball SHA matches manifest"
else
  fail "Vendored schemas tarball changed without manifest update, or manifest is unreadable (see above). Rebuild and commit both."
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
  if "${PKG_RUN[@]}" "$OPENAPI_SCRIPT" 2>&1 >/dev/null; then
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

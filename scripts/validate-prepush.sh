#!/usr/bin/env bash
# validate-prepush.sh — Fast pre-push gate (~3 min target).
#
# Runs: branch guard, typecheck, lint (changed files only), smoke tests,
# stale .js detection, and dependency audit.
#
# The FULL test suite (6,900+ tests) runs in CI after push — see
# .github/workflows/staging-full-tests.yml. This script is intentionally
# lightweight to avoid the 18-min full suite and Worker OOM issues.
set -euo pipefail

# Ensure Node.js is on PATH (nvm, brew, or system)
if ! command -v npm &>/dev/null; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
if ! command -v npm &>/dev/null; then
  # Try common Homebrew paths
  for p in /usr/local/bin /opt/homebrew/bin; do
    [ -x "$p/npm" ] && export PATH="$p:$PATH" && break
  done
fi

FAILURES=0
REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git branch --show-current)"
# Files that would be pushed (diff against upstream, fall back to HEAD~1)
UPSTREAM="$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || true)"
if [ -n "$UPSTREAM" ]; then
  CHANGED_FILES="$(git diff --name-only "$UPSTREAM"..HEAD 2>/dev/null || true)"
else
  CHANGED_FILES="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)"
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

# ─── Check 3: Lint (changed files only) ──────────────────────────────
header "Check 3 — Lint (changed .ts/.tsx files only)"

CHANGED_TS_FILES=""
if [ -n "$UPSTREAM" ]; then
  CHANGED_TS_FILES="$(git diff --name-only "$UPSTREAM"..HEAD -- '*.ts' '*.tsx' 2>/dev/null | grep -E '\.(ts|tsx)$' || true)"
else
  CHANGED_TS_FILES="$(git diff --name-only HEAD~1 HEAD -- '*.ts' '*.tsx' 2>/dev/null | grep -E '\.(ts|tsx)$' || true)"
fi

if [ -z "$CHANGED_TS_FILES" ]; then
  skip "No .ts/.tsx files changed — lint skipped"
else
  # Filter to files that actually exist (may have been deleted)
  EXISTING_LINT_FILES=()
  while IFS= read -r f; do
    [ -f "$REPO_ROOT/$f" ] && EXISTING_LINT_FILES+=("$REPO_ROOT/$f")
  done <<< "$CHANGED_TS_FILES"

  if [ "${#EXISTING_LINT_FILES[@]}" -eq 0 ]; then
    skip "All changed .ts/.tsx files were deleted — lint skipped"
  elif npx eslint --no-error-on-unmatched-pattern "${EXISTING_LINT_FILES[@]}" 2>&1; then
    pass "Lint passed (${#EXISTING_LINT_FILES[@]} changed file(s))"
  else
    fail "Lint failed on changed files"
  fi
fi

# ─── Check 4: Smoke tests (critical data-flow paths) ─────────────────
header "Check 4 — Smoke tests (critical data-flow paths)"

# Core data-flow pipeline: CEE → Canvas → PLoT → Results
# These 8 test files cover the critical render + data flow paths.
# Full suite (6,900+ tests) runs in CI post-push.
SMOKE_FILES=(
  "src/adapters/plot/v2/__tests__/adapter.spec.ts"
  "src/adapters/plot/v2/__tests__/responseMapper.spec.ts"
  "src/adapters/cee/__tests__/adaptDraftResponse.spec.ts"
  "src/canvas/__tests__/store.spec.ts"
  "src/utils/__tests__/nodeIdNormalisation.spec.ts"
  "src/components/results/__tests__/buildResultsVM.spec.ts"
  "src/components/results/__tests__/useResultsSectionData.spec.ts"
  "src/components/results/__tests__/HeroSection.spec.tsx"
)

# Filter to files that exist
EXISTING_SMOKE=""
for f in "${SMOKE_FILES[@]}"; do
  [ -f "$REPO_ROOT/$f" ] && EXISTING_SMOKE="$EXISTING_SMOKE $f"
done

if [ -z "$EXISTING_SMOKE" ]; then
  skip "No smoke test files found — skipped"
else
  if npx vitest run --bail=1 $EXISTING_SMOKE 2>&1; then
    pass "Smoke tests passed (critical data-flow paths)"
  else
    fail "Smoke tests failed"
  fi
fi

# ─── Check 5: Stale .js detection ─────────────────────────────────────
header "Check 5 — Stale .js in src/"

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

# ─── Check 6: Dependency audit ─────────────────────────────────────────
header "Check 6 — Dependency audit (file: references)"

# A1 allowlist: @talchain/schemas is deliberately vendored via
# `file:./vendor/talchain-schemas-*.tgz`. The SHA manifest check below
# guards against drift on that specific dep. Any OTHER file: reference fails.
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

header "Check 6a — V5 vendored schemas tarball SHA manifest"

# A1: guard against drift between vendored tarball bytes and the committed
# SHA manifest. If someone rebuilds the tarball without updating the
# manifest, push is blocked.
TARBALL="$REPO_ROOT/vendor/talchain-schemas-0.5.1.tgz"
MANIFEST="$REPO_ROOT/vendor/talchain-schemas-0.5.1.tgz.sha256"
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

# ─── Summary ──────────────────────────────────────────────────────────
header "Summary"

echo "  Branch:        $BRANCH"
if [ -n "$CHANGED_FILES" ]; then
  CHANGED_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
else
  CHANGED_COUNT=0
fi
echo "  Changed files: $CHANGED_COUNT file(s)"
echo "  Mode:          FAST (smoke tests only — full suite runs in CI)"
echo ""

if [ "$FAILURES" -eq 0 ]; then
  printf '  \033[1;32m▸ ALL CHECKS PASSED\033[0m\n'
  exit 0
else
  printf '  \033[1;31m▸ %d CHECK(S) FAILED\033[0m\n' "$FAILURES"
  exit 1
fi

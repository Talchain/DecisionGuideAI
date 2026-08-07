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

# Ensure pnpm is on PATH (nvm, PNPM_HOME, brew, or system). This repo is
# pnpm-only (`packageManager` in package.json; pnpm-lock.yaml is the only
# tracked lockfile) — the gate must hunt for pnpm, not npm.
if ! command -v pnpm &>/dev/null; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
if ! command -v pnpm &>/dev/null; then
  # Try common pnpm install locations (standalone installer, Homebrew, system)
  for p in "${PNPM_HOME:-$HOME/Library/pnpm}" "$HOME/.local/share/pnpm" /usr/local/bin /opt/homebrew/bin; do
    [ -x "$p/pnpm" ] && export PATH="$p:$PATH" && break
  done
fi

# Resolve the package runner. pnpm is the contract. npm remains ONLY as a
# last-resort fallback so a minimal shell can still run the gate — and it must
# announce itself loudly, never substitute silently: npm ignores pnpm-lock.yaml
# and can resolve a different dependency tree than the one CI installs.
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

if "${PKG_RUN[@]}" typecheck 2>&1; then
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
  elif "${PKG_EXEC[@]}" eslint --no-error-on-unmatched-pattern "${EXISTING_LINT_FILES[@]}" 2>&1; then
    pass "Lint passed (${#EXISTING_LINT_FILES[@]} changed file(s))"
  else
    fail "Lint failed on changed files"
  fi
fi

# ─── Check 4: Smoke tests (critical data-flow paths) ─────────────────
header "Check 4 — Smoke tests (critical data-flow paths)"

# Core data-flow pipeline: CEE → Canvas → PLoT → Results
# These test files cover the critical render + data flow paths.
# Full suite (6,900+ tests) runs in CI post-push.
#
# NOTE the css-var guard is here deliberately. It has no static `src/`
# import — it shells out to a census script — so `vitest --changed` can
# NEVER select it, and without this line a freshly-dangling token or a
# freshly-drifted fallback is caught only after the push, in CI. The whole
# point of the guard is to catch it before the colour ships.
SMOKE_FILES=(
  "src/adapters/plot/v2/__tests__/adapter.spec.ts"
  "src/adapters/plot/v2/__tests__/responseMapper.spec.ts"
  "src/adapters/cee/__tests__/adaptDraftResponse.spec.ts"
  "src/canvas/__tests__/store.spec.ts"
  "src/utils/__tests__/nodeIdNormalisation.spec.ts"
  "src/components/results/__tests__/buildResultsVM.spec.ts"
  "src/components/results/__tests__/useResultsSectionData.spec.ts"
  # Hero render path. This line read
  # `src/components/results/__tests__/HeroSection.spec.tsx` until f2596f1d
  # (2026-04-21) deleted that spec as dead code — the component itself had
  # already gone in Brief 5.4 Phase 2, and vitest.config.ts records the same
  # deletion. Nobody updated THIS list, so from that day the existence filter
  # below silently ran 8 of 9 files and still printed "Smoke tests passed".
  # Re-pointed at the hero surface that is actually live on staging:
  # netlify.toml [context.staging.environment] sets
  # VITE_FEATURE_ANALYSIS_HERO_PANEL=1 (the analysis-hero/ family), while
  # analysisHeroV17 is enabled in no netlify context. buildHeroModel is that
  # surface's view-model builder — the data-flow node, matching this list's
  # stated purpose and its buildResultsVM sibling above.
  "src/components/results/analysis-hero/__tests__/buildHeroModel.spec.ts"
  "tests/ci-guards/css-var-resolution.spec.ts"
)

# A missing entry FAILS — it must never silently shrink the suite.
# The old filter dropped non-existent paths without a word, which is the
# hand-maintained-mirror defect this repo keeps paying for: a named critical
# path stops being checked and the gate still reports success. If an entry
# above no longer exists, repoint it at the successor spec or delete the line
# deliberately — both are one-line edits, and both are visible in review.
EXISTING_SMOKE=()
MISSING_SMOKE=()
for f in "${SMOKE_FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    EXISTING_SMOKE+=("$f")
  else
    MISSING_SMOKE+=("$f")
  fi
done

if [ "${#MISSING_SMOKE[@]}" -ne 0 ]; then
  echo "    SMOKE_FILES names ${#MISSING_SMOKE[@]} spec file(s) that do not exist:"
  for f in "${MISSING_SMOKE[@]}"; do echo "      $f"; done
  fail "SMOKE_FILES is stale — a named critical path would go unchecked. Repoint each entry at its successor spec, or delete the line deliberately."
fi

if [ "${#EXISTING_SMOKE[@]}" -eq 0 ]; then
  fail "No smoke test files found — the smoke list must never be empty"
elif "${PKG_EXEC[@]}" vitest run --bail=1 "${EXISTING_SMOKE[@]}" 2>&1; then
  # Report ran-of-named, both derived. A shrink is then visible in the summary
  # line itself, not only in the failure above it.
  pass "Smoke tests passed (${#EXISTING_SMOKE[@]} of ${#SMOKE_FILES[@]} named critical data-flow path(s))"
else
  fail "Smoke tests failed"
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
#
# The lockfile arm audits pnpm-lock.yaml — the repo's ONLY lockfile. Until
# 2026-07-30 it grepped package-lock.json, which does not exist here, so the
# arm passed vacuously: an absence assertion that could never see a presence.
# pnpm-lock.yaml (lockfileVersion 9.0) serialises file: deps on four line
# shapes, all with `file:` preceded by whitespace, a quote, or `@`:
#     specifier: file:./vendor/<name>.tgz             (importers)
#     version: file:vendor/<name>.tgz                 (importers)
#     'pkg@file:vendor/<name>.tgz':                   (packages/snapshots keys)
#     resolution: {..., tarball: file:vendor/<name>.tgz}
# The preceding-char anchor is what keeps identifiers that merely END in
# `file:` (excludeLinksFromLockfile:, jsonfile:, get-caller-file:) from
# false-positiving. grep -a per repo trap 17: absence claims must not go
# silently blind on a NUL-bearing file.
FILE_REFS=$(grep -n '"file:' "$REPO_ROOT/package.json" 2>/dev/null \
  | grep -v '"@talchain/schemas"' || true)

PNPM_LOCKFILE="$REPO_ROOT/pnpm-lock.yaml"
LOCK_REF_PATTERN="[[:space:]'\"@]file:"
# Allowlist: exempt only refs whose file: TARGET is the vendored schemas
# tarball (any version — check 6a pins the bytes via the SHA manifest).
ALLOWED_LOCK_REF="file:(\./)?vendor/talchain-schemas-[^/[:space:]]*\.tgz"
LOCK_AUDIT_BROKEN=0
LOCK_FILE_REFS=""
if [ ! -f "$PNPM_LOCKFILE" ]; then
  LOCK_AUDIT_BROKEN=1
  fail "pnpm-lock.yaml not found — the lockfile file:-ref audit cannot run (this repo is pnpm-only)"
elif ! grep -aqE "${LOCK_REF_PATTERN}(\./)?vendor/talchain-schemas-" "$PNPM_LOCKFILE"; then
  # Positive control: the pattern must SEE the one known file: ref (the
  # vendored schemas tarball) before its verdict on all others means anything.
  # If this fires, the lockfile serialisation or the pattern has drifted and
  # the absence assertion below would be vacuous — fail loud instead.
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

header "Check 6a — V5 vendored schemas tarball SHA manifest"

# A1: guard against drift between vendored tarball bytes and the committed
# SHA manifest. If someone rebuilds the tarball without updating the manifest,
# push is blocked.
#
# DELEGATED, deliberately — do not re-implement the comparison here.
# This check used to hash the tarball and parse the manifest in bash, and the
# parse was wrong: `tr -d '[:space:]' < "$MANIFEST"` collapses the standard
# two-column shasum format (`<hash>  <filename>`) into the hash CONCATENATED
# with the filename, which can never equal a bare 64-char hash. Check 6a
# therefore could not pass on ANY tree whose manifest carried the filename
# column — i.e. every push from schemas 0.29.0 (2026-07-28, #513) onward.
# A supply-chain guard that always fails is worse than no guard: it teaches
# every lane to `--no-verify` past the checks that do work.
#
# scripts/check-vendor-sha.mjs is the single source of truth. It derives the
# tarball name from package.json's dependency field, accepts BOTH manifest
# formats (`<hash>` and `<hash>  <filename>`), asserts the hash is 64 hex
# chars, and prints a remediation block on mismatch. It is the same script
# `pnpm run check:vendor` and `pnpm run dev` already run.
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

# ─── Check 7: Close-out doc consistency ──────────────────────────────
# Conditional: only runs when a `docs/brief-*-final-review.md` is among
# the changed files. Catches stale `(this commit)` placeholders +
# `(pending)` rows in the close-out commit table that the consistency
# check (existing `scripts/check-closeout-doc-consistency.sh`) was
# already designed to flag.
header "Check 7 — Close-out doc consistency"

CHANGED_REVIEW_DOCS=$(echo "$CHANGED_FILES" | grep -E '^docs/brief-[^/]*-final-review\.md$' || true)
if [ -z "$CHANGED_REVIEW_DOCS" ]; then
  pass "No close-out final-review doc changes (skipping)"
else
  if bash "$REPO_ROOT/scripts/check-closeout-doc-consistency.sh" $CHANGED_REVIEW_DOCS; then
    pass "Close-out doc(s) consistent"
  else
    fail "Close-out doc consistency check failed (see above)"
  fi
fi

# ─── Check 8: Design System v5 drift (ENFORCED ratchet) ──────────────
# Promoted from report-only after the soak (2026-07-16, Paul's DS review):
# NET-NEW legacy tokens / raw hex / all-caps / panel-typography drift vs the
# committed baseline (tools/ci-guards/ds-compliance-baseline.json) BLOCKS the
# push. Existing debt does not block — only additions to it. Reducing debt?
# Regenerate the baseline: node tools/ci-guards/check-ds-compliance.mjs --update
# (the hex detector is comment-aware as of the same change — issue refs like
# #343 in comments are not colours).
header "Check 8 — Design System v5 drift (enforced — net-new blocks)"
if node "$REPO_ROOT/tools/ci-guards/check-ds-compliance.mjs" --enforce; then
  pass "DS v5 ratchet clean — no net-new drift"
else
  fail "Net-new DS drift detected (see above). Use tokens; if this is a deliberate exception, discuss before baselining."
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

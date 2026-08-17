#!/usr/bin/env bash
#
# Re-bless the visual-regression reference images for THIS platform.
#
#   scripts/visual/rebless.sh            write references
#   scripts/visual/rebless.sh --check    report what would change, write nothing
#
# Re-blessing is a deliberate, reviewable act. This script never commits, and
# no CI job ever calls it in write mode: if a reference changes, a human has to
# have looked at the image and said why in a commit message. That is the whole
# point — an instrument that silently adopts whatever it last saw is not an
# instrument.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PLATFORM="$(node -p 'process.platform')"
REF_DIR="e2e/visual/references/${PLATFORM}"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

echo "==> repo:     $REPO_ROOT"
echo "==> platform: $PLATFORM"
echo "==> refs:     $REF_DIR"

if [ "$CHECK_ONLY" = "1" ]; then
  echo "==> --check: comparing against committed references, writing nothing"
  pnpm exec playwright test -c playwright.visual.config.ts --reporter=list
  echo "==> no differences (nothing to re-bless)"
  exit 0
fi

# Refuse to re-bless on top of unrelated uncommitted changes to the reference
# tree: the reviewable-commit guarantee is worthless if the diff also contains
# somebody else's half-finished work.
if ! git diff --quiet -- "$REF_DIR" 2>/dev/null; then
  echo "!!  $REF_DIR already has uncommitted changes." >&2
  echo "!!  Commit or discard them first, so the re-bless diff is reviewable on its own." >&2
  exit 1
fi

BEFORE="$(git ls-files "$REF_DIR" | wc -l | tr -d ' ')"
echo "==> committed references before: $BEFORE"

VISREG_BLESS=1 pnpm exec playwright test -c playwright.visual.config.ts --reporter=list

AFTER="$(find "$REF_DIR" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')"
echo "==> reference images on disk after: $AFTER"

# A re-bless that produced no images is a failed re-bless, not a no-op. Without
# this the script would print a cheerful summary having written nothing.
if [ "$AFTER" -eq 0 ]; then
  echo "!!  Re-bless produced ZERO reference images. Something did not run." >&2
  exit 1
fi

echo
echo "==> changed:"
git status --porcelain -- "$REF_DIR" || true
echo
echo "Next: LOOK AT THE IMAGES, then commit them on their own —"
echo "    git add $REF_DIR"
echo "    git commit -m 'chore(visreg): re-bless visual references — <why>'"

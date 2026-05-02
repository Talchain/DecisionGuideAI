#!/usr/bin/env bash
# scripts/doc-lint.sh — narrow placeholder/SHA detector for brief docs.
#
# Catches angle-bracket placeholders (`<R5 follow-up commit>`,
# `<staging-host>`, `<deploy SHA>`) and known stale-deploy markers in
# `docs/brief-*.md` close-out files before they ship as "completed".
#
# Intentionally scoped: tests for structural placeholders only, NOT
# prose words like "attach" that legitimately appear in templates. The
# brief author/walker is responsible for replacing the placeholders
# before stamping a doc as walked.
#
# Usage:
#   bash scripts/doc-lint.sh [glob]
# Default glob: docs/brief-5_8b-*.md
#
# Exit 0 = clean, exit 1 = placeholders found.

set -euo pipefail

GLOB="${1:-docs/brief-5_8b-*.md}"

# Patterns considered "structural placeholders" — these MUST be replaced
# before close-out:
#   - <…>            angle-bracket markers (`<R5 follow-up commit>`,
#                                            `<staging-host>`, `<deploy SHA>`)
#   - ______________ underscore lines used as fill-in-the-blank slots
PATTERNS=(
  # Multi-word placeholders inside <> (a single capitalised word like
  # `<ResultsFooter>` or `<DimensionBar>` is a JSX-tag reference, not a
  # placeholder — required to be a phrase with at least one space).
  '<[A-Za-z][^>]* [^>]*>'
  # Stale-deploy phrasing — close-out docs should not say a future
  # commit "lands on the next merge" once that merge has happened.
  # Catches both "lands on the next staging merge" and "next merge
  # brings"-style phrasings.
  'lands on the next'
  'next staging merge'
  # Standalone "_attach …_" placeholder spans — italicised
  # underscore-bracketed prose meaning "fill this in". The walker
  # workflow uses tags like "**SS:**" for screenshot evidence; an
  # _attach …_ block means the slot was never filled.
  '_attach [^_]+_'
  # The walker sign-off line uses `__________` slots that ARE intended to
  # remain unfilled until Paul stamps the doc — those are template fixtures,
  # not bugs to catch here. Doc-lint focuses on `<…>` structural placeholders
  # only. The walker workflow surfaces the sign-off line through other means.
)

FAIL=0
for f in $GLOB; do
  [ -e "$f" ] || continue
  for pat in "${PATTERNS[@]}"; do
    # Skip code blocks and fence-marked literal placeholders by excluding
    # lines inside ```…``` regions. This implementation is line-based
    # (no fence tracking) — the placeholders we care about should not
    # live inside code blocks anyway.
    # Filter out lines that contain JSX-attribute syntax ('className=',
    # 'style=', 'data-testid=') — those are JSX example references inside
    # backticks, not placeholders. Placeholders inside backticks
    # (e.g. `<R5 follow-up commit>`) are still flagged.
    HITS=$(grep -nE "$pat" "$f" \
      | grep -vE 'className=|style=\{|data-testid=|aria-' \
      || true)
    if [ -n "$HITS" ]; then
      echo "✗ $f: placeholder pattern '$pat' found:"
      echo "$HITS" | sed 's/^/  /'
      FAIL=1
    fi
  done
done

if [ "$FAIL" -eq 0 ]; then
  echo "✓ doc-lint: no placeholders found in $GLOB"
fi

exit $FAIL

#!/usr/bin/env bash
# scripts/doc-lint.sh — narrow placeholder/SHA detector for brief docs.
#
# Catches structural placeholders in `docs/brief-*.md` close-out files
# before they ship as "completed". Two modes:
#
#   - Default (in-flight) mode: catches placeholders that should never
#     ship in any state (`<R5 follow-up commit>`, `_attach …_` blocks,
#     stale-deploy phrasing).
#
#   - --strict (close-out) mode: additionally catches placeholders that
#     are legitimate during the walker workflow but MUST be replaced
#     before the doc is stamped as walked (`Pending Paul` evidence
#     slots, blank `_walked by: ___ date: ___ deploy SHA: ___`
#     sign-off lines).
#
# Workflow: `bash scripts/doc-lint.sh` runs clean while the walker is
# still capturing artefacts. Once Paul has stamped the doc,
# `bash scripts/doc-lint.sh --strict` should also run clean. CI / the
# pre-deploy gate can flip to --strict at close-out time.
#
# Usage:
#   bash scripts/doc-lint.sh [--strict] [glob]
# Default glob: docs/brief-5_8b-*.md
#
# Exit 0 = clean, exit 1 = placeholders found.

set -euo pipefail

STRICT=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done

GLOB="${ARGS[0]:-docs/brief-5_8b-*.md}"

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
)

# --strict mode: additionally catches placeholders that are legitimate
# during the walker workflow but MUST be replaced before close-out.
STRICT_PATTERNS=(
  # "Pending Paul" runtime-evidence slots — reasonable in-flight, blocking
  # at close-out.
  'Pending Paul'
  # Blank walker sign-off line: any underscore run on the same line as
  # "walked by:" / "date:" / "deploy SHA:" means the doc isn't stamped.
  '(walked by|date|deploy SHA): _____+'
)
if [ "$STRICT" -eq 1 ]; then
  PATTERNS+=("${STRICT_PATTERNS[@]}")
fi

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
  if [ "$STRICT" -eq 1 ]; then
    echo "✓ doc-lint --strict: no placeholders found in $GLOB"
  else
    echo "✓ doc-lint: no placeholders found in $GLOB"
  fi
fi

exit $FAIL

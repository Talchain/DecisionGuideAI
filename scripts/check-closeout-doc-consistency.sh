#!/usr/bin/env bash
# check-closeout-doc-consistency.sh — flag stale status tokens in
# brief close-out / final-review markdown before handoff.
#
# Catches a specific class of drift: close-out docs reference commits
# that haven't landed yet ("(pending)", "(this commit)"), cite
# superseded behaviour ("non-interactive" for a later-wired button),
# or describe branch status that doesn't match reality ("awaiting
# push" on a merged branch).
#
# Usage:
#   bash scripts/check-closeout-doc-consistency.sh docs/brief-5_2-final-review.md
#
# Exit codes:
#   0  all tokens resolved — doc is ready for handoff
#   1  stale tokens found  — output lists line + token for each
#
# Brief 5.2 close-out round 2 (2026-04-20).

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <path-to-close-out-doc.md> [...]" >&2
  exit 2
fi

# Stale-token patterns. Each is allowed inside fenced code blocks or
# explicit historical prose; this grep is a signal, not a hard veto,
# so a developer can override by moving the phrase into a code span
# or a "*(history: …)*" italic parenthetical.
#
# The patterns target the UNQUOTED status forms we've seen drift in
# Brief 5.2's own final-review: "(pending)" in the commit table after
# a commit has landed, "(this commit)" that wasn't resolved to a SHA,
# "non-interactive" describing a later-wired control, and "awaiting
# push" after the branch landed on staging.
declare -a PATTERNS=(
  '\(pending\)'                 # commit-table placeholder that wasn't updated
  '\(this commit\)'             # self-reference that wasn't resolved to a SHA
  'awaiting push'               # branch-status token after landing
  'awaiting approval'           # same
  'TODO close-out'              # explicit handoff TODO
  'TODO: close-out'
  # Brief 5.7 close-out follow-up: forward-tense phrases that go stale
  # the moment the doc lands on staging. Catches "will be pushed" /
  # "to be pushed" / "pending push" et al.
  '\bwill be pushed\b'
  '\bwill push\b'
  '\bto be pushed\b'
  '\bpending push\b'
  '\bnot yet pushed\b'
  '\blocal only, not pushed\b'
  # Conditional-readiness language that should not survive into a
  # post-push close-out.
  '\bship-readiness conditional on\b'
  '\bConditional ship-readiness\b'
  '\bwaiver required\b'
  '\bwaiver is required\b'
  # "Drops NOT executed" / "drops pending" style stash-state staleness.
  '\bdrops? NOT executed\b'
  '\bdrops? pending\b'
)

FAILURES=0

for doc in "$@"; do
  if [ ! -f "$doc" ]; then
    echo "::error:: $doc does not exist"
    FAILURES=$((FAILURES + 1))
    continue
  fi

  FOUND=0
  for pat in "${PATTERNS[@]}"; do
    # grep with line numbers; -E so bracket metacharacters work
    while IFS= read -r line; do
      if [ -z "$FOUND" ] || [ "$FOUND" -eq 0 ]; then
        printf '\n%s:\n' "$doc"
      fi
      printf '  %s  %s\n' "$(echo "$line" | cut -d: -f1 | awk '{printf "line %s:", $0}')" "$(echo "$line" | cut -d: -f2-)"
      FOUND=$((FOUND + 1))
      FAILURES=$((FAILURES + 1))
    done < <(grep -n -E "$pat" "$doc" 2>/dev/null || true)
  done

  if [ "$FOUND" -eq 0 ]; then
    printf '  ✓ %s — no stale status tokens\n' "$doc"
  fi
done

if [ "$FAILURES" -gt 0 ]; then
  printf '\n%d stale token(s) found — resolve before close-out handoff.\n' "$FAILURES"
  exit 1
fi

printf '\nAll close-out docs consistent.\n'
exit 0

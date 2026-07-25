#!/usr/bin/env bash
#
# The UI typecheck gate. Runs as `pnpm run typecheck`, which is what the
# required "Staging Gate" check (.github/workflows/staging-full-tests.yml, job
# `tsc`) and both pre-push hooks invoke.
#
# WHY THIS EXISTS
# ---------------
# Until 2026-07-25 `pnpm run typecheck` was `tsc -p tsconfig.ci.json --noEmit`,
# whose `include` was a HAND-MAINTAINED list of ~18 entries. It loaded 248 of
# the repo's 2,718 `src` files (9.1%). New code was invisible to the gate BY
# DEFAULT: a lane could add a directory of freshly-broken TypeScript and the
# gate stayed green, because the compiler never opened the files. Every
# "typecheck clean" claim made against that gate was unfalsifiable.
# (`tsconfig.json` is worse still — a solution stub with `"files": []`, so
# `tsc -p tsconfig.json` compiles literally nothing and always exits 0.)
#
# The failure mode was INVISIBILITY, not errors. So this gate has two phases,
# and the first one is the important one.
#
# PHASE 1 — COVERAGE (fail-loud drift guard; runs FIRST, and is cheap)
#   Derives the source set from `git ls-files` and the loaded set from the
#   compiler's own `--listFilesOnly`, then diffs them. Any tracked TypeScript
#   file no project loads FAILS the gate unless it is listed, per file, in
#   scripts/ci/typecheck-uncovered.txt. The check is BIDIRECTIONAL: a stale
#   entry in that file (now covered, or deleted) also FAILS, so the exception
#   list cannot rot into a green lie. This is the whole point — a file the gate
#   cannot see must never pass silently.
#
# PHASE 2 — RATCHET (honest baseline, no hidden cleanup)
#   Compiling the real projects surfaces a large pre-existing error count. It is
#   NOT hidden and NOT fixed here: it is frozen in scripts/ci/typecheck-baseline.txt
#   with PER-FILE counts, and the gate fails on any regression —
#     * a file with errors that is not in the baseline, or
#     * a file whose error count exceeds its baseline count, or
#     * a total error count above the baseline total.
#   Per-file counts (rather than CEE's file-set + total) close the intra-baseline
#   swap hole: fixing one error while adding another elsewhere is still caught.
#   Baseline shrink is reported as a ::notice:: so the number ratchets down.
#
# Escape hatch, honestly named: to accept new drift, regenerate the baseline in
# the same PR with `bash scripts/ci/typecheck-gate.sh --update-baseline` and say
# so in the PR description. There is no env var and no silent bypass.
#
# PROOF THAT IT BITES: scripts/ci/typecheck-gate-selftest.sh drives this script
# through four scenarios (green control, new-file error, invisible file, stale
# exception) and asserts the exit codes and messages. It runs as its own CI job
# so the gate's ability to discriminate is re-proven on every staging run.
#
# Deterministic and network-free. Ignores tsc's own exit code (the baseline
# guarantees it is non-zero) and decides purely from the parsed diagnostics,
# with a catastrophic-failure guard for the "tsc died before emitting parseable
# errors" case.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BASELINE="scripts/ci/typecheck-baseline.txt"
UNCOVERED="scripts/ci/typecheck-uncovered.txt"

# The projects that together constitute "the code". Both derive their file set
# from directory/whole-tree globs — neither enumerates filenames — and this
# array is the SINGLE list consumed by both phases, so coverage is always
# measured against exactly what the ratchet compiled.
PROJECTS=(tsconfig.app.json tsconfig.tooling.json)

# Sanity floor for the derived source set. If `git ls-files` returns far fewer
# files than the repo actually has (not a git checkout, a shallow/partial
# working tree, a broken glob), the coverage diff would be vacuously empty and
# pass. This is the positive control for the guard itself.
MIN_TRACKED_FILES=2000

UPDATE_BASELINE=0
if [[ "${1:-}" == "--update-baseline" ]]; then
  UPDATE_BASELINE=1
elif [[ $# -gt 0 ]]; then
  echo "usage: $0 [--update-baseline]" >&2
  exit 2
fi

# GitHub-Actions annotations degrade to plain text locally, which is fine.
err() { echo "::error::$*"; }
note() { echo "::notice::$*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# An error diagnostic looks like:  path.ts(line,col): error TSxxxx: message
# Anchored at line start (continuation lines are indented) so a message that
# merely quotes such a string cannot be miscounted. Extensions match tsc's own
# supported set.
ERR_REGEX='^[^[:space:]].*\.(ts|tsx|mts|cts)\([0-9]+,[0-9]+\): error TS[0-9]+'

for proj in "${PROJECTS[@]}"; do
  if [[ ! -f "$proj" ]]; then
    err "Missing project file: $proj (referenced by PROJECTS in $0)."
    exit 1
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — coverage. Deliberately first: it is ~10x cheaper than a full check
# (--listFilesOnly resolves the program without typechecking it), and an
# invisible file makes the ratchet's verdict meaningless anyway.
# ─────────────────────────────────────────────────────────────────────────────
echo "── phase 1: coverage (derived from git, verified against the compiler's own file list)"

: >"$WORK/loaded.txt"
for proj in "${PROJECTS[@]}"; do
  # --listFilesOnly is the compiler's own account of what it would open. This is
  # the source of truth for coverage; a tsconfig's `include` is only an
  # intention. Paths are absolute, so strip the repo prefix.
  npx --no-install tsc -p "$proj" --listFilesOnly --noEmit >"$WORK/lfo.txt" 2>&1
  lfo_exit=$?
  if [[ "$lfo_exit" -ne 0 ]]; then
    err "tsc --listFilesOnly failed on $proj (exit $lfo_exit) — cannot establish coverage."
    tail -n 20 "$WORK/lfo.txt"
    exit 1
  fi
  grep -vF "/node_modules/" "$WORK/lfo.txt" \
    | grep -E '\.(ts|tsx|mts|cts)$' \
    | sed "s|^${REPO_ROOT}/||" \
    >>"$WORK/loaded.txt"
done
sort -u "$WORK/loaded.txt" -o "$WORK/loaded.txt"

git ls-files -- '*.ts' '*.tsx' '*.mts' '*.cts' | sort -u >"$WORK/tracked.txt"
TRACKED_COUNT="$(wc -l <"$WORK/tracked.txt" | tr -d '[:space:]')"

if [[ "$TRACKED_COUNT" -lt "$MIN_TRACKED_FILES" ]]; then
  err "Derived only $TRACKED_COUNT tracked TypeScript files (floor: $MIN_TRACKED_FILES)."
  err "The coverage diff would be vacuous. Is this a git checkout with the full tree?"
  exit 1
fi

if [[ ! -f "$UNCOVERED" ]]; then
  err "Missing exception list: $UNCOVERED"
  exit 1
fi
grep -vE '^[[:space:]]*(#|$)' "$UNCOVERED" | sort -u >"$WORK/excepted.txt"

# Files the compiler never opens.
comm -23 "$WORK/tracked.txt" "$WORK/loaded.txt" >"$WORK/uncovered.txt"
# ...that are not accounted for. THIS is the drift that must fail.
comm -23 "$WORK/uncovered.txt" "$WORK/excepted.txt" >"$WORK/unaccounted.txt"
# ...and exception entries that no longer describe reality (file is now covered,
# or no longer exists). A rotting exception list is the same defect one level up.
comm -13 "$WORK/uncovered.txt" "$WORK/excepted.txt" >"$WORK/stale.txt"

COVERAGE_FAIL=0
if [[ -s "$WORK/unaccounted.txt" ]]; then
  err "TypeScript file(s) that NO typecheck project loads — the gate cannot see them:"
  while IFS= read -r f; do [[ -n "$f" ]] && echo "  ? $f"; done <"$WORK/unaccounted.txt"
  err "Fix by making a project cover them (preferred — see tsconfig.tooling.json),"
  err "or, if they are genuinely out of scope, add them to $UNCOVERED with a reason."
  COVERAGE_FAIL=1
fi
if [[ -s "$WORK/stale.txt" ]]; then
  err "Stale entries in $UNCOVERED (now compiled, or deleted) — remove them:"
  while IFS= read -r f; do [[ -n "$f" ]] && echo "  - $f"; done <"$WORK/stale.txt"
  COVERAGE_FAIL=1
fi

LOADED_TRACKED="$(comm -12 "$WORK/tracked.txt" "$WORK/loaded.txt" | wc -l | tr -d '[:space:]')"
EXCEPTED_COUNT="$(wc -l <"$WORK/excepted.txt" | tr -d '[:space:]')"
echo "   $LOADED_TRACKED / $TRACKED_COUNT tracked TypeScript files loaded by the gate (${EXCEPTED_COUNT} declared out of scope)"

if [[ "$COVERAGE_FAIL" -ne 0 ]]; then
  err "Typecheck COVERAGE gate FAILED — see above. (A file the gate cannot see must never pass silently.)"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — ratchet
# ─────────────────────────────────────────────────────────────────────────────
echo
echo "── phase 2: ratchet (per-file baseline)"

: >"$WORK/all-errors.txt"
for proj in "${PROJECTS[@]}"; do
  # --pretty false forces single-line, colour-free diagnostics so parsing is
  # stable across TTY and CI.
  npx --no-install tsc -p "$proj" --noEmit --pretty false >"$WORK/out.txt" 2>&1
  proj_exit=$?
  proj_errs="$(grep -cE "$ERR_REGEX" "$WORK/out.txt")"

  # Catastrophic-failure guard: a non-zero exit with nothing parseable means a
  # config/resolution failure, NOT a clean run. Treat as hard failure so a
  # broken tsconfig can never read as "0 drift".
  if [[ "$proj_exit" -ne 0 && "$proj_errs" -eq 0 ]]; then
    err "tsc exited $proj_exit on $proj with no parseable type errors — config/resolution failure, not clean."
    echo "----- tsc output (tail) -----"
    tail -n 40 "$WORK/out.txt"
    exit 1
  fi

  grep -E "$ERR_REGEX" "$WORK/out.txt" >>"$WORK/all-errors.txt"
  echo "   $proj → $proj_errs diagnostic(s)"
done

# Union of diagnostics across projects. A src file loaded by BOTH projects
# reports its errors twice; identical lines collapse here, while a diagnostic
# genuinely unique to one project's compilerOptions is kept. Union is the
# fail-safe direction: an error masked in one project still counts.
sort -u "$WORK/all-errors.txt" -o "$WORK/all-errors.txt"

# "<count>\t<path>", sorted by path.
sed -E 's/\([0-9]+,[0-9]+\): error TS[0-9]+.*$//' "$WORK/all-errors.txt" \
  | sort | uniq -c \
  | sed -E 's/^[[:space:]]*([0-9]+)[[:space:]]+(.*)$/\1\t\2/' \
  | sort -t$'\t' -k2,2 >"$WORK/current.tsv"

CUR_TOTAL="$(wc -l <"$WORK/all-errors.txt" | tr -d '[:space:]')"
CUR_FILES="$(wc -l <"$WORK/current.tsv" | tr -d '[:space:]')"

if [[ "$UPDATE_BASELINE" -eq 1 ]]; then
  {
    echo "# Typecheck drift baseline — PER-FILE error counts."
    echo "# Generated by: bash scripts/ci/typecheck-gate.sh --update-baseline"
    echo "# Consumed by:  scripts/ci/typecheck-gate.sh (phase 2), which runs as"
    echo "#               \`pnpm run typecheck\` in the required \"Staging Gate\" check."
    echo "#"
    echo "# These are PRE-EXISTING errors, frozen so the gate can compile the WHOLE"
    echo "# tree today without a repo-wide cleanup first. They are not hidden and not"
    echo "# tolerated: the gate FAILS on any new erroring file, any per-file increase,"
    echo "# and any total increase. Goal is to ratchet this to zero, then delete both"
    echo "# this file and phase 2."
    echo "#"
    echo "# Format: <error-count><TAB><path>, sorted by path."
    echo "# count=$CUR_TOTAL"
    cat "$WORK/current.tsv"
  } >"$BASELINE"
  note "Baseline regenerated: $CUR_FILES file(s) / $CUR_TOTAL error(s) → $BASELINE"
  exit 0
fi

if [[ ! -f "$BASELINE" ]]; then
  err "Missing baseline file: $BASELINE (generate with --update-baseline)."
  exit 1
fi

# Validate the header before trusting anything else: exactly one `# count=<N>`
# with a non-negative integer.
BASE_COUNT_HEADERS="$(grep -cE '^[[:space:]]*#[[:space:]]*count=' "$BASELINE")"
if [[ "$BASE_COUNT_HEADERS" -ne 1 ]]; then
  err "Baseline must have exactly one '# count=<N>' header line (found $BASE_COUNT_HEADERS)."
  exit 1
fi
BASE_TOTAL="$(grep -E '^[[:space:]]*#[[:space:]]*count=' "$BASELINE" | sed -E 's/.*count=//' | tr -d '[:space:]')"
if [[ ! "$BASE_TOTAL" =~ ^[0-9]+$ ]]; then
  err "Baseline '# count=' must be a non-negative integer, got: '$BASE_TOTAL'"
  exit 1
fi

grep -vE '^[[:space:]]*(#|$)' "$BASELINE" | sort -t$'\t' -k2,2 >"$WORK/baseline.tsv"

# Reject a malformed baseline outright rather than silently treating a bad row
# as "no baseline for this file" (which would read as a new-file failure, or
# worse, as an absent constraint).
if grep -qvE $'^[0-9]+\t.+$' "$WORK/baseline.tsv"; then
  err "Malformed baseline row(s) — expected '<count><TAB><path>':"
  grep -vE $'^[0-9]+\t.+$' "$WORK/baseline.tsv" | head -n 10
  exit 1
fi

# Cross-check the header against the rows it claims to summarise, so a
# hand-edited count cannot loosen the gate without touching the rows.
BASE_ROW_SUM="$(awk -F'\t' '{s+=$1} END {print s+0}' "$WORK/baseline.tsv")"
if [[ "$BASE_ROW_SUM" -ne "$BASE_TOTAL" ]]; then
  err "Baseline is internally inconsistent: '# count=$BASE_TOTAL' but rows sum to $BASE_ROW_SUM."
  err "Regenerate with --update-baseline instead of editing by hand."
  exit 1
fi

FAIL=0

# New erroring files.
NEW_FILES="$(comm -13 <(cut -f2 "$WORK/baseline.tsv") <(cut -f2 "$WORK/current.tsv"))"
if [[ -n "$NEW_FILES" ]]; then
  err "New file(s) with TypeScript errors (not in $BASELINE):"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    n="$(awk -F'\t' -v p="$f" '$2==p {print $1}' "$WORK/current.tsv")"
    echo "  + $f ($n error(s))"
    grep -F "$f(" "$WORK/all-errors.txt" | head -n 5 | sed 's/^/      /'
  done <<<"$NEW_FILES"
  FAIL=1
fi

# Per-file increases within the baseline.
WORSE="$(join -t$'\t' -j 2 -o 0,1.1,2.1 \
  <(sort -t$'\t' -k2,2 "$WORK/baseline.tsv") \
  <(sort -t$'\t' -k2,2 "$WORK/current.tsv") \
  | awk -F'\t' '$3 > $2 {printf "%s\t%s\t%s\n", $1, $2, $3}')"
if [[ -n "$WORSE" ]]; then
  err "File(s) with MORE type errors than the baseline allows:"
  while IFS=$'\t' read -r f b c; do
    [[ -z "$f" ]] && continue
    echo "  ! $f: baseline $b → current $c"
  done <<<"$WORSE"
  FAIL=1
fi

# Total (belt-and-braces; the two checks above should already have caught it).
if [[ "$CUR_TOTAL" -gt "$BASE_TOTAL" ]]; then
  err "Total typecheck errors increased: baseline=$BASE_TOTAL current=$CUR_TOTAL (+$((CUR_TOTAL - BASE_TOTAL)))."
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  err "Typecheck RATCHET FAILED — current: $CUR_FILES file(s) / $CUR_TOTAL error(s) vs baseline $(wc -l <"$WORK/baseline.tsv" | tr -d '[:space:]') file(s) / $BASE_TOTAL error(s)."
  err "Fix the new errors, or — if the drift is genuinely intended — regenerate the baseline in this PR"
  err "with 'bash scripts/ci/typecheck-gate.sh --update-baseline' and call it out for reviewer sign-off."
  exit 1
fi

echo "   within baseline — $CUR_FILES file(s) / $CUR_TOTAL error(s) (baseline: $BASE_TOTAL)"

# Report progress so the baseline ratchets down instead of sitting still.
BETTER="$(join -t$'\t' -j 2 -o 0,1.1,2.1 \
  <(sort -t$'\t' -k2,2 "$WORK/baseline.tsv") \
  <(sort -t$'\t' -k2,2 "$WORK/current.tsv") \
  | awk -F'\t' '$3 < $2 {printf "%s\t%s\t%s\n", $1, $2, $3}')"
FIXED_FILES="$(comm -23 <(cut -f2 "$WORK/baseline.tsv") <(cut -f2 "$WORK/current.tsv"))"
if [[ -n "$FIXED_FILES" || -n "$BETTER" || "$CUR_TOTAL" -lt "$BASE_TOTAL" ]]; then
  note "Drift shrank ($BASE_TOTAL → $CUR_TOTAL) — tighten it with --update-baseline in this PR."
fi
if [[ "$CUR_TOTAL" -eq 0 ]]; then
  note "No typecheck errors remain — delete $BASELINE and phase 2 of this script."
fi

echo
echo "✅ Typecheck gate PASSED (coverage + ratchet)."
exit 0

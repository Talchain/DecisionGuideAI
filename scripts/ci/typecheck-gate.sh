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
#   NOT hidden and NOT fixed here: it is frozen in two generated artefacts, and
#   the gate fails on any regression.
#
#   THE DEDUP KEY — why it is the position and not the wording.
#   TypeScript renders the SAME diagnostic with union members in a DIFFERENT
#   ORDER in different programs: tsconfig.app.json may print
#     '"error" | "skipped" | "unavailable" | "computed"'
#   where tsconfig.tooling.json prints
#     '"error" | "unavailable" | "skipped" | "computed"'
#   for the identical error at the identical position. A `sort -u` over the whole
#   diagnostic LINE therefore counts that one error TWICE and baselines it
#   inflated. Diagnostics are collapsed on file+line+column+TS-code instead — the
#   POSITION is the identity, the wording is not — while the full message is kept
#   for human output. Measured: 5 phantom duplicates at 23104baf (which is why the
#   first baseline over-counted AdapterStatusBanner.tsx by 2 and hydrateAnalysis.ts
#   by 1), 2 at 607fa113 (responseMapper.ts, useV2Run.ts). The set MOVES as code
#   changes, so a baseline pinned to the inflated number phantom-reds later with no
#   defect behind it — a broken alarm, which teaches people to distrust the gate.
#
#   WHAT BLOCKS
#     * a file with errors that is not in the baseline, or
#     * a file whose error count exceeds its baseline count, or
#     * a (file, TS-code) pair whose count exceeds its baseline count, or
#     * a total error count above the baseline total.
#
#   WHAT THIS DOES AND DOES NOT GUARANTEE — read before trusting a green.
#   Per-file counts close the swap hole BETWEEN files. They do NOT close it
#   WITHIN one file, and until 2026-07-27 this comment claimed they did. Adding
#   the per-(file, TS-code) counts closes the within-file swap that changes the
#   error CODE. A within-file swap at the SAME code — fix one TS2739 and add
#   another TS2739 in the same file — remains invisible to the blocking checks,
#   and is invisible to ANY count-based ratchet by construction. That gap is not
#   an oversight; it is where the measurement led:
#     * A message-bearing baseline would catch it, but tsc's message text is
#       unstable for exactly the reason above. Between 23104baf and 607fa113,
#       20 of 63 apparent new diagnostics (32%) were pure union-order re-renders
#       of an existing one, and 6 more differed only by the ABSOLUTE PATH that
#       TS7016 quotes in its message body. Two thirds signal, one third noise:
#       a blocking check on message text is a phantom-red machine. (Both are
#       normalised away below — but by a heuristic, which is the point.)
#     * Per-(file, TS-code) counts are stable and cost nothing, but caught 0 of
#       those 63 on the measured window — every one was a like-for-like swap
#       inside one (file, code) bucket. They are kept because they are free and
#       do close a real sub-case, not because they closed this one.
#   So the same-code within-file swap is REPORTED rather than blocked (below).
#
#   WHAT IS REPORTED BUT DOES NOT BLOCK
#   scripts/ci/typecheck-baseline-identities.txt freezes the diagnostic SET as
#   (count, file, TS-code, canonicalised message). The gate diffs the current set
#   against it and prints added/removed diagnostics as ::notice::. This is what
#   makes a same-code within-file swap VISIBLE — it is how the 37 diagnostics
#   that landed between 23104baf and 607fa113 with a green ratchet were found.
#   It is deliberately NON-blocking: the canonicaliser that sorts union members
#   is a heuristic, and a heuristic belongs where its drift costs noise in a
#   report, never a red build.
#
#   Baseline shrink is reported as a ::notice:: so the number ratchets down.
#
# Escape hatch, honestly named: to accept new drift, regenerate the baseline in
# the same PR with `bash scripts/ci/typecheck-gate.sh --update-baseline` and say
# so in the PR description. There is no env var and no silent bypass.
#
# PROOF THAT IT BITES: scripts/ci/typecheck-gate-selftest.sh drives this script
# through seven scenarios (green control, new-file error, invisible file, stale
# exception, the dedup key + its mutant, and a within-file code swap + its
# mutant) and asserts the exit codes and messages. It runs as its own CI job so
# the gate's ability to discriminate is re-proven on every staging run.
#
# Deterministic and network-free. Ignores tsc's own exit code (the baseline
# guarantees it is non-zero) and decides purely from the parsed diagnostics,
# with a catastrophic-failure guard for the "tsc died before emitting parseable
# errors" case.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BASELINE="scripts/ci/typecheck-baseline.txt"
IDENTITIES="scripts/ci/typecheck-baseline-identities.txt"
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
DEDUP_FILTER=0
if [[ "${1:-}" == "--update-baseline" ]]; then
  UPDATE_BASELINE=1
elif [[ "${1:-}" == "--dedup-filter" ]]; then
  # Read diagnostics on stdin, write the deduplicated set to stdout, exit.
  # Exists so scripts/ci/typecheck-gate-selftest.sh can drive THE REAL dedup
  # code path against a fixture without compiling the tree. A self-test that
  # reimplemented this logic would be a mirror of it, and a mirror drifts.
  DEDUP_FILTER=1
elif [[ $# -gt 0 ]]; then
  echo "usage: $0 [--update-baseline | --dedup-filter]" >&2
  exit 2
fi

# GitHub-Actions annotations degrade to plain text locally, which is fine.
err() { echo "::error::$*"; }
note() { echo "::notice::$*"; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# THE DEDUP KEY (see the header). Collapse diagnostics that are the same error
# at the same position, however tsc chose to word them this time. Sorting first
# makes the surviving representative deterministic (lexicographically smallest),
# so the human-facing message never depends on project order.
dedup_diagnostics() {
  sort | awk '
    {
      if (match($0, /\([0-9]+,[0-9]+\): error TS[0-9]+/)) key = substr($0, 1, RSTART + RLENGTH - 1)
      else key = $0
      if (!(key in seen)) { seen[key] = 1; print }
    }'
}

if [[ "$DEDUP_FILTER" -eq 1 ]]; then
  dedup_diagnostics
  exit 0
fi

# Canonicalise a diagnostic into an IDENTITY: "<file>\t<TScode>\t<message>",
# with the members of every union type sorted. Union-member order is the one
# instability we have actually measured in tsc's output; sorting it is what lets
# the reported added/removed sets mean something. This is a HEURISTIC on a
# compiler's output format, which is why nothing it produces can fail the build.
cat >"$WORK/identity.pl" <<'PERL'
my $ATOM = qr/(?:"[^"]*"|'[^']*'|[A-Za-z0-9_\$.]+(?:\[\])*)/;
my $root = $ENV{IDENTITY_REPO_ROOT} // '';
while (my $line = <STDIN>) {
  chomp $line;
  next unless $line =~ /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
  my ($file, $code, $msg) = ($1, $4, $5);
  $msg =~ s/\t/ /g;
  # TS7016 and friends quote an ABSOLUTE path in the message body. Left alone,
  # the identity baseline is machine-specific: it would report the same 7
  # diagnostics as added-and-removed on every CI run, in every checkout at a
  # different path. A report that is wrong on every green build gets ignored.
  $msg =~ s/\Q$root\E\///g if $root ne '';
  for my $pass (1 .. 3) {
    my $before = $msg;
    $msg =~ s/((?<![|\w])$ATOM(?: \| $ATOM)+)/join(" | ", sort split(m{ \| }, $1))/ge;
    last if $msg eq $before;
  }
  print "$file\t$code\t$msg\n";
}
PERL

# diagnostics → "<count>\t<file>\t<TScode>\t<message>", sorted by file/code/message.
identities_from() {
  IDENTITY_REPO_ROOT="$REPO_ROOT" perl "$WORK/identity.pl" <"$1" \
    | sort | uniq -c \
    | awk '{ n = $1; sub(/^[[:space:]]*[0-9]+[[:space:]]+/, ""); printf "%s\t%s\n", n, $0 }' \
    | sort -t$'\t' -k2,2 -k3,3 -k4,4
}

# identity rows → "<count>\t<file>\t<TScode>" buckets (the per-(file,code) ratchet).
buckets_from() {
  awk -F'\t' '{ s[$2 FS $3] += $1 } END { for (k in s) printf "%d\t%s\n", s[k], k }' "$1" \
    | sort -t$'\t' -k2,2 -k3,3
}

# identity rows → one line per diagnostic, so two sets can be compared as MULTISETS.
expand_identities() {
  awk -F'\t' '{ for (i = 0; i < $1; i++) printf "%s\t%s\t%s\n", $2, $3, $4 }' "$1" | sort
}

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
# reports its errors twice; those collapse here, while a diagnostic genuinely
# unique to one project's compilerOptions is kept. Union is the fail-safe
# direction: an error masked in one project still counts.
#
# The collapse is keyed on POSITION + TS-code, not on the whole line, because
# the same error is not always worded the same way in both projects — see THE
# DEDUP KEY in the header. A whole-line `sort -u` here counted such an error
# twice and baselined it inflated.
LINE_UNIQ="$(sort -u "$WORK/all-errors.txt" | wc -l | tr -d '[:space:]')"
dedup_diagnostics <"$WORK/all-errors.txt" >"$WORK/deduped.txt"
mv "$WORK/deduped.txt" "$WORK/all-errors.txt"

CUR_TOTAL="$(wc -l <"$WORK/all-errors.txt" | tr -d '[:space:]')"
if [[ "$LINE_UNIQ" -gt "$CUR_TOTAL" ]]; then
  echo "   collapsed $((LINE_UNIQ - CUR_TOTAL)) cross-project re-rendering(s) of an identical diagnostic"
fi

# "<count>\t<path>", sorted by path.
sed -E 's/\([0-9]+,[0-9]+\): error TS[0-9]+.*$//' "$WORK/all-errors.txt" \
  | sort | uniq -c \
  | sed -E 's/^[[:space:]]*([0-9]+)[[:space:]]+(.*)$/\1\t\2/' \
  | sort -t$'\t' -k2,2 >"$WORK/current.tsv"

identities_from "$WORK/all-errors.txt" >"$WORK/current-identities.tsv"
buckets_from "$WORK/current-identities.tsv" >"$WORK/current-buckets.tsv"

CUR_FILES="$(wc -l <"$WORK/current.tsv" | tr -d '[:space:]')"
CUR_IDENTS="$(wc -l <"$WORK/current-identities.tsv" | tr -d '[:space:]')"

# The identity file is generated from the same diagnostics as the count file, so
# their per-file sums are equal BY CONSTRUCTION. If they ever disagree, one of
# the two has been hand-edited and neither can be trusted — fail loud rather
# than let a hand-maintained mirror decide what "clean" means.
IDENT_SUM="$(awk -F'\t' '{ s += $1 } END { print s + 0 }' "$WORK/current-identities.tsv")"
if [[ "$IDENT_SUM" -ne "$CUR_TOTAL" ]]; then
  err "Internal inconsistency: $CUR_TOTAL diagnostics parsed but identities sum to $IDENT_SUM."
  err "A diagnostic failed to parse into an identity. This is a bug in $0, not in your code."
  exit 1
fi

# An identity that embeds a machine-specific absolute path is not comparable
# between two checkouts, so it would show up as added-and-removed forever. The
# repo root is stripped above; anything ABSOLUTE left over is a path this script
# does not know how to relativise, and must be fixed here rather than tolerated.
# (Found the hard way: a probe for "/Users/" and "/home/" missed a checkout under
# /private/tmp and reported this file portable when it was not.)
if grep -qE $'\t[^\t]*[^A-Za-z0-9]/(Users|home|private|tmp|var|opt|github)/' "$WORK/current-identities.tsv"; then
  err "Identity message(s) still contain an absolute path — the baseline would not be portable:"
  grep -E $'\t[^\t]*[^A-Za-z0-9]/(Users|home|private|tmp|var|opt|github)/' "$WORK/current-identities.tsv" \
    | head -n 5 | cut -c1-200 | sed 's/^/    /'
  exit 1
fi

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
  {
    echo "# Typecheck drift baseline — the diagnostic SET, as identities."
    echo "# Generated by: bash scripts/ci/typecheck-gate.sh --update-baseline"
    echo "#"
    echo "# Companion to typecheck-baseline.txt, which holds the same diagnostics"
    echo "# as per-file COUNTS. This file holds their IDENTITY, so the gate can say"
    echo "# WHICH diagnostics appeared and disappeared — a same-file, same-code swap"
    echo "# (fix one, add one) moves no count and is invisible without it."
    echo "#"
    echo "# The per-(file, TS-code) sums derived from this file BLOCK the build."
    echo "# The added/removed diagnostic sets are reported as ::notice:: and do NOT,"
    echo "# because the message text is a compiler output format, not a property of"
    echo "# the code: tsc reorders union members between programs and between tips."
    echo "# Messages here are canonicalised (union members sorted) for that reason."
    echo "#"
    echo "# Format: <count><TAB><path><TAB><TS-code><TAB><canonicalised message>."
    echo "# count=$CUR_TOTAL"
    cat "$WORK/current-identities.tsv"
  } >"$IDENTITIES"
  note "Baseline regenerated: $CUR_FILES file(s) / $CUR_TOTAL error(s) → $BASELINE"
  note "Identity baseline regenerated: $CUR_IDENTS identity row(s) → $IDENTITIES"
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

# ── the identity baseline, same treatment ────────────────────────────────────
if [[ ! -f "$IDENTITIES" ]]; then
  err "Missing identity baseline: $IDENTITIES (generate with --update-baseline)."
  exit 1
fi
grep -vE '^[[:space:]]*(#|$)' "$IDENTITIES" | sort -t$'\t' -k2,2 -k3,3 -k4,4 >"$WORK/baseline-identities.tsv"
if grep -qvE $'^[0-9]+\t[^\t]+\tTS[0-9]+\t.*$' "$WORK/baseline-identities.tsv"; then
  err "Malformed identity row(s) — expected '<count><TAB><path><TAB><TScode><TAB><message>':"
  grep -vE $'^[0-9]+\t[^\t]+\tTS[0-9]+\t.*$' "$WORK/baseline-identities.tsv" | head -n 10
  exit 1
fi

# The two artefacts describe the SAME diagnostics. Deriving the per-file counts
# from the identity rows and demanding they match the count baseline is what
# stops the pair rotting into disagreement — the mirror has to FAIL LOUD, not
# assume good. (This is also what makes the per-(file,TS-code) check meaningful:
# it is only as trustworthy as the file it is derived from.)
awk -F'\t' '{ s[$2] += $1 } END { for (f in s) printf "%d\t%s\n", s[f], f }' \
  "$WORK/baseline-identities.tsv" | sort -t$'\t' -k2,2 >"$WORK/baseline-derived.tsv"
if ! diff -q "$WORK/baseline-derived.tsv" "$WORK/baseline.tsv" >/dev/null; then
  err "$BASELINE and $IDENTITIES disagree about the per-file counts."
  err "They are generated together and must never be edited apart. Regenerate both with --update-baseline."
  diff "$WORK/baseline.tsv" "$WORK/baseline-derived.tsv" | head -n 20 | sed 's/^/    /'
  exit 1
fi

buckets_from "$WORK/baseline-identities.tsv" >"$WORK/baseline-buckets.tsv"

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

# Per-(file, TS-code) increases. This is the half of the within-file swap hole
# that a count CAN see: fixing a TS2345 and adding a TS2739 in the same file
# leaves the per-file count untouched, and fails here instead.
WORSE_BUCKETS="$(awk -F'\t' '
  NR == FNR { base[$2 FS $3] = $1; next }
  { k = $2 FS $3; b = (k in base) ? base[k] : 0; if ($1 > b) printf "%s\t%s\t%s\t%s\n", $2, $3, b, $1 }
' "$WORK/baseline-buckets.tsv" "$WORK/current-buckets.tsv")"
if [[ -n "$WORSE_BUCKETS" ]]; then
  err "File(s) with MORE errors of a given TS code than the baseline allows:"
  while IFS=$'\t' read -r f code b c; do
    [[ -z "$f" ]] && continue
    echo "  ! $f [$code]: baseline $b → current $c"
    grep -F "$f(" "$WORK/all-errors.txt" | grep -F ": error $code:" | head -n 3 | sed 's/^/      /'
  done <<<"$WORSE_BUCKETS"
  err "A per-file count can hide this: one error fixed and another added in the same file."
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

# ─────────────────────────────────────────────────────────────────────────────
# The diagnostic SET, reported and not enforced. Everything above is a count,
# and a count cannot see a same-file same-code swap. This can — it is how the 37
# diagnostics that landed between 23104baf and 607fa113 under a green ratchet
# were found. It does not fail the build (see the header): union-member
# canonicalisation is a heuristic, and a sometimes-wrong red teaches people to
# stop reading the gate, which costs more than it saves.
# ─────────────────────────────────────────────────────────────────────────────
expand_identities "$WORK/baseline-identities.tsv" >"$WORK/base-set.txt"
expand_identities "$WORK/current-identities.tsv" >"$WORK/cur-set.txt"
comm -13 "$WORK/base-set.txt" "$WORK/cur-set.txt" >"$WORK/added.txt"
comm -23 "$WORK/base-set.txt" "$WORK/cur-set.txt" >"$WORK/removed.txt"
N_ADDED="$(wc -l <"$WORK/added.txt" | tr -d '[:space:]')"
N_REMOVED="$(wc -l <"$WORK/removed.txt" | tr -d '[:space:]')"

if [[ "$N_ADDED" -gt 0 ]]; then
  note "$N_ADDED diagnostic(s) NOT in the identity baseline appeared, and $N_REMOVED disappeared."
  note "The counts still fit, so this did not fail the build — but these are new errors. Top files:"
  cut -f1 "$WORK/added.txt" | sort | uniq -c | sort -rn | head -n 10 | sed 's/^/     /'
  echo "   ── the added diagnostics (first 25) ──"
  awk -F'\t' '{ printf "     %s [%s] %s\n", $1, $2, substr($3, 1, 140) }' "$WORK/added.txt" | head -n 25
  note "If these are yours, fix them. If they are pre-existing drift, regenerate the baseline in this PR."
elif [[ "$N_REMOVED" -gt 0 ]]; then
  note "$N_REMOVED diagnostic(s) fixed since the identity baseline, none added — regenerate to bank it."
fi

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

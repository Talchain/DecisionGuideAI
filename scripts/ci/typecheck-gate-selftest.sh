#!/usr/bin/env bash
#
# POSITIVE CONTROL for scripts/ci/typecheck-gate.sh.
#
# A gate that asserts an absence ("no new type errors", "no invisible files") is
# worthless until you have proven it can SEE a presence. The gate this replaces
# was green for months while loading 9% of src — nobody had ever watched it go
# red for a reason it claimed to catch.
#
# So this drives the REAL gate, against the REAL projects, through seven
# scenarios and asserts both the exit code and the message:
#
#   1. GREEN CONTROL      clean tree                       → exit 0
#   2. RATCHET BITES      new file with a type error       → exit 1, names the file
#   3. COVERAGE BITES     new tracked file no project loads→ exit 1, "NO typecheck project loads"
#   4. STALE EXCEPTION    bogus entry in the uncovered list→ exit 1, "Stale entries"
#   5. DEDUP KEY          one error rendered two ways      → counted ONCE
#   5m. …AND ITS MUTANT   the same fixture under the OLD full-line key → counted TWICE
#   6. WITHIN-FILE SWAP   one error traded for another of a different TS
#                         code in the SAME file           → exit 1, names the (file, code)
#   6m. …AND ITS MUTANT   the per-FILE counts stay silent on that same state
#   7. SAME-CODE SWAP     the case no count can see  → exit 0, but REPORTED
#                         (scenario 1 is its negative control: silent when clean)
#
# Scenario 2 is the one that matters most: it is exactly the failure the old
# gate could not detect, because the file it would have to open was not in
# tsconfig.ci.json's hand-written include list.
#
# Scenarios 5m and 6m exist because a control that passes against the OLD code
# too has proven nothing. Each names the previous implementation explicitly and
# asserts it gives the WRONG answer on the same input.
#
# Every scenario mutates the working tree and then restores it. The script
# refuses to run on a dirty tree so it can never destroy uncommitted work, and
# its cleanup trap fires on every exit path.
#
# Runtime: ~3 min (scenarios 3 and 4 fail in the cheap coverage phase; 5 and 5m
# do not compile at all).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

GATE="scripts/ci/typecheck-gate.sh"
UNCOVERED="scripts/ci/typecheck-uncovered.txt"
IDENTITIES="scripts/ci/typecheck-baseline-identities.txt"

# Scenario fixtures. `.selftest.` in the name keeps them obvious in a stray
# `git status`, and both live in directories the gate genuinely reaches.
BAD_SRC="src/__typecheck_gate_selftest__/deliberately-broken.selftest.ts"
INVISIBLE="archive/__typecheck_gate_selftest__/unreachable.selftest.ts"

PASS=0
FAIL=0

FIXTURES="$(mktemp -d)"

cleanup() {
  rm -rf "$REPO_ROOT/$(dirname "$BAD_SRC")" "$REPO_ROOT/$(dirname "$INVISIBLE")" "$FIXTURES"
  git -C "$REPO_ROOT" rm --cached -q --ignore-unmatch -- "$BAD_SRC" "$INVISIBLE" >/dev/null 2>&1
  git -C "$REPO_ROOT" checkout -q -- "$UNCOVERED" "$IDENTITIES" 2>/dev/null
}
trap cleanup EXIT

# Refuse to run on a dirty tree: the scenarios stage files and restore tracked
# ones, and getting that wrong on top of real edits would be unforgivable.
if [[ -n "$(git status --porcelain -- "$UNCOVERED" "$IDENTITIES")" ]]; then
  echo "::error::$UNCOVERED or $IDENTITIES has uncommitted changes — commit or stash before running the self-test."
  exit 1
fi
if [[ -e "$REPO_ROOT/$(dirname "$BAD_SRC")" || -e "$REPO_ROOT/$(dirname "$INVISIBLE")" ]]; then
  echo "::error::Self-test fixture directories already exist — a previous run did not clean up. Remove them and retry."
  exit 1
fi

# Run the gate, capture exit code + output. Never let it abort this script.
#
# NOTE: this used to end with `set -e`, which did not restore anything — the
# script declares `set -uo pipefail` and never enabled -e. So the first gate run
# silently armed errexit for everything after it, and a later scenario whose
# setup ended in a harmless non-zero (a `grep | head` taking SIGPIPE under
# pipefail) killed the run with no output and no failure count. A self-test that
# can exit silently mid-way reports "0 failed" for scenarios it never reached.
run_gate() {
  set +e
  GATE_OUT="$(bash "$GATE" 2>&1)"
  GATE_EXIT=$?
  return 0
}

expect() {
  local name="$1" want_exit="$2" want_text="${3:-}"
  local ok=1
  if [[ "$want_exit" == "0" && "$GATE_EXIT" -ne 0 ]]; then ok=0; fi
  if [[ "$want_exit" == "nonzero" && "$GATE_EXIT" -eq 0 ]]; then ok=0; fi
  if [[ -n "$want_text" ]] && ! grep -qF -- "$want_text" <<<"$GATE_OUT"; then ok=0; fi
  if [[ "$ok" -eq 1 ]]; then
    echo "  PASS  $name (exit $GATE_EXIT)"
    PASS=$((PASS + 1))
  else
    echo "::error::  FAIL  $name — wanted exit '$want_exit'${want_text:+ and text \"$want_text\"}, got exit $GATE_EXIT"
    echo "----- gate output (tail) -----"
    tail -n 25 <<<"$GATE_OUT"
    echo "------------------------------"
    FAIL=$((FAIL + 1))
  fi
}

# Assert a string is ABSENT from the last gate run. Used by the mutants: proving
# the NEW check fired is only half the claim — the other half is that the OLD
# checks stayed silent, which is what makes the scenario a real discrimination
# rather than a gate that fails for any reason at all.
expect_absent() {
  local name="$1" unwanted="$2"
  if grep -qF -- "$unwanted" <<<"$GATE_OUT"; then
    echo "::error::  FAIL  $name — did NOT expect text \"$unwanted\", but the gate printed it"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS  $name"
    PASS=$((PASS + 1))
  fi
}

expect_eq() {
  local name="$1" want="$2" got="$3"
  if [[ "$want" == "$got" ]]; then
    echo "  PASS  $name (got $got)"
    PASS=$((PASS + 1))
  else
    echo "::error::  FAIL  $name — wanted $want, got $got"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══ typecheck gate self-test (positive control) ═══"
echo

# ── 1. GREEN CONTROL ─────────────────────────────────────────────────────────
# Proves the harness can observe a PASS. Without this, every RED below could be
# a gate that fails unconditionally — which discriminates nothing.
echo "1/7  green control (clean tree)"
run_gate
expect "clean tree passes" 0 "Typecheck gate PASSED"
# Negative control for scenario 7's notice: on a clean tree it must be SILENT.
# Without this, "the notice fired" there would prove nothing — a notice that
# fires unconditionally reports drift on every green build and gets ignored.
expect_absent "no added-diagnostics notice on a clean tree" "NOT in the identity baseline appeared"
echo

# ── 2. RATCHET BITES ─────────────────────────────────────────────────────────
# A brand-new source file with an obvious type error. Under the old
# tsconfig.ci.json include list this file was INVISIBLE and the gate stayed
# green; under the derived tsconfig.app.json (`include: ["src"]`) it is compiled
# by construction and the per-file ratchet has no baseline row for it.
echo "2/7  ratchet bites on a NEW file with a type error"
mkdir -p "$(dirname "$BAD_SRC")"
cat >"$BAD_SRC" <<'TS'
// Self-test fixture, written and deleted by scripts/ci/typecheck-gate-selftest.sh.
// If you are reading this in a committed tree, the self-test crashed mid-run —
// delete the containing directory.
export const definitelyNotANumber: number = 'this is a string';
TS
run_gate
expect "new erroring file fails the ratchet" nonzero "New file(s) with TypeScript errors"
expect "the failure names the offending file" nonzero "$BAD_SRC"
rm -rf "$(dirname "$BAD_SRC")"
echo

# ── 3. COVERAGE BITES ────────────────────────────────────────────────────────
# A tracked TypeScript file that no project loads. `archive/` is excluded from
# tsconfig.tooling.json and its existing files are listed one-by-one in the
# exception list, so a NEW file there is genuinely invisible to the compiler —
# and must therefore fail. `git add -N` makes it visible to `git ls-files`
# (which is how the gate derives the source set) without staging its content.
echo "3/7  coverage bites on a tracked file NO project loads"
mkdir -p "$(dirname "$INVISIBLE")"
cat >"$INVISIBLE" <<'TS'
// Self-test fixture, written and deleted by scripts/ci/typecheck-gate-selftest.sh.
export const neverChecked = 1;
TS
git add -N -- "$INVISIBLE" >/dev/null
run_gate
expect "invisible tracked file fails coverage" nonzero "NO typecheck project loads"
expect "the failure names the invisible file" nonzero "$INVISIBLE"
git rm --cached -q --ignore-unmatch -- "$INVISIBLE" >/dev/null
rm -rf "$(dirname "$INVISIBLE")"
echo

# ── 4. STALE EXCEPTION ───────────────────────────────────────────────────────
# The exception list is the one hand-maintained artefact left, so it gets the
# bidirectional treatment: an entry that no longer describes reality must fail
# too, or the list would rot into a green lie exactly like the include list did.
echo "4/7  stale entry in the exception list fails"
printf 'archive/this-file-does-not-exist.selftest.ts\n' >>"$UNCOVERED"
run_gate
expect "stale exception entry fails coverage" nonzero "Stale entries"
git checkout -q -- "$UNCOVERED"
echo

# ── 5. THE DEDUP KEY, AND ITS MUTANT ─────────────────────────────────────────
# tsc renders the SAME diagnostic with union members in a DIFFERENT ORDER in
# different programs. Keyed on the whole line, that one error counts twice and
# gets baselined inflated; when the ordering later flips back, the ratchet goes
# red with no defect behind it.
#
# The fixture below is that exact shape — same file, same line, same column,
# same TS code, union members permuted. It is piped through THE GATE'S OWN dedup
# code path (`--dedup-filter`), not a copy of it, because a self-test that
# reimplements the logic it is testing is a mirror, and mirrors drift.
echo "5/7  the dedup key counts one error once, however tsc worded it"
cat >"$FIXTURES/union-order-twins.txt" <<'TXT'
src/example.ts(42,7): error TS2345: Argument of type '"error" | "skipped" | "unavailable" | "computed"' is not assignable to parameter of type '"error" | "unavailable" | "computed" | undefined'.
src/example.ts(42,7): error TS2345: Argument of type '"error" | "unavailable" | "skipped" | "computed"' is not assignable to parameter of type '"error" | "unavailable" | "computed" | undefined'.
TXT
DEDUP_N="$(bash "$GATE" --dedup-filter <"$FIXTURES/union-order-twins.txt" | wc -l | tr -d '[:space:]')"
expect_eq "two renderings of one error collapse to one diagnostic" 1 "$DEDUP_N"

# THE MUTANT. `sort -u` on the full line is what the gate did until 2026-07-27.
# If it also returned 1, the control above would be vacuous — it would pass
# whether or not the fix existed.
MUTANT_N="$(sort -u "$FIXTURES/union-order-twins.txt" | wc -l | tr -d '[:space:]')"
expect_eq "MUTANT: the old full-line key double-counts the same fixture" 2 "$MUTANT_N"
echo

# ── 6. THE WITHIN-FILE SWAP, AND ITS MUTANT ──────────────────────────────────
# Per-file counts cannot see a fix-one-add-one inside a single file: the count
# does not move. The per-(file, TS-code) counts derived from the identity
# baseline can, as long as the two errors have different codes.
#
# Rather than hand-write TypeScript that produces a specific pair of codes (which
# would rot the moment the file's real errors changed), this rewrites ONE row of
# the identity baseline to claim a different TS code. That is precisely a swap:
# the file's total is untouched, so the per-file ratchet is satisfied by
# construction, while one code's bucket is now short and another's is over.
echo "6/7  a within-file swap that changes the error CODE fails the ratchet"
SWAPPED_FILE="$(awk -F'\t' '!/^[[:space:]]*#/ && NF { print $2; exit }' "$IDENTITIES")"
awk -F'\t' -v OFS='\t' '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { print; next }
  !swapped { $3 = "TS9999"; swapped = 1 }
  { print }
' "$IDENTITIES" >"$FIXTURES/identities.swapped" && cp "$FIXTURES/identities.swapped" "$IDENTITIES"
run_gate
expect "a per-(file, TS-code) increase fails the ratchet" nonzero "MORE errors of a given TS code"
expect "the failure names the offending file" nonzero "$SWAPPED_FILE"

# THE MUTANT. The doctoring moved a row between CODE buckets without changing
# any per-file total, so the pre-existing count checks CANNOT have fired. If any
# of them appears in the output, this scenario is not testing what it claims.
expect_absent "MUTANT: the per-FILE ratchet is blind to this swap" "MORE type errors than the baseline allows"
expect_absent "MUTANT: the total-count check is blind to this swap" "Total typecheck errors increased"
expect_absent "MUTANT: the new-file check is blind to this swap" "New file(s) with TypeScript errors"
git checkout -q -- "$IDENTITIES"
echo

# ── 7. THE SAME-CODE SWAP IS REPORTED, NOT BLOCKED ───────────────────────────
# The case no count can see: same file, same TS code, a different error. Every
# blocking check is satisfied by construction, so the gate must PASS — and the
# added/removed notice must still name it. This is the mechanism that found the
# 37 diagnostics which landed between 23104baf and 607fa113 under a green
# ratchet, so it gets a positive control of its own: an absence assertion is
# worthless until you have watched it see a presence (scenario 1 is the matching
# negative control — silent on a clean tree).
echo "7/7  a same-code within-file swap PASSES the ratchet but is reported"
awk -F'\t' -v OFS='\t' '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { print; next }
  !swapped { $4 = "Self-test sentinel: a message no compiler will emit."; swapped = 1 }
  { print }
' "$IDENTITIES" >"$FIXTURES/identities.reworded" && cp "$FIXTURES/identities.reworded" "$IDENTITIES"
run_gate
expect "the gate still PASSES — no count moved" 0 "Typecheck gate PASSED"
expect "but the added diagnostic is reported" 0 "NOT in the identity baseline appeared"
expect "and the report names the file" 0 "$SWAPPED_FILE"
git checkout -q -- "$IDENTITIES"
echo

echo "═══ self-test: $PASS passed, $FAIL failed ═══"

# A run that dies in the middle prints "0 failed" for every scenario it never
# reached — the harness's own version of the invisibility this gate exists to
# stop. Assert the arithmetic instead of trusting that the script got here.
EXPECTED_ASSERTIONS=17
if [[ $((PASS + FAIL)) -ne "$EXPECTED_ASSERTIONS" ]]; then
  echo "::error::Self-test ran $((PASS + FAIL)) assertions, expected $EXPECTED_ASSERTIONS — it exited early, so this result means nothing."
  echo "::error::If you added or removed an assertion, update EXPECTED_ASSERTIONS in $0."
  exit 1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "::error::The typecheck gate did NOT behave as claimed. Do not trust a green typecheck until this passes."
  exit 1
fi
echo "The typecheck gate demonstrably discriminates: it passes clean trees and fails"
echo "new type errors, invisible files, and a rotted exception list."
exit 0

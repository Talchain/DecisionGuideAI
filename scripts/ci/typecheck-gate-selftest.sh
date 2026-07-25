#!/usr/bin/env bash
#
# POSITIVE CONTROL for scripts/ci/typecheck-gate.sh.
#
# A gate that asserts an absence ("no new type errors", "no invisible files") is
# worthless until you have proven it can SEE a presence. The gate this replaces
# was green for months while loading 9% of src — nobody had ever watched it go
# red for a reason it claimed to catch.
#
# So this drives the REAL gate, against the REAL projects, through four
# scenarios and asserts both the exit code and the message:
#
#   1. GREEN CONTROL      clean tree                       → exit 0
#   2. RATCHET BITES      new file with a type error       → exit 1, names the file
#   3. COVERAGE BITES     new tracked file no project loads→ exit 1, "NO typecheck project loads"
#   4. STALE EXCEPTION    bogus entry in the uncovered list→ exit 1, "Stale entries"
#
# Scenario 2 is the one that matters most: it is exactly the failure the old
# gate could not detect, because the file it would have to open was not in
# tsconfig.ci.json's hand-written include list.
#
# Every scenario mutates the working tree and then restores it. The script
# refuses to run on a dirty tree so it can never destroy uncommitted work, and
# its cleanup trap fires on every exit path.
#
# Runtime: ~2 min (scenarios 3 and 4 fail in the cheap coverage phase).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

GATE="scripts/ci/typecheck-gate.sh"
UNCOVERED="scripts/ci/typecheck-uncovered.txt"

# Scenario fixtures. `.selftest.` in the name keeps them obvious in a stray
# `git status`, and both live in directories the gate genuinely reaches.
BAD_SRC="src/__typecheck_gate_selftest__/deliberately-broken.selftest.ts"
INVISIBLE="archive/__typecheck_gate_selftest__/unreachable.selftest.ts"

PASS=0
FAIL=0

cleanup() {
  rm -rf "$REPO_ROOT/$(dirname "$BAD_SRC")" "$REPO_ROOT/$(dirname "$INVISIBLE")"
  git -C "$REPO_ROOT" rm --cached -q --ignore-unmatch -- "$BAD_SRC" "$INVISIBLE" >/dev/null 2>&1
  git -C "$REPO_ROOT" checkout -q -- "$UNCOVERED" 2>/dev/null
}
trap cleanup EXIT

# Refuse to run on a dirty tree: the scenarios stage files and restore tracked
# ones, and getting that wrong on top of real edits would be unforgivable.
if [[ -n "$(git status --porcelain -- "$UNCOVERED")" ]]; then
  echo "::error::$UNCOVERED has uncommitted changes — commit or stash before running the self-test."
  exit 1
fi
if [[ -e "$REPO_ROOT/$(dirname "$BAD_SRC")" || -e "$REPO_ROOT/$(dirname "$INVISIBLE")" ]]; then
  echo "::error::Self-test fixture directories already exist — a previous run did not clean up. Remove them and retry."
  exit 1
fi

# Run the gate, capture exit code + output. Never let it abort this script.
run_gate() {
  set +e
  GATE_OUT="$(bash "$GATE" 2>&1)"
  GATE_EXIT=$?
  set -e
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

echo "═══ typecheck gate self-test (positive control) ═══"
echo

# ── 1. GREEN CONTROL ─────────────────────────────────────────────────────────
# Proves the harness can observe a PASS. Without this, every RED below could be
# a gate that fails unconditionally — which discriminates nothing.
echo "1/4  green control (clean tree)"
run_gate
expect "clean tree passes" 0 "Typecheck gate PASSED"
echo

# ── 2. RATCHET BITES ─────────────────────────────────────────────────────────
# A brand-new source file with an obvious type error. Under the old
# tsconfig.ci.json include list this file was INVISIBLE and the gate stayed
# green; under the derived tsconfig.app.json (`include: ["src"]`) it is compiled
# by construction and the per-file ratchet has no baseline row for it.
echo "2/4  ratchet bites on a NEW file with a type error"
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
echo "3/4  coverage bites on a tracked file NO project loads"
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
echo "4/4  stale entry in the exception list fails"
printf 'archive/this-file-does-not-exist.selftest.ts\n' >>"$UNCOVERED"
run_gate
expect "stale exception entry fails coverage" nonzero "Stale entries"
git checkout -q -- "$UNCOVERED"
echo

echo "═══ self-test: $PASS passed, $FAIL failed ═══"
if [[ "$FAIL" -ne 0 ]]; then
  echo "::error::The typecheck gate did NOT behave as claimed. Do not trust a green typecheck until this passes."
  exit 1
fi
echo "The typecheck gate demonstrably discriminates: it passes clean trees and fails"
echo "new type errors, invisible files, and a rotted exception list."
exit 0

#!/usr/bin/env node
/**
 * ROADMAP 2.263 — the loud half of the rules-of-hooks exception list.
 *
 * WHY THIS EXISTS
 * ---------------
 * `react-hooks/rules-of-hooks` is now an ERROR, but 16 files were already
 * violating it when it was switched on. Setting those files to 'warn' is the
 * only way to land the rule without 234 red errors — and a 'warn' list is
 * exactly the hand-maintained mirror that has bitten this programme repeatedly:
 * it reads green while it rots, in BOTH directions.
 *
 * So the list is not trusted. This script DERIVES the current per-file counts
 * from ESLint itself and demands an exact match with the baseline:
 *
 *   · count UP in a listed file    → FAIL. A new crash was added under cover of
 *                                    an exception granted for old ones.
 *   · count DOWN in a listed file  → FAIL. Good news, and the baseline must
 *                                    record it, or the exception silently
 *                                    re-opens room for a regression later.
 *   · a listed file reaching zero  → FAIL. Delete the entry.
 *   · a listed file that no longer → FAIL. A path was renamed or deleted and
 *     exists                         the entry is now dead weight.
 *   · an UNLISTED file violating   → already a hard ESLint error; also caught
 *                                    here so the message names the ratchet.
 *
 * The failure mode of this design is a NOISY build, never a quiet one. That is
 * the point: the previous design's failure mode was a runtime crash nobody saw.
 */

import { ESLint } from 'eslint'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const baseline = require('./rules-of-hooks-baseline.json')

const RULE = 'react-hooks/rules-of-hooks'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const results = await new ESLint({ cwd: repoRoot }).lintFiles(['.'])

/** Derived truth: file → violation count, straight out of the linter. */
const actual = new Map()
for (const result of results) {
  const hits = result.messages.filter((m) => m.ruleId === RULE).length
  if (hits === 0) continue
  actual.set(path.relative(repoRoot, result.filePath), hits)
}

const expected = new Map(Object.entries(baseline.files))
const problems = []

/*
 * SELF-CONSISTENCY OF THE BASELINE ITSELF, BEFORE IT IS TRUSTED.
 *
 * `_total` is a second copy of information already in `files`, so it is a
 * mirror and will drift the moment someone edits one and not the other — and a
 * wrong `_total` is quoted in this script's own failure output, which is how a
 * misleading number reaches a reader. Deriving it here means the file cannot
 * disagree with itself.
 */
const declaredTotal = baseline._total
const summedTotal = [...expected.values()].reduce((a, b) => a + b, 0)
if (declaredTotal !== summedTotal) {
  problems.push(
    `BASELINE   _total says ${declaredTotal}, but the per-file counts sum to ${summedTotal}.\n` +
      `          These are the same fact written twice. Fix _total in\n` +
      `          scripts/ci/rules-of-hooks-baseline.json.`,
  )
}

for (const [file, count] of expected) {
  if (!Number.isInteger(count) || count < 1) {
    problems.push(
      `BASELINE   ${file} has a non-positive or non-integer count (${JSON.stringify(count)}).\n` +
        `          An entry exists to record REAL violations; zero means delete the entry.`,
    )
  }
}

/*
 * THE GROWTH GUARD — the part that used to be only a sentence.
 *
 * The baseline's own README says "do NOT add the file to the baseline to get
 * green", and until now that was prose: nothing stopped a future change from
 * appending an entry and going green. `_recordedAtTip` / `_recordedOn` pin the
 * measurement, and `_maxTotal` pins its ceiling, so ADDING a file or raising a
 * count now requires deliberately editing the ceiling and the date in the same
 * diff — visible in review, rather than a quiet append.
 *
 * The ceiling is a ratchet: it may be lowered freely as violations are fixed,
 * and raising it is the thing a reviewer is meant to notice and question.
 */
const ceiling = baseline._maxTotal
if (typeof ceiling !== 'number') {
  problems.push(
    `BASELINE   _maxTotal is missing. It is the enforced ceiling on total known\n` +
      `          violations; without it, entries can be appended silently.`,
  )
} else if (summedTotal > ceiling) {
  problems.push(
    `CEILING    known violations total ${summedTotal}, above the recorded ceiling ${ceiling}.\n` +
      `          Adding a file or raising a count is NOT how this goes green. Fix the\n` +
      `          hooks. If a raise is genuinely intended, raise _maxTotal AND update\n` +
      `          _recordedOn in the same diff so it is reviewed as a decision.`,
  )
}

for (const [file, actualCount] of actual) {
  const expectedCount = expected.get(file)
  if (expectedCount === undefined) {
    problems.push(
      `NEW FILE  ${file} — ${actualCount} rules-of-hooks violation(s).\n` +
        `          Hooks must not be called conditionally or after an early return.\n` +
        `          Fix them; do NOT add the file to the baseline to get green.`,
    )
  } else if (actualCount > expectedCount) {
    problems.push(
      `INCREASED ${file} — ${expectedCount} → ${actualCount}.\n` +
        `          This file had an exception for its EXISTING violations, not a licence\n` +
        `          to add more. Each one is a render-time crash.`,
    )
  } else if (actualCount < expectedCount) {
    problems.push(
      `DECREASED ${file} — ${expectedCount} → ${actualCount}. Real progress.\n` +
        `          Lower the number in scripts/ci/rules-of-hooks-baseline.json to ${actualCount}\n` +
        `          so the exception cannot silently re-open.`,
    )
  }
}

for (const [file, expectedCount] of expected) {
  if (actual.has(file)) continue
  problems.push(
    `CLEARED   ${file} — baseline expects ${expectedCount}, linter now reports none.\n` +
      `          Remove the entry from scripts/ci/rules-of-hooks-baseline.json (and from the\n` +
      `          eslint.config.js override it feeds) so the rule applies at full strength here.`,
  )
}

const actualTotal = [...actual.values()].reduce((a, b) => a + b, 0)

if (problems.length > 0) {
  console.error(`\n✘ rules-of-hooks ratchet drift (${problems.length} problem(s)):\n`)
  for (const p of problems) console.error(`  ${p}\n`)
  console.error(
    `  Baseline total ${baseline._total}, derived total ${actualTotal}.\n` +
      `  Baseline recorded at tip ${baseline._recordedAtTip} on ${baseline._recordedOn}.\n`,
  )
  process.exit(1)
}

console.log(
  `✔ rules-of-hooks ratchet: ${actualTotal} known violation(s) across ${actual.size} file(s), ` +
    `exactly matching the baseline. No new conditional hooks.`,
)

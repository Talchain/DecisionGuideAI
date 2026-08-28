// e2e/core/lib/manifest.ts
// =============================================================================
// THE COMPLETENESS GUARD'S LEDGER.
// =============================================================================
// "Assert your own collected count BY NAME." Playwright exits 0 on "no test files
// found", and this repo has already shipped a check that reported SUCCESS having
// executed nothing for 204 days. A green exit code, a zero-failure line and a
// healthy-looking total are all fully consistent with this suite having measured
// NOTHING — if a filter, a rename, a testMatch typo or a skipped describe removes
// the work, nothing is red and nothing ran.
//
// So the run is asserted against an EXPECTED SET, BY NAME, in BOTH directions.
// Yes, EXPECTED_CORE_SPECS is a hand-maintained list. Here that is the POINT
// rather than the usual defect: the guard exists precisely to fail loud when the
// suite and the list drift apart, in either direction.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const MANIFEST_PATH = 'test-results/core/spec-manifest.json'

/** Where the spec files live, relative to the repo root (Playwright's cwd). */
export const CORE_SPEC_DIR = 'e2e/core'
const SPEC_SUFFIX = '.core.spec.ts'

/**
 * Every spec System E expects to execute — DECLARED AS WHAT SHIPS, never as what is
 * planned. A spec is added here in the SAME commit that adds the spec file.
 *
 * ⚠ WHY THIS LIST IS EXACTLY THE FILES ON DISK, AND WHY THAT MATTERS MORE THAN THE
 * AMBITION IT USED TO RECORD. It previously also named E3, E4, E7 and E8, which do
 * not exist. The arithmetic consequence was not cosmetic: a PERFECT run of every
 * shipped spec still failed the guard with four missing, so the ONLY green mode was
 * `CORE_PARTIAL=1`. A flag that must be set on every green run is a flag that is
 * always set — and this one skipped the guard entirely, including its zero-ran limb.
 * Measured on this build before the repair: every describe skipped, `CORE_PARTIAL=1`,
 * `3 skipped`, `Ran 0 of 7: (none)`, EXIT 0. Zero specs measured, reported as success,
 * which is the exact defect the header above says this ledger exists to prevent.
 *
 * A guard whose ARMED state is unreachable is not a strict guard. It is an off
 * switch with a comment explaining how strict it would be.
 */
export const EXPECTED_CORE_SPECS = [
  'E1-entry-living-model',
  'E2-readiness-truthful',
  'E5-persistence-reload',
] as const

/**
 * Not yet written. DOCUMENTATION ONLY — never read by the completeness guard, because
 * a name in an enforced list is a claim that a spec ran, and a spec that does not
 * exist cannot run. Each name moves into EXPECTED_CORE_SPECS in the same commit that
 * adds its file.
 *
 * E6 (stale/rerun) is deliberately absent from BOTH lists: its surfaces were not
 * observed to mount in the pre-run DOM census of 2026-08-27, and a spec that logs a
 * verdict it cannot compute is worse than no spec.
 */
export const PLANNED_CORE_SPECS = [
  'E3-analysis-runs',
  'E4-edit-honours-value',
  'E7-coaching-continuation',
  'E8-ownership-isolation',
] as const

/** The spec basenames actually on disk, DERIVED — the source of truth, not a mirror. */
export function specFilesOnDisk(dir: string = CORE_SPEC_DIR): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(SPEC_SUFFIX))
    .map((f) => f.slice(0, -SPEC_SUFFIX.length))
    .sort()
}

/**
 * DERIVED, FAIL-LOUD: the declared set must equal the files on disk, both ways.
 *
 * The runtime guard in globalTeardown can only ever report a listed-but-fileless spec
 * as "DID NOT RUN", which is indistinguishable from a spec that exists and was
 * filtered out — and that ambiguity is precisely what made `CORE_PARTIAL=1` look like
 * a reasonable standing workaround. This says which of the two it is, BEFORE the run,
 * so the list cannot quietly drift from the suite in either direction again.
 */
export function assertDeclaredSpecsExist(dir: string = CORE_SPEC_DIR): void {
  const onDisk = specFilesOnDisk(dir)
  const declared: string[] = [...EXPECTED_CORE_SPECS]
  const declaredWithNoFile = declared.filter((n) => !onDisk.includes(n))
  const fileNotDeclared = onDisk.filter((n) => !declared.includes(n))
  if (declaredWithNoFile.length === 0 && fileNotDeclared.length === 0) return
  throw new Error(
    `[core] EXPECTED_CORE_SPECS HAS DRIFTED FROM THE FILES IN ${dir}/.\n` +
    (declaredWithNoFile.length
      ? `  DECLARED BUT NO FILE: ${declaredWithNoFile.join(', ')}\n` +
        `    These can never run, so the guard can never be satisfied and every green run\n` +
        `    would have to set CORE_PARTIAL=1 — which switches the guard off entirely.\n` +
        `    Declare only what ships; planned specs belong in PLANNED_CORE_SPECS.\n`
      : '') +
    (fileNotDeclared.length
      ? `  FILE BUT NOT DECLARED: ${fileNotDeclared.join(', ')}\n` +
        `    A spec was added and the ledger was not updated in the same commit.\n`
      : '') +
    `  Declared: ${declared.join(', ') || '(none)'}\n  On disk:  ${onDisk.join(', ') || '(none)'}`,
  )
}

/**
 * The completeness arithmetic, as a pure function so the required test suite can
 * execute it without a browser or a deployed target.
 *
 * ⭐ THE ORDER OF THE TWO CHECKS IS THE CONTRACT, NOT A STYLE CHOICE.
 * `partial` (CORE_PARTIAL=1) declares "I deliberately ran a SUBSET". It used to be
 * consulted FIRST, so it also suppressed the zero-ran limb — and because the declared
 * list named four specs that did not exist, `partial` was the only mode in which this
 * suite could ever be green. The two defects composed into: a run that measured
 * NOTHING exiting 0 and printing a reassuring "Ran 0 of 7" line.
 *
 * So: zero-ran is checked FIRST and unconditionally. Zero is not a subset.
 */
export function assertRunCompleteness(
  expected: string[],
  actual: string[],
  partial: boolean,
): void {
  if (actual.length === 0) {
    throw new Error(
      `[core] COMPLETENESS GUARD FAILED: ZERO Core specs executed.\n` +
      `  Expected ${expected.length}, BY NAME: ${expected.join(', ') || '(none)'}\n` +
      `  This run measured nothing and MUST NOT be reported as a pass. Playwright exits 0 on\n` +
      `  "no test files found", which is indistinguishable from success at the exit code alone.\n` +
      `  Likely causes: a testMatch that matches nothing, a bad --grep, or every spec skipping.\n` +
      `  CORE_PARTIAL=1 does NOT suppress this: it declares a deliberate SUBSET, and zero is\n` +
      `  not a subset of anything you can report.`,
    )
  }

  if (partial) {
    // eslint-disable-next-line no-console
    console.log(
      `[core] CORE_PARTIAL=1 — completeness guard SKIPPED. Ran ${actual.length} of ` +
      `${expected.length}: ${actual.join(', ')}`,
    )
    return
  }

  const missing = expected.filter((n) => !actual.includes(n))
  const unexpected = actual.filter((n) => !expected.includes(n))
  const duplicates = actual.filter((n, i) => actual.indexOf(n) !== i)

  if (missing.length || unexpected.length || duplicates.length) {
    throw new Error(
      `[core] COMPLETENESS GUARD FAILED.\n` +
      (missing.length ? `  DID NOT RUN (expected, absent): ${missing.join(', ')}\n` : '') +
      (unexpected.length ? `  RAN BUT NOT EXPECTED: ${unexpected.join(', ')} — a spec was added and\n` +
        `    EXPECTED_CORE_SPECS was not updated; the list has drifted from the suite.\n` : '') +
      (duplicates.length ? `  DUPLICATE REGISTRATION: ${duplicates.join(', ')}\n` : '') +
      `  Expected set: ${expected.join(', ')}\n  Actually ran: ${actual.join(', ')}`,
    )
  }
}

export function resetManifest(build: string): void {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  writeFileSync(MANIFEST_PATH, JSON.stringify({ ran: [], buildAtStart: build }, null, 2))
}

/** The commit the target was serving when the run began. */
export function buildAtStart(): string {
  if (!existsSync(MANIFEST_PATH)) return 'unknown'
  try {
    return (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { buildAtStart?: string })
      .buildAtStart ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Recorded when a spec STARTS, not when it passes. A spec that ran and FAILED has
 * still been measured — conflating "did not run" with "did not pass" is how a
 * cascade of real failures gets misreported as an empty run.
 */
export function recordSpecRan(name: string): void {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  const cur = readManifest()
  if (!cur.includes(name)) {
    writeFileSync(
      MANIFEST_PATH,
      JSON.stringify({ ran: [...cur, name], buildAtStart: buildAtStart() }, null, 2),
    )
  }
}

export function readManifest(): string[] {
  if (!existsSync(MANIFEST_PATH)) return []
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { ran?: unknown }
    return Array.isArray(parsed.ran) ? (parsed.ran as string[]) : []
  } catch {
    return []
  }
}

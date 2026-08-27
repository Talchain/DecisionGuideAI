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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const MANIFEST_PATH = 'test-results/core/spec-manifest.json'

/**
 * Every spec System E expects to execute. A spec is added here in the SAME commit
 * that adds the spec file — never later.
 *
 * E6 (stale/rerun) is deliberately ABSENT: its surfaces were not observed to mount
 * in the pre-run DOM census of 2026-08-27, and a spec that logs a verdict it cannot
 * compute is worse than no spec. It is a reported FINDING until its surfaces are
 * pinned, and it joins this list only when they are.
 */
export const EXPECTED_CORE_SPECS = [
  'E1-entry-living-model',
  'E2-readiness-truthful',
  'E3-analysis-runs',
  'E4-edit-honours-value',
  'E5-persistence-reload',
  'E7-coaching-continuation',
  'E8-ownership-isolation',
] as const

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

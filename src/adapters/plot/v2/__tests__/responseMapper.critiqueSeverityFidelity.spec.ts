/**
 * Critique severity fidelity: PLoT v2 -> canonical ReportV1.
 *
 * WHY THIS EXISTS
 * ---------------
 * The PINNED ISL contract (plot-lite-service
 * `tests/fixtures/isl-pinned/isl-openapi.json`,
 * `components.schemas.CritiqueV2.properties.severity.enum`) declares FOUR
 * severities:
 *
 *     ["info", "warning", "error", "blocker"]
 *
 * PLoT forwards `error` verbatim onto the v2 wire — `mapISLCritiquesToV2`
 * (plot-lite-service `src/routes/v2/run.ts`) has an explicit
 * `c.severity === 'error' ? 'error'` branch, and its own
 * `CritiqueSeverityV3` union carries all four members.
 *
 * The UI's `V2Critique` type admitted only three, and `mapCritiqueSeverity`
 * fell through to `default: return 'INFO'`. So an ISL-authored `error`
 * critique — the second-most-severe level the science can produce — was
 * silently presented to the user as merely informational.
 *
 * WHAT THIS FILE PINS, AND THE OPPOSITE HARM
 * ------------------------------------------
 * The fix must NOT over-correct. PLoT sets `blocks_analysis: c.severity ===
 * 'blocker'`, so an `error` critique explicitly does NOT block analysis, and
 * promoting it to `BLOCKER` would make the product assert a blocker the
 * science never declared — worse than showing none. `WARNING` is the closest
 * truthful bucket in the canonical `INFO | WARNING | BLOCKER` space.
 *
 * Every assertion below binds to its critique by `code` (identity), never by
 * severity value — a different critique in the same array could satisfy a
 * value predicate.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1 } from '../responseMapper'
import type { V2RunResponse, V2Critique } from '../types'

/**
 * Build critiques for the wire. The wire is untyped at runtime; this cast
 * models what PLoT actually sends, which is wider than the local union was.
 */
function wireCritiques(items: Array<{ code: string; severity: string; message: string }>): V2Critique[] {
  return items as unknown as V2Critique[]
}

function makeResponse(critiques: V2Critique[]): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      { option_id: 'opt1', option_label: 'Option 1', confidence_interval: [30, 70] },
    ],
    critiques,
    drivers: [],
    edge_sensitivity: [],
  } as unknown as V2RunResponse
}

/** Find a mapped critique by its CODE — identity, not a value predicate. */
function critiqueByCode(report: ReturnType<typeof mapV2ResponseToReportV1>, code: string) {
  const found = (report.run?.critique ?? []).filter((c) => c.code === code)
  // Pin the precondition: exactly one critique carries this code, so the
  // assertion below is provably about THIS object and not a namesake.
  expect(found).toHaveLength(1)
  return found[0]
}

describe('critique severity fidelity (PLoT v2 -> canonical)', () => {
  const ALL_FOUR = wireCritiques([
    { code: 'C_BLOCKER', severity: 'blocker', message: 'Model is not identifiable' },
    { code: 'C_ERROR', severity: 'error', message: 'Correlation matrix is not positive semi-definite' },
    { code: 'C_WARNING', severity: 'warning', message: 'Wide confidence interval' },
    { code: 'C_INFO', severity: 'info', message: 'Seed was defaulted' },
  ])

  it('pins the precondition: all four ISL severities survive mapping', () => {
    // The mapper also appends synthetic critiques for computed-but-empty
    // anomalies, so this asserts OUR four are present rather than that the
    // array holds nothing else. Each assertion below then binds by code.
    const report = mapV2ResponseToReportV1(makeResponse(ALL_FOUR), { seed: 42 })
    const codes = (report.run?.critique ?? []).map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['C_BLOCKER', 'C_ERROR', 'C_WARNING', 'C_INFO']))
  })

  // ---- THE DEFECT ---------------------------------------------------------

  it('maps an ISL "error" critique to WARNING, not INFO', () => {
    const report = mapV2ResponseToReportV1(makeResponse(ALL_FOUR), { seed: 42 })
    expect(critiqueByCode(report, 'C_ERROR').severity).toBe('WARNING')
  })

  // ---- THE OPPOSITE HARM --------------------------------------------------
  // These must be GREEN at pristine AND stay green after the fix. They are
  // what catches an over-correction that invents a blocker.

  it('does NOT promote an ISL "error" critique to BLOCKER (it does not block analysis)', () => {
    const report = mapV2ResponseToReportV1(makeResponse(ALL_FOUR), { seed: 42 })
    expect(critiqueByCode(report, 'C_ERROR').severity).not.toBe('BLOCKER')
  })

  it('does NOT promote an unrecognised severity to BLOCKER or WARNING', () => {
    const report = mapV2ResponseToReportV1(
      makeResponse(
        wireCritiques([
          { code: 'C_UNKNOWN', severity: 'catastrophic', message: 'A severity nobody has shipped' },
        ])
      ),
      { seed: 42 }
    )
    const mapped = critiqueByCode(report, 'C_UNKNOWN')
    expect(mapped.severity).not.toBe('BLOCKER')
    expect(mapped.severity).not.toBe('WARNING')
    expect(mapped.severity).toBe('INFO')
  })

  // ---- REGRESSION GUARDS ON THE THREE THAT ALREADY WORKED -----------------

  it('keeps blocker -> BLOCKER', () => {
    const report = mapV2ResponseToReportV1(makeResponse(ALL_FOUR), { seed: 42 })
    expect(critiqueByCode(report, 'C_BLOCKER').severity).toBe('BLOCKER')
  })

  it('keeps warning -> WARNING and info -> INFO', () => {
    const report = mapV2ResponseToReportV1(makeResponse(ALL_FOUR), { seed: 42 })
    expect(critiqueByCode(report, 'C_WARNING').severity).toBe('WARNING')
    expect(critiqueByCode(report, 'C_INFO').severity).toBe('INFO')
  })
})

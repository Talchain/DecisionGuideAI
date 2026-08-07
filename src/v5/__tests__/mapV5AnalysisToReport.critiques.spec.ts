/**
 * LANE 3 (P1/P4) — RED-FIRST: projected `enrichment.critiques` reach the
 * live V5 report at the canonical slot `report.run.critique`.
 *
 * ⚠ RED AT PRISTINE (UI `6d5db185`): `mapV5AnalysisToReport` has ZERO
 * critique references — it never builds `run`, so every critique CEE now
 * transports (CEE `d2cdd99b`, keep-list entry compose.ts:648, projection
 * `projectCritiquesForTransport` sanitise-enrichment.ts:690) dies at this
 * mapper. ROADMAP 2.358 / 2.293 name this exact death.
 *
 * FIXTURE PROVENANCE (identity-bound, not invented): rows below are shaped
 * EXACTLY as `projectCritiquesForTransport` emits at CEE `d2cdd99b`
 * (sanitise-enrichment.ts:690-760, read 2026-08-04 in a fresh blobless
 * clone): `message` is NEVER present (withheld — internal wording);
 * `user_message` is ALWAYS present (S-bucket = the Paul-approved 2026-04-30
 * copy, rendered CEE-side with resolved labels); severity is the lowercase
 * V2 wire union 'info'|'warning'|'error'|'blocker'; structural fields are
 * the projection's explicit allow-list: id, code, severity, source,
 * blocks_analysis, affected_node_ids, affected_option_ids, suggestion.
 * The EMPTY_INTERVENTIONS user_message is the verbatim output of
 * S_BUCKET_REPLACEMENTS.EMPTY_INTERVENTIONS for an option labelled 'Bravo'.
 *
 * Assertions BIND BY IDENTITY (code + exact user_message string), never by
 * a value predicate another row could satisfy (CLAUDE.md trap 19).
 *
 * Named signatures at pristine:
 *   mapV5AnalysisToReport(block: AnalysisResultBlock,
 *     options?: MapV5AnalysisOptions): ReportV1        — src/v5/mapV5AnalysisToReport.ts:717
 *   ReportV1.run?: CanonicalRun                        — src/adapters/plot/types.ts:83
 *   CanonicalRun = { responseHash; bands; confidence?; critique?: CritiqueItemV1[] }
 *                                                      — src/adapters/plot/types.ts:318
 *   CritiqueItemV1.severity: 'INFO'|'WARNING'|'BLOCKER' — src/adapters/plot/types.ts:304
 *
 * MUTANT OBLIGATION (Phase 1, throwaway worktree OUTSIDE the repo root):
 * deleting the new critiques read in the mapper must RED every test here
 * (the extractor-deletion mutant, trap 19's proof obligation).
 */

import { describe, it, expect } from 'vitest'
import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'

/** Verbatim CEE S-bucket copy for EMPTY_INTERVENTIONS, option label 'Bravo'. */
const EMPTY_INTERVENTIONS_COPY =
  "Option 'Bravo' does not change anything yet. Specify what makes this option different."

/** Producer-authored U-bucket user_message (INSUFFICIENT_OPTIONS is bucket U). */
const INSUFFICIENT_OPTIONS_COPY =
  'Add at least one more option to compare against.'

function liveShapedBlock(critiques: unknown): Record<string, unknown> {
  return {
    type: 'analysis_result',
    summary: 'Analysis complete',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.58, opt_b: 0.42 },
    enrichment: {
      option_comparison: [
        { option_id: 'opt_a', label: 'Alpha', win_probability: 0.58 },
        { option_id: 'opt_b', label: 'Bravo', win_probability: 0.42 },
      ],
      factor_sensitivity: [
        { factor_id: 'fac_churn', factor_label: 'Customer churn', sensitivity: 0.4 },
      ],
      ...(critiques !== undefined ? { critiques } : {}),
    },
  }
}

const PROJECTED_ROWS = [
  {
    // S-bucket row exactly as projected: no `message`, display-ready copy.
    code: 'EMPTY_INTERVENTIONS',
    severity: 'warning',
    source: 'validation',
    user_message: EMPTY_INTERVENTIONS_COPY,
    affected_option_ids: ['opt_b'],
    affected_node_ids: ['opt_b'],
    suggestion: 'Specify what this option changes.',
  },
  {
    // U-bucket row: producer user_message shipped as-is.
    code: 'INSUFFICIENT_OPTIONS',
    severity: 'info',
    source: 'isl',
    user_message: INSUFFICIENT_OPTIONS_COPY,
  },
]

describe('mapV5AnalysisToReport — projected critiques reach report.run.critique (RED at pristine)', () => {
  it('carries every surviving projected row, bound by code + exact user_message', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock(PROJECTED_ROWS) as never)
    const rows = report.run?.critique ?? []

    const empties = rows.filter((c) => c.code === 'EMPTY_INTERVENTIONS')
    expect(empties).toHaveLength(1)
    // The wire row has NO `message`; the display-safe user_message must be
    // what populates the consumer-required `message` slot — verbatim.
    expect(empties[0]!.message).toBe(EMPTY_INTERVENTIONS_COPY)

    const insufficient = rows.filter((c) => c.code === 'INSUFFICIENT_OPTIONS')
    expect(insufficient).toHaveLength(1)
    expect(insufficient[0]!.message).toBe(INSUFFICIENT_OPTIONS_COPY)
  })

  it("maps the lowercase wire severity to the consumer's uppercase union (uncertainties filter reads 'WARNING')", () => {
    const report = mapV5AnalysisToReport(liveShapedBlock(PROJECTED_ROWS) as never)
    const byCode = new Map((report.run?.critique ?? []).map((c) => [c.code, c]))
    // useResultsSectionData.ts:2454 filters on severity === 'WARNING'
    // (uppercase only). A lowercase pass-through would silently drop every
    // projected row from the uncertainties list — the invisible failure.
    expect(byCode.get('EMPTY_INTERVENTIONS')?.severity).toBe('WARNING')
    expect(byCode.get('INSUFFICIENT_OPTIONS')?.severity).toBe('INFO')
  })

  it('threads node identity and suggestion (node_id from affected_node_ids[0]; suggested_fix from suggestion)', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock(PROJECTED_ROWS) as never)
    const row = (report.run?.critique ?? []).find((c) => c.code === 'EMPTY_INTERVENTIONS')
    expect(row?.node_id).toBe('opt_b')
    expect(row?.suggested_fix).toBe('Specify what this option changes.')
  })

  it('is absence-preserving: no critiques key ⇒ no critique slot (absent ≠ empty)', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock(undefined) as never)
    expect(report.run?.critique).toBeUndefined()
  })

  it('a producer-sent empty array mints NO run (review F7: CEE never emits empty critiques — do not pin a nonexistent producer behaviour)', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock([]) as never)
    expect(report.run).toBeUndefined()
  })

  it('an all-malformed array mints NO run (nothing survived ⇒ no slot, same as no key)', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock([null, 42, 'garbage']) as never)
    expect(report.run).toBeUndefined()
  })

  it('F1 pin — the minted run has NO bands key AT ALL (true absence; a null-bands OBJECT is truthy and nulls real numbers)', () => {
    const report = mapV5AnalysisToReport(liveShapedBlock(PROJECTED_ROWS) as never)
    // RED at pristine (run is undefined). Review #585 F1, executable-proven:
    // OutputsDock.tsx:1188-1194 (`canonicalBands ? canonicalBands.p50 :
    // report?.results?.likely`) and share/decisionSummary.ts:28-37
    // (`if (bands)` early-return) branch on OBJECT TRUTHINESS — a
    // `{p10:null,p50:null,p90:null}` object would send mostLikelyValue
    // 83079.94 → null on exactly the turns this reader lights up. The key
    // must be ABSENT, not present-and-null-shaped.
    expect(report.run).toBeDefined()
    expect('bands' in report.run!).toBe(false)
    // The two truthiness readers' guard expressions, replayed literally:
    const canonicalBands = report.run?.bands ?? null
    expect(canonicalBands).toBeNull()
    // And the responseHash on the run must be the report's own hash — one
    // identity, not a second derivation.
    expect(report.run!.responseHash).toBe(report.model_card?.response_hash)
  })

  it('drops malformed rows defensively (non-object entries), keeps the identified survivors', () => {
    const report = mapV5AnalysisToReport(
      liveShapedBlock([null, 'garbage', ...PROJECTED_ROWS]) as never,
    )
    const rows = report.run?.critique ?? []
    expect(rows.map((c) => c.code).sort()).toEqual([
      'EMPTY_INTERVENTIONS',
      'INSUFFICIENT_OPTIONS',
    ])
  })
})

/**
 * A producer inference warning is stated ONCE on the Analysis surface.
 *
 * ── Derived at the DEPLOYED surface, staging `c71ea7e0` ────────────────────
 * The Analysis tab rendered the SAME three humanised warnings twice, five
 * screens apart:
 *
 *   `inference-warning-strip`   (top of the results body)     3 entries
 *   `trust-inference-warnings`  (Advanced and receipts)       the same 3, verbatim
 *
 * Both read the identical producer field through the identical humaniser
 * (`selectHumanisedInferenceWarnings` / `humaniseInferenceWarningTitle`), so
 * (historic names, kept as the record of the defect: the unfiltered
 * `selectHumanisedInferenceWarnings` went callerless once the complement below
 * landed and was deleted on 18 Aug 2026 — only the ...OutsideStrip form remains)
 * they cannot differ in wording — they can only repeat. What separates them is
 * SEVERITY: the strip shows `severity === 'warning'` only; Advanced showed
 * every entry with a message. The overlap is therefore total by construction,
 * and it grows every time a warning-severity entry arrives.
 *
 * ── The rule, and why it is not "delete one" ───────────────────────────────
 * "Less interface, not less intelligence." Advanced legitimately carried
 * entries the strip filters out (info-severity), and deleting the block would
 * lose them. So Advanced now renders the REMAINDER — the entries the strip
 * does not show — and nothing else.
 *
 * The invariant is stated over the two mounts jointly rather than over either
 * one, because either alone is satisfiable while the surface still repeats
 * itself:
 *
 *   for every producer warning, the number of places on the Analysis surface
 *   that state it is EXACTLY ONE.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { ResultsBody } from '../ResultsBody'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * Shaped after the warnings the deployed run actually carried: three
 * warning-severity entries plus one that is not, so the remainder is non-empty
 * and the "Advanced keeps what the strip filters out" half is observable.
 */
const WARNINGS = [
  {
    code: 'CONSTRAINT_TARGET_UNRELIABLE',
    severity: 'warning',
    message: 'constraint_fac_alpha target unreliable',
    affected_nodes: ['fac_alpha'],
    affected_labels: ['Alpha'],
  },
  {
    code: 'CONSTRAINT_DIRECTION_SUSPECT',
    severity: 'warning',
    message: 'constraint_fac_beta direction suspect',
    affected_nodes: ['fac_beta'],
    affected_labels: ['Beta'],
  },
  {
    code: 'SAMPLES_REDUCED_FOR_COMPLEXITY',
    severity: 'info',
    message: 'reduced from 500 to 200 samples',
  },
]

function makeResponse(): V2RunResponse {
  const outcome = (mean: number) => ({
    mean,
    std: 12,
    p10: mean - 20,
    p50: mean,
    p90: mean + 20,
    n_samples: 1000,
    n_valid_samples: 1000,
    validity_ratio: 1,
  })
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [40, 80],
        win_probability: 0.72,
        outcome: outcome(60),
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [20, 60],
        win_probability: 0.2,
        outcome: outcome(40),
      },
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: {
      // The producer carries these UNDER `robustness` (responseMapper.ts:567),
      // not at the top level — derived at the mapper, not assumed.
      inference_warnings: WARNINGS,
      fragile_edges: [],
      robust_edges: ['e1'],
      recommended_option_id: 'opt_a',
      recommendation_stability: 0.92,
      near_tie: { is_tie: false, top_option_id: 'opt_a', second_option_id: 'opt_b', gap: 0.52, threshold: 0.1 },
    } as never,
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
  } as unknown as V2RunResponse
}

function renderSurface(): HTMLElement {
  const v2 = makeResponse()
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV2ResponseToReportV1(v2, { seed: 42 }) },
    runMeta: {},
    nodes: [
      { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', type: 'option', label: 'Option A' } },
      { id: 'opt_b', type: 'option', position: { x: 400, y: 0 }, data: { kind: 'option', type: 'option', label: 'Option B' } },
      { id: 'fac_alpha', type: 'factor', position: { x: 0, y: 200 }, data: { kind: 'factor', type: 'factor', label: 'Alpha' } },
      { id: 'fac_beta', type: 'factor', position: { x: 200, y: 200 }, data: { kind: 'factor', type: 'factor', label: 'Beta' } },
    ],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: v2,
    goalThreshold: null,
    viewMode: 'expert',
  } as never)

  const { result } = renderHook(() => useResultsSectionData())
  const { container } = render(
    <ResultsBody
      resultsSectionData={result.current}
      tornadoData={{ rows: [], expectedOutcome: null }}
      expertMode
    />,
  )
  return container
}

/** Sentences rendered by a given mount, bound by testid — never page text. */
function sentencesIn(container: HTMLElement, testid: string): string[] {
  const root = container.querySelector(`[data-testid="${testid}"]`)
  if (!root) return []
  return Array.from(root.querySelectorAll('li, [data-testid="inference-warning-strip-entry"]'))
    .map(n => (n.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

describe('inference warnings: one mount per producer entry', () => {
  it('POSITIVE CONTROL: the strip mount is visible to the probe and non-empty', () => {
    const c = renderSurface()
    const strip = sentencesIn(c, 'inference-warning-strip')
    expect(strip.length, 'the probe read nothing — it is blind, so any absence below is vacuous').toBeGreaterThan(0)
  })

  it('the Advanced trust list repeats nothing the strip already states', () => {
    const c = renderSurface()
    const strip = new Set(sentencesIn(c, 'inference-warning-strip'))
    const advanced = sentencesIn(c, 'trust-inference-warnings')
    const repeated = advanced.filter(s => strip.has(s))
    expect(
      repeated,
      `These sentences are stated twice on one surface:\n  ${repeated.join('\n  ')}`,
    ).toEqual([])
  })

  it('and the entries the strip FILTERS OUT survive in Advanced — nothing is lost', () => {
    const c = renderSurface()
    const strip = sentencesIn(c, 'inference-warning-strip')
    const advanced = sentencesIn(c, 'trust-inference-warnings')
    // The info-severity entry is the one the strip excludes by contract.
    expect(strip.join(' | ')).not.toMatch(/reduced precision/i)
    expect(
      advanced.join(' | '),
      'the strip filters info-severity out; if Advanced drops it too the finding is gone from the product',
    ).toMatch(/reduced precision/i)
  })
})

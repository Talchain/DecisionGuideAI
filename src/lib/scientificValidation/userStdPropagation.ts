/**
 * user_std_propagation — verifies that user-supplied
 * `observed_state.std` flows canvas → PLoT request → ISL request →
 * `parameter_uncertainties.std`. (Scientific PR #168 / #169.)
 *
 * DGAI's bundle does NOT carry an independent ISL request payload —
 * ISL is invoked inside PLoT and DGAI only sees the V2 PLoT request /
 * response. This validator therefore:
 *   - reads `bundle.payloads.isl_request.parameter_uncertainties` first;
 *   - if absent (the common case), emits `unavailable` with
 *     `required_upstream_support: ['plot.debug.isl_request']`;
 *   - optionally includes an `expected_from_plot_request` inferred map
 *     reconstructed from `bundle.payloads.plot_request.graph.nodes[].data.observed_state.std`
 *     so reviewers can compare manually — but `claim_strength` stays
 *     `unavailable` (NEVER `inferred`+`pass`).
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

interface ExpectedEntry {
  factor_id: string
  std: number | null
  source: 'plot_request.graph.nodes[*].data.observed_state.std'
}

function inferExpectedFromPlotRequest(plotRequest: unknown): ExpectedEntry[] {
  if (!plotRequest || typeof plotRequest !== 'object' || Array.isArray(plotRequest)) return []
  const graph = (plotRequest as Record<string, unknown>).graph
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return []
  const nodes = (graph as Record<string, unknown>).nodes
  if (!Array.isArray(nodes)) return []
  const out: ExpectedEntry[] = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || Array.isArray(n)) continue
    const node = n as Record<string, unknown>
    const id = typeof node.id === 'string' ? node.id : null
    if (!id) continue
    const data = (node.data ?? {}) as Record<string, unknown>
    const obs = (data.observed_state ?? data.observedState) as Record<string, unknown> | undefined
    if (!obs || typeof obs !== 'object') continue
    const std = typeof obs.std === 'number' ? obs.std : null
    if (std === null) continue
    out.push({
      factor_id: id,
      std,
      source: 'plot_request.graph.nodes[*].data.observed_state.std',
    })
  }
  return out
}

interface ObservedEntry {
  factor_id: string
  std: number | null
  status: 'pass' | 'widened' | 'missing' | 'defaulted'
}

function compareWithIslRequest(
  islRequest: unknown,
  expected: ExpectedEntry[],
): { entries: ObservedEntry[]; sourcePath: string } | null {
  if (!islRequest || typeof islRequest !== 'object' || Array.isArray(islRequest)) return null
  const pu = (islRequest as Record<string, unknown>).parameter_uncertainties
  if (!pu || typeof pu !== 'object' || Array.isArray(pu)) return null
  const entries: ObservedEntry[] = []
  const expectedByFactor = new Map(expected.map((e) => [e.factor_id, e.std]))
  for (const factor_id of Object.keys(pu as Record<string, unknown>)) {
    const v = (pu as Record<string, unknown>)[factor_id]
    const islStd =
      v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Record<string, unknown>).std === 'number'
        ? ((v as Record<string, unknown>).std as number)
        : null
    const expectedStd = expectedByFactor.get(factor_id) ?? null
    let status: ObservedEntry['status']
    if (islStd === null) {
      status = 'missing'
    } else if (expectedStd === null) {
      status = 'defaulted'
    } else if (Math.abs(islStd - expectedStd) < 1e-9) {
      status = 'pass'
    } else if (islStd > expectedStd) {
      status = 'widened'
    } else {
      // ISL std smaller than user input — narrower; treat as defaulted
      // since the user didn't ask for it.
      status = 'defaulted'
    }
    entries.push({ factor_id, std: islStd, status })
  }
  return { entries, sourcePath: 'payloads.isl_request.parameter_uncertainties' }
}

export function runUserStdPropagation(inputs: ValidatorInputs): ValidatorResult {
  const expected = inferExpectedFromPlotRequest(inputs.plotRequest)
  const observed = compareWithIslRequest(inputs.islRequest, expected)

  if (observed === null) {
    // ISL request not captured — the common case in DGAI today.
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: expected.length ? ['payloads.plot_request.graph.nodes[*].data.observed_state.std'] : [],
      limitations: [
        'ISL request payload is not captured by DGAI (ISL runs inside PLoT). ' +
          'DGAI cannot prove what PLoT forwarded to ISL from canvas/expected values alone — ' +
          'an inferred reconstruction is provided for reviewer comparison but never used as proof.',
      ],
      required_upstream_support: ['plot.debug.isl_request', 'plot.debug.isl_response'],
      details: { expected_from_plot_request: expected },
    })
  }

  const allPass = observed.entries.length > 0 && observed.entries.every((e) => e.status === 'pass')
  const anyWidened = observed.entries.some((e) => e.status === 'widened')
  const status: ValidatorResult['status'] = allPass ? 'pass' : anyWidened ? 'fail' : 'partial'

  return assertHonestyRules({
    status,
    claim_strength: 'derived',
    source_paths: [
      'payloads.isl_request.parameter_uncertainties',
      'payloads.plot_request.graph.nodes[*].data.observed_state.std',
    ],
    limitations: [],
    required_upstream_support: [],
    details: {
      observed: observed.entries,
      expected_from_plot_request: expected,
    },
  })
}

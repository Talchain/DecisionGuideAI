/**
 * responseMapper — UI-SEM-088 constraint honesty gate (seam 2).
 *
 * Pins that while PLOT_CONSTRAINT_NUMBERS_SUSPECT is true the per-option
 * `constraint_analysis` block is omitted from the mapped report, and a positive
 * control that flipping the constant false passes it through verbatim (so the
 * restoration PR is provably safe).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapV2ResponseToReportV1 } from '../responseMapper'
import type { V2RunResponse } from '../types'
import type { ConstraintAnalysis } from '../../../../types/constraints'

const mockTrust = vi.hoisted(() => ({ suspect: true }))
vi.mock('../../constraintTrust', () => ({
  get PLOT_CONSTRAINT_NUMBERS_SUSPECT() {
    return mockTrust.suspect
  },
}))

const CONSTRAINT_ANALYSIS: ConstraintAnalysis = {
  constraints: [
    {
      node_id: 'fac_churn',
      operator: '<=',
      threshold: 0.05,
      label: 'Churn rate',
      prob_satisfied: 0.82,
      failure_margin_median: 0.01,
      near_miss_fraction: 0.1,
      binding: true,
    },
  ],
  joint_probability: 0.74,
}

function makeResponseWithConstraint(): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt1',
        option_label: 'Option 1',
        confidence_interval: [30, 70],
        constraint_analysis: CONSTRAINT_ANALYSIS,
      },
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: { fragile_edges: [], robust_edges: [] },
    response_hash: 'abc123',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'deep', latency_ms: 100 },
  }
}

describe('responseMapper constraint honesty gate — gate ON (default)', () => {
  beforeEach(() => {
    mockTrust.suspect = true
  })

  it('omits per-option constraint_analysis from the mapped report', () => {
    const report = mapV2ResponseToReportV1(makeResponseWithConstraint(), { seed: 42 })
    expect(report.option_probabilities.opt1.constraint_analysis).toBeUndefined()
  })
})

describe('responseMapper constraint honesty gate — POSITIVE CONTROL: gate OFF', () => {
  beforeEach(() => {
    mockTrust.suspect = false
  })

  it('passes per-option constraint_analysis through verbatim when the constant is flipped false', () => {
    const report = mapV2ResponseToReportV1(makeResponseWithConstraint(), { seed: 42 })
    expect(report.option_probabilities.opt1.constraint_analysis).toEqual(CONSTRAINT_ANALYSIS)
  })
})

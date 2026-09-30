/**
 * AIQ 5908802422 + 5908832064, through the results hook: the option label every results surface reads
 * (`recommendation.allOptions[].label`) says the set level beside a stale figure; `labelAsWritten` keeps the user's
 * words. Corpus: Paul's served option_comparison (copied from useResultsSectionData.headroomCapIsNotAUnit.spec.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'

const PAUL_OPTION_COMPARISON = [
  {
    "option_id": "keep_49_price",
    "option_label": "Keep £49 Price",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.12609027656727329,
      "p90": 0.22579069435433868,
      "std": 0.08305644315605763,
      "mean": 0.12196094407146216,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  },
  {
    "option_id": "raise_to_59_at_release",
    "option_label": "Raise to £59 at Release",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.14605325091406948,
      "p90": 0.24922487189724907,
      "std": 0.09157584422267137,
      "mean": 0.1375246580590447,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  },
  {
    "option_id": "raise_to_54_at_release",
    "option_label": "Raise to £54 at Release",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.1360511662591674,
      "p90": 0.23712843812544998,
      "std": 0.08720652859716312,
      "mean": 0.12974280106525346,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  }
]

const BLOCK = {
  type: 'analysis_result',
  summary: 'Comparison',
  leading_option_id: null,
  enrichment: { option_comparison: PAUL_OPTION_COMPARISON },
} as unknown as AnalysisResultBlock

const opt = (id: string, label: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label } })

function seed(goalData: Record<string, unknown>, ready: Record<string, unknown> | null): void {
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV5AnalysisToReport(BLOCK) },
    runMeta: {},
    nodes: [
      { id: 'mrr', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'MRR', ...goalData } },
      ...PAUL_OPTION_COMPARISON.map((o) => opt(o.option_id, o.option_label)),
    ],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    ceeAnalysisReady: ready,
  } as never)
}

const GOAL = { goal_threshold: 0.8, goal_threshold_raw: 20000, goal_threshold_unit: 'GBP MRR', goal_threshold_cap: 25000 }
const READY = { status: 'ready', options: [], goal_node_id: 'mrr', ...GOAL }
import { renderHook } from '@testing-library/react'

const PRICE = { id: 'pro_price', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Pro plan price', unit: '£', observedState: { value: 49, raw_value: 49, unit: '£' } } }

function seedWith(interventions59: Record<string, unknown>, runIsCurrent = true): void {
  seed(GOAL, READY)
  const st = useCanvasStore.getState() as unknown as { nodes: Array<{ id: string; data: Record<string, unknown> }> }
  useCanvasStore.setState({
    nodes: [...st.nodes.map((n) => (n.id === 'raise_to_59_at_release' ? { ...n, data: { ...n.data, interventions: interventions59 } } : n)), PRICE],
    analysisFreshness: { freshness: runIsCurrent ? 'fresh' : 'stale' },
    analysisFreshnessDirty: false,
  } as never)
}

const labels = () => {
  const { result } = renderHook(() => useResultsSectionData())
  return Object.fromEntries((result.current.recommendation?.allOptions ?? []).map((o: { id: string; label: string; labelAsWritten?: string }) => [o.id, [o.label, o.labelAsWritten]]))
}

describe('results option labels say the set level beside a stale figure', () => {
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] } as never) })

  it('RED: a CURRENT Run at £60 — "Raise to £59 at Release" reads "… (set to £60…)"; labelAsWritten is the user\'s words', () => {
    seedWith({ pro_price: { value: 60, source: 'user_specified' } })
    const [label, asWritten] = labels().raise_to_59_at_release
    expect(label).toMatch(/^Raise to £59 at Release \(set to £60/)
    expect(asWritten).toBe('Raise to £59 at Release')
  })

  it('CONTROL: the same option set to £59 keeps its label; an option with no targets keeps its label', () => {
    seedWith({ pro_price: { value: 59, source: 'brief_extraction' } })
    const l = labels()
    expect(l.raise_to_59_at_release[0]).toBe('Raise to £59 at Release')
    expect(l.keep_49_price[0]).toBe('Keep £49 Price')
  })

  it('⛔ AIQ CR 5909180508: edited to £60 and NOT re-run — the result is £59\'s, so the label stays as written (no "(set to £60)")', () => {
    seedWith({ pro_price: { value: 60, source: 'user_specified' } }, false)
    const [label, asWritten] = labels().raise_to_59_at_release
    expect(label).toBe('Raise to £59 at Release')
    expect(asWritten).toBe('Raise to £59 at Release')
  })
})

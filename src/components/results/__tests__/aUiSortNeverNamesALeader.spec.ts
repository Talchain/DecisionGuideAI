/**
 * R7 / X4 — A UI SORT NEVER NAMES A LEADER (DL ruling, #70 5859773247).
 *
 * WHICH option leads is CEE's typed `analysis_result.leading_option_id` and
 * nothing else. `null` is the withheld-turn contract: NO option leads. Before
 * this, `useResultsSectionData` fell back to PLoT's
 * `robustness.recommended_option_id`, then untyped `recommendation.*` reads,
 * then an argmax on win probability / p50 / mean / id — so a turn where CEE
 * withheld the leader still had one named by the UI (374 of 556 served
 * `analysis_result` blocks carry `leading_option_id: null`).
 *
 * Runs the REAL chain on the real staging fixture: `applyV5State` step 5 →
 * `mapV5AnalysisToReport` → store → `useResultsSectionData`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

type Block = Record<string, unknown> & { enrichment: Record<string, unknown> }
type State = ReturnType<typeof useCanvasStore.getState>

const OPTION_IDS = ['opt_hire_local', 'opt_offshore', 'opt_status_quo', 'opt_tiered_pricing'] as const
const LABELS: Record<string, string> = {
  opt_hire_local: 'Hire Two Senior Engineers Locally',
  opt_offshore: 'Engage Offshore Partner',
  opt_status_quo: 'Maintain Current Team (Status Quo)',
  opt_tiered_pricing: 'Introduce Tiered Pricing for Gradual Hiring',
}

beforeEach(() => {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as unknown as State['results'],
    runMeta: {} as State['runMeta'],
    nodes: OPTION_IDS.map((id) => ({
      id,
      type: 'option',
      position: { x: 0, y: 0 },
      data: { kind: 'option', label: LABELS[id] },
    })) as unknown as State['nodes'],
    edges: [],
    hasCompletedFirstRun: false,
    currentScenarioFraming: null,
    ceeAnalysisReady: undefined,
  })
})

/** The fixture block, with `over` applied — the real chain from there. */
function recommendationFor(over: (block: Block) => Block) {
  const block = over(structuredClone(realStagingFixture.blocks[0]) as unknown as Block)
  const envelope = {
    response_version: 2,
    assistant_text: 'Analysis complete.',
    blocks: [block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  const captured: Array<{ report: unknown; hash: string }> = []
  const applicatorStore: V5ApplicatorStore = {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    nodes: [],
    edges: [],
    resultsComplete: (params) => {
      captured.push({ report: params.report, hash: params.hash })
    },
    currentResultsHash: null,
  }
  applyV5State(envelope, applicatorStore)
  expect(captured).toHaveLength(1)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, ...captured[0] } as unknown as State['results'],
    hasCompletedFirstRun: true,
  } as Partial<State>)
  return renderHook(() => useResultsSectionData()).result.current.recommendation
}

describe('⛔ which option leads is CEE’s typed leader, and nothing else', () => {
  it('CONTROL: the typed leader is named', () => {
    const rec = recommendationFor((b) => b)
    expect(rec.recommendedOption?.id).toBe('opt_hire_local')
  })

  it('a WITHHELD turn (leading_option_id: null) names no option — even with PLoT still recommending one', () => {
    const rec = recommendationFor((b) => ({
      ...b,
      leading_option_id: null,
      enrichment: {
        ...b.enrichment,
        robustness: {
          ...((b.enrichment.robustness as Record<string, unknown>) ?? {}),
          recommended_option_id: 'opt_hire_local',
        },
      },
    }))
    expect(rec.recommendedOption).toBeNull()
    expect(rec.allOptions.filter((o) => o.isRecommended)).toEqual([])
    // The rows still carry the run's numbers: withholding the NAME is not
    // withholding the results.
    expect(rec.allOptions.find((o) => o.id === 'opt_hire_local')?.winProbability).toBe(0.7193333333333334)
  })

  it('a typed leader that is NOT the highest win probability is still the leader', () => {
    const rec = recommendationFor((b) => ({ ...b, leading_option_id: 'opt_status_quo' }))
    expect(rec.recommendedOption?.id).toBe('opt_status_quo')
  })
})

/**
 * ⭐ AN OPTION THE RUN LEFT OUT IS NOT AN ENGINE MISS (AIQ #75 5924727155, Panel 5924723004, 1 Oct 2026).
 *
 * Served UI `5caa8016`, R3's acceptance draft of Paul's funding brief (guest `dafdc620`): Olumi's own suggestion
 * "Prioritise angel bridge" (`proposed_by: olumi`, intervention 0 → 10 h/week) is absent from `option_comparison`,
 * because CEE's `filterOlumiProposedOptions` leaves an unadopted suggestion out when two of the user's options remain.
 * CEE records no participation fact for it yet, so the UI reads `not_returned`, and Reasoning said "The analysis
 * returned no result for this option": the analysis failed, so a re-run might help. Neither is true. Until CEE types
 * the exclusion, the sentence is cause-neutral (AIQ's words), true of an engine miss and of a deliberate exclusion.
 *
 * The read is the served one through the REAL `mapV5AnalysisToReport` → store → `useResultsSectionData` →
 * `AnalysisNewTabBody`, with the served option edges on the canvas. CLAIM TYPE: jsdom render; no model calls.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import served from './fixtures/served-funding-goal-figures-withheld-dafdc620.json'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import { NOT_ANALYSED_NO_RESULT_COPY, bringIntoComparisonQuestion } from '../../utils/notAnalysedCopy'

const LEFT_OUT = 'prioritise_angel_bridge'
const LEFT_OUT_LABEL = 'Prioritise angel bridge'

function seed() {
  const report = mapV5AnalysisToReport(served.analysis_result as never, {} as never)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    nodes: served.nodes.map((n, i) => ({
      id: n.id, type: n.kind, position: { x: i * 220, y: 0 },
      data: { label: n.label, kind: n.kind, ...('interventions' in n ? { interventions: n.interventions } : {}) },
    })),
    edges: served.option_edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, data: {} })),
    results: { status: 'complete', progress: 100, report },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('⭐ Olumi\'s left-out option is not blamed on the engine', () => {
  it('PRECONDITION: the served read omits the option, which is Olumi\'s, configured, and carries no participation record', () => {
    const compared = (served.analysis_result as { enrichment: { option_comparison: Array<{ id: string }> } }).enrichment.option_comparison.map((o) => o.id)
    expect(compared).not.toContain(LEFT_OUT)
    expect(served.option_edges.some((e) => e.from === LEFT_OUT)).toBe(true)
    expect(JSON.stringify(served.analysis_result)).not.toMatch(/option_participation/)
    const opt = (seed().recommendation.allOptions ?? []).find((o) => o.id === LEFT_OUT)
    expect(opt?.notAnalysedReason).toBe('not_returned')
  })

  it('⭐ the Reasoning row says the cause-neutral truth, never that the analysis returned nothing', () => {
    const data = seed()
    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />)
    const text = document.body.textContent ?? ''
    expect(text).toContain(NOT_ANALYSED_NO_RESULT_COPY)
    expect(text).toContain('This run has no result for this option, so it has no rank and no probability.')
    expect(text).not.toContain('returned no result')
  })

  it('⭐ the ask it sends carries the same ground, not the engine-blame premise', () => {
    const ask = bringIntoComparisonQuestion(LEFT_OUT_LABEL, 'not_returned')
    expect(ask).toBe(`This run has no result for ${LEFT_OUT_LABEL}. What would it take to bring it in?`)
    expect(ask).not.toMatch(/returned no result|left out of the comparison/)
  })
})

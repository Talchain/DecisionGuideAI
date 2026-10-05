/**
 * The option card's reason line for the cut-3 withhold codes (DL e8, #87 6002009604). It sits beside `Compared · share
 * not shown`, and the marker's aria-label carries the reason. Science d5's words; `goal_path_unsized` names the
 * unsized link from the Run's typed `GOAL_FIGURES_PLACEHOLDER_PATH` warning; an unknown code keeps the fallback.
 * Harness: `OptionNode.winSharesFollowLeaderClaim.spec.tsx` (Paul's served Run 4276f3f9, the real card).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { NOT_RANKED_MARKER, WITHHELD_REASON_FALLBACK } from '../../state/winShareGate'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

interface FxNode { id: string; kind: string; label: string }
interface FxEdge { from: string; to: string }
const fx = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json'), 'utf8'),
) as {
  draft: { nodes: FxNode[]; edges: FxEdge[] }
  analysis_ready: { options: Array<Record<string, unknown>> }
  analysis_block: unknown
  analysis_state: { leader_claim: { permitted: boolean; withheld_reason: string } }
}

const report = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as {
  option_probabilities: Record<string, { win_probability?: number }>
}
const nodes = fx.draft.nodes.map(n => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind } }))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }))
const CONVERTIBLE = '10979ab0'
const ceeAnalysisReady = {
  ...fx.analysis_ready,
  options: fx.analysis_ready.options.map((o): Record<string, unknown> => ({ ...o, id: o.id ?? o.option_id })),
}
const seed = (stamp: Record<string, unknown> | null) => {
  useCanvasStore.setState({
    nodes, edges, ceeAnalysisReady, viewMode: 'standard', analysisStateV1: null,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-30T13:29:05.105Z' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'securing-funding-4276f3f9',
    v5AnalysisFact: { scenarioId: 'securing-funding-4276f3f9', analysisHash: 'run-4276', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-4276', report: { ...report, ...(stamp ? { producer_leader_permission: stamp } : {}) } },
  } as never)
}

const renderCard = (id: string) => {
  const n = nodes.find(x => x.id === id)!
  return render(<ReactFlowProvider><OptionNode
    id={n.id} type="option" data={n.data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></ReactFlowProvider>)
}
const slotText = (id: string) => screen.getByTestId(`option-share-slot-${id}`).textContent ?? ''

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})


const UNSIZED_WARNING = {
  code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning',
  node_ids: ['investment_firm_outreach', 'investment_firm_meetings'], option_ids: ['angel_bridge'], message: 'Not shown.',
}
const seedCause = (cause: string, warnings: unknown[]) => {
  seed({ permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: cause })
  const results = useCanvasStore.getState().results as unknown as { report: Record<string, unknown> }
  const base = Array.isArray(results.report.inference_warnings) ? results.report.inference_warnings : []
  useCanvasStore.setState({ results: { ...results, report: { ...results.report, inference_warnings: [...base, ...warnings] } } } as never)
}

describe.each([
  ['⭐ goal_path_unsized', 'goal_path_unsized', [UNSIZED_WARNING],
    'This comparison turns on the link from ‘Investment firm outreach’ to ‘Investment firm meetings’, whose strength nobody has set yet. Set it to see how much it matters.'],
  ['⭐ intake_identity_unverified', 'intake_identity_unverified', [],
    'This comparison depends on which of the model’s options are the ones your brief lists, and that hasn’t been confirmed yet.'],
  ['⭐ intake_options_missing', 'intake_options_missing', [],
    'Your brief lists at least one option that isn’t in the model yet, so this comparison leaves it out. Check the model’s options against your brief.'],
  ['goal_path_unsized without the warning: its unnamed line', 'goal_path_unsized', [], 'This comparison turns on a link whose strength nobody has set yet.'],
  ['CONTROL: an unknown code', 'a_cause_nobody_mapped', [], WITHHELD_REASON_FALLBACK],
] as const)('the card — %s', (_name, cause, warnings, words) => {
  it('no share, and the marker carries this cause\'s words', () => {
    seedCause(cause, [...warnings])
    renderCard(CONVERTIBLE)
    expect(screen.getByTestId(`option-not-ranked-${CONVERTIBLE}`).getAttribute('aria-label')).toBe(`${NOT_RANKED_MARKER}. ${words}`)
    expect(slotText(CONVERTIBLE)).not.toMatch(/\d\s*%/)
  })
})

/**
 * ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM: CURRENT-READ-v1 row 9 @ ebaed3b4 (AIQ #75 5912710392,
 * #77 5912643736 (b); P0 PARTNER 5912723630), replayed on the Run Paul actually saw.
 *
 * DATA: `e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json`. This is his live test of 30 Sep
 * 2026 (debug export 4276f3f9, staging UI 5562c08d), the served `cee_response` of Run 3 of 3.
 * `analysis_state.leader_claim` was `{permitted: false, withheld_reason: 'constraint_verdict_withheld'}`,
 * and every reply said it could not put an option forward. Yet the cards read "Model 80% · Goal only" /
 * 13% / 7% (finding 9, Canvas 5912649236).
 *
 * AIQ's three rows:
 *   1. 4276f3f9 → 0 option percentages on every card, with the reason line shown;
 *   2. CONTROL: a permitted Run still shows its shares;
 *   3. CONTROL: a Run withheld for another reason also hides them, and shows that reason's words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { formatWinProbability } from '../../utils/labelUtils'
import { leaderWithholdCause } from '../../../components/results/analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE, NOT_RANKED_MARKER } from '../../state/winShareGate'

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
const OPTIONS = fx.draft.nodes.filter(n => n.kind === 'option')
const SCORED = OPTIONS.filter(o => typeof report.option_probabilities[o.id]?.win_probability === 'number')
const CONVERTIBLE = '10979ab0'
const ceeAnalysisReady = {
  ...fx.analysis_ready,
  options: fx.analysis_ready.options.map((o): Record<string, unknown> => ({ ...o, id: o.id ?? o.option_id })),
}
const SERVED_STAMP = {
  permitted: fx.analysis_state.leader_claim.permitted,
  withheld_reason: 'leader_claim_withheld',
  producer_cause: fx.analysis_state.leader_claim.withheld_reason,
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

describe('preconditions — the served Run, read through the product mapper', () => {
  it('three options carry a share (Convertible bridge 80%), and the producer withheld the leader', () => {
    expect(SCORED.map(o => o.id).sort()).toEqual(['10979ab0', 'angel_bridge', 'current_outreach'])
    expect(formatWinProbability(report.option_probabilities[CONVERTIBLE].win_probability!)).toBe('80%')
    expect(SERVED_STAMP).toMatchObject({ permitted: false, producer_cause: 'constraint_verdict_withheld' })
  })
})

describe('CURRENT-READ row 9 — a withheld leader withholds every per-option share', () => {
  it.each(SCORED.map(o => [o.label, o.id] as const))(
    '⭐ ROW 1 (Paul\'s 4276f3f9): "%s" shows no share, and `Not ranked` with the exploratory reason instead',
    (_label, id) => {
      seed(SERVED_STAMP)
      renderCard(id)
      expect(slotText(id)).not.toMatch(/\d\s*%/)
      const marker = screen.getByTestId(`option-not-ranked-${id}`)
      expect(marker.textContent).toBe(NOT_RANKED_MARKER)
      expect(marker.getAttribute('aria-label')).toBe(`${NOT_RANKED_MARKER}. ${EXPLORATORY_REASON_LINE}`)
    },
  )

  it('⭐ ROW 2 — CONTROL: a PERMITTED Run still shows its shares (the gate is the permission, not the data)', () => {
    seed({ permitted: true })
    renderCard(CONVERTIBLE)
    expect(slotText(CONVERTIBLE)).toContain('80%')
    expect(screen.queryByTestId(`option-not-ranked-${CONVERTIBLE}`)).toBeNull()
  })

  it('⭐ ROW 3 — CONTROL: a Run withheld for ANOTHER reason also hides the share, in that reason\'s own words', () => {
    const other = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable' }
    seed(other)
    renderCard(CONVERTIBLE)
    expect(slotText(CONVERTIBLE)).not.toMatch(/\d\s*%/)
    const words = leaderWithholdCause('separation_unavailable')
    expect(words).not.toBeNull()
    expect(screen.getByTestId(`option-not-ranked-${CONVERTIBLE}`).getAttribute('aria-label')).toBe(`${NOT_RANKED_MARKER}. ${words}`)
  })

  it('an option the Run left out (Targeted angel pilot) keeps `Not analysed`, never `Not ranked`', () => {
    seed(SERVED_STAMP)
    renderCard('targeted_angel_pilot')
    expect(screen.queryByTestId('option-not-ranked-targeted_angel_pilot')).toBeNull()
    expect(slotText('targeted_angel_pilot')).not.toMatch(/\d\s*%/)
  })
})

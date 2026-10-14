import { CHANCE_NOT_SHOWN_YET } from '@/canvas/runView/runView'
import { optionChanceFixture } from '../../../tests/helpers/optionChanceFixture'
/**
 * ⭐⭐ CURRENT-READ-v1 row 9 on the NON-CARD surfaces (AIQ #75 5912710392; the render-site survey at
 * 4000b22dc): the inspector's Decision, Outcome and Option panels, the risk editor's per-option rows, the
 * chat's comparison table. Each shows NO per-option win share when the producer
 * withheld the leader, and says why instead (`winShareGate.ts`).
 *
 * Replayed on Paul's served Run (`e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json`, debug export
 * 4276f3f9: leader withheld, `constraint_verdict_withheld`; Convertible bridge 80%, Angel bridge 13%,
 * Current outreach 7%). AIQ's three rows on each surface: withheld → 0 percentages + the reason; CONTROL
 * permitted → the shares; CONTROL another cause → hidden, in that cause's words.
 * WS5-1 #2704 replaces the far-zoom card's share with the independent Results chance cell.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useCanvasStore } from '../store'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { DecisionPanel } from '../ui/inspector-v2/panels/DecisionPanel'
import { OutcomePanel } from '../ui/inspector-v2/panels/OutcomePanel'
import { V5ComparisonBlock } from '../../v5/blocks/V5ComparisonBlock'
import { resolveLodMetricLineDetail } from '../nodes/shared/lodMetricLine'
import { selectWinShareWithheldReason, selectWinSharesWithheld } from '../state/winShareGate'

const fx = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/securing-funding-4276f3f9.fixture.json'), 'utf8'),
) as { draft: { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from: string; to: string }> }; analysis_block: unknown }

const report = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as Record<string, unknown>
const nodes = fx.draft.nodes.map(n => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind } }))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, data: {} }))

const WITHHELD = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' }
const OTHER = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable' }
const PERMITTED = { permitted: true }

const seed = (stamp: Record<string, unknown>) => {
  useCanvasStore.setState({
    nodes, edges,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    results: { status: 'complete', hash: 'run-4276', report: { ...report, producer_leader_permission: stamp } },
  } as never)
}
const PCT = /\d\s*%/

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: { status: 'idle', report: null }, analysisFreshness: null } as never)
})

describe('precondition — the served Run carries the shares the surfaces must withhold', () => {
  it('option_comparison has 80% / 13% / 7%', () => {
    const shares = (report.option_comparison as Array<{ win_probability?: number }>).map(o => Math.round((o.win_probability ?? -1) * 100)).sort((a, b) => b - a)
    expect(shares).toEqual([80, 13, 7])
  })
})

describe.each([
  ['DecisionPanel', () => render(<DecisionPanel nodeId="decision_securing_funding" techMode={false} onClose={() => {}} onNavigate={() => {}} />), 'decision-panel-not-ranked'],
  ['OutcomePanel', () => render(<OutcomePanel nodeId="investment_firm_meetings" techMode={false} onClose={() => {}} onNavigate={() => {}} />), 'outcome-panel-not-ranked'],
] as const)('%s — row 9', (_name, mount, reasonTestId) => {
  // #2747 re-scope 2 (DL ruling (A)): the panel's not-ranked reason line (`decision-panel-not-ranked` /
  // `outcome-panel-not-ranked`) is removed in C, so its words are no longer asserted; the labels and no-percentage
  // negatives stay.
  it('⭐ ROW 1: Paul\'s withheld Run → no option percentage', () => {
    seed(WITHHELD)
    const { container } = mount()
    for (const label of ['Convertible bridge from existing supporters', 'Angel bridge', 'Current outreach']) {
      expect(container.textContent).toContain(label)
    }
    expect(container.textContent).not.toMatch(PCT)
  })
  // #2747 re-scope 2 (DL ruling (A)): "a permitted Run shows the shares (80%)" is deleted — no win share is shown in C.
  // The no-reason-line negative stays (its test id is removed from source in C).
  it('ROW 2 — CONTROL: a permitted Run says no withheld reason', () => {
    seed(PERMITTED)
    const { queryByTestId } = mount()
    expect(queryByTestId(reasonTestId)).toBeNull()
  })
  // #2747 re-scope 2 (DL ruling (A)): the cause's own words on the removed reason line are no longer asserted.
  it('ROW 3 — CONTROL: another cause → no option percentage either', () => {
    seed(OTHER)
    const { container } = mount()
    expect(container.textContent).not.toMatch(PCT)
  })
})

describe('V5ComparisonBlock (chat) — row 9', () => {
  const block = {
    type: 'comparison',
    narrative: '',
    options: [
      { option_id: '10979ab0', label: 'Convertible bridge from existing supporters', win_probability: 0.7966 },
      { option_id: 'angel_bridge', label: 'Angel bridge', win_probability: 0.132 },
    ],
  }
  // #2747 re-scope 2 (DL ruling (A)): the block's withheld-share note (`v5-comparison-not-ranked`) is removed in C, so its
  // words are no longer asserted; the no-percentage negatives stay.
  it('⭐ ROW 1: withheld → no share column', () => {
    seed(WITHHELD)
    const { container } = render(<V5ComparisonBlock block={block as never} />)
    expect(container.textContent).not.toMatch(PCT)
  })
  // #2747 re-scope 2 (DL ruling (A)): row deleted — "ROW 2 — CONTROL: permitted → the shares": its only subject, the
  // share column on a permitted Run, is removed in C (no win share anywhere).
  it('ROW 3 — CONTROL: another cause → hidden', () => {
    seed(OTHER)
    const { container } = render(<V5ComparisonBlock block={block as never} />)
    expect(container.textContent).not.toMatch(PCT)
  })
})

describe('far-zoom card line — row 9', () => {
  const chance = optionChanceFixture({ bridge: 41, angel: 29 })('bridge')
  const line = (winSharesWithheld: boolean, optionChanceCell = chance) =>
    resolveLodMetricLineDetail({
      nodeType: 'option',
      data: { label: 'Convertible bridge', kind: 'option' },
      label: 'Convertible bridge',
      displayMetadata: { isResultsMode: true, winRate: 0.7966 } as never,
      facts: { optionResultCaption: 'Current model', winSharesWithheld, optionChanceCell, optionInterventionCount: 2 },
    }).text
  it('⭐ share withheld → the independent Results chance cell, never the share', () => {
    expect(line(true)).toBe(`Current model · ${chance.text}`)
    expect(line(true)).toBe(`Current model · ${CHANCE_NOT_SHOWN_YET}`)
    expect(line(true)).not.toMatch(/\d+%/)
    expect(line(true)).not.toContain('Why?')
    expect(line(true)).not.toContain('of runs')
    expect(line(true)).not.toContain('80%')
  })
  it('view-bearing control: row 9 preserves the caption and server figure when shares are withheld', () => {
    const cell = optionChanceFixture({ bridge: 41, angel: 29 }, true)('bridge')
    expect(cell.kind).toBe('figure')
    expect(line(true, cell)).toBe(`Current model · ${cell.text}`)
    expect(line(true, cell)).toContain('41%')
    expect(line(true, cell)).not.toContain('80%')
    expect(line(true, cell)).not.toContain('of runs')
  })
  it('CONTROL: share permitted → the same chance cell, still never the share', () => {
    expect(line(false)).toBe(`Current model · ${chance.text}`)
    expect(line(false)).not.toContain('of runs')
    expect(line(false)).not.toContain('80%')
  })
  it('CONTROL: no Results chance cell → own settings, despite the run share', () => {
    expect(line(false, optionChanceFixture({})('bridge'))).toBe('Changes 2 factors')
  })
})

describe('the gate is null-safe — `results: null` is a real store state', () => {
  it('reads as not withheld, with no reason, and never throws', () => {
    expect(selectWinSharesWithheld({ results: null })).toBe(false)
    expect(selectWinShareWithheldReason({ results: null })).toBeNull()
  })
})

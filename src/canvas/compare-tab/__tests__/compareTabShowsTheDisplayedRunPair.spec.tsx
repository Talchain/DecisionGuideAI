/**
 * SC-24 v3 — the Compare tab is previous Run vs this Run, and it DECIDES NOTHING (ChatGPT #75 5917800777; DL lease
 * #75 5917856638).
 *
 * Rows:
 *   C1  the Compare body shows the comparison CEE produced for the analysis on screen: the exact input change, in the
 *       canvas's own labels, through the SAME section the Reasoning tab used.
 *   C2  no comparison that describes the analysis on screen → the empty state, never a stale or foreign pair
 *       (no delta · a superseded analysis · another scenario).
 *   C3  ONE READER: for every store state, the Compare body shows a comparison exactly when the shared reader
 *       (`displayedRunDeltaView`, which the Reasoning view model also calls) returns one.
 *   R1  the Reasoning receipt names the earlier Run and opens the Compare tab; it makes no claim about the result.
 *   I1  (UNDO grant #75 5920635710) each input row carries the producer's ids VERBATIM; its React key is unchanged.
 *   G1  (CANVAS, row E) the pair on screen marks the canvas, and a row focuses the element its ids name; a row whose
 *       element is not drawn says so and focuses nothing; leaving the tab clears the marks.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { RunDeltaSchema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { CompareRunPairBody, COMPARE_RUN_PAIR_TESTID } from '../CompareRunPairBody'
import { WHATS_CHANGED_TESTID } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { WhatsChangedReceipt, WHATS_CHANGED_RECEIPT_TESTID } from '../../../components/results/analysisNew/sections/WhatsChangedReceipt'
import { displayedRunDeltaView, nodeLabelMap } from '../../../components/results/analysisNew/displayedRunDeltaView'
import { focusNodeById } from '../../utils/focusHelpers'

vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const DELTA = {
  attribution_case: 'C5_unattributed',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'unknown', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [{ option_id: 'opt_60', prior: 0.41, current: 0.44, noise_verdict: 'not_noise_qualified' }],
  flip_thresholds: [],
  endpoints: { prior: { run_id: 'run-a', computed_at: '2026-09-30T13:02:00.000Z' }, current: { run_id: 'run-b', computed_at: '2026-09-30T13:09:00.000Z' } },
  input_coverage: 'complete',
  input_changes: [{
    entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
    label_before: 'Pro price', label_after: 'Pro price', before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed',
  }],
} as const

const NODES = [
  { id: 'opt_60', data: { label: 'Raise to £60' } },
  { id: 'fac_price', data: { label: 'Pro price' } },
]

function seed(over: Partial<{ runDelta: unknown; currentScenarioId: string | null }> = {}): void {
  useCanvasStore.setState({
    runDelta: { delta: DELTA as unknown as RunDelta, analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    nodes: NODES,
    ...over,
  } as never)
}

beforeEach(() => {
  // The fixture is the CONTRACT's shape, not a hand-made one: it must parse.
  expect(RunDeltaSchema.safeParse(DELTA).success).toBe(true)
  seed()
})
afterEach(cleanup)

describe('C1 · the Compare body shows the displayed Run pair', () => {
  it('renders the section with the exact input change, in the canvas\'s labels', () => {
    render(<CompareRunPairBody responseHash="hash-A" />)
    expect(screen.getByTestId(COMPARE_RUN_PAIR_TESTID)).toBeInTheDocument()
    expect(screen.getByTestId(WHATS_CHANGED_TESTID)).toBeInTheDocument()
    expect(screen.getAllByTestId(`${WHATS_CHANGED_TESTID}-input-row`).map((r) => r.textContent)).toEqual(['Pro price, Raise to £60: £59 → £60'])
    expect(screen.queryByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)).toBeNull()
  })
})

describe('C2 · no comparison that describes the analysis on screen → the empty state', () => {
  const cases: Array<[string, () => void, string]> = [
    ['no delta', () => seed({ runDelta: null }), 'hash-A'],
    ['a superseded analysis', () => seed(), 'hash-B'],
    ['another scenario', () => seed({ currentScenarioId: 'scn-2' }), 'hash-A'],
  ]
  for (const [name, arrange, hash] of cases) {
    it(`${name}: says there is no comparison yet, and shows no section`, () => {
      arrange()
      render(<CompareRunPairBody responseHash={hash} />)
      expect(screen.getByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)).toHaveTextContent('No comparison yet')
      expect(screen.queryByTestId(WHATS_CHANGED_TESTID)).toBeNull()
    })
  }
})

describe('C3 · one reader: the Compare body and the shared reader cannot disagree', () => {
  const states: Array<[string, Partial<{ runDelta: unknown; currentScenarioId: string | null }>, string]> = [
    ['current', {}, 'hash-A'],
    ['no delta', { runDelta: null }, 'hash-A'],
    ['superseded', {}, 'hash-B'],
    ['other scenario', { currentScenarioId: 'scn-2' }, 'hash-A'],
  ]
  for (const [name, over, hash] of states) {
    it(`${name}: body shows a comparison iff displayedRunDeltaView returns one`, () => {
      seed(over)
      const s = useCanvasStore.getState() as unknown as { runDelta: never; currentScenarioId: string | null; nodes: typeof NODES }
      const expected = displayedRunDeltaView(s.runDelta, hash, s.currentScenarioId, nodeLabelMap(s.nodes)) !== null
      render(<CompareRunPairBody responseHash={hash} />)
      expect(screen.queryByTestId(WHATS_CHANGED_TESTID) !== null).toBe(expected)
    })
  }
})

describe('R1 · the Reasoning receipt names the earlier Run and opens Compare — and claims nothing', () => {
  const view = () => {
    const s = useCanvasStore.getState() as unknown as { runDelta: never; currentScenarioId: string | null; nodes: typeof NODES }
    return displayedRunDeltaView(s.runDelta, 'hash-A', s.currentScenarioId, nodeLabelMap(s.nodes))
  }

  it('names the earlier Run by its own time, and "View comparison" opens the Compare tab', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<WhatsChangedReceipt view={view()} />)
    expect(screen.getByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-compared-with`).textContent).toMatch(/^Compared with the earlier run at \d{1,2}:\d{2}\.$/)
    fireEvent.click(screen.getByTestId(`${WHATS_CHANGED_RECEIPT_TESTID}-open`))
    expect(spy).toHaveBeenCalledWith('compare')
    spy.mockRestore()
  })

  it('carries no result figure, input row or leader claim — those are the Compare tab\'s', () => {
    render(<WhatsChangedReceipt view={view()} />)
    const text = screen.getByTestId(WHATS_CHANGED_RECEIPT_TESTID).textContent ?? ''
    expect(text).not.toMatch(/%|£|→|highest|leader|ranked/i)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-input-row`)).toBeNull()
  })

  it('renders nothing when there is no comparison', () => {
    const { container } = render(<WhatsChangedReceipt view={null} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('I1 · the row carries the producer\'s identity, verbatim', () => {
  it('entityId / optionId are the wire\'s own ids; the React key keeps its old form', () => {
    const s = useCanvasStore.getState() as unknown as { runDelta: never; currentScenarioId: string | null; nodes: typeof NODES }
    const row = displayedRunDeltaView(s.runDelta, 'hash-A', s.currentScenarioId, nodeLabelMap(s.nodes))!.inputs!.rows[0]
    expect(row.entityId).toBe('fac_price')
    expect(row.optionId).toBe('opt_60')
    expect(row.linkEnds).toBeNull()
    expect(row.key).toBe('option_setting:fac_price:opt_60:value:0')
  })
})

describe('G1 · the pair on screen marks the canvas; a row focuses its element', () => {
  it('marks the option whose setting changed, and the row focuses it', () => {
    render(<CompareRunPairBody responseHash="hash-A" />)
    const hl = useCanvasStore.getState().analysisHighlight
    expect(hl.source).toBe('run_changes')
    expect(hl.nodeMarks?.get('opt_60')).toBe('changed')
    expect([...hl.nodeIds]).toEqual(['opt_60'])
    fireEvent.click(screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row-focus`))
    expect(vi.mocked(focusNodeById)).toHaveBeenCalledWith('opt_60')
  })

  it('a row whose element is not drawn says so, and offers no focus', () => {
    seed({ nodes: [{ id: 'fac_price', data: { label: 'Pro price' } }] } as never)
    render(<CompareRunPairBody responseHash="hash-A" />)
    expect(screen.queryByTestId(`${WHATS_CHANGED_TESTID}-input-row-focus`)).toBeNull()
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-input-row-off-canvas`)).toHaveTextContent('not on the canvas now')
    expect(useCanvasStore.getState().analysisHighlight.source).not.toBe('run_changes')
  })

  it('leaving the tab (unmount) clears the marks', () => {
    const { unmount } = render(<CompareRunPairBody responseHash="hash-A" />)
    expect(useCanvasStore.getState().analysisHighlight.source).toBe('run_changes')
    unmount()
    expect(useCanvasStore.getState().analysisHighlight.source).toBeNull()
  })

  it('no comparison marks nothing', () => {
    seed({ runDelta: null })
    render(<CompareRunPairBody responseHash="hash-A" />)
    expect(useCanvasStore.getState().analysisHighlight.source).not.toBe('run_changes')
  })
})

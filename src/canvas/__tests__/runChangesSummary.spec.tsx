/**
 * M2 — THE RERUN'S CONSEQUENCE ON THE CANVAS (PTL #85 5933452605 / 5933474575; lease CANVAS 5933472900).
 *
 * Rows (each bound by identity: the one reader's own view, the share gate's own reason, the claimant's own test id):
 *   M2-1  what changed: the producer's input rows in the Compare section's words; at most two, then "+N more".
 *   M2-2  what moved: ONLY options beyond noise (`signal`), in `movementText`'s words; a within-noise pair says the ONE
 *         noise sentence and names no option.
 *   M2-3  withheld shares outrank everything: the share gate's reason, no option named, even when the producer
 *         reports a signal movement.
 *   M2-4  why + still uncertain: the producer's comparability sentence and attribution limit, verbatim. C1 has no
 *         limit (no "Still uncertain" line); C2 has one.
 *   M2-5  the card shows only for the analysis on screen (a superseded hash or no delta → nothing), closes for that
 *         analysis, and a changed input row focuses the node its ids name.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { RunDeltaSchema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../store'
import { RunChangesSummary, RUN_CHANGES_SUMMARY_TESTID } from '../components/RunChangesSummary'
import { RUN_CHANGES_SUMMARY_COPY, runChangesSummaryLines } from '../graphChanges/runChangesSummaryLines'
import { displayedRunDeltaView, nodeLabelMap } from '../../components/results/analysisNew/displayedRunDeltaView'
import { noiseQualifier, WHATS_CHANGED_NO_PAIRS, INPUTS_UNCHANGED_TEXT, INPUTS_PARTIAL_TEXT, INPUTS_NOT_RECORDED_TEXT } from '../../components/results/analysisNew/sections/WhatsChanged'
import { winShareWithheldReason, WITHHELD_REASON_FALLBACK } from '../state/winShareGate'
import { focusNodeById } from '../utils/focusHelpers'

vi.mock('../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const T = RUN_CHANGES_SUMMARY_TESTID

function change(id: string, label: string, before: number, after: number) {
  return {
    entity_kind: 'factor_value', entity_id: id, field: 'value',
    label_before: label, label_after: label, before: { raw: before, unit: '%' }, after: { raw: after, unit: '%' }, change: 'changed',
  }
}

function delta(over: Record<string, unknown> = {}): RunDelta {
  const d = {
    attribution_case: 'C2_unpaired',
    pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'unknown', n_equal: true },
    leader: { changed: false, noise_verdict: 'not_noise_qualified' },
    win_probabilities: [
      { option_id: 'opt_a', prior: 0.41, current: 0.43, noise_verdict: 'within_noise' },
      { option_id: 'opt_b', prior: 0.59, current: 0.57, noise_verdict: 'within_noise' },
    ],
    flip_thresholds: [],
    endpoints: { prior: { run_id: 'run-a', computed_at: '2026-10-01T13:02:00.000Z' }, current: { run_id: 'run-b', computed_at: '2026-10-01T13:09:00.000Z' } },
    input_coverage: 'complete',
    input_changes: [change('fac_churn', 'Monthly churn', 7, 12)],
    ...over,
  }
  for (const k of Object.keys(d)) if ((d as Record<string, unknown>)[k] === undefined) delete (d as Record<string, unknown>)[k]
  // The fixture is the CONTRACT's shape, not a hand-made one: it must parse.
  const parsed = RunDeltaSchema.safeParse(d)
  expect(parsed.success, JSON.stringify(parsed.error?.issues ?? null)).toBe(true)
  return d as unknown as RunDelta
}

const NODES = [
  { id: 'opt_a', type: 'option', data: { label: 'Keep pricing' } },
  { id: 'opt_b', type: 'option', data: { label: 'Raise price' } },
  { id: 'fac_churn', type: 'factor', data: { label: 'Monthly churn' } },
  { id: 'fac_price', type: 'factor', data: { label: 'Price' } },
  { id: 'fac_cac', type: 'factor', data: { label: 'Acquisition cost' } },
]

function seed(d: RunDelta | null, opts: { hash?: string; report?: Record<string, unknown> } = {}): void {
  useCanvasStore.setState({
    runDelta: d === null ? null : { delta: d, analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    nodes: NODES,
    edges: [],
    results: { status: 'complete', hash: opts.hash ?? 'hash-A', report: opts.report ?? {} },
  } as never)
}

/** The one reader's view for the seeded store — what the Compare tab reads. */
function readerView() {
  const s = useCanvasStore.getState()
  const v = displayedRunDeltaView(s.runDelta, 'hash-A', 'scn-1', nodeLabelMap(s.nodes))
  expect(v, 'the reader must hold a view for the seeded pair, or every row below is vacuous').not.toBeNull()
  return v!
}

beforeEach(() => {
  vi.mocked(focusNodeById).mockClear()
})
afterEach(cleanup)

describe('M2-1 · what changed', () => {
  it('says the first two input rows in the Compare section\'s words, then counts the rest', () => {
    seed(delta({ input_changes: [change('fac_churn', 'Monthly churn', 7, 12), change('fac_price', 'Price', 10, 15), change('fac_cac', 'Acquisition cost', 3, 4)] }))
    const lines = runChangesSummaryLines(readerView(), false, null)
    expect(lines.changed.map((c) => c.text)).toEqual(['Monthly churn: 7% → 12%', 'Price: 10% → 15%'])
    expect(lines.changed.map((c) => c.row.entityId)).toEqual(['fac_churn', 'fac_price'])
    expect(lines.changedMore).toBe(1)
  })
})

describe('M2-1b · no input rows: Compare\'s sentence for the coverage, never a second phrasing (R3 5936613334)', () => {
  // An Accept (placeholder → accepted estimate) is a provenance change: C1, coverage complete, no input row. The card
  // said "The inputs were not recorded for this pair" — false, they were recorded. One sentence per coverage, from
  // WhatsChanged's own `emptyInputsText`.
  const cases: Array<[string, Record<string, unknown>, string | null]> = [
    ['complete + no rows', { input_coverage: 'complete', input_changes: [] }, INPUTS_UNCHANGED_TEXT],
    ['partial + no rows', { input_coverage: 'partial', input_changes: [] }, INPUTS_PARTIAL_TEXT],
    ['not_recorded (no list travels)', { input_coverage: 'not_recorded', input_changes: undefined }, INPUTS_NOT_RECORDED_TEXT],
  ]
  for (const [name, over, text] of cases) {
    it(`${name} → "${text}"`, () => {
      seed(delta(over))
      const lines = runChangesSummaryLines(readerView(), false, null)
      expect(lines.changed).toEqual([])
      expect(lines.changedNote).toBe(text)
      render(<RunChangesSummary />)
      // No rows → both notes are standalone clauses, without an input-change or movement label.
      expect(screen.getByTestId(`${T}-line`).textContent).toBe(`${text} · ${noiseQualifier('within_noise')}`)
      expect(screen.getByTestId(`${T}-line`).textContent).not.toContain(RUN_CHANGES_SUMMARY_COPY.changed)
      cleanup()
    })
  }
  it('no input comparison at all (a pre-SC-24 delta) → only the movement note, without a label', () => {
    const d = delta() as unknown as Record<string, unknown>
    delete d.input_coverage
    delete d.input_changes
    seed(d as never)
    expect(readerView().inputs).toBeNull()
    render(<RunChangesSummary />)
    expect(screen.getByTestId(`${T}-line`).textContent).toBe(noiseQualifier('within_noise'))
  })
})

describe('Q10 · labels belong to rows; notes are standalone clauses', () => {
  beforeEach(() => {
    // Force the existing truncation path so the same row/note rule is checked in the detail too.
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  })

  const cases = [
    {
      name: "Paul's two added links + withheld option",
      over: { input_changes: [
        { entity_kind: 'link', entity_id: 'price_slips', field: 'presence', link: { from: 'pro_price', to: 'release_slips' }, before: null, after: { raw: true }, change: 'added' },
        { entity_kind: 'link', entity_id: 'slips_mrr', field: 'presence', link: { from: 'release_slips', to: 'mrr' }, before: null, after: { raw: true }, change: 'added' },
      ] },
      withheld: true,
      changed: [
        'Link from Pro plan price to Feature release slips added to the model',
        'Link from Feature release slips to MRR added to the model',
      ],
      moved: [],
      note: WITHHELD_REASON_FALLBACK,
      text: "Changed: Link from Pro plan price to Feature release slips added to the model · +1 more · Olumi isn't naming an option on this run.",
    },
    {
      name: 'a real moved row',
      over: {},
      withheld: false,
      changed: ['Monthly churn: 7% → 12%'],
      moved: ['Keep pricing: 41% → 55%'],
      note: null,
      text: 'Changed: Monthly churn: 7% → 12% · Moved: Keep pricing: 41% → 55%',
    },
    {
      name: 'only a note, no input comparison',
      over: { input_changes: undefined, input_coverage: undefined },
      withheld: true,
      changed: [],
      moved: [],
      note: WITHHELD_REASON_FALLBACK,
      text: "Olumi isn't naming an option on this run.",
    },
  ]

  for (const row of cases) {
    it(row.name, () => {
      seed(delta({
        win_probabilities: [{ option_id: 'opt_a', prior: 0.41, current: 0.55, noise_verdict: 'signal' }],
        ...row.over,
      }), { report: row.withheld ? { producer_leader_permission: { permitted: false } } : {} })
      useCanvasStore.setState({ nodes: [
        ...NODES,
        { id: 'pro_price', type: 'factor', data: { label: 'Pro plan price' } },
        { id: 'release_slips', type: 'risk', data: { label: 'Feature release slips' } },
        { id: 'mrr', type: 'goal', data: { label: 'MRR' } },
      ] } as never)
      const lines = runChangesSummaryLines(readerView(), row.withheld, row.withheld ? winShareWithheldReason({ permitted: false }) : null)
      expect(lines.changed.map((c) => c.text)).toEqual(row.changed)
      expect(lines.moved).toEqual(row.moved)
      expect(lines.movedNote).toBe(row.note)
      if (row.changed.length === 0) expect(lines.changedNote).toBeNull()

      render(<RunChangesSummary />)
      expect(screen.getByRole('status').textContent).toBe(`Since the last run · ${row.text} Why?`)
      const pill = screen.getByTestId(`${T}-line`)
      expect(pill.textContent).toBe(row.text)
      expect(pill.getAttribute('title')).toBe(row.text)
      if (row.note !== null) expect(screen.getByTestId(T).textContent).not.toContain('Moved')
      fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
      const moved = screen.getByTestId(`${T}-moved`)
      expect(moved.textContent).toBe(row.note ?? `Moved: ${row.moved[0]}`)
      expect(moved.querySelector('dt')?.textContent ?? null).toBe(row.note === null ? 'Moved: ' : null)
      if (row.note !== null) expect(screen.getByTestId(T).textContent).not.toContain('Moved')
      if (row.changed.length > 0) expect(screen.getByTestId(`${T}-changed`).querySelector('dt')?.textContent).toBe('Changed: ')
      else expect(screen.queryByTestId(`${T}-changed`)).toBeNull()
    })
  }

  it('an input note also has no row label in the pill, tooltip, or detail', () => {
    seed(delta({ input_changes: [] }))
    const lines = runChangesSummaryLines(readerView(), false, null)
    expect(lines.changed).toEqual([])
    expect(lines.changedNote).toBe(INPUTS_UNCHANGED_TEXT)
    render(<RunChangesSummary />)
    const text = `${INPUTS_UNCHANGED_TEXT} · ${noiseQualifier('within_noise')}`
    expect(screen.getByTestId(`${T}-line`).textContent).toBe(text)
    expect(screen.getByTestId(`${T}-line`).getAttribute('title')).toBe(text)
    fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
    expect(screen.getByTestId(`${T}-changed`).textContent).toBe(INPUTS_UNCHANGED_TEXT)
    expect(screen.getByTestId(`${T}-changed`).querySelector('dt')).toBeNull()
    expect(screen.getByTestId(`${T}-moved`).textContent).toBe(noiseQualifier('within_noise'))
    expect(screen.getByTestId(`${T}-moved`).querySelector('dt')).toBeNull()
  })
})

describe('M2-2 · what moved: beyond noise only', () => {
  it('within noise → the ONE noise sentence, no option named', () => {
    seed(delta())
    const lines = runChangesSummaryLines(readerView(), false, null)
    expect(lines.moved).toEqual([])
    expect(lines.movedNote).toBe(noiseQualifier('within_noise'))
  })
  it('a signal movement → that option in movementText\'s words; the within-noise one is not named', () => {
    seed(delta({ win_probabilities: [
      { option_id: 'opt_a', prior: 0.41, current: 0.55, noise_verdict: 'signal' },
      { option_id: 'opt_b', prior: 0.59, current: 0.57, noise_verdict: 'within_noise' },
    ] }))
    const lines = runChangesSummaryLines(readerView(), false, null)
    expect(lines.moved).toEqual(['Keep pricing: 41% → 55%'])
    expect(lines.movedNote).toBeNull()
  })
})

describe('M2-2b · no comparable pair: a sentence true under every cause, never "nothing to compare" (R3 5936720411)', () => {
  it('an empty win_probabilities says the shared no-pairs sentence, which claims no cause and no stillness', () => {
    seed(delta({ win_probabilities: [] }))
    const lines = runChangesSummaryLines(readerView(), false, null)
    expect(lines.moved).toEqual([])
    expect(lines.movedNote).toBe(WHATS_CHANGED_NO_PAIRS)
    expect(WHATS_CHANGED_NO_PAIRS).toBe('No option has figures from both runs to compare.')
    expect(WHATS_CHANGED_NO_PAIRS).not.toMatch(/nothing to compare|could be matched/i)
  })
})

describe('M2-3 · withheld shares outrank a signal', () => {
  it('says the share gate\'s reason and names no option', () => {
    seed(delta({ win_probabilities: [{ option_id: 'opt_a', prior: 0.41, current: 0.55, noise_verdict: 'signal' }] }))
    const reason = winShareWithheldReason({ permitted: false } as never)
    const lines = runChangesSummaryLines(readerView(), true, reason)
    expect(lines.moved).toEqual([])
    expect(lines.movedNote).toBe(reason)
  })
  it('renders: the card carries the reason, and neither the option nor its share', () => {
    seed(delta({ win_probabilities: [{ option_id: 'opt_a', prior: 0.41, current: 0.55, noise_verdict: 'signal' }] }), {
      report: { producer_leader_permission: { permitted: false } },
    })
    render(<RunChangesSummary />)
    const card = screen.getByTestId(T)
    expect(card.textContent).toContain(winShareWithheldReason({ permitted: false } as never))
    expect(card.textContent).not.toContain('Keep pricing')
    expect(card.textContent).not.toContain('55%')
  })
})

describe('M2-4 · why and still uncertain, verbatim', () => {
  it('C2: the comparability sentence and its attribution limit', () => {
    seed(delta())
    const view = readerView()
    expect(view.attributionLimit).not.toBeNull()
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
    expect(screen.getByTestId(`${T}-why`).querySelector('dd')?.textContent).toBe(view.comparability)
    expect(screen.getByTestId(`${T}-uncertain`).querySelector('dd')?.textContent).toBe(view.attributionLimit)
    expect(screen.getByTestId(T).getAttribute('data-attributable')).toBe('false')
  })
  it('C1: the comparability sentence, and no "Still uncertain" line', () => {
    seed(delta({ attribution_case: 'C1_attributable', pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true } }))
    const view = readerView()
    expect(view.attributable).toBe(true)
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
    expect(screen.getByTestId(`${T}-why`).querySelector('dd')?.textContent).toBe(view.comparability)
    expect(screen.queryByTestId(`${T}-uncertain`)).toBeNull()
    expect(screen.getByTestId(T).getAttribute('data-attributable')).toBe('true')
  })
})

describe('M2-5 · only for the analysis on screen; closes; focuses', () => {
  it('the pill says what changed and what moved for the displayed pair', () => {
    seed(delta())
    render(<RunChangesSummary />)
    expect(screen.getByTestId(T).getAttribute('data-response-hash')).toBe('hash-A')
    const line = screen.getByTestId(`${T}-line`).textContent
    expect(line).toBe(`${RUN_CHANGES_SUMMARY_COPY.changed}: Monthly churn: 7% → 12% · ${noiseQualifier('within_noise')}`)
  })
  const absent: Array<[string, () => void]> = [
    ['no delta', () => seed(null)],
    ['a superseded analysis', () => seed(delta(), { hash: 'hash-B' })],
  ]
  for (const [name, arrange] of absent) {
    it(`${name}: no card`, () => {
      arrange()
      render(<RunChangesSummary />)
      expect(screen.queryByTestId(T)).toBeNull()
    })
  }
  it('close hides it for this analysis', () => {
    seed(delta())
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${T}-close`))
    expect(screen.queryByTestId(T)).toBeNull()
  })
  it('the open detail does not repeat the pill (R3 5935751708: it covered the Goal) — unless the pill holds more', () => {
    seed(delta())
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
    expect(screen.getByTestId(`${T}-why`)).toBeTruthy()
    expect(screen.queryByTestId(`${T}-changed`)).toBeNull()
    expect(screen.queryByTestId(`${T}-moved`)).toBeNull()
    cleanup()
    // CONTROL: three changed inputs are more than the pill's one line holds, so the detail lists them.
    seed(delta({ input_changes: [change('fac_churn', 'Monthly churn', 7, 12), change('fac_price', 'Price', 10, 15), change('fac_cac', 'Acquisition cost', 3, 4)] }))
    render(<RunChangesSummary />)
    fireEvent.click(screen.getByTestId(`${T}-why-toggle`))
    expect(screen.getByTestId(`${T}-changed`).textContent).toContain('Price: 10% → 15%')
  })
  it('a changed input focuses the node its ids name', () => {
    seed(delta())
    render(<RunChangesSummary />)
    // The pill's own changed input is the link — no need to open the detail.
    const focus = screen.getByTestId(`${T}-focus`)
    expect(focus.getAttribute('data-entity-id')).toBe('fac_churn')
    fireEvent.click(focus)
    expect(vi.mocked(focusNodeById)).toHaveBeenCalledWith('fac_churn')
  })
})

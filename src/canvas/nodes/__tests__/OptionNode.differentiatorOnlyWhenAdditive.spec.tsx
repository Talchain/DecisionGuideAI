/**
 * ⭐ THE OPTION CARD'S DIFFERENTIATOR SAYS SOMETHING THE ROWS DON'T, OR NOTHING
 * — NODE-ANATOMY v3.2 row "Option" (ED #63 5806266691: "Keep the rest of v32
 * as stated: ≤2 option change rows + `+N more`; differentiator only when
 * additive").
 *
 *   Line 2    the delta grid, max 2 rows + `+N more`; then ONE differentiator
 *             line, ONLY if it adds something the rows don't — not
 *             "<only row> is the key difference".
 *
 * What "adds" means, derived from the two sentence forms
 * `computeAllDifferentiators` builds:
 *   · it names a change the card does NOT show (it sits behind `+N more`) → adds;
 *   · "<X> is the key difference" where X is one of SEVERAL changes → adds
 *     (it says which one matters);
 *   · "<X> is the key difference" where X is the option's ONLY change → adds
 *     nothing (the one row IS the difference);
 *   · "<X> → <value>" / a direction, where X is a shown row → repeats the row.
 *
 * Supersedes Paul's 10 Sep "both stay" for the REPEATING cases only; where the
 * sentence adds, both still stay.
 *
 * ⚠ IDENTITY: every row and line is bound by a test id carrying the option id
 * (and factor id), and every absence has a positive control in the same render.
 *
 * CLAIM SCOPE: jsdom — test ids and text. Not pixels.
 *
 * ⭐ RE-POINTED TWICE. The bounded anatomy (ED #63 5809278282, 24 Sep) moved
 * the rows and the line into the popover; Paul (25 Sep) ruled the card must
 * match the PROTOTYPE, so the rows (up to THREE) and `+N more` are back ON THE
 * CARD (`optionCardRows`) while the computed line stays in the popover
 * (`option-preview-detail-<id>`, mounted only when the line renders). The rule
 * is unchanged: the line renders only when it adds beyond the rows the CARD shows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { optionCardRows, optionPreviewDetail } from './__helpers__/optionPreview'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
// Pass-through popover: the moved detail is in the DOM to be read by identity.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

/**
 * ⚠ ANCHORED WITH ITS REASON (Paul 25 Sep): a row's "from" is now the factor
 * card's own reading. Unanchored (`{value: 0}`), these factor cards read "No
 * developer headcount in place" / "No coordination cost in place", every row
 * runs past the 34-character budget and the card shows ONE row (ED 02:31Z D2) —
 * so the cases this spec is about stop existing. A raw figure and a real unit
 * make the readings short ("0 engineers", "£0", "0 incidents"); the observed
 * model value (0) the differentiator reads is unchanged.
 */
const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, raw_value: 0, unit: 'engineers' }, unit: 'engineers' },
}
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor', observedState: { value: 0, raw_value: 0, unit: '£' } } }
const FACTOR_RISK = { id: 'f-risk', type: 'factor', data: { label: 'Delivery risk', type: 'factor', observedState: { value: 0, raw_value: 0, unit: 'incidents' } } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }
const BASELINE = {
  id: 'option-b', type: 'option',
  data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: {} },
}

let ceeReady: unknown = null

const makeStoreState = () => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, FACTOR_RISK, OPTION_1, OPTION_2, BASELINE],
  edges: [],
  ceeAnalysisReady: ceeReady,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true,
}

const renderOption1 = (options: Array<{ id: string; interventions: Record<string, unknown> }>) => {
  ceeReady = { options }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id="option-1" data={{ label: 'Hire two developers', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

/** The rows and `+N more` are on option-1's CARD; the computed line is in its popover detail (or absent). */
const cardRows = () => within(optionCardRows('option-1'))
const row = (factorId: string) => cardRows().queryByTestId(`option-change-row-option-1-${factorId}`)
const differentiator = () => {
  const detail = optionPreviewDetail('option-1')
  return detail ? within(detail).queryByTestId('option-differentiator-option-1') : null
}
const more = () => cardRows().queryByTestId('option-change-more-option-1')
/**
 * The whole sentence the line states: its visible text when nothing was elided,
 * else its hover recovery (`OptionNode.differentiatorRecoverable.spec` pins that
 * the recovery IS that sentence). S4 (9914ffa3; ED #63 5806207128) derives the
 * label budget from the 260 card — 18 characters — so "Developer headcount"
 * (19) is elided on screen; this spec is about WHEN the line renders, so it
 * binds the sentence, not the budget's cut.
 */
const fullSentence = (el: HTMLElement | null) => el?.getAttribute('title') ?? el?.textContent

describe('NODE-ANATOMY v3.2 · Option · the differentiator only when it adds beyond the rows', () => {
  it('ONE change → no "<only row> is the key difference": the row already is the difference', () => {
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
      { id: 'option-2', interventions: { 'f-cost': 5 } },
    ])
    // Positive control: the option's one change IS on the card.
    expect(row('f-head')).not.toBeNull()
    expect(more()).toBeNull()
    expect(differentiator()).toBeNull()
    expect(document.body.textContent).not.toContain('is the key difference')
  })

  it('CONTRAST — TWO changes: "<X> is the key difference" names which shown row matters, so it stays', () => {
    // ⚠ FIXTURE SHORTENED WITH ITS REASON (S4, 9914ffa3; ED #63 5806207128): at
    // the 260 card the two-row budget is 2 × 18 = 36 characters, and a bare
    // `'f-cost': 2` renders "No coordination cost in place → Very high" (41), so
    // the card drops to ONE row (ED 02:31Z D2) and headcount leaves the rows —
    // the case this test is for stops existing. A short shared value keeps both
    // rows on the card; the claim is unchanged.
    const cost = { value: 2, display_value: '£2k' }
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 6, display_value: '6 engineers' }, 'f-cost': cost } },
      { id: 'option-2', interventions: { 'f-cost': cost } },
    ])
    expect(row('f-head')).not.toBeNull()
    expect(row('f-cost')).not.toBeNull()
    expect(more()).toBeNull()
    expect(fullSentence(differentiator())).toBe('Developer headcount is the key difference')
    expect(differentiator()?.textContent).toMatch(/ is the key difference$/)
  })

  it('it names a change hidden behind "+N more" → it adds, so it stays', () => {
    // Short values, so the row budget binds (a long value drops to ONE row). A
    // THIRD shared change fills the card's three rows (Paul 25 Sep).
    const head = { value: 2, display_value: '2 engineers' }
    const cost = { value: 3, display_value: '£3k' }
    const seats = { value: 4, display_value: '4 seats' }
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': head, 'f-cost': cost, 'f-seats': seats, 'f-risk': { value: 9, display_value: '9 incidents' } } },
      { id: 'option-2', interventions: { 'f-head': head, 'f-cost': cost, 'f-seats': seats } },
    ])
    // ≤3 rows + "+1 more": the shared order puts the common changes first.
    expect(row('f-head')).not.toBeNull()
    expect(row('f-cost')).not.toBeNull()
    expect(row('f-seats')).not.toBeNull()
    expect(row('f-risk')).toBeNull()
    expect(more()?.textContent).toBe('+1 more')
    expect(differentiator()?.textContent).toBe('Delivery risk is the key difference')
  })

  it('"<X> → <value>" where X is a SHOWN row repeats the row, so it goes', () => {
    // Both options claim headcount → the shared-factor value form.
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': { value: 6, display_value: '6 engineers' }, 'f-cost': 2 } },
      { id: 'option-2', interventions: { 'f-head': { value: 1, display_value: '1 engineer' }, 'f-cost': 2 } },
    ])
    expect(row('f-head')?.textContent).toContain('6 engineers')
    expect(differentiator()).toBeNull()
    // Markup, not text: at the S4 budget the visible form is elided, so only the
    // hover recovery could still carry the whole sentence (9914ffa3).
    expect(document.body.innerHTML).not.toContain('Developer headcount → 6 engineers')
  })

  it('≤3 change rows at rest (Paul 25 Sep; was 2), then "+N more" from the one total', () => {
    const head = { value: 2, display_value: '2 engineers' }
    const cost = { value: 3, display_value: '£3k' }
    const seats = { value: 4, display_value: '4 seats' }
    renderOption1([
      { id: 'option-1', interventions: { 'f-head': head, 'f-cost': cost, 'f-seats': seats, 'f-risk': { value: 9, display_value: '9 incidents' } } },
      { id: 'option-2', interventions: { 'f-head': head, 'f-cost': cost, 'f-seats': seats, 'f-risk': { value: 1, display_value: '1 incident' } } },
    ])
    const rows = cardRows().getAllByTestId(/^option-change-row-option-1-f-/)
    expect(rows).toHaveLength(3)
    expect(more()?.textContent).toBe('+1 more')
  })
})

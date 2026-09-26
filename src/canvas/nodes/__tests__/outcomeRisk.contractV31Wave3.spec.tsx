/**
 * Outcome + Risk cards against contract v3.1 — the wave-3 "outrisk" deltas.
 *
 *  · OR-02 / RHY-09 — the outcome states its OWN state directly under its title:
 *    `Outcome not quantified` when the record holds no number (the v3.1 fixture:
 *    `<div class="small-state">Outcome not quantified</div>`), the same value +
 *    source-mark row as a factor when it does, and NEVER the absence line over a
 *    number the record holds. The risk's state line loses its full stop.
 *  · OR-06 — the risk's own recorded size carries a visible source mark
 *    (v3.1 point 1: never "unmarked = Olumi").
 *  · OR-08 — authored context comes AFTER the card's own state, at 11px.
 *  · RHY-06 — one row rhythm: the first body row takes no top margin (the header
 *    supplies it), later rows take `mt-1`, nothing trails.
 *  · FRAME-15 / OR-12 / T13 — the Detailed severity badge is a pill
 *    (`rounded-full`, ~6px horizontal padding), sentence case, with no wrapper.
 *
 * Every assertion binds by IDENTITY (testid, exact text, exact class), and each
 * block has a contrast case in the same file that the old render also satisfied
 * or that the new render must not satisfy.
 *
 * `NodePopover` is NOT mocked: hidden popover children are absent from the DOM,
 * so everything found in a resting render is on the card face.
 *
 * ⚠ RE-POINTED FOR ED #63 5809278282 (24 Sep 2026, bounded anatomy: "repeated
 * cards may reduce to title + one primary line … Outcome/Risk = state"). In
 * STANDARD view the state line shows its short form with the fixture sentence
 * in `sr-only` + `title` (+ the popover — `outcomeRisk.boundedAnatomy.spec`),
 * and the authored context moved to the popover. The fixture words stay
 * byte-for-byte on the Detailed card, and the multi-row order/rhythm clauses
 * (OR-08, RHY-06) are now Detailed-view clauses — asserted there.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode, OUTCOME_UNQUANTIFIED_LINE } from '../OutcomeNode'
import { RiskNode, RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { typography } from '../../../styles/typography'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'standard',
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
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
  position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

const applyStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(overrides) as never))

const renderOutcome = (data: Record<string, unknown> = {}, id = 'outcome-1') =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} id={id} type="outcome" data={{ label: 'Customer retention', type: 'outcome', ...data }} />
    </ReactFlowProvider>,
  )

const renderRisk = (data: Record<string, unknown> = {}, id = 'risk-1') =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} id={id} type="risk" data={{ label: 'Customer loss after a price rise', type: 'risk', ...data }} />
    </ReactFlowProvider>,
  )

/** The real risk payload from `golden-path-staging-2026-04-05.json` (see RiskNode.statesItsOwnSize.spec). */
const TWELVE_MONTHS_FROM_BRIEF = {
  value: 0.5, unit: 'months', source: 'brief_extraction',
  raw_value: 12, cap: 24, extractionType: 'explicit', factor_type: 'time',
}
const TWELVE_MONTHS_OLUMI = { ...TWELVE_MONTHS_FROM_BRIEF, source: 'cee_inference', extractionType: 'inferred' }

const classes = (el: Element | null) => (el ? Array.from(el.classList) : [])
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
/** A Standard primary line's two carriers: what a sighted reader sees, and the sentence announced. */
const shown = (el: Element) => el.querySelector('[aria-hidden="true"]')?.textContent ?? null
const announced = (el: Element) => el.querySelector('.sr-only')?.textContent ?? null

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  applyStore()
})

describe('OR-02 / RHY-09 — the outcome card states its own state', () => {
  // Contract v3.1 `.small-state` (26 Sep, WS4; was ED 5809278282's short form): Standard SHOWS the fixture sentence too.
  it('an outcome with no number says so, in the fixture’s exact words', () => {
    renderOutcome()
    const line = screen.getByTestId('outcome-unquantified')
    expect(shown(line)).toBe('Outcome not quantified')
    expect(announced(line)).toBe('Outcome not quantified')
    expect(line.getAttribute('title')).toBe('Outcome not quantified')
    expect(OUTCOME_UNQUANTIFIED_LINE).toBe('Outcome not quantified')
    expect(screen.queryByTestId('outcome-recorded-value')).toBeNull()
    cleanup()
    applyStore({ viewMode: 'expert' })
    renderOutcome()
    expect(screen.getByTestId('outcome-unquantified').textContent).toBe('Outcome not quantified')
  })

  it('…in BOTH phases: an analysis does not quantify an outcome the record holds no number for', () => {
    applyStore({ results: { status: 'complete', report: null } })
    renderOutcome()
    const line = screen.getByTestId('outcome-unquantified')
    expect(shown(line)).toBe('Outcome not quantified')
    expect(announced(line)).toBe(OUTCOME_UNQUANTIFIED_LINE)
  })

  it('the outcome line and the risk unset line are ONE element: identical classes', () => {
    renderOutcome()
    renderRisk()
    const outcomeLine = screen.getByTestId('outcome-unquantified')
    const riskLine = screen.getByTestId('risk-exposure-unset')
    expect(outcomeLine.tagName).toBe(riskLine.tagName)
    expect(outcomeLine.className).toBe(riskLine.className)
    for (const c of typography.edgeLabel.split(' ')) expect(classes(outcomeLine)).toContain(c)
    expect(classes(outcomeLine)).toContain('text-text-light')
  })

  it('⛔ never renders over a number: a recorded value shows the value row with its source mark instead', () => {
    renderOutcome({ observedState: TWELVE_MONTHS_FROM_BRIEF })
    expect(screen.queryByTestId('outcome-unquantified')).toBeNull()
    const row = screen.getByTestId('outcome-recorded-value')
    expect(screen.getByTestId('outcome-recorded-readout').textContent).toBe('12 months')
    const mark = screen.getByTestId('outcome-value-source-outcome-1')
    expect(row.contains(mark)).toBe(true)
    expect(mark.getAttribute('data-value-source')).toBe('brief')
  })

  it('⛔ …nor over a number nobody can format honestly (a zero magnitude): neither line renders', () => {
    renderOutcome({ observedState: { value: 0, raw_value: 0, unit: '£', source: 'brief_extraction' } })
    expect(screen.queryByTestId('outcome-unquantified')).toBeNull()
    expect(screen.queryByTestId('outcome-recorded-value')).toBeNull()
  })

  it('the wire spelling `observed_state` is read too — a number there also withholds the absence line', () => {
    renderOutcome({ observed_state: { value: 0.4 } })
    expect(screen.queryByTestId('outcome-unquantified')).toBeNull()
  })
})

describe('OR-02 — the risk state line is a label, not a sentence', () => {
  // Byte for byte in Standard's visible text, sr-only + title and on the Detailed card — contract v3.1 (DESIGN-GAP-v31 #34) shows the whole label.
  it('has no trailing full stop, and renders byte for byte', () => {
    renderRisk()
    expect(RISK_EXPOSURE_UNSET_LINE).toBe('Likelihood and impact not set yet')
    const line = screen.getByTestId('risk-exposure-unset')
    expect(announced(line)).toBe('Likelihood and impact not set yet')
    expect(line.getAttribute('title')).toBe('Likelihood and impact not set yet')
    expect(shown(line)).toBe('Likelihood and impact not set yet')
    cleanup()
    applyStore({ viewMode: 'expert' })
    renderRisk()
    expect(screen.getByTestId('risk-exposure-unset').textContent).toBe('Likelihood and impact not set yet')
  })
})

describe('OR-06 — the risk’s own recorded size carries a visible source mark', () => {
  it('a value from the brief is marked `brief`, on the value’s own baseline row', () => {
    renderRisk({ observedState: TWELVE_MONTHS_FROM_BRIEF })
    const row = screen.getByTestId('risk-recorded-value')
    expect(screen.getByTestId('risk-recorded-readout').textContent).toBe('12 months')
    const mark = screen.getByTestId('risk-value-source-risk-1')
    expect(row.contains(mark)).toBe(true)
    expect(mark.getAttribute('data-value-source')).toBe('brief')
    expect(mark.querySelector('[aria-hidden="true"]')?.textContent).toBe('brief')
    expect(classes(row)).toEqual(expect.arrayContaining(['flex', 'items-baseline']))
    for (const c of typography.nodeValue.split(' ')) expect(classes(row)).toContain(c)
  })

  it('an Olumi estimate is marked `est.` — and the mark promises no route the fenced risk panel lacks', () => {
    renderRisk({ observedState: TWELVE_MONTHS_OLUMI })
    const mark = screen.getByTestId('risk-value-source-risk-1')
    expect(mark.getAttribute('data-value-source')).toBe('olumi')
    expect(mark.querySelector('[aria-hidden="true"]')?.textContent).toBe('est.')
    expect(mark.getAttribute('title') ?? '').not.toMatch(/Open the details/)
  })

  it('CONTRAST — no recorded size, no row and no mark', () => {
    renderRisk()
    expect(screen.queryByTestId('risk-recorded-value')).toBeNull()
    expect(screen.queryByTestId('risk-value-source-risk-1')).toBeNull()
  })
})

// ED 5809278282: the authored context left the Standard body for the popover, so
// the order/size clause is asserted where both rows still render — Detailed.
describe('OR-08 — authored context follows the card’s own state, at 11px (Detailed)', () => {
  const EDGE_LABEL_SIZE = typography.edgeLabel.split(' ')[0]
  const NODE_LABEL_SIZE = typography.nodeLabel.split(' ')[0]
  beforeEach(() => { applyStore({ viewMode: 'expert' }) })

  it('CONTRAST — Standard carries no context row on the card at all (it is in the popover)', () => {
    applyStore({ viewMode: 'standard' })
    renderOutcome({ description: 'Share of accounts renewing at twelve months' })
    renderRisk({ description: 'Two enterprise accounts are up for renewal' })
    expect(screen.queryByTestId('outcome-context-preview')).toBeNull()
    expect(screen.queryByTestId('risk-context-preview')).toBeNull()
    // Same render: the cards' own state lines are there.
    expect(screen.getByTestId('outcome-unquantified')).toBeTruthy()
    expect(screen.getByTestId('risk-exposure-unset')).toBeTruthy()
  })

  it('outcome: the state line comes first, the summary after it, one step smaller', () => {
    renderOutcome({ description: 'Share of accounts renewing at twelve months' })
    const state = screen.getByTestId('outcome-unquantified')
    const summary = screen.getByTestId('outcome-context-preview')
    expect(precedes(state, summary)).toBe(true)
    expect(classes(summary)).toContain(EDGE_LABEL_SIZE)
    expect(classes(summary)).not.toContain(NODE_LABEL_SIZE)
    // Still compact and still yields to the chevron's full description.
    expect(classes(summary)).toEqual(expect.arrayContaining(['line-clamp-2', 'group-aria-expanded:hidden']))
  })

  it('risk: the recorded size and the exposure line both precede the summary', () => {
    renderRisk({ observedState: TWELVE_MONTHS_FROM_BRIEF, description: 'Two enterprise accounts are up for renewal' })
    const value = screen.getByTestId('risk-recorded-value')
    const exposure = screen.getByTestId('risk-exposure-unset')
    const summary = screen.getByTestId('risk-context-preview')
    expect(precedes(value, exposure)).toBe(true)
    expect(precedes(exposure, summary)).toBe(true)
    expect(classes(summary)).toContain(EDGE_LABEL_SIZE)
    expect(classes(summary)).not.toContain(NODE_LABEL_SIZE)
  })
})

// ED 5809278282: Standard has ONE row (flush, nothing trailing — pinned below); the
// multi-row rhythm is a Detailed clause now.
describe('RHY-06 — one row rhythm: first row flush, later rows `mt-1`, nothing trailing', () => {
  it('Standard: the one primary line is flush and trails nothing', () => {
    renderRisk({ description: 'Two enterprise accounts are up for renewal' })
    renderOutcome({ description: 'Share of accounts renewing' })
    for (const id of ['risk-exposure-unset', 'outcome-unquantified']) {
      expect(classes(screen.getByTestId(id))).not.toContain('mt-1')
      expect(classes(screen.getByTestId(id))).not.toContain('mb-1')
    }
  })

  describe('Detailed', () => {
  beforeEach(() => { applyStore({ viewMode: 'expert' }) })
  it('risk, unsized, with context: exposure line is the first row; the summary takes the gap', () => {
    renderRisk({ description: 'Two enterprise accounts are up for renewal' })
    const exposure = screen.getByTestId('risk-exposure-unset')
    const summary = screen.getByTestId('risk-context-preview')
    expect(classes(exposure)).not.toContain('mt-1')
    expect(classes(exposure)).not.toContain('mb-1')
    expect(classes(summary)).toContain('mt-1')
    expect(classes(summary)).not.toContain('mb-1')
  })

  it('risk with a recorded size: the value row is flush, the exposure line takes the gap', () => {
    renderRisk({ observedState: TWELVE_MONTHS_FROM_BRIEF, probability: 0.3, impact: 'high' })
    expect(classes(screen.getByTestId('risk-recorded-value'))).not.toContain('mt-1')
    const line = screen.getByTestId('risk-exposure-line')
    expect(classes(line)).toContain('mt-1')
    expect(classes(line)).not.toContain('mb-1')
  })

  it('outcome: the state line is flush; the summary takes the gap only when a state line precedes it', () => {
    renderOutcome({ description: 'Share of accounts renewing' })
    expect(classes(screen.getByTestId('outcome-unquantified'))).not.toContain('mt-1')
    expect(classes(screen.getByTestId('outcome-unquantified'))).not.toContain('mb-1')
    expect(classes(screen.getByTestId('outcome-context-preview'))).toContain('mt-1')
    expect(classes(screen.getByTestId('outcome-context-preview'))).not.toContain('mb-1')
    cleanup()
    // A zero magnitude renders no state line, so the summary is the first row.
    renderOutcome({ description: 'Share of accounts renewing', observedState: { value: 0, raw_value: 0 } })
    expect(classes(screen.getByTestId('outcome-context-preview'))).not.toContain('mt-1')
  })
  })
})

describe('FRAME-15 / OR-12 / T13 — the Detailed severity badge is a sentence-case pill', () => {
  // A block body: `mockImplementation` returns the mock, and vitest would run a
  // returned function as this hook's cleanup.
  beforeEach(() => { applyStore({ viewMode: 'expert' }) })

  it('renders as a pill, in sentence case, sitting directly in the body with the exposure line after it', () => {
    renderRisk({ probability: 0.9, impact: 'high' })
    const badge = screen.getByTestId('risk-severity-badge')
    expect(badge.textContent).toBe('High risk')
    expect(classes(badge)).toEqual(expect.arrayContaining(['rounded-full', 'px-1.5', 'w-fit', 'border', 'border-danger/30', 'text-text-body']))
    expect(classes(badge)).not.toContain('rounded')
    expect(classes(badge)).not.toContain('mb-1')
    // No `mt-1` wrapper: the badge's next sibling is the exposure line itself.
    expect(badge.nextElementSibling).toBe(screen.getByTestId('risk-exposure-line'))
    expect(classes(badge.parentElement)).not.toContain('mt-1')
    // The badge is the first body row, so it is flush; the exposure line takes the gap.
    expect(classes(badge)).not.toContain('mt-1')
    expect(classes(screen.getByTestId('risk-exposure-line'))).toContain('mt-1')
  })

  it('after a recorded size, the badge takes the row gap', () => {
    renderRisk({ probability: 0.9, impact: 'high', observedState: TWELVE_MONTHS_FROM_BRIEF })
    expect(classes(screen.getByTestId('risk-severity-badge'))).toContain('mt-1')
  })

  it('CONTRAST — Standard view still carries no badge (locked design, 23 Sep 2026)', () => {
    applyStore({ viewMode: 'standard' })
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.queryByTestId('risk-severity-badge')).toBeNull()
    // ED 5809278282: the figures are the line; the qualifier rides sr-only + title (+ popover).
    const line = screen.getByTestId('risk-exposure-line')
    expect(shown(line)).toBe('90% likely · High impact')
    expect(announced(line)).toBe('Entered estimate · 90% likely · High impact')
  })
})

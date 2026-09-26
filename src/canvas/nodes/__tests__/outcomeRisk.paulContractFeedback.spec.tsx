/**
 * Outcome + Risk cards against Paul's 23 Sep 2026 Visual Contract feedback,
 * points 8, 9 and 13 — as HARDENED by contract v3.1 (VC-01, 23 Sep 2026).
 *
 *  · Point 8 (v3.1) — drop low-information Outcome copy. v3.1's rule: remove
 *    "N options move/connect" UNLESS it genuinely differentiates, e.g. "No option
 *    moves this outcome"; its fixture removes the line from ALL outcomes. The
 *    first cut kept a "2 of 3 options connect to this" form where SOME options
 *    reached the outcome; Paul flagged that served line against v3.1 (gap U2,
 *    24 Sep), so it is gone at every count. No zero-state sentence existed, and
 *    none is invented here.
 *  · U1 (v3.1 "Option and outcome limits": "Outcome/risk records are distinct
 *    from the strength of their connections") — the card carries NO
 *    "Link strength" row and no strength figure at ANY rung. Strength is the
 *    connection's fact, inspectable on the edge and in its inspector.
 *  · Point 9 — risk uses the existing Danger treatment. The Detailed severity
 *    badge painted Tailwind yellow/orange defaults that are not in the design
 *    system; it is now the design-system outlined pill (`border-danger/30`,
 *    `text-text-body`), and the WORD carries the severity, not a colour.
 *  · Point 13 — bounded family heights, no filler. The card keeps its OWN state
 *    (risk likelihood/impact or the unset sentence, a recorded size, an
 *    authored consequence) and gains no placeholder where copy was removed.
 *
 * `NodePopover` is NOT mocked: hidden popover children are absent from the DOM,
 * so everything found in a resting render is on the card face.
 *
 * ⚠ RE-POINTED FOR ED #63 5809278282 (24 Sep 2026, bounded anatomy): in
 * Standard view the authored context left the card for the popover, so the
 * same-render CONTRAST controls below bind to the card's own state line
 * instead; that line shows its short form with the full sentence in `sr-only`
 * + `title` (`outcomeRisk.boundedAnatomy.spec` pins the popover side).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'

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
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'

const baseProps = {
  position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

// The product's own grammar: option → factor → outcome, never option → outcome.
const NODES = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Buy' } },
  { id: 'option-3', type: 'option', data: { type: 'option', label: 'Partner' } },
  { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
  { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'Licence cost' } },
  { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'Partner appetite' } },
  { id: 'outcome-all', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
  { id: 'outcome-two', type: 'outcome', data: { type: 'outcome', label: 'Margin' } },
  { id: 'outcome-one', type: 'outcome', data: { type: 'outcome', label: 'Brand reach' } },
  { id: 'outcome-none', type: 'outcome', data: { type: 'outcome', label: 'Morale' } },
  { id: 'goal-1', type: 'goal', data: { type: 'goal', label: 'Grow' } },
  { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Churn spike' } },
]

const EDGES = [
  { id: 'o1f1', source: 'option-1', target: 'factor-1', data: {} },
  { id: 'o2f2', source: 'option-2', target: 'factor-2', data: {} },
  { id: 'o3f3', source: 'option-3', target: 'factor-3', data: {} },
  // every option reaches outcome-all
  { id: 'f1a', source: 'factor-1', target: 'outcome-all', data: {} },
  { id: 'f2a', source: 'factor-2', target: 'outcome-all', data: {} },
  { id: 'f3a', source: 'factor-3', target: 'outcome-all', data: {} },
  // two of three reach outcome-two
  { id: 'f1t', source: 'factor-1', target: 'outcome-two', data: {} },
  { id: 'f2t', source: 'factor-2', target: 'outcome-two', data: {} },
  // one of three reaches outcome-one
  { id: 'f3o', source: 'factor-3', target: 'outcome-one', data: {} },
  // Bridge edges in both provenance states: an Olumi estimate nobody settled
  // (`strength_mean`, the producer shape) and a figure a person set. Before
  // v3.1 each drew a "Link strength" row on the card.
  { id: 'ag', source: 'outcome-all', target: 'goal-1', data: { strength_mean: 0.6, direction: 'positive', beliefExists: null } },
  { id: 'tg', source: 'outcome-two', target: 'goal-1', data: { weight: 0.45, direction: 'positive', weightSource: 'user' } },
  { id: 'rg', source: 'risk-1', target: 'goal-1', data: { weight: 0.5, direction: 'negative', weightSource: 'user' } },
]

const applyStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState({ nodes: NODES, edges: EDGES, ...overrides }) as any),
  )

const renderOutcome = (id: string, label: string, extra: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} id={id} type="outcome" data={{ label, type: 'outcome', ...extra }} />
    </ReactFlowProvider>,
  )

/** A Standard primary line's two carriers: what a sighted reader sees, and the sentence announced. */
const shown = (el: Element) => el.querySelector('[aria-hidden="true"]')?.textContent ?? null
const announced = (el: Element) => el.querySelector('.sr-only')?.textContent ?? null

const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} id="risk-1" type="risk" data={{ label: 'Churn spike', type: 'risk', ...data }} />
    </ReactFlowProvider>,
  )

describe('contract v3.1 pt 8 — the Outcome card carries no option-reach count (gap U2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  it.each([
    ['outcome-all', 'Revenue', 'every option'],
    ['outcome-two', 'Margin', '2 of 3 — the form served on staging'],
    ['outcome-one', 'Brand reach', '1 of 3'],
    ['outcome-none', 'Morale', 'none'],
  ])('%s (%s, reached by %s): no count line, in either phase', (id, label) => {
    for (const status of ['idle', 'complete']) {
      applyStore({ results: { status, report: null } })
      const { container, unmount } = renderOutcome(id, label, { description: `${label} context` })
      // CONTRAST, same render: the card and its own state are there (ED
      // 5809278282: the authored context moved to the popover, off the face).
      expect(announced(screen.getByTestId('outcome-unquantified'))).toBe('Outcome not quantified')
      expect(container.textContent).not.toContain(`${label} context`)
      expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
      expect(container.textContent).not.toMatch(/\boptions? connects? to this|alternatives connect|options? moves? this/i)
      unmount()
    }
  })

  /**
   * ⚠ THIS CASE ASSERTED THE OPPOSITE UNTIL CONTRACT v3.1's OWN FIXTURE WAS
   * APPLIED (OR-02 / RHY-09), AND THE OLD READING IS KEPT SO THE FLIP IS LEGIBLE.
   * It read "adds no filler line in place of the removed copy (point 13: no
   * empty space)" and asserted `not.toMatch(/not quantified|…/)`. Point 8 says
   * "use that space for actual outcome state", and the v3.1 fixture renders
   * exactly `<div class="small-state">Outcome not quantified</div>` for an
   * outcome with no value. That is the outcome's OWN state, not filler, and not
   * a placeholder for the count: the count stays gone, and no count-shaped
   * zero-state ("No option moves this outcome") is invented.
   */
  it("the removed count is not replaced by a count-shaped line; the outcome's own state is (contract v3.1 OR-02)", () => {
    const { container } = renderOutcome('outcome-two', 'Margin')
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
    // v3.1 `.small-state` (26 Sep, WS4): the fixture sentence SHOWN and announced
    // (was ED 5809278282's short form "Not quantified").
    const line = screen.getByTestId('outcome-unquantified')
    expect(shown(line)).toBe('Outcome not quantified')
    expect(announced(line)).toBe('Outcome not quantified')
    expect(container.textContent).not.toMatch(/alternatives connect|No option moves/i)
  })
})

describe('contract v3.1 — Outcome/Risk records are distinct from the strength of their connections (gap U1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  const STRENGTH_ON_CARD = /Link strength|Olumi[’']s estimate|Estimate, not confirmed/

  it.each(['idle', 'complete'])('an outcome whose link is an unsettled Olumi estimate shows no strength row (%s)', (status) => {
    applyStore({ results: { status, report: null } })
    const { container } = renderOutcome('outcome-all', 'Revenue', { description: 'Recurring revenue next year' })
    // CONTRAST, same render: the outcome's own state line (ED 5809278282 moved the context to the popover).
    expect(shown(screen.getByTestId('outcome-unquantified'))).toBe('Outcome not quantified')
    expect(screen.queryByTestId('outcome-strength-row')).toBeNull()
    expect(container.textContent).not.toMatch(STRENGTH_ON_CARD)
    expect(container.textContent).not.toMatch(/\d+%/)
  })

  it('an outcome whose link strength a PERSON set shows no figure either — it is the connection’s fact', () => {
    const { container } = renderOutcome('outcome-two', 'Margin')
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-strength-row')).toBeNull()
    expect(container.textContent).not.toMatch(STRENGTH_ON_CARD)
    expect(container.textContent).not.toContain('45%')
  })

  it('a risk with a person-set link keeps its OWN unset statement and loses the strength row', () => {
    const { container } = renderRisk()
    // CONTRAST: the risk's own state, still on the face — contract v3.1
    // (DESIGN-GAP-v31 #34): the exact sentence SHOWN and announced (was ED
    // 5809278282's short form "Not set yet").
    const line = screen.getByTestId('risk-exposure-unset')
    expect(announced(line)).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(shown(line)).toBe(RISK_EXPOSURE_UNSET_LINE)
    // Contract v3.1 (OR-02): the fixture's state line has no full stop.
    expect(RISK_EXPOSURE_UNSET_LINE).toBe('Likelihood and impact not set yet')
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
    expect(container.textContent).not.toMatch(STRENGTH_ON_CARD)
    expect(container.textContent).not.toContain('50%')
  })

  it('a risk with its own likelihood and impact shows them, and no link row', () => {
    renderRisk({ probability: 0.3, impact: 'high' })
    // ED 5809278282: the figures are the line; the qualifier rides sr-only + title (+ popover).
    const line = screen.getByTestId('risk-exposure-line')
    expect(shown(line)).toBe('30% likely · High impact')
    expect(announced(line)).toBe('Entered estimate · 30% likely · High impact')
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
  })

  describe('…at the reduced (far-zoom) rung too', () => {
    const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

    it('an outcome with an Olumi-estimated link says nothing about its strength', () => {
      applyStore({ lodRung: 'line' })
      renderOutcome('outcome-all', 'Revenue')
      expect(lodLine()).toBeNull()
      expect(document.body.textContent).not.toMatch(STRENGTH_ON_CARD)
    })

    it('a risk with a person-set link does not print "Link strength 50%"', () => {
      applyStore({ lodRung: 'line' })
      renderRisk()
      expect(lodLine()).toBeNull()
      expect(document.body.textContent).not.toMatch(STRENGTH_ON_CARD)
    })

    it('CONTRAST — a risk that records its own size still speaks at this rung, in its own unit', () => {
      applyStore({ lodRung: 'line' })
      renderRisk({
        observedState: { value: 0.5, unit: 'months', source: 'brief_extraction', raw_value: 12, cap: 24, extractionType: 'explicit', factor_type: 'time' },
      })
      expect(lodLine()).toBe('12 months')
    })

    it('⛔ removing the link line does not let the GOAL’s chance fall through onto an outcome', () => {
      // `achievementProbability` on an outcome is the recommended option's chance
      // of reaching THE GOAL (useNodeDisplayMetadata), identical on every
      // outcome; it was removed from this card on 17 Sep. v3.1: "Probability of
      // a goal … must never stand in" for another fact. With no owner line, the
      // central resolver's outcome arm used to print it here.
      vi.mocked(useNodeDisplayMetadata).mockReturnValue({
        sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
        achievementProbability: 0.62, achievementProbabilityIsModelledBasis: false,
        stabilityPercentage: null, winRate: null, isResultsMode: true,
        predictedOutcome: null, valueOfInformation: null, voiRank: null,
      } as any)
      applyStore({ lodRung: 'line', results: { status: 'complete', report: null } })
      renderOutcome('outcome-none', 'Morale')
      expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
      expect(lodLine()).toBeNull()
      expect(document.body.textContent).not.toContain('62%')
    })
  })
})

describe('Paul 23 Sep point 9 — risk uses the existing Danger treatment, no invented colours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore({ viewMode: 'expert' })
  })

  it.each([
    // Sentence case (contract v3.1 T13).
    [0.1, 'low', 'Low risk'],
    [0.5, 'medium', 'Medium risk'],
    [0.9, 'high', 'High risk'],
  ])('severity badge %s/%s is the design-system danger pill; the word carries the severity', (probability, impact, word) => {
    renderRisk({ probability, impact })
    const badge = screen.getByText(word)
    expect(badge.className).toContain('border-danger/30')
    expect(badge.className).toContain('text-text-body')
    expect(badge.className).not.toMatch(/yellow-|orange-|text-danger|bg-danger/)
  })
})

describe('Paul 23 Sep point 13 (v3.1) — one anatomy for the outcome/risk family: own state, no link row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  it("the risk's own size (likelihood/impact) is on the face; the link row that used to follow it is gone", () => {
    renderRisk({ probability: 0.3, impact: 'high' })
    expect(screen.getByTestId('risk-exposure-line')).toBeDefined()
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
  })

  it('…and so is the unset statement, which is a fact about the risk, not the link', () => {
    renderRisk()
    expect(screen.getByTestId('risk-exposure-unset')).toBeDefined()
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
  })
})

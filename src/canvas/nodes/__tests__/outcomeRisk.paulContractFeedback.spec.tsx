/**
 * Outcome + Risk cards against Paul's 23 Sep 2026 Visual Contract feedback,
 * points 8, 9 and 13.
 *
 *  · Point 8 — drop low-information Outcome copy. "N options connect to this"
 *    stays ONLY where it differentiates: some, not all, of the board's options
 *    reach this outcome. Measured across the five committed starters: 7 of 10
 *    outcomes are reached by EVERY option, where the line said nothing a reader
 *    could use. The kept form names its denominator (point 5's rule: a count
 *    must say what it is out of).
 *  · Point 9 — risk uses the existing Danger treatment. The Detailed severity
 *    badge painted Tailwind yellow/orange defaults that are not in the design
 *    system; it is now the design-system outlined pill (`border-danger/30`,
 *    `text-text-body`), and the WORD carries the severity, not a colour.
 *  · Point 13 — bounded family heights, no filler. The risk's own-size facts sit
 *    together ABOVE the link-strength row, so outcome and risk share one anatomy
 *    (own state, then the link) and neither card gains a placeholder line.
 *
 * `NodePopover` is NOT mocked: hidden popover children are absent from the DOM,
 * so everything found in a resting render is on the card face.
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
  // bridge edges, so the UI-SEM-089 link-strength row renders
  { id: 'ag', source: 'outcome-all', target: 'goal-1', data: { weight: 0.6, direction: 'positive', weightSource: 'cee' } },
  { id: 'rg', source: 'risk-1', target: 'goal-1', data: { weight: 0.5, direction: 'negative', weightSource: 'user' } },
]

const applyStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState({ nodes: NODES, edges: EDGES, ...overrides }) as any),
  )

const renderOutcome = (id: string, label: string) =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} id={id} type="outcome" data={{ label, type: 'outcome' }} />
    </ReactFlowProvider>,
  )

const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} id="risk-1" type="risk" data={{ label: 'Churn spike', type: 'risk', ...data }} />
    </ReactFlowProvider>,
  )

describe('Paul 23 Sep point 8 — Outcome drops copy that does not differentiate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  it.each(['idle', 'complete'])('says nothing about options when EVERY option connects (%s) — and keeps the assumed-strength row', (status) => {
    applyStore({ results: { status, report: null } })
    const { container } = renderOutcome('outcome-all', 'Revenue')
    // Positive control, same render: the card and its UI-SEM-089 row are there.
    expect(screen.getByTestId('outcome-strength-row')).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
    expect(container.textContent).not.toMatch(/options? connects? to this/)
  })

  it('keeps the line where it differentiates, and names what the count is out of', () => {
    renderOutcome('outcome-two', 'Margin')
    expect(screen.getByTestId('outcome-options-moving').textContent).toBe('2 of 3 options connect to this')
  })

  it('uses the singular verb for one option', () => {
    renderOutcome('outcome-one', 'Brand reach')
    expect(screen.getByTestId('outcome-options-moving').textContent).toBe('1 of 3 options connects to this')
  })

  it('stays silent at zero — no counted-zero claim, no placeholder line', () => {
    renderOutcome('outcome-none', 'Morale')
    expect(screen.getByLabelText(/outcome node/i)).toBeDefined()
    expect(screen.queryByTestId('outcome-options-moving')).toBeNull()
  })

  it('adds no filler line in place of the removed copy (point 13: no empty space)', () => {
    const { container } = renderOutcome('outcome-all', 'Revenue')
    expect(container.textContent).not.toMatch(/not quantified|alternatives connect/i)
  })
})

describe('Paul 23 Sep point 9 — risk uses the existing Danger treatment, no invented colours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore({ viewMode: 'expert' })
  })

  it.each([
    [0.1, 'low', 'Low Risk'],
    [0.5, 'medium', 'Medium Risk'],
    [0.9, 'high', 'High Risk'],
  ])('severity badge %s/%s is the design-system danger pill; the word carries the severity', (probability, impact, word) => {
    renderRisk({ probability, impact })
    const badge = screen.getByText(word)
    expect(badge.className).toContain('border-danger/30')
    expect(badge.className).toContain('text-text-body')
    expect(badge.className).not.toMatch(/yellow-|orange-|text-danger|bg-danger/)
  })
})

describe('Paul 23 Sep point 13 — one anatomy for the outcome/risk family', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyStore()
  })

  const follows = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it("the risk's own size (likelihood/impact) sits above the link-strength row, not split around it", () => {
    renderRisk({ probability: 0.3, impact: 'high' })
    const own = screen.getByTestId('risk-exposure-line')
    const link = screen.getByTestId('risk-strength-row')
    expect(follows(own, link)).toBe(true)
  })

  it('…and so does the unset statement, which is a fact about the risk, not the link', () => {
    renderRisk()
    const own = screen.getByTestId('risk-exposure-unset')
    const link = screen.getByTestId('risk-strength-row')
    expect(follows(own, link)).toBe(true)
  })
})

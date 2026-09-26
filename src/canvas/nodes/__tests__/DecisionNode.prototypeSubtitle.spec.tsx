/**
 * ⭐⭐ THE QUESTION CARD'S SUBTITLE MATCHES THE PROTOTYPE (Paul, 25 Sep 2026,
 * from live screenshots: "There is a huge delta between the prototype design
 * and what you've implemented").
 *
 *   PROTOTYPE  "How should Pro pricing evolve?"
 *              "3 alternatives · Evidence priority: conversion"      — one clean line
 *   LIVE       "Decision: Productivity increase"
 *              "3 options · A success target on your model can't be…" — cut mid-sentence
 *
 * Source of the prototype row: `olumi-canvas-visual-contract.html:192`
 * (`'3 alternatives · Evidence priority: conversion'` after a run).
 *
 * What this file pins, each bound by IDENTITY (the decision card's own test
 * ids, the ranked factor's NODE ID), each with a contrast:
 *
 *   (a) the count is the contract's noun, "N alternatives";
 *   (b) the second segment is "Evidence priority: <factor label>" ONLY when the
 *       CURRENT run ranks a factor on this canvas as driver 1 — the same rank
 *       the factor card states as "Driver 1 of N". No rank, no segment; never a
 *       substitute, never the report's own label for a factor the canvas lacks;
 *   (c) the long reasoning sentences (the pre-run top gap, the withheld-leader
 *       disclosure, the run-wide share absence) are OFF the resting row. They
 *       render WHOLE — no clamp, no ellipsis — in the popover (Standard) or the
 *       Detailed body, and a screen-reader copy stays on the card;
 *   (d) the UI adds no "Decision:" prefix to the title, and does not strip one
 *       the DATA carries (that is a producer defect, reported, not hidden).
 *
 * CLAIM TYPE: rendered text and DOM placement in jsdom. Not pixels, not layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// The popover renders its children unconditionally, so what it CARRIES can be
// read without driving the hover timers. Its wrapper test id is what "off the
// resting card" is measured against.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

import { useGuidanceStore } from '../../stores/guidanceStore'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { DecisionNode, composeOptionCountLine } from '../DecisionNode'
import { canvasCopyIsHonest } from './__helpers__/canvasCopyHonesty'

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'opt-keep', type: 'option', data: { type: 'option', label: 'Keep price at £49' } },
  { id: 'opt-raise', type: 'option', data: { type: 'option', label: 'Raise price to £59' } },
  { id: 'opt-release', type: 'option', data: { type: 'option', label: 'Release first, then £59' } },
]
const optionEdges = optionNodes.map(o => ({ id: `e-${o.id}`, source: DECISION_ID, target: o.id, data: {} }))
const factor = (id: string, label: string) => ({
  id, type: 'factor', data: { type: 'factor', label, observedState: { value: 1, extractionType: 'stated' } },
})
const FACTORS = [
  factor('f-conv', 'Trial conversion'),
  factor('f-price', 'Monthly price'),
  factor('f-adopt', 'Feature adoption'),
]

/** A run that ranks the three factors, `first` clearly ahead of the others. */
const rankedReport = (first: string, second: string, third: string, extra: Record<string, unknown> = {}) => ({
  factor_sensitivity: [
    { factor_id: first, label: `report label for ${first}`, influence_score: 1.0, elasticity: 3.6 },
    { factor_id: second, label: `report label for ${second}`, influence_score: 0.6, elasticity: 2.1 },
    { factor_id: third, label: `report label for ${third}`, influence_score: 0.2, elasticity: 0.7 },
  ],
  ...extra,
})

const WITHHELD_WARNING = { code: 'CONSTRAINT_TARGET_UNRELIABLE', severity: 'warning', message: 'x' }
const WITHHELD_TITLE = "A success target on your model can't be evaluated reliably."
/** No remedy since 26 Sep (AI Quality, #70 5843266323: the wire cannot tell a missing value from an uncheckable target, and on Paul's churn limit PLoT said a value "would not change that"). The card says the title alone. */
const OLD_REMEDY = 'Set a current value'

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes, ...FACTORS],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 0.5,
    goalConstraints: [],
    viewMode: 'standard',
    lodRung: 'full',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const completedRun = (report: unknown, overrides: Record<string, unknown> = {}) =>
  setStore({ results: { status: 'complete', report }, ...overrides })

const setCurrency = (semantic: 'current' | 'changed' | 'none') => {
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(semantic === 'current')
}

const renderDecision = (label = 'How should Pro pricing evolve?') =>
  render(
    <ReactFlowProvider>
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
          selected: false, isConnectable: true,
          positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
          data: { label, type: 'decision' },
        } as any)}
      />
    </ReactFlowProvider>,
  )

const ROW = 'decision-node-resting-state'
const SEP = 'decision-row-meta-separator'
const EVIDENCE = 'decision-evidence-priority'
const row = () => screen.getByTestId(ROW)
const rowSequence = () =>
  Array.from(row().children).map(c => c.getAttribute('data-testid') ?? (c.textContent ?? '').trim())
/** Everything a sighted reader sees on the card at rest: the page minus the popover and sr-only copies. */
const restingCardText = (): string => {
  const c = document.body.cloneNode(true) as HTMLElement
  c.querySelectorAll('[data-testid="decision-node-popover"], .sr-only').forEach(n => n.remove())
  return c.textContent ?? ''
}
const popover = () => screen.getByTestId('decision-node-popover')

beforeEach(() => {
  setStore()
  setCurrency('current')
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('(a) the count speaks the contract noun — "N alternatives"', () => {
  it('three linked options read "3 alternatives" on the card', () => {
    renderDecision()
    expect(screen.getByTestId('decision-node-option-count').textContent).toBe('3 alternatives')
  })

  it('CONTRAST — one option is singular, and zero is still not a count', () => {
    expect(composeOptionCountLine(1)).toBe('1 alternative')
    expect(composeOptionCountLine(2)).toBe('2 alternatives')
    expect(composeOptionCountLine(0)).toBeNull()
  })
})

describe('(b) "Evidence priority: <factor>" only when the current run ranks a canvas factor first', () => {
  it('names the factor the run ranks first, bound by its node id, after the count', () => {
    completedRun(rankedReport('f-conv', 'f-price', 'f-adopt'))
    renderDecision()
    expect(rowSequence()).toEqual(['decision-node-option-count', SEP, EVIDENCE])
    const ep = screen.getByTestId(EVIDENCE)
    expect(ep.getAttribute('data-factor-id')).toBe('f-conv')
    expect(ep.textContent).toBe('Evidence priority: Trial conversion')
    // The canvas label, never the report's own label for the row.
    expect(restingCardText()).not.toContain('report label for')
    // The card-copy honesty guard the resting row answers to covers the new segment too.
    expect(canvasCopyIsHonest(row().textContent ?? '')).toBe(true)
  })

  it('DISCRIMINATION — a different leader in the run names a different factor', () => {
    completedRun(rankedReport('f-price', 'f-conv', 'f-adopt'))
    renderDecision()
    const ep = screen.getByTestId(EVIDENCE)
    expect(ep.getAttribute('data-factor-id')).toBe('f-price')
    expect(ep.textContent).toBe('Evidence priority: Monthly price')
  })

  it('CONTRAST — before any run there is no second segment at all', () => {
    renderDecision()
    expect(screen.queryByTestId(EVIDENCE)).toBeNull()
    expect(rowSequence()).toEqual(['decision-node-option-count'])
    expect(restingCardText()).not.toMatch(/Evidence priority/)
  })

  it('CONTRAST — a run that is no longer current states no priority', () => {
    setCurrency('changed')
    completedRun(rankedReport('f-conv', 'f-price', 'f-adopt'))
    renderDecision()
    expect(screen.queryByTestId(EVIDENCE)).toBeNull()
    expect(restingCardText()).not.toMatch(/Evidence priority/)
  })

  it('CONTRAST — the run ranks first a factor this canvas does not hold: nothing, not the report label', () => {
    completedRun(rankedReport('f-ghost', 'f-conv', 'f-price'))
    renderDecision()
    expect(screen.queryByTestId(EVIDENCE)).toBeNull()
    expect(restingCardText()).not.toMatch(/Evidence priority|report label for f-ghost/)
  })

  it('CONTRAST — a tie at the top is no leader, so no priority is named', () => {
    completedRun({
      factor_sensitivity: [
        { factor_id: 'f-conv', influence_score: 0.8, elasticity: 2.0 },
        { factor_id: 'f-price', influence_score: 0.8, elasticity: 2.0 },
        { factor_id: 'f-adopt', influence_score: 0.2, elasticity: 0.7 },
      ],
    })
    renderDecision()
    expect(screen.queryByTestId(EVIDENCE)).toBeNull()
  })

  it('CONTRAST — the ranked factor has no label on the canvas: the segment is omitted, never filled in', () => {
    completedRun(rankedReport('f-conv', 'f-price', 'f-adopt'), {
      nodes: [decisionNode, ...optionNodes, { ...FACTORS[0], data: { ...FACTORS[0].data, label: '  ' } }, FACTORS[1], FACTORS[2]],
    })
    renderDecision()
    expect(screen.queryByTestId(EVIDENCE)).toBeNull()
  })
})

describe('(c) the long sentence is off the resting card, whole where it moved', () => {
  const LONG = 'Monthly recurring revenue from annual Pro plan upgrades in the first year'

  it('before a run: the top gap is not on the row; the popover states it whole', () => {
    expect(LONG.length).toBeGreaterThan(40) // the old clamp's measure — precondition
    setStore({
      nodes: [decisionNode, ...optionNodes, { id: 'f-long', type: 'factor', data: { type: 'factor', label: LONG } }],
    })
    renderDecision()
    expect(rowSequence()).toEqual(['decision-node-option-count'])
    expect(restingCardText()).not.toMatch(/Top gap/)
    const gap = within(popover()).getByTestId('decision-node-top-gap')
    expect(gap.textContent).toBe(`Top gap: estimate ${LONG}`)
    expect(gap.textContent).not.toContain('…')
  })

  it('after a run: the withheld-leader disclosure is not on the row; the popover states title and suggestion whole', () => {
    completedRun({ inference_warnings: [WITHHELD_WARNING] })
    renderDecision()
    expect(within(row()).queryByTestId('decision-leader-withheld')).toBeNull()
    expect(restingCardText()).not.toContain(WITHHELD_TITLE)
    const disclosure = within(popover()).getByTestId('decision-leader-withheld')
    expect(disclosure.getAttribute('data-withheld-code')).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    expect(disclosure.textContent).toBe(WITHHELD_TITLE)
    expect(disclosure.textContent, 'the inert remedy is gone').not.toContain(OLD_REMEDY)
  })

  it('after a run, Detailed: no popover, so the disclosure is a whole line in the body — still not in the row', () => {
    completedRun({ inference_warnings: [WITHHELD_WARNING] }, { viewMode: 'expert' })
    renderDecision()
    expect(screen.queryByTestId('decision-node-popover')).toBeNull()
    expect(within(row()).queryByTestId('decision-leader-withheld')).toBeNull()
    const disclosure = screen.getByTestId('decision-leader-withheld')
    expect(disclosure.textContent).toBe(WITHHELD_TITLE)
    expect((disclosure.getAttribute('class') ?? '').split(/\s+/)).not.toContain('line-clamp-1')
  })

  it('a screen reader still reaches the full sentence from the card itself', () => {
    completedRun({ inference_warnings: [WITHHELD_WARNING] })
    renderDecision()
    const sr = screen.getByTestId('decision-focus-signal-sr')
    expect(sr.closest('[data-testid="decision-node-popover"]')).toBeNull()
    expect((sr.getAttribute('class') ?? '').split(/\s+/)).toContain('sr-only')
    expect(sr.textContent).toBe(WITHHELD_TITLE)
  })

  it('CONTRAST — the evidence priority and the withheld disclosure coexist: one on the row, one in the popover', () => {
    completedRun(rankedReport('f-conv', 'f-price', 'f-adopt', { inference_warnings: [WITHHELD_WARNING] }))
    renderDecision()
    expect(rowSequence()).toEqual(['decision-node-option-count', SEP, EVIDENCE])
    expect(within(popover()).getByTestId('decision-leader-withheld').textContent).toContain(WITHHELD_TITLE)
  })
})

describe('(d) the title is the data label, verbatim', () => {
  it('the UI adds no kind prefix to a question label', () => {
    renderDecision('Productivity increase')
    expect(restingCardText()).toContain('Productivity increase')
    expect(restingCardText()).not.toMatch(/Decision:/)
  })

  it('CONTRAST — a prefix the DATA carries is shown as carried (a producer defect is not hidden by the UI)', () => {
    renderDecision('Decision: Productivity increase')
    expect(restingCardText()).toContain('Decision: Productivity increase')
  })
})

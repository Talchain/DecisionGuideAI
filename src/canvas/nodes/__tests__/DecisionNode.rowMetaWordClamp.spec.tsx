/**
 * The Question card's ONE focus signal is clamped to one line at a WORD
 * boundary, never mid-word (canvas polish #4, Paul's staging screenshot
 * 24 Sep: "3 options  A success target on your model can't be eval…").
 *
 * THE DEFECT. The clamp was Tailwind `truncate` — `white-space: nowrap` +
 * `text-overflow: ellipsis`. CSS Overflow 3 makes that ellipsis
 * CHARACTER-granular: the line never wraps, so the UA hides whatever
 * characters overflow, wherever they fall — "can't be eval…".
 *
 * THE FIX. `line-clamp-1` on a wrapping run: the line box breaks at a soft
 * wrap opportunity (a word boundary) and only the first line is shown, with
 * the ellipsis after it. Still ONE line (ED 02:31Z: "clamped to one line"; the
 * common polish rule: no card taller at any rung), and the full sentence stays
 * recoverable by the shared tooltip and the `.sr-only` copy exactly as before.
 *
 * BOUND BY IDENTITY: the signal's test id AND its producer code
 * (`data-withheld-code`), the WHOLE visible sentence (exact string), and class
 * TOKENS split on whitespace (never a substring of the class attribute).
 *
 * CLAIM SCOPE: jsdom proves the class tokens and the text — never layout. That
 * the browser breaks at a word is CSS behaviour of `-webkit-line-clamp` on a
 * wrapping block, not something this file can observe.
 *
 * ⭐⭐ SUPERSEDED BY THE PROTOTYPE (Paul, 25 Sep 2026, from live screenshots).
 * The word-boundary clamp shipped and the served card still read "3 options ·
 * A success target on your model can't be…": a clamp of ANY granularity cuts
 * a sentence that does not fit. The prototype row carries no sentence
 * ("3 alternatives · Evidence priority: conversion"), so the sentence is OFF
 * the face and WHOLE where it went — the popover in Standard, the body in
 * Detailed after a run — with a card-side `.sr-only` copy for screen readers.
 * This file now pins that: same identities (test id + producer code), whole
 * text, and NO clamp token anywhere on the sentence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

import { useGuidanceStore } from '../../stores/guidanceStore'
import { DecisionNode } from '../DecisionNode'

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [1, 2, 3].map(n => ({
  id: `option-${n}`, type: 'option', data: { type: 'option', label: `Option ${n}` },
}))
const optionEdges = optionNodes.map(o => ({ id: `e-${o.id}`, source: DECISION_ID, target: o.id, data: {} }))

/** Paul's served model: CEE withheld the leader on CONSTRAINT_TARGET_UNRELIABLE
 *  with no resolvable node, so the card shows the ANONYMOUS title. */
const WITHHELD_TITLE = "A success target on your model can't be evaluated reliably."
/** No remedy since 26 Sep (AI Quality, #70 5843266323: the wire cannot tell a missing value from an uncheckable target, and on Paul's churn limit PLoT said a value "would not change that"). The card says the title alone. */
const OLD_REMEDY = 'Set a current value'

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'standard',
    lodRung: 'full',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode
        {...({
          id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
          selected: false, isConnectable: true,
          positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
          data: { label: 'How should we price the Pro plan?', type: 'decision' },
        } as any)}
      />
    </ReactFlowProvider>,
  )

const tokens = (el: Element): string[] => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const row = () => screen.getByTestId('decision-node-resting-state')
const popover = () => screen.getByTestId('decision-node-popover')
/** The sentence is never clamped or cut, by class or by text. */
const expectWhole = (el: Element, sentence: string) => {
  expect(el.textContent).toBe(sentence)
  expect(el.textContent).not.toContain('\u2026')
  for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
    const t = tokens(node)
    expect(t.filter(c => /^line-clamp-/.test(c))).toEqual([])
    expect(t).not.toContain('truncate')
    expect(t).not.toContain('whitespace-nowrap')
  }
}

beforeEach(() => {
  setStore()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('Question card reasoning sentence — off the row, never cut (prototype, 25 Sep)', () => {
  it("after a run: Paul's withheld-leader sentence is off the row and whole in the popover, with its producer code", () => {
    setStore({
      results: {
        status: 'complete',
        report: { inference_warnings: [{ code: 'CONSTRAINT_TARGET_UNRELIABLE', severity: 'warning', message: 'x' }] },
      },
    })
    renderDecision()
    expect(row().textContent).not.toContain(WITHHELD_TITLE)
    const signal = popover().querySelector('[data-testid="decision-leader-withheld"]')
    expect(signal, 'the disclosure in the popover').not.toBeNull()
    expect(signal!.getAttribute('data-withheld-code')).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    expectWhole(signal!, WITHHELD_TITLE)
    expect(screen.getByTestId('decision-focus-signal-sr').textContent).toBe(WITHHELD_TITLE)
    expect(screen.getByTestId('decision-focus-signal-sr').textContent, 'the inert remedy is gone').not.toContain(OLD_REMEDY)
  })

  it('before a run: the top gap is off the row and whole in the popover', () => {
    renderDecision()
    expect(row().textContent).not.toMatch(/Top gap/)
    const gap = popover().querySelector('[data-testid="decision-node-top-gap"]')
    expect(gap, 'the top gap in the popover').not.toBeNull()
    expectWhole(gap!, 'Top gap: set a success target')
  })

  it('CONTRAST: the count stays on the row, whole and unclamped', () => {
    renderDecision()
    const count = screen.getByTestId('decision-node-option-count')
    expect(count.closest('[data-testid="decision-node-resting-state"]')).not.toBeNull()
    expect(count.textContent).toBe('3 alternatives')
    expect(tokens(count)).not.toContain('line-clamp-1')
    expect(tokens(count)).toContain('shrink-0')
  })
})

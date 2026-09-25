/**
 * Canvas visual contract v3.1 — the QUESTION anchor's row and rail (wave 3
 * "anchors": T04/ANC-03, FRAME-10/ANC-13, ANC-09, ANC-12, T14).
 *
 *   T04 /     the row under the question is `.node .row-meta`: 11px, muted, ONE
 *   ANC-03    run joined by " · " ("3 alternatives · Evidence priority:
 *             conversion"). Served, the count used the 14px VALUE token in body
 *             ink, so the card read "Question / 3 options" as two headings, and
 *             the items were separated by whitespace only.
 *   FRAME-10/ title → row is the wide card's 7px (header 4 + 3), and the gap
 *   ANC-13    between items counter-scales, never wider than the 8px it replaced.
 *   ANC-09    rail icons are muted at rest (`.icon-btn`); only attention is Info
 *             at rest — so the Play ("Run the analysis now") icon is muted.
 *   ANC-12    "Name it" gets the goal route's link treatment and hit slop.
 *   T14       the popover headings used `text-text-heading`, which is not a
 *             token (no rule generated); they now use `text-text-header`.
 *
 * Bound by IDENTITY (test ids, exact class TOKENS split on whitespace) and by
 * DOM ORDER for the separators.
 *
 * CLAIM SCOPE: jsdom proves classes, text and order — never layout or colour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
import { DecisionNode, DECISION_RESTING_COPY, READINESS_SEPARATOR } from '../DecisionNode'
import { typography } from '../../../styles/typography'

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]
const missingFactor = {
  id: 'f-missing', type: 'factor', data: { type: 'factor', label: 'Hiring cost' },
}

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

const renderDecision = (label = 'Should we hire?') =>
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

const tokens = (el: Element | null): string[] => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const row = () => screen.getByTestId('decision-node-resting-state')
/** The row's direct children, as test ids / text, in DOM order. */
const rowSequence = () =>
  Array.from(row().children).map(c => c.getAttribute('data-testid') ?? (c.textContent ?? '').trim())

const SEP = 'decision-row-meta-separator'
const EDGE_LABEL = typography.edgeLabel.split(/\s+/)
const NODE_VALUE_ONLY = typography.nodeValue.split(/\s+/).filter(t => !EDGE_LABEL.includes(t))

beforeEach(() => {
  setStore()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('T04 / ANC-03 — the question row is one muted row-meta run', () => {
  it('the option count is row-meta (edgeLabel, text-light), not the value token in body ink', () => {
    renderDecision()
    const count = screen.getByTestId('decision-node-option-count')
    expect(count.textContent).toBe('2 options')
    const t = tokens(count)
    for (const cls of EDGE_LABEL) expect(t).toContain(cls)
    expect(t).toContain('text-text-light')
    expect(t).not.toContain('text-text-body')
    // POSITIVE CONTROL for the discriminator: the value token has classes the
    // label token lacks, and none of them survive on the count.
    expect(NODE_VALUE_ONLY.length).toBeGreaterThan(0)
    for (const cls of NODE_VALUE_ONLY) expect(t).not.toContain(cls)
  })

  it('count · focus signal: one separator, BETWEEN them, and the signal is muted too', () => {
    setStore({ nodes: [decisionNode, ...optionNodes, missingFactor] })
    renderDecision()
    expect(rowSequence()).toEqual(['decision-node-option-count', SEP, 'decision-node-top-gap'])
    const sep = screen.getByTestId(SEP)
    expect(sep.textContent).toBe(READINESS_SEPARATOR.trim())
    expect(sep.getAttribute('aria-hidden')).toBe('true')
    expect(tokens(sep)).toContain('text-text-light')
    const signal = tokens(screen.getByTestId('decision-node-top-gap'))
    expect(signal).toContain('text-text-light')
    expect(signal).not.toContain('text-text-body')
  })

  it('no separator when the count stands alone (nothing to join)', () => {
    // A reasonably complete model: a stated target and three options, so the
    // triage has no top gap and the row carries the count alone.
    const third = { id: 'option-3', type: 'option', data: { type: 'option', label: 'Hire one' } }
    setStore({
      goalThreshold: 0.5,
      nodes: [decisionNode, ...optionNodes, third],
      edges: [...optionEdges, { id: 'e3', source: DECISION_ID, target: 'option-3', data: {} }],
    })
    renderDecision()
    expect(rowSequence()).toEqual(['decision-node-option-count'])
    expect(screen.queryByTestId(SEP)).toBeNull()
  })

  it('unnamed: count · "Not named yet" · "Name it" — a separator before the CTA as well', () => {
    renderDecision('')
    expect(rowSequence()).toEqual([
      'decision-node-option-count',
      SEP,
      DECISION_RESTING_COPY.unnamedLine,
      SEP,
      'decision-node-resting-cta',
    ])
  })

  it('no options: "No options linked yet" · "Add options", with no count and one separator', () => {
    setStore({ nodes: [decisionNode], edges: [] })
    renderDecision()
    expect(rowSequence()).toEqual([DECISION_RESTING_COPY.noOptionsLine, SEP, 'decision-node-resting-cta'])
  })
})

describe('FRAME-10 / ANC-13 — row geometry', () => {
  it('7px title gap (header 4 + 3) and a counter-scaled 4px item gap', () => {
    renderDecision()
    const t = tokens(row())
    expect(t).toContain('mt-[3px]')
    expect(t).not.toContain('mt-1')
    expect(t).toContain('gap-x-[calc(4px*var(--canvas-label-scale,1))]')
    expect(t).not.toContain('gap-x-2')
    expect(t).toContain('items-baseline')
  })
})

describe('ANC-12 — "Name it" link treatment and hit slop', () => {
  it('underlined from-font at offset 2, with a 5px ::before slop on a positioned button', () => {
    renderDecision('')
    const cta = screen.getByTestId('decision-node-resting-cta')
    expect(cta.textContent).toBe(DECISION_RESTING_COPY.unnamedCta)
    const t = tokens(cta)
    for (const cls of ['relative', 'underline', 'decoration-from-font', 'underline-offset-2', 'before:absolute', 'before:-inset-[5px]', "before:content-['']", 'text-info']) {
      expect(t).toContain(cls)
    }
  })
})

describe('ANC-09 — SUPERSEDED 24 Sep 2026 (DESIGN-GAP-AUDIT row 5(b)): the rail carries no run icon at all', () => {
  // ANC-09 governed the Play icon's RESTING tone (muted, not Info) while it
  // still rendered. `DecisionNode.railHasNoRunAction.spec.tsx` now owns the
  // removal itself; this block is kept, updated rather than deleted, as the
  // regression pin for the exact ready-state fixture ANC-09 used to render
  // the icon in — running lives in the panel's Analyse button.
  it('no `decision-run-analysis-<id>` renders, even in the state that used to be ANC-09’s positive case', () => {
    setStore({ goalThreshold: 0.5 })
    renderDecision()
    expect(screen.queryByTestId(`decision-run-analysis-${DECISION_ID}`)).toBeNull()
  })
})

describe('T14 — popover headings use a real token', () => {
  it('"Model readiness" renders text-text-header (the undefined text-text-heading is gone)', () => {
    renderDecision()
    const popover = screen.getByTestId('decision-node-popover')
    const heading = within(popover).getByText('Model readiness')
    expect(tokens(heading)).toContain('text-text-header')
    expect(tokens(heading)).not.toContain('text-text-heading')
  })

  it('grammar: no heading in the component uses the undefined token', () => {
    const src = readFileSync(join(__dirname, '..', 'DecisionNode.tsx'), 'utf8')
    expect(src.split('text-text-heading').length - 1).toBe(0)
    // Contrast: the replacement is present at all three heading sites.
    expect(src.split('font-medium text-text-header').length - 1).toBe(3)
  })
})

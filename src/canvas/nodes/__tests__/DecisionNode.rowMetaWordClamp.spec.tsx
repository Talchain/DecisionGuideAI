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
const WITHHELD_SUGGESTION = 'Set a current value or range on the part of your model this target applies to.'

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
const visible = (el: Element) => el.querySelector('[aria-hidden="true"]')?.textContent ?? ''

/** The clamp contract every focus signal must meet. */
const expectWordBoundaryOneLineClamp = (signal: Element) => {
  // The clamp belongs on the span that PAINTS the text. On the wrapper, the
  // inline text span's own box kept the hidden second line, which the hover
  // action row then "covered" (Canvas Browser Gate, 24 Sep, dec_cdp).
  const painted = signal.querySelector('[aria-hidden="true"]')
  expect(painted, 'the visible text span').not.toBeNull()
  expect(tokens(signal).filter(c => /^line-clamp-/.test(c)), 'the wrapper carries no clamp').toEqual([])
  expect(tokens(signal)).toContain('overflow-hidden')
  expect(tokens(signal)).toContain('min-w-0')
  expect(tokens(signal)).toContain('flex-1')
  const el = painted as Element
  const t = tokens(el)
  // `.block` is emitted after `.line-clamp-1` and would override its
  // `display: -webkit-box`, silently un-clamping the line.
  expect(t).not.toContain('block')
  // ONE line — never two (the card may not grow)…
  expect(t).toContain('line-clamp-1')
  expect(t.filter(c => /^line-clamp-/.test(c))).toEqual(['line-clamp-1'])
  // …and it WRAPS, so the clamped line ends at a word: no nowrap, no
  // character-granular `text-overflow: ellipsis`.
  expect(t).not.toContain('truncate')
  expect(t).not.toContain('whitespace-nowrap')
  expect(t).not.toContain('text-ellipsis')
}

beforeEach(() => {
  setStore()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as any)
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as any)
})

describe('Question card focus signal — one line, broken at a WORD (polish #4)', () => {
  it("after a run: Paul's withheld-leader sentence is whole on the face, clamped at a word, fully recoverable", () => {
    setStore({
      results: {
        status: 'complete',
        report: { inference_warnings: [{ code: 'CONSTRAINT_TARGET_UNRELIABLE', severity: 'warning', message: 'x' }] },
      },
    })
    renderDecision()
    const signal = screen.getByTestId('decision-leader-withheld')
    expect(signal.getAttribute('data-withheld-code')).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    // The face carries the WHOLE title — the only cut is the CSS clamp.
    expect(visible(signal)).toBe(WITHHELD_TITLE)
    // Full-text recovery for AT (and the same sentence is the tooltip content).
    expect(signal.querySelector('.sr-only')?.textContent).toBe(`${WITHHELD_TITLE} ${WITHHELD_SUGGESTION}`)
    expect(signal.getAttribute('tabindex')).toBe('0')
    expectWordBoundaryOneLineClamp(signal)
  })

  it('before a run: the top gap uses the same word-boundary one-line clamp', () => {
    renderDecision()
    const gap = screen.getByTestId('decision-node-top-gap')
    expect(visible(gap)).toBe('Top gap: set a success target')
    expectWordBoundaryOneLineClamp(gap)
  })

  it('CONTRAST: the option count beside it stays unclamped and whole (the discriminator is the signal, not the row)', () => {
    renderDecision()
    const count = screen.getByTestId('decision-node-option-count')
    expect(count.textContent).toBe('3 options')
    expect(tokens(count)).not.toContain('line-clamp-1')
    expect(tokens(count)).toContain('shrink-0')
  })
})

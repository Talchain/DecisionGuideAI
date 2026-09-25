/**
 * ⭐ RESTING ANATOMY — THE OPTION CARD IS TITLE + ITS CHANGE ROWS, AT EVERY RUNG
 * (Standard view).
 *
 * ⛔ SUPERSEDED BY PAUL, 25 Sep 2026: this file used to pin Experience Design's
 * bounded anatomy (#63 5809278282, "title + ONE primary line … the fuller S3
 * detail — change rows … — can move to the popover"). Paul ruled from live
 * screenshots that the canvas must match the PROTOTYPE, whose option card shows
 * one ROW per concrete change at rest, and that where ED's one-line body
 * conflicts with the prototype, THE PROTOTYPE WINS. The file keeps its name (so
 * its history stays one `git log` away) and every pin that still holds:
 *
 *   · the card's rows follow the ONE shared change order, value never cut, the
 *     factor label the only part allowed to ellipsize (CSS, with its title);
 *   · the rows and `+N more` are ON THE CARD in both phases, never repeated in
 *     the popover; post-run the share line is ADDED below them;
 *   · the computed differentiator's full sentence stays in the popover;
 *   · the card body is byte-identical at the Normal and landing rungs (height
 *     safety: no rung-triggered re-layout — ED's rule, which the prototype does
 *     not contradict);
 *   · Detailed view keeps its inline rows.
 *
 * The prototype-specific pins (three rows, the factor card's "from", the
 * option's own description line, the baseline's reference line) live in
 * `OptionNode.prototypeChangeRows.spec.tsx`.
 *
 * `NodePopover` is replaced by a pass-through that always renders its children
 * inside `[data-testid="node-popover"]`, so "in the popover" and "on the card"
 * are two DOM regions a test can tell apart.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom — DOM text, attributes, class tokens and
 * order. No pixels: whether the rows FIT is the browser geometry gates' job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

const FACTOR_PRICE = { id: 'f-price', type: 'factor', data: { label: 'Pro plan monthly price', type: 'factor' } }
/**
 * The fixture this file has always had: `{value: 0, unit: 'count'}` and NO
 * raw_value, so the factor card's reading is the formatter's value-only guess
 * ("No developer headcount in place") — a phrase the data does not carry, so it
 * is never the row's "from" and the row reads "→ 30 engineers". (e0490565 had
 * anchored this fixture to dodge the guess; restored so the order tests below
 * also stand guard over the faithfulness rule — with the guess as a "from" the
 * row runs past `OPTION_ROW_CHANGE_BUDGET_CHARS` and the card drops to one row.)
 */
const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
}
const FACTOR_ADOPT = { id: 'f-adopt', type: 'factor', data: { label: 'Adoption friction', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Raise the Pro price', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hold the price', type: 'option' } }
const BASELINE = {
  id: 'option-b', type: 'option',
  data: {
    label: 'Status quo', type: 'option', is_baseline: true,
    interventions: { 'f-price': { value: 49, display_value: '£49' }, 'f-adopt': { value: 0.2, display_value: 'Low' } },
  },
}

/**
 * Shared change order (non-baseline coverage, then model order): f-price (2),
 * f-adopt (2), f-head (1). option-1 sets all three, so its card shows three
 * rows and no `+N more` (Paul 25 Sep: up to three rows). Its differentiator is
 * "Developer headcount is the key difference" — a `key` sentence over more than
 * one change, which ADDS even with f-head shown (NODE-ANATOMY v3.2).
 */
const CEE_READY = {
  options: [
    {
      id: 'option-1',
      interventions: {
        'f-price': { value: 79, display_value: '£79', source: 'user_specified' },
        'f-head': { value: 30, display_value: '30 engineers', source: 'cee_hypothesis' },
        'f-adopt': { value: 0.9, display_value: 'Very high', source: 'brief_extraction' },
      },
    },
    {
      id: 'option-2',
      interventions: {
        'f-price': { value: 59, display_value: '£59', source: 'cee_hypothesis' },
        'f-adopt': { value: 0.9, display_value: 'Very high' },
      },
    },
  ],
}

let winRate: number | null = null

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_PRICE, FACTOR_HEAD, FACTOR_ADOPT, OPTION_1, OPTION_2, BASELINE],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  lodRung: 'quiet',
  ...overrides,
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
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate,
    isResultsMode: useCanvasStore((state) => state.results.status) === 'complete',
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { openNodeInspector } from '../shared/openNodeInspector'

const baseProps = {
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const COMPLETE = { status: 'complete', report: {} }

const renderCard = (
  { id = 'option-1', data = {}, store = {} }: { id?: string; data?: Record<string, unknown>; store?: Record<string, unknown> } = {},
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(store) as any))
  // The card's own data is the store node's data (so `is_baseline` is the
  // explicit flag, never the "Status quo" label regex), plus any override.
  const own = (makeStoreState(store).nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === id)?.data
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={id} data={{ label: 'Option', type: 'option', ...own, ...data }} />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const popover = () => screen.getByTestId('node-popover')
/** An element with this test id that is ON THE CARD — i.e. not inside the popover. */
const onCard = (testId: string): HTMLElement | null => {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (!el) return null
  const pop = document.querySelector('[data-testid="node-popover"]')
  return pop && pop.contains(el) ? null : el
}
const inPopover = (testId: string): HTMLElement | null =>
  within(popover()).queryByTestId(testId)

/**
 * The card's BODY lines: the element children of the body wrapper the primary
 * line sits in, minus the two things `BaseNode` itself mounts there (the
 * reduced `line`-rung line and the factor-only constraint lines).
 */
const bodyLines = (anyBodyChild: HTMLElement) =>
  Array.from(anyBodyChild.parentElement!.children).filter(
    (el) => !el.matches('[data-testid="node-lod-line"], [data-testid="factor-constraint-lines"]'),
  )

describe('resting anatomy — the option card is title + its change rows (Paul 25 Sep, supersedes ED 5809278282)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    winRate = null
  })

  describe('pre-run: the rows are on the card, in the shared order', () => {
    it('renders the shared change order as rows on the card — no one-line primary change', () => {
      renderCard()
      const rows = onCard('option-change-rows-option-1')
      expect(rows, 'precondition: the rows are on the card').not.toBeNull()
      // IDENTITY: the shared order (f-price 2, f-adopt 2, f-head 1), not
      // option-1's own listing order.
      const dds = Array.from(rows!.querySelectorAll<HTMLElement>('dd[data-testid^="option-change-row-option-1-"]'))
      expect(dds.map((d) => d.dataset.testid)).toEqual([
        'option-change-row-option-1-f-price',
        'option-change-row-option-1-f-adopt',
        'option-change-row-option-1-f-head',
      ])
      expect(onCard('option-change-row-option-1-f-price')!.textContent!.startsWith('£49 → £79')).toBe(true)
      expect(onCard('option-primary-change-option-1')).toBeNull()
    })

    it('the label comes FIRST and is the only truncating part; the value and its trailing mark are never cut', () => {
      renderCard()
      const dd = onCard('option-change-row-option-1-f-price')!
      const dt = dd.previousElementSibling as HTMLElement
      const mark = onCard('option-change-row-source-option-1-f-price')!
      // Truth stays on the card: the mark is the row's own `you` (user_specified).
      expect(mark.getAttribute('data-value-source')).toBe('you')
      expect(dt.compareDocumentPosition(dd) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(dd.contains(mark)).toBe(true)
      // The label carries the factor's FULL name; CSS is what shortens it.
      expect(dt.textContent).toBe('Pro plan monthly price')
      const lt = tokens(dt)
      expect(lt.has('truncate')).toBe(true)
      expect(lt.has('min-w-0')).toBe(true)
      expect(dt.getAttribute('data-truncates')).toBe('label')
      // ⛔ The value and the mark are NEVER inside a truncating element.
      for (const protectedEl of [dd, mark]) {
        let el: HTMLElement | null = protectedEl
        while (el && el !== document.body) {
          const t = tokens(el)
          expect(t.has('truncate'), `a truncating ancestor wraps ${protectedEl.dataset.testid}`).toBe(false)
          expect(t.has('text-ellipsis')).toBe(false)
          el = el.parentElement
        }
      }
    })

    it('the whole sentence is recoverable on the row (its title) and the label on its cell (its title)', () => {
      renderCard()
      const dd = onCard('option-change-row-option-1-f-price')!
      expect(dd.getAttribute('title')).toBe(
        'Pro plan monthly price: £49 → £79. From Status quo (the baseline option). Target: set by you.',
      )
      expect((dd.previousElementSibling as HTMLElement).getAttribute('title')).toBe('Pro plan monthly price')
    })

    it('the rows render ONCE — on the card, never repeated in the popover — and no computed differentiator on the card', () => {
      renderCard()
      expect(document.querySelectorAll('[data-testid="option-change-rows-option-1"]').length).toBe(1)
      expect(inPopover('option-change-rows-option-1')).toBeNull()
      expect(onCard('option-differentiator-option-1')).toBeNull()
    })

    it('keeps the whole `from → to` at rest — the one-line body\'s "drop the from" is retired', () => {
      // f-adopt is option-3's only change. The one-line body dropped the "from"
      // here ("→ Very high"); a row has the room, so the pair stays whole.
      const option3 = { id: 'option-3', type: 'option', data: { label: 'Simplify onboarding', type: 'option' } }
      renderCard({
        id: 'option-3',
        store: {
          nodes: [FACTOR_PRICE, FACTOR_HEAD, FACTOR_ADOPT, OPTION_1, option3, BASELINE],
          ceeAnalysisReady: {
            options: [
              CEE_READY.options[0],
              { id: 'option-3', interventions: { 'f-adopt': { value: 0.9, display_value: 'Very high', source: 'cee_hypothesis' } } },
            ],
          },
        },
      })
      const dd = onCard('option-change-row-option-3-f-adopt')!
      expect(dd.textContent!.startsWith('Low → Very high')).toBe(true)
      expect(onCard('option-change-row-estimate-option-3-f-adopt')!.getAttribute('data-value-source')).toBe('olumi')
    })

    it('a value that cannot fit WRAPS, never clips (values are never cut)', () => {
      renderCard()
      const t = tokens(onCard('option-change-row-option-1-f-price'))
      expect(t.has('break-words')).toBe(true)
      expect(t.has('overflow-hidden')).toBe(false)
      expect(t.has('whitespace-nowrap')).toBe(false)
    })
  })

  describe('`+N more` and the differentiator', () => {
    it('`+N more` is ON THE CARD, under the rows, and still opens the inspector', () => {
      // A fourth target puts one change behind `+1 more`.
      const FACTOR_SEATS = { id: 'f-seats', type: 'factor', data: { label: 'Seats per account', type: 'factor' } }
      renderCard({
        store: {
          nodes: [FACTOR_PRICE, FACTOR_HEAD, FACTOR_ADOPT, FACTOR_SEATS, OPTION_1, OPTION_2, BASELINE],
          ceeAnalysisReady: {
            options: [
              {
                id: 'option-1',
                interventions: {
                  ...CEE_READY.options[0].interventions,
                  'f-seats': { value: 12, display_value: '12 seats', source: 'cee_hypothesis' },
                },
              },
              CEE_READY.options[1],
            ],
          },
        },
      })
      const more = onCard('option-change-more-option-1')
      expect(more?.textContent).toBe('+1 more')
      expect(onCard('option-change-rows-option-1')!.contains(more)).toBe(true)
      expect(more!.getAttribute('aria-label')).toMatch(/ 1 more not shown on the card\.$/)
      fireEvent.click(more!)
      expect(openNodeInspector).toHaveBeenCalledWith('option-1')
    })

    it('the popover carries the differentiator as its FULL sentence — nothing elided where it lives', () => {
      renderCard()
      expect(inPopover('option-differentiator-option-1')?.textContent).toBe('Developer headcount is the key difference')
    })
  })

  describe('post-run: the share line is ADDED below the rows', () => {
    it('the card carries the rows AND the share line, rows first', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const share = onCard('option-analysis-currency-option-1')
      const rows = onCard('option-change-rows-option-1')
      expect(share, 'precondition: the share line renders').not.toBeNull()
      expect(rows, 'the rows survive the run').not.toBeNull()
      expect(rows!.compareDocumentPosition(share!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('the popover still carries the differentiator after the run', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      expect(inPopover('option-differentiator-option-1')?.textContent).toBe('Developer headcount is the key difference')
    })
  })

  describe('the baseline', () => {
    it('pre-run it reads its meta, then — declared, with other options — the reference line', () => {
      renderCard({ id: 'option-b' })
      const meta = onCard('option-baseline-meta-option-b')
      expect(meta?.textContent).toBe('Baseline option')
      expect(bodyLines(meta!)).toEqual([meta, onCard('option-baseline-reference-option-b')])
    })

    it('post-run the baseline meta STAYS on the card, above the share line', () => {
      winRate = 0.3
      renderCard({ id: 'option-b', store: { results: COMPLETE } })
      const share = onCard('option-analysis-currency-option-b')
      const meta = onCard('option-baseline-meta-option-b')
      expect(share).not.toBeNull()
      expect(meta?.textContent).toBe('Baseline option')
      expect(meta!.compareDocumentPosition(share!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(inPopover('option-baseline-meta-option-b')).toBeNull()
    })
  })

  describe('height safety — the Normal rung adds nothing the landing rung lacks', () => {
    it('the card body is byte-identical at `full` and `quiet`', () => {
      const a = renderCard({ store: { lodRung: 'full' } })
      const atFull = onCard('option-change-rows-option-1')!
      const fullHtml = atFull.parentElement!.innerHTML
      const fullCount = bodyLines(atFull).length
      a.unmount()
      renderCard({ store: { lodRung: 'quiet' } })
      const atQuiet = onCard('option-change-rows-option-1')!
      expect(bodyLines(atQuiet).length).toBe(fullCount)
      expect(atQuiet.parentElement!.innerHTML).toBe(fullHtml)
    })
  })

  describe('Detailed view keeps its inline detail', () => {
    it('renders the rows on the card and no primary change line', () => {
      renderCard({ store: { viewMode: 'expert' } })
      expect(onCard('option-change-rows-option-1')).not.toBeNull()
      expect(onCard('option-primary-change-option-1')).toBeNull()
    })
  })
})

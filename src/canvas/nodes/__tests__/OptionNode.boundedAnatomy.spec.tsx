/**
 * ⭐ BOUNDED ANATOMY — THE OPTION CARD IS TITLE + ONE PRIMARY LINE, AT EVERY RUNG
 * (Standard view). Experience Design, #63 5809278282, 24 Sep 2026:
 *
 *   "Landing / quiet: repeated cards may reduce to title + one primary line
 *    inside the fixed fit-safe box. Option = top change pre-run or
 *    current-model share post-run … The fuller S3 reasoning detail — change
 *    rows, driver wording, turning-point explanation/findings — can move to the
 *    existing hover/focus popover and inspector rather than expanding layout
 *    geometry … Never hide provenance or staleness in tooltip-only copy."
 *
 * WHY (measured by the lead): at 1280×800 with the dock open the landing zoom
 * is the 0.5 floor, `--canvas-label-scale` 2, ~19 characters a line; the layout
 * reserves each card's height AT that bound, so every body line costs 28 flow
 * units of whole-graph height, against a ~149-unit allowance per card.
 *
 * WHAT IS PINNED, BY IDENTITY (test ids carrying the option and factor id, exact
 * text, exact class tokens — never a value predicate another element could
 * satisfy):
 *   · the card's ONE body line pre-run is the option's TOP change — the first
 *     row of the shared change order — value and source mark FIRST, the factor
 *     label last and the only part allowed to ellipsize;
 *   · post-run the share line replaces it;
 *   · the S3 detail (rows, `+N more`, differentiator) is OFF the card and IN the
 *     option's popover, pre-run AND post-run, and `+N more` still opens the
 *     inspector;
 *   · the card body is byte-identical at the Normal and landing rungs (height
 *     safety: Normal is never taller than landing).
 *
 * `NodePopover` is replaced by a pass-through that always renders its children
 * inside `[data-testid="node-popover"]`, so "in the popover" and "on the card"
 * are two DOM regions a test can tell apart. Whether the popover OPENS on hover,
 * tap and keyboard focus is `usePopoverHover`'s contract, pinned by
 * `everyNodePreviewOpensWithoutHover.spec.ts`; the real hover path is exercised
 * in `OptionNode.spec.tsx`.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom — DOM text, attributes, class tokens and
 * order. No pixels: whether the line FITS is the browser geometry gates' job.
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
 * f-adopt (2), f-head (1). option-1's top change is therefore f-price, and its
 * card shows two rows with one behind `+1 more`. Its differentiator is
 * "Developer headcount is the key difference" (f-head is option-1's alone and
 * sits behind `+1 more`, so the sentence ADDS — NODE-ANATOMY v3.2).
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

describe('bounded anatomy — the option card is title + ONE primary line (ED 5809278282)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    winRate = null
  })

  describe('pre-run: the ONE line is the top change, value and mark first', () => {
    it('renders the first row of the shared change order as the card line', () => {
      renderCard()
      const line = onCard('option-primary-change-option-1')
      expect(line, 'precondition: the primary change line is on the card').not.toBeNull()
      // IDENTITY: the shared order's first factor for option-1 (f-price), not
      // option-1's biggest or its own first-listed target.
      expect(line!.getAttribute('data-factor-id')).toBe('f-price')
      expect(onCard('option-primary-change-value-option-1')!.textContent).toBe('£49 → £79')
      expect(line!.getAttribute('data-value-form')).toBe('change')
    })

    it('the value comes FIRST, then its source mark, then the label — which is the only truncating part', () => {
      renderCard()
      const value = onCard('option-primary-change-value-option-1')!
      const mark = onCard('option-primary-change-source-option-1')!
      const label = onCard('option-primary-change-label-option-1')!
      // Truth stays on the card: the mark is the row's own `you` (user_specified).
      expect(mark.getAttribute('data-value-source')).toBe('you')
      expect(value.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(mark.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The label carries the factor's FULL name; CSS is what shortens it.
      expect(label.textContent).toBe('· Pro plan monthly price')
      const lt = tokens(label)
      expect(lt.has('truncate')).toBe(true)
      expect(lt.has('min-w-0')).toBe(true)
      expect(label.getAttribute('data-truncates')).toBe('label')
      // ⛔ The value and the mark are NEVER inside a truncating element.
      for (const protectedEl of [value, mark]) {
        let el: HTMLElement | null = protectedEl
        while (el && el !== document.body) {
          const t = tokens(el)
          expect(t.has('truncate'), `a truncating ancestor wraps ${protectedEl.dataset.testid}`).toBe(false)
          expect(t.has('text-ellipsis')).toBe(false)
          el = el.parentElement
        }
      }
    })

    it('the whole sentence is recoverable on the line: its title AND its accessible text', () => {
      renderCard()
      const line = onCard('option-primary-change-option-1')!
      const full = 'Pro plan monthly price: £49 → £79. From Status quo (the baseline option). Target: set by you.'
      expect(line.getAttribute('title')).toBe(full)
      // The line's OWN accessible text (its direct sr-only child) — the mark's
      // own sr-only label sits inside the aria-hidden visible cluster.
      const sr = Array.from(line.children).find((c) => c.classList.contains('sr-only'))
      expect(sr?.textContent).toBe(full)
      for (const visible of Array.from(line.children).filter((c) => c !== sr)) {
        expect(visible.getAttribute('aria-hidden')).toBe('true')
      }
    })

    it('is EXACTLY ONE body line — no rows, no `+N more`, no differentiator on the card', () => {
      renderCard()
      const line = onCard('option-primary-change-option-1')!
      expect(bodyLines(line)).toEqual([line])
      expect(onCard('option-change-rows-option-1')).toBeNull()
      expect(onCard('option-change-more-option-1')).toBeNull()
      expect(onCard('option-differentiator-option-1')).toBeNull()
    })

    it('drops the "from" at rest when `from → to` would not fit one line — the full pair stays in the title', () => {
      // f-adopt is option-3's only (hence top) change: "Low → Very high · est."
      // is 22 characters against the 18-character line budget; "→ Very high
      // · est." is 18.
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
      const line = onCard('option-primary-change-option-3')!
      expect(line.getAttribute('data-factor-id')).toBe('f-adopt')
      expect(line.getAttribute('data-value-form')).toBe('target')
      expect(onCard('option-primary-change-value-option-3')!.textContent).toBe('→ Very high')
      expect(onCard('option-primary-change-source-option-3')!.getAttribute('data-value-source')).toBe('olumi')
      expect(line.getAttribute('title')).toContain('Adoption friction: Low → Very high.')
    })

    it('a value that cannot fit even as its target WRAPS, never clips (values are never cut)', () => {
      renderCard()
      const value = onCard('option-primary-change-value-option-1')!
      const cluster = value.parentElement!
      const t = tokens(cluster)
      expect(t.has('break-words')).toBe(true)
      expect(t.has('overflow-hidden')).toBe(false)
      expect(t.has('whitespace-nowrap')).toBe(false)
    })
  })

  describe('the S3 detail moved INTO the popover, pre-run', () => {
    it('carries the change rows, in the contract grid, with their marks', () => {
      renderCard()
      const rows = inPopover('option-change-rows-option-1')
      expect(rows, 'the rows are in the popover').not.toBeNull()
      expect(rows!.getAttribute('data-row-layout')).toBe('grid')
      expect(inPopover('option-change-row-option-1-f-price')).not.toBeNull()
      expect(inPopover('option-change-row-option-1-f-adopt')).not.toBeNull()
      expect(inPopover('option-change-row-source-option-1-f-price')!.getAttribute('data-value-source')).toBe('you')
      expect(inPopover('option-change-row-source-option-1-f-adopt')!.getAttribute('data-value-source')).toBe('brief')
    })

    it('`+N more` is in the popover and still opens the inspector', () => {
      renderCard()
      const more = inPopover('option-change-more-option-1')
      expect(more?.textContent).toBe('+1 more')
      // Its name says what is not shown HERE — the popover — never "on the card".
      expect(more!.getAttribute('aria-label')).toMatch(/ 1 more not shown here\.$/)
      fireEvent.click(more!)
      expect(openNodeInspector).toHaveBeenCalledWith('option-1')
    })

    it('carries the differentiator as its FULL sentence — nothing elided where it lives', () => {
      renderCard()
      const diff = inPopover('option-differentiator-option-1')
      expect(diff?.textContent).toBe('Developer headcount is the key difference')
    })
  })

  describe('post-run: the share line replaces the change line', () => {
    it('the card carries the share line and no change line', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const share = onCard('option-analysis-currency-option-1')
      expect(share, 'precondition: the share line renders').not.toBeNull()
      expect(onCard('option-primary-change-option-1')).toBeNull()
      expect(onCard('option-change-rows-option-1')).toBeNull()
      expect(bodyLines(share!)).toEqual([share])
    })

    it('the popover still carries the rows, `+N more` and the differentiator after the run', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      expect(inPopover('option-change-rows-option-1')).not.toBeNull()
      expect(inPopover('option-change-more-option-1')?.textContent).toBe('+1 more')
      expect(inPopover('option-differentiator-option-1')?.textContent).toBe('Developer headcount is the key difference')
    })
  })

  describe('the baseline', () => {
    it('pre-run its one line is the baseline meta', () => {
      renderCard({ id: 'option-b' })
      const meta = onCard('option-baseline-meta-option-b')
      expect(meta?.textContent).toBe('Baseline option')
      expect(bodyLines(meta!)).toEqual([meta])
    })

    it('post-run the share line takes the card and the baseline meta moves to the popover', () => {
      winRate = 0.3
      renderCard({ id: 'option-b', store: { results: COMPLETE } })
      expect(onCard('option-analysis-currency-option-b')).not.toBeNull()
      expect(onCard('option-baseline-meta-option-b')).toBeNull()
      expect(inPopover('option-baseline-meta-option-b')?.textContent).toBe('Baseline option')
    })
  })

  describe('height safety — the Normal rung adds nothing the landing rung lacks', () => {
    it('the card body is byte-identical at `full` and `quiet`', () => {
      const a = renderCard({ store: { lodRung: 'full' } })
      const atFull = onCard('option-primary-change-option-1')!
      const fullHtml = atFull.parentElement!.innerHTML
      const fullCount = bodyLines(atFull).length
      a.unmount()
      renderCard({ store: { lodRung: 'quiet' } })
      const atQuiet = onCard('option-primary-change-option-1')!
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

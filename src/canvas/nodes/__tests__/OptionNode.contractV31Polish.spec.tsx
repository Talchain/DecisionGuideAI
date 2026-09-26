/**
 * ⭐ CONTRACT v3.1 — THE OPTION CARD'S POLISH DELTAS, PINNED BY IDENTITY.
 *
 * Source: `olumi-canvas-visual-contract-v31.html` <style> + fixture, and Paul's
 * 23 Sep points (9: "make the driver bar neutral, so it does not compete with
 * attention"; 13: bounded heights, no truncated reasoning). Each block names
 * the audited delta id it pins. Every assertion is bound to a test id, an exact
 * class token or exact text — never a value predicate another element could
 * satisfy — and each one fails on the pre-change card (`3eb22326`).
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom. These prove the CLASS TOKENS, TEXT and
 * DOM ORDER the card emits. They do not prove rendered pixels; the height
 * argument for each change is in the component's own comments.
 *
 * ⭐ RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: "The
 * fuller S3 reasoning detail — change rows … — can move to the existing
 * hover/focus popover and inspector"). In Standard view the change rows,
 * `+N more` and the differentiator render in the option's popover
 * (`option-preview-detail-<id>`), so every row-grammar pin below reads them
 * THERE, by identity; the reading-order pins (OPT-09) are asserted where the
 * inline anatomy still exists — Detailed view — and, for the popover, in the
 * popover's own order. The grammar itself is unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { typography } from '../../../styles/typography'
import { changeRow, changeRowValueText } from './__helpers__/optionChangeRowText'
import { optionCardRows, optionPreviewDetail } from './__helpers__/optionPreview'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// A pass-through popover, so the popover's detail (the differentiator) is in
// the DOM to be read BY IDENTITY (`optionPreviewDetail`), and a row that drifted
// into it is caught (`optionCardRows` refuses a block inside a popover).
// Opening it is `usePopoverHover`'s contract.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
}
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor' } }
const FACTOR_RISK = { id: 'f-risk', type: 'factor', data: { label: 'Delivery risk', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }
const BASELINE_SETS_VALUES = {
  id: 'option-b', type: 'option',
  data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: { 'f-head': { value: 0, display_value: '0 engineers' } } },
}
const BASELINE_SETS_NOTHING = {
  id: 'option-b', type: 'option',
  data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: {} },
}

const CEE_READY = {
  options: [
    { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
    { id: 'option-2', interventions: { 'f-cost': 5 } },
  ],
}

let winRate: number | null = null

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, FACTOR_RISK, OPTION_1, OPTION_2, BASELINE_SETS_VALUES],
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
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={id} data={{ label: 'Hire two developers', type: 'option', ...data }} />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`)
/** An element inside THIS option's popover detail block — bound to the popover by identity. */
const inPreview = (id: string, optionId = 'option-1') =>
  optionPreviewDetail(optionId)?.querySelector(`[data-testid="${id}"]`) ?? null
/**
 * An element inside THIS option's change-rows block ON THE CARD (Paul 25 Sep:
 * the prototype's rows at rest supersede ED 5809278282's popover placement) —
 * the block itself when `id` names it.
 */
const inRows = (id: string, optionId = 'option-1') => {
  const block = optionCardRows(optionId)
  return block.getAttribute('data-testid') === id ? block : block.querySelector<HTMLElement>(`[data-testid="${id}"]`)
}

describe('contract v3.1 — option card polish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    winRate = null
  })

  // ── OPT-01 / OPT-07 / OPT-08: the run bar is neutral, short and secondary ──
  describe('the run result row (OPT-01, OPT-07, OPT-08, OPT-06/RHY-05)', () => {
    it('fills the bar with the neutral text-light token, never the option kind colour (OPT-01)', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const row = byTestId('option-analysis-currency-option-1')
      expect(row, 'precondition: the result row renders').not.toBeNull()
      const fill = row!.querySelector('.h-full.rounded-full')
      expect(fill).not.toBeNull()
      // Identity: this is the width-carrying fill (its floor is the served `max(4px, N%)`).
      expect((fill as HTMLElement).style.width).toBe('max(4px, 42%)')
      expect(tokens(fill).has('bg-text-light')).toBe(true)
      expect(tokens(fill).has('bg-option')).toBe(false)
    })

    it('the track is the factor bar’s fixed 54px, not a flex-1 track across the card (OPT-08)', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const fill = byTestId('option-analysis-currency-option-1')!.querySelector('.h-full.rounded-full')
      const track = fill!.parentElement
      expect(tokens(track).has('w-[54px]')).toBe(true)
      expect(tokens(track).has('flex-1')).toBe(false)
      expect(tokens(track).has('bg-panel-border')).toBe(true)
    })

    it('the readout is the 11px label size, the same as its caption (OPT-07)', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const readout = byTestId('option-win-readout-option-1')
      const anchor = byTestId('option-win-anchor-option-1')
      expect(readout!.className).toContain(typography.edgeLabel)
      expect(readout!.className).not.toContain(typography.nodeLabel)
      expect(anchor!.className).toContain(typography.edgeLabel)
    })

    it('sits on the body’s one 4px rhythm with nothing trailing (OPT-06, RHY-05)', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      // The 4px top margin sits on the row's reserved slot (the no-growth fix:
      // the slot exists pre-run too, so the margin is reserved with it).
      const slot = byTestId('option-share-slot-option-1')
      expect(slot!.contains(byTestId('option-analysis-currency-option-1'))).toBe(true)
      const t = tokens(slot)
      expect(t.has('mt-1')).toBe(true)
      expect(t.has('mt-1.5')).toBe(false)
      expect(t.has('mb-1')).toBe(false)
      const row = tokens(byTestId('option-analysis-currency-option-1'))
      expect([...row].filter(c => /^m[tb]-/.test(c))).toEqual([])
    })

    it('the absence row shares the rhythm (OPT-06, RHY-05)', () => {
      winRate = null
      // A partial absence: another option resolved a share, this one did not.
      renderCard({
        store: {
          results: {
            status: 'complete',
            report: { option_probabilities: { 'option-2': { status: 'computed', win_probability: 0.6 } } },
          },
        },
      })
      const row = byTestId('option-result-unavailable-option-1') ?? byTestId('option-not-analysed-option-1')
      expect(row, 'precondition: an absence row renders').not.toBeNull()
      const t = tokens(row)
      expect(t.has('mt-1')).toBe(true)
      expect(t.has('mt-1.5')).toBe(false)
      expect(t.has('mb-1')).toBe(false)
    })
  })

  // ── OPT-09: the option's own facts first, the run below ──────────────────
  describe('reading order (OPT-09)', () => {
    it('DETAILED (the inline anatomy): the change rows precede the run result on the card', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE, viewMode: 'expert' } })
      const rows = byTestId('option-change-rows-option-1')
      const result = byTestId('option-analysis-currency-option-1')
      expect(rows, 'precondition: change rows render inline').not.toBeNull()
      expect(result, 'precondition: the result row renders').not.toBeNull()
      expect(optionPreviewDetail('option-1')?.contains(rows!) ?? false).toBe(false)
      // The defect this pins: the run's row sat BEFORE the option's own facts.
      expect(rows!.compareDocumentPosition(result!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('STANDARD: the card keeps the rows BEFORE the run result; the differentiator stays in the popover', () => {
      winRate = 0.42
      // Two changes, so "Developer headcount is the key difference" says which
      // one matters and the differentiator renders (NODE-ANATOMY v3.2: only
      // when it adds beyond the rows — never "<only row> is the key difference").
      renderCard({
        store: {
          results: COMPLETE,
          ceeAnalysisReady: {
            options: [
              { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' }, 'f-cost': 5 } },
              { id: 'option-2', interventions: { 'f-cost': 5 } },
            ],
          },
        },
      })
      const rows = inRows('option-change-rows-option-1')
      const diff = inPreview('option-differentiator-option-1')
      const result = byTestId('option-analysis-currency-option-1')
      expect(rows, 'precondition: change rows render on the card').not.toBeNull()
      expect(diff, 'precondition: the differentiator renders in the popover after the run').not.toBeNull()
      expect(result, 'precondition: the result row renders').not.toBeNull()
      // OPT-09: the option's own facts first, the run below — on the card.
      expect(rows!.compareDocumentPosition(result!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(optionPreviewDetail('option-1')!.contains(result!)).toBe(false)
      expect(optionPreviewDetail('option-1')!.contains(rows!)).toBe(false)
    })

    it('DETAILED: the baseline card states it is the baseline before the run result', () => {
      winRate = 0.3
      renderCard({ id: 'option-b', data: { label: 'Status quo', is_baseline: true }, store: { results: COMPLETE, viewMode: 'expert' } })
      const meta = byTestId('option-baseline-meta-option-b')
      const result = byTestId('option-analysis-currency-option-b')
      expect(meta).not.toBeNull()
      expect(result).not.toBeNull()
      expect(meta!.compareDocumentPosition(result!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('STANDARD, after a run: the baseline statement STAYS on the card, before the share line', () => {
      winRate = 0.3
      renderCard({ id: 'option-b', data: { label: 'Status quo', is_baseline: true }, store: { results: COMPLETE } })
      const meta = byTestId('option-baseline-meta-option-b')
      const result = byTestId('option-analysis-currency-option-b')
      expect(meta).not.toBeNull()
      expect(result).not.toBeNull()
      expect(inPreview('option-baseline-meta-option-b', 'option-b')).toBeNull()
      expect(meta!.compareDocumentPosition(result!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  // ── OPT-03: before muted, arrow + target ink ────────────────────────────
  describe('change row tones (OPT-03)', () => {
    it('the "from" value is its own muted span; the arrow and target stay in the ink cell', () => {
      renderCard()
      const dd = inRows('option-change-row-option-1-f-head')
      expect(dd, 'precondition: the from → to row renders on the card').not.toBeNull()
      const before = inRows('option-change-row-before-option-1-f-head')
      expect(before).not.toBeNull()
      expect(before!.textContent).toBe('0 engineers')
      expect(tokens(before).has('text-text-light')).toBe(true)
      expect(tokens(dd).has('text-text-body')).toBe(true)
      // The target is NOT inside the muted span — it inherits the dd's ink.
      expect(before!.textContent).not.toContain('3 engineers')
    })

    it('the split is presentation only: the value text is byte-identical', () => {
      renderCard()
      expect(changeRowValueText(inRows('option-change-row-option-1-f-head')!)).toBe('0 engineers → 3 engineers')
      expect(screen.getByText(changeRow('0 engineers → 3 engineers'))).toBeInTheDocument()
    })

    it('a target-only row is not split — it renders its change whole', () => {
      // option-2 sets f-cost, which the baseline does not: no "from" to mute.
      renderCard({ id: 'option-2', data: { label: 'Hire a tech lead' } })
      const dd = inRows('option-change-row-option-2-f-cost', 'option-2')
      expect(dd, 'precondition: the target-only row renders on the card').not.toBeNull()
      expect(byTestId('option-change-row-before-option-2-f-cost')).toBeNull()
      expect(changeRowValueText(dd!).startsWith('→ ')).toBe(true)
    })
  })

  // ── OPT-04 / OPT-05 / RHY-04 / T08 (b, c): the row grammar ──────────────
  describe('change row grammar (OPT-04, OPT-05, RHY-04, T08 b+c)', () => {
    // ⭐ CONTRACT v3.1 #9 (26 Sep, WS4) — `.delta-rows{grid-template-columns:
    // minmax(0,1fr) auto}` with `.amount{white-space:nowrap}`. Held as ONE
    // WRAPPING LINE PER ROW rather than a shared grid, because at the landing
    // counter-scale an `auto` amount track is wider than the card: the label
    // takes what the amount does not need (`flex-[1_1_8em]`), and when the two
    // cannot share a line the amount takes the next line whole.
    it('label takes what the amount does not need; the amount is one unbroken line (v3.1 #9)', () => {
      renderCard()
      const dl = inRows('option-change-rows-option-1')!.querySelector('dl')
      const t = tokens(dl)
      expect(t.has('flex')).toBe(true)
      expect(t.has('flex-col')).toBe(true)
      expect(t.has('gap-y-1')).toBe(true)
      expect(t.has('grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')).toBe(false)
      const line = tokens(inRows('option-change-row-line-option-1-f-head'))
      expect(line.has('flex-wrap')).toBe(true)
      expect(line.has('gap-x-2')).toBe(true)
      const dt = inRows('option-change-row-option-1-f-head')!.previousElementSibling!
      expect(tokens(dt).has('flex-[1_1_8em]')).toBe(true)
      // Held whole while it fits one line of the row budget at the largest
      // counter-scale; "0 engineers → 3 engineers" (21) does not, so it may break
      // BEFORE THE ARROW only — each half one unbroken run — and never runs past
      // the card's edge (served cd6a82e4, "49 GBP per month → 59 GBP per month"
      // overflowed as one no-wrap run).
      const value = inRows('option-change-row-value-option-1-f-head')!
      expect(tokens(value).has('whitespace-nowrap')).toBe(false)
      const halves = [...value.querySelectorAll('.whitespace-nowrap')].map((n) => n.textContent)
      expect(halves).toEqual(['0 engineers', '→ 3 engineers'])
    })

    it('label and amount are both the 11px label size at tight leading', () => {
      renderCard()
      const dd = inRows('option-change-row-option-1-f-head')!
      const dt = dd.previousElementSibling!
      expect(dt.tagName).toBe('DT')
      for (const cell of [dt, dd]) {
        expect(cell.className).toContain(typography.edgeLabel)
        expect(tokens(cell).has('!leading-tight')).toBe(true)
      }
      expect(dd.className).not.toContain(typography.nodeLabel)
      // v3.1 #9: the amount never exceeds the card (`max-w-full`); the LABEL is
      // the part that wraps (`min-w-0` + `break-words`).
      expect(tokens(dd).has('max-w-full')).toBe(true)
      expect(tokens(dt).has('min-w-0')).toBe(true)
      expect(tokens(dt).has('break-words')).toBe(true)
    })

    it('the rows block keeps its 4px top rhythm under the title', () => {
      renderCard()
      const t = tokens(inRows('option-change-rows-option-1'))
      expect(t.has('mt-1')).toBe(true)
      expect(t.has('mt-1.5')).toBe(false)
    })
  })

  // ── OPT-10 / RHY-04: '+N more' reads as a link ──────────────────────────
  describe("'+N more' (OPT-10, RHY-04)", () => {
    it('is an info-blue link with no resting underline, 4px under the rows', () => {
      renderCard({
        store: {
          ceeAnalysisReady: {
            options: [
              // FOUR targets: the card shows three rows (Paul 25 Sep), so one is behind `+1 more`.
              { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' }, 'f-cost': 5, 'f-risk': 2, 'f-seats': 4 } },
              { id: 'option-2', interventions: { 'f-cost': 5 } },
            ],
          },
        },
      })
      const more = inRows('option-change-more-option-1')
      expect(more, 'precondition: the overflow link renders on the card').not.toBeNull()
      expect(more!.textContent).toBe('+1 more')
      const t = tokens(more)
      expect(t.has('text-info')).toBe(true)
      expect(t.has('no-underline')).toBe(true)
      expect(t.has('hover:underline')).toBe(true)
      expect(t.has('focus-visible:underline')).toBe(true)
      expect(t.has('text-text-light')).toBe(false)
      expect(t.has('decoration-dotted')).toBe(false)
      expect(t.has('mt-1')).toBe(true)
    })
  })

  // ── OPT-12: the baseline says what it does to the comparison ────────────
  describe('baseline meta line (OPT-12)', () => {
    it('a baseline that sets nothing reads "Baseline · no changes"', () => {
      renderCard({
        id: 'option-b',
        data: { label: 'Status quo', is_baseline: true, interventions: {} },
        store: { nodes: [FACTOR_HEAD, FACTOR_COST, FACTOR_RISK, OPTION_1, OPTION_2, BASELINE_SETS_NOTHING] },
      })
      expect(byTestId('option-baseline-meta-option-b')!.textContent).toBe('Baseline · no changes')
    })

    it('a baseline that DOES set values never claims "no changes"', () => {
      renderCard({
        id: 'option-b',
        data: { label: 'Status quo', is_baseline: true, interventions: { 'f-head': { value: 0, display_value: '0 engineers' } } },
      })
      const meta = byTestId('option-baseline-meta-option-b')!
      expect(meta.textContent).toBe('Baseline option')
      expect(meta.textContent).not.toContain('no changes')
    })
  })
})

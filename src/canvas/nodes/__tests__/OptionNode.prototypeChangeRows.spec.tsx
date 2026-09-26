/**
 * ⭐ THE OPTION CARD MATCHES THE PROTOTYPE — ONE ROW PER CHANGE, AT REST.
 *
 * Paul, 25 Sep 2026, from live screenshots: the canvas must match the PROTOTYPE
 * (`olumi-canvas-connected-reference.png`, `olumi-canvas-visual-contract.html`).
 * Where Experience Design's bounded anatomy (#63 5809278282, "title + ONE primary
 * line") conflicts with the prototype's card bodies, the prototype wins.
 *
 * The prototype's option card (visual contract, `optionNode`):
 *
 *   Raise price to £59
 *   Monthly price              £49 → £59
 *   Trial conversion             8% → 7%
 *   Price changes without a feature release.
 *
 *   `.delta-rows{grid-template-columns:minmax(0,1fr) auto}` · `.label` muted ·
 *   `.amount{white-space:nowrap}` · `.before` muted · `.differentiator` muted.
 *
 * and the baseline card: "Baseline · no changes" / "Reference for the other
 * alternatives."
 *
 * LIVE BEFORE THIS (served, Paul's screenshot 25 Sep): one truncated line
 * "→ 39,000 GBP/year · est. · Annual PA s…" — value first, mark, cut label, the
 * second change invisible, and no "from" although the factor card beside it
 * reads "0 GBP/year".
 *
 * WHAT IS PINNED, BY IDENTITY (test ids carrying the option and factor id, exact
 * text, exact class tokens):
 *   · Standard view, pre-run AND post-run: up to THREE change rows on the CARD,
 *     in the shared order, then `+N more`; no primary line; the rows render once
 *     (never also in the popover);
 *   · each row: the factor's FULL name in a CSS-truncating label cell carrying
 *     its own `title`; `from → to` never inside a truncating element; the source
 *     mark trails the value;
 *   · "from" is the factor card's own reading of the factor's current value when
 *     the target carries a display string (the case the served board is in) —
 *     and ONLY a reading the data carries (raw_value with a real unit, the
 *     factor's display_value, its encoding_map phrase), never the formatter's
 *     value-only guess ("No X in place", "X active"), which leaves `→ to`;
 *   · the target stays the string CEE authored, verbatim (Paul 20 Sep, "thin
 *     layer") — only the "from" is read through the factor card's formatter;
 *   · the muted line under the rows is the option's OWN description or
 *     rationale, verbatim — never a UI sentence;
 *   · the baseline states "Reference for the other alternatives." only when it
 *     is DECLARED (`is_baseline: true`) and another option exists.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom — DOM text, attributes, class tokens and
 * order. No pixels: whether the rows FIT is the browser geometry gates' job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { factorCardVisibleText, factorDisplayParts, factorDisplayText } from '../../../utils/formatFactorDisplayValue'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

/** The pricing board's price factor, in the shape the served debug bundle carries it (5fe89207). */
const PRICE_DATA = {
  label: 'Monthly price', type: 'factor',
  observedState: { cap: 200, unit: 'GBP/month', value: 0.245, raw_value: 49, source: 'brief_extraction' },
}
const FACTOR_PRICE = { id: 'f-price', type: 'factor', data: PRICE_DATA }
/** No observed value at all — the "from" contrast. */
const FACTOR_CONV = { id: 'f-conv', type: 'factor', data: { label: 'Trial conversion', type: 'factor' } }
const FACTOR_ADOPT = { id: 'f-adopt', type: 'factor', data: { label: 'Feature adoption across active accounts', type: 'factor' } }
const FACTOR_HEAD = { id: 'f-head', type: 'factor', data: { label: 'Support headcount', type: 'factor' } }

const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Raise price to £59', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Release first, then £59', type: 'option' } }
const BASELINE = {
  id: 'option-b', type: 'option',
  data: { label: 'Keep price at £49', type: 'option', is_baseline: true, interventions: {} },
}

/**
 * Shared order (non-baseline coverage, then model order): f-price (2), f-conv
 * (2), f-adopt (1), f-head (1). option-1 sets all four, so its card shows the
 * first THREE and `+1 more`.
 *
 * The price target is in the served wire's shape: `interventions` carries the
 * model value and its source, `intervention_details` carries the producer's
 * display string (and its raw figure, which the card must NOT re-format).
 */
const CEE_READY = {
  options: [
    {
      id: 'option-1',
      interventions: {
        'f-price': { value: 0.295, source: 'brief_extraction' },
        'f-conv': { value: 0.07, display_value: '7%', source: 'cee_hypothesis' },
        'f-adopt': { value: 0.6, display_value: '60%', source: 'user_specified' },
        'f-head': { value: 0.3, display_value: '3 people', source: 'cee_hypothesis' },
      },
      intervention_details: {
        'f-price': { display_value: '£59', normalised_value: 0.295, raw_value: 59, unit: 'GBP/month' },
      },
    },
    {
      id: 'option-2',
      interventions: {
        'f-price': { value: 0.295, source: 'brief_extraction' },
        'f-conv': { value: 0.075, display_value: '7.5%', source: 'cee_hypothesis' },
      },
      intervention_details: {
        'f-price': { display_value: '59 GBP/month', normalised_value: 0.295 },
      },
    },
    { id: 'option-b', interventions: {} },
  ],
}

let winRate: number | null = null

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_PRICE, FACTOR_CONV, FACTOR_ADOPT, FACTOR_HEAD, OPTION_1, OPTION_2, BASELINE],
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

type StoreNode = { id: string; type: string; data: Record<string, unknown> }

const renderCard = (
  { id = 'option-1', store = {} }: { id?: string; store?: Record<string, unknown> } = {},
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(store) as any))
  const own = (makeStoreState(store).nodes as StoreNode[]).find((n) => n.id === id)?.data
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={id} data={{ label: 'Option', type: 'option', ...own }} />
    </ReactFlowProvider>,
  )
}

/** The store's nodes with one option's data replaced. */
const withOptionData = (id: string, data: Record<string, unknown>) =>
  (makeStoreState().nodes as StoreNode[]).map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))

const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const popover = () => screen.queryByTestId('node-popover')
/** An element with this test id that is ON THE CARD — i.e. not inside the popover. */
const onCard = (testId: string): HTMLElement | null => {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`))
  const pop = popover()
  return all.find((el) => !(pop && pop.contains(el))) ?? null
}
const countAll = (testId: string) => document.querySelectorAll(`[data-testid="${testId}"]`).length
const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('the option card is the prototype: one row per change, at rest (Paul 25 Sep)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    winRate = null
  })

  describe('pre-run, Standard view', () => {
    it('renders up to THREE change rows ON THE CARD, in the shared order, then `+N more`', () => {
      renderCard()
      const rows = onCard('option-change-rows-option-1')
      expect(rows, 'the change rows are on the card').not.toBeNull()
      const rendered = Array.from(rows!.querySelectorAll<HTMLElement>('dd[data-testid^="option-change-row-option-1-"]'))
        .map((dd) => dd.dataset.testid)
      expect(rendered).toEqual([
        'option-change-row-option-1-f-price',
        'option-change-row-option-1-f-conv',
        'option-change-row-option-1-f-adopt',
      ])
      expect(onCard('option-change-more-option-1')?.textContent).toBe('+1 more')
    })

    it('replaces the one-line primary change: no primary line, and the rows render exactly once', () => {
      renderCard()
      expect(onCard('option-primary-change-option-1')).toBeNull()
      expect(countAll('option-change-rows-option-1')).toBe(1)
      const pop = popover()
      if (pop) expect(within(pop).queryByTestId('option-change-rows-option-1')).toBeNull()
    })

    it('each label is the FULL factor name, never cut — it wraps (contract v3.1 #9; was a CSS-truncating cell)', () => {
      renderCard()
      const dd = onCard('option-change-row-option-1-f-adopt')!
      const dt = dd.previousElementSibling as HTMLElement
      expect(dt.tagName).toBe('DT')
      expect(dt.textContent).toBe('Feature adoption across active accounts')
      // Whole on the card, so no title to recover it from (and no native tooltip, #36).
      expect(dt.getAttribute('title')).toBeNull()
      expect(dt.getAttribute('data-truncates')).toBeNull()
      const t = tokens(dt)
      expect(t.has('truncate')).toBe(false)
      expect(t.has('break-words')).toBe(true)
      expect(t.has('min-w-0')).toBe(true)
    })

    it('`from → to` is never inside a truncating element, and the source mark TRAILS the value', () => {
      renderCard()
      const dd = onCard('option-change-row-option-1-f-conv')!
      const mark = onCard('option-change-row-estimate-option-1-f-conv')!
      expect(dd.contains(mark)).toBe(true)
      expect(dd.textContent!.startsWith('→ 7%')).toBe(true)
      let el: HTMLElement | null = dd
      while (el && el !== document.body) {
        const t = tokens(el)
        for (const cut of ['truncate', 'text-ellipsis', 'line-clamp-1', 'line-clamp-2']) {
          expect(t.has(cut), `a truncating ancestor (${cut}) wraps the value`).toBe(false)
        }
        el = el.parentElement
      }
      // The label is BEFORE the value, the mark AFTER it — never between them.
      const dt = dd.previousElementSibling as HTMLElement
      expect(follows(dt, dd)).toBe(true)
    })
  })

  describe('"from" is the factor card\'s own reading of the current value', () => {
    it('forms `from → to` when the target carries a display string and the factor carries a value', () => {
      renderCard({ id: 'option-2' })
      const dd = onCard('option-change-row-option-2-f-price')!
      const factorCardReading = factorCardVisibleText(factorDisplayText(PRICE_DATA), factorDisplayParts(PRICE_DATA))
      expect(factorCardReading, 'precondition: the factor card has a reading').toBe('£49/month')
      // IDENTITY: the muted "before" IS the factor card's VISIBLE text, not a re-formatting.
      expect(onCard('option-change-row-before-option-2-f-price')?.textContent).toBe(factorCardReading)
      // The "to" is CEE's own display_value, verbatim (thin layer) — the UI does
      // not re-spell producer text. Producer ask D8 (#69): send "£59/month".
      expect(dd.textContent!.startsWith(`${factorCardReading} → 59 GBP/month`)).toBe(true)
    })

    it('contrast: a factor with no value states the target alone — nothing is filled in', () => {
      renderCard({ id: 'option-2' })
      expect(onCard('option-change-row-before-option-2-f-conv')).toBeNull()
      expect(onCard('option-change-row-option-2-f-conv')!.textContent!.startsWith('→ 7.5%')).toBe(true)
    })

    it('the TARGET stays the string CEE authored, verbatim, beside the factor card\'s "from" (Paul 20 Sep: thin layer)', () => {
      renderCard()
      const dd = onCard('option-change-row-option-1-f-price')!
      // "£59" is CEE's own string. Its raw 59 is NOT re-read through the factor
      // card's formatter into "59 GBP/month" — that would be a UI-substituted value.
      expect(dd.textContent!.startsWith(`${factorCardVisibleText(factorDisplayText(PRICE_DATA), factorDisplayParts(PRICE_DATA))} → £59`)).toBe(true)
      expect(dd.textContent).not.toContain('59 GBP/month')
    })
  })

  /**
   * ⛔ A "FROM" IS ONLY A READING THE DATA CARRIES (verifier FIX_NEEDED on
   * e0490565; Paul 25 Sep: "from" only "when the data carries it", otherwise
   * "→ to" only). The factor card's formatter also produces GUESSES from a bare
   * model value — "No <label> in place" for 0, "<Label> active" for 1
   * (`formatFactorDisplayValue`'s value-only branch). Those phrases are not in
   * the data, so they never become a row's "from".
   *
   * Every case renders option-1's f-price row (CEE's target "£59") with ONLY
   * the factor's data changed, so each guess and its carried contrast differ in
   * exactly the field under test.
   */
  describe('a "from" is only a reading the data CARRIES — never the formatter\'s guess', () => {
    const PRICE_ROW = 'option-change-row-option-1-f-price'
    const PRICE_BEFORE = 'option-change-row-before-option-1-f-price'
    const withPriceFactor = (data: Record<string, unknown>) =>
      (makeStoreState().nodes as StoreNode[]).map((n) =>
        (n.id === 'f-price' ? { ...n, data: { label: 'Monthly price', type: 'factor', ...data } } : n))
    const priceRow = (data: Record<string, unknown>) => {
      renderCard({ store: { nodes: withPriceFactor(data) } })
      const dd = onCard(PRICE_ROW)
      expect(dd, 'precondition: the f-price row is on the card').not.toBeNull()
      return { dd: dd!, before: onCard(PRICE_BEFORE) }
    }

    it('value 1, a real unit and NO raw_value: the card\'s "Monthly price active" is a guess → "→ £59"', () => {
      const data = { observedState: { value: 1, unit: 'GBP/month' } }
      expect(factorDisplayText({ label: 'Monthly price', ...data }), 'precondition: the formatter guesses').toBe('Monthly price active')
      const { dd, before } = priceRow(data)
      expect(before).toBeNull()
      expect(dd.textContent!.startsWith('→ £59')).toBe(true)
      expect(dd.textContent).not.toContain('active')
    })

    it('value 0, a real unit and NO raw_value: "No monthly price in place" is a guess → "→ £59"', () => {
      const data = { observedState: { value: 0, unit: 'GBP/month' } }
      expect(factorDisplayText({ label: 'Monthly price', ...data }), 'precondition: the formatter guesses').toBe('No monthly price in place')
      const { dd, before } = priceRow(data)
      expect(before).toBeNull()
      expect(dd.textContent!.startsWith('→ £59')).toBe(true)
      expect(dd.textContent).not.toContain('in place')
    })

    it('value 0 on a PLACEHOLDER unit, even with a raw_value: still the guess → "→ £59"', () => {
      const data = { observedState: { value: 0, raw_value: 0, unit: 'scale' } }
      expect(factorDisplayText({ label: 'Monthly price', ...data }), 'precondition: the formatter guesses').toBe('No monthly price in place')
      const { dd, before } = priceRow(data)
      expect(before).toBeNull()
      expect(dd.textContent!.startsWith('→ £59')).toBe(true)
    })

    it('CONTRAST — the factor\'s OWN display_value is carried, phrase or not: it IS the "from"', () => {
      const { dd, before } = priceRow({ display_value: 'Free plan only', observedState: { value: 0 } })
      expect(before?.textContent).toBe('Free plan only')
      expect(dd.textContent!.startsWith('Free plan only → £59')).toBe(true)
    })

    it('CONTRAST — the factor\'s encoding_map phrase for its value is carried: it IS the "from"', () => {
      const data = { display_value: 'Low (0)', encoding_map: { '0': 'No paid plan', '1': 'Paid plan' }, observedState: { value: 0 } }
      expect(factorDisplayText({ label: 'Monthly price', ...data }), 'precondition: the map wins').toBe('No paid plan')
      const { before } = priceRow(data)
      expect(before?.textContent).toBe('No paid plan')
    })

    it('CONTRAST — a raw_value with a real unit is carried: "£49/month → £59"', () => {
      const { before } = priceRow(PRICE_DATA)
      expect(before?.textContent).toBe('£49/month')
    })

    it('CONTRAST — a unitless raw_value is carried: its own figure is the "from"', () => {
      const { before } = priceRow({ observedState: { value: 0.245, raw_value: 49 } })
      expect(before?.textContent).toBe('49')
    })

    it('a SUPPRESSED unit word ("other") is dropped exactly as the factor card drops it: "49", never "49 other"', () => {
      const { dd, before } = priceRow({ observedState: { value: 0.245, raw_value: 49, unit: 'other' } })
      expect(before?.textContent).toBe('49')
      expect(dd.textContent).not.toContain('other')
    })

    it('a target EQUAL to the current value, formatted differently, is not a change: no row at all (v3.1 #9)', () => {
      // The factor card reads "59 GBP/month"; CEE's target is £59 at the SAME
      // model value (0.295). "59 GBP/month → £59" would claim a change that is
      // not one. It used to render "→ £59" with no "from"; contract v3.1 #9
      // ("concrete changes only") now keeps it off the resting card entirely.
      renderCard({ store: { nodes: withPriceFactor({ observedState: { cap: 200, unit: 'GBP/month', value: 0.295, raw_value: 59 } }) } })
      expect(onCard(PRICE_ROW)).toBeNull()
      expect(onCard(PRICE_BEFORE)).toBeNull()
      expect(onCard('option-change-rows-option-1')?.textContent ?? '').not.toContain('59 GBP/month')
      // CONTRAST, same shape one pound apart: a real change keeps its row and its "from".
      cleanup()
      const { before } = priceRow({ observedState: { cap: 200, unit: 'GBP/month', value: 0.29, raw_value: 58 } })
      expect(before?.textContent).toBe('£58/month')
    })
  })

  describe('post-run: the rows STAY and the run adds below them', () => {
    it('the card carries the rows AND the share line, rows first', () => {
      winRate = 0.42
      renderCard({ store: { results: COMPLETE } })
      const rows = onCard('option-change-rows-option-1')
      const share = onCard('option-analysis-currency-option-1')
      expect(share, 'precondition: the share line renders').not.toBeNull()
      expect(rows, 'the rows survive the run').not.toBeNull()
      expect(follows(rows!, share!)).toBe(true)
      expect(countAll('option-change-rows-option-1')).toBe(1)
    })
  })

  describe('the muted line under the rows is the option\'s OWN description or rationale', () => {
    it('renders the description verbatim', () => {
      renderCard({ store: { nodes: withOptionData('option-1', { description: 'Price changes without a feature release.' }) } })
      expect(onCard('option-card-differentiator-option-1')?.textContent).toBe('Price changes without a feature release.')
    })

    it('renders the description BODY only — a drafter\'s "Also drafted as:" note is not the option\'s description', () => {
      renderCard({
        store: { nodes: withOptionData('option-1', { description: 'Tests the release alongside the price.\n\nAlso drafted as: Ship then raise' }) },
      })
      expect(onCard('option-card-differentiator-option-1')?.textContent).toBe('Tests the release alongside the price.')
    })

    it('falls back to the rationale when there is no description', () => {
      renderCard({ store: { nodes: withOptionData('option-1', { rationale: 'Tests the release alongside the price.' }) } })
      expect(onCard('option-card-differentiator-option-1')?.textContent).toBe('Tests the release alongside the price.')
    })

    it('contrast: no description and no rationale → no line, and never a UI-composed sentence', () => {
      renderCard()
      expect(onCard('option-card-differentiator-option-1')).toBeNull()
      expect(onCard('option-differentiator-option-1')).toBeNull()
    })
  })

  describe('the baseline', () => {
    it('a DECLARED baseline with no changes reads "Baseline · no changes" and "Reference for the other alternatives."', () => {
      renderCard({ id: 'option-b' })
      expect(onCard('option-baseline-meta-option-b')?.textContent).toBe('Baseline · no changes')
      expect(onCard('option-baseline-reference-option-b')?.textContent).toBe('Reference for the other alternatives.')
    })

    it('post-run the baseline keeps both lines on the card, above the share line', () => {
      winRate = 0.3
      renderCard({ id: 'option-b', store: { results: COMPLETE } })
      const meta = onCard('option-baseline-meta-option-b')
      const share = onCard('option-analysis-currency-option-b')
      expect(share).not.toBeNull()
      expect(meta?.textContent).toBe('Baseline · no changes')
      expect(follows(meta!, share!)).toBe(true)
    })

    it('a declared baseline WITH its own description shows that line INSTEAD of the reference — one muted line, never two', () => {
      renderCard({ id: 'option-b', store: { nodes: withOptionData('option-b', { description: 'Hold the current plan while we learn.' }) } })
      expect(onCard('option-card-differentiator-option-b')?.textContent).toBe('Hold the current plan while we learn.')
      expect(onCard('option-baseline-reference-option-b')).toBeNull()
    })

    it('contrast: a baseline only by LABEL (no `is_baseline` declaration) states no reference', () => {
      const nodes = (makeStoreState().nodes as StoreNode[]).map((n) =>
        n.id === 'option-b' ? { ...n, data: { label: 'Status quo', type: 'option' } } : n)
      renderCard({ id: 'option-b', store: { nodes } })
      expect(onCard('option-baseline-reference-option-b')).toBeNull()
    })

    it('contrast: a declared baseline with no OTHER option has nothing to be the reference for', () => {
      renderCard({ id: 'option-b', store: { nodes: [FACTOR_PRICE, BASELINE] } })
      expect(onCard('option-baseline-meta-option-b')?.textContent).toBe('Baseline · no changes')
      expect(onCard('option-baseline-reference-option-b')).toBeNull()
    })
  })

  describe('kept affordances', () => {
    it('the pencil (edit targets) still renders on a non-baseline card', () => {
      renderCard()
      expect(screen.queryByTestId('option-edit-targets-option-1')).not.toBeNull()
    })
  })
})

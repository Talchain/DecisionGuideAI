/**
 * ⭐ THE OPTION CARD READS LIKE THE CONTRACT — side-by-side vs contract v3.1 and
 * NODE-ANATOMY v3.2, 27 Sep 2026 (`canvas-8ffc-work/sbs/DIFF.md` items 1 and 10).
 *
 * ITEM 1 — the change rows. Contract `.delta-rows`: one line per row, the muted
 * label left and `before → after <mark>` right (`£49 → £59 brief`, no dot before
 * the mark). Measured on the product at 100% (`prod-pricing-model-card-option-0.png`):
 *   · labels cut to ONE WORD (`Bottom-up…`, `Enterprise…`) — `line-clamp-1` on a
 *     wrapping cell ends line 1 at a word break, so a second word that does not
 *     fit whole is dropped even when most of it would;
 *   · when the amount could not sit beside the label it dropped under it and
 *     wrapped RIGHT-aligned over 2–3 ragged lines (`ml-auto text-right`);
 *   · a `·` separator before every mark (`Low · brief`).
 * Now:
 *   · the amount takes its natural width; the label keeps at least `6em` of the
 *     line (`flex-[1_1_6em]`, so the amount is capped at the rest) and takes all
 *     the space the amount leaves, ellipsising by CHARACTER (`truncate`) — the
 *     full name stays its DOM text, and the row line carries it in `title`
 *     (the e2e clipping gate's exemption: `data-truncates="label"` + a titled
 *     ancestor inside the node);
 *   · a row that cannot share a line stacks: label line, then the amount
 *     LEFT-aligned (`text-left`, no `ml-auto`);
 *   · the mark follows the value with no separator.
 *
 * ITEM 10 — the Baseline card read `Baseline option` on every starter's status
 * quo, because the meta keyed on the intervention TOTAL and every status quo
 * names targets. The anatomy (and contract `nodeHTML`) reads `Baseline · no
 * changes` — true when none of those targets is a CONCRETE change by the card's
 * own filter (`isConcreteChangeRow`: a target equal to the factor's current
 * value is not a change).
 *
 * ⚠ RE-PINNED 28 Sep 2026 (side-by-side DIFF N2, owner decision: a DATA fix).
 * The contrast used to be market-entry's shipped status quo, which set
 * `UK Financial Services Focus` to Pursued while the factor's current value read
 * Not pursued — a contradiction in the starter itself (the other options' rows
 * already read "Pursued → Not pursued"). The starter now records the status
 * quo's own state (current value 1, "Pursued"), so market-entry joins the
 * no-change baselines. The contrast is kept, on a copy of that starter with
 * the old contradicting value (0) restored: a baseline that DOES change
 * something still keeps `Baseline option`.
 *
 * FIXTURES: the shipped starters themselves, mapped the way a draft lands.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom — DOM structure, text, attributes and
 * class tokens. No pixels: whether a given row fits on one line is decided by
 * the browser's flex line-breaking over these tokens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ layoutNodeWidth: null, layoutCardWidths: null }),
  ),
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as { (sel: (s: unknown) => unknown): unknown; getState: () => unknown }
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { OptionNode } from '../OptionNode'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { changeRowValueText } from './__helpers__/optionChangeRowText'
import pricingStarter from '../../starters/data/pricing-model.draft.json'
import buildVsBuyStarter from '../../starters/data/build-vs-buy.draft.json'
import headcountStarter from '../../starters/data/headcount-allocation.draft.json'
import vendorStarter from '../../starters/data/vendor-selection.draft.json'
import marketEntryStarter from '../../starters/data/market-entry.draft.json'

type Draft = { nodes: unknown[]; edges: unknown[]; analysis_ready: unknown }
type CanvasNode = { id: string; data: Record<string, unknown> }

let state: Record<string, unknown>
function setState(draft: Draft) {
  state = {
    hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes: draft.nodes.map(mapDraftNodeToCanvas),
    edges: draft.edges.map(mapDraftEdgeToCanvas),
    ceeAnalysisReady: draft.analysis_ready,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null, goalConstraints: [],
    optionNumbering: {},
    runMeta: null, viewMode: 'standard', lodRung: 'full', selectNodeWithoutHistory: vi.fn(),
  }
  const hook = useCanvasStore as unknown as { getState: () => unknown }
  vi.mocked(useCanvasStore).mockImplementation(((sel: (s: unknown) => unknown) => sel(state)) as never)
  hook.getState = () => state
}

const BASE_META = {
  sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
  influenceSetSize: null, confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: false, achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  achievementProbabilityBasis: null, stabilityPercentage: null, winRate: null, winComputationFailed: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null, isResultsMode: false, goalFitAvailable: false,
}

function renderOption(draft: Draft, optionId: string) {
  setState(draft)
  const n = (state.nodes as CanvasNode[]).find(x => x.id === optionId)
  expect(n, `PRECONDITION: the starter carries option ${optionId}`).toBeDefined()
  return render(
    <ReactFlowProvider>
      <OptionNode id={optionId} type="option" data={n!.data as never} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').trim()
}
/** An element ON the card — never one inside the (mocked, always-rendered) popover. */
function onCard(container: HTMLElement, testId: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)]
    .find(el => !el.closest('[data-testid="node-popover"]')) ?? null
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

// ─── ITEM 1 — the change rows ────────────────────────────────────────────────

const PRICING = pricingStarter as unknown as Draft
const HYBRID = 'opt_hybrid'
/** The three rows of the served `opt_hybrid` card (all targets from the brief). */
const HYBRID_ROWS = [
  { factorId: 'fac_adoption_friction', label: 'Bottom-up adoption friction', value: 'Very high → Moderate' },
  { factorId: 'fac_enterprise_revenue_risk', label: 'Enterprise revenue cannibalization risk', value: 'Low → Moderate' },
  { factorId: 'fac_usage_exposure', label: 'Usage-based pricing exposure', value: 'No usage pricing → Moderate' },
] as const
/**
 * ⚠ RE-PINNED 28 Sep 2026 (Paul's staging test 64c5eccc; Canvas owner
 * decision): each of these rows is TWO lines at the landing bound (the amount
 * cannot sit beside 12 characters of the name — `optionRowForm`), so the card's
 * six row lines hold the first two; `fac_usage_exposure` is behind `+1 more`
 * (`OptionNode.twoLineRows.assistant.spec.tsx`). The row pins hold for the rows
 * on the card.
 */
const HYBRID_ROWS_ON_CARD = HYBRID_ROWS.slice(0, 2)

function hybridRow(container: HTMLElement, factorId: string) {
  const get = (prefix: string) => {
    const el = onCard(container, `${prefix}-${HYBRID}-${factorId}`)
    expect(el, `${prefix} for ${factorId} is on the card`).not.toBeNull()
    return el!
  }
  const line = get('option-change-row-line')
  const dd = get('option-change-row')
  const mark = get('option-change-row-mark')
  const source = get('option-change-row-source')
  const dt = dd.previousElementSibling as HTMLElement
  expect(dt.tagName).toBe('DT')
  expect(dt.parentElement).toBe(line)
  expect(dd.parentElement).toBe(line)
  return { line, dt, dd, mark, source }
}

describe('DIFF item 1 — the mark follows the value with no separator (contract `£49 → £59 brief`)', () => {
  for (const r of HYBRID_ROWS_ON_CARD) {
    it(`${r.factorId}: the amount reads "${r.value} brief" — value, one no-break space, the mark; no "·"`, () => {
      const { container } = renderOption(PRICING, HYBRID)
      const { dd, mark, source } = hybridRow(container, r.factorId)
      expect(changeRowValueText(dd)).toBe(r.value)
      // The whole visible amount: the value, the U+00A0 glue, the mark's word.
      expect(visibleText(dd)).toBe(`${r.value}\u00a0brief`)
      // The mark cluster holds the source mark and nothing else — no separator span.
      expect(visibleText(mark)).toBe('brief')
      expect([...mark.children]).toEqual([source])
      expect(source.getAttribute('data-value-source')).toBe('brief')
    })
  }
})

describe('the third hybrid row is counted, not dropped', () => {
  it('fac_usage_exposure is behind "+1 more" (the card\'s six row lines hold two two-line rows)', () => {
    const { container } = renderOption(PRICING, HYBRID)
    expect(onCard(container, `option-change-row-line-${HYBRID}-fac_usage_exposure`)).toBeNull()
    expect(onCard(container, `option-change-more-${HYBRID}`)?.textContent).toBe('+1 more')
  })
})

describe('DIFF item 1 — the label takes what the amount leaves, and ellipsises by character, not to one word', () => {
  for (const r of HYBRID_ROWS_ON_CARD) {
    it(`${r.factorId}: "${r.label}" is one truncating line, its full name in the DOM and in the row's title`, () => {
      const { container } = renderOption(PRICING, HYBRID)
      const { line, dt } = hybridRow(container, r.factorId)
      const t = tokens(dt)
      // One line, cut at the card's edge by character — not the word-break clamp.
      expect(t.has('truncate'), 'the label ellipsises by character').toBe(true)
      expect(t.has('line-clamp-1'), 'the word-break clamp that left one word').toBe(false)
      expect(t.has('break-words')).toBe(false)
      // Its share: everything the amount leaves. ⚠ RE-PINNED 28 Sep (DIFF Pre 1
      // residual, owner decision: the amount on the label's line, the label
      // yields). It kept `flex-[1_1_6em]` (at least 6em), which stacked 23 of
      // 23 landing rows; the label is now the row grid's `minmax(0,1fr)`
      // column (`OPTION_ROW_LINE_GRID_CLASSES`) and reserves no basis of its own.
      expect([...t].some(c => c.startsWith('flex-')), 'no label basis that pushes the amount down').toBe(false)
      expect(t.has('min-w-0')).toBe(true)
      // Nothing is cut in JS: the DOM text is the whole name.
      expect(dt.textContent).toBe(r.label)
      // Recoverable, as the e2e clipping gate requires of a CSS ellipsis: the leaf
      // says `data-truncates="label"` and its nearest titled ancestor — the row
      // line, inside this card — carries the full name.
      expect(dt.getAttribute('data-truncates')).toBe('label')
      expect(dt.hasAttribute('title'), 'no native title on the name cell itself').toBe(false)
      expect(dt.closest('[title]')).toBe(line)
      expect(line.getAttribute('title')).toBe(r.label)
    })
  }
})

// ⚠ RE-PINNED 28 Sep (side-by-side DIFF Pre 1 residual; owner decision). The
// row used to WRAP AS A WHOLE (`flex flex-wrap`), stacking the amount under the
// label whenever the two did not fit — every row at the landing bound. It is
// now the contract's two-column grid: the amount's first line is on the
// label's line by construction, still left-aligned and never pushed right.
// ⚠ AND RE-PINNED AGAIN 28 Sep (Paul's staging test 64c5eccc): where the
// amount cannot sit beside 12 characters of the name the row is TWO lines —
// one column, the name, then the amount (`OPTION_ROW_TWO_LINE_CLASSES`); the
// one-line grid stays wherever it fits. Both hybrid rows are two-line.
describe('DIFF Pre 1 residual — the amount stays on the label\'s line (the contract grid), left-aligned', () => {
  for (const r of HYBRID_ROWS_ON_CARD) {
    it(`${r.factorId}: a grid line in the form the rule names; the amount keeps its natural width, never pushed right`, () => {
      const { container } = renderOption(PRICING, HYBRID)
      const { line, dd } = hybridRow(container, r.factorId)
      const lt = tokens(line)
      expect(lt.has('grid')).toBe(true)
      expect(line.getAttribute('data-row-form')).toBe('two-line')
      expect(lt.has('grid-cols-[minmax(0,1fr)]'), 'one column: the name, then the amount').toBe(true)
      expect(lt.has('grid-cols-[minmax(0,1fr)_fit-content(calc(100%_-_8px_-_6em))]')).toBe(false)
      expect(lt.has('flex-wrap'), 'a wrapping line stacks the amount under the label').toBe(false)
      expect(lt.has('items-baseline')).toBe(true)
      const at = tokens(dd)
      // A wrapped amount wraps left-aligned inside its own column.
      expect(at.has('text-left')).toBe(true)
      expect(at.has('text-right'), 'ragged right-aligned wraps').toBe(false)
      expect(at.has('ml-auto'), 'an amount pushed to the right edge').toBe(false)
      // Beside the label it sits at the line's end anyway: the label column
      // takes every pixel the amount leaves, and the amount never exceeds the card.
      expect(at.has('max-w-full')).toBe(true)
      for (const grow of ['grow', 'flex-1', 'flex-auto']) expect(at.has(grow), `amount ${grow}`).toBe(false)
    })
  }
})

// ─── ITEM 10 — the Baseline card ─────────────────────────────────────────────

const NO_CHANGE_BASELINES = [
  { starter: 'pricing-model', draft: pricingStarter, id: 'opt_status_quo' },
  { starter: 'build-vs-buy', draft: buildVsBuyStarter, id: 'opt_status_quo' },
  { starter: 'headcount-allocation', draft: headcountStarter, id: 'opt_status_quo' },
  { starter: 'vendor-selection', draft: vendorStarter, id: 'opt_status_quo' },
  // DIFF N2 (28 Sep): the status quo is the current state now — no concrete change.
  { starter: 'market-entry', draft: marketEntryStarter, id: 'opt_uk_fs' },
] as const

/**
 * The market-entry starter AS IT SHIPPED BEFORE THE N2 DATA FIX: the factor's
 * current value 0 ("Not pursued") while the status quo sets it to 1. Kept only
 * as the contrast — a baseline with a real concrete change.
 */
function marketEntryWithContradiction(): Draft {
  const draft = structuredClone(marketEntryStarter) as unknown as Draft
  const factor = (draft.nodes as Array<{ id: string; observed_state?: { value?: number }; display_value?: string }>)
    .find(n => n.id === 'fac_uk_deepdive')!
  factor.observed_state!.value = 0
  factor.display_value = 'Low (0)'
  return draft
}

/** The status quo's own target map, as the starter carries it — the old key counted these. */
function targetCount(draft: Draft, optionId: string): number {
  const ready = draft.analysis_ready as { options?: Array<{ id: string; interventions?: Record<string, unknown> }> }
  return Object.keys(ready.options?.find(o => o.id === optionId)?.interventions ?? {}).length
}

describe('DIFF item 10 — a baseline whose targets are all non-changes reads "Baseline · no changes"', () => {
  for (const b of NO_CHANGE_BASELINES) {
    it(`${b.starter} ${b.id}: "Baseline · no changes", then "Reference for the other alternatives."`, () => {
      const draft = b.draft as unknown as Draft
      // The precondition that made the old card say "Baseline option": it names targets.
      expect(targetCount(draft, b.id), 'the status quo names targets').toBeGreaterThan(0)
      const { container } = renderOption(draft, b.id)
      const meta = onCard(container, `option-baseline-meta-${b.id}`)
      expect(meta, 'the baseline meta is on the card').not.toBeNull()
      expect(meta!.textContent).toBe('Baseline · no changes')
      const reference = onCard(container, `option-baseline-reference-${b.id}`)
      expect(reference, 'line 2 is on the card').not.toBeNull()
      expect(reference!.textContent).toBe('Reference for the other alternatives.')
      expect(meta!.compareDocumentPosition(reference!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The baseline states no delta rows of its own.
      expect(onCard(container, `option-change-rows-${b.id}`)).toBeNull()
    })
  }

  it('CONTRAST — a status quo that sets UK focus Not pursued → Pursued (the pre-N2 data), a concrete change: it keeps "Baseline option"', () => {
    const draft = marketEntryWithContradiction()
    const { container } = renderOption(draft, 'opt_uk_fs')
    const meta = onCard(container, 'option-baseline-meta-opt_uk_fs')
    expect(meta, 'the baseline meta is on the card').not.toBeNull()
    expect(meta!.textContent).toBe('Baseline option')
    expect(onCard(container, 'option-baseline-reference-opt_uk_fs')!.textContent)
      .toBe('Reference for the other alternatives.')
  })
})

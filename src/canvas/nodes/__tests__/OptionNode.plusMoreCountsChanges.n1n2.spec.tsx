/**
 * ⭐⭐ TWO TRUTH FIXES ON THE OPTION CARDS — side-by-side vs contract v3.1 on
 * served `b40d5436` (28 Sep 2026, `canvas-8ffc-work/sbs3/DIFF.md` N1 and N2).
 *
 * N1 — `+N more` COUNTED TARGETS THAT ARE NOT CHANGES. The rows are filtered to
 * CONCRETE changes (`isConcreteChangeRow`), but `+N more` was
 * `totalInterventionCount − rows shown`. Served: every vendor-selection option
 * read 1 row + `+5 more`, and the inspector it opened listed five targets equal
 * to the status quo's ("This option sets Not adopted / £60k / …"); market-entry
 * Germany/Nordics `+2 more`, headcount `+1 more`, build-vs-buy Extend Stripe
 * `+2 more` with ONE hidden change. Owner decision: `+N more` counts the
 * concrete changes not shown, with the same filter the rows use.
 *
 * N2 — MARKET-ENTRY'S STATUS QUO CONTRADICTED ITS OWN FACTOR. "UK Financial
 * Services Deepdive (Status Quo)" pursues the UK focus (target 1), and the
 * other options' rows already read `Pursued → Not pursued`, but the factor's
 * CURRENT value was 0 — the card said `Not pursued`, and the baseline card said
 * `Baseline option` because its one target differed from that value. Owner
 * decision: a DATA fix — the factor's current value is the status quo's
 * (1, `Pursued`); the baseline then reads `Baseline · no changes`.
 *
 * FIXTURES: the shipped starters, mapped the way a draft lands on the canvas.
 * Every row and every `+N more` is bound by option id + factor id (trap 19).
 *
 * CLAIM SCOPE (trap 3): jsdom — text and structure. The served numbers are the
 * browser check's, reported with the PR.
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
import { factorCardReading } from '../shared/optionChangeRows'
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

/** An element ON the card — never one inside the (mocked, always-rendered) popover. */
function onCard(container: HTMLElement, selector: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(selector)].filter(el => !el.closest('[data-testid="node-popover"]'))
}

/** The card's change rows, by factor id, in card order. */
function cardRowFactorIds(container: HTMLElement, optionId: string): string[] {
  const prefix = `option-change-row-line-${optionId}-`
  return onCard(container, `[data-testid^="${prefix}"]`).map(el => el.getAttribute('data-testid')!.slice(prefix.length))
}

function cardMore(container: HTMLElement, optionId: string): string | null {
  const more = onCard(container, `[data-testid="option-change-more-${optionId}"]`)
  expect(more.length, `at most one +N more on ${optionId}`).toBeLessThanOrEqual(1)
  return more[0]?.textContent ?? null
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

/**
 * Every non-baseline option on the five starters, with the rows its card shows
 * and the `+N more` it states — the served defect's cards named first.
 * `more: null` = no `+N more` at all.
 */
const CASES: Array<{ starter: string; draft: unknown; option: string; rows: string[]; more: string | null; served: string | null }> = [
  // Served `+5 more`: five hidden targets, every one equal to the status quo's.
  { starter: 'vendor-selection', draft: vendorStarter, option: 'opt_segment', rows: ['fac_segment'], more: null, served: '+5 more' },
  { starter: 'vendor-selection', draft: vendorStarter, option: 'opt_rudderstack', rows: ['fac_rudderstack'], more: null, served: '+5 more' },
  { starter: 'vendor-selection', draft: vendorStarter, option: 'opt_snowflake', rows: ['fac_snowflake_build'], more: null, served: '+5 more' },
  // Served `+2 more`: both hidden targets equal the baseline's.
  { starter: 'market-entry', draft: marketEntryStarter, option: 'opt_germany', rows: ['fac_germany', 'fac_uk_deepdive'], more: null, served: '+2 more' },
  { starter: 'market-entry', draft: marketEntryStarter, option: 'opt_nordics', rows: ['fac_nordics', 'fac_uk_deepdive'], more: null, served: '+2 more' },
  // Served `+1 more`: the hidden row is a non-change (sbs item 9, re-diagnosed).
  { starter: 'headcount-allocation', draft: headcountStarter, option: 'opt_eng', rows: ['fac_eng_headcount'], more: null, served: '+1 more' },
  { starter: 'headcount-allocation', draft: headcountStarter, option: 'opt_sales', rows: ['fac_ae_headcount'], more: null, served: '+1 more' },
  // ⭐ CONTROLS — a REAL hidden change is still counted. Extend Stripe shows one
  // row (its engineering-capacity change is too long for two, ED D2) and hides
  // ONE more change (time to live stays 0.5 = the baseline's, not a change):
  // served `+2 more`, now `+1 more`. Build hides two real changes: `+2 more`.
  { starter: 'build-vs-buy', draft: buildVsBuyStarter, option: 'opt_stripe', rows: ['fac_eng_capacity'], more: '+1 more', served: '+2 more' },
  { starter: 'build-vs-buy', draft: buildVsBuyStarter, option: 'opt_build', rows: ['fac_dev_time'], more: '+2 more', served: '+2 more' },
  { starter: 'build-vs-buy', draft: buildVsBuyStarter, option: 'opt_vendor', rows: ['fac_dev_time'], more: '+2 more', served: '+2 more' },
  // Pricing: three concrete changes. ⚠ RE-PINNED 28 Sep (Paul's staging test
  // 64c5eccc; Canvas owner): each row is two lines at the bound (its amount
  // cannot sit beside 12 characters of the name), so the card's six row lines
  // hold two rows and the third — a REAL change — is counted: `+1 more`.
  { starter: 'pricing-model', draft: pricingStarter, option: 'opt_hybrid', rows: ['fac_adoption_friction', 'fac_enterprise_revenue_risk'], more: '+1 more', served: null },
]

describe('DIFF N1 — `+N more` counts only the concrete changes the card does not show', () => {
  for (const c of CASES) {
    it(`${c.starter} ${c.option}: rows [${c.rows.join(', ')}], ${c.more ?? 'no +N more'} (served: ${c.served ?? 'none'})`, () => {
      const { container } = renderOption(c.draft as Draft, c.option)
      expect(cardRowFactorIds(container, c.option)).toEqual(c.rows)
      expect(cardMore(container, c.option)).toBe(c.more)
    })
  }

  it('the target TOTAL is still stated — by the pencil route, not by `+N more`', () => {
    const { container } = renderOption(vendorStarter as unknown as Draft, 'opt_segment')
    const pencil = onCard(container, '[data-testid="option-edit-targets-opt_segment"]')
    expect(pencil.length).toBe(1)
    expect(pencil[0].getAttribute('aria-label')).toMatch(/^6 factor targets\./)
    expect(cardMore(container, 'opt_segment')).toBeNull()
  })
})

// ─── N2 — the market-entry status quo is the current state ──────────────────

const MARKET = marketEntryStarter as unknown as Draft

describe('DIFF N2 — market-entry: the factor reads what the status quo pursues', () => {
  it('the UK focus factor card reads "Pursued" (the factor card\'s own formatter)', () => {
    const node = MARKET.nodes.map(mapDraftNodeToCanvas).find((n: { id: string }) => n.id === 'fac_uk_deepdive') as CanvasNode
    expect(node, 'PRECONDITION: the starter carries fac_uk_deepdive').toBeDefined()
    expect(factorCardReading(node.data)).toBe('Pursued')
  })

  it('the status quo states no change: "Baseline · no changes"', () => {
    const { container } = renderOption(MARKET, 'opt_uk_fs')
    const meta = onCard(container, '[data-testid="option-baseline-meta-opt_uk_fs"]')
    expect(meta.length).toBe(1)
    expect(meta[0].textContent).toBe('Baseline · no changes')
  })

  it('the other options still read "Pursued → Not pursued" for the UK focus — the rows and the factor now agree', () => {
    for (const option of ['opt_germany', 'opt_nordics']) {
      const { container } = renderOption(MARKET, option)
      const dd = onCard(container, `[data-testid="option-change-row-${option}-fac_uk_deepdive"]`)
      expect(dd.length, `${option} states its UK focus change`).toBe(1)
      expect(changeRowValueText(dd[0])).toBe('Pursued → Not pursued')
      cleanup()
    }
  })
})

/**
 * THE DATA INVARIANT behind N2, over all five shipped starters: a declared
 * status quo (`is_baseline: true`) IS the current state, so every target it sets
 * equals its factor's current value wherever the factor records one. Read from
 * the starter JSON itself — the same two fields the card compares.
 */
describe('DIFF N2 — no shipped status quo contradicts its factors', () => {
  const STARTERS = {
    'pricing-model': pricingStarter, 'build-vs-buy': buildVsBuyStarter, 'headcount-allocation': headcountStarter,
    'vendor-selection': vendorStarter, 'market-entry': marketEntryStarter,
  } as Record<string, unknown>
  type WireNode = { id: string; kind?: string; is_baseline?: boolean; interventions?: Record<string, { value?: number }>; observed_state?: { value?: number } }
  for (const [name, raw] of Object.entries(STARTERS)) {
    it(`${name}: every status-quo target equals its factor's current value`, () => {
      const nodes = (raw as { nodes: WireNode[] }).nodes
      const baselines = nodes.filter(n => n.kind === 'option' && n.is_baseline === true)
      expect(baselines.length, 'PRECONDITION: exactly one declared status quo').toBe(1)
      const factors = new Map(nodes.filter(n => n.kind === 'factor').map(n => [n.id, n]))
      const compared: string[] = []
      const contradictions: string[] = []
      for (const [fid, t] of Object.entries(baselines[0].interventions ?? {})) {
        const current = factors.get(fid)?.observed_state?.value
        if (typeof current !== 'number' || typeof t?.value !== 'number') continue
        compared.push(fid)
        if (Math.abs(current - t.value) > 1e-9) contradictions.push(`${fid}: target ${t.value}, current ${current}`)
      }
      // Contrast control: the check actually compared something on this starter.
      expect(compared.length, 'the status quo names at least one factor with a current value').toBeGreaterThan(0)
      expect(contradictions).toEqual([])
    })
  }
})

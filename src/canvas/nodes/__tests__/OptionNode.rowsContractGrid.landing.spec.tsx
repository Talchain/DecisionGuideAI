/**
 * ⭐⭐ AN OPTION CHANGE ROW IS THE CONTRACT'S ONE-LINE GRID AT THE LANDING BOUND,
 * AND ITS SOURCE MARK NEVER STANDS ALONE — side-by-side DIFF Pre 1 residual
 * and N5 (28 Sep 2026, `canvas-8ffc-work/sbs3/DIFF.md` ranked items 6 and 7).
 *
 * Contract v3.1 `.delta-rows{grid-template-columns:minmax(0,1fr) auto}` +
 * `.amount{white-space:nowrap}`; point 7 "`£49 → £59 brief`". Owner decision:
 * the amount on the label's line, the label yields with an ellipsis, the amount
 * never breaks where it fits; Paul's 3 rows and "a Run never grows a card" kept.
 *
 * MEASURED BEFORE (local build of `b40d5436`, 1280×800, landing bound
 * `--canvas-label-scale` 1.64, Chromium): 23 of 23 rows stacked (the amount
 * under its label — the row was a wrapping flex line whose label kept `6em`),
 * and `brief` stood alone on the next line in 7 of 23 (10 of 23 on served):
 * the mark is an inline-flex button — an atomic inline — and Chromium broke
 * before it under the cell's `normal` white-space despite the U+00A0 glue.
 *
 * WHAT IS PINNED — on every resting row of every option of the five shipped
 * starters, bound by option id + factor id:
 *   · GEOMETRY BY CONSTRUCTION: the row line is a two-column grid —
 *     `minmax(0,1fr)` label, `fit-content(100% − gap − 6em)` amount — whose
 *     ONLY children are the `dt` then the `dd`. A one-row, two-column grid
 *     places the amount's first line on the label's line, at every zoom; no
 *     `flex-wrap`, no label basis that can push the amount down.
 *   · THE MARK: the amount cell is `whitespace-nowrap`, so no break opportunity
 *     exists between the glue and the mark (their nearest common ancestor is
 *     the cell); the value re-opens its OWN spaces (`whitespace-normal`) only
 *     where the amount may break (before its arrow).
 *   · LINE-COUNT MODEL AT THE BOUND: every run the amount cannot break —
 *     computed from the rendered DOM, the glued mark included — is within the
 *     estate's per-line amount budget at the bound (`NODE_ROW_AMOUNT_MAX_CHARS`,
 *     measured character width × `MAX_LABEL_COUNTER_SCALE`), so the label
 *     track (min 0) can always yield to it: the row never pushes past the
 *     card's edge, and an amount that fits the row is one line.
 *
 * CLAIM SCOPE (trap 3): jsdom has no layout. The pixels — 23/23 stacked →
 * 0/23, mark alone 7 → 0 at landing — are the browser check's (PR notes).
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
import { OptionNode, OPTION_ROW_LINE_GRID_CLASSES, OPTION_ROW_TWO_LINE_CLASSES } from '../OptionNode'
import { OPTION_ROW_NAME_MIN_CHARS } from '../shared/optionChangeRows'
import { NODE_ROW_AMOUNT_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import { VALUE_SOURCE_MARK_TOKEN, type ValueSourceMarkKind } from '../shared/valueSourceMark'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
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
    edges: draft.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
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

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

const STARTERS: Array<[string, unknown]> = [
  ['pricing-model', pricingStarter], ['market-entry', marketEntryStarter], ['vendor-selection', vendorStarter],
  ['build-vs-buy', buildVsBuyStarter], ['headcount-allocation', headcountStarter],
]

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const NBSP = '\u00a0'

/** Every option on a starter that renders change rows (baselines render none). */
function optionIds(draft: Draft): string[] {
  return (draft.nodes as Array<{ id: string; kind?: string; is_baseline?: boolean }>)
    .filter(n => n.kind === 'option' && n.is_baseline !== true).map(n => n.id)
}

/**
 * The runs an amount cell CANNOT break, read off the rendered DOM: the cell is
 * `nowrap`; inside it a `whitespace-normal` element breaks at its own spaces
 * unless a `whitespace-nowrap` descendant holds a run whole; the glue (U+00A0)
 * and the mark's token join the last run.
 */
function unbreakableRuns(dd: HTMLElement, markToken: string | null): string[] {
  const runs: string[] = ['']
  const walk = (node: Node, canBreak: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data
      if (!canBreak) { runs[runs.length - 1] += text; return }
      const parts = text.split(' ')
      parts.forEach((p, i) => { if (i > 0) runs.push(''); runs[runs.length - 1] += p })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if ((el.getAttribute('data-testid') ?? '').startsWith('option-change-row-mark-')) {
      // The mark is an inline-flex button — an ATOMIC inline. Chromium offers a
      // break before an atomic inline whenever the white-space of the nearest
      // common ancestor (the amount cell) allows wrapping, whatever the U+00A0
      // glue says (served N5). So the glue joins the mark to the run ONLY in a
      // cell that cannot wrap.
      if (canBreak) runs.push('')
      if (markToken) runs[runs.length - 1] += canBreak ? markToken.trim() : markToken
      return
    }
    const t = tokens(el)
    const next = t.has('whitespace-nowrap') ? false : t.has('whitespace-normal') ? true : canBreak
    el.childNodes.forEach(c => walk(c, next))
  }
  walk(dd, tokens(dd).has('whitespace-nowrap') ? false : true)
  return runs.map(r => r.replace(new RegExp(NBSP, 'g'), ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** The row's name cell (its first child). */
const kids0 = (line: HTMLElement) => line.children[0] as HTMLElement
/** The amount as read: value, glue, mark word — no screen-reader-only text. */
function visibleAmount(line: HTMLElement): string {
  const clone = line.children[1].cloneNode(true) as HTMLElement
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').replace(new RegExp(NBSP, 'g'), ' ').replace(/\s+/g, ' ').trim()
}

for (const [starter, raw] of STARTERS) {
  const draft = raw as Draft
  describe(`${starter} — every resting change row is the contract's grid, one line or two by its text`, () => {
    for (const optionId of optionIds(draft)) {
      it(`${optionId}: grid line (dt, dd), nowrap amount cell, the mark glued, runs within the bound's budget`, () => {
        const { container } = renderOption(draft, optionId)
        const lines = onCard(container, `[data-testid^="option-change-row-line-${optionId}-"]`)
        expect(lines.length, `PRECONDITION: ${optionId} renders change rows`).toBeGreaterThan(0)
        for (const line of lines) {
          const factorId = line.getAttribute('data-testid')!.slice(`option-change-row-line-${optionId}-`.length)
          const lt = tokens(line)
          expect(lt.has('flex-wrap'), `${factorId}: a wrapping flex line drops the amount under the label`).toBe(false)
          expect(lt.has('flex')).toBe(false)
          expect(lt.has('grid')).toBe(true)
          // ⚠ RE-PINNED 28 Sep 2026 (Paul's staging test 64c5eccc; Canvas owner
          // decision): the one-line grid holds only where the amount fits beside
          // at least OPTION_ROW_NAME_MIN_CHARS of the name at the bound; else the
          // row is TWO lines (one column: the name, then the amount). The form is
          // re-derived HERE from the rendered text, independently of the product's
          // own rule, and must be the form the row wears.
          const form = line.getAttribute('data-row-form')
          const nameChars = (kids0(line).textContent ?? '').length
          const amountChars = visibleAmount(line).length
          const fits = Math.min(nameChars, OPTION_ROW_NAME_MIN_CHARS) + 1 + amountChars <= NODE_ROW_AMOUNT_MAX_CHARS
          expect(form, `${factorId}: name ${nameChars}, amount ${amountChars} chars`).toBe(fits ? 'one-line' : 'two-line')
          if (form === 'one-line') {
            expect(lt.has('grid-cols-[minmax(0,1fr)_fit-content(calc(100%_-_8px_-_6em))]')).toBe(true)
          }
          // The form's class set, exactly — the shared constant, token for token
          // (its type tokens make `6em` the label's own counter-scaled em).
          const classes = form === 'one-line' ? OPTION_ROW_LINE_GRID_CLASSES : OPTION_ROW_TWO_LINE_CLASSES
          for (const c of classes.split(/\s+/)) expect(lt.has(c), `${factorId} line lacks "${c}"`).toBe(true)
          // One row, two columns: the label, then the amount — nothing else.
          const kids = [...line.children]
          expect(kids.map(k => k.tagName)).toEqual(['DT', 'DD'])
          const [dt, dd] = kids as HTMLElement[]
          expect(dd.getAttribute('data-testid')).toBe(`option-change-row-${optionId}-${factorId}`)
          // The label yields: one line, by character, into what the amount leaves.
          const dtt = tokens(dt)
          expect(dtt.has('truncate')).toBe(true)
          expect(dtt.has('min-w-0')).toBe(true)
          expect([...dtt].some(c => c.startsWith('flex-')), 'no flex basis reserving label width').toBe(false)
          // The mark: glued, and no break opportunity before it (the cell is nowrap).
          expect(tokens(dd).has('whitespace-nowrap'), 'the amount cell is nowrap').toBe(true)
          const mark = dd.querySelector<HTMLElement>(`[data-testid="option-change-row-mark-${optionId}-${factorId}"]`)
          const value = dd.querySelector<HTMLElement>(`[data-testid="option-change-row-value-${optionId}-${factorId}"]`)
          let markToken: string | null = null
          if (mark) {
            expect(mark.parentElement).toBe(dd)
            expect((mark.previousSibling as Text | null)?.data).toBe(NBSP)
            expect(mark.previousSibling?.previousSibling).toBe(value)
            const kind = mark.querySelector('[data-value-source]')?.getAttribute('data-value-source') as ValueSourceMarkKind | null
            const estimate = mark.querySelector('[data-testid^="option-change-row-estimate-"]')
            markToken = ` ${VALUE_SOURCE_MARK_TOKEN[kind ?? (estimate ? 'olumi' : 'unknown')]}`
          }
          // A value that may break says so explicitly — it must not inherit the cell's nowrap.
          if (value) {
            const vt = tokens(value)
            expect(vt.has('whitespace-nowrap') || vt.has('whitespace-normal'), `${factorId} value states its wrapping`).toBe(true)
          }
          // The line-count model at the bound: every unbreakable run fits the row.
          for (const run of unbreakableRuns(dd, markToken)) {
            expect(run.length, `"${run}" cannot break and must fit one line at the bound`).toBeLessThanOrEqual(NODE_ROW_AMOUNT_MAX_CHARS)
          }
        }
      })
    }
  })
}

describe('the mark cannot stand alone — the served N5 rows, by identity', () => {
  // Served `b40d5436`: "Very high → Moderate" / "brief" (pricing Hybrid);
  // "Not pursued → Pursued" / "brief" (market-entry); "Not adopted → Adopted" / "brief" (vendor).
  const SERVED: Array<[unknown, string, string, string]> = [
    [pricingStarter, 'opt_hybrid', 'fac_adoption_friction', 'Moderate brief'],
    [marketEntryStarter, 'opt_germany', 'fac_germany', 'Pursued brief'],
    [vendorStarter, 'opt_segment', 'fac_segment', 'Adopted brief'],
  ]
  for (const [raw, optionId, factorId, tail] of SERVED) {
    it(`${optionId} · ${factorId}: the last unbreakable run ends "${tail}"`, () => {
      const { container } = renderOption(raw as Draft, optionId)
      const dd = onCard(container, `[data-testid="option-change-row-${optionId}-${factorId}"]`)[0]
      expect(dd, 'the row renders').toBeDefined()
      const runs = unbreakableRuns(dd, ' brief')
      expect(runs[runs.length - 1].endsWith(tail)).toBe(true)
      expect(runs[runs.length - 1]).not.toBe('brief')
    })
  }
})

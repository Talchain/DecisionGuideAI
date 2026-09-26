/**
 * ⭐ AN OPTION'S CHANGE ROWS READ ON ONE LINE EACH — THE SOURCE MARK SITS ON THE
 * VALUE LINE, AND THE LABEL IS ONE LINE (design audit #9, 26 Sep 2026).
 *
 * SERVED (UI `853feeb7`, 1280×800, dock open, pricing, landing zoom 0.5 with
 * `--canvas-label-scale` 2): `opt_hybrid` "Hybrid Platform Fee Plus Usage" had
 * 9 body lines and stood 250.1px on screen against 139.1 for the baseline card.
 * Each row read label / value / "· brief": the mark sat ~15px BELOW its value
 * (value y 267.5, "·" y 282.3, "brief" y 283.3), and "Bottom-up adoption
 * friction" wrapped (label y 240 → value y 267.5 is two 13.75px lines). The
 * layout reserves each card's height at that 2× scale, so the whole board paid
 * for it (audit #2: the Goal off-screen on 5/5 starters; #10: tier gaps).
 *
 * TARGET: the prototype row keeps "£49 → £59 brief" on ONE line; Paul (25 Sep)
 * keeps up to three rows (`OPTION_CARD_ROW_LIMIT`); ED 5809278282: one stable
 * geometry, no rung-triggered re-layout, fuller detail in the popover or the
 * inspector — not in card height.
 *
 * WHAT IS PINNED, BY IDENTITY (option id + factor id test ids, exact text):
 *   · the mark is GLUED to the value — the only thing between the value and the
 *     mark cluster is one no-break space (U+00A0), so there is no line-break
 *     opportunity between them and the mark cannot drop to a line of its own;
 *   · gluing never pushes an unbreakable run past the card: any no-wrap run that
 *     ends the value is short enough to carry the mark as well
 *     (`optionAmountSegmentNoWrap`, #2119's rule, applied to run + mark);
 *   · the label is ONE line (`line-clamp-1` + `min-w-0`), and the FULL label is
 *     still recoverable: it is the label's whole DOM text (screen readers read
 *     it all), it is in the option's popover, and a brief mark's accessible name
 *     carries it. No native `title` is added (#2126 is removing them).
 *
 * FIXTURE: the shipped pricing starter itself (`pricing-model.draft.json`, the
 * board the audit measured), mapped the way a draft lands on the canvas.
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom — DOM structure, text, attributes and
 * class tokens. No pixels: the served heights are measured by the landing
 * harness and reported in the PR.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
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
import { OPTION_ROW_SOURCE_MARK_SEPARATOR, optionAmountSegmentNoWrap } from '../shared/optionChangeRows'
import { VALUE_SOURCE_MARK_TOKEN, VALUE_SOURCE_MARK_LABEL, type ValueSourceMarkKind } from '../shared/valueSourceMark'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { changeRowValueText } from './__helpers__/optionChangeRowText'
import pricingStarter from '../../starters/data/pricing-model.draft.json'

const OPTION = 'opt_hybrid'

/**
 * The three rows the audit measured on `opt_hybrid`, in card order, with the
 * served label and value strings (detail-1280.json `optLeaves`). All three
 * targets came from the brief.
 */
const SERVED_ROWS = [
  { factorId: 'fac_adoption_friction', label: 'Bottom-up adoption friction', value: 'Very high → Moderate' },
  { factorId: 'fac_enterprise_revenue_risk', label: 'Enterprise revenue cannibalization risk', value: 'Low → Moderate' },
  { factorId: 'fac_usage_exposure', label: 'Usage-based pricing exposure', value: 'No usage pricing → Moderate' },
] as const

const NBSP = ' '

type Draft = { nodes: unknown[]; edges: unknown[]; analysis_ready: unknown }
const draft = pricingStarter as unknown as Draft

let state: Record<string, unknown>
function setState() {
  const nodes = draft.nodes.map(mapDraftNodeToCanvas)
  state = {
    hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes, edges: draft.edges.map(mapDraftEdgeToCanvas),
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

function renderHybrid() {
  const n = (state.nodes as Array<{ id: string; data: Record<string, unknown> }>).find(x => x.id === OPTION)!
  return render(
    <ReactFlowProvider>
      <OptionNode id={OPTION} type="option" data={n.data as never} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

/** The card's rows block — never one inside the popover. */
function cardRows(container: HTMLElement): HTMLElement {
  const blocks = [...container.querySelectorAll<HTMLElement>(`[data-testid="option-change-rows-${OPTION}"]`)]
    .filter(b => !b.closest('[data-testid="node-popover"]'))
  expect(blocks.length, 'the change rows render once, on the card').toBe(1)
  return blocks[0]
}

function rowParts(container: HTMLElement, factorId: string) {
  const rows = cardRows(container)
  const q = (id: string) => rows.querySelector<HTMLElement>(`[data-testid="${id}-${OPTION}-${factorId}"]`)
  const line = q('option-change-row-line')
  const dd = q('option-change-row')
  const value = q('option-change-row-value')
  const mark = q('option-change-row-mark')
  const source = q('option-change-row-source') ?? q('option-change-row-estimate')
  expect(line, `row line ${factorId}`).not.toBeNull()
  expect(dd, `row amount ${factorId}`).not.toBeNull()
  expect(value, `row value ${factorId}`).not.toBeNull()
  expect(mark, `row mark ${factorId}`).not.toBeNull()
  expect(source, `row source mark ${factorId}`).not.toBeNull()
  const dt = dd!.previousElementSibling as HTMLElement
  expect(dt.tagName).toBe('DT')
  return { line: line!, dd: dd!, value: value!, mark: mark!, source: source!, dt }
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
  setState()
})
afterEach(() => cleanup())

describe('audit #9 — the fixture is the served opt_hybrid card', () => {
  it('renders exactly the three served rows, in the served order, each with a brief mark', () => {
    const { container } = renderHybrid()
    const rows = cardRows(container)
    const lines = [...rows.querySelectorAll<HTMLElement>('[data-testid^="option-change-row-line-"]')]
    expect(lines.map(l => l.getAttribute('data-testid'))).toEqual(
      SERVED_ROWS.map(r => `option-change-row-line-${OPTION}-${r.factorId}`),
    )
    for (const r of SERVED_ROWS) {
      const { dd, dt, source } = rowParts(container, r.factorId)
      expect(dt.textContent).toBe(r.label)
      expect(changeRowValueText(dd)).toBe(r.value)
      expect(source.getAttribute('data-value-source')).toBe('brief')
    }
  })
})

describe('audit #9 — the source mark sits on the value line', () => {
  for (const r of SERVED_ROWS) {
    it(`${r.factorId}: the only thing between "${r.value}" and its mark is one no-break space`, () => {
      const { container } = renderHybrid()
      const { dd, value, mark } = rowParts(container, r.factorId)
      // Same amount cell, value first, mark after.
      expect(value.parentElement).toBe(dd)
      expect(mark.parentElement).toBe(dd)
      // The glue: exactly one text node, exactly U+00A0 — no breakable space,
      // no element, nothing else between the value and the mark cluster.
      const glue = mark.previousSibling
      expect(glue?.nodeType, 'a text node glues the mark to the value').toBe(Node.TEXT_NODE)
      expect((glue as Text).data).toBe(NBSP)
      expect(glue?.previousSibling).toBe(value)
      // Nothing inside the cluster can break either (separator and mark stay together).
      expect(tokens(mark).has('whitespace-nowrap')).toBe(true)
      // And no ordinary space anywhere in the amount cell outside the value and
      // the cluster: a stray ' ' child is a break opportunity that drops the mark.
      const strays = [...dd.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && /[ \t\n]/.test((n as Text).data))
      expect(strays.length, 'a breakable space between the value and its mark').toBe(0)
    })

    it(`${r.factorId}: gluing the mark never makes an unbreakable run wider than the row budget`, () => {
      const { value, source } = rowParts(container_(), r.factorId)
      const kind = source.getAttribute('data-value-source') as ValueSourceMarkKind
      const suffix = ` ${OPTION_ROW_SOURCE_MARK_SEPARATOR} ${VALUE_SOURCE_MARK_TOKEN[kind]}`
      const valueText = (value.textContent ?? '').replace(/\s+/g, ' ').trim()
      // Every no-wrap run whose text ENDS the value now carries the mark too, so
      // it must fit one line of the row budget WITH the mark (#2119's rule).
      const runs = [value, ...value.querySelectorAll<HTMLElement>('*')]
        .filter(el => tokens(el).has('whitespace-nowrap'))
        .filter(el => valueText.endsWith((el.textContent ?? '').replace(/\s+/g, ' ').trim()))
      for (const run of runs) {
        const glued = `${(run.textContent ?? '').replace(/\s+/g, ' ').trim()}${suffix}`
        expect(optionAmountSegmentNoWrap(glued), `"${glued}" is held on one line but does not fit the row`).toBe(true)
      }
    })
  }
})

describe('audit #9 — the label is one line, and the full label is still reachable', () => {
  for (const r of SERVED_ROWS) {
    it(`${r.factorId}: "${r.label}" is clamped to one line; the whole name is its text, in the popover and in the mark's name`, () => {
      const { container } = renderHybrid()
      const { dt, source } = rowParts(container, r.factorId)
      const t = tokens(dt)
      expect(t.has('line-clamp-1') || t.has('truncate'), 'the label is held to one line').toBe(true)
      expect(t.has('min-w-0')).toBe(true)
      // G1: nothing removed — the label's DOM text is the WHOLE name (no JS cut).
      expect(dt.textContent).toBe(r.label)
      // No native tooltip added to recover it (#2126 is removing those).
      expect(dt.hasAttribute('title')).toBe(false)
      // Recoverable: the option's popover lists the change under its full name…
      const pop = container.querySelector<HTMLElement>('[data-testid="node-popover"]')
      expect(pop, 'the option popover is mounted').not.toBeNull()
      expect(within(pop!).getByText(r.label, { exact: true })).toBeTruthy()
      // …and the brief mark's accessible name carries it.
      expect(source.getAttribute('aria-label')).toBe(`${r.label} target: ${VALUE_SOURCE_MARK_LABEL.brief}`)
    })
  }
})

/** Render and return the container (for the loops that only need the parts). */
function container_(): HTMLElement {
  return renderHybrid().container
}

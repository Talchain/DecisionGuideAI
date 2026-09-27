/**
 * ⭐ A FACTOR'S VALUE AND ITS `est.` MARK SIT INLINE AND WRAP TOGETHER — side-by-side
 * vs contract v3.1, 27 Sep 2026 (`canvas-8ffc-work/sbs/DIFF.md` item 3).
 *
 * Contract `nodeHTML` factor branch: `<div class="own-value"><strong>8%</strong>
 * <prov>est.</prov><span>trials convert</span></div>` with
 * `.own-value{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}` — the
 * mark 6px after the value, and when the line runs out the mark wraps WITH the
 * value, onto the next line under it.
 *
 * Product before (build-vs-buy, `prod-build-vs-buy-landing2x-factors.png`): the
 * Standard row was `flex-nowrap`, the value `min-w-0 break-words`, the mark slot
 * `shrink-0`. So "Moderate engineering allocation (2 of 4 engineers)" wrapped
 * inside its own narrowed column (2 lines at 100%, 4 at landing) while `est.`
 * hung at the card's right edge, 54px from the end of the text.
 *
 * Now the Standard row is INLINE FLOW, not a flex row: the value, ONE breakable
 * space (the gap), then the mark in a `whitespace-nowrap` slot. The mark
 * follows the value's last word; when that line is full it wraps onto the next
 * line under the value. (Not the contract's flex items verbatim: a wrapping flex
 * item takes the full width, so a two-line value would always push `est.` to a
 * third line of its own — measured in a Chromium harness, 27 Sep: inline flow
 * keeps the mark on the last line with no extra height; flex-wrap added a line.)
 *
 * Pinned, by identity (`factor-recorded-value`, `factor-value-mark-slot-<id>`):
 *   · the row is not a flex/grid container (no `flex`, `flex-nowrap`, `grid`);
 *   · its children are exactly: the value, one ' ' text node, the mark slot;
 *   · the mark never splits (`whitespace-nowrap`) and is never pushed to an edge;
 *   · the value may wrap inside the card (`break-words`) — nothing is cut.
 * Both value paths: the served factor is controllable (the on-graph editor
 * holds the value); the contrast is the same reading on a non-editable factor.
 *
 * CLAIM SCOPE: jsdom — tokens, text and DOM order. Not pixels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import buildVsBuyStarter from '../../starters/data/build-vs-buy.draft.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
    influenceSetSize: null, influenceRankedCount: null, confidence: null, confidenceIsDefaulted: false,
    confidenceIsProvisional: false, inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: false, stabilityPercentage: null, winRate: null,
    isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="factor-node-popover">{children}</div>,
}))

const ID = 'fac_eng_capacity'
type CanvasNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
const served = (buildVsBuyStarter as unknown as { nodes: unknown[] }).nodes
  .map(mapDraftNodeToCanvas as (n: unknown) => CanvasNode)
  .find(n => n.id === ID)!

function renderFactor(data: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full', goalConstraints: [],
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
    hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const card = () => {
  const root = screen.getByTestId('node-title').closest('[role="group"]')
  expect(root, 'the card root renders').not.toBeNull()
  return root as HTMLElement
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [], viewMode: 'standard', lodRung: 'full' } as never)
})

const CASES = [
  { name: 'served (controllable — the on-graph editor holds the value)', data: () => served.data, editor: true },
  { name: 'contrast (observable — the plain value text)', data: () => ({ ...served.data, category: 'observable' }), editor: false },
] as const

describe('DIFF item 3 — the value and its mark wrap together (contract `.own-value`)', () => {
  it('PRECONDITION: the served factor is the long qualitative Olumi value the audit measured', () => {
    expect(served, 'build-vs-buy carries fac_eng_capacity').toBeDefined()
    renderFactor(served.data)
    const row = within(card()).getByTestId('factor-recorded-value')
    // Collapsed whitespace: the value, then its mark.
    expect(visibleText(row).replace(/\s+/g, '')).toBe('Moderateengineeringallocation(2of4engineers)est.')
  })

  for (const c of CASES) {
    it(`${c.name}: inline flow — the value, one breakable space, then the mark`, () => {
      renderFactor(c.data())
      const row = within(card()).getByTestId('factor-recorded-value')
      const rt = tokens(row)
      for (const layout of ['flex', 'inline-flex', 'grid', 'flex-nowrap']) {
        expect(rt.has(layout), `the value row is a ${layout} container`).toBe(false)
      }
      expect(rt.has('break-words'), 'a long value wraps inside the card').toBe(true)

      // Exactly: the value, the gap (one ordinary, breakable space), the mark slot.
      const kids = [...row.childNodes].filter(n => n.nodeType !== Node.COMMENT_NODE)
      expect(kids).toHaveLength(3)
      const [value, gap, slot] = kids as [HTMLElement, Text, HTMLElement]
      expect(value.nodeType).toBe(Node.ELEMENT_NODE)
      expect(gap.nodeType).toBe(Node.TEXT_NODE)
      expect(gap.data).toBe(' ')
      expect(slot.getAttribute('data-testid')).toBe(`factor-value-mark-slot-${ID}`)
      expect(within(slot).getByTestId('estimate-marker').textContent).toBe('est.')
      expect(tokens(slot).has('whitespace-nowrap'), 'the mark never splits').toBe(true)
      for (const push of ['ml-auto', 'absolute', 'float-right']) expect(tokens(slot).has(push), push).toBe(false)
      // The value is never cut.
      for (const cut of ['truncate', 'text-ellipsis', 'line-clamp-1']) expect(tokens(value).has(cut), cut).toBe(false)
      expect(visibleText(value)).toBe('Moderate engineering allocation (2 of 4 engineers)')
      expect(visibleText(row)).toBe('Moderate engineering allocation (2 of 4 engineers) est.')
      expect(Boolean(within(value).queryByTestId(`node-value-editor-${ID}`))).toBe(c.editor)
    })
  }
})

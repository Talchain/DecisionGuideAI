/**
 * "RESTS ON" PUTS EACH FIGURE'S NUMBER ON ITS CARD, AND SAYS WHO IT CAME FROM IN WORDS.
 *
 * Carries forward the retired evidence lens's rule (`BaseNode.evidenceLensSaysIt`, DL-3 18 Oct 2026): the lens must
 * not say it in colour alone, and an origin nobody can attest is NEVER shown as the user's. The marker's words are
 * the owner reader's own (`ASSUMPTION_MAP_COPY.columns`), bound to the card by identity (`data-target`).
 *
 * ⚠ jsdom cannot prove the marker is VISIBLE (trap 3). It proves the marker is RENDERED, bound to this card, with the
 * state the lens computed, and that pressing it selects this card.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import type { AssumptionColumn } from '../../artefacts/assumptionMapModel'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphLensEnabled: () => true }
})

const ID = 'fac_1'
const select = vi.fn()
const state = (column: AssumptionColumn | null, active = 'rests_on') => ({
  selectedNodeId: null, hoveredOptionId: null, nodes: [], edges: [],
  ceeAnalysisReady: null, results: { status: 'complete', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: {
    active, _dimmedNodeIds: new Set(),
    _restsOn: column ? new Map([[`node:${ID}`, { n: 3, column }]]) : new Map(),
  },
  goalThreshold: null, goalConstraints: [], viewMode: 'standard', lodRung: 'full',
})

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), { getState: () => ({ selectNodeWithoutHistory: select }) }),
}))

const props = {
  type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 240, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

function renderAt(column: AssumptionColumn | null, active = 'rests_on') {
  vi.mocked(useCanvasStore).mockImplementation((sel) => (sel as (s: unknown) => unknown)(state(column, active) as never))
  const r = render(
    <ReactFlowProvider>
      <FactorNode {...props} id={ID} data={{ label: 'Churn', kind: 'factor', category: 'external' }} />
    </ReactFlowProvider>,
  )
  // Positive control: the card mounted before any absence is asserted (trap 13).
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
  return r
}

const marker = () => screen.queryByTestId('rests-on-marker')

describe('"Rests on" numbers the card and says its origin in words', () => {
  beforeEach(() => select.mockClear())

  it('⭐ the card carries its number, bound to this card, with the state in words', () => {
    renderAt('unchecked')
    const m = marker()!
    expect(m.getAttribute('data-target')).toBe(`node:${ID}`)
    expect(m.textContent).toBe('3')
    expect(m.getAttribute('aria-label')).toBe('Figure 3: Olumi’s estimate, not yet checked')
  })

  it('⛔ an origin nobody can attest says so, and is never shown as yours', () => {
    renderAt('unknown')
    expect(marker()!.getAttribute('aria-label')).toBe('Figure 3: Origin not known')
    expect(marker()!.getAttribute('aria-label')).not.toMatch(/Yours/u)
    expect(marker()!.getAttribute('data-column')).toBe('unknown')
  })

  it('⛔ CONTRAST: an accepted estimate stays Olumi’s; only the user’s own figure says "Yours"', () => {
    const { unmount } = renderAt('accepted')
    expect(marker()!.getAttribute('aria-label')).toBe('Figure 3: Olumi’s estimate, you accepted it')
    unmount()
    renderAt('yours')
    expect(marker()!.getAttribute('aria-label')).toBe('Figure 3: Yours')
  })

  it('pressing the number selects this card (the key card opens it); it writes nothing else', () => {
    renderAt('missing')
    fireEvent.click(marker()!)
    expect(select).toHaveBeenCalledWith(ID)
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('⛔ CONTRAST: no number outside the "Rests on" lens, and none for a card the lens did not number', () => {
    const { unmount } = renderAt('unchecked', 'premortem')
    expect(marker()).toBeNull()
    unmount()
    renderAt(null)
    expect(marker()).toBeNull()
  })
})

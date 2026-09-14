/**
 * ⭐⭐⭐ THE HOST MUST CONSUME THE LENS DECISION — the row of tests that a mutant
 * can actually fail.
 *
 * `theLensSpendsTheQuietRung.spec.ts` pins the PREDICATE. A mutant that made
 * `BaseNode` ignore `selectLensDetailActive` entirely would leave all eight of
 * those green, because none of them renders a card — the identical shape that
 * let a `direction`-dropping mutant survive five row tests on the goal-ceiling
 * change earlier the same night. So the decision is pinned HERE, at the host,
 * against the rendered DOM.
 *
 * ⚠ WHAT THIS PROVES AND WHAT IT DOES NOT. jsdom has no layout (CLAUDE.md trap
 * 3), so this claims nothing about how the card LOOKS. It asserts the
 * `data-lod-hidden` marker — the same marker `BaseNode.lodQuietIsNoOp` binds to,
 * deliberately, so the two files cannot drift into describing different states.
 *
 * ⭐ AND THE SIBLING TRIPWIRE STILL HOLDS, WHICH IS THE POINT.
 * `BaseNode.lodQuietIsNoOp.spec.tsx` asserts `quiet === full`. It still passes,
 * unchanged, because its store double carries an EMPTY lens set. The claim has
 * narrowed from *"quiet is a no-op"* to *"quiet is a no-op unless a lens has set
 * this card aside"*, and that narrowing is visible in the pair rather than
 * hidden by an edit to the older file.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ActionNode } from '../ActionNode'
import { useCanvasStore } from '../../store'
import type { LodRung } from '../../utils/zoomLegibility'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphLensEnabled: () => true }
})

const DIMMED_ID = 'fac_set_aside'
const KEPT_ID = 'fac_on_the_path'

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  selectedNodeId: null,
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set([DIMMED_ID]), _hiddenNodeIds: new Set(), active: 'option' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'standard',
  lodRung: 'full' as LodRung,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

const baseProps = {
  type: 'action', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 240, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

/**
 * ⛔ THE FIXTURE MUST REACH THE BRANCH, AND MY FIRST ONE DID NOT.
 *
 * `lodBodyBlanked` is `bodyReduced && lodBodyLine !== null` — a card never loses
 * its content without something put in its place, which is a deliberate ruling
 * one level up in `BaseNode`. My first fixture was an external factor carrying a
 * bare value; its reduced line resolved to `null`, so the card could not blank
 * at ANY rung and two assertions failed for a reason that had nothing to do with
 * the lens. An `action` card with a description is the shape
 * `BaseNode.lodBodyLine.spec.tsx` already proves renders a line (Z2, :328), with
 * its own contrast control at :348 for the description-less case.
 *
 * Recording it rather than quietly swapping the fixture: a fixture chosen
 * because it happens to go green is how a test stops discriminating.
 */
const factorNode = (id: string) => (
  <ActionNode
    {...baseProps}
    type="action"
    id={id}
    data={{ label: 'Ship the pilot', type: 'action', description: 'Run a 4-week beta' }}
  />
)

const cardHtml = (id: string, lodRung: LodRung): string => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState({ lodRung }) as never),
  )
  const { container, unmount } = render(<ReactFlowProvider>{factorNode(id)}</ReactFlowProvider>)
  // Positive control, every call: a card that failed to mount must never reach
  // an assertion about what it rendered (trap 13).
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
  const html = container.innerHTML
  unmount()
  return html
}

describe('at `quiet`, the lens decides detail — not the camera', () => {
  it('⭐ a card the lens SET ASIDE shows less at `quiet`', () => {
    expect(cardHtml(DIMMED_ID, 'quiet')).toContain('data-lod-hidden')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a mutant that blanked EVERY card at
   * `quiet` passes the row above — and that is the old zoom behaviour wearing
   * the lens's clothes, i.e. the exact thing this change exists to replace.
   */
  it('⛔ CONTRAST: a card ON the lens path keeps its body at the same rung', () => {
    expect(cardHtml(KEPT_ID, 'quiet')).not.toContain('data-lod-hidden')
  })

  it('⛔ CONTRAST: zoom in past the icon floor and the set-aside card comes back', () => {
    expect(cardHtml(DIMMED_ID, 'full')).not.toContain('data-lod-hidden')
  })

  it('at `line` the camera still wins — every card, dimmed or not', () => {
    expect(cardHtml(DIMMED_ID, 'line')).toContain('data-lod-hidden')
    expect(cardHtml(KEPT_ID, 'line')).toContain('data-lod-hidden')
  })
})

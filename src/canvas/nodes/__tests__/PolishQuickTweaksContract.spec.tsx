/**
 * ⭐ MUTANT GUARD — `canvas/polish-quick-tweaks` (24 Sep 2026 bank, applied on
 * `canvas/polish-styling`).
 *
 * ⚠ WHY THIS FILE EXISTS. Reverting the four-file diff (BaseNode.tsx,
 * GhostOptionNode.tsx, GhostTierNode.tsx, TierLanes.tsx) back to base
 * `c07bbc49` and re-running every reader spec that names any of those
 * components — 210 files, 3218 tests — left ALL of them green. None of the
 * four contract points (dimmed opacity 60→25, the ghost "+" counter-scaling
 * with its label, the ghost-tier prompt fill matching the panel instead of
 * `transparent`, and the row-label token/tracking swap) had a spec pinning
 * its new value. This file is that pin, one `describe` per file touched.
 *
 * Bound by IDENTITY — role+accessible-name, an exported test id, or the
 * shared class-token constant the source itself now imports — never a
 * substring another element could also satisfy.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ReactNode } from 'react'
import type { LodRung } from '../../utils/zoomLegibility'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@xyflow/react')
  return {
    ...actual,
    Handle: () => null,
    // TierLanes renders inside a ViewportPortal, which needs the React Flow
    // zustand store; this file has no <ReactFlow> ancestor for it, so it is
    // passed through exactly as `TierLanes.titleInsideFit.spec.tsx` does.
    ViewportPortal: ({ children }: { children: ReactNode }) => children,
  }
})
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  // Isolate the dimmed-path assertion from lens-dimming (`isLensDimmed`),
  // the OTHER branch of the same ternary this change did not touch.
  isGraphLensEnabled: () => false,
}))

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  selectedNodeId: null,
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set<string>(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'standard',
  lodRung: 'full' as LodRung,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())),
}))

import { useCanvasStore } from '../../store'
import { ActionNode } from '../ActionNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { TierLanes } from '../TierLanes'
import { deriveTierLanes } from '../../utils/tierLanes'
import { CANVAS_GAP_CLASSES, CANVAS_GLYPH_SIZE_CLASSES } from '../shared/canvasGlyphScale'

afterEach(cleanup)

const baseNodeProps = {
  type: 'action',
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
  width: 240,
  height: 100,
  sourcePosition: undefined,
  targetPosition: undefined,
}

describe('BaseNode — path-dim rung is opacity-25, not the old opacity-60', () => {
  it('a node in `dimmedNodeIds` carries `opacity-25` on its own card root, and never `opacity-60`', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(
        makeStoreState({ dimmedNodeIds: new Set(['fac_1']) }) as never,
      ),
    )
    render(
      <ReactFlowProvider>
        <ActionNode
          {...baseNodeProps}
          id="fac_1"
          data={{ label: 'Ship the pilot', type: 'action' }}
        />
      </ReactFlowProvider>,
    )
    // Bound to THIS card by its own accessible name, not any group on the page.
    const card = screen.getByRole('group', { name: /node: Ship the pilot/ })
    const tokens = card.className.split(/\s+/).filter(Boolean)
    expect(tokens).toContain('opacity-25')
    expect(tokens).not.toContain('opacity-60')
  })
})

describe('GhostOptionNode — the "+" and its row share the counter-scale contract', () => {
  it('the Plus glyph carries `CANVAS_GLYPH_SIZE_CLASSES[14]`, and its row carries `CANVAS_GAP_CLASSES[6]`', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(makeStoreState() as never),
    )
    render(
      <ReactFlowProvider>
        <GhostOptionNode
          {...({
            id: '__ghost-option__',
            type: 'ghost-option',
            data: {},
            selected: false,
            zIndex: 0,
            isConnectable: false,
            xPos: 0,
            yPos: 0,
            dragging: false,
          } as unknown as NodeProps)}
        />
      </ReactFlowProvider>,
    )
    // The "+" is the only `aria-hidden` svg the door renders — bound to it by
    // that identity, not to "the first svg on the page".
    const icon = document.querySelector('svg[aria-hidden="true"]')
    expect(icon, 'the ghost-option "+" did not mount').toBeTruthy()
    for (const token of CANVAS_GLYPH_SIZE_CLASSES[14].split(' ').filter(Boolean)) {
      expect(icon!.getAttribute('class')).toContain(token)
    }
    const row = icon!.parentElement as HTMLElement
    for (const token of CANVAS_GAP_CLASSES[6].split(' ').filter(Boolean)) {
      expect(row.className).toContain(token)
    }
  })
})

describe('GhostTierNode — the prompt fill matches the panel, never `transparent`', () => {
  it('the door background is the panel token, --bg-panel', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      (selector as (s: unknown) => unknown)(makeStoreState() as never),
    )
    render(
      <ReactFlowProvider>
        <GhostTierNode
          {...({
            id: '__ghost-risk__',
            type: 'ghost-tier',
            data: { label: 'What else could go wrong?', prompt: 'q', tier: 'risk' },
            selected: false,
            dragging: false,
            zIndex: 0,
            isConnectable: false,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
          } as unknown as NodeProps)}
        />
      </ReactFlowProvider>,
    )
    const door = screen.getByTestId(GHOST_TIER_TESTID) as HTMLElement
    expect(door.style.background).toContain('var(--bg-panel')
    expect(door.style.background).not.toBe('transparent')
  })
})

describe('TierLanes — row labels are 10px (contract v3.1 `.layer-label`) at 0.5px tracking, not `nodeLabel`/`edgeLabel`/0.01em', () => {
  // DESIGN-GAP-AUDIT row 4 (24 Sep 2026, gap-frame-footer lane): the contract
  // fixture's `.layer-label` is 10px, one size below the `edgeLabel` token
  // (11px) this test used to pin. `TierLanes.tsx` now spells the size as a
  // LOCAL arbitrary-value class rather than through `typography.edgeLabel`
  // (see that file's header for why: the contract colour/uppercase pair had
  // to move to a `.module.css` file to stay outside `check-ds-compliance`'s
  // `.tsx`-scoped ratchets, and the size class moved with it for one owner).
  it("a lane title's font-size class is the contract's 10px, not `edgeLabel` (11px) or `nodeLabel` (12px)", () => {
    const board: Node[] = [
      {
        id: 'dec',
        type: 'decision',
        position: { x: 1064, y: 150 },
        data: { label: 'dec' },
        width: 336,
        height: 290,
      } as unknown as Node,
      {
        id: 'o1',
        type: 'option',
        position: { x: 100, y: 500 },
        data: { label: 'o1' },
        width: 336,
        height: 515,
      } as unknown as Node,
    ]
    render(<TierLanes nodes={board} />)
    const [lane] = deriveTierLanes(board)
    const title = screen.getByTestId(`tier-lane-${lane.tier}-title`)
    // contract v3.1 `.layer-label` = 10px; edgeLabel = 11px; nodeLabel (the
    // old token) = 12px — three distinct class strings, so this cannot pass
    // against any of the other two by accident.
    expect(title.className).toContain('text-[length:calc(10px*var(--canvas-label-scale,1))]')
    expect(title.className).not.toContain('text-[length:calc(11px*var(--canvas-label-scale,1))]')
    expect(title.className).not.toContain('text-[length:calc(12px*var(--canvas-label-scale,1))]')
    expect((title as HTMLElement).style.letterSpacing).toBe('0.5px')
    expect((title as HTMLElement).style.letterSpacing).not.toBe('0.01em')
  })
})

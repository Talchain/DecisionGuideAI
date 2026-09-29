/**
 * Canvas visual contract v3.1 — the overlay stack (DESIGN-GAP-v31 row 6).
 *
 *   v3.1: "Clicking a card opens only the inspector." Served: a factor click
 *   left the inspector AND the card's hover popover open (plus the dock row) —
 *   three surfaces. And an option hover drew blue rings around its target
 *   factors with a "→ Moderate (0.4)" tab above each — the prototype has no
 *   hover highlight at all (its path focus is SELECTION, which dims the rest).
 *
 * Pinned here:
 *   1. The LEGACY per-kind popover content (`NodePopover`'s children in the six
 *      wrappers — bands, tiers, chips) stays retired. Since 29 Sep 2026 (Paul)
 *      the card hover pop-up is `components/hoverCard/NodeHoverCard`, server
 *      data only, and it never opens on a SELECTED card — pinned, with its
 *      contrast, in `components/hoverCard/__tests__/NodeHoverCard.spec.tsx`.
 *   2. A plain option HOVER puts no tab and no ring on a factor; the explicit
 *      option LENS (an analysis mode the user turns on) still does — so the
 *      formatting pins in `FactorNode.spec.tsx` keep a live surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useRef, type ComponentProps } from 'react'
import { ReactFlowProvider } from '@xyflow/react'

import { NodePopover } from '../shared/NodePopover'
import { useCanvasStore } from '../../store'

function Harness({ nodeId, visible }: { nodeId: string; visible: boolean }) {
  // The anchor ref is populated at commit, before NodePopover's effect reads it.
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="react-flow__node" data-id={nodeId}>
      <div ref={ref}>anchor</div>
      <NodePopover visible={visible} anchorRef={ref} onMouseEnter={() => {}} onMouseLeave={() => {}}>
        <p>Popover detail for {nodeId}</p>
      </NodePopover>
    </div>
  )
}

function select(ids: string[]) {
  useCanvasStore.setState({
    selection: { nodeIds: new Set(ids), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

describe('v3.1 row 6 — a click leaves ONE surface: the popover yields to the inspector', () => {
  beforeEach(() => select([]))

  it('⭐ THE LEGACY POPOVER CONTENT STAYS RETIRED — an unselected, visible NodePopover renders nothing', async () => {
    // Its children were the old UI-derived detail (tier words over binary
    // values, band words, chips). The hover pop-up that replaced it
    // (29 Sep 2026) is `NodeHoverCard`, mounted by `BaseNode`, not this.
    render(<Harness nodeId="fac_a" visible />)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(screen.queryByText('Popover detail for fac_a')).toBeNull()
    expect(document.querySelector('[data-node-popover]')).toBeNull()
  })

  it('the SELECTED node\'s popover does not render (its inspector is the detail surface)', async () => {
    select(['fac_a'])
    render(<Harness nodeId="fac_a" visible />)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(screen.queryByText('Popover detail for fac_a')).toBeNull()
    expect(document.querySelector('[data-node-popover]')).toBeNull()
  })

})

// ── 2 · option hover: no rings, no tabs ───────────────────────────────────

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

import { FactorNode } from '../FactorNode'

const FACTOR_PROPS = {
  id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}
const FACTOR_DATA = {
  label: 'Marketing Expertise Available', type: 'factor', category: 'controllable',
  observedState: { value: 0.5, factor_type: 'quality' },
}

function seedOptionState(lens: { active: string; selectedOptionId: string | null }, hoveredOptionId: string | null) {
  useCanvasStore.setState({
    hoveredOptionId,
    lens: { ...useCanvasStore.getState().lens, ...lens },
    nodes: [
      { id: 'option-1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1', interventions: { 'factor-1': 0.7 } } },
      { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: FACTOR_DATA },
    ],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

const renderFactor = () => render(
  <ReactFlowProvider>
    <FactorNode {...(FACTOR_PROPS as unknown as ComponentProps<typeof FactorNode>)} data={FACTOR_DATA} />
  </ReactFlowProvider>,
)

describe('v3.1 row 6 — an option hover puts no tab and no ring on its target factors', () => {
  it('plain hover: no "→ value" tab, no ring', () => {
    seedOptionState({ active: 'full', selectedOptionId: null }, 'option-1')
    renderFactor()
    expect(screen.queryByTestId('factor-hover-intervention')).toBeNull()
    expect(screen.queryByTestId('factor-hover-ring')).toBeNull()
    expect(screen.queryByText(/^→/)).toBeNull()
  })

  it('⭐ CONTRAST — the explicit option LENS still marks its targets', () => {
    seedOptionState({ active: 'option', selectedOptionId: 'option-1' }, 'option-1')
    renderFactor()
    expect(screen.getByTestId('factor-hover-intervention').textContent).toMatch(/^→\s*High$/)
    expect(screen.getByTestId('factor-hover-ring')).toBeTruthy()
  })
})

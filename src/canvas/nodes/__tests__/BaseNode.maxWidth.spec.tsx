/**
 * BaseNode maxWidth tests (H1)
 *
 * Verifies that nodes respect maxWidth constraints and that long labels
 * do not cause layout overflow — break-words is applied.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import {
  NODE_CARD_MAX_W,
  REPEATED_CARD_W,
  REPEATED_CARD_MAX_W,
  ANCHOR_CARD_MAX_W,
  CARD_W_CAP_BY_TIER,
  TIER_BY_KIND,
  restingCardWidthForKind,
} from '../../utils/nodeLayoutConstants'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null,
    useUpdateNodeInternals: () => vi.fn(),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'node-1',
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'factor',
  data: { label: 'A very long label that might overflow the node boundary if not handled correctly' },
  xPos: 0,
  yPos: 0,
}

describe('BaseNode — maxWidth (H1)', () => {
  it('applies maxWidth style to node container', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} maxWidth={200} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('200px')
  })

  it('uses the KIND\'s resting width as the fallback when no maxWidth prop and no layout width (S4)', () => {
    // BaseNode's pre-layout fallback is the width the layout will give this
    // kind (`restingCardWidthForKind`), so the heights the first layout
    // measures are heights at the width it lays out — not at NODE_CARD_MAX_W,
    // which drew every card 76 units wider than its S4 slot and made the first
    // layout's heights stale. Asserted against the imported derivation, never a
    // literal, and for two kinds so one constant cannot satisfy both.
    // `deletable`/`selectable`/`draggable` are required by `BaseNodeProps` and read by no
    // assertion here; supplied so this case adds no type error to the file's baseline.
    //
    // ⚠ RE-PINNED 30 Sep 2026 (wider cards): the resting width is the tier CAP,
    // and a repeated tier's cap is now REPEATED_CARD_MAX_W (400), not the flat
    // REPEATED_CARD_W (248). The layout gives a repeated row its fair share inside
    // [248, 400] (5 cards → 270, 4 → 350, ≤ 3 → 400), so the premise above — "the
    // width the layout will give this kind" — now holds only for rows of three or
    // fewer; a longer row's first measure is taken at 400, wider than its slot.
    const factor = render(<BaseNode {...baseProps} deletable={false} selectable draggable={false} nodeType="factor" icon={Target} />)
    expect((factor.container.firstChild as HTMLElement).style.maxWidth).toBe(`${restingCardWidthForKind('factor')}px`)
    expect(restingCardWidthForKind('factor')).toBe(CARD_W_CAP_BY_TIER[TIER_BY_KIND.factor])
    expect(restingCardWidthForKind('factor')).toBe(REPEATED_CARD_MAX_W)
    expect(REPEATED_CARD_W).toBeLessThan(REPEATED_CARD_MAX_W)
    const decision = render(<BaseNode {...baseProps} deletable={false} selectable draggable={false} nodeType="decision" icon={Target} />)
    expect((decision.container.firstChild as HTMLElement).style.maxWidth).toBe(`${ANCHOR_CARD_MAX_W}px`)
    expect(REPEATED_CARD_W).not.toBe(NODE_CARD_MAX_W)
  })

  it('label element has break-words class to prevent overflow', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} maxWidth={200} />
    )
    // The label div should have break-words class
    const labelEl = container.querySelector('.break-words')
    expect(labelEl).toBeTruthy()
    expect(labelEl?.textContent).toContain('very long label')
  })

  it('uses maxWidth=238px for OptionNode (per spec)', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="option" icon={Target} maxWidth={238} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('238px')
  })

  it('title element clamps at two lines at a reading rung — the whole label is in the DOM and the hover pop-up (Paul, 27 Oct)', () => {
    // A 60+ char label that, at typography.nodeTitle size and normal node
    // widths, wraps onto 4+ lines.
    const longLabel =
      'Feature Launch Marketing Budget Allocation and Campaign Strategy Optimisation'
    const { container } = render(
      <BaseNode
        {...baseProps}
        data={{ label: longLabel }}
        nodeType="decision"
        icon={Target}
        maxWidth={240}
      />
    )
    // Select by the break-words class to uniquely identify the title element.
    const titleEl = container.querySelector('.break-words') as HTMLElement | null
    expect(titleEl, 'title element with break-words should exist').toBeTruthy()
    expect(titleEl?.textContent).toBe(longLabel)
    // ⭐ Paul, 27 Oct 2026: no card title runs past two lines; the full title is
    // in the card's existing hover pop-up. This replaces v3.1 WS1 #2 (26 Sep
    // 2026: "never clamp at a reading rung"). Exactly one clamp, of depth two.
    expect((titleEl?.className ?? '').match(/\bline-clamp-\d+\b/g)).toEqual(['line-clamp-2'])
    expect(titleEl?.className).toContain('break-words')
  })
})

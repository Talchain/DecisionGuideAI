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

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
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

  it('uses MAX_NODE_W (320px) fallback when no maxWidth prop and no layoutNodeWidth', () => {
    // BaseNode's pre-layout fallback is sourced from the ELK MAX_NODE_W constant
    // (imported from ../utils/layout) so the rendered width matches ELK's
    // assumed box size once a layout has run.
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('320px')
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

  it('title element clamps long labels to 3 lines with ellipsis (line-clamp-3)', () => {
    // A 60+ char label that, at typography.nodeTitle size and normal node
    // widths, would naturally wrap onto 4+ lines without a clamp.
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
    // The clamp must be applied to the title <div> itself (the one carrying
    // `break-words`), not the outer node wrapper. Select by the break-words
    // class to uniquely identify the title element in BaseNode's render tree.
    const titleEl = container.querySelector('.break-words') as HTMLElement | null
    expect(titleEl, 'title element with break-words should exist').toBeTruthy()
    expect(titleEl?.textContent).toBe(longLabel)
    expect(titleEl?.className).toContain('line-clamp-3')
    // Existing break-words behaviour must remain alongside the new clamp.
    expect(titleEl?.className).toContain('break-words')
  })
})

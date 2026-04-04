/**
 * BaseNode width tests
 *
 * Verifies that nodes use layout-driven width (single source of truth)
 * and that long labels do not cause layout overflow — break-words is applied.
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

describe('BaseNode — width (layout-driven)', () => {
  it('uses 220px fallback maxWidth when no layout has run', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('220px')
  })

  it('uses per-node layoutWidth from data when available', () => {
    const { container } = render(
      <BaseNode
        {...baseProps}
        nodeType="factor"
        icon={Target}
        data={{ ...baseProps.data, layoutWidth: 200 }}
      />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('200px')
  })

  it('label element has break-words class to prevent overflow', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} />
    )
    const labelEl = container.querySelector('.break-words')
    expect(labelEl).toBeTruthy()
    expect(labelEl?.textContent).toContain('very long label')
  })

  it('has minWidth of 180px', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.minWidth).toBe('180px')
  })
})

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
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
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

  it('uses default 200px maxWidth when no maxWidth prop given', () => {
    const { container } = render(
      <BaseNode {...baseProps} nodeType="factor" icon={Target} />
    )
    const nodeEl = container.firstChild as HTMLElement
    expect(nodeEl.style.maxWidth).toBe('200px')
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
})

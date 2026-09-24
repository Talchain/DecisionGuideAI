/**
 * ⛔ P0 (Panel → Canvas, #63 5810356214, 24 Sep 2026, wire-witnessed on served
 * `25314672`): the factor card's inline editor opened in MODEL scale and
 * committed in USER units. One nudge corrupted the model.
 *
 * The card read "49 £/month". The editor opened at `0.245` (`observedState.value`,
 * model scale). The user typed `0.25`; the commit path
 * (`proposeFactorValue` → `buildFactorValueEditEvent` → `resolveValueInputSeed`)
 * sees a `raw_value`, so reads the typed number as £ and the wire carried
 * `{value: 0.00125, raw_value: 0.25, unit: '£/month'}` — CEE replied "Updated Pro
 * monthly price from 49 £/month to 0.25 £/month", stamped as the user's own value.
 *
 * The seed and the commit disagreed about scale. Every sibling editor seeds from
 * the ONE rule (`resolveValueInputSeed(node.data).seed` — `WhatIWasGivenSection`,
 * `CalibrateDrillIn`, `FactorControllablePanel`); the card now does too.
 *
 * ⭐ BOUND BY IDENTITY TO THE REAL SCALE DECISION. The mocked authority runs the
 * REAL `buildFactorValueEditEvent` over the SAME node data the card renders, so
 * the payload asserted below is the one the wire would carry — a spy on the typed
 * number alone could not tell a £ commit from a model-scale one.
 *
 * CLAIM SCOPE: jsdom — the input's value and the built payload, not layout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { buildFactorValueEditEvent } from '../../conversation/factorValueEdit'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode: 'standard',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const NODE_ID = 'pro_monthly_price'
let nodeData: Record<string, unknown> = {}
const built: Array<Record<string, unknown> | null> = []

vi.mock('../../hooks/useModelEditAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useModelEditAuthority')>()
  return {
    ...actual,
    useModelEditAuthority: () => new Proxy({}, {
      get: (_t, key) => key === 'proposeFactorValue'
        ? (typedValue: number) => {
            const event = buildFactorValueEditEvent({ nodeId: NODE_ID, typedValue, nodeData })
            built.push(event ? (event.payload as Record<string, unknown>) : null)
            return event ? 'dispatched' : 'not_encodable'
          }
        : () => undefined,
    }),
  }
})

const baseProps = {
  id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

/** The witnessed shape: a capped £ factor whose model value is raw / cap. */
const PRICE = { value: 0.245, raw_value: 49, cap: 200, unit: '£/month', source: 'brief_extraction' }

const renderFactor = (observedState: Record<string, unknown>) => {
  nodeData = { label: 'Pro monthly price', kind: 'factor', category: 'controllable', observedState }
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={nodeData} />
    </ReactFlowProvider>,
  )
}

const openEditor = (c: HTMLElement): HTMLInputElement => {
  const button = c.querySelector<HTMLElement>(`[data-testid="node-value-editor-${NODE_ID}"]`)
  expect(button, 'precondition: the inline editor renders on a controllable factor').not.toBeNull()
  fireEvent.click(button!)
  const input = c.querySelector<HTMLInputElement>('input')
  expect(input, 'the editor opened').not.toBeNull()
  return input!
}

const commit = (input: HTMLInputElement, typed: string) => {
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

beforeEach(() => { built.length = 0; cleanup() })

describe('the inline factor editor opens in the scale it commits in', () => {
  it('seeds the USER-unit figure the card shows (49), not the model scale (0.245)', () => {
    const { container } = renderFactor(PRICE)
    expect(openEditor(container).value).toBe('49')
  })

  it('NUDGING the seeded figure commits a nudge — the witnessed act (0.245 → 0.25 sent £0.25)', () => {
    // The user does not type from nowhere: they change what the field shows.
    // Whatever the seed is, +2% of it must land as +2% of the £49 on the card.
    const { container } = renderFactor(PRICE)
    const input = openEditor(container)
    commit(input, String(Number(input.value) * 1.02))
    expect(built).toHaveLength(1)
    expect(built[0]!.raw_value as number).toBeCloseTo(49.98, 6)
    expect(built[0]!.value as number).toBeCloseTo(0.2499, 6)
  })

  it('committing 50 sends £50 (value 0.25)', () => {
    const { container } = renderFactor(PRICE)
    commit(openEditor(container), '50')
    expect(built).toHaveLength(1)
    expect(built[0]).toMatchObject({ raw_value: 50, value: 0.25 })
  })

  it('an untouched field commits nothing (the no-op compare is in the same scale)', () => {
    const { container } = renderFactor(PRICE)
    const input = openEditor(container)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(built).toHaveLength(0)
  })

  it('CONTRAST: an uncapped factor (raw === value) seeds and commits the same figure', () => {
    const { container } = renderFactor({ value: 40000, raw_value: 40000, unit: '£', source: 'brief_extraction' })
    const input = openEditor(container)
    expect(input.value).toBe('40000')
    commit(input, '41000')
    expect(built).toHaveLength(1)
    expect(built[0]).toMatchObject({ raw_value: 41000 })
  })
})

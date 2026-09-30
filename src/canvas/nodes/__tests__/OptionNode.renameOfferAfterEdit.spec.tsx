/**
 * AIQ 5908802422 §3: after the user's value edit, the card's own confirmation OFFERS the rename — "Also rename it
 * '…£80,000…'?" — one press through the durable rename route (`updateNodeLabel`), the user's choice, the only way the
 * label changes. No offer before an edit, after a refused edit, or when the rename is ambiguous. Mocks copied from
 * OptionNode.valuesEditInPlace.spec.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

// £ unit with a cap of 100,000: the frame is the factor's own unit, so "£90k" means 0.9 on the model scale.
// The option sets £80k against today's £60k, so the row is a concrete change and shows.
const FACTOR = { id: 'f-cost', type: 'factor', data: { label: 'Annual platform cost', type: 'factor', observedState: { value: 0.6, raw_value: 60000, unit: '£', cap: 100000 } } }
let OPTION_LABEL = 'Switch at £80k'
let VALUE = 0.8 // the store's value: a sent edit lands in it, as the real store's optimistic write does
const optionData = () => ({ label: OPTION_LABEL, type: 'option', interventions: { 'f-cost': VALUE } })
const updateNodeLabel = vi.fn()
const makeStoreState = () => ({
  hoveredOptionId: null, nodes: [FACTOR, { id: 'opt-a', type: 'option', data: optionData() }], edges: [], ceeAnalysisReady: null, results: { status: 'idle' },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
  goalConstraints: [], setHoveredOption: vi.fn(), viewMode: 'standard', lodRung: 'full', updateNodeLabel,
})
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())), { getState: () => makeStoreState() }),
}))
vi.mock('../../layoutStore', () => ({ useLayoutStore: vi.fn((selector: (s: unknown) => unknown) => selector({ layoutNodeWidth: null })) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({ sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null,
    valueOfInformation: null, voiRank: null })),
}))
let outcome: 'dispatched' | 'needs_fresh_base' = 'dispatched'
const proposeOptionIntervention = vi.fn((..._args: unknown[]) => { const opts = _args[2] as { onSendSettled?: (s: string) => void } | undefined; if (outcome === 'dispatched') { VALUE = _args[1] as number; opts?.onSendSettled?.('sent') } return outcome })
vi.mock('../../hooks/useModelEditAuthority', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useModelEditAuthority')>()),
  useModelEditAuthority: () => new Proxy({}, { get: (_t, k) => (k === 'proposeOptionIntervention' ? proposeOptionIntervention : () => undefined) }),
}))

const TESTID = 'option-value-editor-opt-a-f-cost'
function renderCard() {
  return render(
    <ReactFlowProvider>
      <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable id="opt-a" data={optionData()} {...({} as any)} />
    </ReactFlowProvider>,
  )
}
function editTo(text: string) {
  fireEvent.click(screen.getByTestId(TESTID))
  const input = screen.getByTestId(`${TESTID}-input`) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}
const OFFER = 'option-rename-offer-opt-a'
afterEach(() => cleanup())
beforeEach(() => { proposeOptionIntervention.mockClear(); updateNodeLabel.mockClear(); outcome = 'dispatched'; OPTION_LABEL = 'Switch at £80k'; VALUE = 0.8 })

describe('the edit offers the rename', () => {
  it('CONTROL: no offer before an edit, even when the label names a figure the card does not set', () => {
    OPTION_LABEL = 'Switch at £70k'
    renderCard()
    expect(screen.queryByTestId(OFFER)).toBeNull()
  })

  it('RED: after a sent edit the card offers the rename; the press renames through updateNodeLabel', async () => {
    renderCard(); editTo('90000')
    const accept = await screen.findByTestId(`${OFFER}-accept`)
    expect(accept.textContent).toBe('Also rename it ‘Switch at £90,000’?')
    fireEvent.click(accept)
    expect(updateNodeLabel).toHaveBeenCalledTimes(1)
    expect(updateNodeLabel.mock.calls[0][0]).toBe('opt-a')
    expect(updateNodeLabel.mock.calls[0][1]).toBe('Switch at £90,000')
  })

  it('declining keeps the name and removes the offer', async () => {
    renderCard(); editTo('90000')
    fireEvent.click(await screen.findByTestId(`${OFFER}-decline`))
    expect(screen.queryByTestId(OFFER)).toBeNull()
    expect(updateNodeLabel).not.toHaveBeenCalled()
  })

  it('no offer after a refused edit, or when the rename is ambiguous (two figures)', async () => {
    outcome = 'needs_fresh_base'
    renderCard(); editTo('90000')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId(OFFER)).toBeNull()
    cleanup()
    outcome = 'dispatched'; OPTION_LABEL = 'Switch from £60k to £80k'; VALUE = 0.8
    renderCard(); editTo('90000')
    await waitFor(() => expect(proposeOptionIntervention).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId(OFFER)).toBeNull()
  })
})

/**
 * ⭐ E1b — an option's values are edited ON the option card, through the inspector's own frame and writer
 * (`optionTargetEntry` → `proposeOptionIntervention` → `option_intervention_edit`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { OPTION_INTERVENTION_NEEDS_FRESH_BASE } from '../../ui/inspector-v2/shared/optionInterventionCopy'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

// £ unit with a cap of 100,000: the frame is the factor's own unit, so "£90k" means 0.9 on the model scale.
// The option sets £80k against today's £60k, so the row is a concrete change and shows.
const FACTOR = { id: 'f-cost', type: 'factor', data: { label: 'Annual platform cost', type: 'factor', observedState: { value: 0.6, raw_value: 60000, unit: '£', cap: 100000 } } }
const OPTION = { id: 'opt-a', type: 'option', data: { label: 'Switch vendor', type: 'option', interventions: { 'f-cost': 0.8 } } }
const makeStoreState = () => ({
  hoveredOptionId: null, nodes: [FACTOR, OPTION], edges: [], ceeAnalysisReady: null, results: { status: 'idle' },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
  goalConstraints: [], setHoveredOption: vi.fn(), viewMode: 'standard', lodRung: 'full',
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
const proposeOptionIntervention = vi.fn((..._args: unknown[]) => outcome)
vi.mock('../../hooks/useModelEditAuthority', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useModelEditAuthority')>()),
  useModelEditAuthority: () => new Proxy({}, { get: (_t, k) => (k === 'proposeOptionIntervention' ? proposeOptionIntervention : () => undefined) }),
}))

const TESTID = 'option-value-editor-opt-a-f-cost'
function renderCard() {
  return render(
    <ReactFlowProvider>
      <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable id="opt-a" data={OPTION.data} {...({} as any)} />
    </ReactFlowProvider>,
  )
}
function typeInto(text: string) {
  fireEvent.click(screen.getByTestId(TESTID))
  const input = screen.getByTestId(`${TESTID}-input`) as HTMLInputElement
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input
}
beforeEach(() => { proposeOptionIntervention.mockClear(); outcome = 'dispatched' })

describe('an option value is edited on the card', () => {
  it('opens seeded in the factor\'s unit, and "£90k" proposes 0.9 for that factor', () => {
    renderCard()
    fireEvent.click(screen.getByTestId(TESTID))
    expect((screen.getByTestId(`${TESTID}-input`) as HTMLInputElement).value).toBe('80,000')
    expect(screen.getByTestId(`${TESTID}-prefix`).textContent).toBe('£')
    const input = screen.getByTestId(`${TESTID}-input`) as HTMLInputElement
    fireEvent.change(input, { target: { value: '£90k' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    expect(proposeOptionIntervention.mock.calls[0][0]).toBe('f-cost')
    expect(proposeOptionIntervention.mock.calls[0][1]).toBeCloseTo(0.9, 9)
  })

  it('the same figure typed again sends nothing', () => {
    renderCard(); typeInto('80000')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
  })

  it('an unreadable entry is refused on the card with a sentence, and nothing is sent', () => {
    renderCard(); typeInto('lots')
    expect(proposeOptionIntervention).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${TESTID}-input`)).toBeDefined() // stays open with the typed text
  })

  it('a refusal from the writer is said in the inspector\'s words, never shown as saved', () => {
    outcome = 'needs_fresh_base'
    renderCard(); typeInto('70000')
    expect(screen.getByText(OPTION_INTERVENTION_NEEDS_FRESH_BASE)).toBeDefined()
  })
})

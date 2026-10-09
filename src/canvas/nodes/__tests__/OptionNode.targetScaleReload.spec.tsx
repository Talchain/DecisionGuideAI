import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { OptionPanel } from '../../ui/inspector-v2/panels/OptionPanel'
import { useCanvasStore } from '../../store'
import { loadState, saveState } from '../../persist'
import { normalisePersistedGraph } from '../../utils/normalisePersistedGraph'
import { buildOptionTargetRow, resolveOptionTargets } from '../shared/optionTargetDisplay'
import { changeRowValueText } from './__helpers__/optionChangeRowText'

// Keep the store, target readers, formatters and both mounted surfaces real.
// Layout and write authority are irrelevant to this read-only reload witness.
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../hooks/useModelEditAuthority', async (original) => ({
  ...(await original<typeof import('../../hooks/useModelEditAuthority')>()),
  useModelEditAuthority: () => new Proxy({}, { get: () => () => undefined }),
}))

const FACTOR = 'f-price'
const OPTION = 'opt-raise'
// InterventionSchema/CEEInterventionV3 spell the intervention's provenance
// `source`; raw_value and unit survive InterventionSchema's passthrough.
const USER_TARGET = { value: 0.295, raw_value: 59, unit: '£', source: 'user_specified' }
function graph(factorData: Record<string, unknown> = {}, target: unknown = USER_TARGET): Node[] {
  return [
    { id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: {
      label: 'Monthly price', type: 'factor', category: 'controllable',
      scale_frame: 200, observedState: { value: 0.245, unit: '£' }, ...factorData,
    } },
    { id: OPTION, type: 'option', position: { x: 100, y: 0 }, data: {
      label: 'Raise price', type: 'option', interventions: { [FACTOR]: target },
    } },
  ]
}
function seed(nodes = graph()) {
  useCanvasStore.setState({ nodes, edges: [], ceeAnalysisReady: null, results: { status: 'idle' },
    currentScenarioId: null, goalConstraints: [], goalThreshold: null,
    selection: { nodeIds: new Set(), edgeIds: new Set() },
  } as never)
}
function mountAndRead(expectedRow = '£49 → £59', expectedInput = '59') {
  const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)!
  render(<ReactFlowProvider>
    <OptionNode type="option" position={{ x: 100, y: 0 }} selected={false} isConnectable
      positionAbsoluteX={100} positionAbsoluteY={0} dragging={false} zIndex={0}
      deletable selectable draggable id={OPTION} data={option.data} {...({} as any)} />
    <OptionPanel nodeId={OPTION} techMode={false} onClose={() => {}} onNavigate={() => {}} readOnly />
  </ReactFlowProvider>)
  const row = screen.getByTestId(`option-change-row-${OPTION}-${FACTOR}`)
  const inspector = screen.getByTestId(`inspector-intervention-${FACTOR}`)
  const input = inspector.querySelector('input')
  // Soft assertions expose both halves of the original defect in RED output.
  expect.soft(changeRowValueText(row)).toBe(expectedRow)
  expect.soft(input, 'inspector box visible in the default view').not.toBeNull()
  expect.soft(input?.value).toBe(expectedInput)
  fireEvent.click(screen.getByTestId(`option-value-editor-${OPTION}-${FACTOR}`))
  expect.soft((screen.getByTestId(`option-value-editor-${OPTION}-${FACTOR}-input`) as HTMLInputElement).value)
    .toBe(expectedInput)
}

beforeEach(() => { localStorage.clear(); seed() })

describe('DL 87114: one option target frame survives reload', () => {
  it('R1: scale_frame 200, no observed cap: card £59 and visible inspector 59', () => {
    expect(useCanvasStore.getState().nodes[0].data.observedState).not.toHaveProperty('cap')
    mountAndRead()
  })

  it('R2: real saveState → loadState → hydrateGraphSlice boot path retains £59 / 59', () => {
    expect(saveState({ nodes: useCanvasStore.getState().nodes, edges: [] })).toBe(true)
    cleanup()
    seed([])
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    useCanvasStore.getState().hydrateGraphSlice({ nodes: loaded!.nodes, edges: loaded!.edges })
    expect(useCanvasStore.getState().nodes[1].data.interventions).toEqual({ [FACTOR]: USER_TARGET })
    mountAndRead()
  })

  it('R2 server shape: saved CEE JSON → normalisePersistedGraph → store hydrate also retains £59 / 59', () => {
    const saved = JSON.stringify({ nodes: [
      { id: FACTOR, kind: 'factor', label: 'Monthly price', category: 'controllable', scale_frame: 200,
        observed_state: { value: 0.245, unit: '£' } },
      { id: OPTION, kind: 'option', label: 'Raise price', interventions: { [FACTOR]: USER_TARGET } },
    ], edges: [] })
    seed([])
    const loaded = normalisePersistedGraph(JSON.parse(saved))
    useCanvasStore.getState().hydrateGraphSlice({ nodes: loaded.nodes as Node[], edges: loaded.edges })
    mountAndRead()
  })

  it('R3 contrast: observed cap, no intervention raw_value keeps staging £49 → £59 / 59', () => {
    seed(graph({ scale_frame: undefined, observedState: { value: 0.245, raw_value: 49, unit: '£', cap: 200 } }, 0.295))
    mountAndRead('£49 → £59')
  })

  it('the user cell owns its unit and scale over conflicting factor frame/cap/anchor', () => {
    seed(graph({ unit: '$', scale_frame: 400, observedState: { value: 0.245, raw_value: 98, unit: '$', cap: 100 } }))
    mountAndRead('$98 → £59', '59')
  })

  it('scale_frame precedes observed cap for a target without raw_value', () => {
    seed(graph({ observedState: { value: 0, raw_value: 0, unit: '£', cap: 400 } }, 0.295))
    mountAndRead('£0 → £59', '59')
  })

  it('CEE joined details retain a user-owned raw cell rather than losing it before the shared reader', () => {
    const nodes = graph({ unit: '$', scale_frame: 400, observedState: { value: 0, raw_value: 0, unit: '$' } })
    const targets = resolveOptionTargets(nodes[1].data, { id: OPTION, interventions: { [FACTOR]: 0.295 },
      intervention_details: { [FACTOR]: USER_TARGET } })
    const row = buildOptionTargetRow({ factorId: FACTOR, target: targets.get(FACTOR)!, factorNode: nodes[0], baselineReference: null })
    expect(row.target).toBe('£59')
  })

  it('a bare equal CEE carrier preserves the node’s user-owned cell on all three paths', () => {
    seed(graph({ unit: '$', scale_frame: 400, observedState: { value: 0, raw_value: 0, unit: '$' } }))
    useCanvasStore.setState({ ceeAnalysisReady: { options: [{ id: OPTION, interventions: { [FACTOR]: 0.295 } }] } } as never)
    mountAndRead('$0 → £59')
  })

  it('an Olumi raw cell does not take precedence over the factor frame or unit', () => {
    const nodes = graph({ unit: '$', scale_frame: 400, observedState: { value: 0, raw_value: 0, unit: '$' } },
      { ...USER_TARGET, source: 'cee_hypothesis' })
    const targets = resolveOptionTargets(nodes[1].data, null)
    expect(buildOptionTargetRow({ factorId: FACTOR, target: targets.get(FACTOR)!, factorNode: nodes[0], baselineReference: null }).target)
      .toBe('$118')
  })
})

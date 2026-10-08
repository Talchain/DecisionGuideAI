/**
 * WHAT-IF "PUT IT BACK" (DL #85 5942153284, option B, LOW): the "Since the last run" card pre-fills THE CARD'S OWN value
 * editor with the earlier value; the user commits with Enter through the EXISTING writer.
 *
 * Driven through the REAL FactorNode editor, the REAL store and the REAL `proposeFactorValue`; only the network edge
 * (`sendSystemEvent`) is stubbed (the `FactorObservablePanel.valueReachesTheModel` pattern). The delta is contract-parsed.
 *
 * Rows:
 *   WI1  ROUND TRIP (DL row 1): Put it back → the editor opens with the earlier value → Enter → the store holds EXACTLY
 *        the earlier stored value (raw_value + value), and exactly one `factor_value_edit` carries it. Uncapped AND
 *        capped (where raw and model scale differ, so a scale error cannot hide).
 *   WI2  nothing is written until the user presses Enter (the click only opens the editor).
 *   WI3  UNIT GUARD (DL row 2): the row's unit ≠ the node's display unit → no "Put it back"; CONTRAST: same unit → shown.
 *   WI4  no editor on the card (not a controllable factor) → no "Put it back".
 *   WI5  a request opens the editor once: it is retired after use, so a remount does not re-open it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta } from '@talchain/schemas/fixtures'

const sendSystemEvent = vi.fn()
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Handle: () => null,
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../../nodes/FactorNode'
import { RunChangesSummary, RUN_CHANGES_SUMMARY_TESTID, PUT_IT_BACK_COPY } from '../../components/RunChangesSummary'
import { useValuePrefillStore, valuePrefillOfRow } from '../valuePrefill'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { normaliseRawFactorValue } from '../../utils/observedStateHelpers'

const ID = 'fac_platform_cost'
const P = RUN_CHANGES_SUMMARY_TESTID

function delta(before: { raw: number; unit?: string }, after: { raw: number; unit?: string }): RunDelta {
  const d = {
    ...maximalRunDelta,
    input_coverage: 'complete',
    input_changes: [{
      entity_kind: 'factor_value', entity_id: ID, field: 'value',
      label_before: 'Annual Platform Cost', label_after: 'Annual Platform Cost', before, after, change: 'changed',
    }],
  }
  const parsed = RunDeltaSchema.safeParse(d)
  expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true)
  return d as unknown as RunDelta
}

function factor(observedState: Record<string, unknown>, category = 'controllable') {
  return { id: ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', type: 'factor', label: 'Annual Platform Cost', category, observedState } }
}

function seed(node: ReturnType<typeof factor>, d: RunDelta) {
  useCanvasStore.setState({
    nodes: [node], edges: [],
    runDelta: { delta: d, analysisHash: 'hash-A', scenarioId: 'scn-1' },
    currentScenarioId: 'scn-1',
    results: { status: 'complete', hash: 'hash-A', report: {} },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  useValuePrefillStore.setState({ request: null })
}

function mountBoth() {
  const node = useCanvasStore.getState().nodes[0] as unknown as { id: string; data: Record<string, unknown> }
  const props = {
    id: node.id, type: 'factor', data: node.data, selected: false, dragging: false, zIndex: 0,
    isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0,
  } as unknown as Parameters<typeof FactorNode>[0]
  return render(
    <ReactFlowProvider>
      <RunChangesSummary />
      <FactorNode {...props} />
    </ReactFlowProvider>,
  )
}

const stored = () => (useCanvasStore.getState().nodes[0] as unknown as { data: { observedState: { value: number; raw_value?: number } } }).data.observedState
const editorInput = () => screen.getByTestId(`node-value-editor-${ID}-input`) as HTMLInputElement

beforeEach(() => {
  sendSystemEvent.mockReset()
  sendSystemEvent.mockResolvedValue(undefined)
})
afterEach(() => { cleanup() })

describe('WI1 · round trip to the EXACT earlier stored value, through the real writer', () => {
  it('uncapped £ factor: £80,000 → Put it back → 60000 → Enter → stored 60000', async () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    fireEvent.click(screen.getByTestId(`${P}-put-back`))
    expect(editorInput().value).toBe('60000')
    await act(async () => { fireEvent.keyDown(editorInput(), { key: 'Enter' }) })
    expect(stored().value).toBe(60000)
    expect(stored().raw_value).toBe(60000)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0][0] as { type: string; payload: Record<string, unknown> }
    expect(event.type).toBe('factor_value_edit')
    expect(event.payload.target_id).toBe(ID)
    expect(event.payload.raw_value).toBe(60000)
  })
  it('capped factor (model scale ≠ user units): 80 → Put it back → 49 → stored raw 49 and value 49/200', async () => {
    const CAP = 200
    seed(factor({ value: 80 / CAP, raw_value: 80, cap: CAP, unit: '£' }), delta({ raw: 49, unit: '£' }, { raw: 80, unit: '£' }))
    mountBoth()
    fireEvent.click(screen.getByTestId(`${P}-put-back`))
    expect(editorInput().value).toBe('49')
    await act(async () => { fireEvent.keyDown(editorInput(), { key: 'Enter' }) })
    expect(stored().raw_value).toBe(49)
    expect(stored().value).toBeCloseTo(normaliseRawFactorValue(49, CAP), 10)
    expect((sendSystemEvent.mock.calls[0][0] as { payload: Record<string, unknown> }).payload.raw_value).toBe(49)
  })
})

describe('WI2 · the click only opens the editor; nothing is written until Enter', () => {
  it('Put it back → editor open, store unchanged, no event', () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    fireEvent.click(screen.getByTestId(`${P}-put-back`))
    expect(editorInput().value).toBe('60000')
    expect(stored().value).toBe(80000)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

describe('WI3 · UNIT GUARD: no Put it back when the row\'s unit is not the node\'s own', () => {
  it('row "%" on a "£" node → none (pure + rendered); CONTRAST: same unit → shown', () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 7, unit: '%' }, { raw: 12, unit: '%' }))
    const view = buildRunDeltaView(useCanvasStore.getState().runDelta!.delta, () => null)
    expect(valuePrefillOfRow(view.inputs!.rows[0], useCanvasStore.getState().runDelta!.delta, useCanvasStore.getState().nodes as never)).toBeNull()
    mountBoth()
    expect(screen.queryByTestId(`${P}-put-back`)).toBeNull()
    cleanup()
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    expect(screen.getByTestId(`${P}-put-back`)).toHaveTextContent(PUT_IT_BACK_COPY)
  })
})

describe('WI4 · no editor on the card → no Put it back', () => {
  it('an observable factor (the card mounts no value editor) gets no control', () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }, 'observable'), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    expect(screen.queryByTestId(`${P}-put-back`)).toBeNull()
  })
})

describe('WI5 · a request opens the editor once', () => {
  it('after the editor opens, the request is retired', () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    fireEvent.click(screen.getByTestId(`${P}-put-back`))
    expect(editorInput().value).toBe('60000')
    expect(useValuePrefillStore.getState().request).toBeNull()
  })
})

describe('Q10 · the pill never runs two controls into one word', () => {
  it('"Put it back" and "Why?" stay separate words in the status line', () => {
    seed(factor({ value: 80000, raw_value: 80000, unit: '£' }), delta({ raw: 60000, unit: '£' }, { raw: 80000, unit: '£' }))
    mountBoth()
    const status = screen.getByTestId(`${P}-put-back`).closest('[role="status"]')!
    expect(status.textContent).toContain('Put it back Why?')
    expect(status.textContent).not.toContain('Put it backWhy?')
  })
})

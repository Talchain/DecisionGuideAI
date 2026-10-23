/**
 * A PROGRAM LINK'S VALUE IS ITS COEFFICIENT, IN NATURAL UNITS, SENT AS `factor_value_edit` TO THE COEFFICIENT.
 *
 * A program graph is recognised by the field CEE sets on the saved model, `living_model.model_program` ("v1"). Its
 * effect links carry `coefficient_id`, the canonical quantity behind them; CEE refuses `edge_strength_edit` there.
 * Real path: the real `useSavedGraph` read (only `fetch` stubbed, answering with read bodies taken from the served
 * smoke-alpha2 capacity read and the café read, under the wire's `scenario_graph.v1` schema), the real mapper, the real `EdgePanel`; the conversation is replaced at
 * its seam so the sent event can be read. Expected values are spelled inline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }
})

const sendSystemEvent = vi.fn<[WireSystemEvent, unknown?], Promise<string>>(() => Promise.resolve('SENT'))
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

type Rec = Record<string, unknown>

// ── The capacity program read (smoke-alpha2 capacity-r1.read.json, trimmed to what these rows read) ──
const CAP_ID = 'de719c71-d0d4-471d-b4a0-1b173d75fa0c'
const COEF_EDGE: Rec = {
  from: 'specialists_added', to: 'additional_capacity',
  strength: { mean: 1, std: 0.001 }, exists_probability: 1, effect_direction: 'positive',
  provenance: {
    source: 'brief_extraction', magnitude: 'user_stated',
    natural_effect: {
      amount: 20, amount_unit: 'ticket/week', per_source_change: 1, per_source_change_unit: 'specialist',
      strength_mean: 1, strength_mean_frame: 'edge_strength',
    },
  },
  origin: 'model_program:calculation',
  coefficient_id: 'capacity_per_specialist',
  id: 'specialists_added__additional_capacity',
}
const capacityRead = (coefficientValue: number, graphHash: string, edge: Rec = COEF_EDGE): Rec => ({
  schema: 'scenario_graph.v1',
  scenario_id: CAP_ID,
  graph_present: true,
  graph_hash: graphHash,
  graph: {
    nodes: [
      { id: 'specialists_added', kind: 'factor', label: 'Additional specialists' },
      { id: 'additional_capacity', kind: 'outcome', label: 'Additional specialist capacity' },
    ],
    edges: [edge],
    living_model: {
      model_program: 'v1',
      canonical: {
        version: 'canonical.v1',
        quantities: [{
          id: 'capacity_per_specialist', label: 'Weekly capacity per additional specialist',
          unit: 'ticket/week/specialist', value: coefficientValue, low: 10, high: 30, kind: 'coefficient',
        }],
      },
    },
  },
})

// ── The café read (option-card-probe-2011 reads[6]): a core board, no `model_program` ──
const CAFE_ID = '99088c3e-308e-4c56-a963-3ce47d048a7b'
const CAFE_EDGE: Rec = {
  id: 'loyalty_customer_effect', from: 'loyalty_card__on', to: 'weekly_customers',
  strength: { std: 0.058333333333333334, mean: 0.11666666666666667 }, effect_direction: 'positive', exists_probability: 1,
  provenance: {
    source: 'brief_extraction', magnitude: 'user_stated',
    natural_effect: {
      amount: 70, amount_unit: 'customers a week', strength_mean: 0.11666666666666667, per_source_change: 1,
      strength_mean_frame: 'edge_strength', per_source_change_unit: 'switch',
    },
  },
}
const CAFE_READ: Rec = {
  schema: 'scenario_graph.v1', scenario_id: CAFE_ID, graph_present: true, graph_hash: 'fe61868e9e12f9f4',
  graph: {
    nodes: [
      { id: 'loyalty_card__on', kind: 'factor', label: 'Start a loyalty card in place' },
      { id: 'weekly_customers', kind: 'goal', label: 'I want at least 480 customers a week within three months.' },
    ],
    edges: [CAFE_EDGE],
    living_model: { aims: [], links: [], factors: [], options: [] },
  },
}

let served: Rec = CAFE_READ
function seed(read: Rec) {
  served = read
  const graph = read.graph as { nodes: Rec[]; edges: Rec[] }
  const edges = graph.edges.map((e, i) => { const m = mapDraftEdgeToCanvas({ ...e } as never, i); return { ...m, id: e.id as string } })
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    currentScenarioId: read.scenario_id as string,
    lastServerGraphHash: read.graph_hash as string,
    nodes: graph.nodes.map((n, i) => ({ id: n.id as string, type: n.kind as string, position: { x: 0, y: i * 200 }, data: { label: n.label } })),
    edges,
    results: { status: 'none', report: null },
  } as never)
}
const panel = (edgeId: string) => <EdgePanel edgeId={edgeId} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
  window.history.replaceState(null, '', '/?ai=core-route')
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })
  )))
})
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a program link edits its coefficient in natural units', () => {
  it('(a) shows 20 ticket/week/specialist, and an edit sends exactly one factor_value_edit to capacity_per_specialist', async () => {
    seed(capacityRead(20, '811b509a0cfe1deb'))
    render(panel('specialists_added__additional_capacity'))
    const input = await screen.findByTestId('edge-program-coefficient-input') as HTMLInputElement
    expect(input.type).toBe('number')
    expect(input.value).toBe('20')
    expect(screen.getByTestId('edge-program-coefficient-unit').textContent).toBe('ticket/week/specialist')
    expect(screen.queryByTestId('edge-strength-controls')).toBeNull()

    fireEvent.change(input, { target: { value: '25' } })
    await act(async () => { fireEvent.blur(input) })

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0][0]).toEqual({
      type: 'factor_value_edit',
      payload: { target_id: 'capacity_per_specialist', value: 25, field: 'value', raw_value: 25, unit: 'ticket/week/specialist' },
    })
  })

  it('(a) a negative typed number goes out with its sign, never rescaled', async () => {
    seed(capacityRead(20, '811b509a0cfe1deb'))
    render(panel('specialists_added__additional_capacity'))
    const input = await screen.findByTestId('edge-program-coefficient-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-0.5' } })
    await act(async () => { fireEvent.blur(input) })
    expect(sendSystemEvent.mock.calls[0][0].payload).toMatchObject({ target_id: 'capacity_per_specialist', value: -0.5, raw_value: -0.5 })
  })

  it('(c) a program link with no coefficient_id: no editor, no β controls, nothing sent', async () => {
    const { coefficient_id: _dropped, ...noCoef } = COEF_EDGE
    seed(capacityRead(20, '811b509a0cfe1dee', noCoef))
    render(panel('specialists_added__additional_capacity'))
    // The β editor is on screen until the saved read answers; it must then be gone.
    await vi.waitFor(() => expect(screen.queryByTestId('edge-strength-controls')).toBeNull())
    expect(screen.queryByTestId('edge-program-coefficient-input')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Strength presets' })).toBeNull()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('(f) cold reopen: the read carrying the new coefficient shows it on the link', async () => {
    seed(capacityRead(20, '811b509a0cfe1deb'))
    const first = render(panel('specialists_added__additional_capacity'))
    expect(((await screen.findByTestId('edge-program-coefficient-input')) as HTMLInputElement).value).toBe('20')
    first.unmount()

    seed(capacityRead(25, '9a0c1e2d3b4f5a6c'))
    render(panel('specialists_added__additional_capacity'))
    await vi.waitFor(() => {
      expect((screen.getByTestId('edge-program-coefficient-input') as HTMLInputElement).value).toBe('25')
    })
  })
})

describe('CONTROL: a non-program link keeps the β editor', () => {
  it('(b) the café link still sends edge_strength_edit, and shows no coefficient editor', async () => {
    seed(CAFE_READ)
    render(panel('loyalty_customer_effect'))
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(screen.queryByTestId('edge-program-coefficient-input')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('strength-band-strong')) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0][0]
    expect(event.type).toBe('edge_strength_edit')
    expect(event.payload).toMatchObject({ from: 'loyalty_card__on', to: 'weekly_customers', magnitude: 0.55 })
  })
})

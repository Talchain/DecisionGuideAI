/**
 * A PROGRAM LINK SAYS ITS COEFFICIENT IN READING WORDS, AND OFFERS A FIELD ONLY FOR ONE THE PERSON CAN TYPE (DL, 23 Oct;
 * batch-3 fit on the served hiring-r1 and marketing-r1 reads).
 *
 *   1. A coefficient the model works out (its node's `value_basis` is worked_out), or one with no value, gets no
 *      inspector field: hiring's developer link showed an empty "1/developer" field. As #2954 does for structure-fixed
 *      figures. The link beside it, whose coefficient is Olumi's estimate, keeps its field, seeded 0.15.
 *   2. A positive dimensionless coefficient (unit "1") is a multiplier: "about ×1.15 (0.5–2)", not
 *      "about +1.15 (0.5–2) 1". Every other unit keeps the signed form ("about +12 (3–35) %").
 *   3. A unit reads in words: "1/tech_lead" is "per tech lead" ("about +0.15 (-0.1–0.35) per tech lead").
 * Display only: the field still sends the coefficient's own unit, and a non-program link keeps the β editor
 * (`programLinkValueEditor.spec.tsx` (b) and (g)).
 *
 * Real path: the real `useSavedGraph` read (only `fetch` stubbed, answering with CEE's served reads, S3 batch 3,
 * trimmed), the real mapper, the real `EdgePanel`, and `useProgramLinkFigure` (the words `StyledEdge` puts on the link).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup, fireEvent, act } from '@testing-library/react'

import type { WireSystemEvent } from '../../../conversation/types'
import hiring from '../../../runView/__tests__/fixtures/accept3-hiring-r1-read.json'
import marketing from '../../../runView/__tests__/fixtures/accept3-marketing-r1-read.json'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
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
import { useProgramLinkFigure } from '../../../nodes/shared/savedModelProgram'

type Rec = Record<string, unknown>
let served: Rec = {}
let n = 0
function seed(board: Rec) {
  n += 1
  // The saved-graph read is cached per scenario and hash, so each row reads its own hash.
  served = { ...board, graph_hash: `${board.graph_hash as string}${n}` }
  const graph = board.graph as { nodes: Rec[]; edges: Rec[] }
  const edges = graph.edges.map((e, i) => { const m = mapDraftEdgeToCanvas({ ...e } as never, i); return { ...m, id: e.id as string } })
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    currentScenarioId: board.scenario_id as string,
    lastServerGraphHash: served.graph_hash as string,
    nodes: graph.nodes.map((x, i) => ({ id: x.id as string, type: x.kind as string, position: { x: 0, y: i * 200 }, data: { label: x.label } })),
    edges,
    results: { status: 'none', report: null },
  } as never)
}
const panel = (edgeId: string) => <EdgePanel edgeId={edgeId} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })
async function linkWords(edgeId: string) {
  const { result } = renderHook(() => useProgramLinkFigure(edgeId))
  await settle()
  return result.current?.words ?? null
}

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

describe('1. a worked-out coefficient has no inspector field', () => {
  it('hiring developers_added__productivity (developer_productivity_gain, worked_out, no value): no field, no β controls', async () => {
    seed(hiring)
    render(panel('developers_added__productivity'))
    await settle()
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith(`/scenarios/${hiring.scenario_id}/graph`))).toBe(true)
    expect(screen.queryByTestId('edge-program-coefficient-input')).toBeNull()
    expect(screen.queryByTestId('edge-strength-controls')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Strength presets' })).toBeNull()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('the same link with a value on its worked-out coefficient: still no field, and the link says the figure', async () => {
    // The served coefficient has no value; this row gives it one, so the worked-out arm is tested on its own.
    const canonical = hiring.graph.living_model.canonical
    seed({
      ...hiring,
      graph: {
        ...hiring.graph,
        living_model: {
          ...hiring.graph.living_model,
          canonical: { ...canonical, quantities: canonical.quantities.map((q) => (q.id === 'developer_productivity_gain' ? { ...q, value: 0.09 } : q)) },
        },
      },
    })
    expect(await linkWords('developers_added__productivity')).toBe('+0.09 per developer')
    render(panel('developers_added__productivity'))
    await settle()
    expect(screen.queryByTestId('edge-program-coefficient-input')).toBeNull()
    expect(screen.queryByTestId('edge-strength-controls')).toBeNull()
  })

  it('CONTROL: hiring tech_leads_added__productivity (Olumi’s estimate 0.15) keeps its field, "per tech lead", and sends its own unit', async () => {
    seed(hiring)
    render(panel('tech_leads_added__productivity'))
    const input = await screen.findByTestId('edge-program-coefficient-input') as HTMLInputElement
    expect(input.value).toBe('0.15')
    expect(screen.getByTestId('edge-program-coefficient-unit').textContent).toBe('per tech lead')
    fireEvent.change(input, { target: { value: '0.2' } })
    await act(async () => { fireEvent.blur(input) })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0][0]).toEqual({
      type: 'factor_value_edit',
      payload: { target_id: 'tech_lead_productivity_gain', value: 0.2, field: 'value', raw_value: 0.2, unit: '1/tech_lead' },
    })
  })
})

describe('2. a positive dimensionless coefficient reads as a multiplier, with no bare "1"', () => {
  it('marketing manager_conversion_multiplier (1.15, 0.5–2, unit "1") reads "about ×1.15 (0.5–2)"', async () => {
    seed(marketing)
    expect(await linkWords('baseline_conversion_rate__manager_conversion_rate')).toBe('about ×1.15 (0.5–2)')
  })

  it('marketing ai_conversion_multiplier (1, 0.3–2, unit "1") reads "about ×1 (0.3–2)", and its field shows no unit', async () => {
    seed(marketing)
    expect(await linkWords('baseline_conversion_rate__ai_conversion_rate')).toBe('about ×1 (0.3–2)')
    render(panel('baseline_conversion_rate__ai_conversion_rate'))
    expect(((await screen.findByTestId('edge-program-coefficient-input')) as HTMLInputElement).value).toBe('1')
    expect(screen.queryByTestId('edge-program-coefficient-unit')).toBeNull()
  })

  it('CONTROL: marketing manager_owner_time (12, 3–35, unit "%") keeps the signed form "about +12 (3–35) %"', async () => {
    seed(marketing)
    expect(await linkWords('manager_selected__owner_time')).toBe('about +12 (3–35) %')
  })
})

describe('3. a coefficient’s unit reads in words', () => {
  it('hiring tech_lead_productivity_gain (0.15, -0.1–0.35, unit "1/tech_lead") reads "about +0.15 (-0.1–0.35) per tech lead"', async () => {
    seed(hiring)
    expect(await linkWords('tech_leads_added__productivity')).toBe('about +0.15 (-0.1–0.35) per tech lead')
  })
})

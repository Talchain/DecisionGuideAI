/**
 * ⭐⭐⭐ THE CAPABILITY, END TO END: reload → open the row → Save, with NO chat.
 *
 * This is the path root drove natively and that FAILED on 2026-09-09: a restored
 * scenario returned 16 nodes / 25 edges, the editor opened, Cancel correctly sent
 * nothing — and the first Save sent nothing either, honestly saying it had to
 * re-sync first. The refusal was right; the missing precondition was the defect.
 *
 * ⚠ WHAT THE EXISTING SPECS PROVE, AND WHY IT WAS NOT THIS. The hydration specs
 * stop at store state. The authority specs seed a null base and prove refusal, or
 * inject a later hash and prove recovery. None of them starts from a real read
 * body and ends at a real send, which is the only shape that could have caught
 * the native stop — so it is the shape used here.
 *
 * Only the NETWORK is stubbed. The adapter parse, the accepted hydration, the
 * store, the mounted panel, the authority and the wire builder are all real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// The authority is mocked to its POST-ACTIVATION value. The subject here is the
// write base reaching the wire, not the flag — which ships separately.
const authority = vi.hoisted(() => ({ value: 'server_graph' as string }))
vi.mock('../../mutations/mutationAuthority', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return {
        ...(actual.CANONICAL_EDIT_AUTHORITY as Record<string, string>),
        modelOptionIntervention: authority.value,
      }
    },
  }
})

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const SCENARIO = 'd66123ea-cc6a-40aa-a33c-afcb14f3af59'
const OPTION = 'opt_eng'
const FACTOR = 'fac_capex'
const GOAL = 'goal_service'
const SERVER_BASE = '9f2c1b0ae4d37c5a'

/** The graph CEE returns on the restore read. */
function serverGraph() {
  return {
    nodes: [
      { id: FACTOR, kind: 'factor', label: 'Capital expenditure' },
      { id: OPTION, kind: 'option', label: 'Engineer', interventions: { [FACTOR]: 0.2 } },
      { id: GOAL, kind: 'goal', label: 'Service quality' },
    ],
    edges: [],
  }
}

function readBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO,
    graph: serverGraph(),
    graph_present: true,
    brief_text: null,
    graph_identity_hash: {
      kind: 'graph_identity_hash',
      value: 'd'.repeat(64),
      algorithm: 'sha256',
      projection_version: 'identity.v1',
      graph_schema_version: 'graph_v3',
      normaliser_version: '1',
    },
    layout_present: false,
    // ⭐ THE FIELD UNDER TEST. Absent in the body that produced the native stop.
    graph_hash: SERVER_BASE,
    request_id: 'req-restore-1',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

/** The canvas as persistence restores it, BEFORE the server read lands. */
function seedRestoredCanvas(): void {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      nodes: [
        { id: FACTOR, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capital expenditure', kind: 'factor' } },
        { id: OPTION, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Engineer', kind: 'option', interventions: { [FACTOR]: 0.2 } } },
        { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Service quality', kind: 'goal' } },
      ],
      edges: [],
      // ⚠ THE NATIVE STARTING STATE: a restore runs no turn, so there is no base.
      lastServerGraphHash: null,
      serverGraphIdentity: null,
      history: { past: [], future: [] },
    } as never,
    false,
  )
}

/** Subscribed exactly as production does — `OutputsDock` reads these from the store. */
function StoreBoundPanel() {
  const nodes = useCanvasStore(s => s.nodes)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const baseHash = useCanvasStore(s => s.lastServerGraphHash)
  return (
    <ModelTabV2Panel
      nodes={nodes as Node[]}
      edges={[]}
      goalThreshold={null}
      currentScenarioId={scenarioId}
      lastServerGraphHash={baseHash}
    />
  )
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  sendSystemEvent.mockResolvedValue(undefined)
  authority.value = 'server_graph'
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedRestoredCanvas()
})
afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

function mountAndOpenTheRow() {
  render(<StoreBoundPanel />)
  openOutlineGroups()
  fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION}`))
}

function saveValue(value: string) {
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`))
  fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
    target: { value },
  })
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))
}

describe('a restored session edits without a chat turn', () => {
  it('⭐ the FIRST Save sends the base the read returned, for the right option and factor', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, readBody()))
    expect(await hydrateCanvasFromServer(SCENARIO)).not.toBe('skipped')

    mountAndOpenTheRow()
    saveValue('0.75')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0]?.[0]
    expect(event?.type).toBe('option_intervention_edit')
    // Bound by IDENTITY on every field the writer fences on, never by position.
    expect(event?.payload).toMatchObject({
      option_id: OPTION,
      factor_id: FACTOR,
      value: 0.75,
      base_graph_hash: SERVER_BASE,
    })
    // ⚠ AND NO CHAT. The whole point: exactly one POST-worthy event, and it is
    // the edit — not a turn run first to earn the right to make it.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('⭐ RED-FIRST CONTROL: without the field in the body, that same Save sends NOTHING', async () => {
    // This is the native stop reproduced exactly — the body root received had no
    // `graph_hash`. It must still refuse, and still say why.
    fetchSpy.mockResolvedValue(jsonResponse(200, readBody({ graph_hash: undefined })))
    expect(await hydrateCanvasFromServer(SCENARIO)).not.toBe('skipped')

    mountAndOpenTheRow()
    saveValue('0.75')

    expect(sendSystemEvent).not.toHaveBeenCalled()
    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/re-sync/i)
  })

  it('⚠ Cancel still sends nothing and keeps the committed value — the positive control root drove', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, readBody()))
    await hydrateCanvasFromServer(SCENARIO)

    mountAndOpenTheRow()
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`))
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
      target: { value: '0.9' },
    })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-cancel`))

    expect(sendSystemEvent).not.toHaveBeenCalled()
    await waitFor(() => {
      const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)
      expect(
        (option?.data as { interventions: Record<string, number> }).interventions[FACTOR],
      ).toBe(0.2)
    })
  })
})

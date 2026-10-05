/**
 * ⭐ REVIEWING A RELATIONSHIP'S CURRENT STRENGTH IS AGREEMENT, NOT AN EDIT (Acceptance #87 5986653143; DL 0df0e1, 5 Oct).
 *
 * Served (programme-docs @72641fa7, resume-acceptance/23-SPINE-COPY-APPROVAL-STOP.md): Model → Relationships →
 * Change → Review "0.25 → 0.25 · Confirm" sent an `edge_strength_edit` `set`; CEE refused it ("I haven't recorded it as
 * your judgement… Confirm the current strength explicitly"), yet the row and "Where it came from" said "User edited"
 * until a cold read. Two defects, each pinned here by identity (testids, endpoints, the stored edge):
 *   1. the unchanged value must send `confirm_current` — the "Accept starting strength" carrier — not a refused `set`;
 *   2. nothing may stamp the edge "User edited" for a write the server refuses by contract.
 *
 * Harness: `relationshipStrengthReachesTheServer.spec.tsx` (real store, conversation context mocked at its seam).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

const GOAL_ID = 'goal_arr'
const FACTOR_STATED = 'fac_price'
const FACTOR_LOCAL = 'fac_churn'
const FACTOR_MAGNITUDE = 'fac_capacity'

const SERVER_STATED_EDGE = 'e_server_stated'
const LOCAL_ONLY_EDGE = 'e_local_only'
const MAGNITUDE_ONLY_EDGE = 'e_magnitude_only'

/** The signed mean the server last stated for `SERVER_STATED_EDGE`. */
const SERVER_MEAN = 0.4
/** The magnitude the server last stated for `MAGNITUDE_ONLY_EDGE`. */
const SERVER_MAGNITUDE = 0.6

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'observable',
      observedState: { value: 0.5, raw_value: 50, cap: 100, unit: '%', source: 'cee_inference' },
    },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' },
  } as unknown as Node
}

/**
 * QUALIFIES. `serverStrength` is the tuple ingestion recorded, and it is the ONLY
 * thing here that makes `expected` assertable — `weightSource: 'cee'` does not,
 * deliberately (see `edgeServerStatedStrength.ts`'s writer enumeration: two live
 * client paths stamp `'cee'` on a number the server's graph does not hold).
 */
function serverStatedEdge(): Edge {
  return {
    id: SERVER_STATED_EDGE,
    source: FACTOR_STATED,
    target: GOAL_ID,
    data: {
      label: 'Price affects ARR',
      weight: Math.abs(SERVER_MEAN),
      weightSource: 'cee',
      direction: 'positive',
      directionSource: 'cee',
      serverStrength: { mean: SERVER_MEAN, effect_direction: 'positive' },
    },
  } as unknown as Edge
}

/**
 * DOES NOT QUALIFY — THE F6 CASE. Displayed identically to its twin above (a
 * stamped weight, a stamped direction, so the row renders a real band label) and
 * carrying NO `serverStrength`. Nothing here proves what the server holds, so
 * `expected` cannot be asserted and the edit would land local-only.
 */
function localOnlyEdge(): Edge {
  return {
    id: LOCAL_ONLY_EDGE,
    source: FACTOR_LOCAL,
    target: GOAL_ID,
    data: {
      label: 'Churn affects ARR',
      weight: Math.abs(SERVER_MEAN),
      weightSource: 'user',
      direction: 'positive',
      directionSource: 'user',
    },
  } as unknown as Edge
}

/**
 * QUALIFIES, WITH NO STATED DIRECTION. `serverStrength` makes `expected`
 * assertable; the absence of `direction`/`directionSource`/`effect_direction`
 * makes `resolveEdgeDirectionDisplay` refuse, so the row says so and the editor
 * must not mint a sign.
 */
function magnitudeOnlyEdge(): Edge {
  return {
    id: MAGNITUDE_ONLY_EDGE,
    source: FACTOR_MAGNITUDE,
    target: GOAL_ID,
    data: {
      label: 'Capacity affects ARR',
      weight: SERVER_MAGNITUDE,
      weightSource: 'cee',
      serverStrength: { mean: SERVER_MAGNITUDE, effect_direction: 'positive' },
    },
  } as unknown as Edge
}

function allNodes(): Node[] {
  return [
    goalNode(),
    factorNode(FACTOR_STATED, 'Price'),
    factorNode(FACTOR_LOCAL, 'Churn'),
    factorNode(FACTOR_MAGNITUDE, 'Capacity'),
  ]
}

function allEdges(): Edge[] {
  return [serverStatedEdge(), localOnlyEdge(), magnitudeOnlyEdge()]
}

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
}

/** The edge as the STORE holds it — what a reload would rebuild the row from. */
function storedEdgeData(id: string): Record<string, unknown> {
  const e = useCanvasStore.getState().edges.find(x => x.id === id)
  return (e?.data ?? {}) as Record<string, unknown>
}

/** Every `edge_strength_edit` payload sent, bound to its edge by ENDPOINTS. */
function strengthEditsFor(source: string): Record<string, unknown>[] {
  return sendSystemEvent.mock.calls
    .map(c => c[0] as { type?: string; payload?: Record<string, unknown> })
    .filter(e => e?.type === 'edge_strength_edit' && e.payload?.from === source)
    .map(e => e.payload as Record<string, unknown>)
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

/** Drive one row's three-beat to PROPOSED: click the value, type, Enter. */
function propose(rowId: string, raw: string) {
  fireEvent.click(screen.getByTestId(`model-row-v2-${rowId}-value`))
  const input = screen.getByTestId(`model-row-v2-${rowId}-value-input`)
  fireEvent.change(input, { target: { value: raw } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

/** …and confirm it. */
function commit(rowId: string, raw: string) {
  propose(rowId, raw)
  fireEvent.click(screen.getByTestId(`model-row-v2-${rowId}-confirm`))
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})

afterEach(() => cleanup())

/** Every `edge_strength_edit` sent for this source, with its intent. */
function sentFor(source: string): Array<Record<string, unknown>> {
  return sendSystemEvent.mock.calls
    .map(c => c[0] as { type?: string; payload?: Record<string, unknown> })
    .filter(e => e?.type === 'edge_strength_edit' && e.payload?.from === source)
    .map(e => e.payload as Record<string, unknown>)
}

describe('an unchanged Review → Confirm sends confirm_current and claims nothing locally', () => {
  it('PRECONDITION: the row opens on the value the model holds', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-value`))
    expect((screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-value-input`) as HTMLInputElement).value).toBe(String(SERVER_MEAN))
  })

  it('RED: confirming the SAME signed strength sends exactly one confirm_current, never a set', () => {
    renderPanel()
    commit(SERVER_STATED_EDGE, String(SERVER_MEAN))
    const sent = sentFor(FACTOR_STATED)
    expect(sent.map(p => p.intent)).toEqual(['confirm_current'])
    expect(sent[0]).toMatchObject({ from: FACTOR_STATED, to: GOAL_ID, magnitude: SERVER_MEAN, expected: { mean: SERVER_MEAN, effect_direction: 'positive' } })
  })

  it('RED: …and the stored edge is byte-identical — never stamped "User edited"', () => {
    renderPanel()
    const before = { ...storedEdgeData(SERVER_STATED_EDGE) }
    commit(SERVER_STATED_EDGE, String(SERVER_MEAN))
    expect(storedEdgeData(SERVER_STATED_EDGE)).toEqual(before)
    expect(storedEdgeData(SERVER_STATED_EDGE).weightSource).toBe('cee')
  })

  it('RED: a magnitude-only row confirming its same magnitude sends confirm_current too', () => {
    renderPanel()
    const before = { ...storedEdgeData(MAGNITUDE_ONLY_EDGE) }
    commit(MAGNITUDE_ONLY_EDGE, String(SERVER_MAGNITUDE))
    expect(sentFor(FACTOR_MAGNITUDE).map(p => p.intent)).toEqual(['confirm_current'])
    expect(storedEdgeData(MAGNITUDE_ONLY_EDGE)).toEqual(before)
  })

  it('CONTROL: a CHANGED strength is still an edit — one set, written locally as the user\'s', () => {
    renderPanel()
    commit(SERVER_STATED_EDGE, '0.8')
    expect(sentFor(FACTOR_STATED).map(p => p.intent)).toEqual(['set'])
    expect(storedEdgeData(SERVER_STATED_EDGE)).toMatchObject({ weight: 0.8, weightSource: 'user' })
  })
})

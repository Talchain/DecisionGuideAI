/**
 * F6 — batch direct_graph_edit -> 0.22 wire adapter.
 *
 * These tests START FROM THE REAL EMITTER SHAPE: they drive the real
 * `useGraphEditEvents` hook against the real canvas store and capture EXACTLY
 * what it emits (never a hand-built fixture), then cross the REAL
 * `buildV5Payload` boundary and validate the result against the vendored
 * `OrchestratorTurnPayloadSchema` (parse MUST succeed).
 *
 * RED baseline (pre-fix): the emitter emits a BATCH payload with no singular
 * `target_id`/`operation`, so the old `buildV5Payload` returned no event and
 * the edit was silently discarded.
 * GREEN (this adapter): a wire event with a representative singular pair PLUS
 * the additive batch fields, which the schema accepts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { useGraphEditEvents } from '../useGraphEditEvents'
import { useCanvasStore } from '../../store'
import { buildV5Payload } from '../../../v5/buildPayload'
import type { WireSystemEvent } from '../types'

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isJourneyTabEnabled: () => false,
}))

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

function setStore(overrides: Record<string, unknown>): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...overrides,
  })
}

/**
 * Render the REAL emitter, apply `mutate`, flush the debounce, and return the
 * exact payload the emitter handed to sendSystemEvent. `initial` (if given) is
 * applied BEFORE mount so it lands in the emitter's baseline snapshot (needed
 * to exercise the `update` op, which diffs against the mount snapshot).
 */
function captureEmittedEvent(mutate: () => void, initial?: Record<string, unknown>): WireSystemEvent {
  if (initial) setStore(initial)
  const send = vi.fn().mockResolvedValue(undefined)
  const { unmount } = renderHook(() => useGraphEditEvents(send))
  act(() => {
    mutate()
  })
  act(() => {
    vi.advanceTimersByTime(1500)
  })
  unmount()
  expect(send).toHaveBeenCalledTimes(1)
  return send.mock.calls[0][0] as WireSystemEvent
}

function buildFromEvent(event: WireSystemEvent): ReturnType<typeof buildV5Payload> {
  return buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'frame',
    turnClass: 'frame',
    mode: 'system',
    systemEvent: event,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  setStore({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F6 batch direct_graph_edit adapter', () => {
  it('the real emitter emits a BATCH payload with NO singular target_id/operation (RED premise)', () => {
    const event = captureEmittedEvent(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      })
    })

    expect(event.type).toBe('direct_graph_edit')
    expect(event.payload).toMatchObject({ changed_node_ids: ['n1'], operations: ['add'] })
    // The batch shape carries NO singular pair — this is exactly why the
    // singular-only builder discarded it before F6.
    expect(event.payload?.target_id).toBeUndefined()
    expect(event.payload?.operation).toBeUndefined()
  })

  it('GREEN: adapts a real batch edit to a schema-valid wire event with a representative pair + batch fields', () => {
    const event = captureEmittedEvent(
      () => {
        // Update n1's label (populates fields_changed) and remove e1.
        useCanvasStore.setState({
          nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Updated' } }] as any,
          edges: [] as any,
        })
      },
      {
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 1 } }],
      },
    )

    const result = buildFromEvent(event)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const payload = result.payload as Extract<typeof result.payload, { kind: 'system_event' }>
    expect(payload.kind).toBe('system_event')
    const wireEvent = payload.event as Record<string, unknown>

    // Representative singular pair present and non-empty (schema-required).
    expect(wireEvent.kind).toBe('direct_graph_edit')
    expect(wireEvent.target_id).toBe('n1') // first changed node in stable order
    expect(typeof wireEvent.operation).toBe('string')
    expect((wireEvent.operation as string).length).toBeGreaterThan(0)

    // Additive batch fields retained.
    expect(wireEvent.changed_node_ids).toEqual(['n1'])
    expect(wireEvent.changed_edge_ids).toEqual(['e1'])
    expect(wireEvent.operations).toEqual(['remove', 'update'])
    // fields_changed converted map -> string[].
    expect(wireEvent.fields_changed).toEqual(['label'])
    expect(typeof wireEvent.summary).toBe('string')

    // The whole point: the vendored 0.22 schema parses the adapter output.
    expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  })

  it('BATCH-FIELDS PIN: the additive batch fields survive the adapter unchanged', () => {
    const event = captureEmittedEvent(
      () => {
        useCanvasStore.setState({
          nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Updated' } }] as any,
        })
      },
      { nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] },
    )

    const result = buildFromEvent(event)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const wireEvent = (result.payload as any).event as Record<string, unknown>

    expect(wireEvent.changed_node_ids).toEqual(['n1'])
    expect(wireEvent.operations).toEqual(['update'])
    expect(wireEvent.fields_changed).toEqual(['label'])
    expect(wireEvent.summary).toBe('1 node changed')
  })

  it('converts the fields_changed MAP to a sorted, de-duplicated UNION of field names', () => {
    const event = captureEmittedEvent(
      () => {
        // n1 label changes; n2 note changes -> map { n1: ['label'], n2: ['note'] }.
        useCanvasStore.setState({
          nodes: [
            { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'B', note: 'x' } },
            { id: 'n2', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'M', note: 'b' } },
          ] as any,
        })
      },
      {
        nodes: [
          { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A', note: 'x' } },
          { id: 'n2', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'M', note: 'a' } },
        ],
      },
    )

    // Emitter really did produce a MAP (id -> field names).
    expect(event.payload?.fields_changed).toEqual({ n1: ['label'], n2: ['note'] })

    const result = buildFromEvent(event)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const wireEvent = (result.payload as any).event as Record<string, unknown>
    // Union across elements, de-duplicated, sorted ascending.
    expect(wireEvent.fields_changed).toEqual(['label', 'note'])
    expect(() => OrchestratorTurnPayloadSchema.parse(result.payload)).not.toThrow()
  })

  it('RETRYABLE-ERROR PIN: an unencodable batch (empty ids) fails retryably, never a silent drop', () => {
    // The real emitter never fires with empty id lists (it only fires on real
    // changes), so this pathological input is constructed directly at the
    // buildV5Payload boundary — the seam that must not fabricate a target.
    const result = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'system',
      systemEvent: {
        type: 'direct_graph_edit',
        payload: { changed_node_ids: [], changed_edge_ids: [], operations: [], fields_changed: {}, summary: '' },
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unencodable_graph_edit')
    expect(result.retryable).toBe(true)
  })

  it('preserves back-compat: an explicit singular pair still builds a bare wire event', () => {
    const result = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'system',
      systemEvent: { type: 'direct_graph_edit', payload: { target_id: 'node-1', operation: 'set_factor_value' } },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect((result.payload as any).event).toEqual({
      kind: 'direct_graph_edit',
      target_id: 'node-1',
      operation: 'set_factor_value',
    })
    expect(() => OrchestratorTurnPayloadSchema.parse(result.payload)).not.toThrow()
  })
})

/**
 * `rebaseDeferredEdgeStrengthEdit` — a queued link-strength `set` asserts what
 * the server holds WHEN IT LEAVES, not when it was clicked (canvas audit
 * edit-values F1). Pure: the dispatcher-level journey is
 * `registration/__tests__/edgeStrengthQueuedEdit.spec.tsx`.
 *
 * Every refusal arm is pinned beside the arm it could be confused with, because
 * each one guards a different wrong write:
 *   · confirm_current / direction edits must NOT be rebased (a rebase would
 *     confirm a number never seen / undo a strength that landed);
 *   · an UNMOVED tuple is not short-circuited even when it equals the request.
 */
import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'

import { buildEdgeStrengthEditEvent, rebaseDeferredEdgeStrengthEdit } from '../edgeStrengthEdit'
import type { WireSystemEvent } from '../types'

const edgeAt = (mean: number, extra: Record<string, unknown> = {}): Edge =>
  ({
    id: 'e-17',
    source: 'fac_vendor',
    target: 'risk_lockin',
    data: {
      weight: Math.abs(mean),
      direction: mean < 0 ? 'negative' : 'positive',
      serverStrength: { mean, effect_direction: mean < 0 ? 'negative' : 'positive' },
      ...extra,
    },
  }) as unknown as Edge

/** The queued click: built at 0.62 (what the server held then), asking for 0.85. */
function queuedSet(requestedMean: number, opts: { preserveDirection?: boolean } = {}): WireSystemEvent {
  const event = buildEdgeStrengthEditEvent({ edge: edgeAt(0.62), requestedMean, preserveDirection: opts.preserveDirection })
  expect(event, 'precondition: the click builds a wire event').not.toBeNull()
  return event!
}

const expectedOf = (e: WireSystemEvent) => (e.payload as { expected: { mean: number; effect_direction: string } }).expected

describe('rebaseDeferredEdgeStrengthEdit', () => {
  it('RE-READS `expected` from the edge as it stands at dispatch — the request is untouched', () => {
    const queued = queuedSet(0.85, { preserveDirection: true })
    expect(expectedOf(queued).mean, 'precondition: queued with the click-time tuple').toBe(0.62)

    // The edit on the wire applied: CEE now holds 0.3 (served repro B, e-17).
    const out = rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.3), { directionEdit: false })

    expect(out.kind).toBe('rebased')
    if (out.kind !== 'rebased') return
    expect(expectedOf(out.event)).toEqual({ mean: 0.3, effect_direction: 'positive' })
    // Everything the USER asked for is byte-identical.
    const { expected: _a, ...requestAfter } = out.event.payload as Record<string, unknown>
    const { expected: _b, ...requestBefore } = queued.payload as Record<string, unknown>
    expect(requestAfter).toEqual(requestBefore)
    // …and the queued object itself is not mutated (the queue may still hold it).
    expect(expectedOf(queued).mean).toBe(0.62)
  })

  it('a signed request keeps its stated direction across the rebase', () => {
    const queued = queuedSet(-0.55)
    const out = rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.3), { directionEdit: false })
    expect(out.kind).toBe('rebased')
    if (out.kind !== 'rebased') return
    expect((out.event.payload as Record<string, unknown>).direction_intent).toBe('negative')
    expect(expectedOf(out.event).mean).toBe(0.3)
  })

  it('ALREADY HELD: the tuple moved TO the request (drag back to the value on the wire) — nothing to send', () => {
    const queued = queuedSet(0.3, { preserveDirection: true })
    expect(rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.3), { directionEdit: false })).toEqual({ kind: 'already_held' })
  })

  it('CONTRAST: a signed request for the opposite direction at the held magnitude is NOT already held', () => {
    const queued = queuedSet(-0.3)
    const out = rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.3), { directionEdit: false })
    expect(out.kind).toBe('rebased')
  })

  it('UNMOVED tuple: sent as queued, even when it equals the request (that send is the click\'s own business)', () => {
    const queued = queuedSet(0.62, { preserveDirection: true })
    expect(rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.62), { directionEdit: false })).toEqual({ kind: 'unchanged' })
  })

  it('a DIRECTION edit is never rebased — its magnitude is the click-time server |mean|', () => {
    const queued = buildEdgeStrengthEditEvent({ edge: edgeAt(0.62), requestedMean: 0.62, directionIntent: 'negative' })!
    expect(rebaseDeferredEdgeStrengthEdit(queued, edgeAt(0.3), { directionEdit: true })).toEqual({ kind: 'unchanged' })
  })

  it('confirm_current is never rebased — it ratifies the number the person saw', () => {
    const confirm: WireSystemEvent = {
      type: 'edge_strength_edit',
      payload: {
        from: 'fac_vendor', to: 'risk_lockin', magnitude: 0.62, direction_intent: 'preserve',
        expected: { mean: 0.62, effect_direction: 'positive' }, intent: 'confirm_current',
      },
    }
    expect(rebaseDeferredEdgeStrengthEdit(confirm, edgeAt(0.3), { directionEdit: false })).toEqual({ kind: 'unchanged' })
  })

  it('nothing proves a better answer → sent as queued (edge gone, pair moved, no server tuple, other kinds)', () => {
    const queued = queuedSet(0.85, { preserveDirection: true })
    expect(rebaseDeferredEdgeStrengthEdit(queued, undefined, { directionEdit: false }).kind).toBe('unchanged')
    const moved = { ...edgeAt(0.3), target: 'somewhere_else' } as Edge
    expect(rebaseDeferredEdgeStrengthEdit(queued, moved, { directionEdit: false }).kind).toBe('unchanged')
    const unstated = { ...edgeAt(0.3), data: { weight: 0.3 } } as unknown as Edge
    expect(rebaseDeferredEdgeStrengthEdit(queued, unstated, { directionEdit: false }).kind).toBe('unchanged')
    const factorEdit: WireSystemEvent = { type: 'factor_value_edit', payload: { target_id: 'x', value: 0.4, field: 'value' } }
    expect(rebaseDeferredEdgeStrengthEdit(factorEdit, edgeAt(0.3), { directionEdit: false }).kind).toBe('unchanged')
  })
})

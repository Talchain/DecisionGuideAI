/**
 * A withdrawn extraction marker (`extractionType: null`) is "no claim" and is
 * never sent (26 Sep 2026). Served CEE 319dde1 stored a register's
 * `extractionType: null`, and every later canvas edit on that scenario then
 * 500'd on its GraphV3 re-parse (#70 5842163197). The same null in the
 * acknowledgement digest is also what made a value edit's receipt stop
 * acknowledging the model (bisected to #2046).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildRegistrationGraph } from '../buildRegistrationGraph'
import { isSameAnalyticalModel } from '../../store/importRegistrationMarker'
import { withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { USER_VALUE_STAMP, USER_CONFIRMATION_STAMP } from '../../domain/valueProvenance'

const factor = (data: Record<string, unknown>): Node =>
  ({ id: 'fac_a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'factor', ...data } }) as unknown as Node

function wireNode(data: Record<string, unknown>) {
  const r = buildRegistrationGraph([factor(data)] as never, [] as never)
  if (!r.ok) throw new Error('projection refused')
  return r.graph.nodes[0] as Record<string, unknown>
}

describe('a withdrawn extraction marker is not registered', () => {
  it('node-level `extractionType: null` is omitted', () => {
    expect('extractionType' in wireNode({ extractionType: null })).toBe(false)
  })

  it('`observedState.extractionType: null` is omitted, and the rest of the bundle is kept', () => {
    const obs = wireNode({ observedState: { value: 0.65, source: 'cee_inference', extractionType: null } }).observed_state as Record<string, unknown>
    expect(obs).toEqual({ value: 0.65, source: 'cee_inference' })
  })

  it('CONTRAST: a real marker passes through unchanged, at both levels', () => {
    const n = wireNode({ extractionType: 'inferred', observedState: { value: 0.8, extractionType: 'explicit' } })
    expect(n.extractionType).toBe('inferred')
    expect((n.observed_state as Record<string, unknown>).extractionType).toBe('explicit')
  })

  // #2077 review 5842259529: the product writes the bundle under BOTH
  // spellings. `withObservedStateUpdate` (the receipt's stamp) writes
  // `observedState` and `observed_state` together, and USER_VALUE_STAMP carries
  // no `extractionType`, so the edit's withdrawn null survives in both. The
  // snake spelling used to be copied verbatim AFTER the filtered one and win.
  const afterTypedEdit = { extractionType: null, observedState: { value: 0.7, source: 'cee_inference', extractionType: null } }

  it('the receipt-stamped shape (both spellings, USER_VALUE_STAMP) sends ONE bundle with no null', () => {
    const stamped = withObservedStateUpdate(afterTypedEdit, USER_VALUE_STAMP)
    expect(stamped.observed_state).toHaveProperty('extractionType', null) // precondition: the null IS in the snake spelling
    const n = wireNode(stamped)
    expect(n.observed_state).toEqual({ value: 0.7, source: 'user_override' })
    expect('observedState' in n).toBe(false)
  })

  it('CONTRAST: the confirmation stamp (a real marker) is kept through the same shape', () => {
    const n = wireNode(withObservedStateUpdate(afterTypedEdit, USER_CONFIRMATION_STAMP))
    expect(n.observed_state).toEqual({ value: 0.7, source: 'user_confirmed', extractionType: 'explicit' })
  })

  it('a stale snake spelling never overrides the bundle the canvas shows (readObservedState precedence)', () => {
    const n = wireNode({
      observedState: { value: 0.9, source: 'user_override' },
      observed_state: { value: 0.7, source: 'user_override' },
    })
    expect(n.observed_state).toEqual({ value: 0.9, source: 'user_override' })
  })

  it('a node carrying only the snake spelling still registers its bundle, filtered', () => {
    const n = wireNode({ observed_state: { value: 0.4, source: 'cee_inference', extractionType: null } })
    expect(n.observed_state).toEqual({ value: 0.4, source: 'cee_inference' })
  })

  it('the acknowledgement digest reads a withdrawn marker exactly as an absent one', () => {
    const withdrawn = factor({ extractionType: null, observedState: { value: 0.65, extractionType: null } })
    const absent = factor({ observedState: { value: 0.65 } })
    expect(isSameAnalyticalModel([withdrawn] as never, [] as never, [absent] as never, [] as never)).toBe(true)
  })
})

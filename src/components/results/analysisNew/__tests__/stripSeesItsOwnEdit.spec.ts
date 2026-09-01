/**
 * The strip's subscription covers everything the strip renders.
 *
 * ⭐ THE DEFECT, WITNESSED ON DEPLOYED `32e9becd` (fresh guest, completed run).
 * A factor's detail offers "Change this value". Typing 42 and saving wrote
 * through — the canvas node re-rendered showing `42`, and the toast said
 * "Sent to Olumi". The detail the user had just typed into still read
 * **"No value set"**.
 *
 * Cause: `ModelStrip` subscribes through a SIGNATURE of `id:type`, so
 * `buildModelStrip` never recomputed when a node's `observed_state` changed.
 * The signature's own comment said `id:type` was "the only thing this component
 * displays" — true when written, false after `needsCheck` and false again after
 * `valueText`/`valueSource`. A comment is not a subscription.
 *
 * ⚠ THE PAIR IS THE POINT. A signature that changed on EVERYTHING would fix the
 * staleness and reintroduce the defect the signature exists to prevent —
 * re-rendering this component continuously while a user drags the canvas. So
 * one case pins that it SEES a value change, and its twin pins that it does NOT
 * see a move. Neither alone shows the subscription is aimed correctly.
 */
import { describe, expect, it } from 'vitest'
import { buildModelStrip, stripNodeValueSignature } from '../buildModelStrip'

const node = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Engineering hiring pressure', ...over },
})

const sig = (n: unknown) => stripNodeValueSignature(n as { data?: unknown })

describe('the signature sees every field the strip renders', () => {
  it('changes when an observed VALUE is set', () => {
    const before = sig(node())
    const after = sig(node({ observedState: { value: 0.42, raw_value: 42 } }))
    expect(before).not.toBe(after)
  })

  it('changes when only the SOURCE changes — the provenance line renders it', () => {
    const a = sig(node({ observedState: { value: 0.42, source: 'cee_inference' } }))
    const b = sig(node({ observedState: { value: 0.42, source: 'user_override' } }))
    expect(a).not.toBe(b)
  })

  it('changes when only the UNIT changes — the displayed value depends on it', () => {
    const a = sig(node({ observedState: { value: 0.42, raw_value: 42, unit: '£' } }))
    const b = sig(node({ observedState: { value: 0.42, raw_value: 42, unit: '%' } }))
    expect(a).not.toBe(b)
  })

  /**
   * ⭐ THE TWIN, AND IT IS WHY THIS IS A SIGNATURE RATHER THAN THE NODE ARRAY.
   * React Flow replaces the array on every drag frame. If a move moved the
   * signature, this component would rebuild the whole strip continuously while
   * the user drags.
   */
  it('does NOT change when the node merely MOVES', () => {
    const at = (x: number, y: number) => ({
      ...node({ observedState: { value: 0.42, raw_value: 42 } }),
      position: { x, y },
    })
    expect(sig(at(0, 0))).toBe(sig(at(900, 400)))
  })

  it('is empty — not a crash — for a node carrying no observed state at all', () => {
    expect(sig(node())).toBe('')
    expect(sig(undefined)).toBe('')
  })
})

describe('the built strip reflects a value the moment it is written', () => {
  it('reports the new value, not the one the node had when the strip was last built', () => {
    const before = buildModelStrip([node()])
    expect(before.rows[0].nodes[0].valueText, 'precondition: it starts with none').toBeNull()

    const after = buildModelStrip([node({ observedState: { value: 0.42, raw_value: 42, unit: '£' } })])
    expect(after.rows[0].nodes[0].valueText).toContain('42')
    // …and the signature that gates the rebuild moved with it, which is the
    // half the deployed defect actually failed.
    expect(sig(node())).not.toBe(
      sig(node({ observedState: { value: 0.42, raw_value: 42, unit: '£' } })),
    )
  })
})

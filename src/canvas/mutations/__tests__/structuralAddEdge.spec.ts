/**
 * `structural_add_edge` — the wire builder, pinned at the field rules.
 *
 * ⭐ THE PROPERTY THIS FILE DEFENDS is not "does it build an object". It is that
 * every arm FAILS CLOSED: `null` means "this gesture has no truthful wire form",
 * and a caller must stand down rather than write locally and hope. A local edge
 * with no wire event is exactly the silent loss this carrier exists to end, so a
 * builder that returned a best-effort payload would re-create it one layer down.
 */
import { describe, it, expect } from 'vitest'
import {
  buildStructuralAddEdgeEvent,
  isWireEdgeDirection,
  isWireUsableMagnitude,
} from '../structuralAddEdge'

const HASH = 'sha256:' + 'a'.repeat(64)
const ok = {
  from: '2891dabb',
  to: 'c12af5de',
  magnitude: 0.7,
  direction: 'negative' as const,
  baseGraphHash: HASH,
}

describe('the happy path carries exactly the contract fields', () => {
  it('builds the member with the magnitude UNSIGNED and the direction separate', () => {
    const e = buildStructuralAddEdgeEvent(ok)
    expect(e).toEqual({
      kind: 'structural_add_edge',
      from: '2891dabb',
      to: 'c12af5de',
      magnitude: 0.7,
      effect_direction: 'negative',
      base_graph_hash: HASH,
    })
  })

  /**
   * ⛔ `std` AND `exists_probability` ARE ABSENT BY CONTRACT — "the server owns
   * them". A client that sent them would assert a confidence nobody expressed,
   * and CEE would persist it as the user's. This is the arm that reds if a
   * later change "helpfully" fills them in.
   */
  it('sends NO confidence and NO uncertainty', () => {
    const e = buildStructuralAddEdgeEvent(ok) as Record<string, unknown>
    for (const forbidden of ['std', 'exists_probability', 'strength', 'edge_type', 'label']) {
      expect(e[forbidden], `${forbidden} must not be on the wire`).toBeUndefined()
    }
  })

  it('does not sign the magnitude — the server applies the direction', () => {
    // A negative direction must NOT arrive as a negative magnitude: the contract
    // bounds it [0,1], so a signed value would fail validation at the boundary.
    expect(buildStructuralAddEdgeEvent({ ...ok, direction: 'negative' })?.magnitude).toBe(0.7)
  })
})

describe('every arm fails closed', () => {
  it.each([
    ['a missing base hash', { baseGraphHash: undefined }],
    ['an empty base hash', { baseGraphHash: '' }],
    ['a non-canonical source', { from: 'a -> b' }],
    ['a non-canonical target', { to: '' }],
    ['a magnitude above the contract bound', { magnitude: 1.5 }],
    ['a negative magnitude', { magnitude: -0.3 }],
    ['a non-finite magnitude', { magnitude: Number.NaN }],
    ['an unknown direction', { direction: 'unknown' }],
    ['a missing direction', { direction: undefined }],
  ])('refuses %s', (_label, override) => {
    expect(buildStructuralAddEdgeEvent({ ...ok, ...override })).toBeNull()
  })

  /**
   * ⚠ REFUSE, NEVER CLAMP — and this is the arm that says so. The canvas's own
   * weight domain is open (the Model tab chip accepts 0–2), so 1.5 is a value a
   * caller genuinely holds. Clamping it to 1 would send a number the user never
   * stated and CEE would persist it as theirs.
   */
  it('does not clamp an out-of-domain magnitude down to the bound', () => {
    expect(buildStructuralAddEdgeEvent({ ...ok, magnitude: 1.5 })).toBeNull()
    expect(isWireUsableMagnitude(1.5)).toBe(false)
    expect(isWireUsableMagnitude(1)).toBe(true)
    expect(isWireUsableMagnitude(0)).toBe(true)
  })

  it('admits only the two stated directions', () => {
    expect(isWireEdgeDirection('positive')).toBe(true)
    expect(isWireEdgeDirection('negative')).toBe(true)
    // `unknown` is excluded BY THE CONTRACT: a stated magnitude with an unknown
    // direction is an edge whose sign cannot be recovered.
    expect(isWireEdgeDirection('unknown')).toBe(false)
  })

  /**
   * ⭐ A SELF-EDGE IS BUILT, NOT REFUSED. Derived from the contract rather than
   * taste: `EdgeV3Schema` permits them, and "a transport-level refusal would
   * encode a MODELLING opinion the graph contract does not hold". The estate's
   * instinct is to refuse odd-looking input, so this is pinned to stop a later
   * tidy-up adding a rule the contract does not license.
   */
  it('builds a self-edge rather than encoding a modelling opinion', () => {
    expect(buildStructuralAddEdgeEvent({ ...ok, from: 'n1', to: 'n1' })).not.toBeNull()
  })
})

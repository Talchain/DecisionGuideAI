/**
 * ROADMAP D1 — a strength the USER stated must not come back stamped as Olumi's.
 *
 * MEASURED on served `e6d7971b`, 13 Sep 2026, my own scenario. A person draws a
 * link and states its strength; `structural_add_edge` saves it and the SERVER
 * records `provenance: { source: 'user_specified' }` — correctly. The canvas then
 * ingests the committed graph and stamps `weightSource: 'cee'`, and the panel
 * tells the reader *"Olumi's current estimate is 0.85"* and offers *"Confirm this
 * estimate"*. The product takes the user's own number and claims it.
 *
 * ⭐ THE BLAST RADIUS IS THE WHOLE GRAPH, NOT THE EDITED EDGE — measured with a
 * continuous trace: an edge set honest at t=0, an UNRELATED edge given a strength
 * at t=206ms, and the untouched edge flipped to `'cee'` at t=2478ms. Ingestion
 * re-maps every edge, so every save re-attributes every edge.
 *   ⇒ THE TEST THAT MATTERS IS THE ONE ON AN EDGE NOBODY EDITED. A spec that only
 *     checks the edge under edit cannot see this, which is how it shipped.
 *
 * ⛔ ABSENCE IS NOT EVIDENCE OF AUTHORSHIP. `@talchain/schemas` 0.55.0 — the UI's
 * own pin — contains NO `user_specified` literal at all; the field rides a
 * passthrough. The contract's own rule is that a consumer MUST NOT read a missing
 * provenance as any particular provenance, so an unstamped edge keeps today's
 * behaviour rather than being promoted to the user. Verified on the live wire
 * that the turn response DOES carry it: my edge came back
 * `provenance: {source:'user_specified'}` and a drafted edge in the SAME payload
 * came back `provenance: {source:'cee_hypothesis', reasoning: …}`.
 *
 * ⚠ `std` and `exists_probability` stay CEE's even on a user-specified edge, and
 * that is derived rather than assumed: CEE's `structural-add-edge` handler builds
 * them from server constants (`DEFAULT_STD`, `DEFAULT_EXISTS_PROBABILITY`) and its
 * header forbids stamping user provenance on them. Only the magnitude and the
 * direction are the user's.
 */
import { describe, it, expect } from 'vitest'

import { mapDraftEdgeToCanvas } from '../applyDraftResult'

/** A link the user drew and gave a strength to — what CEE actually returns. */
const userStated = {
  id: 'e-user',
  from: 'b51d9f9a',
  to: 'd8dac249',
  strength: { mean: 0.85, std: 0.1 },
  effect_direction: 'positive',
  exists_probability: 0.8,
  provenance: { source: 'user_specified' },
}

/** A link Olumi inferred — the CONTRAST, from the same live payload. */
const ceeHypothesis = {
  id: 'e-cee',
  from: '191b612a',
  to: '3ba7361d',
  strength: { mean: 0.5, std: 0.12 },
  effect_direction: 'positive',
  exists_probability: 0.8,
  origin: 'ai',
  provenance: { source: 'cee_hypothesis', reasoning: 'Model-inferred causal link' },
  provenance_display: 'ai_inferred',
}

/** No provenance at all — absence, which must change nothing. */
const unstamped = {
  id: 'e-bare',
  from: 'a',
  to: 'b',
  strength: { mean: 0.4, std: 0.1 },
  effect_direction: 'negative',
}

describe('a strength the user stated keeps its author through ingestion', () => {
  it('stamps weightSource "user" for a user_specified edge', () => {
    const mapped = mapDraftEdgeToCanvas(userStated, 0)
    expect(mapped.data.weightSource).toBe('user')
  })

  it('stamps directionSource "user" for a user_specified edge', () => {
    const mapped = mapDraftEdgeToCanvas(userStated, 0)
    expect(mapped.data.directionSource).toBe('user')
  })

  it('still carries the value the user stated, unchanged', () => {
    const mapped = mapDraftEdgeToCanvas(userStated, 0)
    expect(mapped.data.weight).toBe(0.85)
  })

  /**
   * THE DISCRIMINATOR. Green before the fix AND after it — so a blanket flip to
   * `'user'` fails here while the real fix passes. One test proving the hole is
   * closed is not enough; this is the one proving nothing was swallowed shut.
   */
  it('leaves an Olumi-inferred edge stamped "cee"', () => {
    const mapped = mapDraftEdgeToCanvas(ceeHypothesis, 1)
    expect(mapped.data.weightSource).toBe('cee')
    expect(mapped.data.directionSource).toBe('cee')
  })

  it('treats ABSENT provenance as unchanged behaviour, never as the user', () => {
    const mapped = mapDraftEdgeToCanvas(unstamped, 2)
    expect(mapped.data.weightSource).toBe('cee')
  })

  /**
   * The server's own constants stay the server's. CEE stamps `user_specified` on
   * the EDGE, but builds `std` and `exists_probability` itself.
   */
  it('does not claim the user authored std or existence', () => {
    const mapped = mapDraftEdgeToCanvas(userStated, 0)
    expect(mapped.data.strengthStdSource).toBe('cee')
    expect(mapped.data.beliefExistsSource).toBe('cee')
  })
})

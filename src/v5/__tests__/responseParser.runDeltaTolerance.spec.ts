/**
 * A MALFORMED `run_delta` MUST NOT COST THE USER THE WHOLE TURN.
 *
 * ⚠ THIS IS `responseParser.analysisStateTolerance.spec.ts`'s DEFECT, REPEATED
 * ON A KEY THAT LANDED LATER. That file states the rule and the criteria; the
 * criteria were never re-applied when `run_delta` was declared, so the same
 * whole-turn-loss vector is open again on a different field.
 *
 * MEASURED at the UI's own pinned `@talchain/schemas` 0.55.0, driving the
 * contract's OWN `maximalOlumiResponse` fixture rather than a hand-authored
 * shape (a fixture you wrote yourself encodes your model of the producer, not
 * the producer):
 *
 *     run_delta                          RunDeltaSchema   WHOLE OlumiResponse
 *     C1, builds_equal 'equal'   (ctrl)  PARSES           PARSES
 *     C1, builds_equal 'unknown'         REFUSED          ⛔ FAILS
 *     C0, builds_equal 'unknown'         REFUSED          ⛔ FAILS
 *     C2, builds_equal 'unknown'         PARSES           PARSES
 *
 * A whole-envelope failure returns `kind: 'parse_error'` — the user loses the
 * blocks, the coaching and the analysis result, to buy nothing.
 *
 * ⭐ WHY THIS IS REACHABLE RATHER THAN THEORETICAL, and it is the reason this
 * is worth a pin. `builds_equal` is a function of a PLoT ENVIRONMENT FLAG on a
 * DIFFERENT SERVICE: `_meta.builds` rides `UI_CANONICAL_META`, so turning that
 * flag off flips `builds_equal` from 'equal' to 'unknown' at runtime, with no
 * deploy of CEE or the UI. CEE's classifier correctly withholds in that state
 * TODAY — so today's protection is entirely one service's care, with no defence
 * in depth at the consumer. A cross-service runtime flag deciding whether a
 * third service can parse a response is exactly the seam that should fail soft.
 *
 * WHY THIS IS NOT AN ARGUMENT FOR TOLERATING EVERY DECLARED KEY — the sibling
 * file's scoping, re-checked against `run_delta` rather than assumed:
 *   1. optional and additive — the contract says so itself: *"absent on every
 *      non-rerun turn ... never defaulted, and a consumer renders NO delta card
 *      on absence."* A turn is meaningful without it.
 *   2. every consumer has a complete fallback for absence — today there are no
 *      consumers at all (measured: 0 non-test files), and the contract's
 *      prescribed behaviour on absence IS the fallback.
 * A malformed `analysis_ready` stays fatal. That is asserted below, not left
 * implicit, so this change cannot be read as loosening the envelope.
 */
import { describe, it, expect } from 'vitest'
import { maximalOlumiResponse } from '@talchain/schemas/fixtures'

import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
  QUARANTINED_KEYS_KEY,
} from '../responseParser'

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * ⚠ `stage_indicator` is REQUIRED. Omitting it makes this base itself invalid,
 * so every case returns `parse_error` and the file manufactures its own RED
 * that looks exactly like the defect under test. The sibling spec records
 * having done precisely that; the POSITIVE CONTROLS are what catch it.
 */
const BASE_PAYLOAD = {
  response_version: 2,
  assistant_text: 'here is the analysis',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

/** The CONTRACT's own valid block, not one this file invented. */
const VALID_RUN_DELTA = JSON.parse(
  JSON.stringify((maximalOlumiResponse as Record<string, unknown>).run_delta),
) as Record<string, unknown>

const withProvenance = (over: Record<string, unknown>): Record<string, unknown> => {
  const next = JSON.parse(JSON.stringify(VALID_RUN_DELTA)) as Record<string, unknown>
  next.pair_provenance = { ...(next.pair_provenance as object), ...over }
  return next
}

describe('run_delta tolerance — a bad delta costs the delta, never the turn', () => {
  it.each([
    // ⭐ THE REACHABLE ONE: the PLoT flag flips off, builds_equal goes
    // 'unknown', and a C1 that was honest a minute ago stops being parseable.
    ['a C1 whose builds equality became unverifiable', withProvenance({ builds_equal: 'unknown' })],
    [
      'a C0 whose builds equality became unverifiable',
      { ...withProvenance({ builds_equal: 'unknown', hash_equal: true }), attribution_case: 'C0_identical' },
    ],
    ['an attribution case outside the enum', { ...VALID_RUN_DELTA, attribution_case: 'C9_teapot' }],
    ['a missing required member', { attribution_case: 'C1_attributable' }],
    ['a wrong primitive type', { ...VALID_RUN_DELTA, win_probabilities: 'several' }],
    ['an outright non-object', 'not-an-object'],
    ['null', null],
  ])('%s → the turn still applies', async (_label, run_delta) => {
    const result = await parseV5Response(makeResponse({ ...BASE_PAYLOAD, run_delta }))

    // THE LOAD-BEARING ASSERTION: the turn survives.
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    // A tolerated key must not take neighbouring content with it.
    expect(result.response.assistant_text).toBe('here is the analysis')

    // And it must never arrive HALF-PARSED. A partial delta read as a change
    // record is worse than no delta: it would let a surface say "your change
    // did this" from a block the contract refused.
    expect((result.response as Record<string, unknown>).run_delta).toBeUndefined()
  })

  it('records the quarantine as a diagnostic rather than dropping it silently', async () => {
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, run_delta: withProvenance({ builds_equal: 'unknown' }) }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    const sidecar = (result.response as Record<string, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined
    const quarantined = sidecar?.[QUARANTINED_KEYS_KEY] as Record<string, unknown> | undefined

    expect(quarantined).toBeDefined()
    expect(Object.keys(quarantined ?? {})).toContain('run_delta')
  })

  it('⭐ POSITIVE CONTROL: a VALID run_delta still reaches parsed.data untouched', async () => {
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, run_delta: VALID_RUN_DELTA }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    // Over-firing would be the mirror defect: quarantining a good delta means
    // the consumer never sees a change record it was entitled to.
    expect((result.response as Record<string, unknown>).run_delta).toEqual(VALID_RUN_DELTA)

    const sidecar = (result.response as Record<string, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined
    const quarantined = sidecar?.[QUARANTINED_KEYS_KEY] as Record<string, unknown> | undefined
    expect(Object.keys(quarantined ?? {})).not.toContain('run_delta')
  })

  it('⛔ DISCRIMINATING: a malformed SUBSTANCE key is STILL fatal', async () => {
    // Without this, "the turn survived" could mean the envelope had been
    // loosened generally rather than one advisory key scoped. `analysis_ready`
    // carries the turn's substance; proceeding without it would render a turn
    // that misrepresents the server.
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, analysis_ready: 'not-a-boolean' }),
    )
    expect(result.kind).toBe('parse_error')
  })
})

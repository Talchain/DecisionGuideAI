/**
 * A MALFORMED `analysis_state` MUST NOT COST THE USER THE WHOLE TURN.
 *
 * THE REGRESSION THIS PINS, stated precisely because it is one this lane
 * INTRODUCED and did not notice:
 *
 * Before the 0.46.0 pin, `analysis_state` was an UNDECLARED top-level key. The
 * parser's tolerance step 1 split it off into the non-enumerable `__additive__`
 * sidecar, strict validation never saw it, and a turn carrying a garbage
 * `analysis_state` applied normally — graph patches, blocks, freshness and all.
 *
 * Declaring it made it strict. From that moment a producer bug in ONE optional
 * advisory field rejects the ENTIRE envelope at
 * `responseParser.ts` (`OlumiResponseSchema.safeParse` → `kind: 'parse_error'`),
 * so the user loses the turn. And the reader's own `cleared_invalid_shape`
 * branch in `applyV5State` — written specifically to degrade to the legacy
 * derivations on a bad verdict — became UNREACHABLE IN PRODUCTION, because
 * `applyV5State` only ever runs on a response that already parsed.
 *
 * That is strictly worse than not shipping the field. `analysis_state` is an
 * OPTIONAL, ADDITIVE authority: the honest failure mode is "ignore the verdict,
 * fall back to the derivations, record a diagnostic", never "lose the turn".
 *
 * WHY THIS IS NOT AN ARGUMENT FOR TOLERATING EVERY DECLARED KEY. A malformed
 * `analysis_ready` or `draft_graph` SHOULD still be fatal — those carry the
 * turn's substance, and silently proceeding without them would render a turn
 * that misrepresents what the server said. `analysis_state` is different in
 * kind: every surface that reads it has a complete, tested fallback that ran in
 * production until this pin landed. Tolerance is scoped to that property, and
 * the scoping is asserted below rather than left implicit.
 */
import { describe, it, expect } from 'vitest'

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
 * Minimal VALID envelope, carrying enough that a lost turn is observable.
 *
 * ⚠ `stage_indicator` is REQUIRED and its omission is not cosmetic: without it
 * this base is itself invalid, so every case below returns `parse_error` and
 * the suite reports a uniform red that looks exactly like the defect under
 * test. The first draft of this file omitted it and manufactured its own RED —
 * the tell was the POSITIVE CONTROLS failing, which no amount of strictness on
 * `analysis_state` could explain. The controls are what caught it.
 */
const BASE_PAYLOAD = {
  response_version: 2,
  assistant_text: 'here is the analysis',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

/** A verdict that satisfies AnalysisStateV1 in full. */
const VALID_ANALYSIS_STATE = {
  run_state: { kind: 'complete_current', computed_at: '2026-08-16T10:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {},
  usable_for_prose: true,
  usable_for_chips: true,
  usable_for_followup: true,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
}

describe('analysis_state tolerance — a bad verdict costs the verdict, never the turn', () => {
  it.each([
    ['an unknown run_state kind', { ...VALID_ANALYSIS_STATE, run_state: { kind: 'teapot' } }],
    [
      'a branch carrying a field its kind cannot honestly hold',
      {
        ...VALID_ANALYSIS_STATE,
        run_state: {
          kind: 'refused',
          reason_code: 'declined',
          computed_at: '2026-08-16T10:00:00.000Z',
        },
      },
    ],
    ['a missing required member', { run_state: { kind: 'never_run' } }],
    ['a wrong primitive type', { ...VALID_ANALYSIS_STATE, usable_for_prose: 'yes' }],
    ['an outright non-object', 'not-an-object'],
    ['null', null],
  ])('%s → the turn still applies', async (_label, analysis_state) => {
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, analysis_state }),
    )

    // THE LOAD-BEARING ASSERTION: the turn survives.
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    // The rest of the envelope is intact — a tolerated key must not take any
    // neighbouring content with it.
    expect(result.response.assistant_text).toBe('here is the analysis')

    // The verdict itself is GONE from the validated surface, so the selector
    // feature-detects absent and falls back to the legacy derivations. It must
    // never arrive half-parsed: a partially-valid verdict read as authority is
    // worse than no verdict.
    expect(
      (result.response as Record<string, unknown>).analysis_state,
    ).toBeUndefined()
  })

  it('records the quarantine as a diagnostic rather than dropping it silently', async () => {
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, analysis_state: { run_state: { kind: 'teapot' } } }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    const sidecar = (result.response as Record<string, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined
    const quarantined = sidecar?.[QUARANTINED_KEYS_KEY] as
      | Record<string, unknown>
      | undefined

    // A silent drop is the defect one level down: the debug bundle must be able
    // to say the producer sent something unreadable.
    expect(quarantined).toBeDefined()
    expect(Object.keys(quarantined ?? {})).toContain('analysis_state')
  })

  it('POSITIVE CONTROL: a VALID analysis_state still reaches parsed.data untouched', async () => {
    // Without this, every assertion above would also pass if tolerance had been
    // implemented by deleting the key unconditionally — the field would be
    // permanently dark and the suite would applaud (trap 13).
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, analysis_state: VALID_ANALYSIS_STATE }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(result.response.analysis_state).toStrictEqual(VALID_ANALYSIS_STATE)

    const sidecar = (result.response as Record<string, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown> | undefined
    const quarantined = sidecar?.[QUARANTINED_KEYS_KEY] as
      | Record<string, unknown>
      | undefined
    expect(Object.keys(quarantined ?? {})).not.toContain('analysis_state')
  })

  it('SCOPE CONTROL: a malformed analysis_ready is STILL fatal', async () => {
    // Tolerance is scoped to the additive advisory keys, and this is the
    // assertion that keeps it scoped. `analysis_ready` carries the turn's
    // substance and has no complete fallback; if a later edit widened the
    // quarantine set to "every declared key", this test is what REDs.
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, analysis_ready: { status: 42 } }),
    )
    expect(result.kind).toBe('parse_error')
  })
})

describe('model_building_notices tolerance — same surface, same treatment', () => {
  it('a malformed model_building_notices does not cost the turn', async () => {
    // It shares the property exactly: declared by this same pin, optional,
    // advisory, and with no consumer that depends on it to render the turn.
    const result = await parseV5Response(
      makeResponse({
        ...BASE_PAYLOAD,
        // Violates the superRefine: total_count disagrees with the group sum.
        model_building_notices: {
          total_count: 99,
          groups: [{ kind: 'other', count: 1 }],
          details_redacted: true,
        },
      }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(result.response.assistant_text).toBe('here is the analysis')
    expect(
      (result.response as Record<string, unknown>).model_building_notices,
    ).toBeUndefined()
  })

  it('POSITIVE CONTROL: a VALID model_building_notices survives', async () => {
    const valid = {
      total_count: 3,
      groups: [
        { kind: 'detail_not_connected', count: 2 },
        { kind: 'relationship_not_used', count: 1 },
      ],
      details_redacted: true,
    }
    const result = await parseV5Response(
      makeResponse({ ...BASE_PAYLOAD, model_building_notices: valid }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(result.response.model_building_notices).toStrictEqual(valid)
  })
})

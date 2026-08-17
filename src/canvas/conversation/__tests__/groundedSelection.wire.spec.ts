/**
 * `_grounded_selection` — THE WIRE BINDING (CEE hop 4b, consumer half).
 *
 * EVERY EXPECTATION HERE IS DERIVED FROM THE PRODUCER'S BYTES at CEE
 * `bf4a1d28`, not from this repo's reading of what the field ought to mean
 * (CLAUDE.md trap 13c — a mutant kit measures whether a test can DETECT a
 * change, never whether the EXPECTATION is right, so an oracle taken from the
 * consumer's own head scores perfectly on the wrong exam):
 *
 *   · `src/orchestrator-v5/context/grounded-selection.ts`
 *       :50-81  the shape, and `element_ids` MAY be empty ("EMPTY is meaningful
 *               and honest")
 *       :71-79  `not_in_model` / `could_not_check` MUST NOT COLLAPSE
 *       :86-89  ungrounded ⇒ the KEY IS ABSENT, never `null`
 *       :104    `if (focus === undefined) return null`
 *   · `src/orchestrator-v5/context/context-pack-assembler.ts`
 *       :834    the CLOSED ENUM `'none' | 'not_in_model' | 'could_not_check'`
 *   · `src/orchestrator/route-v2.ts`
 *       :1543   `if (egress.ok && ctx.groundedSelection)` — unconditional on
 *               the success path, no flag
 *
 * ⭐ THE CARRIER IS PROVEN BY EXECUTION, NOT BY INSPECTION. The question that
 * kills a slice like this is *does the non-enumerable `__additive__` sidecar
 * actually reach the reader?* — a spread anywhere on the way loses it. The first
 * describe block therefore drives the REAL `parseV5Response` over a REAL
 * `Response` carrying the sidecar exactly as CEE emits it, and reads it back
 * through the production accessor. Nothing here hand-builds the sidecar and
 * then asserts the accessor can read a hand-built sidecar, which would prove
 * only that the test and the accessor agree.
 */
import { describe, it, expect } from 'vitest'
import { parseV5Response } from '../../../v5/responseParser'
import {
  extractGroundedSelectionSidecar,
  parseGroundedSelection,
  type GroundedUnresolved,
} from '../groundedSelection'

/** Canonical canvas ids — distinct, non-guessable tokens so a match is identity. */
const FACTOR_ID = 'node-engineer-salary-7c1f'
const OPTION_ID = 'node-hire-contractor-93ab'

/** The required declared surface, minimal valid values (see the parser specs). */
const BASE_PAYLOAD = {
  response_version: 2,
  assistant_text: 'Engineer salary is the biggest cost driver here.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
} as const

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('_grounded_selection — the carrier actually delivers (real parser, real Response)', () => {
  it('survives parseV5Response and is readable through the production accessor', async () => {
    const result = await parseV5Response(
      makeResponse({
        ...BASE_PAYLOAD,
        _grounded_selection: { element_ids: [FACTOR_ID], unresolved: 'none' },
      }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    // The declared surface is untouched — the sidecar is not smuggled into it.
    expect((result.response as { assistant_text: string }).assistant_text).toBe(
      BASE_PAYLOAD.assistant_text,
    )

    const grounded = extractGroundedSelectionSidecar(result.response)
    expect(grounded, 'the sidecar did not survive the parse — the carrier is cut').not.toBeNull()
    // IDENTITY, not a value predicate another element could satisfy (trap 19).
    expect(grounded!.element_ids).toEqual([FACTOR_ID])
    expect(grounded!.unresolved).toBe('none')
  })

  it('an undeclared root key is NOT promoted onto the strict surface', async () => {
    const result = await parseV5Response(
      makeResponse({
        ...BASE_PAYLOAD,
        _grounded_selection: { element_ids: [FACTOR_ID], unresolved: 'none' },
      }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    // Enumerable surface stays clean: the key rides the non-enumerable sidecar.
    expect(Object.keys(result.response)).not.toContain('_grounded_selection')
  })

  it('⭐ FABRICATION GUARD — a turn with NO sidecar yields null, so no claim can be made', async () => {
    const result = await parseV5Response(makeResponse({ ...BASE_PAYLOAD }))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(extractGroundedSelectionSidecar(result.response)).toBeNull()
  })

  it('preserves PERSISTED-GRAPH ORDER as received — never re-sorted', async () => {
    // Producer contract grounded-selection.ts:54-62. Reverse-alphabetical on
    // purpose: an accidental sort would be visible.
    const result = await parseV5Response(
      makeResponse({
        ...BASE_PAYLOAD,
        _grounded_selection: { element_ids: [OPTION_ID, FACTOR_ID], unresolved: 'none' },
      }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(extractGroundedSelectionSidecar(result.response)!.element_ids).toEqual([
      OPTION_ID,
      FACTOR_ID,
    ])
  })
})

describe('_grounded_selection — accessor read paths', () => {
  it('reads the top-level key as a defensive fallback (un-demoted parser change)', () => {
    const grounded = extractGroundedSelectionSidecar({
      _grounded_selection: { element_ids: [OPTION_ID], unresolved: 'none' },
    })
    expect(grounded).toEqual({ element_ids: [OPTION_ID], unresolved: 'none' })
  })

  it('returns null for a non-object response rather than throwing', () => {
    expect(extractGroundedSelectionSidecar(undefined)).toBeNull()
    expect(extractGroundedSelectionSidecar(null)).toBeNull()
    expect(extractGroundedSelectionSidecar('a string')).toBeNull()
  })
})

describe('parseGroundedSelection — the CLOSED ENUM, and it stays closed', () => {
  // Derived from context-pack-assembler.ts:834. Iterated rather than hand-cased
  // so a member cannot be silently skipped.
  const MEMBERS: readonly GroundedUnresolved[] = ['none', 'not_in_model', 'could_not_check']

  it.each(MEMBERS)('accepts the producer member %s and preserves it verbatim', (member) => {
    const parsed = parseGroundedSelection({ element_ids: [FACTOR_ID], unresolved: member })
    expect(parsed).not.toBeNull()
    expect(parsed!.unresolved).toBe(member)
  })

  it('⭐ the three members are DISTINCT values — nothing normalises them together', () => {
    const parsed = MEMBERS.map((m) =>
      parseGroundedSelection({ element_ids: [], unresolved: m })!.unresolved,
    )
    expect(new Set(parsed).size).toBe(MEMBERS.length)
  })

  it('fails closed on an unrecognised unresolved value (a 4th member needs an explicit edit)', () => {
    expect(parseGroundedSelection({ element_ids: [FACTOR_ID], unresolved: 'not_sure' })).toBeNull()
    expect(parseGroundedSelection({ element_ids: [FACTOR_ID] })).toBeNull()
    expect(parseGroundedSelection({ element_ids: [FACTOR_ID], unresolved: 7 })).toBeNull()
  })
})

describe('parseGroundedSelection — EMPTY element_ids is valid, not malformed', () => {
  it('⭐ preserves an empty set with a reason — the producer emits exactly this', () => {
    // Witnessed in the producer's own suite: grounded-selection-route-level.test.ts
    // :295-296 asserts `element_ids: []` with `unresolved: 'not_in_model'`.
    // Rejecting this shape would silently drop the producer's honest
    // "nothing resolved, and here is why" turn.
    const parsed = parseGroundedSelection({ element_ids: [], unresolved: 'not_in_model' })
    expect(parsed).not.toBeNull()
    expect(parsed!.element_ids).toEqual([])
    expect(parsed!.unresolved).toBe('not_in_model')
  })

  it('fails closed when element_ids is absent or not an array', () => {
    expect(parseGroundedSelection({ unresolved: 'none' })).toBeNull()
    expect(parseGroundedSelection({ element_ids: FACTOR_ID, unresolved: 'none' })).toBeNull()
    expect(parseGroundedSelection({ element_ids: null, unresolved: 'none' })).toBeNull()
  })

  it('drops non-string / blank ids without failing the payload, and never invents one', () => {
    const parsed = parseGroundedSelection({
      element_ids: [FACTOR_ID, '', '   ', 42, null, OPTION_ID],
      unresolved: 'none',
    })
    expect(parsed!.element_ids).toEqual([FACTOR_ID, OPTION_ID])
  })

  it('rejects a non-object payload', () => {
    expect(parseGroundedSelection(null)).toBeNull()
    expect(parseGroundedSelection('x')).toBeNull()
    expect(parseGroundedSelection(undefined)).toBeNull()
  })
})

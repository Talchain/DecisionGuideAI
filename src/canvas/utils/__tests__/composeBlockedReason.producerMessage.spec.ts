/**
 * A4 — THE PRODUCER'S REPAIR GUIDANCE MUST REACH THE USER, VERBATIM.
 *
 * `composeAnalysisBlockedReason` received the full `AnalysisBlocker` — every
 * field in scope — and deliberately DISCARDED `blocker.message`, returning
 * instead `"{label}" is not ready for analysis yet. Ask in the chat what it
 * needs.`
 *
 * Two things were wrong with that, and this spec pins both:
 *
 *  1. THE CONTRACT MANDATES THE OPPOSITE. `AnalysisBlockerSchema.message`
 *     (`@talchain/schemas/boundary` 0.48.0) describes itself as "the
 *     producer-authored, user-facing sentence for this blocker, rendered
 *     VERBATIM… a consumer must not rewrite, summarise, truncate for meaning,
 *     or synthesise a substitute when it dislikes the wording."
 *
 *  2. THE SUBSTITUTE WAS ACTIVELY WRONG. "Ask in the chat what it needs"
 *     points at a path only a readiness CHIP opens; typing in the chat does
 *     not reach it. The product named a remedy the user cannot perform.
 *
 * ── WHY THE VET IS `isSafeCeeText`, NOT `containsBannedTerm` (MEASURED) ─────
 * The obvious vet is the canonical glossary (`containsBannedTerm`), which is
 * what `safeDisplayLabel` uses for LABELS. It is not sufficient here, and the
 * difference is not theoretical — it was measured at this tip before the fix
 * was written:
 *
 *   'Choose the missing effect value for "Move billing to edge computing".'
 *     containsBannedTerm → false      (canonical list has no bare "edge")
 *     isSafeCeeText      → false      (`CEE_EXTRA_TERMS` does)
 *     guardCeeText(…)    → 'Choose the missing effect value for
 *                           "Move billing to connection computing".'
 *
 * i.e. a message vetted only against the canonical glossary still reaches the
 * render seam's substituting guard and has the USER'S OWN OPTION LABEL rewritten
 * into an option that exists on no canvas — the exact corruption
 * `vetBlockedReason`'s header records, reproduced on the producer's sentence.
 * So the compose-time vet uses the RENDER SEAM'S OWN PREDICATE, which is the
 * only vet that can promise what ships is what was checked.
 *
 * That is also HOW THE GUARD IS BYPASSED, and it is deliberately not a bypass:
 * `guardCeeText` returns its input UNCHANGED when `isSafeCeeText(text)` is true
 * (`ceeTextGuard.ts:112`). Vetting with that same predicate makes the guard a
 * PROVEN IDENTITY on everything this composer emits, so no surface has to be
 * taught a new provenance and no surface can be forgotten. `SEAM` below pins
 * exactly that, end to end, rather than assuming it.
 */

import { describe, it, expect } from 'vitest'

import type { AnalysisBlocker } from '@talchain/schemas/boundary'
import { AnalysisBlockerSchema } from '@talchain/schemas/boundary'

import {
  BLOCKED_REASON_COPY,
  composeAnalysisBlockedReason,
} from '../composeBlockedReason'
import { vetBlockedReason } from '../vetBlockedReason'
import {
  isSafeCeeText,
  guardCeeText,
} from '../../components/pre-analysis-v3/signals/ceeTextGuard'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES — PINNED TO THE CONTRACT, NOT TO THE AUTHOR'S MODEL OF IT.
//
// Trap 16-inverse: a fixture the author wrote is not evidence about the wire.
// Every blocker below is `safeParse`d against the REAL `AnalysisBlockerSchema`
// at construction, so a fixture outside the producer's admissible domain fails
// loudly here instead of certifying the code over inputs that cannot arrive.
// ═══════════════════════════════════════════════════════════════════════════

function blocker(overrides: Partial<AnalysisBlocker> = {}): AnalysisBlocker {
  const built = {
    code: 'MISSING_OPTION_VALUE',
    category: 'option_values',
    message: 'Choose the missing effect value for "Launch in Q1".',
    repairability: 'human_input_required',
    option_id: 'opt_launch_q1',
    option_label: 'Launch in Q1',
    ...overrides,
  }
  const parsed = AnalysisBlockerSchema.safeParse(built)
  if (!parsed.success) {
    throw new Error(
      `fixture is not a valid AnalysisBlocker: ${JSON.stringify(parsed.error.issues)}`,
    )
  }
  return parsed.data
}

/** The five messages CEE actually ships, as captured in this repo's fixtures. */
const CANONICAL_CEE_MESSAGES = [
  'Choose the missing effect value for "Launch in Q1".',
  'Choose the missing effect value.',
  'Review the unresolved constraint for "Cut burn rate by 30%".',
  'Review the unresolved constraint.',
  'The option has no effect values.',
] as const

// ═══════════════════════════════════════════════════════════════════════════
// A4 — THE MESSAGE REACHES THE USER.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4 — the producer message is rendered verbatim', () => {
  it('VERBATIM — one blocker renders its own message, not a synthesised substitute', () => {
    const message = 'Choose the missing effect value for "Launch in Q1" on "Revenue".'
    // Precondition pinned IN-TEST (trap 13b): this payload must genuinely be
    // one the vet admits, or a green result below could mean "the fixture
    // stopped reproducing the case" rather than "the code is right".
    expect(isSafeCeeText(message)).toBe(true)

    const reason = composeAnalysisBlockedReason([
      blocker({ code: 'MISSING_OPTION_VALUE', message }),
    ])

    expect(reason).toBe(message)
    // …and the substitute is gone. Bound to the discarded rung by IDENTITY
    // through the copy factory, never by a substring another rung could satisfy.
    expect(reason).not.toBe(BLOCKED_REASON_COPY.canonicalOneBlocker('Launch in Q1'))
    expect(reason).not.toContain('Ask in the chat')
  })

  it('IDENTITY — the message rendered is the one belonging to the named CODE, not to a position', () => {
    // The discriminating case for trap 19. Two blockers, and the assertion is
    // about WHICH message belongs to WHICH code — so an implementation that
    // read `blockers[0]` for everything, or matched on a value predicate the
    // other blocker also satisfies, cannot pass by coincidence.
    const first = blocker({
      code: 'MISSING_OPTION_VALUE',
      message: 'Choose the missing effect value for "Launch in Q1".',
      option_id: 'opt_launch_q1',
      option_label: 'Launch in Q1',
    })
    const second = blocker({
      code: 'AMBIGUOUS_OPTION_VALUE',
      message: 'Confirm which effect value applies to "Hold until Q3".',
      option_id: 'opt_hold',
      option_label: 'Hold until Q3',
    })

    const byCode = (code: string, list: readonly AnalysisBlocker[]): string => {
      const found = list.find((b) => b.code === code)
      if (!found) throw new Error(`fixture lost the blocker coded ${code}`)
      return found.message
    }

    const reason = composeAnalysisBlockedReason([first, second])

    expect(reason).toContain(byCode('MISSING_OPTION_VALUE', [first, second]))
    expect(reason).toContain(byCode('AMBIGUOUS_OPTION_VALUE', [first, second]))
    // Order is the PRODUCER'S own array order — deterministic, and not ours to
    // choose. Asserted as a whole string so a reordering REDs.
    expect(reason).toBe(`${first.message} ${second.message}`)
  })

  it('ALL FIVE canonical CEE messages survive the vet and render verbatim', () => {
    for (const message of CANONICAL_CEE_MESSAGES) {
      // Verified here, not inherited from a prior sweep's claim.
      expect(isSafeCeeText(message), `vet rejects: ${message}`).toBe(true)
      expect(composeAnalysisBlockedReason([blocker({ message })])).toBe(message)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BOTH DIRECTIONS — a one-sided guard is the defect one level up.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4 — a message the render seam would corrupt is handled safely', () => {
  const CORRUPTIBLE = 'Choose the missing effect value for "Move billing to edge computing".'

  it('PRECONDITION — this message really is one the seam would rewrite', () => {
    // Without this, the test below could pass because the message is harmless,
    // not because the code declined it. Pins its own precondition, and pins the
    // MEASURED corruption so a change to the guard REDs here rather than
    // silently making this case vacuous.
    expect(isSafeCeeText(CORRUPTIBLE)).toBe(false)
    expect(guardCeeText(CORRUPTIBLE, 'FALLBACK').text).toBe(
      'Choose the missing effect value for "Move billing to connection computing".',
    )
  })

  it('DEGRADES WHOLE — never a rewritten label, never a partial mix', () => {
    const reason = composeAnalysisBlockedReason([
      blocker({ message: CORRUPTIBLE, option_label: 'Move billing to edge computing' }),
    ])

    // The user's own words are never rewritten…
    expect(reason).not.toContain('connection computing')
    // …and the producer's unsafe sentence is not rendered either.
    expect(reason).not.toBe(CORRUPTIBLE)
    // The answer is the structured rung: a LESS SPECIFIC TRUE claim, composed
    // from the scope label. Bound by identity through the copy factory.
    expect(reason).toBe(
      BLOCKED_REASON_COPY.canonicalOneBlocker('Move billing to edge computing'),
    )
  })

  it('ALL-OR-NOTHING — one unsafe message in a list degrades the WHOLE sentence', () => {
    // Rendering only the safe half would understate the work outstanding by
    // exactly the entries we declined — the A2 rule, inherited. And mixing the
    // producer's prose with ours would attribute our sentence to the producer.
    const safe = blocker({
      code: 'MISSING_OPTION_VALUE',
      message: 'Choose the missing effect value for "Launch in Q1".',
    })
    const unsafe = blocker({
      code: 'AMBIGUOUS_OPTION_VALUE',
      message: CORRUPTIBLE,
      option_id: 'opt_billing',
      option_label: 'Move billing to edge computing',
    })

    const reason = composeAnalysisBlockedReason([safe, unsafe])

    expect(reason).not.toContain('connection computing')
    expect(reason).not.toBe(safe.message)
    expect(reason).toBe(
      BLOCKED_REASON_COPY.canonicalTwoBlockers('Launch in Q1', 'Move billing to edge computing'),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE ABSENT-MESSAGE FALLBACK — honest, never a fabricated sentence.
//
// SCOPE, STATED PRECISELY (trap 20): at this tip a blocker CANNOT reach the
// composer without a non-empty `message`. All three writers of
// `analysisStateV1` Zod-parse the payload first
// (`v5/applyV5State.ts:1180`, `adapters/cee/scenarioGraph.ts:222` via
// `hydrate/applyScenarioAnalysisRead.ts:241`, and
// `hooks/useProvisionalAnalysisDelivery.ts:215` which only exposes the setter),
// and `message` is `z.string().min(1)` REQUIRED on a `.strict()` schema — so an
// absent or empty message fails the parse and CLEARS the verdict to null.
//
// These cases are therefore DEFENCE IN DEPTH for a function whose own docstring
// promises to be total, not a claim that the wire can produce them. They are
// here because the function is exported and its type is not a runtime guarantee.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4 — an unusable message falls back honestly, never to a fabrication', () => {
  it('CONTRACT PRECONDITION — the schema really does refuse an empty message', () => {
    // The derivation above, executed rather than asserted in a comment.
    expect(AnalysisBlockerSchema.safeParse({
      code: 'X', category: 'y', message: '', repairability: 'z',
    }).success).toBe(false)
    expect(AnalysisBlockerSchema.safeParse({
      code: 'X', category: 'y', repairability: 'z',
    }).success).toBe(false)
  })

  it('a blank message falls to the structured rung, not to a synthesised cause', () => {
    // Constructed past the schema on purpose: this is the runtime shape the
    // TYPE cannot exclude, which is the whole reason the guard exists.
    const unusable = {
      ...blocker(),
      message: '   ',
    } as AnalysisBlocker

    const reason = composeAnalysisBlockedReason([unusable])

    expect(reason).toBe(BLOCKED_REASON_COPY.canonicalOneBlocker('Launch in Q1'))
  })

  it('MIXED — one usable and one blank message degrades the WHOLE sentence', () => {
    // ⭐ ADDED AFTER A SURVIVING MUTANT, and the gap is worth recording: every
    // blank-message case above uses a SINGLE blocker, and with one blocker
    // `return null` and `continue` produce the identical answer — so the
    // all-or-nothing rule for BLANK messages was asserted nowhere. Changing
    // `return null` to `continue` left the whole suite GREEN while the composer
    // silently rendered only the usable half, understating the work outstanding
    // by exactly the entry it dropped (the A2 rule this module inherited).
    //
    // This is the opposite-direction twin the unsafe-message case already had
    // (`ALL-OR-NOTHING`) and the blank-message case did not. One direction
    // tested is a guard watching one door.
    const usable = blocker({
      code: 'MISSING_OPTION_VALUE',
      message: 'Choose the missing effect value for "Launch in Q1".',
    })
    const blank = {
      ...blocker({ code: 'UNKNOWN_BLOCKER', option_id: 'opt_hold', option_label: 'Hold until Q3' }),
      message: '   ',
    } as AnalysisBlocker

    const reason = composeAnalysisBlockedReason([usable, blank])

    // NOT the usable half on its own — that is the silent understatement.
    expect(reason).not.toBe(usable.message)
    expect(reason).not.toContain('Choose the missing effect value')
    // The honest answer names BOTH scopes through the structured rung.
    expect(reason).toBe(
      BLOCKED_REASON_COPY.canonicalTwoBlockers('Launch in Q1', 'Hold until Q3'),
    )
  })

  it('a missing message on an UNSCOPED blocker falls to the count, claiming nothing more', () => {
    const unusable = {
      code: 'UNKNOWN', category: 'other', repairability: 'unknown',
    } as unknown as AnalysisBlocker

    const reason = composeAnalysisBlockedReason([unusable])

    // No label to quote and no message to render: the honest answer names a
    // COUNT and no cause at all.
    expect(reason).toBe(BLOCKED_REASON_COPY.canonicalManyBlockers(1))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE SEAM — the guard is a PROVEN IDENTITY, not an assumed one.
// ═══════════════════════════════════════════════════════════════════════════

describe('A4 SEAM — what the composer emits survives the render path unchanged', () => {
  it('vetBlockedReason returns every emitted producer message byte-for-byte', () => {
    for (const message of CANONICAL_CEE_MESSAGES) {
      const composed = composeAnalysisBlockedReason([blocker({ message })])
      // The composer emitted it…
      expect(composed).toBe(message)
      // …and the ONE render seam hands it back untouched. This is the assertion
      // that would RED if `guardCeeText` ever started substituting on text its
      // own `isSafeCeeText` calls safe — i.e. it pins the coupling the fix
      // relies on, rather than trusting today's implementation of it.
      expect(vetBlockedReason(composed)).toBe(message)
    }
  })

  it('EVERY emitted sentence survives the render seam unchanged, on BOTH arms', () => {
    // Stated as the general property rather than as samples, so a future rung
    // cannot pass by not being sampled.
    //
    // ⚠ THE TWO ARMS ARE NOT INTERCHANGEABLE, and asserting `isSafeCeeText` over
    // all of them would be WRONG — it was, in this spec's first draft. A
    // DEGRADED sentence may legitimately quote a user label carrying "edge"
    // (`safeDisplayLabel` vets against the canonical glossary, which has no bare
    // "edge"); it reaches the user through `classifyBlockedReason`'s
    // `composed-safe` arm, which never consults `isSafeCeeText` at all. Only the
    // PRODUCER-MESSAGE arm needs that predicate, because only it is classified
    // `foreign` and routed through the substituting guard.
    //
    // So the shared property is the one that actually matters at the surface —
    // the seam returns the string untouched — and the stricter per-arm claims
    // are made separately below.
    const emitted = [
      ...CANONICAL_CEE_MESSAGES.map((m) => composeAnalysisBlockedReason([blocker({ message: m })])),
      composeAnalysisBlockedReason([
        blocker({ message: 'Choose the missing effect value for "Move billing to edge computing".' }),
      ]),
      composeAnalysisBlockedReason([]),
    ]
    for (const text of emitted) {
      expect(vetBlockedReason(text), `seam altered: ${text}`).toBe(text)
    }
  })

  it('DERIVED COUPLING — producer-authored output is a PROVEN identity under guardCeeText', () => {
    // The coupling the fix rests on, asserted as the general property over
    // everything the producer-message arm can emit — including a joined
    // multi-blocker sentence, whose SEAMS are where a cross-boundary banned
    // phrase would appear.
    const producerAuthored = [
      ...CANONICAL_CEE_MESSAGES.map((m) => composeAnalysisBlockedReason([blocker({ message: m })])),
      composeAnalysisBlockedReason([
        blocker({ code: 'A', message: CANONICAL_CEE_MESSAGES[0] }),
        blocker({ code: 'B', message: CANONICAL_CEE_MESSAGES[2] }),
      ]),
    ]
    for (const text of producerAuthored) {
      expect(isSafeCeeText(text), `emitted sentence is not seam-safe: ${text}`).toBe(true)
      const guarded = guardCeeText(text, 'FALLBACK')
      expect(guarded.text).toBe(text)
      expect(guarded.degraded).toBe(false)
      expect(guarded.sanitised).toBe(false)
    }
  })

  it('the JOIN is what gets vetted, not the parts — a phrase formed across the seam degrades', () => {
    // A1's rule one level up: what is vetted must be exactly what ships. Two
    // messages that are individually safe form "confidence score" across the
    // space between them, which the canonical glossary bans as a phrase.
    const left = 'Set the option confidence'
    const right = 'score is missing for "Launch in Q1".'
    // Precondition pinned in-test: each half must genuinely pass on its own, or
    // this case proves nothing about the JOIN.
    expect(isSafeCeeText(left)).toBe(true)
    expect(isSafeCeeText(right)).toBe(true)
    expect(isSafeCeeText(`${left} ${right}`)).toBe(false)

    const reason = composeAnalysisBlockedReason([
      blocker({ code: 'A', message: left, option_label: 'Launch in Q1' }),
      blocker({ code: 'B', message: right, option_id: 'opt_hold', option_label: 'Hold until Q3' }),
    ])

    expect(reason).toBe(BLOCKED_REASON_COPY.canonicalTwoBlockers('Launch in Q1', 'Hold until Q3'))
  })

  it('an exactly-repeated message is rendered once, not twice', () => {
    // The one list-level transformation. Every surviving sentence is
    // byte-identical to a producer message; nothing is rewritten.
    const message = 'Choose the missing effect value.'
    const reason = composeAnalysisBlockedReason([
      blocker({ code: 'A', message, option_id: 'opt_a', option_label: 'A' }),
      blocker({ code: 'B', message, option_id: 'opt_b', option_label: 'B' }),
    ])
    expect(reason).toBe(message)
  })
})

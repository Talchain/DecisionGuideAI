/**
 * Spark intent contract (A1 meta-decision diagnosis, 2026-07-20).
 *
 * The defect: product-authored spark prompts travelled to CEE as anonymous
 * text (`source='chip'`, no metadata), bypassing CEE's deterministic chip
 * branch; the draft-shape regex then misread "What should I check before
 * running the first analysis?" as a decision BRIEF on an empty canvas and
 * the drafter faithfully modelled a meta-decision. EVERY spark in the
 * registry would misroute the same way.
 *
 * The contract pinned here:
 *  1. Every registry spark ships EXPLICIT intent metadata — an `action_type`
 *     decision (a schema-enum value, a declared pending value, or a
 *     deliberate null) plus a stable id. The vocabulary is DERIVED from
 *     @talchain/schemas ActionType.options, never a hand-kept list (trap
 *     12: hand-maintained mirrors drift green).
 *  2. The spark click path carries that metadata to the outgoing wire
 *     payload (chip.parameters.spark_id always; chip.action_type when the
 *     registry declares one AND the send gate lets it through) — asserted at
 *     the built-payload JSON, through the REAL production seams
 *     (useConversationActions → ActionChip → buildChipMeta → buildV5Payload).
 *  3. THE SEND GATE — TWO INDEPENDENT SIGNALS. CEE ingress validates
 *     action_type FAIL-CLOSED, so a value CEE does not accept would 422 the
 *     whole turn. A mapped value reaches the wire IFF it is BOTH published in
 *     OUR vendored enum (KNOWN_ACTION_TYPES) AND present in the CEE-acceptance
 *     registry (CEE_ACCEPTED_ACTION_TYPES) — never our own publication alone,
 *     which says nothing about whether CEE accepts it. A value failing either
 *     signal is withheld ENTIRELY — no action_type key, no chip_click
 *     promotion, identity parameters still travel — so the turn is no worse
 *     than today. The class-killer test below proves publication alone can
 *     NEVER open the gate: that is what makes the "we published it, so it
 *     sends, so CEE 422s it" class impossible.
 *  4. Free-typed user text is NEVER stamped with product intent — the
 *     composer payload carries no chip object at all (the same honesty
 *     requirement in reverse).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ActionType } from '@talchain/schemas/boundary'

import { ACTIONS_MENU, SPARK_PROMPTS } from '../constants'
import type { SparkPrompt } from '../types'
import { buildChipMeta, PENDING_WIRE_ACTION_TYPES } from '../../../conversation/chipMeta'
import {
  buildV5Payload,
  KNOWN_ACTION_TYPES,
  CEE_ACCEPTED_ACTION_TYPES,
  isSendableToken,
} from '../../../../v5/buildPayload'
import type { ActionChip } from '../../../conversation/types'

// ---------------------------------------------------------------------------
// Hook collaborators — replaced wholesale so the spec exercises the hook's
// real logic without mounting the conversation stack.
// ---------------------------------------------------------------------------
const { sendChipSpy } = vi.hoisted(() => ({
  sendChipSpy: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendChip: sendChipSpy }),
}))
vi.mock('../../../ToastContext', () => ({
  useShowToast: () => vi.fn(),
}))
vi.mock('../../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(),
}))

import { useConversationActions } from '../hooks/useConversationActions'

/** The complete spark registry — DERIVED by iterating both collections. */
const ALL_SPARKS: ReadonlyArray<SparkPrompt> = [
  ...ACTIONS_MENU,
  ...Object.values(SPARK_PROMPTS),
]

/** "Published" — present in the enum WE vendored. One of the two send signals. */
const SCHEMA_ACTION_TYPES: ReadonlySet<string> = new Set(ActionType.options)
const PENDING_SET: ReadonlySet<string> = new Set<string>(PENDING_WIRE_ACTION_TYPES)

/**
 * The REAL send gate: a value reaches the wire IFF it is BOTH published in the
 * vendored enum AND accepted by CEE. Deferred to the PRODUCTION predicate and
 * the PRODUCTION registries so this spec cannot drift from the gate it guards
 * (and so the acceptance-registry mutation-check bites the concrete-outcome
 * tests below, not this helper).
 */
function isSendable(actionType: string): boolean {
  return isSendableToken(actionType, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES)
}

beforeEach(() => {
  sendChipSpy.mockClear()
})

describe('spark registry — every spark ships explicit intent metadata', () => {
  it('registry is non-empty (positive control for the iteration)', () => {
    expect(ALL_SPARKS.length).toBeGreaterThanOrEqual(15)
  })

  it.each(ALL_SPARKS.map(s => [s.id, s] as const))(
    'spark %s declares action_type explicitly (enum value or deliberate null) and a stable id',
    (_id, spark) => {
      // Own-property check: a spark added WITHOUT the field fails here even
      // if the type system were bypassed (spread, any-cast, JSON import).
      expect(
        Object.prototype.hasOwnProperty.call(spark, 'action_type'),
        `spark "${spark.label}" ships no action_type decision — every product-authored prompt must declare its intent (null is a valid, deliberate declaration)`,
      ).toBe(true)
      expect(spark.action_type, 'action_type must be null or an enum member, never undefined').not.toBeUndefined()
      if (spark.action_type !== null) {
        expect(
          SCHEMA_ACTION_TYPES.has(spark.action_type) || PENDING_SET.has(spark.action_type),
          `action_type "${spark.action_type}" is neither a published @talchain/schemas ActionType member nor a declared PENDING_WIRE_ACTION_TYPES entry — an undeclared value would 422 CEE ingress`,
        ).toBe(true)
      }
      expect(spark.id).toBeTruthy()
      expect(spark.prompt.trim().length).toBeGreaterThan(0)
    },
  )

  it('ids are unique within each collection', () => {
    const menuIds = ACTIONS_MENU.map(s => s.id)
    expect(new Set(menuIds).size).toBe(menuIds.length)
    const sparkIds = Object.values(SPARK_PROMPTS).map(s => s.id)
    expect(new Set(sparkIds).size).toBe(sparkIds.length)
  })

  /**
   * Cross-collection agreement. Uniqueness WITHIN each collection was the only
   * check, so the five entries SPARK_PROMPTS shared with ACTIONS_MENU could
   * drift apart — including the `action_type` wire adjudication — and ship
   * green. SPARK_PROMPTS now derives from ACTIONS_MENU by id, and this pins
   * that: a re-introduced copy that differs in any field fails here.
   *
   * The shared-id set is derived by intersection, never hand-listed.
   */
  it('every id shared with ACTIONS_MENU carries an IDENTICAL entry', () => {
    const menuById = new Map<string, (typeof ACTIONS_MENU)[number]>(
      ACTIONS_MENU.map(item => [item.id, item]),
    )
    const shared = Object.values(SPARK_PROMPTS).filter(s => menuById.has(s.id))

    // Positive control: an empty intersection would make the loop vacuous.
    expect(shared.length).toBeGreaterThan(0)

    for (const spark of shared) {
      const menuItem = menuById.get(spark.id)!
      expect(
        { id: spark.id, label: spark.label, prompt: spark.prompt, action_type: spark.action_type },
        `SPARK_PROMPTS."${spark.id}" diverges from its ACTIONS_MENU entry — the two must stay one declaration, not two copies`,
      ).toEqual({
        id: menuItem.id,
        label: menuItem.label,
        prompt: menuItem.prompt,
        action_type: menuItem.action_type,
      })
    }
  })
})

describe('spark click → outgoing wire payload (real send funnel)', () => {
  it.each(ALL_SPARKS.map(s => [s.id, s] as const))(
    'spark %s ships spark_id (and any sendable action_type) on the built payload',
    (_id, spark) => {
      const { result } = renderHook(() => useConversationActions())
      const accepted = result.current.sendPrompt(spark)
      expect(accepted).toBe(true)
      expect(sendChipSpy).toHaveBeenCalledTimes(1)

      const chip = (sendChipSpy.mock.calls[0] as unknown[])[0] as ActionChip
      expect(chip.message).toBe(spark.prompt)
      expect(chip.parameters).toEqual({ spark_id: spark.id })
      if (spark.action_type === null) {
        // A null decision must not leak as a key CEE could misread.
        expect('action_type' in chip).toBe(false)
      } else {
        expect(chip.action_type).toBe(spark.action_type)
      }

      // sendChip → dispatchAction is a 1:1 field passthrough
      // (useConversation.sendChip: action_type/parameters from the chip);
      // from there the REAL production modules build the wire payload.
      const chipMeta = buildChipMeta({
        action_type: chip.action_type,
        parameters: chip.parameters,
      })
      const built = buildV5Payload({
        turnId: '00000000-0000-4000-8000-000000000001',
        scenarioId: '00000000-0000-4000-8000-000000000002',
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: chip.message ?? '',
        source: 'chip',
        chipMeta,
      })
      if (!built.ok) throw new Error('payload build failed: ' + JSON.stringify(built))
      const payload = built.payload as {
        source: string
        message: string
        chip?: { action_type?: string; parameters?: Record<string, unknown> }
      }

      // The wire carries the product intent explicitly — through the SEND
      // GATE: a sendable value (published AND CEE-accepted) is sent and
      // promotes the source to CEE's deterministic chip branch; anything else
      // is withheld entirely; null-intent sparks ship identity only.
      expect(payload.message).toBe(spark.prompt)
      expect(payload.chip).toBeDefined()
      expect(payload.chip?.parameters).toEqual({ spark_id: spark.id })
      if (spark.action_type !== null && isSendable(spark.action_type)) {
        expect(payload.source).toBe('chip_click')
        expect(payload.chip?.action_type).toBe(spark.action_type)
      } else {
        expect(payload.source).toBe('chip')
        expect(payload.chip && 'action_type' in payload.chip).toBe(false)
      }
    },
  )

  it('the sendable arm is exercised by REAL registry data (analysis_readiness sparks send)', () => {
    // Positive control for the send arm: at least one registry spark maps to a
    // fully-live value, so a regression to all-null/all-withheld would stop
    // exercising chip_click and be caught here. prepare_first_analysis (the
    // defect spark) and calibrate_estimates carry analysis_readiness.
    const sendableMapped = ALL_SPARKS.filter(
      (s) => s.action_type !== null && isSendable(s.action_type),
    )
    expect(sendableMapped.length).toBeGreaterThanOrEqual(1)
    expect(sendableMapped.map((s) => s.id)).toContain('prepare_first_analysis')
  })

  it('SENDABLE: analysis_readiness reaches the wire BECAUSE both signals hold (published in 0.20.0 AND CEE-accepted)', () => {
    // Independent, HARDCODED expectations — deliberately NOT derived from the
    // registries, so removing analysis_readiness from CEE_ACCEPTED_ACTION_TYPES
    // (the mutation-check) turns this RED. That is what proves the gate keys
    // off ACCEPTANCE and not merely publication: under a publication-only gate
    // this would stay green when acceptance is removed.
    expect(KNOWN_ACTION_TYPES.has('analysis_readiness')).toBe(true) // published — 0.20.0 re-vendor
    expect(CEE_ACCEPTED_ACTION_TYPES.has('analysis_readiness')).toBe(true) // accepted — CEE #578 + A1 (2026-07-20)

    const built = buildV5Payload({
      turnId: '00000000-0000-4000-8000-000000000007',
      scenarioId: '00000000-0000-4000-8000-000000000008',
      stage: 'frame',
      turnClass: 'frame',
      mode: 'user',
      message: 'What should I check before running the first analysis?',
      source: 'chip',
      chipMeta: buildChipMeta({
        action_type: 'analysis_readiness',
        parameters: { spark_id: 'prepare_first_analysis' },
      }),
    })
    if (!built.ok) throw new Error('payload build failed')
    const payload = built.payload as {
      source: string
      chip?: { action_type?: string; parameters?: Record<string, unknown> }
    }
    expect(payload.source).toBe('chip_click')
    expect(payload.chip?.action_type).toBe('analysis_readiness')
    expect(payload.chip?.parameters).toEqual({ spark_id: 'prepare_first_analysis' })
  })

  it('CROSS-REPO PIN: an analysis_readiness spark tap sends source=chip_click + chip.action_type=analysis_readiness through the REAL funnel (CEE typed-readiness routing)', () => {
    // WHY THIS PIN EXISTS — a cross-repo regression tripwire, not a fix.
    //
    // CEE's typed-readiness arm (olumi-assistants-service route-v2.ts:1882-1885,
    // merged #594; A1 confirmed at the CEE bytes 2026-07-21) routes on the
    // MESSAGE-turn shape `ingress.source === 'chip_click' && chip.action_type
    // !== undefined`, then `chip.action_type === 'analysis_readiness'` → the
    // readiness arm. It reads NO chip.parameters. Our side satisfies this by
    // construction post-#405: the acceptance gate graduated analysis_readiness
    // and buildPayload promotes source→'chip_click' when a published+accepted
    // action_type is bound. If that promotion ever silently breaks, the ONLY
    // symptom is zero `v5.readiness_intake` telemetry — no error, no 422. Hence
    // an explicit, funnel-real pin on the two wire fields CEE routes on.
    //
    // Real funnel only (no hand-built chipMeta): each analysis_readiness spark
    // is tapped via useConversationActions.sendPrompt → sendChip → the SAME
    // production build seams the generic funnel test above uses. Sparks derived
    // from the registry (never hand-listed — trap 12), so a spark added or
    // re-mapped is covered automatically.
    const readinessSparks = Array.from(
      new Map(
        ALL_SPARKS
          .filter((s) => s.action_type === 'analysis_readiness')
          .map((s) => [s.id, s] as const),
      ).values(),
    )

    // Positive control: the readiness sparks must actually exist, or the loop
    // below asserts nothing (trap 13 — an absence proof needs a presence proof).
    expect(readinessSparks.length).toBeGreaterThanOrEqual(1)
    expect(readinessSparks.map((s) => s.id)).toContain('prepare_first_analysis')

    for (const spark of readinessSparks) {
      const { result } = renderHook(() => useConversationActions())
      sendChipSpy.mockClear()
      const accepted = result.current.sendPrompt(spark)
      expect(accepted, `sendPrompt rejected ${spark.id}`).toBe(true)
      expect(sendChipSpy).toHaveBeenCalledTimes(1)

      const chip = (sendChipSpy.mock.calls[0] as unknown[])[0] as ActionChip
      const chipMeta = buildChipMeta({
        action_type: chip.action_type,
        parameters: chip.parameters,
      })
      const built = buildV5Payload({
        turnId: '00000000-0000-4000-8000-000000000009',
        scenarioId: '00000000-0000-4000-8000-00000000000a',
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: chip.message ?? '',
        source: 'chip',
        chipMeta,
      })
      if (!built.ok) throw new Error('payload build failed: ' + JSON.stringify(built))
      const payload = built.payload as {
        source: string
        chip?: { action_type?: string }
      }

      // The two fields, and only these two, that CEE route-v2.ts:1882-1885
      // keys the typed-readiness arm off.
      expect(payload.source, `${spark.id} must promote to chip_click`).toBe('chip_click')
      expect(
        payload.chip?.action_type,
        `${spark.id} must carry chip.action_type=analysis_readiness on the wire`,
      ).toBe('analysis_readiness')
    }
  })

  it('CLASS-KILLER: a value PUBLISHED in the enum but NOT in the acceptance registry is WITHHELD — publication alone can never open the gate', () => {
    // This is the test that makes the 422 class impossible. It drives the REAL
    // send predicate with SYNTHETIC registries so it can model a value that is
    // published-but-unaccepted — a state no real value is in today, precisely
    // because the acceptance registry is the second signal. Under the old
    // publication-only gate `isSendableToken` would ignore `accepted` and
    // this would be RED.
    const synthetic = 'synthetic_published_but_unaccepted_value'

    // Premise: synthetic is treated as PUBLISHED (in the enum set we pass) yet
    // is genuinely absent from the CEE-acceptance registry.
    const publishedWithSynthetic = new Set<string>([...KNOWN_ACTION_TYPES, synthetic])
    expect(publishedWithSynthetic.has(synthetic)).toBe(true)
    expect((CEE_ACCEPTED_ACTION_TYPES as ReadonlySet<string>).has(synthetic)).toBe(false)

    // The AND bites on the ACCEPTANCE signal: published but unaccepted → withheld.
    expect(isSendableToken(synthetic, publishedWithSynthetic, CEE_ACCEPTED_ACTION_TYPES)).toBe(false)

    // Mirror — acceptance WITHOUT publication is also insufficient, so neither
    // signal can open the gate alone.
    const acceptedWithSynthetic = new Set<string>([...CEE_ACCEPTED_ACTION_TYPES, synthetic])
    expect((KNOWN_ACTION_TYPES as ReadonlySet<string>).has(synthetic)).toBe(false)
    expect(isSendableToken(synthetic, KNOWN_ACTION_TYPES, acceptedWithSynthetic)).toBe(false)
  })

  it('CLASS-KILLER (end-to-end): an unrecognised value is withheld by buildV5Payload — identity-only chip, never a 422 (positive control: the send arm above proves the gate CAN pass a value)', () => {
    // Complements the pure-predicate class-killer by driving the FULL wire
    // builder: an action_type that clears neither signal must never reach the
    // wire. Paired with the SENDABLE test above (which proves the same builder
    // DOES pass a genuinely-live value), this is a real presence/absence pair
    // (trap 13), not a vacuous absence.
    const unrecognised = 'coach_readiness_value_pending_0_20_0'
    expect(isSendable(unrecognised)).toBe(false)

    const built = buildV5Payload({
      turnId: '00000000-0000-4000-8000-000000000005',
      scenarioId: '00000000-0000-4000-8000-000000000006',
      stage: 'frame',
      turnClass: 'frame',
      mode: 'user',
      message: 'What should I check before running the first analysis?',
      source: 'chip',
      chipMeta: buildChipMeta({
        action_type: unrecognised,
        parameters: { spark_id: 'prepare_first_analysis' },
      }),
    })
    if (!built.ok) throw new Error('payload build failed')
    const payload = built.payload as {
      source: string
      chip?: { action_type?: string; parameters?: Record<string, unknown> }
    }
    expect(payload.source).toBe('chip')
    expect(payload.chip).toBeDefined()
    expect(payload.chip && 'action_type' in payload.chip).toBe(false)
    expect(payload.chip?.parameters).toEqual({ spark_id: 'prepare_first_analysis' })
  })

  it('list hygiene: every declared pending value is genuinely NOT yet sendable (a graduated value must be removed from the list)', () => {
    // PENDING_WIRE_ACTION_TYPES is DECLARATIVE staging, not the gate. A value
    // listed there must still be withheld by the REAL gate; the moment it goes
    // fully live (published AND CEE-accepted) this asserts RED, forcing its
    // removal. Currently empty — analysis_readiness graduated on 2026-07-20 —
    // so this loop is vacuous by design; the class-killer + withhold tests
    // above are the standing positive controls for the withhold arm.
    for (const pending of PENDING_SET) {
      expect(
        isSendable(pending),
        `PENDING_WIRE_ACTION_TYPES entry "${pending}" is now fully live (published AND CEE-accepted) — remove it from the pending list`,
      ).toBe(false)
    }
  })
})

describe('free-typed text is NEVER stamped with product intent', () => {
  it('a composer message builds with no chip object at all', () => {
    // The defect text itself, typed by a user: it must reach CEE as the
    // user's own words with no product-intent metadata attached.
    const built = buildV5Payload({
      turnId: '00000000-0000-4000-8000-000000000003',
      scenarioId: '00000000-0000-4000-8000-000000000004',
      stage: 'frame',
      turnClass: 'frame',
      mode: 'user',
      message: 'Run the analysis now',
      source: 'composer',
    })
    if (!built.ok) throw new Error('payload build failed')
    const payload = built.payload as Record<string, unknown>
    expect(payload.source).toBe('composer')
    expect('chip' in payload).toBe(false)
  })

  it('buildChipMeta yields nothing when neither intent field is present', () => {
    expect(buildChipMeta({})).toBeUndefined()
  })
})

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
 *     registry declares one) — asserted at the built-payload JSON, through
 *     the REAL production seams (useConversationActions → ActionChip →
 *     buildChipMeta → buildV5Payload).
 *  3. THE PUBLICATION GATE: CEE ingress validates action_type FAIL-CLOSED
 *     against ITS vendored enum, so an unpublished value would 422 the
 *     whole turn. A mapped value present in OUR vendored enum is sent (and
 *     promotes source to chip_click); a mapped-but-unpublished value
 *     (PENDING_WIRE_ACTION_TYPES) is withheld ENTIRELY — no action_type
 *     key, no chip_click promotion, identity parameters still travel — so
 *     the turn is no worse than today until a schema re-vendor lights the
 *     value up with zero code change.
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
import { buildV5Payload } from '../../../../v5/buildPayload'
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

const SCHEMA_ACTION_TYPES: ReadonlySet<string> = new Set(ActionType.options)
const PENDING_SET: ReadonlySet<string> = new Set<string>(PENDING_WIRE_ACTION_TYPES)

/** Gate verdict for a mapped value: published values send; pending withhold. */
function isPublished(actionType: string): boolean {
  return SCHEMA_ACTION_TYPES.has(actionType)
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
})

describe('spark click → outgoing wire payload (real send funnel)', () => {
  it.each(ALL_SPARKS.map(s => [s.id, s] as const))(
    'spark %s ships spark_id (and any action_type) on the built payload',
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

      // The wire carries the product intent explicitly — through the
      // publication gate: published values send (and promote the source to
      // CEE's deterministic chip branch); pending values are withheld
      // entirely; null-intent sparks ship identity only.
      expect(payload.message).toBe(spark.prompt)
      expect(payload.chip).toBeDefined()
      expect(payload.chip?.parameters).toEqual({ spark_id: spark.id })
      if (spark.action_type !== null && isPublished(spark.action_type)) {
        expect(payload.source).toBe('chip_click')
        expect(payload.chip?.action_type).toBe(spark.action_type)
      } else {
        expect(payload.source).toBe('chip')
        expect(payload.chip && 'action_type' in payload.chip).toBe(false)
      }
    },
  )

  it('publication gate: a mapped-but-unpublished value is withheld entirely (positive control for the withhold arm)', () => {
    // The pending set is empty today, so no registry spark exercises the
    // withhold arm — this synthetic value proves the gate BITES: without it
    // every "pending values are withheld" claim above would be vacuously
    // green (trap 13: an absence assertion needs a positive control).
    const syntheticPending = 'coach_readiness_value_pending_0_20_0'
    expect(SCHEMA_ACTION_TYPES.has(syntheticPending)).toBe(false)

    const chipMeta = buildChipMeta({
      action_type: syntheticPending,
      parameters: { spark_id: 'prepare_first_analysis' },
    })
    const built = buildV5Payload({
      turnId: '00000000-0000-4000-8000-000000000005',
      scenarioId: '00000000-0000-4000-8000-000000000006',
      stage: 'frame',
      turnClass: 'frame',
      mode: 'user',
      message: 'What should I check before running the first analysis?',
      source: 'chip',
      chipMeta,
    })
    if (!built.ok) throw new Error('payload build failed')
    const payload = built.payload as {
      source: string
      chip?: { action_type?: string; parameters?: Record<string, unknown> }
    }

    // Withheld ENTIRELY: no action_type key, no chip_click promotion —
    // exactly today's identity-only chip, never a 422 risk.
    expect(payload.source).toBe('chip')
    expect(payload.chip).toBeDefined()
    expect(payload.chip && 'action_type' in payload.chip).toBe(false)
    expect(payload.chip?.parameters).toEqual({ spark_id: 'prepare_first_analysis' })
  })

  it('publication gate: every declared pending value is genuinely unpublished (list hygiene)', () => {
    // A pending entry that already exists in the vendored enum is a stale
    // declaration — the re-vendor landed; remove it from the list.
    for (const pending of PENDING_SET) {
      expect(
        SCHEMA_ACTION_TYPES.has(pending),
        `PENDING_WIRE_ACTION_TYPES entry "${pending}" is now published in the vendored enum — remove it from the pending list`,
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

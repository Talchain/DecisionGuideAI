/**
 * ⭐ A CEE-EMITTED `analysis_readiness` CHIP MUST REACH THE USER.
 *
 * WITNESSED (deployed, fresh guest, 2026-08-20): a fresh user was refused an
 * analysis and every offered route ended in a refusal. CEE's recovery chip
 * carried no `action_type`, so it reached CEE as ordinary chat, the LLM router
 * elected `run_analysis`, and the election gate DEMOTED it: "I have not run the
 * analysis, because I did not read that as a request to run one." The product
 * refused its own CTA.
 *
 * The CEE half of the fix types that chip `analysis_readiness` — the one
 * `action_type` route-v2 routes to the readiness arm without an LLM round-trip,
 * so it cannot be demoted.
 *
 * ⚠ BUT THE UI WOULD HAVE DELETED IT, AND THAT IS STRICTLY WORSE THAN THE
 * MISROUTE. `analysis_readiness` has no `ACTION_TO_TURN_TYPE` mapping, so it is
 * absent from the DERIVED `V5_ENABLED_ACTIONS`, and `SuggestedChips` filters out
 * any chip whose bound `action_type` is not V5-known. A chip that misroutes at
 * least gives the user something to click; a chip that never renders gives them
 * nothing. Typing the chip in CEE without this mapping would have shipped half a
 * capability.
 *
 * The wire was ALREADY ready — `analysis_readiness` is published in
 * `ActionType`, present in `CEE_ACCEPTED_ACTION_TYPES` (`buildPayload.ts:948`),
 * and a bound action_type promotes `source` to `chip_click`
 * (`buildPayload.ts:159-160`). Only the client's own dispatch vocabulary was
 * short — which is why the fix is a mapping, never a filter bypass:
 * `SuggestedChips`'s filter is DERIVED and correct, and patching it would leave
 * the click routing by accidental fall-through instead of by decision.
 *
 * ⭐ The existing vocabulary spec anticipated exactly this
 * (`explainChips.vocabulary.spec.ts:85-89`): "Add the mapping and the chip
 * lights up on its own; nobody has to remember to edit a list."
 */

import { describe, it, expect } from 'vitest'

import { ACTION_TO_TURN_TYPE, DISPATCHABLE_ACTION_TYPES } from '../actionTurnTypes'
import { V5_ENABLED_ACTIONS } from '../chipActionVocabulary'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { buildV5Payload } from '../../../v5/buildPayload'
import { buildChipMeta } from '../chipMeta'

/** The chip CEE emits on `analysis_not_ready`, verbatim from the CEE branch. */
const CEE_CHIP = {
  id: 'chip_prompt_fix_before_analysis',
  label: 'Prepare first analysis',
  message: 'What should I check before running the first analysis?',
  action_type: 'analysis_readiness',
} as const

describe('CEE analysis_readiness recovery chip — reaches the user and routes by type', () => {
  it('⭐ is dispatchable, so the derived render filter admits it', () => {
    // Bound by IDENTITY to the action_type, never to "the set is non-empty".
    expect(DISPATCHABLE_ACTION_TYPES.has('analysis_readiness')).toBe(true)
    expect(V5_ENABLED_ACTIONS.has('analysis_readiness')).toBe(true)
  })

  it('routes by a DELIBERATE turn type, not by default fall-through', () => {
    // The reason the fix is a mapping and not a filter bypass: `dispatchAction`
    // reads this map, and a missing key leaves `turnType` at its default while
    // the chip still advertises an action.
    expect(ACTION_TO_TURN_TYPE.analysis_readiness).toBe('conversation')
  })

  it('survives ingest from a producer suggested_action', () => {
    const chips = buildSuggestedActionChips([], [{ ...CEE_CHIP }])
    const chip = chips.find((c) => c.id === CEE_CHIP.id)
    expect(chip).toBeDefined()
    expect(chip?.action_type).toBe('analysis_readiness')
    expect(chip?.message).toBe(CEE_CHIP.message)
  })

  it('⭐ reaches the wire as source=chip_click with the type intact', () => {
    const result = buildV5Payload({
      message: CEE_CHIP.message,
      source: 'chip',
      chipMeta: buildChipMeta({
        id: CEE_CHIP.id,
        action_type: CEE_CHIP.action_type,
      }),
      scenarioId: 's1',
      stage: 'frame',
    } as Parameters<typeof buildV5Payload>[0])
    // `BuildV5PayloadResult` is a discriminated union: narrowing on `ok` also
    // pins that the payload builds at all, rather than reading `payload` off a
    // failure branch.
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(`payload did not build: ${result.reason}`)
    // Both halves by identity: the type is what route-v2 keys on, and
    // `source: 'chip_click'` is the other half of that route's condition.
    // `OrchestratorTurnPayload` is itself a union (message vs system-event), so
    // read the two fields through one narrow local view rather than asserting a
    // key the system-event arm does not carry.
    const sent = result.payload as { source?: string; chip?: { action_type?: string } }
    expect(sent.source).toBe('chip_click')
    expect(sent.chip?.action_type).toBe('analysis_readiness')
  })

  it('OPPOSITE DIRECTION — an unmapped action_type is still refused', () => {
    // Proves the admission above is a real discrimination and not a filter that
    // now says yes to everything. `explain_from_structure` remains unmapped.
    expect(DISPATCHABLE_ACTION_TYPES.has('explain_from_structure')).toBe(false)
    expect(V5_ENABLED_ACTIONS.has('explain_from_structure')).toBe(false)
  })
})

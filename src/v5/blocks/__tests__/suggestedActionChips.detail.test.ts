/**
 * `suggested_actions[].detail` must reach the chip row.
 *
 * ─── The defect this pins (measured 2026-09-18, UI+CEE staging heads) ───────
 * CEE's readiness repair offer is an APPLY CONTROL over the user's own model.
 * `buildReadinessRepairOffer`
 * (`olumi-assistants-service/src/orchestrator-v5/handlers/readiness-repair-proposal.ts:64-98`)
 * emits it into top-level `suggested_actions` as:
 *
 *   label   "Apply 3 safe model fixes"
 *   message "Yes, apply all 3 safe model fixes."
 *   detail  "Canonicalise the existing effect values for \"<option>\" without
 *            changing them." × one per change, joined
 *
 * and emits `detail` ONLY when `detail.length > label.length` — i.e. every
 * `detail` on the wire is, by construction, information the label does not
 * carry. It is the ONLY place the user can learn WHICH options an apply would
 * touch. `route-v2.ts:3300-3312` and `turn-executor.ts:3572-3583` both forward
 * it verbatim, and `ActionSchema` in `@talchain/schemas@0.55.0`
 * (`dist/boundary/olumi-response.d.ts:1536`) carries `detail?: z.ZodString`.
 *
 * `buildSuggestedActionChips` mapped id/label/message/action_type and DROPPED
 * `detail`, so the user was asked to authorise a mutation of their reasoning
 * model with the list of changes deleted on arrival. The readiness arm emits
 * NO `held_proposal` block (`readiness-intake.ts`: 0 occurrences, contrast
 * `suggested_actions` 4), so it cannot reach `V5HeldProposalBlock`, which is
 * the one surface that already honours `Action.detail` — the field was live
 * on one path and discarded on the other.
 *
 * Binding is by chip IDENTITY (`rrp_…` / `plain_…`), never by a value
 * predicate another chip could satisfy (trap 19).
 */
import { describe, it, expect } from 'vitest'

import { buildSuggestedActionChips } from '../suggestedActionChips'

// `suggestedActions` is an OPTIONAL parameter, so its type is `T | undefined`
// and indexing it directly is TS2537. `NonNullable` is the honest unwrap — it
// keeps the alias DERIVED from the function's own signature rather than
// restating the wire shape by hand.
type WireAction = NonNullable<Parameters<typeof buildSuggestedActionChips>[1]>[number]

/** The real readiness apply-chip shape, three changes. */
const APPLY_ID = 'rrp_7576c3fbaf58'
const APPLY_DETAIL =
  'Canonicalise the existing effect values for "Hire two engineers" without changing them. ' +
  'Canonicalise the existing effect values for "Raise prices 8%" without changing them. ' +
  'Canonicalise the existing effect values for "Do nothing" without changing them.'

const applyAction = {
  id: APPLY_ID,
  label: 'Apply 3 safe model fixes',
  message: 'Yes, apply all 3 safe model fixes.',
  detail: APPLY_DETAIL,
} as unknown as WireAction

const plainAction = {
  id: 'plain_01',
  label: 'What would change this?',
  message: 'What would change this?',
} as unknown as WireAction

describe('buildSuggestedActionChips — suggested_actions[].detail', () => {
  it('carries `detail` onto the chip the readiness apply control mints', () => {
    const chips = buildSuggestedActionChips([], [applyAction, plainAction])
    const applyChip = chips.find((c) => c.id === APPLY_ID)
    expect(applyChip).toBeDefined()
    expect(applyChip!.detail).toBe(APPLY_DETAIL)
  })

  it('names every option the apply would touch (the consent content, not just its length)', () => {
    const chips = buildSuggestedActionChips([], [applyAction])
    const applyChip = chips.find((c) => c.id === APPLY_ID)
    for (const option of ['Hire two engineers', 'Raise prices 8%', 'Do nothing']) {
      expect(applyChip!.detail).toContain(option)
    }
  })

  it('OPPOSITE-DIRECTION TWIN: a wire action with no `detail` mints no `detail` key', () => {
    const chips = buildSuggestedActionChips([], [applyAction, plainAction])
    const plainChip = chips.find((c) => c.id === 'plain_01')
    expect(plainChip).toBeDefined()
    expect('detail' in plainChip!).toBe(false)
  })

  it('DISCRIMINATION: the detail lands on the apply chip, not on its neighbour', () => {
    const chips = buildSuggestedActionChips([], [applyAction, plainAction])
    expect(chips.find((c) => c.id === APPLY_ID)!.detail).toBe(APPLY_DETAIL)
    expect(chips.find((c) => c.id === 'plain_01')!.detail).toBeUndefined()
  })
})

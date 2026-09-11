/**
 * ⭐ THE CANVAS COACHING PANEL'S "Define success" ROW MUST ASK FOR A TARGET,
 * NOT FOR A CONVERSATION ABOUT ONE.
 *
 * The SECOND surface that prescribes a success target and hands off to Olumi.
 * It carried its own copy of the Strengthen panel's vague sentence
 * ("Help me define what success looks like for this decision."), so the same
 * four-turn dead end measured on staging 2026-09-11 — Gate-1 unit clarify →
 * warrant demotion → `parameter_invalid_at_execute` → "I could not apply that
 * constraint…" — was reachable from the canvas without the Strengthen panel
 * being involved at all.
 *
 * The sentence now comes from one authority,
 * `components/results/strengthen/successTargetPrompt.ts`, which carries the
 * full witness and the derivation for each of its clauses.
 *
 * ⚠ THIS SPEC LIVES HERE BY STRUCTURE, NOT BY PREFERENCE. `inertness.spec.ts`
 * fails any file outside this module that imports Focus Now, so the assertion
 * cannot sit beside its Strengthen sibling.
 *
 * Bound to the row by ID, never by its title or its copy.
 */
import { describe, expect, it } from 'vitest'
import { STATIC_HYGIENE_ROWS } from '../focusConstants'

describe('Focus Now — the Define-success prefill is apply-able', () => {
  it('the static:define-success row asks for an "at least" target and an apply, never a work-through', () => {
    const row = STATIC_HYGIENE_ROWS.find((r) => r.id === 'static:define-success')
    expect(row).toBeDefined()
    // Precondition pinned in-test: this is a prefill row, so `prefillText` IS
    // the string a user sends. If the row ever stops being one, this spec must
    // fail rather than silently assert nothing.
    expect(row!.action?.kind).toBe('prefill')
    const prefill = (row!.action as { prefillText?: string }).prefillText ?? ''
    expect(prefill.length).toBeGreaterThan(0)
    // The two clauses CEE needs to apply a success target in one turn: the only
    // threshold direction that stamps the goal node's `goal_threshold_raw`, and
    // an explicit instruction to change the model.
    expect(prefill.toLowerCase()).toContain('at least')
    expect(prefill.toLowerCase()).toContain('apply')
    // And not the sentence that dead-ended.
    expect(prefill.toLowerCase()).not.toContain('work through')
    expect(prefill).not.toBe('Help me define what success looks like for this decision.')
  })
})

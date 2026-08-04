/**
 * useNodeDisplayMetadata — THE BASIS IS CARRIED, NOT DISCARDED (ROADMAP 2.283).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * `selectGoalProbability` publishes `basis` precisely so that no consumer has
 * to infer the IDENTITY of the number from the number. This hook called the
 * selector, took `goalProbability` and `goalFitIsModelledBasis` off the
 * result, and threw the rest away — `basis` was read and discarded at the
 * single call site.
 *
 * The consequence was structural, not cosmetic: `GoalNode` was the LAST live
 * un-gated possessive surface in the estate, and it could not be gated by
 * wiring alone, because the datum that discriminates
 * `probability_of_goal` from `probability_of_joint_goal` STANDING IN for it
 * never reached the render site. #556 gated six sibling surfaces and recorded
 * this one as deliberately-not-gated for exactly that reason.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS SEPARATELY FROM THE SURFACE SPEC (trap 11)
 * ─────────────────────────────────────────────────────────────────────────
 * #555's adversarial review, in THIS repo THIS week: a spec that asserted
 * against a LOCAL REIMPLEMENTATION of the hook's predicate stayed green when
 * the reviewer hard-coded the flag inside the hook, because the file never
 * imported the hook. Every test here calls
 * `renderHook(() => useNodeDisplayMetadata(...))` — the REAL hook, over the
 * REAL selector. Nothing in this file re-derives a basis.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIXTURE PROVENANCE
 * ─────────────────────────────────────────────────────────────────────────
 * `probability_of_joint_goal` present, `probability_of_goal` ABSENT, no
 * `constraint_analysis`, `goal_fit_basis.scored_from:
 * 'modelled_outcome_distribution'` is the witnessed staging shape of
 * 2026-08-01 (`PHASE0-EVIDENCE-2026-07-28/witness-2258-raw/run1b/`,
 * `run2/`, `run3/` — verified at the bytes: 0 occurrences of
 * `"probability_of_goal"`, 2 of `goal_threshold_frame`, 0 of
 * `constraint_analysis` in each run's `analysis-turn.json`). CEE left
 * `goal_threshold_frame` unstamped, so ISL refused `probability_of_goal`
 * outright and the joint figure is all that arrives.
 *
 * ⚠ ONE DELIBERATE DEPARTURE FROM THE WITNESS, DECLARED. The witnessed runs
 * carry NO `robustness.recommended_option_id` (0 occurrences in all three)
 * and `leading_option_id: null`. That pointer gap is a DIFFERENT, separately
 * rowed defect (ROADMAP 2.275, pinned by
 * `useNodeDisplayMetadata.goalFitAvailable.spec.ts`), and while it holds, this
 * hook never reaches the selector at all. These fixtures therefore supply the
 * pointer, so that the code path under test is EXECUTED. The per-option
 * payload shape is verbatim witnessed; the pointer is the minimum addition
 * that makes the branch reachable, and `it('control: the pointer gap …')`
 * below pins that this is the only thing it changes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  results: { status: string; report: unknown }
}

let store: UseBoundStore<StoreApi<MockCanvasState>>

vi.mock('../../store', () => ({
  get useCanvasStore() {
    return store
  },
}))

// Imported AFTER the store mock is registered, and imported for REAL — this
// file's whole point is that it executes the shipped hook.
const { useNodeDisplayMetadata } = await import('../useNodeDisplayMetadata')
const { selectGoalProbability } = await import(
  '../../../components/results/utils/selectGoalProbability'
)

/** The witnessed per-option shape: joint present, goal absent, unconstrained. */
const SUBSTITUTED_OPTION = {
  probability_of_joint_goal: 0.0054,
  goal_fit_basis: { scored_from: 'modelled_outcome_distribution', node_ids: ['goal_revenue'] },
}

/** A run that carries the REAL goal quantity — possessive earned. */
const REAL_GOAL_OPTION = {
  probability_of_goal: 0.55,
  probability_of_joint_goal: 0.0054,
}

/** The CONSTRAINED joint case (ROADMAP 1.49) — the user's own goal AND their
 *  own limits. Possessive earned; must never be swept up by this gate. */
const CONSTRAINED_OPTION = {
  probability_of_joint_goal: 0.42,
  constraint_analysis: { constraints: [{ id: 'c1' }] },
}

function reportFor(option: Record<string, unknown>, withPointer = true) {
  return {
    option_probabilities: { opt_a: option },
    robustness: withPointer
      ? { recommended_option_id: 'opt_a', display_verdict: 'fragile' }
      : { display_verdict: 'fragile' },
  }
}

function setReport(report: unknown, status = 'complete') {
  store = create<MockCanvasState>(() => ({ results: { status, report } }))
}

function renderForGoal() {
  return renderHook(() => useNodeDisplayMetadata('goal_revenue', 'goal')).result.current
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNodeDisplayMetadata — achievementProbabilityBasis (REAL hook)', () => {
  it('control: each fixture drives the REAL selector to the basis this suite claims for it', () => {
    // Anti-vacuity (trap 13). Without this, every assertion below could pass
    // because a fixture silently stopped reaching the branch under test — the
    // failure mode that made a PLoT leak test capture 0 bytes and assert
    // nothing.
    expect(selectGoalProbability(SUBSTITUTED_OPTION).basis).toBe('joint_goal_withheld')
    expect(selectGoalProbability(SUBSTITUTED_OPTION).mayUsePossessiveGoalFraming).toBe(false)
    // ⭐ L62: and it carries NO number — which is what turns the forwarding
    // test below from "forwards the basis with a value" into "forwards the
    // basis with the absence".
    expect(selectGoalProbability(SUBSTITUTED_OPTION).goalProbability).toBeNull()
    expect(selectGoalProbability(REAL_GOAL_OPTION).basis).toBe('goal_probability')
    expect(selectGoalProbability(REAL_GOAL_OPTION).mayUsePossessiveGoalFraming).toBe(true)
    expect(selectGoalProbability(CONSTRAINED_OPTION).basis).toBe('joint_goal_constrained')
    expect(selectGoalProbability(CONSTRAINED_OPTION).mayUsePossessiveGoalFraming).toBe(true)
  })

  /**
   * ⭐ AMENDED BY L62 (2026-08-04). 2.283 pinned that the hook forwarded the
   * substituted basis ALONGSIDE the substituted number, so a render site could
   * pick the honest voice for it. L60 §5–§8 showed the number is a structural
   * zero, so the selector withholds it — and the thing the hook must now
   * forward faithfully is the basis WITH the absence. Forwarding a basis while
   * inventing a number would be worse than either.
   */
  it('L62: forwards joint_goal_withheld — basis AND absence — on the witnessed payload', () => {
    setReport(reportFor(SUBSTITUTED_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbability).toBeNull()
    expect(md.achievementProbabilityBasis).toBe('joint_goal_withheld')
    // The joint quantity itself still crosses the hop for the panel's own
    // honestly-labelled row.
    expect(md.jointGoalProbability).toBe(0.0054)
  })

  it('forwards goal_probability when the run carries the real goal quantity', () => {
    setReport(reportFor(REAL_GOAL_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbability).toBe(0.55)
    expect(md.achievementProbabilityBasis).toBe('goal_probability')
  })

  it('forwards joint_goal_constrained — the ROADMAP 1.49 case, NOT substitution', () => {
    setReport(reportFor(CONSTRAINED_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbability).toBe(0.42)
    expect(md.achievementProbabilityBasis).toBe('joint_goal_constrained')
    // The discriminator that matters: the same JOINT quantity, and yet not
    // substituted. A gate widened to "the figure is joint" fails here.
    expect(md.achievementProbabilityBasis).not.toBe('joint_goal_withheld')
  })

  it('INVARIANT: a non-null achievementProbability is NEVER published without a basis', () => {
    // `achievementProbabilityBasis` is OPTIONAL in `NodeDisplayMetadata` (the
    // documented `goalFitAvailable` precedent — a required field rewrites the
    // printed type strings of unrelated test mocks). Optional means absence is
    // TYPE-LEGAL, and absence reads as "not substituted", which PERMITS the
    // possessive. This test is what stops "optional in the type" decaying into
    // "absent in practice": the real hook must populate it whenever it
    // publishes a number. Derived from the hook's own output, not mirrored.
    // ⭐ L62 narrowed the fixture set, NOT the invariant. `SUBSTITUTED_OPTION`
    // is removed because it no longer publishes a number, so it cannot
    // exercise "a non-null probability without a basis" — including it would
    // make the loop assert `not.toBeNull()` about a legitimately null value
    // and turn the invariant into a false alarm. The withheld case gets its
    // own, opposite invariant immediately below, so nothing goes unpinned.
    for (const option of [REAL_GOAL_OPTION, CONSTRAINED_OPTION]) {
      setReport(reportFor(option))
      const md = renderForGoal()
      expect(md.achievementProbability).not.toBeNull()
      expect(md.achievementProbabilityBasis).not.toBeNull()
      expect(md.achievementProbabilityBasis).not.toBeUndefined()
      expect(md.achievementProbabilityBasis).not.toBe('none')
    }
  })

  it('⭐ L62 INVARIANT (the other direction): a WITHHELD basis is never published WITH a number', () => {
    // The mirror of the invariant above, and the one that matters after L62:
    // the whole defect was a basis that said "this is a stand-in" while a
    // number rode along beside it and got rendered anyway. Absence and basis
    // must travel together or the render sites are back to guessing.
    setReport(reportFor(SUBSTITUTED_OPTION))
    const md = renderForGoal()
    expect(md.achievementProbabilityBasis).toBe('joint_goal_withheld')
    expect(md.achievementProbability).toBeNull()
  })

  it('control: the pointer gap (ROADMAP 2.275) is the ONLY thing the fixtures add', () => {
    // Proves the departure declared in this file's header is exactly what it
    // says: strip the pointer and the hook publishes no number AND no basis —
    // it never reaches the selector. This is the witnessed live state, and it
    // is why the fixtures above supply the pointer.
    setReport(reportFor(SUBSTITUTED_OPTION, /* withPointer */ false))
    const md = renderForGoal()
    expect(md.achievementProbability).toBeNull()
    expect(md.achievementProbabilityBasis ?? null).toBeNull()
  })

  it('publishes a null basis when there is no report at all', () => {
    setReport(null, 'idle')
    const md = renderForGoal()
    expect(md.isResultsMode).toBe(false)
    expect(md.achievementProbability).toBeNull()
    expect(md.achievementProbabilityBasis ?? null).toBeNull()
  })
})

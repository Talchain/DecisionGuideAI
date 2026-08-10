/**
 * The streamed draft phase's OWNERSHIP and PERSISTENCE derivations
 * (ROADMAP 2.122 round 2 — adversarial review F1, F2).
 *
 * Both findings came from the same root cause: the phase was a global fact used
 * as if it were a per-scenario one, and the persistence layer had no idea the
 * phase existed at all. Both are now single derived reads, and both are enumerated
 * over the whole phase union here so a clause cannot be dropped in silence — the
 * lesson the M15/M16 survivors taught in round 1.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  useDraftStore,
  draftStreamPhaseFor,
  draftValuesAreUnsettled,
  shouldPersistGraphForScenario,
  streamedPreviewStandingFor,
  type DraftStreamPhase,
} from '../draftStore'

const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const ALL_PHASES: readonly DraftStreamPhase[] = ['idle', 'drafting', 'settling', 'unsettled']

beforeEach(() => {
  useDraftStore.getState().resetDraft()
})

describe('draftValuesAreUnsettled — exhaustive over the union', () => {
  it('classifies every phase, via a compiler-checked switch', () => {
    // Adding a phase to DraftStreamPhase without classifying it is a TS error in
    // the implementation's own switch, so this list cannot silently go stale.
    const expected: Record<DraftStreamPhase, boolean> = {
      idle: false,
      drafting: false,
      settling: true,
      unsettled: true,
    }
    for (const phase of ALL_PHASES) {
      expect(draftValuesAreUnsettled(phase)).toBe(expected[phase])
    }
  })

  it('`drafting` is NOT unsettled — nothing is on the canvas yet to be wrong about', () => {
    // The distinction that keeps the rung from being a blanket "any streamed turn
    // blocks everything": before GRAPH_READY there is no graph to misrepresent.
    expect(draftValuesAreUnsettled('drafting')).toBe(false)
  })
})

describe('draftStreamPhaseFor — F2, the scenario boundary', () => {
  it('reports the phase to its OWNING scenario', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('settling')
  })

  it('reports `idle` to every OTHER scenario — for every phase', () => {
    // The review's probe: an `unsettled` draft on A blocked Run on B with the
    // false reason "your model is still being drafted", about a model B never had.
    for (const phase of ALL_PHASES) {
      useDraftStore.getState().setDraftStreamPhase(phase, 't1', A)
      expect(draftStreamPhaseFor(useDraftStore.getState(), B)).toBe('idle')
    }
  })

  it('reports `idle` when no scenario owns the phase', () => {
    // Only reachable from a hand-built store state. Fail-OPEN is correct: the
    // alternative is blocking every scenario forever on unattributable state,
    // which is precisely the defect F2 named.
    useDraftStore.setState({ draftStreamPhase: 'unsettled', draftStreamScenarioId: null } as never)
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('idle')
    expect(draftStreamPhaseFor(useDraftStore.getState(), null)).toBe('idle')
  })

  it('releasing to `idle` drops the ownership keys, so nothing can be attributed later', () => {
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', A)
    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(useDraftStore.getState().draftStreamScenarioId).toBeNull()
    expect(useDraftStore.getState().draftStreamTurnId).toBeNull()
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('idle')
  })

  it('a newer turn on the SAME scenario takes ownership', () => {
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', A)
    useDraftStore.getState().setDraftStreamPhase('drafting', 't2', A)
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('drafting')
    expect(useDraftStore.getState().draftStreamTurnId).toBe('t2')
  })
})

describe('shouldPersistGraphForScenario — F1, the autosave bound', () => {
  it('REFUSES the write for every phase whose values are in progress', () => {
    for (const phase of ALL_PHASES) {
      useDraftStore.getState().setDraftStreamPhase(phase, 't1', A)
      expect(shouldPersistGraphForScenario(A)).toBe(!draftValuesAreUnsettled(phase))
    }
  })

  it('is derived from the SAME two functions the run gate uses', () => {
    // Not an independent re-statement of the rule. If these ever disagree, one of
    // them is a mirror and the gate and the writer will drift.
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', A)
    const phase = draftStreamPhaseFor(useDraftStore.getState(), A)
    expect(shouldPersistGraphForScenario(A)).toBe(!draftValuesAreUnsettled(phase))
  })

  it('permits writes for a DIFFERENT scenario — the suppression is scoped too', () => {
    // Otherwise one unsettled draft would freeze persistence for the whole app,
    // which is F2's defect wearing a different hat.
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', A)
    expect(shouldPersistGraphForScenario(B)).toBe(true)
  })

  it('permits writes again the moment the draft settles — not a one-way door', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    expect(shouldPersistGraphForScenario(A)).toBe(false)
    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(shouldPersistGraphForScenario(A)).toBe(true)
  })

  it('permits writes when no streamed draft has ever run (every other caller)', () => {
    // Positive control on the whole guard: a pristine store must not suppress
    // persistence, or the feature would silently break saving for everyone.
    expect(shouldPersistGraphForScenario(A)).toBe(true)
    expect(shouldPersistGraphForScenario(null)).toBe(true)
  })
})

describe('streamedPreviewStandingFor — F1 adjacent, the 130 s timeout copy', () => {
  it('true only for the OWNING turn, on the OWNING scenario, while settling', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    const st = useDraftStore.getState()
    expect(streamedPreviewStandingFor(st, 't1', A)).toBe(true)
    // A different turn's timeout must not suppress its own honest copy.
    expect(streamedPreviewStandingFor(st, 't2', A)).toBe(false)
    // A different scenario's timeout likewise.
    expect(streamedPreviewStandingFor(st, 't1', B)).toBe(false)
  })

  it('false in every phase except settling', () => {
    // `drafting` is the one that matters: nothing is on the canvas yet, so the
    // generic "your message has not gone through" copy is TRUE there and must be
    // allowed to render. Suppressing it would be its own dishonesty.
    for (const phase of ALL_PHASES) {
      useDraftStore.getState().setDraftStreamPhase(phase, 't1', A)
      expect(streamedPreviewStandingFor(useDraftStore.getState(), 't1', A)).toBe(
        phase === 'settling',
      )
    }
  })

  it('false on a pristine store — a non-streamed turn keeps its normal timeout copy', () => {
    expect(streamedPreviewStandingFor(useDraftStore.getState(), 't1', A)).toBe(false)
  })
})

describe('markDraftStreamCoachingLanded — F1, the coaching frame is identity-guarded', () => {
  it('records the landing for the OWNING turn only', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    useDraftStore.getState().markDraftStreamCoachingLanded('t1')
    expect(useDraftStore.getState().draftStreamCoachingLanded).toBe(true)
  })

  it('IGNORES a frame from a turn that does not own the phase — a stale stream cannot move a newer turn’s narration', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't2', A)
    useDraftStore.getState().markDraftStreamCoachingLanded('t1')
    expect(useDraftStore.getState().draftStreamCoachingLanded).toBe(false)
  })

  it('resets when a NEW turn starts drafting — the flag never leaks onto the next draft', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    useDraftStore.getState().markDraftStreamCoachingLanded('t1')
    useDraftStore.getState().setDraftStreamPhase('drafting', 't2', A)
    expect(useDraftStore.getState().draftStreamCoachingLanded).toBe(false)
  })

  it('resets on release to idle', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    useDraftStore.getState().markDraftStreamCoachingLanded('t1')
    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(useDraftStore.getState().draftStreamCoachingLanded).toBe(false)
  })

  it('SURVIVES the settling→unsettled transition of the turn that set it', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', 't1', A)
    useDraftStore.getState().markDraftStreamCoachingLanded('t1')
    useDraftStore.getState().setDraftStreamPhase('unsettled', 't1', A)
    expect(useDraftStore.getState().draftStreamCoachingLanded).toBe(true)
  })
})

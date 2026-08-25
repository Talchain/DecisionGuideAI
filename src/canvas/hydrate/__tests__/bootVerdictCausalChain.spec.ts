/**
 * THE CAUSAL CHAIN, PINNED — and TWO CORRECTED PREMISES, one of them mine.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ CORRECTION 1 — THE CHAIN THIS PR WAS BRIEFED TO ASSERT DOES NOT EXIST
 * ═══════════════════════════════════════════════════════════════════════════
 * The dispatch held that consuming the persisted verdict at boot makes the
 * FRESHNESS SLICE non-null, so a turn-1 verdict equal to it hits
 * `if (!verdictChanged) return {}` (`store.ts:4902`) and the dirty overlay
 * survives.
 *
 * That describes a DIFFERENT FIELD, and this PR cannot produce it:
 *   · `setAnalysisFreshness` reduces `state.analysisFreshness`, sourced ONLY
 *     from `response.analysis_ready` (`store/analysisFreshness.ts:15`);
 *   · the scenario-graph read carries `analysis_state` and `analysis_result`
 *     and nothing else (`adapters/cee/scenarioGraph.ts:296,301`). Measured with
 *     contrast controls: `analysis_ready` appears 0× in that adapter, while
 *     `analysis_state` appears 2× there and `analysis_ready` 40× in
 *     `v5/applyV5State.ts` — the zero is real absence, not a blind probe;
 *   · this PR writes `analysisStateV1`, never `analysisFreshness`, which is
 *     STILL NULL after a boot-consume.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ CORRECTION 2 — MY OWN FIRST DRAFT OF THIS FILE WAS WRONG TOO
 * ═══════════════════════════════════════════════════════════════════════════
 * It asserted that with a null freshness slice "the overlay is the only thing
 * talking". MEASURED, it is not talking at all. The derived branch, driven
 * directly through `classifyFreshnessForDisplay`:
 *
 *   null slice,  dirty=true  → 'none'      null slice,  dirty=false → 'none'
 *   fresh slice, dirty=true  → 'changed'   fresh slice, dirty=false → 'current'
 *
 * The overlay only discriminates once a verdict is PRESENT — with no verdict
 * there is nothing for it to downgrade. That changes where the harm lives and
 * what this PR is entitled to claim, so it is written down rather than quietly
 * patched around.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PR'S CHAIN ACTUALLY IS, AND THE WINDOW IT GOVERNS
 * ═══════════════════════════════════════════════════════════════════════════
 *   boot restores `analysisStateV1`
 *     → `composeAnalysisState` feature-detects a non-null verdict
 *     → the WIRE branch answers
 *     → `semantic` = `mapRunStateKindToSemantic(kind, hasReport)`
 *     → the local dirty overlay is not consulted at all
 *
 * AT BOOT the freshness slice is null, so without this PR the derived branch
 * says `'none'` — the product states NOTHING about staleness while CEE's
 * verdict, sitting in the very response the graph arrived in, says
 * `complete_stale`. With it, the product says `'changed'`, which is what #839's
 * Rerun affordance is built to state.
 *
 * ⚠ THE WINDOW IS BOOT → FIRST TURN, AND NO FURTHER. `applyV5State` overwrites
 * `analysisStateV1` with the turn's own verdict, and CLEARS it on a turn that
 * carries none (`applyV5State.ts:1176-1184`). Both are correct — a turn is a
 * fresher authority than a boot read — and both end this PR's governance. The
 * post-turn-1 freshness defect is NOT fixed here and is named in the PR limits.
 */

import { describe, it, expect } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { composeAnalysisState, mapRunStateKindToSemantic } from '../../state/analysisStateSelector'
import type { AnalysisFreshnessState } from '../../store/analysisFreshness'

function verdict(
  runState: AnalysisStateV1['run_state'],
  over: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

const RESTORED_STALE = verdict({
  kind: 'complete_stale',
  computed_at: '2026-08-25T09:00:00.000Z',
  cause: 'graph_changed',
})

const TURN_CURRENT = verdict({
  kind: 'complete_current',
  computed_at: '2026-08-25T10:00:00.000Z',
})

/**
 * ⭐ THE ORDINARY JOURNEY'S BOOT STATE, and it is NOT a null slice.
 *
 * `restoreAnalysisFromAutosave` calls `resultsLoadHistorical`, which sets
 * `{ freshness: 'unknown', freshnessReason: 'hydrated_without_capture' }` AND
 * `analysisFreshnessDirty: false` (`store.ts:4156-4157`). A deployed-staging
 * capture (runs m1+m2, across a deploy boundary) read exactly that row after
 * reload: *"Cannot confirm whether this analysis is current."*
 *
 * So on the journey a real user takes — analyse, edit, reload — boot is
 * CANNOT-CONFIRM, not silence. The null-slice `'none'` case below is the
 * NARROWER one: a scenario CEE has an analysis for while the client holds no
 * autosaved report (cleared storage, another device, a shared link).
 */
const BOOT_HYDRATED: AnalysisFreshnessState = {
  freshness: 'unknown',
  freshnessReason: 'hydrated_without_capture',
}

/** What the live capture measured on turn 1: `fresh` / `graph_hash_match`. */
const TURN1_FRESH: AnalysisFreshnessState = {
  freshness: 'fresh',
  freshnessReason: 'graph_hash_match',
}

function compose(over: {
  analysisState: AnalysisStateV1 | null
  freshness: AnalysisFreshnessState | null
  dirty: boolean
}) {
  return composeAnalysisState({
    analysisState: over.analysisState,
    freshness: over.freshness,
    dirty: over.dirty,
    source: 'none',
    resultsStatus: 'complete',
    resultsStartedAt: undefined,
    importHold: false,
    hasReport: true,
    ceeAnalysisReadyStatus: 'ready',
    aiPanelV2On: true,
  } as never)
}

describe('PRECONDITIONS — measured, so nothing below passes for the wrong reason', () => {
  it('⭐ THE HARM the capture recorded: with a verdict present, clearing the overlay flips changed → current', () => {
    // `store.ts:4934-4940` fired on turn 1 in 4/4 captured runs. THIS is what it
    // buys: "Analysis reflects the current model" over a canvas the boot merge
    // had changed. The overlay is genuinely load-bearing HERE.
    const kept = compose({ analysisState: null, freshness: TURN1_FRESH, dirty: true })
    const cleared = compose({ analysisState: null, freshness: TURN1_FRESH, dirty: false })
    expect(kept.semantic).toBe('changed')
    expect(cleared.semantic).toBe('current')
  })

  it('⚠ AT BOOT the overlay is INERT — the freshness slice is null, so it has nothing to downgrade', () => {
    // The correction that rewrote this file. Both arms are 'none': at boot the
    // derived branch cannot say anything about staleness at all, whatever the
    // overlay holds. So the boot-time gap is not "the overlay got cleared" — it
    // is that there is NO VERDICT TO SHOW.
    expect(compose({ analysisState: null, freshness: null, dirty: true }).semantic).toBe('none')
    expect(compose({ analysisState: null, freshness: null, dirty: false }).semantic).toBe('none')
  })
})

describe('⭐ the chain: restored verdict → wire branch → the overlay stops deciding', () => {
  it('⭐⭐ THE CAPABILITY: at boot, a restored `complete_stale` turns silence into a stated verdict', () => {
    // Without the restore the product says NOTHING (`'none'`, pinned above)
    // while CEE's verdict — in the same response the graph came from — says the
    // analysis is stale. This is the user-visible change, and it is what #839's
    // Rerun affordance consumes.
    const before = compose({ analysisState: null, freshness: null, dirty: false })
    const after = compose({ analysisState: RESTORED_STALE, freshness: null, dirty: false })

    expect(before.authority).toBe('derived')
    expect(before.semantic).toBe('none')
    expect(after.authority).toBe('wire')
    expect(after.runStateKind).toBe('complete_stale')
    expect(after.semantic).toBe('changed')
    // #839 gates its affordance on this; it is producer-composed under the wire.
    expect(after.requiresRerun).toBe(true)
  })

  it('⭐ the wire branch does NOT consult the overlay — its fate stops mattering', () => {
    // The honest form of "the overlay survives the next turn". It may or may not
    // survive; while a verdict stands, the answer is the same either way.
    const overlayIntact = compose({
      analysisState: RESTORED_STALE,
      freshness: TURN1_FRESH,
      dirty: true,
    })
    const overlayCleared = compose({
      analysisState: RESTORED_STALE,
      freshness: TURN1_FRESH,
      dirty: false,
    })
    expect(overlayIntact.semantic).toBe('changed')
    expect(overlayCleared.semantic).toBe('changed')
    expect(overlayCleared.displayState).toEqual(overlayIntact.displayState)
  })

  it('DISCRIMINATING TWIN — the same clearing WITHOUT a verdict DOES change the answer', () => {
    // Without this, the test above would pass equally well if `dirty` were
    // ignored everywhere, and would be evidence about nothing. Same inputs, one
    // difference: no wire verdict.
    const kept = compose({ analysisState: null, freshness: TURN1_FRESH, dirty: true })
    const cleared = compose({ analysisState: null, freshness: TURN1_FRESH, dirty: false })
    expect(cleared.semantic).not.toBe(kept.semantic)
  })

  it('the wire semantic is DERIVED from the kind, not restated here', () => {
    const composed = compose({
      analysisState: RESTORED_STALE,
      freshness: null,
      dirty: false,
    })
    expect(composed.semantic).toBe(mapRunStateKindToSemantic('complete_stale', true))
  })
})

describe('⭐ BOTH DIRECTIONS — the restored verdict must not become a STUCK "changed"', () => {
  it('a turn-1 verdict that DIFFERS replaces the restored one, and the product moves on', () => {
    // The inversion risk at the seam where it lives. `applyV5State` writes the
    // turn's verdict over whatever boot restored — a turn is a fresher
    // authority and must win, or this PR trades a false "current" for a
    // permanent "changed", which users learn to ignore just as fast.
    const atBoot = compose({ analysisState: RESTORED_STALE, freshness: null, dirty: true })
    const afterTurn = compose({ analysisState: TURN_CURRENT, freshness: null, dirty: true })

    expect(atBoot.semantic).toBe('changed')
    expect(afterTurn.semantic).toBe('current')
    // The two verdicts genuinely differ — bound by identity, not by a predicate
    // a second object could satisfy (trap 19).
    expect(afterTurn.runStateKind).not.toBe(atBoot.runStateKind)
  })

  it('a turn carrying NO verdict clears back to the derived branch — and the UNFIXED defect is there', () => {
    // `applyV5State` clears on absence, deliberately. So the restored verdict is
    // not sticky. ⚠ On that branch the overlay decides again, so if turn 1
    // cleared it the product is back to the capture's behaviour. Pinned here so
    // the limit is visible in the suite rather than only in the PR text.
    const cleared = compose({ analysisState: null, freshness: TURN1_FRESH, dirty: false })
    expect(cleared.authority).toBe('derived')
    expect(cleared.semantic).toBe('current')
  })
})

describe('⭐ THE ORDINARY JOURNEY — what the restore is actually worth there', () => {
  it('PRECONDITION — boot after an autosaved analysis reads CANNOT-CONFIRM, not silence', () => {
    // Matches the deployed capture's post-reload row exactly. Pinned so the
    // claim below is measured against the real boot state, not a convenient one.
    const booted = compose({ analysisState: null, freshness: BOOT_HYDRATED, dirty: false })
    expect(booted.authority).toBe('derived')
    expect(booted.semantic).toBe('cannot_confirm')
  })

  it('⭐ the restore upgrades CANNOT-CONFIRM to CHANGED — precision, not breaking silence', () => {
    // ⚠ THIS IS THE HONEST CLAIM, and it is smaller than "none -> changed".
    // The product already said something true at boot; the restore replaces the
    // client's own admission of ignorance with the producer's specific verdict,
    // one turn earlier than CEE would otherwise supply it.
    const before = compose({ analysisState: null, freshness: BOOT_HYDRATED, dirty: false })
    const after = compose({
      analysisState: RESTORED_STALE,
      freshness: BOOT_HYDRATED,
      dirty: false,
    })
    expect(before.semantic).toBe('cannot_confirm')
    expect(after.semantic).toBe('changed')
    expect(after.authority).toBe('wire')
  })

  it('the NARROWER none-case is real but is NOT the ordinary journey', () => {
    // Both states exist; they differ by whether an autosaved analysis was
    // restored. Asserted together so neither can be quietly read as the other.
    const noAnalysis = compose({ analysisState: null, freshness: null, dirty: false })
    const withAnalysis = compose({ analysisState: null, freshness: BOOT_HYDRATED, dirty: false })
    expect(noAnalysis.semantic).toBe('none')
    expect(withAnalysis.semantic).toBe('cannot_confirm')
    expect(noAnalysis.semantic).not.toBe(withAnalysis.semantic)
  })

  it('⚠ AND CEE RE-ASSERTS THE TRUTH ON THE NEXT TURN REGARDLESS — bounding the win', () => {
    // The capture saw `analysis_ready.freshness = "stale"` on the ordinary turn
    // after reload, in both runs. So post-turn-1 the product is honest whether
    // or not this PR exists: the restore's value is EARLIER truth in the
    // boot -> turn-1 window, plus robustness if that turn is ever silent.
    const afterCeeStale = compose({
      analysisState: null,
      freshness: { freshness: 'stale', freshnessReason: 'graph_hash_diverged' },
      dirty: false,
    })
    expect(afterCeeStale.semantic).toBe('changed')
  })
})

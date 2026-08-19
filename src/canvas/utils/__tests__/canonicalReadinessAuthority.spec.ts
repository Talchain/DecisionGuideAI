/**
 * THE RUN GATE ASKS THE CANONICAL READINESS AUTHORITY, AND THE SIDE-CAR VERDICT
 * IS SUPERSEDED — NOT COMBINED WITH IT.
 *
 * ── THE DEFECT THIS PINS (wire capture, frozen quartet, 19 Aug 2026) ────────
 * A fresh guest drafted a 16-node model from the governed brief
 * `04-conflicting-constraints`. `useCanvasStore.getState()` read:
 *
 *   analysisStateV1.readiness = { status: 'ready', blockers: [] }
 *   analysisStateV1.run_state = { kind: 'never_run' }
 *   ceeAnalysisReady.status   = 'ready'   (all three options 'ready')
 *
 * …and `[data-testid="pre-analysis-v3-analyse"]` was `disabled`, with the title
 * *"Olumi needs something more from this model before the next analysis…"* —
 * `BLOCKED_REASON_COPY.unspecified`, the rung that fires when the verdict
 * refuses and carries no structured field naming a cause.
 *
 * That sentence is FALSE: the producer's own readiness carried ZERO blockers.
 * The product asserted something untrue about the user's own model, and the
 * escape route it named (the chat) was itself a no-op.
 *
 * ── THE ROOT CAUSE, NAMED (trap 21: two questions under one name) ───────────
 * TWO readiness notions existed under one name and nothing said so:
 *
 *   COMPETITOR  `readinessStore.readiness.can_run_analysis` — a SIDE-CAR
 *               assessment fetched from `/bff/cee/graph-readiness`. It is the
 *               only thing `canRunAnalysis` ever asked, and it can object
 *               while naming nothing (its empty-canvas verdict carries exactly
 *               five fields and no structured cause, so a retained one lands
 *               on the `unspecified` rung by construction).
 *   CANONICAL   `analysis_state.readiness` — carried by the PRODUCER on every
 *               turn. The contract is explicit that an empty `blockers` list
 *               "is a POSITIVE claim: the producer assessed readiness and
 *               found nothing blocking", and that `run_state` "is the
 *               authority: a consumer must not derive, override or supplement
 *               it". It reached the store, was exposed by
 *               `analysisStateSelector` as `readinessStatus`/`readinessBlockers`
 *               — and had ZERO product consumers. Computed, delivered, unread.
 *
 * ── THE CONVERGENCE (Paul's binding rule: name the owner, SUPERSEDE the rival)
 * `readinessObjectsToRun` stays the ONE definition of a readiness objection and
 * gains the canonical authority as its first argument. When the producer has
 * stated readiness, the side-car verdict is NOT CONSULTED AT ALL. This is the
 * same feature-detected precedence `analysisStateSelector` already applies to
 * every other analysis truth — one authority, asked once — not a second rule
 * bolted beside the first.
 *
 * ── WHAT EACH TEST BELOW IS FOR ─────────────────────────────────────────────
 * The suite is written to FAIL in both directions, which is the whole point:
 *   · AC1 REDs if the gate keeps consulting the side-car when the producer
 *     said ready;
 *   · AC2 REDs if a blocked state explains itself with a constant instead of
 *     with the producer's own blocker list;
 *   · SUPERSESSION REDs if the change is implemented as an OR (a permissive
 *     side-car must not be able to open a gate the producer has closed);
 *   · the LEGACY CONTRAST CONTROL is GREEN at pristine and must stay green —
 *     it proves this file is bound to the real gate and is not vacuous
 *     (trap 13e: an absence claim needs a contrast that reads non-zero).
 */

import { describe, it, expect } from 'vitest'
import type { AnalysisBlocker } from '@talchain/schemas/boundary'

import { canRunAnalysis, readinessObjectsToRun } from '../canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import type { CanRunAnalysisParams } from '../canRunAnalysis'

// ───────────────────────────────────────────────────────────────────────────
// Fixtures.
//
// ⚠ `SIDE_CAR_OBJECTS` is NOT invented: it is field-for-field the verdict
// `readinessStore`'s empty-canvas arm composes and then RETAINS across a failed
// refetch (`readinessStore.ts`, the `currentNodes.length === 0` branch). It
// carries no `goal_node_valid`, no `options_total`, no `scaffold_plan` — which
// is precisely why `composeReadinessBlockedReason` falls to `unspecified` and
// why the deployed tooltip read the way it did.
// ───────────────────────────────────────────────────────────────────────────

const SIDE_CAR_OBJECTS: GraphReadiness = {
  readiness_score: 0,
  readiness_level: 'needs_work',
  can_run_analysis: false,
  confidence_explanation: 'Add some nodes to get started',
  improvements: [],
}

const SIDE_CAR_PERMITS: GraphReadiness = {
  readiness_score: 82,
  readiness_level: 'ready',
  can_run_analysis: true,
  confidence_explanation: 'Analysis available',
  improvements: [],
}

function blocker(overrides: Partial<AnalysisBlocker> = {}): AnalysisBlocker {
  return {
    code: 'OPTION_NOT_READY',
    category: 'options',
    message: 'The option has no effect values.',
    repairability: 'user_repairable',
    ...overrides,
  }
}

/**
 * The gate as the deployed canvas calls it: a real model on screen, nothing
 * held, nothing streaming, no validation issues. Only the two readiness
 * authorities vary between tests, so any difference in the verdict is
 * attributable to them and to nothing else.
 */
function gate(overrides: Partial<CanRunAnalysisParams> = {}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: SIDE_CAR_OBJECTS,
    hasBlockers: false,
    nodeCount: 16,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    optionsNeedingValues: [],
    readinessStale: false,
    ...overrides,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE 1 — a producer-ready model with zero blockers is RUNNABLE.
// ═══════════════════════════════════════════════════════════════════════════

describe('AC1 — producer says ready with zero blockers: the control is ENABLED', () => {
  it('opens the gate even though the side-car verdict objects', () => {
    const result = gate({
      analysisReadiness: { status: 'ready', blockers: [] },
    })

    expect(result.allowed).toBe(true)
    // An open gate makes no refusal at all — not a softer one.
    expect(result.reason).toBeUndefined()
    expect(result.blockingReasons ?? []).toEqual([])
  })

  it('never emits the false sentence the deployed build showed', () => {
    const result = gate({
      analysisReadiness: { status: 'ready', blockers: [] },
    })

    // The exact string read off the frozen build's button title.
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('an empty blocker list is a POSITIVE claim, whatever status code rides with it', () => {
    // The contract's words. `status` is a producer-owned free-string code and a
    // consumer maps it to its own copy; `blockers` is the itemised list of what
    // stands in the way. Blocking on a status we cannot name a cause for is
    // exactly the refusal-without-a-reason this lane exists to delete — and a
    // run CEE then declines still refuses WITH a stated reason, which is
    // strictly better than a disabled control that lies.
    expect(gate({ analysisReadiness: { status: 'unknown_code', blockers: [] } }).allowed).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPTANCE 2 — a genuinely blocked model is disabled AND says WHY, from the
// producer's own list.
// ═══════════════════════════════════════════════════════════════════════════

describe('AC2 — real blockers close the gate and NAME themselves', () => {
  it('blocks, and quotes the blocker the producer scoped', () => {
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Extend the free trial')
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('the sentence DERIVES from the list — two different lists cannot share one constant', () => {
    // Trap 19, in its cheapest form: a constant satisfies any single assertion.
    // Two lists that differ only in their labels must produce two sentences that
    // differ in exactly the same way, or the copy is not derived at all.
    const a = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    }).reason
    const b = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Hold the current price' })],
      },
    }).reason

    expect(a).not.toBe(b)
    expect(a).toContain('Extend the free trial')
    expect(b).toContain('Hold the current price')
    expect(a).not.toContain('Hold the current price')
  })

  it('names a factor-scoped blocker too — the scope field, not one hard-coded key', () => {
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ category: 'factors', factor_label: 'Support headcount' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Support headcount')
  })

  it('two blockers name both; more than two publish the producer COUNT', () => {
    const two = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [
          blocker({ option_label: 'Extend the free trial' }),
          blocker({ option_label: 'Hold the current price' }),
        ],
      },
    }).reason
    expect(two).toContain('Extend the free trial')
    expect(two).toContain('Hold the current price')

    // Four unnameable blockers: the count is still drawn from the LIST, so it
    // moves with the list. A constant cannot do that either.
    const four = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker(), blocker(), blocker(), blocker()],
      },
    }).reason
    const three = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker(), blocker(), blocker()],
      },
    }).reason
    expect(four).toContain('4')
    expect(three).toContain('3')
    expect(four).not.toBe(three)
    expect(four).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('an unquotable label degrades to the count, never to a leaked identifier', () => {
    // `safeDisplayLabel`'s rule, inherited unchanged: a label carrying a
    // glossary-banned term is not quoted back, and the id is NEVER shown.
    const result = gate({
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_id: 'opt_extend', option_label: 'Rebuild the graph layer' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).not.toContain('opt_extend')
    expect(result.reason).not.toContain('Rebuild the graph layer')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUPERSESSION — the canonical authority ANSWERS; it is not OR-ed with the
// side-car. This is the test that fails if the fix is written as a parallel
// rule, which is precisely what Paul's convergence ruling forbids.
// ═══════════════════════════════════════════════════════════════════════════

describe('supersession, in BOTH directions', () => {
  it('a permissive side-car cannot open a gate the producer has closed', () => {
    const result = gate({
      readiness: SIDE_CAR_PERMITS,
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Hold the current price' })],
      },
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Hold the current price')
  })

  it('an objecting side-car cannot close a gate the producer has opened', () => {
    expect(gate({ readiness: SIDE_CAR_OBJECTS, analysisReadiness: { status: 'ready', blockers: [] } }).allowed).toBe(true)
  })

  it('the side-car staleness mark does not reach the producer verdict', () => {
    // `readinessStale` is a fact about the SIDE-CAR's evidence. Letting it
    // rewrite a producer-stated refusal would re-mix the two authorities the
    // moment they were separated — the defect one level up.
    const result = gate({
      readinessStale: true,
      analysisReadiness: {
        status: 'not_ready',
        blockers: [blocker({ option_label: 'Extend the free trial' })],
      },
    })

    expect(result.reason).toContain('Extend the free trial')
    expect(result.reason).not.toBe(BLOCKED_REASON_COPY.staleRecheck)
  })

  it('the dispatch barrier asks the SAME predicate, with the same precedence', () => {
    // `readinessObjectsToRun` is re-asked at dispatch time (ROADMAP 2.635 I-4).
    // If the precedence lived only in `canRunAnalysis`, the render gate would
    // open and the barrier would refuse — a run that dies between the click and
    // the wire, which is the silent class this lane is also fixing.
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, { status: 'ready', blockers: [] })).toBe(false)
    expect(
      readinessObjectsToRun(SIDE_CAR_PERMITS, { status: 'not_ready', blockers: [blocker()] }),
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONTRAST CONTROL — green at pristine, and it must stay green.
//
// Everything above is an assertion about a NEW branch. Without these, a fix
// that simply forced `allowed: true` would satisfy AC1 and this file would
// applaud. These pin the legacy behaviour that must survive untouched: when
// the producer has stated NOTHING, the side-car still answers, both ways.
// ═══════════════════════════════════════════════════════════════════════════

describe('CONTRAST CONTROL — no producer verdict: the side-car still answers', () => {
  it('an objecting side-car still closes the gate when readiness is not stated', () => {
    const result = gate({ analysisReadiness: null })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('a permissive side-car still opens it when readiness is not stated', () => {
    expect(gate({ readiness: SIDE_CAR_PERMITS, analysisReadiness: null }).allowed).toBe(true)
  })

  it('an omitted argument is identical to an explicit null — absence is one state', () => {
    const omitted = gate()
    const explicit = gate({ analysisReadiness: null })
    expect(omitted.allowed).toBe(explicit.allowed)
    expect(omitted.reason).toBe(explicit.reason)
  })

  it('the earlier rungs still outrank readiness, whichever authority answers', () => {
    // A producer "ready" must not resurrect a run for an empty canvas, a held
    // model, or a draft whose values have not settled. Those rungs answer
    // different questions and return BEFORE readiness is consulted.
    const ready = { status: 'ready', blockers: [] as AnalysisBlocker[] }
    expect(gate({ nodeCount: 0, analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ analysisHeldOn: 'starter', analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ draftStreamPhase: 'settling', analysisReadiness: ready }).allowed).toBe(false)
    expect(gate({ isRunning: true, analysisReadiness: ready }).allowed).toBe(false)
  })

  it('a validation blocker still closes the gate under a producer-ready verdict', () => {
    // Two DIFFERENT questions again: `graphHealth` is the client's own
    // validation, and the producer's readiness says nothing about it.
    const result = gate({
      graphHealth: { issues: [{ severity: 'error', message: 'Two options share one label' }] },
      hasBlockers: true,
      analysisReadiness: { status: 'ready', blockers: [] },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Two options share one label')
  })
})

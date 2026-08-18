/**
 * ANALYSE-AFFORDANCE TRUTHFULNESS — the first-send blocker, pinned.
 *
 * Witnessed on the DEPLOYED build `d5aa8453` (= this tip; `/version.json`),
 * fresh guest, real browser, `staging--olumi.netlify.app`:
 *
 *   Bundled starter "International Expansion Strategy" on screen — 8 nodes,
 *   3 options, 3 risks, 8 estimates, all visible — and the Analysis tab reads
 *
 *       Not ready for analysis yet
 *       Draft or save a model first, then run analysis.        [Analyse first pass]  (disabled)
 *
 * BOTH LIMBS OF THAT SENTENCE ARE FALSE AT THE ONLY BRANCH THAT EMITS IT, and
 * that is what this file pins.
 *
 *  - "Draft ... a model first" — `canRunAnalysis` returns at `nodeCount === 0`
 *    BEFORE the injected-model rung is reached, so a model is always on the
 *    canvas when this sentence renders. Pinned by `the rung is unreachable with
 *    an empty canvas` below.
 *
 *  - "... or save a model first" — `computeCeeCannotSeeModel` is a pure
 *    function of `node.data`, and `applyStarter` stamps `starterId` onto EVERY
 *    node (`starters/loadStarter.ts::stampStarterProvenance`). Persistence
 *    round-trips `node.data`, so a saved starter is still refused. Saving is an
 *    instruction the gate CANNOT ACCEPT — preamble P8, and the exact defect
 *    `StarterProvenanceBanner` already fixed in its own copy:
 *
 *       "An earlier draft of this copy read '…drafted or saved into your own
 *        decision', which was a promise the product does not keep: the starter
 *        stamp rides a save, so saving does NOT re-enable analysis.
 *        Re-drafting is the one route that does."
 *
 *    The banner was corrected; the gate constant beside it was not. One claim,
 *    two copies, one of them fixed — the estate's hand-maintained mirror
 *    (trap 12) inside a P8 violation.
 *
 * WHY THE SENTENCE WAS WRONG IN THE FIRST PLACE (trap 21 — name the question
 * each authority answers). The constant was justified as "CEE's refusal
 * sentence, verbatim". CEE does emit it — at
 * `analysis-ready-helper.ts::assessCanonicalAnalysisReadiness`, under code
 * `NO_GRAPH`, when `graph === null || graph === undefined`. That answers
 * *"is there a model at all?"* — for which "draft or save one" is true and
 * achievable. The UI borrowed it to answer a DIFFERENT question: *"is the
 * model on this canvas one the engine can analyse?"* Quoting the right answer
 * to the wrong question is how the false instruction arrived.
 *
 * SECOND DEFECT, SAME CLASS, DIFFERENT SURFACE. `OutputsDock` feeds the SAME
 * `runGateResult.reason` to the POST-analysis footer (`derivePostFooterMeta`'s
 * `blockedReason`, added 18 Aug 2026 to stop a disabled Rerun explaining itself
 * only on hover — the right fix). Consequence: the terminal readiness rung
 * "Olumi is not able to run this yet" renders UNDER a completed analysis's
 * ranked results. Same authority, correctly answering "may a run be dispatched
 * now?", rendered as a claim that analysis is impossible — beside the proof
 * that it is not.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canRunAnalysis,
  computeCeeCannotSeeModel,
  CLIENT_INJECTED_MODEL_REFUSAL,
} from '../canRunAnalysis'
import { composeReadinessBlockedReason, BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import { derivePostFooterMeta } from '../../components/utils/postAnalysisFooter'
import { FOOTER_COPY } from '../../components/pre-analysis-v3/constants'

const isV5CanonicalRunPathMock = vi.fn(() => true)
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => isV5CanonicalRunPathMock() }
})

/** The witnessed shape: a bundled starter, stamped on every node. */
const starterNodes = [
  { data: { starterId: 'international-expansion', label: 'Germany First' } },
  { data: { starterId: 'international-expansion', label: 'Nordics First' } },
]

function gateWith(overrides: Partial<Parameters<typeof canRunAnalysis>[0]> = {}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: 8,
    ceeCannotSeeModel: true,
    ...overrides,
  })
}

describe('the injected-model refusal never asks for an action the gate cannot accept (P8)', () => {
  beforeEach(() => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
  })

  it('CONTROL: the injected-model rung is live and owns the refusal', () => {
    const result = gateWith({ ceeCannotSeeModel: computeCeeCannotSeeModel(starterNodes) })
    expect(computeCeeCannotSeeModel(starterNodes)).toBe(true)
    expect(result.allowed).toBe(false)
    // Bound to the rung BY IDENTITY (the exported constant), never by a
    // substring another rung's copy could satisfy.
    expect(result.reason).toBe(CLIENT_INJECTED_MODEL_REFUSAL)
  })

  it('the rung is UNREACHABLE with an empty canvas, so it may not say "draft a model first"', () => {
    // Opposite-direction twin of the control: same `ceeCannotSeeModel: true`,
    // only `nodeCount` differs. The empty-canvas rung answers first, so the
    // injected-model sentence ONLY ever renders with a model on screen.
    const empty = gateWith({ nodeCount: 0 })
    expect(empty.reason).toBe('Add some nodes to get started')
    expect(empty.reason).not.toBe(CLIENT_INJECTED_MODEL_REFUSAL)

    expect(CLIENT_INJECTED_MODEL_REFUSAL).not.toMatch(/draft[^.]*\bfirst\b/i)
  })

  it('saving cannot clear the stamp, so the refusal may not ask the user to save', () => {
    // CONTROL first (trap 13): the predicate fires on this input at all.
    expect(computeCeeCannotSeeModel(starterNodes)).toBe(true)
    // A persistence round-trip preserves `node.data`, which is the predicate's
    // ONLY input — so no save can change this verdict.
    const afterSaveRoundTrip = JSON.parse(JSON.stringify(starterNodes))
    expect(computeCeeCannotSeeModel(afterSaveRoundTrip)).toBe(true)

    expect(CLIENT_INJECTED_MODEL_REFUSAL).not.toMatch(/\bsav(e|ed|ing)\b/i)
  })

  it('names the one action that DOES clear the refusal — a live re-draft', () => {
    // P8's positive half: the question the product asks must have an acceptance
    // path. `StarterProvenanceBanner`'s "Re-draft this live" is it, and a
    // CEE-drafted graph carries no stamp — proven by the twin below.
    expect(CLIENT_INJECTED_MODEL_REFUSAL).toMatch(/draft/i)
    expect(CLIENT_INJECTED_MODEL_REFUSAL).toMatch(/\blive\b/i)

    // The twin: a graph Olumi drafted is NOT refused, so the named remedy is
    // one the gate genuinely accepts.
    const ceeDrafted = [{ data: { label: 'Germany First' } }]
    expect(computeCeeCannotSeeModel(ceeDrafted)).toBe(false)
    expect(gateWith({ ceeCannotSeeModel: false }).allowed).toBe(true)
  })
})

describe('no surface denies analysability while completed results are on screen', () => {
  /** The terminal rung: a refusal carrying no field specific enough to name. */
  const unspecifiedVerdict = {
    can_run_analysis: false,
    options_total: 3,
    options_ready: 3,
    goal_node_valid: true,
  } as unknown as GraphReadiness

  it('CONTROL: the terminal rung is reached, and the post-analysis footer renders it', () => {
    const reason = composeReadinessBlockedReason(unspecifiedVerdict, [], false)
    // Identity binding to the rung, not to its wording.
    expect(reason).toBe(BLOCKED_REASON_COPY.unspecified)

    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: 'this result held up under the changes we tested',
      reviewCards: [{ confidence: 80 }],
      blockedReason: reason,
    })
    // Presence first: without this, the absence assertion below is vacuous.
    expect(meta).toContain(reason)
  })

  it('the rung rendered beneath ranked results does not claim Olumi is unable to run one', () => {
    const reason = composeReadinessBlockedReason(unspecifiedVerdict, [], false)
    const meta = derivePostFooterMeta({
      robustnessVerdict: 'robust',
      robustnessVerdictReason: 'this result held up under the changes we tested',
      reviewCards: [{ confidence: 80 }],
      blockedReason: reason,
    })
    // The witnessed contradiction, verbatim: this string sat at the foot of an
    // Analysis tab that was displaying a completed run's ranked results.
    expect(meta).not.toMatch(/not able to run this/i)
  })

  it('the pre-analysis degrade fallback is the SAME string, not a copy of it', () => {
    // Two verbatim literals for one sentence is the mirror that drifts
    // (trap 12). Bound by identity so a future edit to one cannot leave the
    // other behind.
    expect(FOOTER_COPY.notReadySubFallback).toBe(BLOCKED_REASON_COPY.unspecified)
  })
})

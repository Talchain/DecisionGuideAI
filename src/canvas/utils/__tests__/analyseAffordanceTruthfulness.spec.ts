/**
 * ANALYSE-AFFORDANCE TRUTHFULNESS — the first-send blocker, pinned.
 *
 * WITNESSED, deployed `1dec0ad6`, fresh guest, real browser,
 * `staging--olumi.netlify.app`
 * (`olumi-docs/feedback-2026-08-16/AFFORDANCE-SWEEP-2026-08-18.md`, A7/A15).
 * Bundled starter "Customer Data Platform Selection", 20 nodes on canvas, and
 * the Analysis tab read:
 *
 *     Your decision — 4 options · 3 risks · 8 estimates
 *     …
 *     Not ready for analysis yet
 *     Draft or save a model first, then run analysis.   [Analyse first pass] (disabled)
 *
 * BOTH LIMBS OF THAT SENTENCE ARE FALSE AT THE ONLY BRANCH THAT EMITS IT, and
 * that is what this file pins.
 *
 *  - "Draft ... a model first" — `canRunAnalysis` returns at `nodeCount === 0`
 *    BEFORE the injected-model rung is reached, so a model is always on the
 *    canvas when this sentence renders. Pinned by "the rung is unreachable with
 *    an empty canvas" below. The panel counted the model four rows above the
 *    refusal that denied it.
 *
 *  - "... or save a model first" — the predicate is a pure function of
 *    `node.data`, and `applyStarter` stamps `starterId` onto EVERY node
 *    (`starters/loadStarter.ts::stampStarterProvenance`). Persistence
 *    round-trips `node.data`, so a saved starter is still refused. Saving is an
 *    instruction the gate CANNOT ACCEPT — preamble P8, and the exact defect
 *    `StarterProvenanceBanner` had already fixed in its own copy:
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
 * SECOND DEFECT, SAME CLASS, DIFFERENT SURFACE (sweep cross-cutting note 1).
 * `OutputsDock` feeds the SAME `runGateResult.reason` to the POST-analysis
 * footer (`derivePostFooterMeta`'s `blockedReason`, added 18 Aug 2026 to stop a
 * disabled Rerun explaining itself only on hover — the right fix). Consequence:
 * the terminal readiness rung "Olumi is not able to run this yet" could render
 * UNDER a completed analysis's ranked results. The rung is not wrong about the
 * verdict; its wording was scoped to a pre-analysis screen.
 *
 * ⭐ WHAT THIS FILE IS FOR, stated so a later reader does not re-scope it. The
 * founder's 18 Aug ruling is that on a bundled starter the analysis does NOT
 * need to run — a starter is an onboarding surface, not a second model
 * architecture. It needs ONE honest refusal naming the real reason, with a
 * usable route. So these pins are about the REFUSAL being true and the LIVE
 * path being open; they are not a demand that a starter become analysable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
import { canRunAnalysis, getRunButtonTooltip } from '../canRunAnalysis'
import {
  ANALYSIS_HELD_NOTICE,
  analysisHeldNotice,
  analysisHeldOn,
} from '../analysisHeldOnInjectedModel'
import { composeReadinessBlockedReason, BLOCKED_REASON_COPY } from '../composeBlockedReason'
import { resolveStarterId } from '../../starters/loadStarter'
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
  { data: { starterId: 'starter-decision-vendor-selection', label: 'Segment' } },
  { data: { starterId: 'starter-decision-vendor-selection', label: 'RudderStack' } },
]

/** The template twin, to prove the wording follows the graph's own provenance. */
const templateNodes = [{ data: { templateId: 'hiring_strategy_tech_lead' } }]

/** A model Olumi drafted — the real user journey, and the one that must run. */
const ceeDraftedNodes = [{ data: { label: 'Segment' } }, { data: { label: 'RudderStack' } }]

function gateWith(overrides: Partial<Parameters<typeof canRunAnalysis>[0]> = {}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: 20,
    analysisHeldOn: analysisHeldOn(starterNodes),
    ...overrides,
  })
}

describe('the injected-model refusal never asks for an action the gate cannot accept (P8)', () => {
  beforeEach(() => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
  })

  it("CONTROL: the rung is live, and its sentence IS the banner's shipped one", () => {
    const result = gateWith()
    expect(analysisHeldOn(starterNodes)).toBe('starter')
    expect(result.allowed).toBe(false)
    // ⭐ THE ONE-AUTHORITY PIN, bound BY IDENTITY to the shared notice rather
    // than to a constant this module authors. If the gate ever goes back to
    // writing its own sentence, this REDs.
    expect(result.reason).toBe(ANALYSIS_HELD_NOTICE.starter)
    expect(result.reason).toBe(analysisHeldNotice(starterNodes))
  })

  it("the wording follows the graph's own provenance, not the call site's guess", () => {
    // Discriminating twin: same rung, different provenance, different sentence —
    // and neither is chosen by the caller. `analysisHeldOn` returns the gating
    // answer AND the noun in one value, so a caller cannot supply one without
    // the other (which is how the first attempt at this fix had OutputsDock and
    // ConversationPanel describing one state with two different nouns).
    expect(gateWith({ analysisHeldOn: analysisHeldOn(templateNodes) }).reason).toBe(
      ANALYSIS_HELD_NOTICE.template,
    )
    expect(ANALYSIS_HELD_NOTICE.template).not.toBe(ANALYSIS_HELD_NOTICE.starter)
    // Every variant offers the SAME way out — one remedy, two descriptions.
    for (const notice of Object.values(ANALYSIS_HELD_NOTICE)) {
      expect(notice).toMatch(/Re-draft it live to run one\.$/)
    }
    // …and there is no third, provenance-less variant to fall back on: a
    // description the product does not hold is a description it may not state.
    expect(Object.keys(ANALYSIS_HELD_NOTICE).sort()).toEqual(['starter', 'template'])
  })

  it('the notice is NOT made when analysis is not held (it cannot go stale)', () => {
    // The sweep found the banner still claiming "analysis is held" beside
    // "Analysis complete." A null here is what makes that unstateable.
    isV5CanonicalRunPathMock.mockReturnValue(false)
    expect(analysisHeldNotice(starterNodes)).toBeNull()
    expect(analysisHeldOn(starterNodes)).toBeNull()
    // CONTROL: the same input DOES yield a notice on the canonical path.
    isV5CanonicalRunPathMock.mockReturnValue(true)
    expect(analysisHeldNotice(starterNodes)).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('the rung is UNREACHABLE with an empty canvas, so it may not say "draft a model first"', () => {
    // Opposite-direction twin of the control: same held provenance, only
    // `nodeCount` differs. The empty-canvas rung answers first, so the
    // injected-model sentence ONLY ever renders with a model on screen.
    const empty = gateWith({ nodeCount: 0 })
    expect(empty.reason).toBe('Add some nodes to get started')
    expect(empty.reason).not.toBe(ANALYSIS_HELD_NOTICE.starter)

    for (const notice of Object.values(ANALYSIS_HELD_NOTICE)) {
      expect(notice).not.toMatch(/draft[^.]*\bfirst\b/i)
    }
  })

  it('saving cannot clear the stamp, so the refusal may not ask the user to save', () => {
    // CONTROL first (trap 13): the predicate fires on this input at all.
    expect(analysisHeldOn(starterNodes)).toBe('starter')
    // A persistence round-trip preserves `node.data`, which is the predicate's
    // ONLY input — so no save can change this verdict.
    const afterSaveRoundTrip = JSON.parse(JSON.stringify(starterNodes))
    expect(analysisHeldOn(afterSaveRoundTrip)).toBe('starter')

    // ⚠ THE VERB, NOT THE ADJECTIVE — and this assertion was WRONG first time.
    // It read `/\bsav(e|ed|ing)\b/i`, which fired on "a saved example": the
    // very phrase the sweep confirmed is TRUE and that the banner already
    // ships. The property is not "the word save is absent", it is "the refusal
    // does not INSTRUCT the user to save" — an instruction the gate cannot
    // accept (P8). Written against the failure mode instead of the spec, the
    // guard banned the honest description along with the false instruction
    // (trap 13d).
    for (const notice of Object.values(ANALYSIS_HELD_NOTICE)) {
      expect(notice).not.toMatch(/\bsave\b/i)
      expect(notice).not.toMatch(/\bsaving\b/i)
    }
    // CONTROL: the retired sentence WOULD have tripped it, so the pin bites.
    expect('Draft or save a model first, then run analysis.').toMatch(/\bsave\b/i)
  })

  it('the named remedy has a MOUNTED control in the same state (P8 acceptance path)', () => {
    // A truthful refusal is only acceptable if the route it names is reachable.
    // `StarterProvenanceBanner` mounts on `resolveStarterId(nodes) !== null` and
    // carries `Re-draft this live`; the gate holds on `analysisHeldOn(nodes)`.
    // This asserts the two conditions coincide on the witnessed input, so the
    // refusal cannot name a button that is not on screen.
    expect(analysisHeldOn(starterNodes)).toBe('starter')
    expect(resolveStarterId(starterNodes as never)).not.toBeNull()
    // CONTRAST: a CEE-drafted graph mounts no banner AND is not refused, so the
    // pin above is a coincidence of state, not of a predicate that is always true.
    expect(resolveStarterId(ceeDraftedNodes as never)).toBeNull()
    expect(analysisHeldOn(ceeDraftedNodes)).toBeNull()
    // ⚠ NOT ASSERTED, and stated rather than implied: a TEMPLATE insert has no
    // one-click re-draft control. Its route is the composer, which is always on
    // screen. Pinning a `starter-redraft` button for a template state would pin
    // a control that does not exist.
  })

  it('names the one action that DOES clear the refusal — a live re-draft', () => {
    // P8's positive half: the question the product asks must have an acceptance
    // path. `StarterProvenanceBanner`'s "Re-draft this live" is it, and a
    // CEE-drafted graph carries no stamp — proven by the twin below.
    expect(ANALYSIS_HELD_NOTICE.starter).toMatch(/draft/i)
    expect(ANALYSIS_HELD_NOTICE.starter).toMatch(/\blive\b/i)

    // The twin: a graph Olumi drafted is NOT refused, so the named remedy is
    // one the gate genuinely accepts.
    expect(analysisHeldOn(ceeDraftedNodes)).toBeNull()
    expect(gateWith({ analysisHeldOn: analysisHeldOn(ceeDraftedNodes) }).allowed).toBe(true)
  })
})

describe('the real journey: a model Olumi drafted must ANALYSE from the obvious control', () => {
  // The founder's re-scope: a starter need only refuse truthfully — but a live,
  // user-created model must work from the panel's own button, on the same
  // readiness authority as everything else. These are the pins for that half,
  // and they are what stops "fix the refusal" being read as "refuse more".
  beforeEach(() => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
  })

  const readyVerdict = {
    can_run_analysis: true,
    options_total: 3,
    options_ready: 3,
    goal_node_valid: true,
  } as unknown as GraphReadiness

  it('a CEE-drafted model with a ready verdict is ALLOWED, with no reason and no tooltip', () => {
    const result = canRunAnalysis({
      graphHealth: null,
      readiness: readyVerdict,
      hasBlockers: false,
      nodeCount: 20,
      analysisHeldOn: analysisHeldOn(ceeDraftedNodes),
    })
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
    // The button's tooltip is the same authority's output: an open gate must not
    // hand the surface an explanation for a refusal that is not happening.
    expect(getRunButtonTooltip(result)).toBeUndefined()
  })

  it('DISCRIMINATOR: the identical inputs on a STARTER graph are refused — the stamp is what decides', () => {
    // Without this twin, the pin above would pass against a gate that never
    // refuses anything. Only the node stamps differ between the two calls.
    const held = canRunAnalysis({
      graphHealth: null,
      readiness: readyVerdict,
      hasBlockers: false,
      nodeCount: 20,
      analysisHeldOn: analysisHeldOn(starterNodes),
    })
    expect(held.allowed).toBe(false)
    expect(held.reason).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('the hold is scoped to the CEE-routed path — a V2-direct run carries the graph itself', () => {
    isV5CanonicalRunPathMock.mockReturnValue(false)
    const result = canRunAnalysis({
      graphHealth: null,
      readiness: readyVerdict,
      hasBlockers: false,
      nodeCount: 20,
      analysisHeldOn: analysisHeldOn(starterNodes),
    })
    expect(result.allowed).toBe(true)
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

describe('exactly ONE place in the source writes this sentence', () => {
  /**
   * ⭐ THE LEAD QUESTION, PINNED. The defect class here is "a surface states
   * something about analysability that is not true", and its mechanism is a
   * second copy of the claim. A fix that leaves a third author of the sentence
   * has made things worse, so this counts the authors instead of trusting that
   * nobody adds one.
   *
   * Scope, stated (trap 20): `src/**` only, `.ts`/`.tsx`, excluding `__tests__`
   * — a spec that quotes the sentence is a reader, not an author — and with
   * COMMENTS STRIPPED, because a docstring that recounts the defect is not a
   * second author either. (This sweep caught its own first version doing
   * exactly that: `StarterProvenanceBanner`'s new comment quotes the sentence
   * while its code no longer writes it. The shared `stripComments` helper is
   * the repo's existing answer to that footgun; a second hand-rolled one here
   * would be the mirror this file is about.) The contrast control below is what
   * makes a low count mean absence rather than blindness.
   */
  const SRC = path.resolve(__dirname, '../..', '..')

  function sourceFilesUnder(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        sourceFilesUnder(full, out)
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full)
      }
    }
    return out
  }

  it('the held-analysis claim has one author, and the sweep can see one when it is there', () => {
    const files = sourceFilesUnder(SRC)
    const code = new Map(
      files.map((f) => [f, stripComments(fs.readFileSync(f, 'utf8'), f)] as const),
    )

    // CONTRAST CONTROL (must be NON-ZERO, or the sweep proves nothing): a
    // sentence we know is WRITTEN in this tree, by a neighbouring surface.
    const control = files.filter((f) =>
      code.get(f)!.includes('Saved example — Olumi drafted this model on'),
    )
    expect(control.length).toBeGreaterThan(0)

    const authors = files.filter((f) =>
      code.get(f)!.includes('Analysis is held on a saved example'),
    )
    expect(authors.map((f) => path.basename(f))).toEqual(['analysisHeldOnInjectedModel.ts'])
  })
})

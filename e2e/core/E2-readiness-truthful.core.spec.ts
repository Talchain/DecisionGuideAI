// e2e/core/E2-readiness-truthful.core.spec.ts
// =============================================================================
// E2 — readiness guidance tells the truth. Journey step 3.
// =============================================================================
//
// THE CORE CLAIM THIS FALSIFIES:
//   "The product gives truthful readiness guidance — when a required input is
//    missing it SAYS SO, names the gap on the right node, tells the user what to do,
//    and does not offer an analysis it cannot honestly run."
//
// A product that marks a node as needing input while inviting you to Analyse WITH NO
// QUALIFICATION ANYWHERE is lying on one of the two surfaces. So is one that stops the
// user while naming no gap and no next step. Both shapes go RED here.
//
// ⚠ WHAT THIS SPEC DELIBERATELY DOES NOT DEMAND, corrected 2026-08-28 after it failed
// on honest behaviour: it does NOT require that a gap BLOCK the analysis. An unset
// success threshold does not block — the producer synthesises one and returns a real
// run with goal-fit claims suppressed — so "Analysis available" plus a provisional
// caveat is a TRUE report, not a defect. Requiring the headline to say "not ready"
// made this spec satisfiable by making the product lie, which is the one outcome a
// falsification engine must never reward.
//
// ⚠ ON "TWO HONEST SURFACES, TWO DEFINITIONS". Before treating any disagreement as a
// defect, ask which definition each surface uses. This spec therefore does NOT
// compare readiness WORDING across surfaces — it binds a structural gap marker on a
// specific NODE to the affordance the dock offers for that same model. Those two
// cannot legitimately disagree whatever "ready" means locally.
//
// NON-VACUITY: the precondition is PINNED IN-TEST. A conditional guard whose
// condition never fires is a tautology with no red anywhere, so this spec asserts
// the gap EXISTS before asserting anything about how it is reported.
//
// ⭐⭐ WHY THE PREAMBLE IS THE LOAD-BEARING PART OF THIS SPEC.
// Analyse is disabled WHILE THE DRAFT IS STREAMING, whatever the readiness state.
// So if this spec ran mid-stream, its central assertion — "a gap exists and Analyse
// is disabled" — would be satisfied by a transient, and a product that regressed to
// ENABLE Analyse after settling despite a missing threshold would still print PASS.
// The one defect E2 exists to catch would be invisible to it.
// MEASURED on build 18727b64, 2026-08-28: the old preamble returned at ~t=30-40s
// with the turn stream still open and the product's own copy saying it was still
// drafting; the terminal frame did not arrive until t≈75s.
// `draftAsGuest` now waits for that TERMINAL FRAME, so everything below is asserted
// against a FINISHED model and "disabled because streaming" is excluded by
// construction rather than by luck.

import { test, expect } from '@playwright/test'
import { draftAsGuest, owningNodeIds, textOf, measureControl } from './lib/harness'
import { recordSpecRan } from './lib/manifest'

test.beforeAll(() => recordSpecRan('E2-readiness-truthful'))

test.describe('E2 · readiness guidance is truthful, not decorative', () => {
  test('a missing input is named on its own node, explained, and blocks the analysis', async ({ page }) => {
    await draftAsGuest(page)

    // ---- PIN THE PRECONDITION ------------------------------------------------
    // Everything below is a claim ABOUT a gap. If no gap exists, this spec proves
    // nothing and must say so rather than pass.
    const missing = await owningNodeIds(page, 'overlay-missing-threshold-node')
    expect(
      missing.length,
      '[E2] PRECONDITION NOT MET: the drafted model reported no missing-threshold node, so every ' +
      'assertion below would be vacuous. This spec is only meaningful on a model with a real gap.',
    ).toBeGreaterThan(0)

    const gapNode = missing[0]
    expect(gapNode, '[E2] the missing-threshold overlay is not mounted inside any node').toBeTruthy()

    // ---- IDENTITY: the gap markers describe the SAME node ---------------------
    // Bound by node id, never by "some node has a pill" — a different node
    // satisfying the predicate is exactly the defect this rule exists to stop.
    // ⚠⚠ THIS ONE IS A TAUTOLOGY, AND ITS FAILURE MESSAGE BELOW DESCRIBES SOMETHING
    // THAT CANNOT HAPPEN. Derived at the bytes 2026-08-28:
    //   `overlay-missing-threshold-node`  BaseNode.tsx:292
    //   `needs-input-pill` (StatusPill.tsx:33)  BaseNode.tsx:378
    // Both are gated on the SAME `isIncomplete` (BaseNode.tsx:153), in the SAME
    // component, in the SAME render. For a goal node both reduce to
    // `isPreRunMode && !isGoalDefined(goalThreshold, goalConstraints)`. So the two
    // markers cannot name different nodes, and no product change short of editing
    // that one expression can make this assertion red.
    //
    // It is LEFT IN PLACE rather than deleted: it is cheap, and it would go red if
    // those markers were ever split onto different derivations — which is a real
    // future risk and the only thing it can actually detect. What it must NOT be is
    // cited as evidence that two independent surfaces agree. They are one surface.
    const needsInput = await owningNodeIds(page, 'needs-input-pill')
    expect(
      needsInput,
      `[E2] the model marks node ${gapNode} as missing a threshold, but the "needs input" pill is ` +
      `on ${JSON.stringify(needsInput)}. Two surfaces are naming DIFFERENT nodes as the gap; at ` +
      `most one of them can be right, and a user is being pointed at the wrong node.`,
    ).toContain(gapNode)

    // This one is NOT a tautology, and the difference from the assertion above is
    // worth stating so the two are not dismissed together. `goal-node-no-target-chip`
    // comes from a DIFFERENT component (GoalNode.tsx:341, rendered at :389/:394) and
    // is gated on `!hasThreshold` — whereas the markers above are gated on
    // `!isGoalDefined(goalThreshold, goalConstraints)`, which ALSO considers
    // constraints. A goal carrying constraints but no threshold separates them, so
    // these two surfaces genuinely can disagree and this assertion can genuinely fail.
    const noTarget = await owningNodeIds(page, 'goal-node-no-target-chip')
    expect(
      noTarget,
      `[E2] node ${gapNode} is flagged as missing a threshold but carries no "no target set" ` +
      `affordance, so the gap is announced with no way to close it from the node.`,
    ).toContain(gapNode)

    // ---- TRUTHFULNESS: the dock must not offer what it cannot honour ----------
    //
    // ⛔⛔ THIS SECTION USED TO DEMAND THAT THE PRODUCT LIE, AND IT IS WORTH SAYING SO
    // PLAINLY, BECAUSE IT IS THE WORST DEFECT THIS SUITE CAN CARRY.
    // It read ONLY the headline and required it to match /not ready|needs|incomplete|
    // before/, and separately required Analyse to be DISABLED. But an unset success
    // threshold is not a blocking gap: the producer synthesises one
    // (`auto_goal_threshold`) and returns a real analysis with goal-fit claims
    // suppressed, so the product has an honest resting arm for exactly this state
    // (`usePreAnalysisModel.ts:469-474`): an AMBER dot, headline "Analysis available",
    // and the subline "First pass will be provisional until success is defined"
    // (`constants.ts:311`). That is true, precise, and useful.
    // The old assertions failed on it — and would have gone GREEN if someone had
    // "fixed" the footer by making the headline claim the model was not ready. A test
    // that rewards dishonesty inside a falsification engine is worse than no test.
    //
    // WHAT IS ASSERTED NOW is the COUPLING, which cannot be satisfied by lying on
    // either surface. Two shapes are honest, and exactly one must hold:
    //   BLOCKING    — Analyse is disabled AND the surface says why.
    //   PROCEEDING  — Analyse is enabled AND the surface QUALIFIES the result.
    // The dishonest shape is: Analyse enabled, gap present, and NOTHING anywhere
    // qualifying what the user is about to get. Making the headline lie now breaks
    // the blocking branch instead of satisfying it, because that branch also requires
    // the button to be disabled.
    //
    // ⚠ AND THE SURFACE THIS READS HAD TO BE MADE ADDRESSABLE FIRST. The subline's
    // single-sentence branch (`PanelFooter.tsx`) carried NO testid, so on precisely
    // the honest arm above, the only surface bearing the truth was invisible here.
    // Reading just the headline is what made the old assertion look reasonable.
    const headline = (await textOf(page, 'pre-analysis-v3-footer-headline')).join(' ')
    const subline = [
      ...(await textOf(page, 'pre-analysis-v3-footer-subline')),
      ...(await textOf(page, 'pre-analysis-v3-footer-subline-list')),
    ].join(' ')
    const surface = `${headline} ${subline}`.trim()

    expect(
      headline.length,
      '[E2] a gap exists and the readiness footer says nothing at all',
    ).toBeGreaterThan(0)

    // NON-VACUITY: if neither subline testid resolves, the qualification branch below
    // could never be satisfied and this spec would silently collapse into the old
    // headline-only assertion. Fail loudly instead of degrading quietly.
    expect(
      subline.length,
      '[E2] the readiness SUBLINE resolved empty. On the ready-but-success-unset arm the ' +
      'subline is the only surface carrying the qualification, so with it missing this spec ' +
      'cannot tell an honest "provisional" state from an unqualified promise. Check the ' +
      'pre-analysis-v3-footer-subline testid still exists on BOTH the single-sentence and ' +
      'list branches of PanelFooter.',
    ).toBeGreaterThan(0)

    const analyse = await measureControl(page, 'pre-analysis-v3-analyse')
    expect(
      analyse.w > 0 && analyse.h > 0,
      `[E2] the Analyse affordance resolved at ${analyse.w}x${analyse.h} — a testid, not a control`,
    ).toBe(true)
    const analyseDisabled = analyse.disabledSelf || analyse.disabledByAncestorFieldset
      || analyse.ariaDisabled || analyse.matchesDisabledPseudo

    // "Reports the gap" covers both honest vocabularies: the blocking one, and the
    // proceeding-with-a-caveat one. Deliberately a property of the WHOLE readiness
    // surface, not of the headline alone.
    const reportsGap = /not ready|needs|incomplete|before|provisional|until success/i.test(surface)

    expect(
      analyseDisabled || reportsGap,
      `[E2] node ${gapNode} is flagged as missing a required input and Analyse is ENABLED, yet ` +
      `the readiness surface reads "${surface}" — it neither blocks the run nor qualifies what ` +
      `the user is about to get. The product is offering an unqualified analysis over an unmet ` +
      `requirement. (Either shape would be honest: block it, or say the first pass is ` +
      `provisional. Saying nothing is not one of them.)`,
    ).toBe(true)

    expect(
      reportsGap,
      `[E2] node ${gapNode} is flagged as missing a required input and Analyse is DISABLED, but ` +
      `the readiness surface reads "${surface}" — the user is stopped and not told why.`,
    ).toBe(true)

    // ---- A GAP NAMED WITHOUT GUIDANCE IS A DEAD END --------------------------
    const nextStep = (await textOf(page, 'pre-analysis-v3-next-step')).join(' ')
    expect(
      nextStep.length,
      `[E2] node ${gapNode} is blocked and Analyse is disabled, but no next step is offered — the ` +
      `user is told they cannot proceed and not told how to.`,
    ).toBeGreaterThan(0)

    // eslint-disable-next-line no-console
    console.log(`[E2] gapNode=${gapNode} headline="${headline}" nextStep="${nextStep.slice(0, 90)}"`)
  })
})

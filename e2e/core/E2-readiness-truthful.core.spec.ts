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
// A product that marks a node as needing input while inviting you to Analyse is
// lying on one of the two surfaces. So is one that says "not ready" while naming no
// gap and no next step. Both shapes go RED here.
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
    const needsInput = await owningNodeIds(page, 'needs-input-pill')
    expect(
      needsInput,
      `[E2] the model marks node ${gapNode} as missing a threshold, but the "needs input" pill is ` +
      `on ${JSON.stringify(needsInput)}. Two surfaces are naming DIFFERENT nodes as the gap; at ` +
      `most one of them can be right, and a user is being pointed at the wrong node.`,
    ).toContain(gapNode)

    const noTarget = await owningNodeIds(page, 'goal-node-no-target-chip')
    expect(
      noTarget,
      `[E2] node ${gapNode} is flagged as missing a threshold but carries no "no target set" ` +
      `affordance, so the gap is announced with no way to close it from the node.`,
    ).toContain(gapNode)

    // ---- TRUTHFULNESS: the dock must not offer what it cannot honour ----------
    const headline = (await textOf(page, 'pre-analysis-v3-footer-headline')).join(' ')
    expect(
      headline.length,
      '[E2] a gap exists and the readiness footer says nothing at all',
    ).toBeGreaterThan(0)
    expect(
      /not ready|needs|incomplete|before/i.test(headline),
      `[E2] node ${gapNode} is missing a required input, yet the readiness headline reads ` +
      `"${headline}" — it does not report the model as anything other than ready.`,
    ).toBe(true)

    // The load-bearing one: an ENABLED Analyse button beside an unmet requirement is
    // the product promising an analysis it has just said it cannot honestly run.
    const analyse = await measureControl(page, 'pre-analysis-v3-analyse')
    expect(
      analyse.w > 0 && analyse.h > 0,
      `[E2] the Analyse affordance resolved at ${analyse.w}x${analyse.h} — a testid, not a control`,
    ).toBe(true)
    expect(
      analyse.disabledSelf || analyse.disabledByAncestorFieldset || analyse.ariaDisabled
        || analyse.matchesDisabledPseudo,
      `[E2] the readiness surface reports "${headline}" and flags node ${gapNode} as missing a ` +
      `required input, yet Analyse is ENABLED. The product is offering an analysis it has just ` +
      `told the user it is not ready to run.`,
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

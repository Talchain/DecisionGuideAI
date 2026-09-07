/**
 * ⭐⭐ THE LEGACY FOOTER JOINS THE ADMISSION IT WAS NEVER READING.
 *
 * WHAT THIS FIXES, at the scope it was actually measured at. `PreAnalysisPanel`
 * derives its footer gate from `usePreAnalysisData()` (`PreAnalysisPanel.tsx:967`),
 * and nothing in that chain carries the injected-model hold:
 * `usePreAnalysisData.ts`, `deriveAnalysisDisplayState.ts` and
 * `useAnalysisDisplayState.ts` each read ZERO for
 * `analysisHeld|starterId|isV5CanonicalRunPath` against in-file contrasts of
 * 58 / 7 / 1, and `StickyFooter.tsx` reads 0 against a contrast of 16. So on a
 * held model this footer painted an ENABLED `Run analysis` while
 * `StarterProvenanceBanner`, on the same surface, said
 * "Analysis is held on a saved example. Re-draft it live to run one."
 * One surface carried both halves and did not join them. This folds the
 * EXISTING hold authority into that gate.
 *
 * ⚠⚠ SCOPE — THIS IS NOT THE SURFACE STAGING MOUNTS, AND THAT IS SAID HERE
 * RATHER THAN LEFT TO BE DISCOVERED. `OutputsDock.tsx:3132` selects
 * `PreAnalysisPanelV3` when `isPreAnalysisV3Enabled()`, and `netlify.toml:179`
 * bakes `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`. `PreAnalysisPanel` is the ELSE
 * branch: the documented reinstatement path (`OutputsDock.tsx:3135` — "flag off
 * restores the legacy branch below"), and `PreAnalysisPanel.tsx:2477` is the
 * ONLY non-test render site of `StickyFooter` in the tree. Under the current
 * staging posture a fresh user therefore never renders this footer. What this
 * change buys is a reinstatement branch that refuses the hold if that flag is
 * ever turned off. It is not a live-surface fix and must not be reported as one.
 *
 * ⛔ IT ALSO DOES NOT EXPLAIN ANY DEPLOYED NO-OP, AND NO LONGER CLAIMS TO.
 * The V3 surface already refuses the hold — through the GATE rather than through
 * the footer: `OutputsDock.tsx:1279` passes `analysisHeldOn(nodes)` into
 * `canRunAnalysis`, rung 2.5 returns `allowed: false` (`canRunAnalysis.ts:826`),
 * `OutputsDock.tsx:3142` hands that verdict to the V3 footer as `canRun`, and
 * `PanelFooter.tsx:69` disables on `!canRun`. An earlier revision of this file
 * attributed a witnessed deployed no-op to the gap above; that attribution is
 * WITHDRAWN. It was derived correctly on this branch and then asserted about the
 * DEPLOYED product without measuring which branch the flags mount — the step
 * from "this code path has no hold input" to "this is why the button no-ops"
 * needed a flag posture that was never taken. The cause of that no-op is not
 * established here, and nothing in this file should be read as closing it.
 *
 * ⛔ WHY THIS IS NOT A NEW HOLD CHECK, WHICH WAS THE TEMPTING AND WRONG FIX.
 * Writing a third hold test here would be the align-the-defaults repair this
 * estate has paid for twice (CLAUDE.md trap 21). So this composes the EXISTING
 * authority instead: `analysisHeldNotice`, whose own header says it is owned
 * there "so both surfaces say it rather than each writing its own". The banner
 * joined. This footer is the surface that never did. There is no new predicate
 * in this file — no stamp read, no flag read, no re-test of provenance — only
 * the plumbing of one that already exists.
 *
 * ⚠ AND THE DEFAULTS DOWNSTREAM FAIL OPEN. `StickyFooter` reads
 * `view.cta?.label ?? 'Run analysis'` (`:109`) and `view.cta?.kind ?? 'primary'`
 * (`:114`), so a MISSING verdict paints an enabled primary action
 * indistinguishable from a positive one. That is why the hold must arrive as a
 * POSITIVE blocker with a non-zero count rather than as an absent CTA:
 * `StickyFooter.tsx:57` disables on `hasBlockers && _blockerCount > 0`, and a
 * hold that raised the flag while leaving the count at 0 would change nothing
 * at all on screen.
 */

/** What `PreAnalysisPanel` already computes and hands the footer. */
export interface FooterGate {
  isReady: boolean
  hasBlockers: boolean
  blockerCount: number
  blockedReason: string | undefined
}

/**
 * Fold the injected-model hold into the footer's gate.
 *
 * `heldNotice` is `analysisHeldNotice(nodes)` — the sentence when held, `null`
 * when not. Passing `null` returns the base gate **unchanged**, which is the
 * whole safety argument: on every drafted model this is the identity function,
 * so the blast radius is the held case only.
 */
export function applyAnalysisHold(base: FooterGate, heldNotice: string | null): FooterGate {
  if (heldNotice === null) return base
  return {
    isReady: false,
    hasBlockers: true,
    // ⚠ LOAD-BEARING. `StickyFooter` disables on `hasBlockers && blockerCount > 0`,
    // so a hold that set the flag and left the count at 0 would leave the button
    // enabled — the exact defect, with a flag raised.
    blockerCount: Math.max(base.blockerCount, 1),
    // The hold outranks a calibration reason: it is unconditional, and unlike a
    // calibration gap it names a remedy the user can reach from where they are.
    blockedReason: heldNotice,
  }
}

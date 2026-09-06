/**
 * ⭐⭐ THE FOOTER JOINS THE ADMISSION IT WAS NEVER READING.
 *
 * ⚠ THE DEFECT, witnessed on deployed `a2fd0656` by the Panel lane and routed
 * to Canvas: **on a saved example both `Run analysis` buttons were ENABLED and
 * silently no-op.** Clicked, then polled 12× over 30 s — `aria-busy` 0 from the
 * first poll, body length constant, network showed `POST /bff/cee/graph-readiness
 * → 200` and NO analysis turn dispatched. No console error. No refusal on screen.
 *
 * ⭐ AND THE SCREEN ALREADY HELD THE ANSWER. `StarterProvenanceBanner` was
 * saying, on the same surface, *"Analysis is held on a saved example — re-draft
 * it live to run one"*, with a working `Re-draft this live` button beside it.
 * One surface carried both halves and did not join them.
 *
 * ⛔ WHY THIS IS NOT A NEW HOLD CHECK, WHICH WAS THE TEMPTING AND WRONG FIX.
 * Two authorities already answer *"may this run proceed?"*:
 *
 *     canRunAnalysis.ts:278           reads `analysisHeldOn` — "⭐ ONE INPUT
 *                                     for the injected-model rung"
 *     deriveAnalysisDisplayState.ts   ZERO references to the hold, and it is
 *       → PreAnalysisPanel            what feeds this footer's enabled state
 *       → StickyFooter
 *
 * Writing a third hold test here would be the align-the-defaults repair this
 * estate has paid for twice (CLAUDE.md trap 21). So this composes the EXISTING
 * authority instead: `analysisHeldNotice`, whose own header says it is owned
 * there *"so both surfaces say it rather than each writing its own"*. The
 * banner joined. The footer is the surface that never did. **There is no new
 * predicate in this file — only the plumbing of one that already exists.**
 *
 * ⚠ AND THE DEFAULTS DOWNSTREAM FAIL OPEN. `StickyFooter` reads
 * `view.cta?.label ?? 'Run analysis'` and `view.cta?.kind ?? 'primary'`, so a
 * MISSING verdict paints an enabled primary action indistinguishable from a
 * positive one. That is why the hold must arrive as a POSITIVE blocker with a
 * non-zero count rather than as an absent CTA: the footer's own disable rule is
 * `hasBlockers && blockerCount > 0`, and a hold that raised the flag without
 * the count would change nothing at all.
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

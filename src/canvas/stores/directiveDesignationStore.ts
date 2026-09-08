/**
 * Session-only authority for ONE question, and it is written down here because
 * this seam has already cost the estate a reopened P0 by asking two:
 *
 *   ⭐ "WHICH OPTION DID THIS TURN'S `ui_directive` POINT AT, ON A RUN THE
 *      MODEL WAS NOT ADMITTED TO NAME ONE ON?"
 *
 * NOT "who is the front-runner?" (that is `deriveDecisionVerdict().leaderId`,
 * identity only) and NOT "may the model name one?" (that is
 * `licensesComparativeLeaderClaim`, the licence). This store is the CONJUNCTION
 * of those two facts with a third the canvas alone knows — that the assistant
 * actually pointed — and it exists because no combination of the other two can
 * tell a card whether it was lit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⭐ WHY THIS EXISTS AT ALL — PAUL'S RULING, 8 Sep 2026.
 *
 * PR #1284 measured the defect and got the diagnosis right: a highlight is a
 * SILENT CLAIM, because nothing on screen admits a claim is being made, and a
 * caveat cannot ride on a pulse animation. Its remedy — suppress the highlight
 * — was rejected:
 *
 *   > "Keep the highlight. Add on-screen text that admits the claim is being
 *   >  made and states its uncertainty. The caveat must be VISIBLE, not
 *   >  carried by the animation."
 *
 * So withholding is wrong AND silent highlighting is wrong. The answer is
 * highlight + words, and this store is the carrier for the words.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ WHY IT IS NOT `pulseAppliedTargets`, AND MUST NOT BECOME IT.
 *
 * The pulse is a shared choke point with six feeders (applied edits, the
 * what-changed chip, both graph merges). Hanging a leader caveat on it would
 * put "Olumi pointed here" on every applied edit — two questions under one
 * name, which is the defect class this estate pays for most often.
 *
 * ⚠ AND WHY IT IS NOT `olumiAttention`. That channel DIMS the whole model and
 * demands a dismiss, and its own header forbids what this needs: *"it NEVER
 * authors — a card that composed its own coaching sentence beside a producer's
 * finding would be exactly the fabricated-guidance defect the estate forbids."*
 * The sentence here is not coaching and not a finding about the user's domain:
 * it is the UI disclosing its OWN act. Routing a UI-authored sentence through a
 * producer-verbatim channel would break that channel's guarantee for every
 * later caller, so it gets its own.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ IT CANNOT OUTLIVE THE TURN THAT SET IT — BY CONSTRUCTION, NOT BY A TIMER.
 *
 * PR #747's objection to canvas grounding was that the canvas is ONE GLOBAL
 * SLOT: a mark from the latest turn sits beside every older answer in the
 * transcript, so a reader attributes it to the wrong one. The applicator
 * therefore writes this slice on EVERY non-stale run — the designation when
 * there is one, `null` when there is not — so a caveat can never be read
 * against a turn that did not earn it. That is a derived guard; a
 * clear-only-on-change variant would be a hand-maintained mirror.
 *
 * ⚠ NO EXPIRY TIMER, DELIBERATELY. `assistantFocusStore` expires because a
 * viewport takeover must end. This must NOT: the 2s pulse fades, and Paul's
 * ruling is precisely that the caveat may not be carried by the animation. A
 * caveat that outlives the pulse it explains is the intended behaviour — the
 * sentence is past tense for that reason.
 */
import { create } from 'zustand'

/**
 * ⭐ THE COPY, AND ITS ONE OWNER. Re-typing it at the render site is how the
 * four goal surfaces drifted apart (`goalAnchorCopy`'s founding lesson).
 *
 * ─── WHAT EACH CLAUSE IS FOR, AND WHY IT IS NOT LONGER ───
 *
 * "Olumi pointed here."  — THE ADMISSION. This is the half the product did not
 * have anywhere: measured on `staging`, a withheld run renders the option node
 * with NO designation (`isRecommended` is false, so the "Most supported" pill
 * and the robustness badge both withhold) and `DecisionNode`'s headline returns
 * `null` — correct silence, which is exactly why the highlight was a claim
 * nothing on screen admitted to.
 *
 * "No single option can be put forward yet"  — THE UNCERTAINTY, IN THE
 * PRODUCT'S OWN VOICE. This is CEE's own sentence from the live payload the P0
 * was measured in, not an invention — the same principle that chose the ratified
 * frequency wording. `decisionVerdict.ts`, `heroCopy.ts`, `buildHeroModel.ts`
 * and `DecisionNode.tsx` all already quote it as the thing a withheld turn says.
 *
 * "so treat this as a place to look, not an answer."  — THE READING
 * INSTRUCTION. Without it the first two clauses are a flat contradiction and
 * leave the user to resolve it. Paul's product test for anything on a card is
 * *"does it help users improve their thinking and communication"*; a pointer
 * the reader knows how to use passes it, a pointer plus a denial does not.
 *
 * ─── ⚠ WHAT IT DELIBERATELY DOES NOT SAY: THE PERCENTAGE ───
 *
 * The brief's shape carried the frequency inline ("…it scored highest in N% of
 * runs…"). It is left out because the card ALREADY carries that statistic, two
 * rows below, anchored and visible: `COMPARATIVE_COPY` renders
 * "Support ▬▬ 73%" with "Supported in 73% of simulated scenarios" as the hover
 * and the announced text — and `winReadout` is NOT gated on the licence, so it
 * is present on exactly the runs this caveat appears on. Repeating it here
 * would be the same thing said twice on one card, which is the density harm the
 * founder has explicitly held an item about.
 *
 * ⭐ AND THE ABSENCE IS SAFE, which is the reason this wording rather than a
 * shorter one: on a run where `winRate` is null the support row does not render
 * at all, and this sentence still states its uncertainty in words. A wording
 * that leaned on the number would have degraded to a bare admission there.
 *
 * ⚠ VOCABULARY. No winner / leads / ahead / came out ahead / beats / top
 * option — and no placing of any kind: the sentence makes no comparative claim
 * whatsoever, so it cannot smuggle one back in through a synonym.
 */
export const DIRECTIVE_DESIGNATION_CAVEAT_COPY =
  'Olumi pointed here. No single option can be put forward yet, so treat this as a place to look, not an answer.'

interface DirectiveDesignationState {
  /** The option node this turn's directive pointed at without a licence. */
  caveatedOptionId: string | null
  /** Named in full rather than `set`, so it cannot be read as zustand's own. */
  setCaveatedOptionId: (optionId: string | null) => void
}

export const useDirectiveDesignationStore = create<DirectiveDesignationState>((set, get) => ({
  caveatedOptionId: null,
  setCaveatedOptionId: (optionId) => {
    // No-op writes are dropped so an unrelated turn cannot re-render every
    // option card through a subscription that did not actually change.
    if (get().caveatedOptionId === optionId) return
    set({ caveatedOptionId: optionId })
  },
}))

/**
 * Record (or, with `null`, retire) the turn's caveated designation.
 *
 * ⚠ The applicator calls this on EVERY non-stale run, including runs with no
 * directive at all — see the header. Callers must not make the call
 * conditional on there being something to record.
 */
export function setDirectiveDesignationCaveat(optionId: string | null): void {
  useDirectiveDesignationStore.getState().setCaveatedOptionId(optionId)
}

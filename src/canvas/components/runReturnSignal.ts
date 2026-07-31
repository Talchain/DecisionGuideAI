/**
 * runReturnSignal — decides whether a completed analysis must return the dock
 * to the Olumi tab the run action navigated it away from.
 *
 * ## The defect this fixes (ROADMAP 2.204)
 * Clicking **Run analysis** dispatches a `run_analysis` turn, which calls
 * `resultsAnalysing()` synchronously at dispatch (useConversation.ts:4041 →
 * store.ts:3322, `status: 'preparing'`). OutputsDock's merged auto-switch
 * effect sees `resultsStatus` transition idle/cancelled → active and moves the
 * dock to the **Analysis** tab.
 *
 * The turn's own output lands somewhere else. `applyV5State.ts:1058` flips the
 * results store to 'complete' off the SAME turn whose blocks become
 * `v5_analysis_result` (mapV5Blocks.ts:63) and render through
 * `InlineBlocks.tsx:412` → `<V5AnalysisResultBlock>` — inside the **Olumi**
 * conversation tab, whose wrapper carries `hidden` + `aria-hidden` whenever the
 * active tab is not 'olumi' (OutputsDock.tsx:2541-2543).
 *
 * So the run action navigates away from the surface it produces, and nothing
 * brings the user back. Live-proven 31 Jul in a real browser: with the analysis
 * complete, the review container measured 0 px² for a **180 s** poll and did not
 * self-reveal; a single click on the Olumi tab took it to 268,862 px²
 * (`PHASE0-EVIDENCE-2026-07-28/probe-2154-visibility.md` §4 Q1 CAVEAT, and
 * `probe-premortem-live.md` §4 Q2 — "two ordinary clicks stand between a tester
 * and this card"). A tester who clicks Run and stays where the UI put them never
 * sees it.
 *
 * ## Why a return, and not a copy in the Analysis tab
 * The review content is a CONVERSATION BLOCK (`messages[].blocks[]`, the
 * `V5AnalysisResultBlock` member of the ConversationBlock union), not a canvas
 * store slice — there is no shared slice for an Analysis-tab copy to read. It is
 * also one of 8-14 phase-3 cards the same turn lands in that tab (measured, see
 * probe-premortem-live.md §4 Q2). Rendering one of them in a second surface
 * leaves the rest stranded and puts two live copies of the same card on screen;
 * returning the user restores all of it, and reuses the tab-dock action the file
 * already performs verbatim at OutputsDock.tsx:571-572.
 *
 * ## Why a pure helper
 * Same convention as the other dock decision helpers — `dockHostsOlumi`
 * (olumiSurface.ts), `shouldAutoExpandDockForResponse` (collapsedResponseSignal.ts),
 * `deriveNextDockIsOpen` — so the decision is directly and mutation-checkably
 * testable independent of the component. OutputsDock's effect is a thin caller
 * that only gathers the inputs.
 */

import type { OlumiDockTab } from './olumiSurface'
import type { ConversationMessage } from '../conversation/types'

/**
 * How many V5 analysis-result blocks the conversation currently carries.
 *
 * DERIVED, not mirrored (trap 12): counted from the live message list on every
 * call rather than tracked by a parallel flag that a future producer change
 * could leave stale. The caller compares consecutive counts, so a rerun
 * (1 → 2) is as detectable as a first run (0 → 1), and a page reload with a
 * completed analysis already in the transcript produces NO increase — a
 * returning user is never yanked by their own history.
 *
 * `'v5_analysis_result'` is the single conversation-block type the V5 mapper
 * emits for an analysis result (mapV5Blocks.ts:61-68), and it is the block that
 * renders the decision-review card (InlineBlocks.tsx:412). Synthetic messages
 * are NOT skipped: a synthetic bubble never carries this block type, and
 * filtering would add a second condition with no live effect.
 */
export function countAnalysisReviewBlocks(
  messages: readonly ConversationMessage[] | undefined | null,
): number {
  if (!messages || messages.length === 0) return 0
  let count = 0
  for (const message of messages) {
    const blocks = message.blocks
    if (!blocks) continue
    for (const block of blocks) {
      if (block.type === 'v5_analysis_result') count++
    }
  }
  return count
}

export interface RunReturnSignalInput {
  /**
   * aiPanelV2 floating-first UX is active. The whole signal is FF-gated: with
   * the flag OFF there is no Olumi tab at all — OutputsDock redirects
   * 'olumi' → 'results' (OutputsDock.tsx:325-327) — so a return would be a
   * no-op that fights its own guard.
   */
  aiPanelV2On: boolean
  /**
   * THIS run moved the dock to the Analysis tab (the merged auto-switch effect
   * fired on a run-start transition while the dock was showing some other tab).
   *
   * This is the "we took them here" record, and it is what makes the return
   * honest: a user who was ALREADY on Analysis when they pressed Run chose that
   * tab, so they are never moved off it. Cleared by any manual tab click and by
   * the return itself, so it can only ever spend once per run.
   */
  runAutoSwitchedToAnalysis: boolean
  /** The dock's currently selected tab. */
  dockTab: OlumiDockTab
  /**
   * The dock is VISUALLY showing its body, not the collapsed 40px rail
   * (`effectiveIsOpen`). Switching the tab of a collapsed rail reveals nothing;
   * that state is the collapsed-response signal's job, not this one.
   */
  dockEffectiveOpen: boolean
  /**
   * The user has deliberately interacted with the dock since this run started —
   * any pointerdown or keydown anywhere inside it (which includes the tab strip
   * and every Analysis-tab control).
   *
   * DERIVED FROM REAL EVENTS, not from an enumerated list of "controls that
   * count" (trap 12: such a list rots the moment a control is added and reads
   * green while it does). Passive waiting produces neither event, so the tester
   * the probes measured — who clicks Run and watches — is returned; a tester
   * who is reading and clicking around the Analysis tab is left alone.
   */
  userInteractedSinceRun: boolean
  /**
   * A NEW analysis-result block just landed in the conversation — i.e. the
   * content that is stranded in the hidden tab now exists.
   *
   * This, rather than `resultsStatus === 'complete'`, is the trigger: the
   * non-conversational run path (useV2Run) also completes the results store but
   * puts nothing in the Olumi tab, and returning a user to an empty surface
   * would be worse than leaving them. Deliberately NOT narrowed further to
   * "…and the block carries prose": the tab also receives the turn's review
   * cards and coaching, and a hidden conjunction that silently stands the fix
   * down on some turns is the failure mode the pre-mortem lens probe measured.
   */
  reviewContentArrived: boolean
}

/**
 * Whether a completed analysis must return the dock to the Olumi tab.
 *
 * Every gate must hold. The two that carry the ruling are
 * `runAutoSwitchedToAnalysis` (only return a user we moved) and
 * `!userInteractedSinceRun` (never yank a user who is doing something) — together
 * they mean the dock moves only for the passive tester the probes measured, and
 * never against a deliberate choice.
 */
export function shouldReturnToOlumiAfterRun(input: RunReturnSignalInput): boolean {
  return (
    input.aiPanelV2On &&
    input.runAutoSwitchedToAnalysis &&
    input.dockTab === 'results' &&
    input.dockEffectiveOpen &&
    !input.userInteractedSinceRun &&
    input.reviewContentArrived
  )
}

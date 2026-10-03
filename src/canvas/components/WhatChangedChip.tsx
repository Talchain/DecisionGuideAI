/**
 * WhatChangedChip — the "What changed since the last analysis run?" ask
 * (seamlessness R6; ROADMAP 2.1). The ANSWER is the server's run comparison.
 *
 * ⚠ 2 Oct 2026 (Compare audit (d)): the client-side graph diff over
 * `olumi-canvas-run-history` and its canvas pulse are REMOVED. Nothing live
 * writes that history, so the diff could only read legacy entries, from any
 * decision — a second comparison authority beside the served run delta. The
 * history notes below (F2/F2B/F8) are kept for provenance; where they mention
 * the local diff or pulse, that half no longer exists.
 *
 * F2 CHANGE B (2026-07-22) — AUGMENT, not replace. Ruled decision: the canvas
 * pulse STAYS (it answers the STRUCTURAL graph-diff question, device-local),
 * AND the click ADDITIONALLY dispatches a real CEE turn (which answers the
 * OUTCOME-delta question — the run-over-run comparison, server-side). The two
 * answer different questions, so both fire. The CEE send goes through the
 * EXISTING chip dispatch mechanism (dispatchAction → buildChipMeta →
 * buildV5Payload); it carries message "What changed since the last run?" and
 * chip.action_type 'what_changed', and the send gate promotes source to
 * 'chip_click' (buildPayload.ts hasBoundAction) — the payload is never
 * hand-built here. FAIL-SAFE: when no conversation hook is in scope
 * (useOptionalConversationContext() === null), the send is simply skipped and
 * the chip degrades to today's pulse-only behaviour — never a broken chip.
 *
 * F2 CHANGE B follow-up (2026-07-22) — the CEE send fires UNCONDITIONALLY, on
 * every click. #423 wired it inside the click handler, but the handler only
 * existed when a LOCAL delta was available (both snapshots present AND a
 * non-empty diff), so identical runs / missing snapshots self-hid the chip and
 * the send was unreachable — a catch-22, since the SERVER (not this device)
 * owns freshness/mode honesty (compared / insufficient_runs / stale /
 * unconfirmed / incomparable). So: the chip renders and sends whenever there is
 * a previous run to reference; only the canvas pulse stays gated on local-diff
 * availability, and the resting accessible name is the ACTION ("What changed?"),
 * never a disability claim.
 *
 * F2B follow-up (2026-07-22) — MOUNT decoupled from the local run count. The
 * one surviving mount boundary (#425 kept `runs.length < 2 → return null`) was
 * still a dead precondition: on the live guest path runHistory stays EMPTY even
 * after several completed analyses (the resultsComplete writer records a run
 * only when `results.seed` is set, which the conversation/V5 envelope path never
 * sets — see store.ts resultsComplete), so the chip never mounted and the send
 * stayed stranded. Because the SERVER owns comparison honesty, the chip now
 * mounts and stays actionable whenever its host analysis surface (ResultsBody)
 * renders — 0, 1, or many stored runs. Clicking always fires the typed send;
 * CEE answers "only one run so far, nothing to compare yet" honestly when true.
 * Local runHistory continues to gate ONLY the pulse/highlight extras.
 *
 */

import { GitCompareArrows } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useOptionalConversationContext } from '../conversation/ConversationContext'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { WHAT_CHANGED_CHIP_MESSAGE } from './whatChangedChipMessage'

// Re-exported for callers/tests already importing it from the component. The
// canonical source is the zero-import leaf module ./whatChangedChipMessage,
// so the narrow-gate wire spec can assert it without pulling this component's
// transitive hook graph into the typecheck.
export { WHAT_CHANGED_CHIP_MESSAGE }

export function WhatChangedChip() {
  const dispatchAction = useOptionalConversationContext()?.dispatchAction

  const handleClick = () => {
    // (1) The answer is the SERVER's — the CEE send fires on EVERY click, UNCONDITIONALLY.
    // The SERVER owns freshness/mode honesty: its four-way gate answers
    // compared / insufficient_runs / stale / unconfirmed / incomparable
    // honestly (F2B byte-confirm §3). Gating the send on the LOCAL diff would
    // hide the honest server answer behind a device-side heuristic — the exact
    // catch-22 this fixes. Dispatch goes through the existing chip mechanism
    // (dispatchAction → buildChipMeta → buildV5Payload); the send gate promotes
    // source to 'chip_click' because 'what_changed' passes isSendableToken
    // — the payload is not built here. FAIL-SAFE: when dispatchAction is absent
    // (no conversation hook), the chip is disabled (below), so this never runs.
    if (dispatchAction) {
      void dispatchAction({
        action_type: 'what_changed',
        label: WHAT_CHANGED_CHIP_MESSAGE,
        message: WHAT_CHANGED_CHIP_MESSAGE,
        source: 'chip',
      }).catch(() => {
        // A failed CEE send must never break the chip. The conversation panel
        // surfaces its own send-failure notice.
      })

      // (2) REVEAL — bring the Olumi thread into view so the answer is SEEN.
      //
      // The server owns comparison honesty and answers `insufficient_runs`
      // when there is only one run — but that reply lands in a thread that may
      // be on a hidden dock tab or behind a minimised panel, so the user
      // pressed a button and, on screen, nothing happened.
      //
      // Every OTHER dispatch site is already covered: guidanceStore wraps the
      // registration seam in `withOlumiReveal` (guidanceStore.ts:209-221), so
      // `_sendMessage`, `_sendChip`, `_prefillChat` and `_dispatchAction` all
      // reveal automatically (:592-603). This chip reads the RAW context
      // `dispatchAction` (above), which bypasses that wrapped seam — making it
      // the one send with no reveal. Same treatment as
      // AnalysisHeroContainer.tsx:111-116 and InspectorCoaching.tsx:79.
      //
      // Fired here rather than in `.then()`: the user should see their message
      // land AND the reply, not just the reply. Best-effort, per the contract
      // guidanceStore states at :200-202 — a reveal failure must never turn a
      // DELIVERED message into a thrown error.
      //
      // Inside the `if` on purpose: with no dispatcher nothing was sent, and
      // revealing would drag the user to a thread no message went to.
      try {
        revealOlumiSurface()
      } catch (err) {
        console.warn('[WhatChangedChip] Olumi reveal failed after dispatch:', err)
      }
    }
  }

  // ⚠ ONE COMPARISON AUTHORITY (Compare audit (d), DL #85 5943446984, 2 Oct).
  // This chip used to diff the two newest entries of `olumi-canvas-run-history`
  // and, when they differed, say "Since your last analysis run: Nodes: +2". No
  // live path writes that history any more (V5 carries no seed), so the diff
  // could only come from LEGACY entries — and it was not scenario-scoped, so a
  // long-time tester's browser showed counts from two old runs of ANY decision
  // beside the served run delta. Measured on served 7403a842. The chip is now
  // only the ask; the answer is the server's run comparison. The label names the
  // analysis run, never a version (trap 21; canvas/versions/versionLabels.ts).
  const label = 'What changed since the last analysis run?'

  // F8 (honesty): with no dispatcher the click can do nothing, so the button
  // presents itself as disabled rather than actionable.
  const isNoOp = !dispatchAction

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
    <button
      type="button"
      onClick={handleClick}
      disabled={isNoOp}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-transparent border border-info/30 text-text-body',
        typography.caption,
        'font-medium cursor-pointer hover:border-info/50 hover:underline',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline',
      ].join(' ')}
      aria-label={label}
      data-testid="what-changed-chip"
    >
      <GitCompareArrows size={14} className="text-info flex-none" aria-hidden="true" />
      <span>{label}</span>
    </button>
    </span>
  )
}

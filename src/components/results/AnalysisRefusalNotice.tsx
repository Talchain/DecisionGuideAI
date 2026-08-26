/**
 * AnalysisRefusalNotice — the reader for CEE's TYPED analysis refusal.
 *
 * ROADMAP 2.1163 / golden-journey EXT-2. CEE PR #942 puts
 * `analysis_ready: { status: 'blocked', blocked_reason: <specific code>, ... }`
 * on the wire for a refused analyse turn. Until this component,
 * `blocked_reason` had ZERO readers repo-wide — and an honest refusal that
 * nobody renders is indistinguishable, to the user, from a silent failure.
 *
 * WHAT IT SAYS, AND WHY IN THAT ORDER
 *   1. that the analysis did not run — past tense, factual, no hedging;
 *   2. ONE precise reason, mapped from `blocked_reason` at the CEE producer's
 *      declared semantics (see analysisRefusalNotice.ts — trap 13c: expectations
 *      are derived from the PRODUCER, never from our own reading of a field);
 *   3. where the next step is. It names the assistant's reply — a LOCATION that
 *      always exists (CEE's composeHandlerFailureBody sets `assistant_text` on
 *      every recoverable branch) — rather than instructing a control this notice
 *      does not render (#684 review, D2).
 *
 * An UNMAPPED code gets the honest generic plus the raw code in a details
 * disclosure. It never gets a fabricated specific: guessing which cause a new
 * CEE code represents is precisely the confident wrongness this row exists to
 * end. The raw code is technical — it appears as user-visible text ONLY in that
 * disclosure, and never when the code is mapped.
 *
 * TONE: neutral-informational. Deliberately NOT the amber "proceed with care"
 * family that ROADMAP 2.1127 is correcting, and deliberately not alarm-red
 * either — "the engine was busy, nothing is wrong with your model" is one of
 * the reachable reasons, and a danger tone would contradict its own sentence.
 *
 * SEPARATE FROM THE READINESS SURFACES BY DESIGN. This notice is a sibling
 * element, not a state of that card.
 *
 * ⚠ CORRECTED 26 Aug 2026 — THE NARROW CLAIM WAS TRUE AND THE REASSURANCE
 * AROUND IT WENT STALE, WHICH IS WHY IT IS CORRECTED HERE RATHER THAN TIDIED
 * AWAY. This paragraph said `DecisionOverviewCard`'s `liveState` derivation was
 * "untouched", because a CLEARED `ceeAnalysisReady` yields 'unassessed' there —
 * verified against a deployed-UI trace of 2026-08-14. That specific sentence is
 * STILL TRUE.
 *
 * What it did not cover is the case that has since become reachable: a refusal
 * that is NOT cleared. `analysis_ready.status: 'blocked'` arrives NON-NULL and
 * with populated options (`adapters/cee/types.ts:443-455`), so it never reaches
 * the 'unassessed' branch this claim was checked against — it fell through to
 * 'needs_input', and the card told the user they owed input for the product's
 * own refusal. Fixed at `DecisionOverviewCard.tsx` (`isBlocked`), pinned in
 * both directions by `DecisionOverviewCard.refusalIsBlocked.spec.tsx`.
 *
 * The date is load-bearing: the trace predates refusals carrying readiness
 * identity, so it is a control pinned to a posture that has since moved. A
 * reassurance whose evidence has an expiry needs the expiry written next to it.
 */
import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import {
  ANALYSIS_REFUSAL_GENERIC_REASON,
  ANALYSIS_REFUSAL_HEADLINE,
  ANALYSIS_REFUSAL_POINTER,
  describeAnalysisRefusalReason,
  type AnalysisRefusalNotice as AnalysisRefusalNoticeState,
} from '@/canvas/store/analysisRefusalNotice'

export interface AnalysisRefusalNoticeProps {
  /** Override the store slice (tests / Storybook). `undefined` → read the store. */
  notice?: AnalysisRefusalNoticeState | null
  className?: string
}

export function AnalysisRefusalNotice({
  notice: noticeProp,
  className = '',
}: AnalysisRefusalNoticeProps) {
  // Primitive selector (one field, referentially stable) — required by
  // `ci:guard:zustand`, which fails a bare object selector.
  const storeNotice = useCanvasStore((s) => s.analysisRefusalNotice)
  const notice = noticeProp !== undefined ? noticeProp : storeNotice

  // Never assert a refusal we do not hold.
  if (!notice) return null

  const mappedReason = describeAnalysisRefusalReason(notice.blockedReason)

  return (
    <div
      data-testid="analysis-refusal-notice"
      // Technical provenance for tests/debug — never user copy.
      data-blocked-reason={notice.blockedReason}
      data-reason-mapped={mappedReason ? 'true' : 'false'}
      data-computed-at={notice.computedAt ?? undefined}
      role="status"
      className={`flex items-start gap-2 rounded-md border border-panel-border bg-panel px-3 py-2 ${className}`.trim()}
    >
      <span
        className="flex-none mt-1.5 w-2 h-2 rounded-full bg-text-light"
        aria-hidden="true"
        data-testid="analysis-refusal-dot"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={`${typography.panelBody} text-text-header`}>
          {ANALYSIS_REFUSAL_HEADLINE}
        </span>
        <span className={`${typography.panelBody} text-text-body`}>
          {mappedReason ?? ANALYSIS_REFUSAL_GENERIC_REASON}
        </span>
        <span className={`${typography.caption} text-text-light`}>
          {ANALYSIS_REFUSAL_POINTER}
        </span>
        {/* Unmapped only. Disclosing the code we could not interpret is the
            honest alternative to guessing what it meant. */}
        {!mappedReason && (
          <details className="mt-1">
            <summary className={`${typography.caption} text-text-light cursor-pointer`}>
              Details
            </summary>
            <code
              data-testid="analysis-refusal-raw-reason"
              className={`${typography.caption} text-text-light break-all`}
            >
              {notice.blockedReason}
            </code>
          </details>
        )}
      </div>
    </div>
  )
}

export default AnalysisRefusalNotice

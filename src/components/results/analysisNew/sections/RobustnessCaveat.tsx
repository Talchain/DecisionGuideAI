/**
 * ⭐⭐ THE PRODUCER'S OWN SENTENCE ABOUT HOW FAR THE RANKING HELD.
 *
 * `robustness_caveat` is a `DecisionBriefV1` member CEE already sends and the
 * browser already holds — it rides `results.report.decision_brief`, the same
 * slice `DecisionBriefSectionContainer` reads. Swept at `origin/staging`: it
 * had exactly TWO non-test occurrences, both in `decision-brief/
 * decisionBriefViewModel.ts`, feeding a section whose only mount is
 * `ResultsBody.tsx` — the PARKED tab. Contrast control in the same sweep: its
 * sibling members (`defaultedAssumptions` / `estimatedInterventions`) return 16
 * lines, so the probe sees the family; this one really was unreachable here.
 *
 * ⚠⚠ IT IS A LEADER-RANKING MEMBER, AND THAT IS THE WHOLE RISK OF MOVING IT.
 * The parked tab states the harm in its own words: *"CEE strips it on a
 * withheld turn and its absence IS the withheld signal. The caveat's own
 * presence must never be read as evidence that a ranking may be spoken about —
 * that is how Authority 3 came to reconstruct a withheld leader and print
 * 'X is slightly ahead' beside CEE's 'no option can be put forward yet'."*
 * So `leaderClaimPermitted` is REQUIRED, never defaulted, and is quoted from
 * the one authority the view model already computes.
 *
 * ⚠ NOT `display_verdict_reason`. That field is a DIFFERENT wire member
 * answering a different question, and it is already on this surface at
 * `AtAGlance`. Treating the two as one is this estate's trap 21, and it is the
 * mistake `ModelHeldUp` records having made: quoting the verdict reason a
 * second time put "the ordering held across the simulated range" on one surface
 * twice. `duplicatesVerdictReason` below exists so this section can never
 * repeat it either — the producer may legitimately word both alike on some run,
 * and a reader does not care which field it came from.
 *
 * ⚠ VERBATIM, NEVER COMPOSED. Both `text` and `basis` are the producer's; this
 * file authors the heading and nothing else.
 */
import { useMemo } from 'react'
import { ShieldQuestion } from 'lucide-react'

import { useCanvasStore } from '../../../../canvas/store'
import { readDecisionBriefViewModel } from '../../decision-brief/decisionBriefViewModel'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

export interface RobustnessCaveatProps {
  /**
   * May this run's ranking be spoken about at all? REQUIRED, never defaulted —
   * see the header. Quoted from `AnalysisNewViewModel.leaderClaimPermitted`.
   */
  leaderClaimPermitted: boolean
  /**
   * The verdict sentence already on screen (`AtAGlance`), so this section can
   * refuse to say the same thing twice. `null` when the glance shows none.
   */
  verdictReason: string | null
  testId?: string
}

/** Same text, ignoring case and surrounding space — not a similarity guess. */
function duplicatesVerdictReason(text: string, verdictReason: string | null): boolean {
  if (verdictReason === null) return false
  return text.trim().toLowerCase() === verdictReason.trim().toLowerCase()
}

export function RobustnessCaveat({
  leaderClaimPermitted,
  verdictReason,
  testId = 'analysis-new-robustness-caveat',
}: RobustnessCaveatProps) {
  /**
   * ⚠ A BARE SLICE OUT OF THE STORE, PARSED IN A MEMO — the same shape
   * `DecisionBriefSectionContainer` uses, and for its reason: returning a
   * derived object from inside a zustand selector builds a new reference on
   * every store event and re-renders forever (the React 185 class the repo's
   * `ci:guard:zustand` check exists to catch).
   */
  const rawBrief = useCanvasStore((state) => (
    /*
     * ⚠ `results?.` — AND A SPEC FOUND IT. `DecisionBriefSectionContainer` reads
     * `state.results.report` unguarded and gets away with it because it mounts
     * only where a run exists. This tab renders PRE-RUN, where `results` is
     * null, and an unguarded read threw for every case in two suites.
     */
    (state.results?.report as { decision_brief?: unknown } | null | undefined)?.decision_brief
  ))
  const brief = useMemo(() => readDecisionBriefViewModel(rawBrief), [rawBrief])

  if (!leaderClaimPermitted) return null
  const caveat = brief?.robustnessCaveat ?? null
  if (caveat === null) return null
  if (duplicatesVerdictReason(caveat.text, verdictReason)) return null

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel px-3 py-2"
      data-testid={testId}
      aria-label={COPY.robustnessCaveat.title}
    >
      <div className="flex items-start gap-2">
        <ShieldQuestion className="w-4 h-4 mt-[1px] shrink-0 text-text-light" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`${typography.panelHeader} text-text-header m-0`} data-testid={`${testId}-title`}>
            {COPY.robustnessCaveat.title}
          </p>
          {/* The producer's sentence. Rendered verbatim — never trimmed to a
              length, never re-worded, never summarised. */}
          <p className={`${typography.panelBody} text-text-body mt-1 mb-0`} data-testid={`${testId}-text`}>
            {caveat.text}
          </p>
          {/* And what it was measured against, also the producer's. */}
          <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${testId}-basis`}>
            {COPY.robustnessCaveat.basisPrefix}{caveat.basis}
          </p>
        </div>
      </div>
    </section>
  )
}

export default RobustnessCaveat

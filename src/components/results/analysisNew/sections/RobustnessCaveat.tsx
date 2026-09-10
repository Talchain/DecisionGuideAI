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
 * twice. `duplicatesVerdictReason` below exists so this section does not repeat
 * it either — the producer may legitimately word both alike on some run, and a
 * reader does not care which field it came from.
 *
 * ⚠ "NEVER" WOULD BE AN OVERCLAIM, AND THIS COMMENT MADE IT. The guard is an
 * EXACT comparison after trim and case-fold, so a near-duplicate — one extra
 * clause, a differing full stop, a paraphrase — renders both sentences. That is
 * deliberate: the alternative is a similarity score, which would start
 * suppressing the producer's caveat on runs where it says something genuinely
 * additional, and a dropped caveat is the worse of the two harms. So the narrow
 * true statement is: it catches a VERBATIM restatement, which is the shape
 * `ModelHeldUp` actually shipped.
 *
 * ⚠ VERBATIM, NEVER COMPOSED. Both `text` and `basis` are the producer's, and
 * neither is trimmed, re-worded or summarised. This file authors TWO strings and
 * no more: the heading, and the `Tested against: ` prefix that labels the basis.
 * (This comment said "the heading and nothing else" until review counted the
 * second one — an understatement of what the file does is still a wrong
 * inventory of it.)
 *
 * ⭐ THE COUNT IS STILL TWO. The basis line became CONDITIONAL when the shared
 * parser began returning `basis: null` for a value that is not display text, and
 * a conditional render changes WHEN a string is authored, never HOW MANY. No
 * substitute, placeholder or fallback wording was added for the suppressed case:
 * the line is simply absent, because inventing a phrase to stand in for the
 * producer's token is the fabrication this surface exists to avoid.
 */
import { useMemo } from 'react'
import { ShieldQuestion } from 'lucide-react'

import { useCanvasStore } from '../../../../canvas/store'
import { readDecisionBriefViewModel } from '../../decision-brief/decisionBriefViewModel'
import { typography } from '../../../../styles/typography'
import { surface } from '../panelSurfaces'
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
   * every store event and re-renders forever. That is the React-185 class.
   *
   * ⚠⚠ AND NO GUARD IS WATCHING THIS FILE, so the shape is the only protection.
   * This comment credited `ci:guard:zustand` with catching the class here; it
   * does not. Derived at the bytes: `tools/ci-guards/check-zustand-selectors.mjs`
   * walks `path.join(root, 'src', 'canvas')` and nothing else, and its single
   * mention of `components` is a whitelist for `src/canvas/components/
   * OutputsDock.tsx`. This file is `src/components/results/...`, outside that
   * root entirely. The code is correct either way — but a comment naming a guard
   * that is not running is worse than no comment, because it tells the next
   * reader the mistake would be caught.
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
      /**
       * ⚠⚠ COMPOSED, NOT HAND-WRITTEN — and CI is what told me. This read
       * `"rounded-lg border border-panel-border bg-panel px-3 py-2"`, which
       * `oneContainerGrammar.spec.ts` bans outside `panelSurfaces.ts`.
       *
       * ⭐ THE FAILURE WAS NOT CAUSED BY ANY EDIT OF MINE, AND THAT IS THE
       * INTERESTING PART. That guard landed on STAGING in #1346 on 9 Sep and is
       * absent from this branch's own tree and from its merge base. CI computes
       * the suite on the MERGE REF, so the guard was in scope for the check while
       * being invisible to the branch — and the two `Staging Gate: success`
       * readings this PR carries were computed against a base that predates it. A
       * green check ages: the base moved underneath, and the first run after it
       * moved is the one that found this.
       *
       * `surface('neutral')` is the mapping `DecisionRecorded` uses for the same
       * shape — a top-level section box that groups without judging. It is NOT
       * `warning`, even though the grammar describes that tone as "a caveat the
       * reader must carry into the reading": tinting this box is a design decision
       * about emphasis, not a guard repair, and making one while fixing the other
       * is how two changes end up inseparable.
       *
       * ⚠ THE GEOMETRY DELTA IS DELIBERATE, not collateral: `rounded-md` not
       * `rounded-lg`, `py-2.5` not `py-2`, and no `bg-panel`. That is the whole
       * point of the grammar — one radius and one padding for every box at this
       * level — and `surface('neutral')` carries no fill because the section sits
       * directly on the panel, which the module's own spec records.
       */
      className={surface('neutral')}
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
          {/*
            And what it was measured against, also the producer's — WHEN it is
            display text at all.

            ⚠⚠ THIS LINE SHIPPED A WIRE ENUM TO A USER. On the served build
            `475ee1c7` it rendered `Tested against: is_robust`, because the
            shared parser screened `basis` with a blocklist of node-id prefixes
            and `is_` is not one. The parser now answers the positive question
            and hands back `basis: null` for anything that is not display text,
            so the judgement stays in the one place both surfaces inherit it
            from and this file only decides whether to draw the line.

            ⚠ THE SENTENCE ABOVE IS NOT CONDITIONAL ON THIS. Suppressing the
            whole caveat because its label is unusable would discard the one
            line telling the user how far to trust the ranking, which is the
            worse of the two harms and the argument `decisionBriefViewModel.ts`
            already makes for the glossary case.

            ⚠ `!== null`, NOT A TRUTHINESS TEST. The parser guarantees a
            non-blank string or null, and a `?? caveat.basis` here would
            reinstate the exact leak this guard exists to remove.
          */}
          {caveat.basis !== null && (
            <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${testId}-basis`}>
              {COPY.robustnessCaveat.basisPrefix}{caveat.basis}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default RobustnessCaveat

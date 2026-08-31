/**
 * Analysis (New) — "How the options compare".
 *
 * ⭐⭐ THE GAP THIS CLOSES, MEASURED ON A DEPLOYED RUN, NOT IMAGINED. On a real
 * completed staging run with FOUR options (Segment 89%, RudderStack 6%,
 * Snowflake 5%, Status Quo <1%) this surface rendered the leading option and
 * one win percentage and NOTHING ANYWHERE about the other three. The existing
 * Analysis tab carried the full comparison on the same run. An audit called it
 * "a TOTAL loss", and for a decision tool that is the correct word: a reader
 * who cannot see the field cannot tell a runaway leader from a coin flip, and
 * cannot see that an option they care about took no part in the comparison.
 *
 * ── WHAT THIS SECTION IS ENTITLED TO PUT ON SCREEN ────────────────────────
 *
 * Names, own win shares, and the sanctioned sentence for an option the run did
 * not analyse. That is all, and each omission below is a rule this estate has
 * already paid for:
 *
 *  · NO ORDINALS. `OptionResult.rank` exists, and printing it would put a
 *    RANKING on screen on a run whose verdict withheld one. The ordering claim
 *    lives in the ARRAY ORDER, authored once upstream by `sortOptionsForDisplay`
 *    and withheld there when the verdict withholds (ROADMAP 1.267). This
 *    component renders `rows` in the order it is given and adds no number.
 *
 *  · NO GAP BETWEEN OPTIONS. "Behind by N percentage points" was retired
 *    2026-08-10: a difference of two Monte Carlo estimates carries more
 *    uncertainty than either, and printed bare it reads as the most precise
 *    number on the panel while being the least reliable. Own-probability
 *    statements only. The reader still SEES the gap — that is what the bars are
 *    for — they are simply not handed a spurious integer for it.
 *
 *  · NO LEADER MARKER. The entitled leader is already named at the top of this
 *    surface by `AtAGlance`, under the one gate that licenses naming it. A
 *    second crown here would be a second designation channel, and an unentitled
 *    one, since `isRecommended` is set from the winner selection rather than
 *    from the leader VERDICT.
 *
 *  · NO AUTHORED SENTENCES. Every string a reader meets here is either a label
 *    the producer sent, a number the estate's own formatter produced, or
 *    `NOT_ANALYSED_BADGE` / `notAnalysedReasonCopy` — the single source for what
 *    the results panel says about an unanalysed option.
 *
 * ── ABSENCE IS NOT ZERO, AND IT IS STRUCTURAL ─────────────────────────────
 *
 * An unanalysed option is a DIFFERENT SHAPE in the view model (`kind:
 * 'not_analysed'`), with no `winReadout` and no `winFraction` to reach for. It
 * renders with no bar and no number, by construction rather than by this
 * component remembering to check. An ANALYSED option whose producer sent no win
 * probability carries `null` on both fields together, so the bar and the number
 * can never disagree about whether there is a share at all.
 *
 * ── WIDTH (the 280px dock floor) ──────────────────────────────────────────
 *
 * The dock is 280–416 responsive and drags to 480, so the content measure runs
 * 238–320px. The row is one flex line: a wrapping label that owns the slack
 * (`min-w-0 flex-1`) and a `shrink-0` readout that never compresses, with the
 * bar on its own full-width line beneath. Nothing has an intrinsic minimum
 * wider than the floor, so the panel never scrolls horizontally.
 */

import { Scale } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { OptionsComparisonSection } from '../analysisNewTypes'
import { SectionShell } from './SectionShell'

export interface OptionsComparisonProps {
  options: OptionsComparisonSection
  testId?: string
}

export function OptionsComparison({
  options,
  testId = 'analysis-new-options',
}: OptionsComparisonProps) {
  // Nothing to show and nothing truthful to say about its absence — pre-run,
  // or a model with no options at all. The honest render is no render: a
  // heading is a claim that there is something under it (`AnalysisNewSection`
  // established this rule after three bare headings shipped).
  if (options.totalCount === 0) return null

  /**
   * The options this list cannot NAME — never silently dropped.
   *
   * `rows` excludes an option whose label is blank or is merely its own node
   * id, because inventing a name is the fabrication the excluded-option path
   * refuses. The collapsed row promises `totalCount`, so without this line the
   * promise and the body would report two different populations.
   */
  const unnamed = options.totalCount - options.rows.length

  return (
    <SectionShell
      title={COPY.sections.options}
      icon={Scale}
      // The count is the FULL population, and the body accounts for every one
      // of them — named rows plus the unnamed disclosure. A collapsed row is a
      // promise about what is behind it.
      count={options.totalCount}
      testId={testId}
    >
      <ul className="list-none p-0 m-0 space-y-2.5">
        {options.rows.map((o) => (
          <li key={o.id} data-testid={`${testId}-row`} data-option-id={o.id} data-option-kind={o.kind}>
            <div className="flex items-baseline gap-2">
              <span
                className={`${typography.panelBody} text-text-body min-w-0 flex-1 break-words`}
                data-testid={`${testId}-label`}
              >
                {o.label}
              </span>

              {/* ⚠ THE NUMBER IS THE SMALLEST TYPE IN THE ROW, AND THAT IS A
                  RULE RATHER THAN A PREFERENCE. A win probability set larger
                  than the option it belongs to is read AS the answer, which is
                  the anchoring Olumi's alignment principle says the product
                  must mitigate — "especially anchoring on a number the AI
                  supplied", and on a fresh run every input behind this share is
                  Olumi's own estimate. The name leads; the share qualifies it. */}
              {o.kind === 'analysed' ? (
                o.winReadout !== null ? (
                  <span
                    className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                    data-testid={`${testId}-win`}
                  >
                    {o.winReadout}
                  </span>
                ) : null
              ) : (
                <span
                  className={`${typography.panelMeta} text-text-light shrink-0`}
                  data-testid={`${testId}-not-analysed-badge`}
                >
                  {NOT_ANALYSED_BADGE}
                </span>
              )}
            </div>

            {/* The bar exists ONLY for a measured share. An option with no
                probability — analysed or not — gets no track and no fill:
                an empty track reads as a measured zero, which is the precise
                claim absence does not license. */}
            {o.kind === 'analysed' && o.winFraction !== null ? (
              <span
                className="mt-1 block h-1 w-full rounded-full bg-panel-hover overflow-hidden"
                aria-hidden="true"
                data-testid={`${testId}-bar`}
              >
                <span
                  className="block h-full rounded-full bg-info"
                  style={{ width: `${Math.round(o.winFraction * 100)}%` }}
                />
              </span>
            ) : null}

            {/* ⭐ THE PRODUCER'S OWN SENTENCE ABOUT THIS OPTION, VERBATIM.
                `story_headlines[optionId]` carries one for NON-LEADING options
                too, which is exactly the material this section existed to be
                missing: without it a reader learns that RudderStack scored 6%
                and nothing about why. Nothing here is composed — if the
                producer sent no sentence, none is shown. */}
            {o.kind === 'analysed' && o.why !== null ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-why`}
              >
                {o.why}
              </p>
            ) : null}

            {/* WHY there is no number. The sanctioned sentence, verbatim — it
                states the consequence ("no rank and no probability") rather
                than leaving the reader to infer it from an empty row. A row
                that silently omits numbers reads as a rendering gap; a row that
                says why reads as a decision. */}
            {o.kind === 'not_analysed' ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-not-analysed-reason`}
              >
                {o.reasonCopy}
              </p>
            ) : null}
          </li>
        ))}

        {unnamed > 0 ? (
          <li
            className={`${typography.panelMeta} text-text-light`}
            data-testid={`${testId}-unnamed`}
          >
            {COPY.disclosure.unnamedOptions(unnamed)}
          </li>
        ) : null}
      </ul>
    </SectionShell>
  )
}

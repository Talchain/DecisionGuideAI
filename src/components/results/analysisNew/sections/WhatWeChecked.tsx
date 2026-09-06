/**
 * Analysis (New) — "What we checked".
 *
 * ⭐⭐ THE ONLY SURFACE ON THIS TAB THAT SPEAKS FOR A CHECK THAT WAS NOT MADE.
 *
 * Imported from the old Analysis tab (`TriageActionCardsBody.tsx:691-770`),
 * where the consolidation map marks it KEEP. The three checks and their labels
 * are that surface's, verbatim. What is NOT imported, and why, is recorded at
 * each site below — the source's own copy overpromises in one place and blurs a
 * distinction in another, and both were derived at the bytes before this file
 * was written.
 *
 * ── WHY IT IS NOT A RESTATEMENT OF "AT A GLANCE" ────────────────────────────
 *
 * The glance answers WHAT THE RUN FOUND. This answers WHAT THE RUN CHECKED.
 * Two questions, named apart deliberately (CLAUDE.md trap 21) — reconciling
 * them would be the wrong fix, and it would delete the only state that matters
 * here.
 *
 * The gap is structural, and it is visible in the adapter rather than inferred:
 * on a run where a check was NOT made, this tab currently renders SILENCE in
 * all three cases — `buildAtAGlance` nulls the headline without a leader
 * entitlement, `VERDICT_WORD` omits `'not_assessed'` so no robustness chip
 * mounts at all, and an unassessed evidence list renders the same empty section
 * as an assessed-and-clean one. A reader cannot tell "we looked and found
 * nothing" from "we did not look", and only the first is reassurance.
 *
 * ── THE DENSITY RULE THIS FOLLOWS ───────────────────────────────────────────
 *
 * ⚠ A SENTENCE ONLY WHERE A SENTENCE IS OWED. `meaning` renders on the
 * unassessed states and nowhere else. Copy identical on every row is furniture
 * rather than information (Paul's canvas-density ruling, one surface up), and
 * the assessed outcomes are explained elsewhere on this tab — where
 * `firstViewportCensus.spec.tsx` requires them to stay. On a healthy run this
 * section is a heading and three short chips on one wrapped line.
 *
 * ⚠ NOT A `SectionShell`, AND THAT IS A DECISION RATHER THAN AN OMISSION. A
 * collapsed row costs the same vertical space as this content and hides it
 * behind a click — and the question it answers ("what did the analysis NOT
 * check?") is one a reader will never think to click for. A trust readout that
 * has to be opened is a trust readout nobody reads. It is a strip, exactly as
 * it is on the old tab, where it is proven.
 */

import { Check, HelpCircle, X } from 'lucide-react'

import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ChecksItem, ChecksSection } from '../analysisNewTypes'

/**
 * Glyph and colour per state.
 *
 * ⚠ AN UNKNOWN IS NOT A FAILURE and must never render as one — the muted help
 * glyph, never the danger `X`. The old tab states the same rule; it is imported
 * with the component because the colour IS the claim for a reader scanning the
 * row.
 */
const GLYPH = {
  pass: { Icon: Check, colour: 'text-success' },
  finding: { Icon: X, colour: 'text-danger' },
  not_assessed: { Icon: HelpCircle, colour: 'text-text-light' },
} as const

/**
 * One row idiom, used by both rows.
 *
 * ⚠ SHARED RATHER THAN COPIED. The two rows must stay typographically
 * identical: the demotion is carried by the RULE and by position, never by
 * making the disclosure smaller or fainter. Shrinking it would be a second,
 * unreviewed claim — that the scope statement matters less than the verdicts,
 * when the whole point is that a reader must not miss it.
 */
const CHIP_ROW = `flex items-center flex-wrap gap-x-3 gap-y-1 ${typography.panelMeta} text-text-light list-none p-0 m-0`

export interface WhatWeCheckedProps {
  checks: ChecksSection
  testId?: string
}

export function WhatWeChecked({
  checks,
  testId = 'analysis-new-checks',
}: WhatWeCheckedProps) {
  /**
   * ⚠ A HEADING IS A CLAIM THAT THERE IS SOMETHING UNDER IT — the rule
   * `AnalysisNewSection` established after three bare headings shipped. Pre-run
   * the adapter emits no items, and the honest render is no render: three
   * "not assessed" rows about an analysis that never started would read as a
   * run that came back empty.
   */
  if (checks.items.length === 0) return null

  /**
   * ⭐⭐ THE PARTITION: AN ANSWER IS NOT A STATEMENT ABOUT SCOPE.
   *
   * `pass` and `finding` are VERDICTS — the analysis looked and this is what it
   * found. `not_assessed` is a statement about what the analysis DID NOT COVER,
   * and it is not a third possible answer to the same question.
   *
   * Rendered as peers in one flat row, the row itself asserts they are the same
   * KIND of thing, and a reader scanning three chips reads three results. The
   * glyph and colour distinguish them (and `whatWeChecked.spec.tsx` §3 pins
   * that they do) — but a distinction carried only by a symbol is a distinction
   * the panel is not making structurally. The panel must never appear to have
   * reached a conclusion the analysis did not license.
   *
   * ⚠ THIS SPLITS ON `state`, WHICH IS THE VIEW MODEL'S OWN VOCABULARY — never
   * on `id` and never on `code`. Four codes across all three checks reach
   * `not_assessed` (`leader_not_assessed`, `robustness_not_assessed`,
   * `robustness_unknown`, `evidence_not_assessed`), and any of the three checks
   * can land there. A partition keyed on the evidence row alone would leave an
   * unassessed leader or robustness check sitting among the verdicts.
   *
   * ⚠ NOTHING HERE CHANGES WHAT A STATE MEANS OR WHEN IT FIRES. The codes, the
   * states, the labels and the sentences are the adapter's and the copy deck's,
   * untouched — this is a presentation change only.
   */
  const verdicts = checks.items.filter((i) => i.state !== 'not_assessed')
  const disclosures = checks.items.filter((i) => i.state === 'not_assessed')

  return (
    <section
      className="border-t border-panel-border pt-3"
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
    >
      <h3
        id={`${testId}-heading`}
        className={`${typography.panelMeta} text-text-light mb-1`}
        data-testid={`${testId}-heading`}
      >
        {COPY.sections.checks}
      </h3>

      {verdicts.length > 0 ? (
        <ul className={CHIP_ROW} data-testid={`${testId}-verdicts`}>
          {verdicts.map((item) => (
            <ChecksChip key={item.id} item={item} testId={testId} />
          ))}
        </ul>
      ) : null}

      {/*
        ⚠ A DASHED RULE, NOT A SOLID ONE, AND THE DIFFERENCE IS THE CLAIM. The
        section's own top edge is solid (`border-t border-panel-border`, above)
        because it divides this readout from the one before it. This edge
        divides two kinds of statement INSIDE one readout, and a dashed rule is
        the repo's existing mark for a soft, provisional boundary
        (`DecisionPanel.tsx:227`, `OptionPanel.tsx:380`). Same token, same
        weight, different stroke — no new visual language.

        ⚠ THE RULE IS DRAWN ONLY WHEN THERE IS A VERDICT LINE TO DEMOTE BELOW.
        An all-unassessed run is reachable (no verdict + no robustness field +
        no evidence assessment), and there a rule would separate nothing from
        everything.
      */}
      {disclosures.length > 0 ? (
        <div
          className={
            verdicts.length > 0
              ? 'mt-2 pt-2 border-t border-dashed border-panel-border'
              : 'mt-1'
          }
          data-testid={`${testId}-scope`}
        >
          <ul className={CHIP_ROW}>
            {disclosures.map((item) => (
              <ChecksChip key={item.id} item={item} testId={testId} />
            ))}
          </ul>

          {/*
            ⚠ THE SENTENCES SIT BELOW THE ROW, NOT INSIDE THE CHIPS. Inline they
            would break the one-line scan that is the readout's whole value, and
            on a run where two checks were unassessed the row would wrap into a
            paragraph with glyphs in it. Below, the row stays scannable and the
            explanations read as prose.

            ⚠ AND THEY NOW TRAVEL WITH THE DISCLOSURE RATHER THAN WITH THE
            SECTION. Every meaning-bearing code is a `not_assessed` one — the
            copy deck's §7.5 rule, pinned in both directions by
            `whatWeChecked.spec.tsx` — so iterating the partition drops nothing.
            A sentence explaining an absence belongs under the rule that says an
            absence is what is being reported.
          */}
          {disclosures.some((i) => meaningFor(i)) ? (
            <ul
              className="mt-2 space-y-1 list-none p-0"
              data-testid={`${testId}-meanings`}
            >
              {disclosures.map((item) => {
                const meaning = meaningFor(item)
                if (!meaning) return null
                return (
                  <li
                    key={item.id}
                    className={`${typography.panelBody} text-text-light`}
                    data-testid={`${testId}-meaning-${item.id}`}
                  >
                    {meaning}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The one place a code becomes a sentence.
 *
 * ⚠ READ OFF THE COPY DECK BY CODE, never composed here and never selected by
 * `state`. Two codes share a state (`robustness_not_assessed` and
 * `robustness_unknown` are both `not_assessed`) and they say DIFFERENT things —
 * one is the producer stating it did not assess, the other is an older build
 * saying nothing at all. Keying on `state` would collapse them.
 */
function meaningFor(item: ChecksItem): string | undefined {
  const entry = COPY.checks[item.code]
  return 'meaning' in entry ? entry.meaning : undefined
}

function ChecksChip({ item, testId }: { item: ChecksItem; testId: string }) {
  const { Icon, colour } = GLYPH[item.state]
  const label = COPY.checks[item.code].label

  return (
    <li
      className="inline-flex items-center gap-1"
      data-testid={`${testId}-${item.id}`}
      data-check-state={item.state}
      data-check-code={item.code}
    >
      {/*
        ⚠ `aria-hidden` ON THE GLYPH, AND THE STATE CARRIED IN TEXT INSTEAD.
        The colour and the shape are the state for a sighted reader; a screen
        reader gets it from the label, which names the outcome in words on every
        code ("Has leading option", "Robustness not assessed"). An `aria-label`
        on the icon would say it twice.
      */}
      <Icon size={12} className={`${colour} flex-shrink-0`} aria-hidden="true" />
      <span>{label}</span>
    </li>
  )
}

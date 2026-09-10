/**
 * Reasoning tab — "Where these checks come from".
 *
 * The rendering half of `analysisNew/biasGrounding.ts`; the reachability
 * derivation, the payload witnesses and the four-bias-type correction live in
 * that module's header and are deliberately not restated here.
 *
 * ── WHAT THIS SURFACE IS FOR ────────────────────────────────────────────────
 *
 * `WhatWeChecked`, immediately above, says what the run looked at. This says
 * what the looking RESTS ON: the producer's own account of the effect, the
 * costed technique it prescribes, and the paper. It is the only place on this
 * tab where a sceptical reader can check the science against a citation rather
 * than take the product's word for it.
 *
 * ⛔ NOT A `SectionShell`, AND FOR THE SAME REASON `WhatWeChecked` IS NOT.
 * Paul's disclosure defaults are untouched here and 11 tests pin that shell.
 * A grounding readout behind a click is a grounding readout nobody reads, and
 * a citation only persuades where it is visible next to the claim it supports.
 * This is a strip, matching its sibling above line for line.
 *
 * ⚠ EVERY CLAIM-BEARING STRING IS THE PRODUCER'S, RENDERED VERBATIM. The only
 * words this file authors are the heading, "Try this", "Source: " and the
 * minutes sentence. Nothing here composes a mechanism, selects a technique or
 * matches a bias to a method: that mapping belongs to the producer, it arrives
 * with its citation attached, and synthesising a second one in the UI would put
 * an unattributed scientific claim on screen.
 */

import { typography } from '../../../../styles/typography'
import type { BiasGroundingItem } from '../biasGrounding'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

export interface BiasGroundingProps {
  items: readonly BiasGroundingItem[]
  testId?: string
}

export function BiasGrounding({
  items,
  testId = 'analysis-new-bias-grounding',
}: BiasGroundingProps) {
  /**
   * ⭐ A HEADING IS A CLAIM THAT THERE IS SOMETHING UNDER IT — the rule
   * `AnalysisNewSection` established after three bare headings shipped, and the
   * rule `WhatWeChecked` follows one section up. On a run where the producer
   * sent no bias findings, or sent findings carrying no grounding at all, the
   * honest render is no render. A heading with nothing beneath it would assert
   * that this analysis rests on literature it never named.
   */
  if (items.length === 0) return null

  return (
    <section
      className="border-t border-panel-border pt-3"
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
    >
      <h3
        id={`${testId}-heading`}
        // `panelHeader`, matching `WhatWeChecked` and the five SectionShell
        // headings on this tab. A section title rendered at `panelMeta` reads
        // smaller than its own body text — the defect #1179 fixed on the Model
        // tab and `WhatWeChecked` records at its own heading.
        className={`${typography.panelHeader} text-text-header mb-2`}
        data-testid={`${testId}-heading`}
      >
        {COPY.sections.biasGrounding}
      </h3>

      <ul className="space-y-3 list-none p-0 m-0">
        {items.map((item) => (
          <li key={item.id} data-testid={`${testId}-item-${item.id}`}>
            {/*
              THE PRODUCER'S MECHANISM, VERBATIM. It explains how the effect
              operates in general terms; it is not addressed to the reader and
              does not say the reader exhibits it.
            */}
            {item.mechanism ? (
              <p
                className={`${typography.panelBody} text-text-light m-0`}
                data-testid={`${testId}-mechanism-${item.id}`}
              >
                {item.mechanism}
              </p>
            ) : null}

            {item.steps.length > 0 ? (
              <div className="mt-1.5">
                <p
                  className={`${typography.panelMeta} text-text-header m-0`}
                  data-testid={`${testId}-trythis-${item.id}`}
                >
                  {COPY.biasGrounding.tryThis}
                </p>
                {/*
                  ⚠ AN ORDERED LIST BECAUSE THE PRODUCER SENT AN ORDER. The
                  steps arrive as a sequence and the second frequently depends
                  on the first having been done. Rendering them unordered would
                  quietly discard information the payload carries.
                */}
                <ol
                  className={`${typography.panelBody} text-text-light mt-0.5 mb-0 ps-4 space-y-0.5`}
                  data-testid={`${testId}-steps-${item.id}`}
                >
                  {item.steps.map((step, i) => (
                    <li key={`${item.id}-step-${i}`}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/*
              ⚠ THE TIME COST IS A SEPARATE LINE FROM THE STEPS, AND IT ONLY
              RENDERS WHEN THE PRODUCER COSTED THE TECHNIQUE. It is the reader's
              commitment, not ours, so it is never estimated here and never
              defaulted. `buildBiasGrounding` has already rejected zero,
              negative and non-numeric values.
            */}
            {item.estimatedMinutes !== null ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-1 m-0`}
                data-testid={`${testId}-minutes-${item.id}`}
              >
                {`About ${item.estimatedMinutes} ${item.estimatedMinutes === 1 ? 'minute' : 'minutes'}.`}
              </p>
            ) : null}

            {/*
              ⭐ THE CITATION IS THE WHOLE POINT OF THE SECTION, and it is
              printed exactly as the producer sent it. No linking, no
              reformatting into a house style, no truncation: a reference a
              reader cannot copy accurately is a reference they cannot check,
              and reformatting someone else's citation is how a wrong one gets
              attributed to us.
            */}
            {item.citation ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-1 m-0`}
                data-testid={`${testId}-citation-${item.id}`}
              >
                {COPY.biasGrounding.sourcePrefix}
                {item.citation}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

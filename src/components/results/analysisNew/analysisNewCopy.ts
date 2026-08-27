/**
 * Analysis (New) — every user-visible string on the experimental surface, in
 * one place, so the IA can be re-tuned without hunting through components.
 *
 * en-GB. Sentence case throughout: the Design System v5 guard forbids the
 * `uppercase` utility in `src/`, and small-caps section labels are not in the
 * panel scale. Section titles are `typography.panelHeader`.
 *
 * ⚠ WHAT IS *NOT* HERE, ON PURPOSE. No copy that asserts a finding. Every
 * sentence a user reads ABOUT their situation comes from the producer, verbatim
 * or formatted; this file holds only the furniture — section titles, disclosure
 * affordances and the honest empty states. If a string here ever starts
 * describing the analysis, that is the fabrication boundary being crossed.
 */

export const ANALYSIS_NEW_COPY = {
  /** The tab's own one-line frame. Names it as an experiment, not a product. */
  tabIntro:
    'A second reading of the same analysis run, laid out around the reasoning. Nothing here is re-computed.',

  sections: {
    atAGlance: 'At a glance',
    keyInsights: 'Key insights',
    strengthen: 'Strengthen the reasoning',
    drivers: 'Drivers and dynamics',
    uncertainty: 'Uncertainty and gaps',
    deeper: 'Deeper analysis and evidence',
  },

  /**
   * Empty states. Each one states what was NOT established, never a reassuring
   * positive. "No high-priority reasoning intervention identified yet" is a
   * fact about this run; "Your reasoning looks solid" would be a claim nobody
   * measured.
   */
  empty: {
    keyInsights: 'No insight is grounded well enough to lead with yet.',
    strengthen: 'No high-priority reasoning intervention identified yet.',
    drivers: 'This run did not return factor influence.',
    /** Used ONLY when the producer assessed evidence and found nothing. */
    uncertaintyAssessed: 'Nothing was flagged as consequentially uncertain on this run.',
    /** Used when the producer never assessed. Different fact, different words. */
    uncertaintyUnassessed: 'Evidence quality was not assessed on this run.',
  },

  /** Progressive-disclosure affordances. */
  disclosure: {
    expand: 'Show more',
    collapse: 'Show less',
    inspect: 'Inspect',
    /** Level-2 grounding prefix. Always followed by the producer signal name. */
    groundedIn: 'Grounded in',
    moreDrivers: (n: number) => `Show ${n} more`,
    moreUncertainty: (n: number) => `Show ${n} more`,
  },

  /** At a glance. Every string here is furniture — none describes the analysis. */
  glance: {
    whatMattersMost: 'What matters most',
    couldChangeIf: 'Could change if',
    /**
     * ⚠ THE BASIS CAPTION IS A TRUTH CLAIM, NOT A LEGEND, which is why it is
     * visible rather than hover-only. "Relative influence" says the bars rank
     * within THIS run; "Influence" says they sit on the producer's own scale.
     * A reader who mistakes the first for the second reads a rank as a share.
     */
    basisRelative: 'Relative influence',
    basisAbsolute: 'Influence',
    basisRelativeExplain:
      'Each bar is scaled against the strongest factor in this run, so the bars rank the factors against each other. They are not shares of the outcome.',
    basisAbsoluteExplain:
      "Each bar shows the producer's own structural influence score, scaled against the strongest factor in this run.",
  },

  markers: {
    provisional: 'Provisional',
    stale: 'From an earlier run',
    notAssessed: 'Not assessed',
  },

  status: {
    preRun: 'No analysis has run yet for this model.',
    running: 'Analysis is running.',
    /**
     * ⚠ SAYS THE MODEL MOVED, NOT THAT THE RESULT IS WRONG. A stale result is
     * the user's best available context and the Rerun control sits in the
     * shell's footer bar. Overstating this would make the honest thing to do
     * (keep reading) feel like an error state.
     */
    stale: 'The model has changed since this analysis ran.',
  },

  /**
   * Coverage disclosure. ⚠ THE ONE SENTENCE IN THIS FILE MOST LIKELY TO DRIFT
   * INTO A LIE. Incomplete coverage is NOT a readiness verdict and NOT a cause
   * of any ordering — `RunAdmission` owns readiness and nothing here speaks for
   * it. The wording states what was not covered and stops.
   */
  coverage: {
    someFactorsUnassessed: 'Some factors could not be assessed for this ranking.',
    /** Influence figures are set-relative, not a causal share of the outcome. */
    setRelativeInfluence:
      'Influence is relative to the other factors in this run, not a share of the outcome.',
    referencePrefix: 'Sensitivities are measured against',
  },

  /** Whole-decision value of information. Verdict only — the units are unsafe. */
  decisionVoi: {
    measuredNonZero: 'Resolving the open unknowns could still change this decision.',
    measuredZero: 'Resolving the open unknowns was measured as not changing this decision.',
  },
} as const

/**
 * The WHY line: the signal that fired, then why it matters now — rendered ONCE.
 *
 * `strengthen/buildRecommendations.ts:259-260` puts the producer's body on BOTH
 * fields by design (`signal: item.signal ?? item.body`, `whyNow: item.body`), and
 * a producer `signal` is carried today only on one deterministic nudge — so for
 * every other item, bias cards included, the two fields hold the SAME string.
 * That file's own comment records who was supposed to handle it: "The PANEL
 * dedupes display: an open row renders the body once, in full, never clamp +
 * full copy." The old panel does. This surface concatenated unconditionally and
 * printed the sentence twice (measured at the DOM: 413 characters for a
 * ~205-character sentence, while the same sentence appeared exactly once on the
 * old tab in the same DOM at the same moment).
 *
 * The dedupe belongs HERE, at the consumer that skipped the contract — not in
 * `buildRecommendations`, which is correct as written for a consumer that
 * dedupes. A producer that is right for its existing consumer must not be bent
 * to suit a new one.
 *
 * ⚠ EXACT equality, deliberately. A fuzzy or prefix match would be this
 * surface making a judgement about whether two producer strings "mean the same",
 * which is not a call it can make honestly. The measured defect is literal
 * identity; anything looser is a guess.
 */
export function strengthenWhyLine(signal: string, whyNow?: string): string {
  if (!whyNow || whyNow === signal) return signal
  return `${signal} ${whyNow}`
}

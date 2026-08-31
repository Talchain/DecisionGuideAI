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
    /**
     * ⚠ NAMES THE SECTION; ASSERTS NOTHING ABOUT THE RESULT. "How the options
     * compare" is furniture — it says what is behind the row. It deliberately
     * does NOT say "ranked", "best" or "in order": the list's ORDER is a
     * designation authored once upstream and WITHHELD on a run whose verdict
     * withholds the leader claim (`utils/optionDisplayOrder.ts`), so a title
     * asserting a ranking would make a claim the data may not carry on the very
     * run where it matters most.
     */
    options: 'How the options compare',
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
    /**
     * ⚠⚠ THE DRIVERS EMPTY STATE SPLITS THREE WAYS, AND COLLAPSING IT WAS A
     * LIVE FALSEHOOD. This sentence used to be the ONLY one, so a run whose
     * factors all came back with a producer `zero_reason` — i.e. the run DID
     * return influence and measured it at zero — was told the run returned
     * nothing, in the same words as a run that genuinely returned nothing.
     * The two states were indistinguishable on screen.
     *
     * TRUTH CONDITION: no factor row was returned at all, and the producer did
     * not say it skipped the analysis.
     */
    drivers: 'This run did not return factor influence.',
    /**
     * TRUTH CONDITION: at least one factor row WAS returned and every returned
     * row carries a producer `zero_reason`.
     *
     * The zero-ness is the PRODUCER's, not this adapter's inference:
     * `types.ts:1081` defines the codes as "explains why influence is ZERO for
     * intervention factors", so a row bearing one is a row the producer scored
     * at zero. `intervention_override`, `disconnected` and `zero_outcome_diff`
     * differ in WHY, and this sentence deliberately does not characterise the
     * why — the per-row badges (`DriversSection.ZERO_REASON_BADGE_LABELS`) own
     * that, and three reasons cannot share one summary without one of them
     * being described wrongly.
     */
    driversAllZero: 'This run returned factor influence, and every factor came back at zero.',
    /**
     * TRUTH CONDITION: `driversStatus === 'skipped'` — the producer's own word
     * for "I did not look". Distinct from 'unavailable'/'error', which mean it
     * tried and we have nothing, and which keep the sentence above.
     */
    driversNotComputed: 'Factor influence was not computed for this run.',
    /** Used ONLY when the producer assessed evidence and found nothing. */
    uncertaintyAssessed: 'Nothing was flagged as consequentially uncertain on this run.',
    /** Used when the producer never assessed. Different fact, different words. */
    uncertaintyUnassessed: 'Evidence quality was not assessed on this run.',
  },

  /**
   * Recording a disagreement.
   *
   * ⚠ THESE ARE NOT DISMISSAL STRINGS AND MUST NEVER BE FOLDED INTO THEM.
   * "Not relevant" says this finding does not apply to me; "I disagree" says
   * this finding is wrong, and here is why. The first retires the card, the
   * second keeps it and attaches a position to it. One name for both is how
   * the product ended up offering only deletion.
   */
  dissent: {
    open: 'I disagree',
    edit: 'Edit what you said',
    /** Placed on the textarea. States what happens, so saving is not a guess. */
    prompt: 'Why? This stays on the card.',
    save: 'Record this',
    cancel: 'Cancel',
    /** Prefix on the standing objection. The user's own words follow. */
    standing: 'You disagreed',
  },

  /** Progressive-disclosure affordances. */
  disclosure: {
    expand: 'Show more',
    collapse: 'Show less',
    inspect: 'Inspect',
    /** Level-2 grounding prefix. Always followed by the producer signal name. */
    groundedIn: 'Grounded in',
    moreDrivers: (n: number) => `Show ${n} more`,
    /**
     * ⚠ NAMED APART, for the reason the note below `moreUncertainty` gives.
     * This one answers "more ways to strengthen the reasoning" — a set of
     * recommended MOVES, not a set of findings. Identical string today; a
     * later edit to either must not silently speak for the other.
     */
    moreStrengthen: (n: number) => `Show ${n} more`,
    moreUncertainty: (n: number) => `Show ${n} more`,
    /**
     * ⚠ NAMED APART FROM `moreUncertainty` ABOVE THOUGH THE STRING IS THE SAME
     * TODAY. They answer different questions — "more uncertainties" vs "more
     * options the run left out" — and folding them into one constant is how a
     * later edit makes one speak for a set it does not describe (CLAUDE.md trap
     * 21). Same words, different claims.
     *
     * (`moreDrivers` is a THIRD constant here but not the same shape: it is a
     * DECLARATION, not a control's label, and its string already differs.)
     *
     * ⚠ ACCURACY NOTE, since the first version of this comment said "three
     * different questions": `moreUncertainty` currently has ZERO call sites
     * repo-wide, so it answers none. It is kept rather than deleted because the
     * uncertainty list has the same overflow shape, but do not read this
     * grouping as evidence that all three are live.
     */
    moreExcluded: (n: number) => `Show ${n} more`,

    /**
     * The excluded options this list cannot name.
     *
     * ⚠ NEUTRAL, AND IT REPORTS OUR LIMIT RATHER THAN BLAMING THE OPTION. An
     * option is unnameable here because its label is blank or is merely its own
     * node id — a gap in what reached us, not something the user did. "No name
     * recorded" states that without inventing "Untitled option", which is the
     * fabrication `deriveComparisonScope` exists to refuse.
     *
     * It exists so the list ADDS UP to the count the scope sentence states.
     */
    unnamedExcluded: (n: number) =>
      n === 1 ? '1 more with no name recorded' : `${n} more with no name recorded`,

    /**
     * The options the COMPARISON LIST cannot name.
     *
     * ⚠ NAMED APART FROM `unnamedExcluded` ABOVE, THOUGH THE STRING IS THE SAME
     * TODAY, AND THE TWO ANSWER DIFFERENT QUESTIONS (CLAUDE.md trap 21).
     * `unnamedExcluded` counts options LEFT OUT OF THE COMPARISON whose label
     * did not reach us; this counts options of ANY analysis state — analysed
     * ones included — that the comparison list drops for the same reason. An
     * edit to either must not silently speak for the other set.
     *
     * Like its sibling it reports OUR limit rather than blaming the option, and
     * it exists so the collapsed row's count and the body's rows ADD UP.
     */
    unnamedOptions: (n: number) =>
      n === 1 ? '1 more with no name recorded' : `${n} more with no name recorded`,
  },

  /** At a glance. Every string here is furniture — none describes the analysis. */
  strengthen: {
    /** Chip text when the producer attested grounding but named no strength. */
    groundedChip: 'Decision science',
  },

  /**
   * "Your model so far" — the per-node detail.
   *
   * ⚠ EVERY STRING HERE IS FURNITURE OR AN ABSENCE, AND THERE IS NO THIRD KIND.
   * What a node's detail SAYS about the model is the engine's own `title` and
   * `tryThis` rendered verbatim; this file supplies the affordance wording and
   * the sentence for when there is nothing. There is deliberately no reassuring
   * positive — "this node looks fine" is a claim nothing measured, and it is
   * exactly the sentence a panel like this drifts towards.
   */
  modelStrip: {
    /**
     * The affordance, stated once above the marks. It describes the CONTROL,
     * never the model, and it is what makes the marks discoverable at all — a
     * 12px shape whose accessible name lives in a screen-reader span otherwise
     * announces itself to nobody using a mouse.
     */
    hint: 'Pick a mark to see what this analysis says about it, and to show it on the canvas.',
    /**
     * ⚠ SCOPED TO THIS PANEL, AND THE SCOPE IS THE HONESTY. The index behind
     * the detail is built from exactly two lists — the glance's drivers and the
     * engine's interventions — so "this panel" is the largest true subject.
     * "No finding names this node" would be a claim about the RUN, and the run
     * holds findings this panel has already filtered (dismissed ones) and
     * capped.
     */
    noInsight: 'Nothing else on this panel refers to this node.',
    /** Disclosure of the per-node finding cap. Never silent truncation. */
    moreFindings: (n: number) => `+ ${n} more finding${n === 1 ? '' : 's'} for this node`,
    /**
     * Singular node-kind nouns for the detail heading.
     *
     * ⚠ A MIRROR OF `MARK_KINDS`, AND IT IS PINNED BY A TEST for that reason —
     * a kind added to `nodeMarks.tsx` without a noun here would render a
     * heading with a missing word rather than failing loudly (CLAUDE.md
     * trap 12). The row labels above are the plural forms and are NOT reusable
     * for one node.
     */
    kindNoun: {
      option: 'Option',
      factor: 'Factor',
      risk: 'Risk',
      outcome: 'Outcome',
    } as Record<string, string>,
  },
  glance: {
    /** Eyebrow above the answer on a CURRENT run. */
    eyebrowLeading: 'Leading option',
    /**
     * Eyebrow above the answer on a STALE run. The present tense belongs to the
     * run, not to now: `headline` is composed as "…currently scores higher",
     * which is a claim about the CURRENT model and false once the model moved.
     */
    eyebrowStale: 'As last analysed',
    whatMattersMost: 'What matters most',
    couldChangeIf: 'Could change if',
    /** ⚠ Declares the glance's own cap. See `AtAGlance`'s driver overflow. */
    moreDrivers: (n: number) => `+ ${n} more driver${n === 1 ? '' : 's'} in this run`,
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
    /**
     * ⚠ SAYS WHAT THE PANEL IS, AND ASSERTS NO RUN. `tabIntro` cannot serve
     * pre-run — it says "a second reading of the same analysis run", which is
     * false when none has happened, and it shipped sitting directly above the
     * sentence saying so. This is the orientation without the assertion.
     */
    preRunWhatThisIs:
      'When one has, this panel reads it back around the reasoning: what to notice, how to strengthen it, what is driving it, and what is still uncertain.',
    running: 'Analysis is running.',
    /**
     * ⚠ SAYS THE MODEL MOVED, NOT THAT THE RESULT IS WRONG. A stale result is
     * the user's best available context and the Rerun control sits in the
     * shell's footer bar. Overstating this would make the honest thing to do
     * (keep reading) feel like an error state.
     */
    stale: 'The model has changed since this analysis ran.',
    /**
     * ⚠ COVERAGE, NOT READINESS. Says the RESULT is incomplete; never that
     * analysis may not run — `RunAdmission` owns readiness and this surface
     * does not speak for it.
     *
     * ⚠ NOT THE SAME STRING AS `markers.provisional`, AND DELIBERATELY SO.
     * `markers.provisional` ('Provisional') is a ROW-LEVEL badge, consumed by
     * `DisclosureRow`, that qualifies one value. This is a SURFACE-LEVEL
     * statement about the whole run. Two different claims at two different
     * levels: naming them apart is what stops a later reader folding them into
     * one and making the badge speak for the run (CLAUDE.md trap 21).
     */
    provisional: 'This analysis is partial — some results are missing.',
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
    /**
     * ⚠⚠ THIS SENTENCE ANSWERS TO A CEILING IT DOES NOT OWN, AND IT BREACHED IT.
     *
     * It shipped as 'Resolving the open unknowns could still change this
     * decision.' The verdict behind it is `readDecisionVoi` in
     * `../voi/decisionVoi.ts` — `Number.isFinite(raw) && raw !== 0` — and that
     * module's register (`../voi/resolveNextCopy.ts`) documents in terms what
     * the verdict does NOT license: `decision_evpi` arrives with no noise
     * floor, no CI and no `n_samples`, so a small positive value is not
     * distinguishable from estimator noise. "Could still change this decision"
     * is exactly the significance claim that ceiling forbids.
     *
     * The wording below is the owner's own LICENSED framing — the absence of a
     * zero measurement, attributed to the whole decision rather than to the
     * factors listed above it. It is deliberately NOT `RESOLVE_NEXT_COPY
     * .decisionNotZero` verbatim: that sentence's second half scopes a
     * per-factor RANKING which does not exist on this surface, so importing it
     * would import a claim about something not on screen.
     *
     * Guarded by `__tests__/analysisNewCopyCeiling.spec.ts`, which imports the
     * ceiling from the owner rather than restating it.
     */
    measuredNonZero:
      'Measured for the decision as a whole, this run did not come back at zero.',
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

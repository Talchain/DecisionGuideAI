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

import { GOAL_ANCHOR_COPY } from '../utils/goalAnchorCopy'

/**
 * Stands in for a label that cannot be safely interpolated into a generated
 * sentence — blank, a bare node id, or one carrying a banned glossary term.
 * `safeInterpolatedLabel` is the shared guard; this is what it falls back to.
 */
/**
 * The estate's one list joiner. `Intl.ListFormat` is already this repo's answer
 * for prose lists (`OptionPreview.tsx:439`); reusing it means the en-GB comma
 * rules have one owner rather than two, and it is correct at every arity —
 * which a `.join(', ')` is not, as the partial-result ribbon proved on a
 * deployed build.
 */
type ConjunctionListFormat = {
  format: (items: readonly string[]) => string
}

/**
 * ⚠ TYPED LOCALLY, AND NOT BECAUSE `Intl.ListFormat` IS EXOTIC. This repo's
 * `lib` does not declare it, so the ambient `Intl` type has no `ListFormat` —
 * the estate's other call site (`OptionPreview.tsx:439`) reaches for it anyway
 * and carries the resulting error as BASELINED DEBT. Adding a third instance of
 * that debt to close a defect would be trading one silent wrong for another,
 * so the capability is declared once, here, with the reason attached.
 *
 * The runtime has had it since Node 14 / every browser we support; the gap is
 * purely in the compiler's view of the platform.
 */
/**
 * ⚠ BUILT LAZILY, NOT AT MODULE SCOPE. Constructing it on import means an
 * environment without `Intl.ListFormat` throws during IMPORT — which no
 * `SectionErrorBoundary` can catch, so the whole chunk goes rather than one
 * section. The estate's other call site builds it at render, which is
 * catchable. Support is universal in practice; the asymmetry was still worth
 * removing, and review named it.
 */
let conjunctionList: ConjunctionListFormat | null = null
function getConjunctionList(): ConjunctionListFormat {
  conjunctionList ??= new (
    Intl as unknown as {
      ListFormat: new (
        locale: string,
        options: { style: 'long'; type: 'conjunction' },
      ) => ConjunctionListFormat
    }
  ).ListFormat('en-GB', { style: 'long', type: 'conjunction' })
  return conjunctionList
}

/**
 * The estate's one prose-list joiner: `A`, `A and B`, `A, B and C`.
 * Exported so a second consumer reuses it rather than minting a second parser
 * for the en-GB comma rules — the drift this panel has already paid for once.
 */
export function formatConjunctionList(items: readonly string[]): string {
  return getConjunctionList().format(items)
}

const MISSING_LIST = { format: (items: readonly string[]) => getConjunctionList().format(items) }

/**
 * Capitalises a leading letter so a list can OPEN a sentence.
 *
 * `missingResultLabels` are written lowercase because they were composed
 * mid-sentence, behind a dash. Splitting the ribbon into two sentences (no em
 * dashes in product content, Paul, 10 Sep 2026) moves them to the front of the
 * second one. Only the first character is touched, so `missingResultLabels`
 * stays the single owner of what each result is CALLED and no label is
 * duplicated here in a different case.
 */
const sentenceCase = (s: string): string =>
  s === '' ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`

/**
 * The coverage warning with no names in it. Held as a const because
 * `provisionalNaming` falls back to it: the guarantee "an empty list never
 * emits a sentence fragment" then belongs to the STRING, not to its one
 * call site, and survives a second caller.
 */
const PROVISIONAL_UNNAMED = 'This analysis is partial. Some results are missing.'

export const ANALYSIS_NEW_LABEL_FALLBACK = 'This option'

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
    /**
     * ⚠ NAMES THE SECTION; ASSERTS NOTHING. It does not say "they disagree" —
     * the same title stands over the aligned and the needs-target states.
     */
    implications: 'What your model implies',
    keyInsights: 'Key insights',
    strengthen: 'Strengthen the reasoning',
    drivers: 'Drivers and dynamics',
    /**
     * ⭐⭐ THE SECTION NAME IS THE READER'S QUESTION, NOT THE PRODUCER'S
     * CATEGORY. "Sensitive assumptions" is what the analysis calls these;
     * "What would change your mind" is what the reader is asking when they get
     * to them, and it is the only heading on this panel that names a question
     * rather than a container.
     *
     * ⚠ NOT "What could change the outcome" — the outcome is a number, and a
     * changed number is not a changed decision. These rows name the option that
     * would WIN INSTEAD, so the claim is about the DECISION, and the heading
     * says so.
     */
    sensitivity: 'What would change your mind',
    uncertainty: 'Uncertainty and gaps',
    deeper: 'Deeper analysis and evidence',
    /**
     * ⚠ NAMES THE CHECKS, ASSERTS NOTHING ABOUT THEIR OUTCOME. "What we
     * checked" stands unchanged over a run that passed everything and over one
     * that checked nothing — which is the point, because the second is the run
     * this section exists for.
     *
     * Imported VERBATIM from the old tab (`TriageActionCardsBody.tsx:702`).
     * A second wording for one readout is how a user learns that two surfaces
     * mean different things by it.
     */
    checks: 'What we checked',
  },

  /**
   * ⭐ WHAT IS BEHIND EACH COLLAPSED DETAIL ROW.
   *
   * The design pack draws a subtitle on every one of its three collapsed rows,
   * and these are its words. A title plus a count is a container name and a
   * number; the subtitle is the part that tells a reader whether the row is
   * worth a click.
   *
   * ⚠ FURNITURE, ASSERTING NOTHING. Each says what KIND of thing is inside, and
   * stays true of a row that turns out to be empty — which these rows can be.
   * "The findings this run leads with" would be a claim, and false on a run that
   * produced none; "what this run could not settle" is a description of the
   * container and holds either way.
   *
   * Only the three DETAIL rows get one. They sit together at the foot of the
   * panel as the drawer a reader opens for method and receipts; the sections
   * above are content, not a drawer, and a subtitle there would be decoration.
   */
  sectionSubtitles: {
    drivers: 'What moves the outcome, and through what',
    uncertainty: 'What this run could not settle',
    deeper: 'Method, provenance and receipts',
  },

  /**
   * Empty states. Each one states what was NOT established, never a reassuring
   * positive. "No high-priority reasoning intervention identified yet" is a
   * fact about this run; "Your reasoning looks solid" would be a claim nobody
   * measured.
   */
  /**
   * ⭐ WHAT YOUR MODEL IMPLIES — the two readings.
   *
   * ⚠⚠ ONE CLAIM IS DELEGATED AND ONE IS AUTHORED, AND THE ASYMMETRY IS FORCED.
   * `goalClaim` returns `GOAL_ANCHOR_COPY`'s own sentence — the shared owner
   * that the retiring hero's copy ALSO delegates to, so both surfaces print one
   * wording of that claim and cannot drift.
   *
   * `outcomeClaim` has no shared owner. Its only prior authoring lives inside
   * `analysis-hero`, which an allow-list guard forbids this tab from importing
   * (the module is being retired and must stay deletable). So the sentence is
   * authored here. That is a genuine, KNOWN duplication of one claim across two
   * surfaces, and it is the sanctioned choice rather than an oversight: the
   * estate has already decided this tab must not depend on that module, and the
   * duplication ends when the hero is deleted. If the outcome claim ever needs a
   * second live consumer before then, the fix is to promote it to
   * `results/utils/`, NOT to import it from either surface.
   *
   * This file's standing rule — "no copy that asserts a finding; every sentence
   * a user reads ABOUT their situation comes from the producer, verbatim or
   * formatted" — holds: the framing below is furniture, and both claim sentences
   * carry only a producer label and a producer number, formatted by the shared
   * formatters.
   */
  implications: {
    /**
     * The lead-in for the diverged state.
     *
     * ⚠ IT DOES NOT SAY "the model is unsure", AND THAT IS THE WHOLE POINT.
     * Divergence is not low confidence and it is not a defect in the run: both
     * readings are well-founded, they answer different questions, and they
     * happen to point at different options. Framing it as uncertainty would
     * teach the reader to discount it, when it is the single most decision-
     * relevant thing this run has to say.
     */
    divergedLead: 'Two defensible readings of this run point at different options.',
    /**
     * The diverged state's close. Names the judgement as the USER'S — Olumi
     * does not adjudicate between the two readings, because which one matters
     * more is a question about the team's appetite, not about the numbers.
     */
    divergedResolve:
      'Which reading matters more is a judgement about your appetite for risk, not a result this run can settle.',
    /** The aligned state. Agreement across two different questions is evidence. */
    alignedLead: (label: string): string =>
      `${label} is most likely on both readings of this run.`,
    alignedResolve:
      'The two readings agree, so the choice does not hinge on which one you weight.',
    /**
     * ⭐ THE UNLOCK, FRAMED AS REASONING RATHER THAN HOUSEKEEPING.
     *
     * "Set a success target" alone reads as a form field somebody forgot. What
     * a target actually buys is a SECOND, INDEPENDENT WAY TO READ THE SAME RUN
     * — one that can disagree with the first and change the decision. The
     * sentence says that, so the user can decide whether the second reading is
     * worth having rather than complying with a prompt.
     *
     * ⚠ AND IT PROMISES ONLY WHAT IT CAN DELIVER: it says a target WOULD add a
     * second reading, never that the two would disagree. Whether they diverge is
     * not knowable before the target exists, and promising a divergence that
     * then does not appear would be a fabricated expectation.
     */
    needsTargetLead: 'Only one reading of this run is available.',
    needsTargetUnlock:
      'Set a success target and the same run also answers which option is most likely to hit it. That second reading can disagree with this one.',

    /**
     * READING ONE — the highest expected outcome.
     *
     * ⚠ "EXPECTED OUTCOME" IS LITERALLY TRUE HERE, AND THAT IS LOAD-BEARING.
     * The number is `getExpectedValue`, which is the MEAN and explicitly refuses
     * to fall back to the median. A surface that blends mean and median into one
     * "centre" may say "centre"; only one reading the mean may say "expected".
     */
    outcomeClaim: (label: string, readout: string): string =>
      `${label} has the highest expected outcome: ${readout}.`,

    /**
     * READING TWO — the highest chance of meeting the user's target. DELEGATED
     * to the shared anchor, which is also what the hero's own copy calls.
     *
     * ⚠⚠ THE `true` IS NOT A PLACEHOLDER — IT IS THE WORDING TRUE IN BOTH CASES,
     * and it is the same argument `HERO_COPY.headline.goalOnly` passes.
     * The producer collapses two situations into one `goalProbability` and sends
     * NO discriminator: with no user constraints PLoT synthesises one from the
     * goal threshold, so the figure IS goal attainment; with constraints present
     * it discards the goal threshold and the figure is the JOINT probability, so
     * "your goal" would be false. "every target this run scored" is true either
     * way. Asserting the possessive would be a claim the contract cannot support,
     * and sniffing another service's internal constant to tell the cases apart is
     * the hand-maintained mirror this estate keeps paying for (trap 12).
     */
    goalClaim: (label: string, readout: string): string =>
      `${GOAL_ANCHOR_COPY.headline(label, readout, true)}.`,
  },

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
    /**
     * ⚠⚠ REPLACES `driversAllZero`, WHICH ASSERTED A ZERO THE PRODUCER NEVER
     * MEASURED. It read "This run returned factor influence, and every factor
     * came back at zero." — said whenever `suppressedZeroCount > 0` and nothing
     * survived to be ranked, i.e. for ALL THREE `zero_reason` codes.
     *
     * `intervention_override` is not a zero. Measured on
     * `conditional-winners-2026-08-17-probe-A.json`, a capture already in this
     * repo: both rows carry `zero_reason: 'intervention_override'` with
     * `influence_score` 1 and 0.556 at ranks 1 and 2 — the two STRONGEST
     * factors in the run — and the reader was told every factor came back at
     * zero. The caveat one line above named the real reason ("Controlled by
     * your options") in the same breath, so the panel contradicted itself on
     * one screen.
     *
     * ⚠ HOW OFTEN THIS HAPPENS IS NOT MEASURED, AND THE TWO OBVIOUS ADJECTIVES
     * ARE BOTH WRONG. What IS measured: **1 of 26 driver lists** carrying
     * `zero_reason` across the capture fixtures under `src/` is all-suppressed
     * (the other 25 are partial). ⚠ THAT IS A NUMBER ABOUT THE CORPUS, NOT A
     * SAMPLE OF USER RUNS — the fixtures were collected for other reasons and
     * nobody has measured how often a user meets this state.
     *
     * The MECHANISM, marked as mechanism rather than observation: a factor the
     * user pins is SET rather than learned, so contributing no outcome
     * variance is the expected consequence and not a defect. That explains
     * both captures we hold without counting either, so it licenses no
     * frequency claim in either direction. Calling the state "rare" or
     * "ordinary" would swap one unmeasured frequency for another, and
     * "ordinary" is the more dangerous, because it licenses design decisions
     * that "rare" does not.
     *
     * ⚠ THIS FILE ALREADY STATED THE RULE AT THE CONSTANT THAT BROKE IT:
     * "three reasons cannot share one summary without one of them being
     * described wrongly". So the summary is gone and the producer's own reason
     * labels carry the meaning — the same `ZERO_REASON_BADGE_LABELS` the
     * exclusion clause and the Drivers panel badges already use, so there is
     * one spelling of each reason across the surface.
     *
     * The distinction `driversAllZero` existed to protect SURVIVES: "returned
     * and set aside" is still audibly different from `drivers`, which says the
     * run did not return factor influence at all.
     */
    noneRanked: (n: number, reasons: readonly string[]) =>
      `No factor is ranked in this run. ${n === 1 ? '1 factor was' : `${n} factors were`} returned and set aside: ${reasons.join('; ')}.`,
    /**
     * ⚠ FAIL-CLOSED SIBLING. `suppressedZeroCount` and `suppressedZeroReasons`
     * move together by construction, but the count is not what a sentence
     * naming reasons can be written from — a non-empty count with an empty
     * reason list would render "... set aside: ." This states only the half
     * that is always true. Same order of reasoning as `driversCaveat`.
     */
    noneRankedUnexplained: 'No factor is ranked in this run.',
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
    prompt: 'Why? This stays on the card in this browser.',
    notSaved: 'Not saved for next time. Your words are still here. Retry, or copy them before leaving.',
    sessionOnly: 'Kept in this tab only.',
    scenarioChanged: 'The model on screen changed. Your words have not been saved to it. Copy them or return to the original model before retrying.',
    save: 'Record this',
    cancel: 'Cancel',
    /** Prefix on the standing objection. The user's own words follow. */
    standing: 'You disagreed',
    /**
     * ⚠ SHOWN ONLY WHEN THE RUN IS KNOWN TO HAVE MOVED, NEVER FROM AN ABSENCE.
     *
     * A disagreement now outlives the session, so it can be read beside a LATER
     * analysis than the one it was written against — a claim the user never
     * made. `dissentCurrency` answers three ways, and this renders on `changed`
     * alone: a record with no run stamp (written before stamping existed, or on
     * a run whose hash could not be established) is `unknown`, and saying "an
     * earlier analysis" about a record we cannot place would be inventing a fact
     * on the surface whose whole job is not to.
     *
     * ⚠ NOT `COPY.status.stale`. That sentence — "The model has changed since
     * this analysis ran." — is about the ANALYSIS being out of date. This is
     * about WHEN THE WORDS WERE WRITTEN. Reusing it verbatim would say the
     * wrong thing in the user's own voice.
     */
    writtenEarlier: 'Written against an earlier analysis.',
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

  /**
   * PANEL → CANVAS. The strings that describe an ACT, never a finding.
   *
   * ⚠ THE ACCESSIBLE NAME IS THE ONLY CARRIER OF THIS AFFORDANCE, AND THAT IS
   * WHY IT IS A REAL STRING RATHER THAN A `title`. The old Analysis tab states
   * the same contract in a `Tooltip` on a card that is focusable ONLY when a
   * flag is on (`OptionCards.tsx:720-721` — `tabIndex={onClick ? 0 : undefined}`),
   * so with the flag off the sentence is reachable by mouse hover and by
   * nothing else. Keyboard and touch users are told nothing at all. Here the
   * row is always focusable and the sentence is its `aria-label`.
   */
  canvas: {
    /**
     * What activating an option row does, per row, with the option NAMED.
     *
     * ⚠ "Show … on the canvas" — NOT "open the inspector", which is what the
     * old tab's tooltip promises. That promise is not kept anywhere: the click
     * handler it sits beside toggles a graph LENS (`OptionCards.tsx:1444`
     * → `handleLensClick`), and the estate's actual inspector helper
     * (`openNodeInspector`) is not on that path — `OptionCards.tsx:1084-1098`
     * says so in its own comment. Copying the sentence across would have
     * imported a false promise into a second surface.
     */
    focusOption: (label: string) => `Show ${label} on the canvas`,
    /**
     * Fail-closed notice when the option's node is no longer on the canvas —
     * a recovered session with different ids, or a node deleted between render
     * and click (`decisionVerdict.spec.ts:156` pins that this happens).
     *
     * ⚠ VERBATIM THE ESTATE'S EXISTING SENTENCE for this exact condition
     * (`strengthen/strengthenCopy.ts:51` `focusFailedNotice`, and
     * `AskOlumiDrawer.tsx:151`). A third wording for one condition is how a
     * user learns that two surfaces mean different things by it.
     */
    focusFailed: 'That element is no longer on the canvas',
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
  /**
   * The influence chart's axis and its non-directional state.
   *
   * ⚠ "Lowers"/"Raises" NAME THE EFFECT ON THE GOAL, not on the factor. The
   * producer's `direction` is documented as "'positive' = increases goal", so
   * a cost factor whose direction is negative LOWERS the goal — which is the
   * distinction the old chart loses by branching on goal direction instead.
   */
  driverChart: {
    lowers: 'Lowers the goal',
    raises: 'Raises the goal',
    /**
     * ⚠⚠ THE SCALE, AND IT IS DELIBERATELY NOT A PERCENTAGE.
     *
     * The bars are scaled to the STRONGEST DRIVER IN THIS RUN
     * (`buildAnalysisNewViewModel.ts:558/565`), never to a sum and never to 1.0
     * — the builder's own comment states why: scaling to a sum would render
     * each bar as a SHARE OF THE OUTCOME, "a claim neither basis licenses".
     *
     * So an axis reading 0%–100% would be exactly the unlicensed claim, dressed
     * as a courtesy to the reader. What the outer edge actually means is "the
     * strongest driver this run found", and what the centre means is "no effect
     * on the goal". Naming those two points is the whole scale, and it is the
     * only scale the data supports.
     *
     * Witnessed by Paul on deployed `a9c2e050`: the chart gave direction with no
     * reference point, so a bar's position and length were unreadable.
     */
    axisCentre: 'no effect',
    /**
     * ⚠⚠ TWO ENDPOINTS, TWO NAMES. Both ends read `'strongest this run'` until
     * `e15416ad` — the SAME THREE WORDS at opposite poles of a diverging scale,
     * witnessed in the founder captures on staging `acd3db4d`. The geometry was
     * correct and remains untouched: bars extend from the centre and the side
     * is the direction. Only the labels could not be told apart, so the scale
     * discriminated nothing and the reader had to infer the poles from the
     * legend above it.
     *
     * ⚠ WHAT THE ENDPOINT IS CALIBRATED TO, stated here because the wording no
     * longer says it: `buildDrivers` scales every bar to
     * `Math.max(...live.map(magnitude))` — the strongest driver in the run
     * REGARDLESS OF DIRECTION — so both poles sit at the same magnitude and an
     * end is reached only by a bar of that magnitude pushing that way. "Most"
     * is therefore the honest word for the pole and a percentage is not: see
     * `axisCentre`'s note for why a 0-100% axis would assert a share of the
     * outcome that neither basis licenses.
     *
     * ⚠ THE VERBS ARE THE LEGEND'S. `lowers` / `raises` above name the effect
     * ON THE GOAL, and these two must keep agreeing with them — a scale whose
     * poles contradict the legend directly above it is worse than one that
     * repeats itself. `driversSeamSaysOneThing.spec.tsx` pins the agreement
     * rather than trusting this note.
     */
    axisEdgeLowers: 'lowers most',
    axisEdgeRaises: 'raises most',
    /**
     * ⚠ NOT "no direction" AND NOT SILENCE. `mixed` and `unknown` are results:
     * the producer measured the factor and declined to assert one direction.
     * "Direction not established" says that; "no direction" would report an
     * absence of effect that was never measured.
     */
    directionNotEstablished: 'Direction not established',
    /**
     * The section header for the chart. It names the QUESTION the chart answers.
     *
     * ⚠⚠ THIS COMMENT USED TO SAY THE GLANCE'S BARS ANSWERED A DIFFERENT
     * QUESTION — "those rank the top three by size; this one says which way each
     * pushes". THE SECOND HALF WAS TRUE AND THE FIRST WAS TRUE OF BOTH, which is
     * how one ranking came to be rendered twice on one scroll. Derived at
     * `e15416ad`: `glanceDrivers` and `buildDrivers` read the same
     * `data.drivers.drivers`, apply the same `zeroReason` filter, take the same
     * `displayInfluence` magnitude and divide by the same within-run maximum.
     * The glance's list was a strict subset of these rows carrying a strict
     * subset of this information. It has been removed; this is the one
     * rendering. A false comment is what let the duplication read as a decision.
     */
    title: 'Which way each driver pushes',
  },
  heldUp: {
    /**
     * ⚠ "HELD UP", NOT "LOOKS GOOD" AND NOT "READY TO DECIDE". The producer
     * tested the model and it did not break — that is a statement about the
     * MODEL under testing, not a verdict on the decision, and certainly not
     * permission. The verb is the strongest honest one available.
     */
    title: 'Your model held up under testing',
    /**
     * ⚠⚠ SAID IN THE SAME BREATH AS THE GOOD NEWS, never behind a disclosure.
     * This is the moment the surface is most likely to be read as absolution,
     * and the product's first principle is that humans remain the authors.
     */
    limit: 'That is a result about the model, not about the decision. What it assumes is still yours to judge.',
    /**
     * ⚠⚠ `record` WAS HERE AND HAS BEEN MOVED TO `decisionRecord.open` — the
     * banner no longer carries the act. Superseded text: ~~record: 'Record what
     * you decided, and why'~~.
     *
     * This block answers "did this model hold up?"; recording a decision
     * answers "may I write down what we chose?". Hanging the second off the
     * first made the act reachable ONLY on a run that held up, which is exactly
     * backwards — a fragile or mixed result is when writing down your reasoning
     * matters most. Two questions under one predicate (CLAUDE.md trap 21), and
     * the cost was the whole ACT half of the panel on every run but the rare
     * clean one. The banner keeps its predicate and its congratulation; the act
     * now stands on its own, gated only on a run existing.
     */
  },
  /**
   * ⭐⭐ THE ACT — the panel's other terminal state, and the half that was
   * unserved. Everything above this reads the model; this is the only place the
   * team writes down what they are going to DO about it, and the only place a
   * later session can read that back.
   *
   * ⚠⚠ EVERY SENTENCE HERE IS SCOPED TO THE SCENARIO, NEVER TO THE RUN.
   * `useDecisionRecordForScenario` keys on `currentScenarioId` and nothing
   * else — it cannot tell whether the record was captured against the analysis
   * currently on screen or an earlier one. So the copy says "for this
   * scenario", which is exactly what the selector licenses. "For this run"
   * would be a claim about an anchor comparison this surface does not make.
   *
   * ⚠⚠ AND WHERE THE RECORD LIVES IS NEVER INFERRED FROM WHY. `remote === null`
   * licenses one statement — that there is no record id, so no account claim.
   * It does NOT license naming a cause: the store's own contract lists three
   * (guest, offline, a failed commit), and a signed-in user whose commit failed
   * would be told to sign in. So `storedLocal` states the FACT and stops.
   */
  decisionRecord: {
    /**
     * The door. Carried over verbatim from `heldUp.record`, where it was gated
     * on the model having held up.
     */
    open: 'Record what you decided, and why',
    /**
     * ⚠ A FACT ABOUT STATE, NOT A STANDING EXPLANATION. This is the negative
     * half of a pair — it flips to the read-back the moment a record exists —
     * so it earns the line the P2 ruling would otherwise deny it. A sentence
     * telling the reader WHY recording is worthwhile would be identical on
     * every instance forever, which is the definition of furniture.
     */
    none: 'Nothing recorded for this scenario yet.',
    /** The read-back heading. */
    recorded: 'Decision recorded',
    /** The modal prefills from the existing record, so this genuinely edits. */
    update: 'Update this record',
    confidenceLabel: 'Confidence',
    expectationLabel: 'Expected',
    rationaleLabel: 'Because',
    assumptionLabel: 'Assumption to watch',
    revisitLabel: 'Revisit',
    /**
     * ⚠ "of 100", NOT "%". The capture field is labelled "Confidence, 0–100"
     * and the producer is the user's own typed number. Rendering it as a
     * percentage would attach a unit nobody supplied.
     */
    confidenceSuffix: 'of 100',
    recordedOnPrefix: 'Recorded',
    /**
     * ⚠ NO CAUSE, AND NO ADVICE. See the block header — the three routes to a
     * local-only record are not distinguishable from `remote === null`.
     *
     * ⚠⚠ AND NO NEGATIVE CLAIM EITHER. Superseded text: ~~'On this device
     * only, for this scenario. It is not on your account.'~~ Both "only" and
     * "It is not on your account" are assertions that the record is NOWHERE
     * ELSE, inferred from the mere ABSENCE of `remote.recordId` — and absence
     * of a record id is not absence of a row. One of the three documented
     * routes to `remote === null` is a FAILED COMMIT, where the POST was
     * dispatched and CEE may well have written the record; that is precisely
     * why `clientCommitId` carries a dedupe key. The PR reasoned correctly
     * that only `recordId` licenses the positive claim and then treated its
     * absence as licensing the negative one — the same asymmetry, pointing the
     * other way.
     *
     * What is actually known is a LOCAL fact plus a MISSING CONFIRMATION, and
     * the correctly-scoped words already existed one layer down in the commit
     * path: "We could not confirm this decision was saved."
     */
    storedLocal:
      'On this device, for this scenario. We have no confirmation it reached your account.',
    /**
     * The split named exactly, in the same words the capture modal uses — one
     * thing learned once. Licensed by `remote.recordId`, which is CEE's own
     * proof the durable half landed.
     *
     * ⚠ "A REVIEW DATE", NOT "YOUR REVIEW DATE". Superseded text: ~~'Your
     * choice, confidence, expectation and review date are on your account.'~~
     * The possessive claimed the user chose it. `remote.reviewDateSource` is
     * the field that would settle that — its three values are `user_set`,
     * `default_horizon` and `default_horizon_after_unparsed_trigger` — and on
     * two of the three CEE DEFAULTED the date ninety days out after failing to
     * parse a trigger. The surface has no reader for that field, so it may not
     * imply the answer; it states that a review date exists, which is true on
     * all three.
     */
    storedRemote:
      'Your choice and confidence are on your account, with a review date. The rationale, assumption and revisit trigger are on this device.',
    /**
     * ⚠ THE SAME SENTENCE FOR A RECORD THAT ACTUALLY CARRIES AN EXPECTATION.
     * `expectation` is OPTIONAL on `DecisionRecord` — records written before
     * the field existed are still readable, and `Field` withholds its row when
     * it is absent or blank. A fixed sentence naming it would tell a user
     * their expectation is on their account while the row above it is
     * withheld for want of one: the section's own first rule ("it never states
     * a field the record does not carry") broken by the sentence that
     * describes the record.
     */
    storedRemoteWithExpectation:
      'Your choice, confidence and expectation are on your account, with a review date. The rationale, assumption and revisit trigger are on this device.',
  },
  /**
   * The success target — the question a strategist answers FIRST and this panel
   * never asked.
   */
  /**
   * ⭐ THE PRE-RUN PANEL'S ANSWER TO "WHY NOT?".
   *
   * ⚠ A HEADING ONLY — deliberately the single string this feature contributes.
   * Every sentence beneath it is the run gate's own, rendered verbatim; adding
   * copy here would be this surface making a claim about a refusal it did not
   * compute.
   */
  whyNoAnalysis: {
    heading: 'What this model needs before it can be analysed',
  },
  successTarget: {
    label: 'Target',
    /**
     * ⚠ "No target set" IS A FACT ABOUT THE MODEL, and it is not the same
     * sentence as `unexpressible` below. Collapsing them would tell a user who
     * DID set a target that they never did.
     */
    none: 'None set',
    /**
     * ⚠⚠ A REAL VALUE WE CANNOT EXPRESS IN THE USER'S UNITS. The store tags
     * thresholds `raw` or `normalised`; a bare 0-1 rendered as a target once
     * "showed 0.8 when the real target was 20%". Saying so is honest; printing
     * the number is the defect.
     */
    /**
     * ⚠⚠ IT NO LONGER SAYS "Set", AND THAT IS A WITNESS-DRIVEN CORRECTION.
     *
     * On deployed `6e58c921` this rendered **"Target: Set, but not in a unit we
     * can show"** roughly 120px above the coaching card **"Define success — No
     * measurable success target is set"**. Two sentences on ONE panel, one
     * saying set and one saying not set, about the same thing.
     *
     * The two surfaces answer different questions — this reads the MODEL's
     * threshold from the canvas store, the card's input comes through the
     * RUN's `recommendation.goalThreshold` — and per CLAUDE.md trap 21 the fix
     * for two authorities that appear to disagree is NOT to align their
     * defaults. But `Set` was the weakest claim of the two: we hold a
     * normalised number we cannot interpret, and calling that "set" from the
     * reader's side is generous. Dropping the word removes the contradiction
     * without asserting anything about the other surface's question.
     *
     * ⚠ THE TWO ABSENCES STAY DISTINCT. This is still a different sentence
     * from `none` — "we have nothing" and "we have something unusable" are
     * different facts, and the mutant that collapses them still bites. What
     * changed is that neither now claims a state the reader cannot verify.
     */
    unexpressible: 'No target we can show',
    set: 'Set a target',
    change: 'Change',
    inputLabel: 'Success target for this goal',
    /**
     * ⚠⚠ `local_only` IS THE ONLY OUTCOME THIS CONTROL CAN REPORT, and the copy
     * says what that means rather than implying a save. There is no server
     * carrier for a goal threshold — `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget`
     * is `'disabled'`, and the four that exist are `factor_value_edit`,
     * `prior_range_edit`, `edge_adjudication`, `structural_delete`. Borrowing
     * the strip editor's "sent" sentence would claim an acceptance nothing gave.
     */
    savedLocally: 'Target set on your model. It will be used the next time you analyse.',
    notEncodable: 'That target could not be applied, so nothing changed.',
  },
  /**
   * ⭐ TWO UI-AUTHORED STRINGS, AND BOTH ARE HERE — a heading, and the label that
   * introduces the producer's basis. The caveat sentence and the basis VALUE are
   * the producer's and are rendered verbatim; nothing here summarises, truncates
   * or qualifies them.
   *
   * ⚠ This said "UI-AUTHORED HEADING ONLY" until review counted the second
   * string. An inventory of authored copy that is short by one is the same defect
   * as a stale one, and this block exists precisely to be that inventory.
   */
  robustnessCaveat: {
    title: 'How far this held',
    basisPrefix: 'Tested against: ',
  },
  modelStrip: {
    /**
     * The affordance, stated once above the marks. It describes the CONTROL,
     * never the model, and it is what makes the marks discoverable at all — a
     * 12px shape whose accessible name lives in a screen-reader span otherwise
     * announces itself to nobody using a mouse.
     */
    hint: 'Pick a mark to see what this analysis says about it, and to show it on the canvas.',
    /**
     * ⭐⭐ THE SAME AFFORDANCE, BEFORE ANY ANALYSIS EXISTS — and it needs its own
     * sentence because the one above is a promise the pre-run panel cannot keep.
     *
     * ⚠ MEASURED ON DEPLOYED `3595403b`, guest, a saved model with no run. The
     * strip offered "see what this analysis says about it" one line beneath the
     * panel's own banner reading "No analysis has run yet for this model" —
     * and picking any of the 17 marks returned "Nothing else on this panel
     * refers to this node." There was no analysis to say anything, so the
     * affordance could not have behaved otherwise on any mark.
     *
     * The marks still do something real before a run — they route to the node
     * on canvas — so the fix is to offer THAT, not to hide the control. A dead
     * promise repeated seventeen times reads as a broken model rather than as
     * an analysis nobody has run yet.
     */
    hintPreRun: 'Pick a mark to show that part of the model on the canvas.',
    /**
     * ⭐ THE FACTOR VALUE ROW — the detail's answer to "what data is behind
     * this, and is it mine or Olumi's".
     *
     * ⚠ `noValue` IS A DIFFERENT STATEMENT FROM THE GLANCE'S
     * "On inputs whose source Olumi could not establish", AND THE DIFFERENCE IS
     * THE POINT. That sentence is about our KNOWLEDGE of a source; this one is
     * about the ABSENCE OF A NUMBER. A factor with no value has no source to
     * establish, so the glance line is true of it and tells the reader the
     * wrong thing — they go looking for a provenance problem behind a figure
     * that was never there.
     */
    valueLabel: 'Value',
    noValue: 'No value set',
    /**
     * The edit affordance. Named for the ACT, not the field: "Edit" alone reads
     * as a mode, and the reader is being offered one specific change.
     */
    changeValue: 'Change this value',
    valueInputLabel: (name: string) => `New value for ${name}`,
    saveValue: 'Save',
    cancelValue: 'Cancel',
    /**
     * ⭐⭐ THREE OUTCOMES, THREE SENTENCES, AND THEY MUST NOT BE COLLAPSED.
     * `useModelEditAuthority.proposeFactorValue` returns
     * `dispatched | local_only | not_encodable`, and the type carries that
     * three-way split precisely so a caller cannot report a server acceptance
     * it did not get. A single "Saved" toast over all three would do exactly
     * that — the estate's signature defect, an affordance reporting an outcome
     * it never observed.
     *
     * ⚠ `dispatched` DOES NOT SAY "SAVED" EITHER. The turn has been sent; the
     * authority answers asynchronously and the optimistic write is reverted if
     * it refuses. "Sent to Olumi" is what is true at the moment the sentence
     * is rendered.
     */
    valueDispatched: 'Sent to Olumi. The shared model updates when it answers.',
    valueLocalOnly: 'Changed here only. Olumi has not been told, so the shared model still has the old value.',
    valueNotEncodable: 'That value could not be applied, so nothing changed.',
    /**
     * ⚠ SCOPED TO THIS PANEL, AND THE SCOPE IS THE HONESTY. The index behind
     * the detail is built from exactly two lists — the glance's drivers and the
     * engine's interventions — so "this panel" is the largest true subject.
     * "No finding names this node" would be a claim about the RUN, and the run
     * holds findings this panel has already filtered (dismissed ones) and
     * capped.
     */
    noInsight: 'Nothing else on this panel refers to this node.',
    /**
     * ⚠⚠ THE SAME ABSENCE, WITH THE REASON THE READER ACTUALLY NEEDS. Before a
     * run `noInsight` above is TRUE and still tells the wrong story: it reads
     * as though the panel looked at this node and found nothing said about it,
     * when in fact nothing has been said about ANY node. Naming the cause is
     * the difference between "your model has a gap here" and "no analysis has
     * run" — and only one of those is a fact about the model.
     */
    noInsightPreRun: 'No analysis has run yet, so this panel has nothing to say about this node.',
    /** Disclosure of the per-node finding cap. Never silent truncation. */
    moreFindings: (n: number) => `+ ${n} more finding${n === 1 ? '' : 's'} for this node`,
    /**
     * ⭐⭐ THE WORKLIST LABEL, AND IT IS THE PRODUCT'S OWN LIVE PHRASE RATHER
     * THAN A NEW ONE. `ModelTabV2Panel.tsx:538` renders exactly
     * `'1 to verify'` / `` `${n} to verify` `` off the SAME predicate
     * (`factorIsConfirmable`), and `StatusBar`, `WorkspaceShellTabStrip`,
     * `ModelHealthSection` and `FactorsSection` all name the same count.
     * A strip that invented a second phrase for one state would teach the
     * reader two vocabularies for one number.
     *
     * ⚠ IT IS A COUNT, NEVER A COVERAGE CLAIM. "3 to verify" says three
     * factors carry a number no one has confirmed. It says nothing about the
     * factors with no number at all — those are excluded by the predicate's
     * value guard and are a different question the Model tab names `no-value`.
     */
    toVerify: (n: number) => (n === 1 ? '1 to verify' : `${n} to verify`),
    /**
     * The toggle's accessible name. It CONTAINS the visible text, so the
     * control satisfies label-in-name; the visible half alone would tell a
     * screen-reader user the count and not what pressing it does.
     */
    toVerifyToggleName: (n: number) =>
      `${n === 1 ? '1 to verify' : `${n} to verify`}. Show only these factors`,
    /**
     * ⚠ A VISIBLE EXPLANATION, NOT A `title`. The criterion behind the filter
     * is not self-evident from a count, and a tooltip is unreachable on touch
     * and suppressed by many browsers. Rendered only while the filter is on.
     */
    toVerifyNarrowed: 'Showing only factors carrying a number nobody has confirmed.',
    /**
     * ⚠⚠ `noValueCount`, NOT `noValue` — AND THE NAME IS THE FIX FOR A DEFECT
     * I SHIPPED INTO THIS FILE WHILE WRITING THE COMMENT BELOW ABOUT EXACTLY
     * THIS TRAP. `modelStrip.noValue` ALREADY EXISTS twenty lines up as the
     * DETAIL panel's `'No value set'` string. A duplicate literal key silently
     * won at runtime, the detail's value line rendered a function, and three
     * existing specs went red — `modelStripFactorValueEdit` twice and
     * `stripDetailReflectsTheEdit` once. They were green at pristine, so the
     * regression was mine and the baseline is what proved it.
     * Two questions under one name (trap 21): *what does this cell say when a
     * factor has no value?* and *how many factors have none?*
     *
     * ⭐ THE OTHER HALF OF THE SENTENCE DIRECTLY ABOVE. `toVerify`'s own note
     * says it "says nothing about the factors with no number at all — those
     * are excluded by the predicate's value guard and are a different question
     * the Model tab names `no-value`". This is that question, and the wording
     * is NOT invented here: `ModelOutline.unsetSummary` already renders
     * `${nothing} with no value yet` on the Model tab, so the two surfaces name
     * one state with one phrase rather than teaching two vocabularies.
     *
     * ⚠ A COUNT, NEVER A JUDGEMENT. It says N factors carry nothing; it does
     * not say the model is incomplete, and it excludes factors Olumi has
     * estimated — those have text and are a different clause on the Model tab.
     */
    noValueCount: (n: number) =>
      n === 1 ? '1 with no value yet' : `${n} with no value yet`,
    /** Label-in-name, exactly as `toVerifyToggleName`. */
    noValueToggleName: (n: number) =>
      `${n === 1 ? '1 with no value yet' : `${n} with no value yet`}. Show only these factors`,
    noValueNarrowed: 'Showing only factors that carry no value at all.',
    /** A row is a filter. Accessible name; the row's own word is the visible half. */
    onlyKind: (label: string) => `Show only ${label}`,
    /**
     * A row whose marks are narrowed states BOTH numbers. Showing the narrowed
     * count alone would read as the row's size and quietly shrink the model.
     */
    narrowedCount: (shown: number, total: number) => `${shown} of ${total}`,
    /**
     * The node-level action, inside the detail the reader is actually reading.
     * Activating a mark already routes to the canvas; on touch that same tap is
     * what opened the detail, so without this the detail has no repeatable
     * route of its own — and it had no control of any kind before.
     */
    showOnCanvas: 'Show on canvas',
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
    /**
     * Eyebrow above the answer, in EVERY run state.
     *
     * ⛔ RETIRED, AND DELIBERATELY NOT REPLACED: `eyebrowStale`
     * ("As last analysed"), the stale-run variant of this line.
     *
     * It was written to put `headline` — "…currently scores higher" — into the
     * past. `AtAGlance` renders `glance.leaderLabel ?? glance.headline`, and
     * the view model gives `leaderLabel` a value on exactly the runs where
     * `headline` has one, so the fallback never fires and the tensed sentence
     * never reaches the screen. It was re-tensing a sentence this surface does
     * not render, while costing the stale reader the role label the fresh
     * reader gets.
     *
     * ⚠ DO NOT REINSTATE IT AS A FRESHNESS CUE. Freshness is stated ONCE per
     * panel, in the ribbon at the top of `AtAGlance` (`status.stale` /
     * `status.freshnessUnknown`), which names the CONDITION and distinguishes
     * "the model moved" from "we cannot tell". Measured on staging `19fe8710`:
     * the panel made that one point in three places at once — the ribbon, this
     * eyebrow, and `markers.stale` on every key-insight row. Every one of them
     * was TRUE; the defect was the repetition, and repetition is not emphasis.
     * `freshnessSaidOnce.spec.tsx` holds the count at one.
     */
    eyebrowLeading: 'Most likely to serve your goal',
    /**
     * The label above the producer's own refusal sentence. FURNITURE ONLY —
     * this surface naming its own slot. The claim itself is never authored
     * here: it arrives on `analysis_admission.reasons[]` and is rendered
     * unparaphrased, so the product cannot soften or overstate what the model
     * actually refused.
     *
     * ⚠ NOT "why there is no leading option" — `noWinnerVocabulary.spec.ts`
     * bans that phrase and is RIGHT to: the panel does not report a contest.
     * What the admission governs is which CONCLUSIONS this run permits.
     */
    eyebrowWhyWithheld: 'What this run may not conclude',
    /**
     * The MOVE that answers the refusal sentence above it. FURNITURE ONLY — it
     * names a destination, and it makes no claim about the run.
     *
     * ⛔⛔ IT MAY NOT PROMISE A BETTER ANSWER, AND THAT IS A MEASUREMENT, NOT
     * TASTE. Measured on the live wire: ONE user-stated value out of twenty
     * flips CEE from `quantified_provisional` to `comparative_leader` while the
     * other nineteen estimates remain Olumi's own. So "set a value for a more
     * confident answer" would describe a real transition and still lie about
     * what it means — the model licenses the CLAIM because a human has entered
     * the loop, not because the evidence got stronger. The producer's own
     * sentence is careful about exactly this ("no option CAN BE CALLED the
     * leader … until you have set at least one of them"), and a caption that
     * oversold it would undo the honesty the slot exists to carry.
     *
     * ⛔ AND IT MAY NOT COACH A RUBBER-STAMP. "Confirm these figures", on a
     * panel whose whole complaint is that the figures are Olumi's own, is an
     * instruction to launder a machine estimate into a user-stated one — which
     * would satisfy the gate and mean nothing. Hence REVIEW OR SET: the two
     * things the destination actually does, and neither of them an outcome.
     *
     * `withheldReasonHasAMove.spec.tsx` holds both ceilings, with a positive
     * control proving each can fail on the sentence it forbids.
     */
    reviewEstimates: 'Review or set an estimate',
    /**
     * ⚠ STILL LIVE, AND ITS ONLY CONSUMER IS NOW `ModelStrip`'s per-node chip —
     * a standalone claim that the run ranked this node among its top drivers.
     * The glance's own driver LIST, which this used to head, was removed at
     * `e15416ad`: it restated the drivers section's ranking from the same
     * fields one scroll above it.
     */
    whatMattersMost: 'What matters most',
    couldChangeIf: 'Could change if',
    /**
     * ⛔ `moreDrivers`, `basisRelative`, `basisAbsolute` and
     * `basisRelativeExplain` DELETED with the glance's driver list — they were
     * that list's cap disclosure and its basis caption, and nothing else read
     * them. `basisAbsoluteExplain`'s SENTENCE survives, relocated verbatim to
     * `coverage.structuralInfluence`. ⚠⚠ THIS USED TO END "because the claim it
     * makes is still owed to the reader; it is now a visible caveat on the
     * drivers section rather than a `title` tooltip the touch reader could
     * never open" — FALSE since #1228 and corrected 7 Sep 2026. The relocated
     * sentence reached only runs with no bars, and `driversCaveat` now withholds
     * the basis line there; see that constant's own block for where the claim
     * IS still made (per row, on `driverFinding.groundedIn`).
     *
     * The set-relative half of that caption is not lost: the drivers section
     * carries `coverage.setRelativeInfluence` wherever bars are drawn, which is
     * the same claim in the place the bars now live. Since #1228 it is the ONLY
     * basis sentence this panel renders.
     */
  },

  markers: {
    provisional: 'Provisional',
    /**
     * ⛔ NO LONGER RENDERED BY THIS PANEL, AND THE STRING STAYS ONLY BECAUSE
     * `DisclosureRow`'s `MARKER_LABEL` is a total map over the finding type,
     * which still admits `'stale'`.
     *
     * The other two markers are ROW-SCOPED claims — this value is provisional,
     * this thing was not assessed — and they are the only kind a row badge can
     * honestly carry. `'stale'` is a RUN-SCOPED claim wearing a row-scoped
     * badge: the view model stamps it on EVERY key insight, so a stale run
     * repeated one fact up to `KEY_INSIGHT_PREVIEW` times at rest and once more
     * per row on disclosure. `AnalysisNewSection` drops it before it reaches
     * `DisclosureRow`; the run says it once, in the ribbon.
     *
     * ⚠ THE VIEW MODEL IS NOT WRONG TO CARRY IT and was deliberately left
     * alone — `isStale` is a real property of the displayed run. This is a
     * question of how many times the SURFACE states it.
     */
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
     * ⚠⚠ NAMED APART FROM `stale`, AND THIS IS THE WHOLE POINT (trap 21).
     *
     * `OutputsDock.tsx:981` computes ONE boolean —
     * `displayedFreshness === 'stale' || displayedFreshness === 'unknown'` —
     * and this surface rendered `stale` for both. So on a run CEE could not
     * VERIFY, the panel's first line told the user their model had CHANGED.
     * That is an assertion about the world made from an absence of evidence.
     *
     * The dock's own comment forbids exactly this, six lines below that
     * predicate: "so the stale banner never claims 'you've updated the model'
     * for a CEE-sourced 'unknown'." The old Analysis tab honours it —
     * `AnalysisFreshnessNotice` computes `freshness === 'stale'` with STRICT
     * equality and gives 'unknown' its own sentence. This tab did not.
     *
     * Two states, two claims: one says the model moved, one says we cannot
     * tell. Collapsing them is how a warning that sometimes matters gets
     * trained out of a reader.
     */
    freshnessUnknown: 'We cannot confirm whether this analysis reflects the current model.',
    /**
     * ⚠ NAMED FOR THE OUTCOME, NOT THE MECHANISM. "Re-analyse" describes what
     * the system does; "to be sure" says what the READER gets, which is the
     * only reason they would press it. It serves BOTH ribbon states — a changed
     * model and an unconfirmable one are resolved by the same act.
     */
    reanalyseToBeSure: 'Re-run to be sure',
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
    provisional: PROVISIONAL_UNNAMED,
    /**
     * ⭐⭐ THE SAME WARNING, SAYING WHICH RESULTS.
     *
     * Witnessed on the deployed build: this ribbon renders in amber ABOVE the
     * result, and on a run where the producer sent no `statusReason` it said
     * only "some results are missing" — a caveat with no content, in the most
     * prominent position on the panel. A warning a reader cannot act on is a
     * warning they learn to scroll past.
     *
     * ⚠ THE NAMES ARE NOT INVENTED. `completeness.missing` is a CLOSED
     * seven-key vocabulary derived by `deriveResultCompleteness` from the
     * SOURCE fields, before any UI defaulting. This maps those keys to what
     * this surface already calls those things; it adds no claim the producer
     * did not make. An unrecognised key is DROPPED rather than shown raw, and
     * if nothing survives the mapping the generic sentence above stands.
     */
    /**
     * ⚠ JOINED WITH A CONJUNCTION, NOT A BARE COMMA. `join(', ')` produced
     * "the win share, the robustness check did not come back" — a comma splice
     * that reads as a truncated sentence, witnessed on the deployed build in
     * the panel's most prominent warning. Two missing results is the common
     * case, so this was the usual rendering rather than an edge one.
     *
     * British English list punctuation: no serial comma before "and".
     */
    provisionalNaming: (missing: readonly string[]) =>
      missing.length === 0
        ? PROVISIONAL_UNNAMED
        : `This analysis is partial. ${sentenceCase(MISSING_LIST.format(missing as string[]))} did not come back.`,
    /**
     * Field names as THIS surface says them. Furniture: naming our own fields,
     * never a statement about the run. Keys are the producer's own vocabulary.
     */
    missingResultLabels: {
      win_probability: 'the win share',
      expected_outcome: 'the expected outcome',
      sensitivity: 'the sensitivity check',
      /**
       * ⚠⚠ "the robustness check" WAS TOO BROAD, AND IT CONTRADICTED THE LINE
       * FOUR ROWS BELOW IT. Witnessed on deployed staging `219cbe19` on a live
       * fresh journey (guest, re-drafted example, analysis complete 03:41:29Z):
       * the panel read *"This analysis is partial — the win share and the
       * robustness check did not come back"* while its own confidence sentence
       * read *"13 fragile edges, 0 robust edges"* — computed from the very
       * check it had just said did not come back.
       *
       * The predicate is right and the WORD was wrong. `useResultCompleteness`
       * adds this key when `robustness.level` and `robustness.recommendation_
       * stability` are both absent, and that check exists for a good reason
       * ("when both are absent, the rendered robustness state is fabricated").
       * The payload carried `robustness.fragile_edges` 13, `robust_edges` 0,
       * `edge_e_values` 7 — so the CHECK ran and its edge-level output is on
       * screen; what is missing is the summarising RATING.
       *
       * The key was always precise (`robustness_level`). Only the label
       * over-claimed. Naming the rating rather than the check tells the reader
       * what is actually absent and stops the panel contradicting itself.
       *
       * ⛔ NOT CHANGED, and deliberately: `From the robustness check.` as a
       * finding's `sourceLine`. That names where a finding CAME FROM, which is
       * true and unaffected — a different question under similar words.
       */
      robustness_level: 'the overall robustness rating',
      /**
       * ⚠⚠ `recommendation_stability` IS DELIBERATELY ABSENT FROM THIS MAP, and
       * a CI guard exists to keep it that way (`withheldFieldReadBan.spec.ts`,
       * which caught it here). PLoT WITHHOLDS that field on purpose: ISL derives
       * it as the leader's win probability RELABELLED, carrying — in the
       * producer's own words — "zero independent information". Naming it as a
       * result that "did not come back" would warn a reader about the absence of
       * something withdrawn deliberately, on every run, and imply they are
       * missing a measurement that never existed.
       *
       * ⚠⚠ THIS COMMENT USED TO END "`deriveResultCompleteness` never adds it
       * either; the unknown-key drop handles it silently." THE SECOND CLAUSE IS
       * RIGHT AND THE FIRST IS FALSE — corrected at the bytes, 5 Sep 2026.
       * `useResultCompleteness.ts:224` DOES `missing.add('recommendation_stability')`,
       * always paired with `robustness_level` in the same branch. So the
       * unknown-key drop is the ONLY thing keeping this key off screen, on every
       * run where robustness is unavailable — load-bearing, not a safety net for
       * a case that cannot arise. Two consumers depend on it: `buildStatus`'s
       * `missingResults`, and the "Not included in this result" row in
       * `buildDeeper` (pinned by `missingResultsNamedInWords.spec.tsx`).
       */
      decision_review: 'the decision review',
      top_drivers: 'the drivers',
    } as Record<string, string>,
  },

  /**
   * Coverage disclosure. ⚠ THE ONE SENTENCE IN THIS FILE MOST LIKELY TO DRIFT
   * INTO A LIE. Incomplete coverage is NOT a readiness verdict and NOT a cause
   * of any ordering — `RunAdmission` owns readiness and nothing here speaks for
   * it. The wording states what was not covered and stops.
   */
  coverage: {
    /**
     * ⛔ `someFactorsUnassessed` DELETED. It read 'Some factors could not be
     * assessed for this ranking.' — a second, near-identical spelling of
     * `RESOLVE_NEXT_COPY.partial` ("Some factors couldn't be assessed for this
     * ranking."), the register whose own header exists to forbid exactly that:
     * "copying the sentences into the second deck would be the hand-maintained
     * mirror CLAUDE.md trap 12 is about, and the drift would be SILENT".
     *
     * It also had ZERO render consumers — the ranking it describes reached no
     * screen on this tab at all. Now that it does, the sentence is imported
     * from its owner and rendered verbatim, so there is one spelling again.
     */
    /** Influence figures are set-relative, not a causal share of the outcome. */
    setRelativeInfluence:
      'Influence is relative to the other factors in this run, not a share of the outcome.',
    /**
     * ⛔⛔ THIS SENTENCE REACHES NO SCREEN, DELIBERATELY, AND THE SUITE PINS
     * THAT — `theBasisLineHasNoReferentWithoutBars` in
     * `driversSeamSaysOneThing.spec.tsx` REDs the day it renders again.
     *
     * ⚠⚠ THE DOCBLOCK THAT STOOD HERE WAS FALSE, AND IT IS THE REASON THE
     * SENTENCE SHIPPED OVER AN EMPTY STATE. It opened "`setRelativeInfluence`
     * fires when any row is `normalised_elasticity`; a run where EVERY row is
     * `influence_score` got no basis line at all on this tab." That was true
     * until #1228, which measured that `influence_score` is the producer's
     * normalisation against `max|influence|` and made `influenceIsSetRelative`
     * equal `drivers.length > 0`. From that commit on, this arm was reachable
     * ONLY on a run with ZERO driver rows — where its own first two words,
     * "Each bar", refer to bars that were never drawn.
     *
     * MEASURED at `cdd2f9d8`, rendering `AnalysisNewTabBody` with `drivers: []`:
     * this sentence rendered directly above "This run did not return factor
     * influence.", with no chart. `driversCaveat` now withholds the whole basis
     * line when nothing is on display, which is what makes this arm unreachable.
     *
     * ⭐ RETAINED ON PURPOSE, NOT LEFT BEHIND. The noun it carries — "Olumi's
     * structural influence score" — IS rendered, per row, by
     * `driverFinding.groundedIn` and its `Basis` inspect row, and
     * `driversSeamSaysOneThing` binds that row's noun to THIS constant so the
     * two cannot drift into two spellings of one quantity (CLAUDE.md trap 12).
     * `panelCopyNamesOlumiNotTheProducer` pins the same words here. Deleting the
     * constant would force both to retype the sentence and rebuild the mirror.
     *
     * ⚠ IF YOU MAKE IT REACHABLE AGAIN, REWRITE IT FIRST. As a section caveat
     * it answers the QUANTITY question, which this surface must not answer —
     * `driversSeamSaysOneThing` asserts the caveat names neither quantity, on
     * either basis, because a caveat that names one is false for the run
     * stamped the other.
     */
    structuralInfluence:
      "Each bar shows Olumi's structural influence score, scaled against the strongest factor in this run.",
    /**
     * ⭐⭐ WHAT THE SECTION LEFT OUT, AND THE PRODUCER'S REASON FOR EACH.
     *
     * `buildDrivers` drops every row the producer stamped with a `zero_reason`.
     * That filter is deliberate and stays — but it was SILENT:
     * `suppressedZeroCount` reached the DOM only through `driversEmptyMessage`,
     * which renders when there are NO findings, so a run with survivors dropped
     * rows and said nothing. Measured against the canvas on staging `acd3db4d`,
     * the dropped row can be the model's rank-1 factor: a pinned factor carries
     * `intervention_override` while keeping the highest `influence_score`, so
     * the canvas ranked it #1 and this panel deleted it without a word.
     *
     * ⚠ THE REASONS ARE NAMED, NEVER SUMMARISED — the rule this file already
     * states at `driversAllZero`: "three reasons cannot share one summary
     * without one of them being described wrongly". The labels come from
     * `influenceScaleCopy.ZERO_REASON_BADGE_LABELS`, the same map the Drivers
     * panel badges rows with.
     *
     * ⚠ "NOT RANKED HERE", NOT "EXCLUDED" AND NOT "HIDDEN". The producer
     * returned these factors and scored their sensitivity at zero; they are
     * absent from a RANKING, which is a narrower claim than being left out of
     * the analysis, and the narrower claim is the true one.
     */
    notRanked: (n: number, reasons: readonly string[]) =>
      `${n} ${n === 1 ? 'factor is' : 'factors are'} not ranked here: ${reasons.join('; ')}.`,
    /**
     * ⛔ UNREACHABLE SINCE #1228, AND THAT IS A REPORTED FINDING RATHER THAN A
     * DECISION THIS FIX MADE. `driversCaveat` reaches this arm only when
     * `influenceIsSetRelative` is false, i.e. only on a run with no driver rows
     * — and the basis line is now withheld entirely on such a run, because
     * this sentence followed by an option label, sitting over "This run did not
     * return factor influence.", was the same defect as the structural arm's
     * (both reproduced at `cdd2f9d8`).
     *
     * ⚠ THE DISCLOSURE IS REAL AND IS NOW OWED NOWHERE. `data.sensitivityReference
     * .optionLabel` is the producer naming the option sensitivities were measured
     * against; it was designed to take PRECEDENCE over the structural basis noun,
     * which stopped meaning anything when the scale sentence became unconditional.
     * Whether it should instead be ADDITIVE alongside the scale line — the way
     * `notRanked` is, since it answers a different question (trap 21) — is a
     * product decision, deliberately NOT taken here.
     *
     * Kept, with `theBasisLineHasNoReferentWithoutBars` asserting the
     * unreachability, so restoring it is a conscious act rather than a silent one.
     */
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
    /**
     * ⭐ THE MEASURE'S NAME, SO THE SENTENCE BELOW HAS A SUBJECT.
     *
     * ⚠ A TOPIC, NOT A MAGNITUDE. The ceiling forbids saying what the number
     * MEANS; it does not forbid naming what was measured — its own
     * discrimination case proves that by requiring the owner's licensed
     * sentences to survive the pattern list. "Value of information" is the
     * owner's own vocabulary (`RESOLVE_NEXT_COPY.note`), so this introduces no
     * second name for one measure.
     *
     * ⚠ NOT "value of MORE information", which reads as a quantity claim about
     * a delta, and not "worth learning" — `/worth learning more/i` is a banned
     * pattern and the near-miss is exactly how a ceiling gets walked past.
     */
    label: 'Value of information',
    measuredNonZero:
      'Measured for the decision as a whole, this run did not come back at zero.',
    measuredZero: 'Resolving the open unknowns was measured as not changing this decision.',
  },

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ⭐⭐ WHAT WE CHECKED — one entry per reachable state, and the unassessed
   * states are the ones that carry a sentence.
   * ─────────────────────────────────────────────────────────────────────────
   *
   * ⭐ THE LABELS ARE THE OLD TAB'S, VERBATIM WHERE THEY EXIST. This readout is
   * proven and the consolidation map marks it KEEP; re-wording it would be a
   * second vocabulary for one concept.
   *
   * ⭐⭐ `meaning` IS THE §7.5 FIX, AND IT IS THE REASON THIS IMPORT IS NOT A
   * COPY. The map's own critique of the old readout is: "no action, no
   * explanation — what does a user do with 'Evidence not assessed'?" That
   * critique is correct. The old tab's answer is a NATIVE `title` TOOLTIP,
   * which is hover-only — invisible on touch, invisible to a reader scanning
   * the row, and invisible to anyone who does not know there is something to
   * hover. So the explanation was there and unreachable, which is the same as
   * absent for most readers.
   *
   * Here it is VISIBLE TEXT, and it appears ONLY on the unassessed states.
   * That is deliberate on both halves:
   *  · ONLY there, because a sentence under every chip is furniture rather
   *    than information (Paul's canvas-density ruling, applied one surface up)
   *    — and because the assessed outcomes are already explained elsewhere on
   *    this tab, where the census requires them to stay.
   *  · THERE AT ALL, because that state is the one a reader cannot act on
   *    without being told what it means. Every one of these sentences does the
   *    same single job: it blocks the reading of SILENCE AS REASSURANCE.
   *
   * ⛔ AND NO ACTION IS OFFERED, DELIBERATELY. §7.5 asks for "no action, no
   * explanation" to be fixed, and only ONE half of that is honest here. There
   * is no control on this surface that can cause a check to be made: the three
   * verdicts are producer-side, and routing the reader to "Strengthen the
   * reasoning" would be a false promise (those recommendations are
   * engine-emitted and have no relationship to whether a check ran). An
   * advertised action that terminates in nothing is the exact defect this
   * estate ships most often. Explanation is what the surface can keep, so
   * explanation is what it offers.
   *
   * ⛔ NO ROBUSTNESS REASON HERE. The producer's `robustnessVerdictReason` is
   * rendered by "At a glance" and is its to render. Repeating it would put one
   * producer sentence on the surface twice — the exact property
   * `__tests__/firstViewportCensus.spec.tsx` exists to forbid.
   */
  checks: {
    leader_present: { label: 'Most likely option identified' },
    /**
     * The one licensed DENIAL, and it is licensed by `separation === 'tied'`
     * alone (`decisionVerdict.ts:166-168`).
     */
    leader_tied: { label: 'No option is clearly most likely' },
    leader_not_assessed: {
      /**
       * ⚠⚠ "NOT ASSESSED" WAS FALSE ON A RUN THAT ASSESSED IT — WITNESSED, NOT
       * REASONED ABOUT. Deployed `3b2df4ce`, guest, saved example, completed
       * run. The producer returned:
       *     option_comparison_status: 'computed'
       *     leading_option_id:        'opt_rudderstack'
       *     win probabilities         55.1% · 36.0% · 3.0% · 5.9%
       * and the CANVAS was rendering those very percentages on the option nodes
       * — while this row told the reader the comparison was "not assessed" and
       * that "this run returned no comparison verdict".
       *
       * ⭐ THE MECHANISM IS RIGHT AND IS NOT CHANGED. `leader_not_assessed` is
       * the deliberate third state (`buildAnalysisNewViewModel.ts:2410-2417`):
       * `leaderDesignationPermitted` did not return true and `separation` was
       * not `'tied'`, so the panel declines to name a leader. Declining is
       * correct — we never name a leader we are not entitled to name.
       *
       * ⛔ WHAT WAS WRONG IS THE WORDS. WITHHELD IS NOT UNASSESSED — one name
       * for two questions, this estate's signature defect. "Did Olumi assess
       * it?" and "may this surface state the answer?" are different questions,
       * and the copy answered the second by asserting a falsehood about the
       * first. A reader who sees "no comparison verdict" beside four rendered
       * percentages learns that the panel does not know what the engine did.
       *
       * ⚠ THE REPLACEMENT MUST BE TRUE IN BOTH POPULATIONS this state covers —
       * a run that genuinely assessed nothing, AND a run that assessed and was
       * withheld. "Not confirmed" holds for both; "not assessed" holds only for
       * the first. Both misreadings the original sentence was written to block
       * are still blocked: it is not a claim of a tie, and not an all-clear.
       *
       * ⚠ THE EM DASH CAME OUT AND THE LABEL BECAME A NOUN PHRASE (10 Sep 2026,
       * witnessed on the served build). The ruling is no em dashes in product
       * content. A label is not a sentence, so the fix was not to split it: it
       * now takes the shape every sibling in this map already has
       * (`Robustness not assessed`, `Evidence not assessed`), and in particular
       * the shape of its OWN positive twin, `leader_present: 'Most likely
       * option identified'`. Same claim, and the pair now reads as a pair.
       *
       * ⚠ "not confirmed" IS THE LOAD-BEARING HALF and may not be dropped to
       * shorten this. Without it the row reads as an all-clear.
       */
      label: 'Most likely option not confirmed',
      meaning:
        'Olumi could not confirm which option is most likely on this run, so any ordering you see is unconfirmed. It is not a finding that the options are level.',
    },
    robustness_robust: { label: 'Robust' },
    /**
     * ⚠ "Sensitive" ALONE NAMES NO SUBJECT — the old tab's own note, and its
     * reasoning is imported with the string: sensitive to WHAT is the whole
     * content of the verdict. Covers `'moderate'` and `'fragile'` together,
     * exactly as the old tab does; the degree is the glance's to state.
     */
    robustness_sensitive: { label: 'Sensitive to assumptions' },
    /**
     * ⚠ "the result" CAME OUT OF BOTH MEANINGS (10 Sep 2026). Paul's ruling:
     * the analysis is a THINKING TOOL, NOT AN ORACLE, so copy conditions on the
     * data available rather than naming a verdict to accept. The human is the
     * author and the decision-maker.
     *
     * ⚠⚠ AND THE HONESTY IS THE POINT OF THESE TWO ROWS, so the referent was
     * swapped and NOTHING ELSE. Both still say the run did not establish
     * robustness, and both still refuse to read as an all-clear: "did not test"
     * and "nothing here" are load-bearing and may not be dropped to shorten
     * them. Pinned by `noWinnerVocabulary.spec.ts`, which also guards the
     * referent against coming back.
     */
    robustness_not_assessed: {
      label: 'Robustness not assessed',
      meaning:
        'This run did not test how these numbers behave when the assumptions change, so nothing here says they would hold.',
    },
    /**
     * ⚠ A DIFFERENT STATE FROM THE ONE ABOVE, AND THE OLD TAB IS RIGHT TO
     * SPLIT THEM. `'not_assessed'` is the producer SAYING it did not assess;
     * a missing field is the producer saying NOTHING — an older build that
     * never carried the verdict. Collapsing them would attribute a statement
     * to a producer that never made one.
     */
    robustness_unknown: {
      label: 'Robustness unknown',
      meaning:
        'No robustness verdict came back with this run, so nothing here has been shown to survive a change in the assumptions.',
    },
    evidence_all_addressed: { label: 'Evidence covered' },
    evidence_gaps: { label: 'Evidence gaps' },
    /**
     * ⭐ A REAL, LICENSED ALL-CLEAR — the producer assessed and flagged
     * nothing. It renders as a PASS here, which is the deliberate deviation
     * from the old tab: that surface gives this state and "never assessed" the
     * SAME muted glyph, leaving the one distinction the third state exists to
     * preserve carried by the label alone.
     */
    evidence_none_flagged: { label: 'No evidence gaps flagged' },
    evidence_not_assessed: {
      label: 'Evidence not assessed',
      /**
       * ⭐ THE SENTENCE §7.5 ASKED FOR, LITERALLY. What a user does with
       * "Evidence not assessed" is: stop reading the empty list below as an
       * all-clear. That is a real change in what they believe, which is why
       * the explanation earns its line even without an action beside it.
       */
      meaning:
        'This run did not assess the evidence behind the inputs, so an empty list here is not an all-clear.',
    },
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

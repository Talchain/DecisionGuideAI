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
 * The coverage warning with no names in it. Held as a const because
 * `provisionalNaming` falls back to it: the guarantee "an empty list never
 * emits a sentence fragment" then belongs to the STRING, not to its one
 * call site, and survives a second caller.
 */
const PROVISIONAL_UNNAMED = 'This analysis is partial — some results are missing.'

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
      `${label} leads on both readings of this run.`,
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
      'Set a success target and the same run also answers which option is most likely to hit it — a second reading that can disagree with this one.',

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
    axisEdge: 'strongest this run',
    /**
     * ⚠ NOT "no direction" AND NOT SILENCE. `mixed` and `unknown` are results:
     * the producer measured the factor and declined to assert one direction.
     * "Direction not established" says that; "no direction" would report an
     * absence of effect that was never measured.
     */
    directionNotEstablished: 'Direction not established',
    /**
     * The section header for the chart. It names the QUESTION the chart
     * answers, which is not the question the glance's bars answer — those rank
     * the top three by size; this one says which way each pushes and lets you
     * change it.
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
    /** The move. Named for what the team gets, not for what the system does. */
    record: 'Record what you decided, and why',
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
    valueDispatched: 'Sent to Olumi — the shared model updates when it answers.',
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
      `${n === 1 ? '1 to verify' : `${n} to verify`} — show only these factors`,
    /**
     * ⚠ A VISIBLE EXPLANATION, NOT A `title`. The criterion behind the filter
     * is not self-evident from a count, and a tooltip is unreachable on touch
     * and suppressed by many browsers. Rendered only while the filter is on.
     */
    toVerifyNarrowed: 'Showing only factors carrying a number nobody has confirmed.',
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
    eyebrowLeading: 'Leading option',
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
      "Each bar shows Olumi's structural influence score, scaled against the strongest factor in this run.",
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
    provisionalNaming: (missing: readonly string[]) =>
      missing.length === 0
        ? PROVISIONAL_UNNAMED
        : `This analysis is partial — ${MISSING_LIST.format(missing as string[])} did not come back.`,
    /**
     * Field names as THIS surface says them. Furniture: naming our own fields,
     * never a statement about the run. Keys are the producer's own vocabulary.
     */
    missingResultLabels: {
      win_probability: 'the win share',
      expected_outcome: 'the expected outcome',
      sensitivity: 'the sensitivity check',
      robustness_level: 'the robustness check',
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
    leader_present: { label: 'Has leading option' },
    /**
     * The one licensed DENIAL, and it is licensed by `separation === 'tied'`
     * alone (`decisionVerdict.ts:166-168`).
     */
    leader_tied: { label: 'No clear leader' },
    leader_not_assessed: {
      label: 'Leading option not assessed',
      /**
       * ⚠ THE SENTENCE MUST BLOCK BOTH MISREADINGS, not just one. "Not
       * assessed" can be read as "they are level" (the tie this verdict is
       * explicitly NOT entitled to claim) or as "it is fine". It says neither.
       */
      meaning:
        'This run returned no comparison verdict, so any ordering you see is unconfirmed — it is not a finding that the options are level.',
    },
    robustness_robust: { label: 'Robust' },
    /**
     * ⚠ "Sensitive" ALONE NAMES NO SUBJECT — the old tab's own note, and its
     * reasoning is imported with the string: sensitive to WHAT is the whole
     * content of the verdict. Covers `'moderate'` and `'fragile'` together,
     * exactly as the old tab does; the degree is the glance's to state.
     */
    robustness_sensitive: { label: 'Sensitive to assumptions' },
    robustness_not_assessed: {
      label: 'Robustness not assessed',
      meaning:
        'This run did not test how the result behaves when the assumptions change, so nothing here says it would hold.',
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
        'No robustness verdict came back with this run, so the result has not been shown to survive a change in the assumptions.',
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

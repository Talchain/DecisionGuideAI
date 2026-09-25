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

import { applyUnitPlacement } from '../../../utils/unitClassifier'
import { isSuppressedUnit } from '../../../canvas/utils/labelUtils'
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
export const sentenceCase = (s: string): string =>
  s === '' ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`

/**
 * The exact inverse: lowers a leading letter so a label written to OPEN
 * something can be spliced mid-sentence.
 *
 * `ZERO_REASON_BADGE_LABELS` is a map of BADGE labels, so every value opens
 * with a capital and is right to. Spliced after a colon by `coverage.notRanked`
 * and `empty.noneRanked` the capital reads as a sentence fragment — witnessed
 * by Paul on deployed `b93904c9`: "4 factors are not ranked here: Controlled by
 * your options."
 *
 * ⚠ HERE RATHER THAN AT THE CALL SITE, AND THE PRECEDENT IS EXPLICIT.
 * `goalAnchorCopy.ts:276` states it: "The register owns casing; call sites
 * never do it" — written after two call sites did `phrase(x).charAt(0)
 * .toLowerCase()` inline and a third did NOT, shipping "Option A Supported in
 * 71% of simulated scenarios" with a capital mid-sentence. BOTH composers below
 * call this, so the two cannot drift into two casings of one producer stamp.
 *
 * Only the first character is touched, so `ZERO_REASON_BADGE_LABELS` stays the
 * single owner of what each reason is CALLED and no label is duplicated here in
 * a different case.
 */
const clauseCase = (s: string): string =>
  s === '' ? s : `${s.charAt(0).toLowerCase()}${s.slice(1)}`

/**
 * The coverage warning with no names in it. Held as a const because
 * `provisionalNaming` falls back to it: the guarantee "an empty list never
 * emits a sentence fragment" then belongs to the STRING, not to its one
 * call site, and survives a second caller.
 */
const PROVISIONAL_UNNAMED = 'This analysis is partial. Some results are missing.'

/**
 * ⭐ THE UNIT EXAMPLES, ONCE. The success-target editor's placeholder and the
 * refusal that names it read this same constant, so a sentence can never
 * describe a box showing something else. The three are the Model tab's own
 * (`ModelRowView`'s unit input), because two surfaces collecting one thing
 * should offer it in one vocabulary.
 */
const GOAL_UNIT_EXAMPLES = '£, %, points'

export const ANALYSIS_NEW_LABEL_FALLBACK = 'This option'

/**
 * ⭐⭐⭐ A WITHHELD CLAIM IS NOT A MISSING ONE, AND THE PANEL COULD NOT TELL THEM
 * APART BECAUSE IT ONLY READ THE BOOLEAN.
 *
 * ⛔ THE DEFECT, MEASURED ON A REAL RUN (Paul's debug export
 * `olumi-debug-1dd2133d-20260916.json`, 16 Sep 2026). CEE returned a COMPLETE,
 * USABLE run — `run_state: "complete_current"`, `readiness: { status: "ready",
 * blockers: [] }`, `requires_rerun: false`, `usable_for_prose: true`, options
 * SEPARATED with a 0.51 gap — and withheld exactly one claim, with its cause
 * named:
 *
 *     "leader_claim": { "permitted": false,
 *                       "withheld_reason": "constraint_verdict_withheld" }
 *
 * The reader was told only *"Olumi could not confirm which option is most likely
 * on this run"*. True, and reason-free — so it reads as "something did not come
 * back", which is the one thing it was not. The producer's own summary on that
 * run names the cause outright: *"One limit on your model could not be checked:
 * 'Total hiring spend this year must not exceed £200,000'."*
 *
 * ⭐ WHY THE READER NEVER SAW IT. The UI collapses the producer's reason into a
 * two-value local enum (`LeaderClaimWithholdingReason =
 * 'leader_claim_withheld' | 'analysis_unusable'`,
 * `canvas/hydrate/applyScenarioAnalysisRead.ts`) whose values mean only "on
 * whose account". The producer's string is discarded at that boundary, and
 * `leaderDesignationPermitted` / `rankingWasWithheld` read the BOOLEAN. With a
 * boolean you cannot distinguish a principled refusal from missing data, so
 * every downstream sentence falls back to absence language.
 *
 * ⛔⛔ THE TOKEN IS NEVER RENDERED, AND UNKNOWN REASONS CHANGE NOTHING. The
 * contract declares `withheld_reason` as `z.string().optional()` — FREE FORM,
 * not an enum (`@talchain/schemas` `AnalysisLeaderClaimSchema`). So this maps
 * only reasons this estate has EVIDENCED, and anything else returns `null`,
 * which leaves today's sentence exactly as it is. A map that guessed at unseen
 * tokens would be the fabrication this whole panel exists to avoid.
 *
 * ⭐ TWO ENTRIES. `separation_unavailable` EARNED ITS PLACE ON 19 Sep 2026.
 *
 * This note used to say it had "NOT been seen on a live wire, so it is not
 * mapped", and that the map would grow when a capture earned the entry.
 * **A capture earned it**: bundle `b3d5806d`, staging `fd65f971`, 14:32Z —
 * `leader_claim: { permitted: false, withheld_reason: "separation_unavailable" }`
 * on a real user's run. The rule worked exactly as written, so the entry goes
 * in and this paragraph records why it is no longer a refusal.
 *
 * ⛔⛔ AND THE OLD NOTE'S WARNING IS WHY THE CLAUSE READS AS IT DOES. It said a
 * sentence about options that "could not be told apart" sits too close to "the
 * options are level" — which the sentence beside it explicitly denies. That
 * hazard is unchanged by having a capture.
 *
 * So the clause states what THE RUN did, never what the OPTIONS are: it did not
 * separate them far enough to put one forward. That is a claim about this run's
 * resolution. "They are level" would be a claim about the options themselves,
 * which no withheld verdict is entitled to make — and which the standing
 * sentence beside this one denies in as many words.
 *
 * ⛔⛔ THE CLAUSE IS DELIBERATELY BROAD, AND MY FIRST VERSION WAS NOT — CORRECTED
 * 16 Sep after an independent review, and the producer had written the rule down.
 *
 * #1618 shipped *"One limit on your model could not be checked"*, lifted from
 * CEE's PROSE SUMMARY on run `1dd2133d`. True of that run; not what the token
 * means. `composeLeaderClaim` (`orchestrator-v5/compose/analysis-state-v1.ts:773`)
 * emits it for ANY `mayNameLeadingOption !== true`, and
 * `MAY_NAME_LEADING_OPTION` (`orchestrator/context/constraint-feasibility.ts:341`)
 * maps THREE states to `false`:
 *
 *   · `evaluated_infeasible` — the constraints WERE scored and the leading
 *     option breaks one;
 *   · `unevaluated` — a ratified constraint was not checked;
 *   · `identity_unresolved` — the constraint ids could not be matched.
 *
 * The producer's own comment on `unevaluated` reads: *"'Your condition was not
 * checked' is assertable HERE AND NOWHERE ELSE."* So a correctly evaluated
 * over-budget result was being told its limit could not be checked.
 *
 * ⚠ AND THE OPPOSITE IS EQUALLY BANNED. A sentence naming a BREACH would be the
 * same defect with the sign flipped, false on the other two states (trap 22b).
 * The clause therefore states what the verdict did, and nothing about what was
 * or was not measured.
 *
 * ⚠ THE PRECISE CAUSE CANNOT BE DERIVED HERE. `analysis_state` carries
 * `run_state`, `readiness`, `leader_claim`, `robustness`, the three usability
 * flags, `requires_rerun`, `blocked_unusable` and `contradictions` — and no
 * constraint-verdict state. Naming which of the three applies needs CEE to emit
 * it; inferring it is what this corrects.
 *
 * ⭐ A MUTANT KIT COULD NOT HAVE CAUGHT THIS. All four of #1618's mutants bit.
 * They measure whether the test can DETECT a change, never whether the
 * EXPECTATION is right (trap 13c) — and the expectation had been written from
 * one run's prose instead of from the producer's semantics.
 */
const LEADER_WITHHOLD_CAUSE: Readonly<Record<string, string>> = {
  constraint_verdict_withheld:
    'The check against the limits you set does not support putting one option forward.',
  /**
   * ⚠ ABOUT THE RUN, NOT ABOUT THE OPTIONS. A statement about what the run
   * could establish; "they are level" would be a finding about the options,
   * which a withheld verdict is not entitled to make.
   *
   * ⛔⛔ AND THE FIRST VERSION OF THIS SENTENCE WAS FALSE ON A REAL RUN.
   * It read: "This run did not separate the options far enough apart to put one
   * forward." That is a MEASUREMENT — it asserts the gap was computed and found
   * too small.
   *
   * Paul's capture refutes it. Bundle `84c8e210`, staging `c952cca3`,
   * 19 Sep 18:56Z, `analysis_ready.status: "ready"`:
   *
   *     leader_claim = { permitted: false, withheld_reason: "separation_unavailable" }
   *     win_probability = 0.639 / 0.300 / 0.047 / 0.015      ← a 34-point gap
   *
   * The options are separated by a wide margin and the panel told the reader
   * they were not. An independent seat had already raised this as a [P2] on
   * #1757; the capture settles it.
   *
   * ⭐ THE TELL IS IN THE PAYLOAD'S OWN VOCABULARY, and it is a contrast
   * control rather than an argument. When the producer HAS assessed separation
   * it says so in a sibling field: `5376e928` carries `"separation":
   * "separated"`, `57555f97` carries `"separation": "near_tie"`. On this run
   * that field is ABSENT. `separation_unavailable` means the assessment could
   * not be MADE — it is the absence of a measurement, not a measurement of
   * closeness.
   *
   * ⚠ Trap 21 at word level: `separation_unavailable` and a near-tie are two
   * different facts, and the token reads like the second. The sentence must
   * carry the difference, because nothing else on the surface does.
   */
  separation_unavailable:
    'This run could not work out how far apart the options are, so it cannot put one forward.',
}

/**
 * The producer's cause for withholding the leading option, as a sentence, or
 * `null` where it supplied none this surface can state.
 *
 * ⚠ RETURNS A CLAUSE THE CALLER APPENDS — it does not replace the existing
 * sentence. That sentence carries "It is not a finding that the options are
 * level", which stays true whatever the cause, and dropping it would let a
 * silent list read as a tie.
 */
export function leaderWithholdCause(producerReason: string | null | undefined): string | null {
  if (typeof producerReason !== 'string') return null
  const trimmed = producerReason.trim()
  if (trimmed === '') return null
  /**
   * ⚠ `hasOwnProperty.call`, NOT a bare index read — and the producer already
   * documented this exact hazard for this exact kind of map
   * (`orchestrator-v5/compose/analysis-state-v1.ts:255-270`, whose own remedy is
   * this call, adding that "new code diverging from it is how one subsystem ends
   * up with two answers to one question"). `withheld_reason` is
   * `z.string().optional()` at the contract, so `'toString'` is an ADMISSIBLE
   * producer token: a bare read returned a prototype Function, which is truthy,
   * so the `?? null` never fired and the surface would have rendered it.
   * Measured, not hypothesised — the pre-fix spec failed with
   * `expected [Function Object] to be null`.
   */
  return Object.prototype.hasOwnProperty.call(LEADER_WITHHOLD_CAUSE, trimmed)
    ? (LEADER_WITHHOLD_CAUSE[trimmed] as string)
    : null
}

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
    /** The method half of "how far can I trust this?", grouped under one heading. */
    howWorkedOut: 'How this was worked out',
    /** The science-grounded half: where this reasoning comes from. */
    coachingAndMethod: 'Coaching and method',
    /** Drivers, what is worth resolving, and the method receipts. */
    whatMovesTheOutcome: 'What moves the outcome',
    strengthen: 'Strengthen the reasoning',
    drivers: 'Drivers and dynamics',
    /**
     * ⭐ THE ONLY SECTION A PERSON REACHES WITHOUT THE PRODUCER OFFERING IT.
     * Named here rather than inline in the component so the section censuses
     * bind to the constant, as they do for every peer — a census matching a
     * string literal cannot tell a rename from a removal (trap 19).
     */
    methods: 'Methods you can run',
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
    /**
     * ⭐ NAMES THE PROVENANCE, MAKES NO CLAIM ABOUT THE READER. "Where these
     * checks come from" answers the question a sceptic asks of a bias check
     * ("says who?") and answers it with the producer's own literature. It
     * deliberately does NOT name a bias, promise an improvement, or imply the
     * reader exhibits anything: the section under it renders the mechanism, the
     * technique and the citation, and never the classification.
     *
     * ⚠ SIBLING TO `checks`, AND THE PAIRING IS THE POINT. "What we checked"
     * says what was looked at; this says what the looking rests on. Two
     * questions, named apart (CLAUDE.md trap 21) — collapsing them into one
     * heading would lose the only part a reader can independently verify.
     */
    biasGrounding: 'Where these checks come from',
  },

  /**
   * Labels for the bias-grounding readout. Furniture only: every claim-bearing
   * string on that surface is the producer's, rendered verbatim.
   *
   * ⚠ `tryThis` IS AN OFFER, NOT A PRESCRIPTION, AND NOT A PROMISE. "Try this"
   * says here is a technique; it does not say it will improve the decision,
   * because nothing here licenses that. The human is the author.
   */
  biasGrounding: {
    tryThis: 'Try this',
    sourcePrefix: 'Source: ',
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
  /**
   * ⭐ COUNTS, NOT A SCORE. Each number is the length of a list already
   * rendered below; they are never combined, because a combined figure would
   * be a claim about the model that no producer field supports.
   */
  trustLine: {
    /** No producer verdict. NOT "looks fine" — the basis was never established. */
    noBasis: 'How far this holds was not established',
    counts: (checks: number, open: number): string =>
      `${checks} ${checks === 1 ? 'check' : 'checks'} ran · ` +
      `${open} ${open === 1 ? 'open question' : 'open questions'}`,
  },

  sectionSubtitles: {
    howWorkedOut: 'What the run was given, and what it could not settle',
    coachingAndMethod: 'Where this reasoning comes from',
    whatMovesTheOutcome: 'Drivers, and what is worth resolving',
    drivers: 'What moves the outcome, and through what',
    uncertainty: 'What this run could not settle',
    deeper: 'Method, provenance and receipts',
  },

  /**
   * Empty states. Each one states what was NOT established, never a reassuring
   * positive. "Nothing stands out yet as the first thing to strengthen" is a
   * fact about this run; "Your reasoning looks solid" would be a claim nobody
   * measured.
   *
   * ⚠ The earlier wording named an "intervention" — an INTERNAL term, banned by
   * ANALYSIS_HERO_BANNED_TERMS, and it was reaching users: witnessed rendering
   * in the Strengthen section on deployed 7573bb0e, 16 Sep. Nothing swept this
   * module against that list, which is why one instance survived a guard that
   * already existed. `analysisNew/__tests__/copyHygiene.spec.ts` now walks this
   * object and scans its STATIC STRING leaves, so the class is closed FOR THOSE
   * — not, as this comment first claimed, for every string the object can emit.
   *
   * ⚠ AND THE EXCLUSION IS NAMED RATHER THAN LEFT IMPLIED. Function members
   * compose their sentences from arguments and the scan does NOT invoke them,
   * so their templates are unscanned and a banned term introduced inside one is
   * still reachable. That spec pins the 29 function-valued paths as an EXACT
   * set precisely so the gap is recorded rather than silent: adding a function
   * member REDs it and forces a deliberate decision about the new template.
   */
  /**
   * ⭐ WHAT YOUR MODEL IMPLIES — the two readings.
   *
   * ⚠⚠ ONE CLAIM IS DELEGATED AND ONE IS AUTHORED, AND THE ASYMMETRY IS FORCED.
   * `goalClaim` returns `GOAL_ANCHOR_COPY`'s own sentence, framed "In this
   * model," — the shared owner the retiring hero's copy ALSO delegates to, so
   * both surfaces print one wording of that claim and cannot drift.
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
      `In this model, ${label} is most likely on both readings of this run.`,
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
      'Set a success target and the same run also shows which option is most likely to hit it in this model. That second reading can disagree with this one.',

    /**
     * READING ONE — the highest expected outcome.
     *
     * ⚠ "EXPECTED OUTCOME" IS LITERALLY TRUE HERE, AND THAT IS LOAD-BEARING.
     * The number is `getExpectedValue`, which is the MEAN and explicitly refuses
     * to fall back to the median. A surface that blends mean and median into one
     * "centre" may say "centre"; only one reading the mean may say "expected".
     */
    outcomeClaim: (label: string, readout: string): string =>
      `In this model, ${label} has the highest expected outcome: ${readout}.`,

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
      `In this model, ${GOAL_ANCHOR_COPY.headline(label, readout, true)}.`,
  },

  empty: {
    keyInsights: 'No insight is grounded well enough to lead with yet.',
    strengthen: 'Nothing stands out yet as the first thing to strengthen.',
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
      `No factor is ranked in this run. ${n === 1 ? '1 factor was' : `${n} factors were`} returned and set aside: ${reasons.map(clauseCase).join('; ')}.`,
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
    /**
     * Placed on the textarea. States what happens, so saving is not a guess.
     *
     * ⚠⚠ APPENDED, NOT REWRITTEN: THIS IS NOW HALF OF A PAIR, AND FOR A WHOLE
     * SESSION IT WAS THE ONLY HALF. The sentence above is the original and it
     * is still exactly right — for the state where nothing is sent. What made
     * it a privacy falsehood was shipping `finding_dissent` beneath it: the
     * user composed their words under an explicit promise of locality and the
     * words then went to the server, with the only sentence saying so rendering
     * AFTER the send. Consent that arrives after the fact is not consent, and a
     * deliberate widening the user is not told about at the moment of decision
     * is indistinguishable, from their side, from a leak.
     *
     * ⚠ SO THIS ONE IS NOW SCOPED RATHER THAN CHANGED. It renders when the send
     * will NOT happen, where it remains true and must stay: no dispatcher
     * mounted (the intermediate deploy state, and any route without a
     * `ConversationProvider`), no run identity yet, or a failed run whose hash
     * is the literal 'error'.
     */
    prompt: 'Why? This stays on the card in this browser.',
    /**
     * ⭐⭐ THE SAME PROMPT, FOR THE STATE WHERE THE WORDS WILL TRAVEL. It is the
     * disclosure, and it is the ONLY one the user gets before they type.
     *
     * ⚠⚠ WHICH OF THE TWO RENDERS IS DECIDED BY `isSendableAddress` — THE SEND'S
     * OWN PREDICATE, IMPORTED, NOT A COPY OF IT. A second predicate written
     * beside the first is how this sentence would quietly become false again:
     * it would agree on the day it was written and drift. `findingDissent.ts`
     * owns the question and `buildFindingDissentEvent` consumes the same call.
     *
     * ⚠ IT STATES THE ACTION, NOT THE STORAGE, which is `guestStorageClaims.ts`'s
     * own standing rule and not a house style: every positive claim about where
     * a user's work lives has eventually been found false in this estate. "Sent
     * to Olumi" is what the product does and is observable; "no longer only in
     * this browser" is a claim about storage the client cannot check.
     *
     * ⚠ AND IT PROMISES NOTHING FURTHER — not that the team can read it, not
     * that it changes the finding, not that anything improves. The register is
     * `targetOutcome.dispatched` and `modelStrip.valueDispatched`, whose shared
     * first sentence is exactly 'Sent to Olumi.'; their SECOND sentence is not
     * borrowed, because "the shared model updates when it answers" is a promise
     * this surface has not measured.
     *
     * ⚠ IT IS ALLOWED TO OVER-WARN AND IT CANNOT UNDER-WARN, by construction:
     * the address is a strictly WIDER condition than the send (see
     * `isSendableAddress`). A blank or over-long statement, a board with no
     * persisted identity, or a decision switched mid-compose all leave the words
     * local after this sentence has warned they would travel. That direction is
     * the safe one and is pinned in `dissentReachesTheModel.spec.tsx`.
     */
    promptSendsToOlumi: 'Why? This stays on the card and is sent to Olumi.',
    notSaved: 'Not saved for next time. Your words are still here. Retry, or copy them before leaving.',
    /**
     * ⭐⭐⭐ THE ROW WENT AND THE SAVE FAILED — the one case where the composer
     * cannot hold the words, because the composer is gone with the row.
     *
     * ⛔ WITNESSED IN REVIEW OF MY OWN #1752, on the SERVED commit. The rescue
     * effect ignored `recordDissent`'s false result and skipped persistence
     * entirely when there was no scenario id, then called `closeDispute()`
     * unconditionally — so a rerun that removed the finding cleared what
     * someone had typed after a FAILED save. The PR was titled "What someone
     * typed must not vanish with the row it was typed in" and it still
     * vanished on the failing path.
     *
     * ⚠ THE WORDS THEMSELVES ARE RENDERED, not merely referred to. An
     * unmounted row holding state the reader cannot reach is not recovery —
     * the reviewer's phrase, and the standard this copy is written to. So this
     * sentence introduces the text rather than replacing it.
     */
    rescuedUnsaved: 'This could not be saved, so it is kept here. Copy it before you leave the page.',
    /** Names the finding it was written about, so the words keep their context. */
    rescuedAbout: 'You wrote this about',
    rescuedDismiss: 'Dismiss',
    sessionOnly: 'Kept in this tab only.',
    scenarioChanged: 'The model on screen changed. Your words have not been saved to it. Copy them or return to the original model before retrying.',
    save: 'Record this',
    cancel: 'Cancel',
    /**
     * ⭐⭐ THE ONLY SENTENCE ON THIS SURFACE THAT MAY CLAIM THE WORDS LEFT THE
     * BROWSER, AND IT RENDERS ONLY AFTER A SEND HAS ACTUALLY RESOLVED.
     *
     * ⚠⚠ THE TWO HALVES DEPLOY INDEPENDENTLY, so this copy has to be true at
     * every intermediate state — including UI-live-but-CEE-not-yet, where the
     * `finding_dissent` reader does not exist and no send can succeed. That is
     * why the claim is bound to the OUTCOME rather than to the attempt: no
     * dispatcher mounted, no real analysis id, a refused build, a rejected
     * turn, or a reload all leave `sessionOnly` standing. A UI asserting a
     * server capability that is dark is the defect class this estate keeps
     * shipping, and the fix is not a better sentence, it is a later one.
     *
     * ⚠ IT DOES NOT SAY "SAVED", following `targetOutcome.dispatched` and
     * `modelStrip.valueDispatched` verbatim in register, and for the reason
     * their own comments give: "Saved" reports an outcome the client did not
     * observe. What IS observed at the moment this renders is narrower and
     * exactly stated — the turn was sent and Olumi answered without refusing
     * it, so these words are no longer only in this browser.
     *
     * ⚠ AND IT PROMISES NOTHING FURTHER. Not that the team can see it yet, not
     * that it changes the finding, not that anything improves. The dissent is
     * a record of what a human said; claiming more would be inventing a fact on
     * the one surface whose whole job is not to.
     *
     * ⚠⚠ THE SECOND CLAUSE IS GONE, AND THE RECORD OF WHAT IT SAID STAYS ABOVE.
     * As first shipped this read 'Sent to Olumi, so this is no longer only in
     * this browser.' and it turned `Full Test Suite (shard 4/4)` RED at
     * 374a40ff: `guestStorageClaims.spec.ts` sweeps every tracked non-test file
     * under `src/` and bans the phrase outright, so the offender was this file.
     *
     * ⚠ AND THE BAN IS RIGHT HERE EVEN THOUGH THE CLAUSE WAS NOT FALSE. The
     * pattern is direction-blind — it cannot tell a locality claim from its
     * negation — but the remedy is the one that guard's own header prescribes,
     * "state the action, not the storage", and NOT an entry in
     * `GUEST_STORAGE_CLAIM_ADJUDICATED`: adjudicating would exempt this entire
     * 1,600-line copy table from the estate's only locality guard to protect one
     * sentence, so every future false claim on this tab would pass unseen. The
     * clause was also the weaker half of the sentence: 'Sent to Olumi' is an
     * observed action, and 'no longer only in this browser' is a claim about
     * server-side storage this client never checked.
     *
     * ⚠ NOTHING IS LOST BY DROPPING IT, because the disclosure moved to where it
     * belongs. `promptSendsToOlumi` now tells the user the words will travel
     * BEFORE they type them, which is the moment that decides anything; this
     * sentence only has to report the outcome.
     */
    sentToOlumi: 'Sent to Olumi.',
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
    /**
     * ⭐ NAMES THE QUANTITY, ASSERTS NOTHING ABOUT IT. "How often this changed
     * the answer" is what `switch_probability` measures — the share of
     * simulated runs in which flipping this assumption switched which option
     * came out ahead. It does not say "risk", which would be a verdict, and it
     * does not say "would", which would be a forecast: the runs already
     * happened.
     */
    /**
     * ⭐ ONE CAPTION FOR THE WHOLE COLUMN, not a label per row.
     *
     * Witnessed on `92b5e60e`: the per-row label printed three times in a
     * three-row section. It states one fact about every bar, so it belongs
     * above them once.
     *
     * ⚠ PAST TENSE, DELIBERATELY. The runs already happened: this is a count
     * over simulated scenarios, not a forecast. "would change" would make it a
     * prediction the producer did not make.
     */
    /**
     * ⛔ "came out ahead" WAS THE FIRST DRAFT AND `noWinnerVocabulary.spec.ts`
     * REDDED IT, correctly: that is contest framing, and the 8 Sep ruling is
     * "say 'scored highest in N% of runs' — never a placing". The wording here
     * names the EFFECT (the answer changed) rather than a placing, which is
     * also what the section's own heading already says.
     */
    /**
     * ⛔⛔ AND IT DROPPED THE CONDITION, WHICH IS THE WHOLE MEASUREMENT.
     *
     * The bar draws `switch_probability`, and ISL declares what that is:
     * *"Proportion of MC samples where alternative wins WHEN EDGE IS WEAK"*
     * (`src/models/response_v2.py:569-575`). It is CONDITIONAL on the link
     * being weak. "How often each assumption changed the answer" states an
     * unconditional rate — it says the assumption DID change the answer this
     * often, which is a claim about the assumption's own contribution and is
     * exactly what `strengthElicitation/assumedStrengthCopy.ts` forbids in as
     * many words: *"the measurement is about what happens IF the link is weak,
     * not about what setting a number does."*
     *
     * ⭐ THE SIBLING SENTENCE HAD IT RIGHT ALL ALONG, which is how the defect
     * became visible. The row beneath reads *"In the runs where that link came
     * out weak, X was the stronger option 52% of the time"* — the same number,
     * with its condition. A caption naming one quantity above a sentence naming
     * another is two readings of one bar, and a reader cannot tell which is the
     * bar's.
     *
     * ⚠ AND IT IS WHY TWO BARS READING 52% LOOKED LIKE A BROKEN INSTRUMENT.
     * Two different relationships CAN carry the same conditional rate for the
     * same alternative without anything being wrong; as an unconditional
     * "how much this assumption mattered" they read as a suspicious uniformity.
     * The caption was manufacturing the doubt.
     *
     * ⚠ EVERY EARLIER RULING ON THIS LINE IS KEPT. Past tense, because the runs
     * already happened and "would change" would be a forecast. No placing and
     * no contest framing — "was the stronger option" is the wording
     * `noWinnerVocabulary.spec.ts` explicitly pins as PERMITTED, and it is the
     * sibling's own. One caption for the whole column, not a label per row.
     */
    flipCaption:
      'Bars show how often a different option was stronger in the runs where that assumption came out weak.',
    /**
     * ⭐ THE TIPPING POINT, IN THE PRODUCER'S OWN NUMBERS.
     *
     * Every value is `flip_thresholds[]`'s. The only thing composed here is the
     * verb, and it is chosen by comparing the producer's two numbers rather
     * than by reading a direction field the normalised row does not carry.
     *
     * ⚠ NO PRECISION IS INVENTED and none is implied: `maximumFractionDigits`
     * shortens the display of a value the producer sent, and the row is dropped
     * upstream when either endpoint is missing, so a number on screen is always
     * a number the producer stated.
     */
    tippingPoint: (
      factorLabel: string,
      currentValue: number,
      flipValue: number,
      alternativeLabel: string,
      producerUnit: string,
    ): string => {
      // ⛔ A FACTOR-TYPE DESCRIPTOR IS NO UNIT. Traced by the audit at staging
      // `25314672` from the glance's served "passes 0.9 binary" (UI `c3a39ae7`)
      // to this sentence: "…from 0 binary to 0.9 binary…". `binary` is the
      // factor's TYPE, which `classifyUnit` reads as an ordinary suffix unit.
      // `isSuppressedUnit` is the estate's owner of that list (the factor cards
      // apply it); read here, in the one copy function, so the Challenge row,
      // the Sensitivity tips and the commitment synthesis cannot diverge. The
      // sentence then takes the no-unit arm below, which names the missing
      // scale rather than printing an internal token as if it were one.
      const unit = isSuppressedUnit(producerUnit) ? '' : producerUnit
      // ⛔ A PERCENT IS A SUFFIX. This interpolated `unit` as an unconditional
      // PREFIX, so the deployed build `e6551858` rendered, from a producer row
      // carrying `unit: '%'`:
      //
      //     "Monthly Churn Rate would have to rise from %0.03 to %0.04 …"
      //
      // ⚠ AND THE SAME RUN SPELLED THE SAME DATUM CORRECTLY EIGHT INCHES AWAY:
      // At-a-Glance said "passes 0.04%". One producer unit, two renderings on
      // one screen — the defect `flipThresholdDisplay`'s header was written
      // about.
      //
      // The rule is `glanceCondition`'s, reproduced rather than re-decided:
      // percent suffixes, everything else keeps the prefix that is right for a
      // currency (`£53.86`, never `53.86£`). That function's header already
      // named why this happened — *"a rule that only one of two threshold sites
      // can reach is a rule this surface does not have"* — after the identical
      // class shipped as "Customer demand passes index0.361111". This is the
      // site that could not reach it, and it is the third outing of the class.
      const n = (v: number) =>
        applyUnitPlacement(v.toLocaleString('en-GB', { maximumFractionDigits: 2 }), unit)
      const verb = flipValue > currentValue ? 'rise' : 'fall'
      const claim = `${factorLabel} would have to ${verb} from ${n(currentValue)} to ${n(flipValue)} before ${alternativeLabel} leads in this model.`
      /**
       * ⛔⛔ A BARE PAIR OF NUMBERS IS NOT AN INTERPRETATION, AND SAYING SO IS
       * PART OF THE FEATURE RATHER THAN A HEDGE ON IT.
       *
       * Reviewed 16 Sep: "0.6 to 0.96 is numerically PRECISE but has no
       * understandable scale ... state what the scale means only when the model
       * supplies it; otherwise acknowledge the missing interpretation. No
       * fabricated conversion of 0.96 to headcount, time or probability."
       *
       * The first version of this line printed the pair unqualified — which
       * makes an unreadable number MORE prominent and reads as precision the
       * reader cannot act on. Where the producer states a unit the figures
       * carry their own meaning and nothing is added. Where it does not, the
       * missing scale is named, and it is named as a gap in the MODEL rather
       * than as a doubt about the threshold: the threshold is the producer's
       * and it is not in question.
       */
      return unit === ''
        ? `${claim} The model does not record what that scale measures, so read the change rather than the numbers.`
        : claim
    },
    /**
     * ⭐ NAMES THE AGREEMENT, ASSERTS NOTHING NEW. Every row below already
     * names this option in the producer's own sentence — this says once what
     * the section says three times, so the rows can be read as variations.
     *
     * ⚠ "point the same way" is deliberately not "agree that X is better".
     * The rows are conditionals — *if* this assumption is wrong — and the line
     * must stay one, or it becomes a recommendation the run did not make.
     */
    convergence: (label: string) =>
      `If any of these is wrong, they all point the same way in this model: towards ${label}.`,
    expand: 'Show more',
    collapse: 'Show less',
    inspect: 'Inspect',
    /**
     * ⭐ THE ACCESSIBLE NAME OF THE CAMERA ICON, and it lives here for the same
     * reason every other label does: an icon carries no words, so its
     * `aria-label` IS the control's only name. A literal at the call site
     * would be the one piece of user-facing copy this module cannot see.
     */
    focusTarget: 'Show on canvas',
    /** Level-2 grounding prefix. Always followed by the producer signal name. */
    groundedIn: 'Grounded in',
    /**
     * The act on a row whose own sentence asks the reader to change something.
     *
     * ⛔ "REVIEW OR CHANGE", NEVER "CONFIRM", AND THE OMISSION IS THE POINT.
     * This routes to the editor, which commits through `edge_strength_edit`
     * with `intent: 'set'`. CEE refuses a `set` that resolves to the strength
     * and direction already persisted (`set_target_unchanged`) — deliberately,
     * because ratifying an existing number is a DIFFERENT act with its own
     * intent (`confirm_current`) and its own provenance-only write. So a reader
     * who agrees with Olumi's number and presses a button labelled "Confirm"
     * would be refused by the producer. Until the confirmation intent is
     * wired, this label promises exactly what the route can deliver and no
     * more.
     */
    reviewTarget: 'Review or change',
    /**
     * ⭐⭐ THE AI ACT, AND IT IS THE ONE PAUL SAID WE HAD LOST.
     *
     * Measured on the served build `d3c818f2`, every section opened, all 36
     * buttons enumerated: the panel offered ZERO routes to work on a finding
     * with Olumi. The slot existed - #1643 restored it - but it was gated on
     * `finding.intervention`, producer data that NO finding carried on a real
     * run, so the capability shipped dark.
     *
     * ⚠ AN ASK IS NOT A DISPATCH, WHICH IS WHY THE GATE WAS WRONG RATHER THAN
     * THE SLOT. A producer intervention is a named move the engine recommends,
     * and it needs producer data. Talking to Olumi about a finding needs only a
     * SUBJECT, and every row has one: its own title. Gating the ask on the
     * dispatch's data is the substitution this estate keeps making - one name
     * answering two questions (CLAUDE.md trap 21).
     */
    askOlumi: 'Work through with Olumi',
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
     * What activating an option row does, per row, with the option NAMED —
     * BOTH halves of it, because the row now performs both.
     *
     * ⚠ THIS SENTENCE USED TO STOP AT "Show … on the canvas", on the ground
     * that "open the inspector" was a promise nothing kept. ONE HALF OF THAT IS
     * STILL TRUE and is kept: the OLD TAB's tooltip sits beside a handler that
     * toggles a graph LENS (`OptionCards.tsx:1444` → `handleLensClick`), not
     * the inspector, so that surface still promises what it does not do.
     *
     * The other half — that the inspector could not serve an option AT ALL —
     * rested on `InspectorRouter`'s blanket `<fieldset disabled>`, and that wrap
     * is CONDITIONAL at the tip: `:441` exempts `option`, `factor-controllable`
     * and `factor-external`, and `:541-551` chooses `readOnly` over the fence
     * for them. An option's panel is operable, so this surface opens it and the
     * name says so.
     *
     * ⛔ KEEP BOTH CLAUSES TRUE OR CHANGE THE HANDLER. `OptionsComparison`'s
     * `activate` focuses AND raises the panel; a name covering one of two
     * effects is the defect this constant was extracted to prevent, and
     * `optionsComparisonOperable.spec.tsx` asserts the name BY CALLING THIS
     * FUNCTION, so a reword moves the spec with it rather than past it.
     */
    focusOption: (label: string) => `Show ${label} on the canvas and open its details`,
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
   * ⭐⭐ "Argue the opposite" — the consider-the-opposite act.
   *
   * The move is the best-evidenced debiasing intervention in the literature
   * (Lord, Lepper & Preston 1984; Hirt & Markman on alternative explanations),
   * and the product already NAMES it: `METHOD_CATALOGUE`'s `consider_opposite`
   * carries the accepted CEE intent `challenge_assumption`. What it has never
   * done is ask it against the run's OWN arithmetic.
   *
   * ⚠⚠ THE ONE RULE THIS BLOCK EXISTS TO HOLD, AND IT IS THE WHOLE POINT.
   * Where a reversal condition was actually CALCULATED, the question is built
   * from it and names the producer's own quantity and threshold. Where none
   * was, the act presents itself as a REASONING TECHNIQUE and may not imply the
   * system computed anything. Two acts, named apart, never one sentence that
   * blurs them (CLAUDE.md trap 21 — two questions under one name, where the
   * honest answer differs).
   *
   * A blurred version is worse than a missing one: a thinking prompt dressed as
   * a finding is the fabricated-scientific-label defect this tab was built to
   * avoid, and it is the exact shape of the `/v1/counterfactual` placeholder
   * arithmetic wrapped in a real model card.
   *
   * ⚠ THE CATALOGUE'S OWN PROMPT IS NOT REUSED VERBATIM, AND THAT IS DELIBERATE
   * RATHER THAN AN OVERSIGHT. `consider_opposite.prompt` reads "build the
   * strongest honest case AGAINST the option that scored highest" — a RANK
   * POSITION as its subject. `recommendationMethod.ts:74-82` already records
   * that as a known, unfixed instance of the referent defect, unrepairable
   * there because `METHOD_CATALOGUE` is STATIC and has no run to name anything
   * from. This act HAS a run, so it names the producer's factor instead of a
   * placing. The technique IDENTITY is still the catalogue's — the ask carries
   * `method_id: 'consider_opposite'` and the same intent — so no second
   * consider-the-opposite is minted.
   */
  argueTheOpposite: {
    /**
     * The act. One control, one move, on both arms.
     *
     * ⚠⚠ IT IS NOT CALLED "What would change your mind?", AND THE REASON IS A
     * COLLISION MEASURED ON THIS VERY TAB. `COPY.sections.sensitivity` IS
     * 'What would change your mind' — the heading over the sensitivity
     * findings, named that deliberately because it is "the reader's question,
     * not the producer's category". A button carrying the same words two
     * sections below it would put TWO DIFFERENT THINGS UNDER ONE NAME on one
     * surface: a section listing what the run found, and a control that asks
     * Olumi to argue against it. That is trap 21 in the copy layer, and it is
     * the defect this estate pays for most often.
     *
     * So the control names the MOVE instead. "Argue the opposite" is the
     * imperative form of the catalogue's own `consider_opposite`, which is the
     * technique this act invokes and whose identity it carries on the wire.
     */
    actLabel: 'Argue the opposite',
    /**
     * GROUNDED. Both substitutions are the PRODUCER'S: `factorLabel` is
     * `flip_thresholds[].label` and `thresholdText` is its `flip_value`
     * formatted by the builder that already renders it in "Could change if".
     * The run is named as the author of the figure, because it is.
     */
    groundedLead: (factorLabel: string, thresholdText: string) =>
      `This run put the point where the ordering changes at ${thresholdText} for ${factorLabel}. What would tell you where ${factorLabel} actually sits?`,
    /** GROUNDED — the question that goes to Olumi. It asks; it never edits. */
    groundedDraft: (factorLabel: string, thresholdText: string) =>
      `This analysis puts the point where the ordering changes at ${thresholdText} for ${factorLabel}. Take the opposite side: what evidence or reasoning would put ${factorLabel} on the other side of that figure, and what would I need to see before I believed it?`,
    /**
     * TECHNIQUE. Reached when the run DID find a reversal condition but could
     * not place it on a scale the reader can read (`glanceCondition`'s third
     * arm, where neither a printable unit nor a `current_value` survived and
     * the number is dropped). It says what it is. It claims no computation,
     * no detected bias, no computed importance and no optimal experiment.
     */
    techniqueLead:
      'This run has no figure for where that would change, so this is a reasoning technique rather than a finding: make the strongest case against your current thinking and see what it would take to convince you.',
    /** TECHNIQUE — the question that goes to Olumi. No invented quantity. */
    techniqueDraft:
      'Take the opposite side of my current thinking on this decision. What evidence or reasoning would change my mind, and what would I need to see before I believed it?',
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
    nextActionLabel: 'Next action',
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
    /**
     * ⭐ THE REPAIR ACT (Paul's brief: "blocked analysis with a repair action").
     * It DRAFTS a request in the composer and sends nothing; the reader reads
     * it, edits it and sends it, and any change Olumi proposes is theirs to
     * approve. The blocker sentence is quoted verbatim, never reworded.
     */
    askFix: 'Ask Olumi to help fix this',
    askFixDraft: (blocker: string): string => `Help me fix this so the analysis can run: ${blocker}`,
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
     * ⭐⭐ THE UNIT, COLLECTED HERE RATHER THAN REFUSED. `proposeGoalTarget`
     * has always taken the unit as an argument and this control has always
     * passed it; it was passing `''` and reporting a refusal instead. The
     * visible word is the Model tab's own field label, so the estate refuses
     * and collects a unit in ONE vocabulary.
     *
     * ⛔ THE BOX IS OFFERED ONLY WHERE THE GOAL DECLARES NO UNIT. Beside a
     * producer-supplied one it would be a second writer able to contradict
     * CEE silently, which is worse than the refusal it replaces.
     */
    unitInputLabel: 'Unit for this success target',
    /**
     * ⚠ ONE CONSTANT, TWO READERS — the placeholder the reader SEES and the
     * refusal that names it. Split them and the sentence starts describing a
     * box that shows something else.
     */
    unitPlaceholder: GOAL_UNIT_EXAMPLES,
    /**
     * ⭐⭐⭐ WHICH WAY THE TARGET IS READ — THE THING THIS CONTROL RECORDED AND
     * NEVER SAID.
     *
     * ⚠⚠ MEASURED ON SERVED `475ee1c7` (10 Sep 2026). A guest opened a goal
     * reading *"95% Next-Day Delivery Within 12 Months"*, strip
     * *"Target: 12 months"*, pressed Change, typed `9`, saved. The wire carried
     * `constraint_type: "at_least"` and the message *"This goal must be at
     * least 9 months."* The goal is a DEADLINE. The reader meant sooner. The
     * model recorded a floor, which is close to the opposite.
     *
     * ⚠⚠⚠ THE WRITER WAS NOT BUGGY AND THE DEFAULT DOES NOT MOVE. Recovering a
     * direction from the words of a goal label is CLAUDE.md trap 22f's
     * unwinnable predicate; and readers have already set targets under the
     * shipped behaviour, so silently re-reading those as ceilings would be a
     * worse harm than the gap. `at_least` stays the default. What changes is
     * that the direction is now VISIBLE and CHANGEABLE, which is trap 22f's own
     * sanctioned exit: where direction cannot be derived, ask.
     *
     * ⚠ PLAIN WORDS, NOT THE WIRE'S TOKENS. The reader picks from these; CEE
     * reads its own grammar in `manualGoalTarget.ts`. They coincide today and
     * they answer different questions, so they are named apart rather than
     * shared (trap 21). The direction-pair test is what binds them, by driving
     * this selector and asserting the dispatch it produces.
     */
    directionLabel: 'How this target should be read',
    directionAtLeast: 'at least',
    directionAtMost: 'at most',
    /**
     * ⭐⭐⭐ THREE OUTCOMES, THREE SENTENCES. THE ONE THAT USED TO BE HERE WAS
     * FALSE, AND IT WAS THE ONLY FALSE OUTCOME SENTENCE ON THIS PANEL.
     *
     * ⚠⚠ WHAT SHIPPED, AND WHY IT LIED. This block said `local_only` was the
     * only outcome the control could report, on the premise that
     * `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is `'disabled'` and no
     * server carrier for a goal threshold exists. The KEY was wrong, not the
     * value: `goalSuccessTarget` is about a local threshold editor and a local
     * Define-success modal; the typed `add_constraint` carrier this control now
     * uses answers to `modelGoalMinimumTarget`, which is `'server_graph'` and
     * live on the Model tab. See `SuccessTargetLine.tsx`'s header for the full
     * derivation and for the identical misread `HeroSection.tsx` already fixed.
     *
     * Off that false premise the surface then rendered:
     *
     *   ~~'Target set on your model. It will be used the next time you analyse.'~~
     *
     * Measured on the served build (10 Sep 2026): both halves false. The write
     * was store-only, so a reload reverted the target to its brief value and
     * the provenance label from "Set by you" back to "From brief"; and
     * `success_threshold`/`goalThreshold` reach `src/v5/buildPayload.ts` ZERO
     * times, so no analysis was ever going to see it.
     */
    /**
     * ⚠ `dispatched` DOES NOT SAY "SAVED", for the reason
     * `modelStrip.valueDispatched` does not: the turn has been sent and the
     * authority answers asynchronously. What is true at the moment this renders
     * is that Olumi has been asked.
     */
    dispatched: 'Sent to Olumi. The shared model updates when it answers.',
    /**
     * ⚠ THE KEY IS NO LONGER CALLED `savedLocally`. "Saved" was half the claim
     * that was wrong, and a key name is read by every later author as a
     * statement about what the sentence may assert. This path is reached only
     * when no dispatcher is mounted, and it now says exactly that.
     */
    changedLocally:
      'Changed on this screen only. Olumi has not been told, so this target is not part of the shared model.',
    notEncodable: 'That target could not be applied, so nothing changed.',
    /**
     * ⭐⭐⭐ A FIFTH OUTCOME, AND IT IS THE ONE PAUL ACTUALLY HIT.
     *
     * ⛔ WITNESSED 19 Sep 2026. The panel's own Strengthen row says "No
     * measurable success target is set" and offers "Define success". Paul did
     * exactly that and typed `1.3 million` — the figure from his own brief, in
     * the words his brief used. `statedTargetNumber` is an anchored numeric
     * literal predicate and does not read magnitude words, so it returned null
     * and the whole answer was "That target could not be applied, so nothing
     * changed."
     *
     * **The product asked for an input, the user supplied it, and it was
     * refused without saying what was wrong with it.** That is the worst
     * interaction available on this surface: it punishes the one act we most
     * want.
     *
     * ⚠ THE PARSER IS NOT WIDENED HERE, DELIBERATELY. A magnitude alphabet is
     * a known hazard in this estate — the canonical map was missing `thousand`
     * while every derived guard agreed with it (CLAUDE.md trap 12d) — and it
     * has an owner. Naming the cause is the bounded correction; teaching the
     * parser to read "1.3 million" is a separate, larger piece of work.
     *
     * ⚠ SAYS WHAT TO TYPE, and shows it. A refusal that names a format without
     * demonstrating it makes the reader guess twice.
     */
    notANumber:
      'I could not read that as a number. Type the figure in digits, like 1300000, and put the unit in the box beside it.',
    /**
     * ⭐⭐ NAMES THE CAUSE AND THE MOVE, because this is the one refusal a
     * reader can act on. `notEncodable` above covers three causes at once — no
     * unit, a target at or below zero, a scenario that moved — and a reader met
     * with it has nothing to do next. Witnessed on the deployed build: the
     * panel recommends "Set a target", the reader sets one, and this was the
     * whole of the answer.
     *
     * ⚠ SAYS WHAT IS MISSING, NOT WHOSE FAULT IT IS. The goal arrived without a
     * unit; that is a gap in the model, not an error the reader made, and the
     * sentence is built so it reads the same either way.
     *
     * ⚠ THE MODEL TAB'S WORDS, DELIBERATELY. `unproposableDraftReason` blocks
     * the same draft with "Add a unit". Two surfaces refusing one thing should
     * refuse it in one vocabulary — the divergence is what made this findable
     * only by driving the product.
     *
     * ⛔⛔ REWRITTEN, BECAUSE THE OLD SENTENCE NAMED A PLACE THE READER COULD
     * NOT REACH. It said *"Add a unit to the goal first"*. The only unit
     * writer in the product is the Model tab's goal-target editor, and its
     * `Unit` field mounts only once THAT row's editor is open (`ModelRowView`:
     * `row.kind === 'goal' && commit?.phase === 'editing'`) — so a reader who
     * followed the instruction found nothing, which is how this surfaced as a
     * dead end on a witnessed journey. The control now collects the unit
     * itself, so the sentence names the box that is on screen.
     *
     * ⚠ AND THE REFUSAL IS NOW RARER THAN IT LOOKS. It used to fire on a goal
     * that HAD a unit, because the unit was read through `resolveGoalTarget`,
     * which answers a different question (see `SuccessTargetLine`). It fires
     * only where the goal declares none AND the reader left the box blank.
     *
     * ⛔⛔ AND IT NAMES ONLY WHAT IS ON SCREEN. My first rewrite said *"Type one
     * in the **Unit** box"* — borrowing the Model tab's visible `Unit` label for
     * a field that carries NO visible label here, only a placeholder. That is
     * the same defect one level down: a refusal naming something the reader
     * cannot identify. The examples are interpolated from `GOAL_UNIT_EXAMPLES`,
     * which is the placeholder the empty box is showing while the reader reads
     * this, so the sentence cannot drift from the control.
     */
    noUnit: `A target needs a unit. Type one in the box beside the number, such as ${GOAL_UNIT_EXAMPLES}.`,
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
  /**
   * ⭐⭐ THE SECOND FIGURE ON AN OPTION ROW, AND ITS LABEL IS LOAD-BEARING.
   *
   * The row already carries a bare percentage — the comparative share. A second
   * bare percentage beside it would be two numbers with no way to tell which
   * question either answers, which is worse than one. So the goal figure is
   * NAMED and the comparative one is named beside it, and neither ships alone.
   *
   * ⚠ "Reaches your target" IS POSSESSIVE ON PURPOSE. It names the target the
   * USER set, which is the only case this surface renders (a substituted joint
   * figure is suppressed upstream rather than relabelled — see the view model).
   * The estate's shipped string for the same claim is `OptionCards`' "Hits
   * target"; this register uses the reader's words rather than the card's
   * compact stat-row label, and the possessive is the same commitment.
   *
   * ⚠ "Highest in this model" NAMES THE COMPARATIVE QUANTITY AS MODEL-RELATIVE
   * (#63 ruling). No "wins", "best" or "ahead" — `winner` is on the banned
   * list, and the section title already refuses to assert an ordering because
   * the run may withhold one.
   */
  optionFigures: {
    goalLabel: 'Reaches your target',
    winLabel: 'Highest in this model',
    /**
     * ⭐ SAYS WHAT THE PICTURE IS, AND NOTHING ELSE. It states that the segments
     * account for every simulated scenario, which is the one fact three
     * separate bars cannot carry. It does not rank, does not name an option and
     * does not say the split is close or wide — the widths say that.
     *
     * ⚠ PAST TENSE: the runs already happened. And no contest vocabulary —
     * `noWinnerVocabulary.spec.ts` redded an earlier caption of mine for
     * exactly that.
     */
    /**
     * ⭐⭐ THE ONE LINE THAT TELLS A READER WHEN NOT TO TRUST THE ORDER.
     *
     * The share figures above it partition the runs and sum to 1, so they read
     * as a ranking. The ranges frequently overlap. This sentence is what makes
     * the bars an argument rather than decoration, and it is the difference
     * between a surface that ranks options and one that improves reasoning.
     *
     * ⚠ "Mid-point", not "expected outcome": the dot is p50, the MEDIAN, and
     * `OptionOutcome` carries `mean` separately. Calling a median an expected
     * value is a claim about the distribution that this section cannot make.
     */
    /**
     * ⭐⭐⭐ A FUNCTION OF THE ARM, BECAUSE THE SENTENCE NAMES WHAT THE DOT IS.
     *
     * This was a constant reading "Dots show the mid-point." The lens moves the
     * dot to p10 or p90, so a constant would leave the panel drawing one
     * percentile and naming another — the same number honest in one place and
     * false in the other, which `formatPercent.ts`'s header documents by name
     * (ROADMAP 2.236) and which this section has already shipped once (a "< 1%"
     * readout beside a 0px fill).
     *
     * ⛔ THE PERCENTILE IS IN THE STRING ON PURPOSE. Naming it is what lets a
     * reader check the drawing against the claim, and it is what makes the
     * mutant bite: draw p90 under the mid-point wording and the spec REDs.
     *
     * ⚠ THE OVERLAP SENTENCE IS INVARIANT ACROSS THE ARMS. Overlapping ranges
     * unsettle the order whichever end you read, so it is not the lens's to
     * qualify — and dropping it on two arms of three is how a caveat quietly
     * becomes conditional on the reader's mood.
     */
    rangeLegend: (appetite: 'cautious' | 'middle' | 'optimistic'): string =>
      `Dots show ${
        appetite === 'cautious'
          ? 'the low end (p10)'
          : appetite === 'optimistic'
            ? 'the high end (p90)'
            : 'the mid-point (p50)'
      } of each range. Lines show the range this run produced. Where ranges overlap, treat the order as unsettled.`,
    /**
     * ⭐ THE CONTROL DESCRIBES THE DRAWING, NEVER A RECOMMENDATION.
     *
     * The Analysis tab's lens shipped two P1s (ROADMAP 2.237 / 2.238) because
     * its control said "Rank by outcome" over a list ordered by something else,
     * and crowned an option under a sentence saying the view had no data. Both
     * are the same defect: the subject of the claim was not the source of the
     * number. This control therefore claims exactly one thing — where the dot
     * sits — and the rows keep the order they already had.
     *
     * ⚠ NO CONTEST VOCABULARY. `noWinnerVocabulary.spec.ts` has already redded
     * a caption of mine on this section; "cautious" and "optimistic" describe
     * the READING, not the option, and no arm names a leader.
     */
    rangeLensLabel: 'Read each range at',
    rangeLensArms: {
      cautious: 'Low end',
      middle: 'Mid-point',
      optimistic: 'High end',
    },
    partitionCaption: 'In this model, every simulated scenario is accounted for above.',
    /**
     * Above the shares when the leader was withheld because the user's limits
     * could not be checked (RC 5803875794 P0 #3). The shares are computed on
     * the goal outcome alone; this says so, and claims nothing about which
     * limit or why. Same words as Canvas's option-card qualifier (#63 5804041993).
     */
    goalOnlyQualifier: "Goal only: your limits aren't in these figures.",
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
     * ⚠ SCOPED TO THIS PANEL, AND THE SCOPE IS THE HONESTY. "No finding names
     * this node" would be a claim about the RUN, and the run holds findings
     * this panel has already filtered (dismissed ones) and capped.
     *
     * ⚠⚠ THIS COMMENT SAID THE INDEX WAS "built from exactly two lists — the
     * glance's drivers and the engine's interventions", AND THAT IS WHY THE
     * SENTENCE WAS FALSE ON SCREEN. Two lists cannot answer a question about
     * the whole panel, and the panel was visibly naming nodes the index had
     * never heard of. The index now also reads every section that renders
     * `AnalysisNewFinding[]` — all four of them, enumerated by the compiler
     * rather than by this comment (`AnalysisNewFindingSectionKey`). Do not
     * restate the source list here: a hand-maintained count of the index's
     * inputs is what made this sentence a lie, twice.
     */
    noInsight: 'Nothing else on this panel refers to this node.',
    /*
     * ⭐ NAMES THE SECTION, SO THE POINTER IS ACTIONABLE.
     *
     * "Also in Key insights: Platform Capability Fit is the hinge" tells the
     * reader WHERE to look. A bare headline would make the reader hunt for a
     * sentence they have just been shown out of context.
     *
     * ⚠ THE HEADLINE ITSELF IS NEVER AUTHORED HERE — it is the finding's own,
     * verbatim. This function supplies only the frame around the section name.
     *
     * ⚠⚠ IT TAKES THE TITLE, NOT THE SECTION KEY, AND THAT IS THE FIX TO A
     * MIRROR. It used to branch on the key and RETYPE the headings — 'Also in
     * Key insights:' beside `sections.keyInsights`, two copies of one string
     * (CLAUDE.md trap 12). A heading edit would have moved the section and left
     * the pointer naming a heading that no longer exists, silently. The caller
     * now indexes `ANALYSIS_NEW_COPY.sections` by the section key, so the
     * pointer names the heading the reader will actually be looking for, and a
     * finding-bearing section with no title is a compile error at the call site
     * rather than a wrong sentence on screen.
     *
     * ⚠⚠ THE EMPTY HEADLINE IS A REAL PRODUCER STATE, NOT A DEFENSIVE BRANCH.
     * `buildAnalysisNewViewModel` sets `headline: ''` on a LONG non-threshold
     * uncertainty or sensitivity row and carries the sentence in `implication`
     * instead, deliberately, so the row does not say itself twice. A pointer
     * built from `headline` alone therefore renders on those rows as a label
     * with a dangling colon and nothing after it. The section name ALONE is
     * still a true and useful pointer, so that is what it renders.
     *
     * ⛔ AND IT MUST NOT FALL BACK TO `implication`. That field is the finding's
     * whole sentence, and reprinting it here would make this a SECOND RENDERING
     * of a card already on screen — the restatement defect this panel has
     * shipped three times, and the one thing this pointer was built not to be.
     */
    mention: (sectionTitle: string, headline: string): string =>
      headline ? `Also in ${sectionTitle}: ${headline}` : `Also in ${sectionTitle}`,
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
     * past. `AtAGlance` renders `conclusionLabel(glance)` (`panelLead.ts`,
     * which is `leaderLabel ?? headline` and has one owner), and
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
     * names an ACT, and it makes no claim about the run.
     *
     * ⚠ AMENDED 11 Sep 2026 — THIS SAID "it names a destination", AND THE
     * WORDS ARE WHY NOTHING HERE HAD TO CHANGE WHEN THE DESTINATION DID. On
     * 10 Sep the only place to set an estimate was the Model tab; the next
     * morning the value control on "what I estimated" put the same act on the
     * Reasoning tab itself, and `AnalysisNewTabBody` now serves it in page
     * where it exists and routes to the Model tab where it does not. "Review
     * or set an estimate" is true of BOTH, because it names the two things the
     * reader may do and not the surface they land on — a label that had said
     * "on the Model tab" would have become a lie overnight. Keep it that way.
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
     * WHICH parameters the refusal is about, as a LEAD-IN to the names.
     *
     * ⛔ IT NAMES A SET AND PRESCRIBES NOTHING. The producer publishes these in
     * GRAPH ORDER and ranks nothing, so any wording implying a first, a
     * biggest, or a place to start would be a claim nobody computed. "Start
     * with", "the main one" and "most important" are all forbidden here for
     * that reason, not for tone.
     *
     * ⛔ AND IT MAY NOT RESTATE THE REFUSAL. The producer's own sentence sits
     * directly above and already says every estimate is Olumi's; repeating the
     * complaint would put one producer sentence on screen twice, which
     * `firstViewportCensus.spec.tsx` forbids. This adds only the NAMES.
     *
     * ⚠ "in this comparison" is load-bearing, not filler. The set is the
     * comparison's own causal substrate — the parameters a leader claim rests
     * on — and NOT every estimate in the model. Without that clause the line
     * would overstate its own population, and a reader who set a value on some
     * other Olumi estimate would correctly expect the refusal to lift.
     */
    withheldParametersLeadIn: 'Still Olumi’s in this comparison:',
    /**
     * The cap disclosure. A capped list the reader cannot detect is an
     * understatement they cannot question — the same defect this estate closed
     * on the producer side of the evidence gaps. The CONSUMER may cap, because
     * the consumer can say so; the producer may not, because it cannot.
     *
     * ⛔ NO LEADING "and", AND THAT IS NOT A STYLE CHOICE. This phrase occupies
     * the FINAL SLOT of `formatConjunctionList`, which is `Intl.ListFormat`
     * with `type: 'conjunction'` and therefore supplies the "and" itself. It
     * read `and ${n} more` until 2026-09-12 and rendered, on a refusal
     * witnessed on deployed staging with eight parameters:
     *
     *   *"… Customer and Staff Engagement **and and** 4 more"*
     *
     * — a grammatical stumble inside the sentence that tells a collaborator
     * which estimates are still Olumi's rather than theirs, which is the one
     * place in this panel that can least afford one.
     *
     * ⚠ THE CALL SITE AGREES BY CONSTRUCTION, and the agreement is the thing to
     * preserve: the list the joiner receives is the capped LABELS plus this
     * phrase, so restoring the "and" here without also lifting the phrase out
     * of that array puts the defect straight back. `AtAGlance.tsx` carries the
     * other half of this note; `withheldParametersReadAsOneSentence.spec.tsx`
     * pins the rendered English in BOTH branches by exact equality, and is
     * written out literally rather than recomposed from this constant, so it
     * can actually see a change to it.
     */
    withheldParametersMore: (n: number): string => `${n} more`,
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
    /**
     * ⭐⭐⭐ THE REMEDY, BESIDE THE REFUSAL. A panel that names a blocker and
     * offers no route past it is a dead end, and this one is the FIRST SCREEN a
     * new user meets.
     *
     * ⛔ WITNESSED: a user sent a brief, read a substantial coaching reply, and
     * concluded an analysis had run. It had not. The panel said so truthfully —
     * "No analysis has run yet for this model" — and gave no way to change that,
     * while CEE was returning a `run_analysis` suggested action on the same turn
     * that this surface never rendered. The user re-ran manually 13 minutes
     * later, spending a second full compute.
     *
     * ⚠ THE VERB IS THE USER'S, NOT THE PANEL'S. "Run the analysis" is what the
     * person does; "Analyse" is a button label from the canvas toolbar and
     * repeating it here would imply this is that same control.
     */
    preRunRunAction: 'Run the analysis',
    running: 'Analysis is running.',
    /**
     * ⭐⭐ THE SENTENCE FOR A RUN THE CLIENT HAS STOPPED WAITING FOR.
     *
     * Witnessed (bundle `b3d5806d`, 19 Sep 2026): CEE started a run, committed
     * its result 42s later, and suppressed the directive that would have
     * delivered it. No later turn corrected `run_state`, so the wire said
     * `running` for a run that had finished, with no bound on how long it would
     * keep saying it. See `useAnalysisWaitExhausted.ts` for the full chain.
     *
     * ⚠ EVERY WORD IS TRUE UNDER ALL THREE POSSIBLE OUTCOMES, because the
     * client cannot tell them apart. It knows only that it asked for the result
     * until its own budget ran out and did not get one. So the subject of the
     * sentence is THE RESULT ARRIVING, never the run finishing or failing:
     * "has not reached this page" is observed, "failed" would be invented.
     *
     * ⚠ AND IT IS NOT A `stale` TWIN. Staleness is a property of a DISPLAYED
     * run; there is nothing displayed here. Naming them apart is the same
     * ruling `stale` and `unconfirmed` already carry two entries below.
     */
    waitExhausted: 'This analysis has not reached this page.',
    /**
     * ⭐⭐⭐ WRITTEN AGAINST THE PREDICATE, NOT AGAINST THE RUN THAT PROMPTED IT
     * — and the first draft was not, which is why this note exists.
     *
     * The flag this renders under is reachable by (at least) TWO outcomes of
     * `runProvisionalDeliverySchedule`, and they are opposites:
     *
     *   `deadline`  nothing usable arrived inside the client's budget. The run
     *               may still be going, or may have finished and not been sent.
     *   `withheld`  a terminal verdict DID arrive and was declined, because it
     *               describes a graph the user has since changed. The applier's
     *               own words: "A divergent read writes NOTHING: no verdict, no
     *               results" — so `run_state` stays `running` on this path too,
     *               and the panel reaches exactly the same state.
     *
     * The first draft read "It may have finished without being sent back",
     * which is TRUE of `deadline` and FALSE of `withheld` — there it was sent
     * back and refused. CLAUDE.md trap 13d in one sentence: an invariant
     * written with the same shape as the failure mode in hand.
     *
     * ⭐ So the line asserts only what holds on BOTH: this client has stopped
     * waiting, and a fresh run is the way to get an answer about the model as
     * it stands now. On `withheld` that is not a consolation — it is precisely
     * the right remedy, because divergence is what made the answer unusable.
     *
     * ⚠ AND IT STAYS TRUE IF A THIRD OUTCOME REACHES HERE (`unreadable`,
     * `aborted`). Five of the six outcomes are silent by design today; copy
     * keyed on the flag must survive the ones not yet enumerated.
     *
     * ⚠ THE REMEDY IS THE OPPOSITE OF #1759's, FOR THE SAME REASON BOTH ARE
     * RIGHT. Where a leading option is WITHHELD, re-running hits the same gate
     * and the panel offers "Review or set an estimate" instead. Here no result
     * has been applied at all, so running again is the one act that can change
     * it. Two causes, two acts.
     */
    waitExhaustedWhy:
      'Olumi has stopped waiting for it. Running the analysis again is the surest way to get a result that matches your model as it stands now.',
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
     * ⭐ A RUN THAT DID NOT HAPPEN, stated in this tab's own status slots. The
     * refusal's reason and pointer are the Results tab's own constants
     * (`canvas/store/analysisRefusalNotice.ts`), so the two tabs speak with one
     * voice; these are only the words that differ because a PREVIOUS result is
     * on screen here. See `latestRunNote.ts`.
     */
    latestDidNotRun: 'The latest analysis did not run.',
    latestRunFailed: 'The latest analysis run did not complete.',
    firstRunFailed: 'The analysis run did not complete.',
    showingPrevious: 'Showing the previous result.',
    latestBlocked: 'The model now needs a change before it can be analysed again.',
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
    /**
     * Influence figures are set-relative, not a causal share of the outcome —
     * and the leader's 100% is GUARANTEED, which this sentence now says.
     *
     * ⭐⭐ WHY THE SECOND CLAUSE EXISTS (ROADMAP 2.1376). Witnessed on deployed
     * `ce4769a1`, one fresh guest journey, a few hundred pixels apart:
     *
     *   Key insights          "…is the hinge. Its effect on Infrastructure
     *                          Stack Fragmentation is the relationship most
     *                          able to change the outcome."
     *   Drivers and dynamics  "…three divergent stacks within a year — 100% —
     *                          Top driver"
     *
     * Two sections naming a different "most important" thing. ⛔⛔ THEY ARE NOT
     * IN CONFLICT AND MUST NOT BE RECONCILED (CLAUDE.md trap 21): the hinge is
     * an EDGE ranked by `switchProbability`; a driver is a NODE ranked by
     * `displayInfluence`. Different objects, different quantities, different
     * normalisations, both separately grounded. ⛔ The precedent a session would
     * reach for — `driversSeamSaysOneThing` — resolved ITS pair by DELETING the
     * duplicate. Deleting or suppressing either section here would destroy a
     * real reading.
     *
     * ⭐ THE RIVALRY IS MANUFACTURED BY THE NUMBER, NOT BY THE COPY. This row
     * never claims to be most important. `buildDrivers` renders every bar as
     * `magnitude(d) / strongest` with `strongest = Math.max(...live.map(
     * magnitude), 0)`, so the leader's fraction is EXACTLY 1 in every run
     * regardless of strength, and `driverFinding`'s implication prints
     * "Relative influence 100%." beside it. A 100% that cannot be anything else
     * reads as a rival claim to "the hinge" — so the honest move is to disclose
     * that it is guaranteed, not to quieten the neighbour.
     *
     * ⭐ THE SENTENCE IS NOT NEW AND IS NOT MINE. It is the estate's ratified
     * wording, already SHIPPING on the Analysis tab as
     * `influenceScaleCopy.INFLUENCE_SCALE_CAPTION` ("Influence is relative to
     * the strongest factor. The top driver always shows 100%."). This tab was
     * rendering the weaker sibling, which denies the wrong reading without
     * disclosing that the 100% is guaranteed.
     *
     * ⚠ NOT IMPORTED FROM `influenceScaleCopy`, DELIBERATELY. That module is
     * the home for the DISPLAY MODEL's influence wording, keyed on
     * `DriverDisplayProvenance` per surface; this is a SECTION caveat on a
     * different tab whose own gate (`influenceIsSetRelative`) is
     * `drivers.length > 0`. Binding them would couple two sentences that are
     * free to diverge on scope, and `driversSeamSaysOneThing` already rules
     * this surface's caveat must answer the SCALE question only. The words are
     * pinned as a typed literal by
     * `driversScaleDisclosesTheGuaranteed100.spec.tsx` instead, which is the
     * corpus half of CLAUDE.md trap 12d.
     *
     * ⚠ "relative to the OTHER factors" became "relative to the STRONGEST
     * factor" in the same edit, and that is a precision fix, not a reword:
     * `magnitude / strongest` is a ratio to one factor, not a comparison
     * against the set. It is also what makes the second clause follow rather
     * than arrive as an unexplained assertion.
     */
    setRelativeInfluence:
      'Influence is relative to the strongest factor in this run, not a share of the outcome.',
    /**
     * ⭐⭐ THE SECOND CLAUSE IS CONDITIONAL, BECAUSE IT WAS FALSE ON A REAL RUN.
     *
     * "The top driver always shows 100%" is a claim about the FIGURE each row
     * renders (`pct(displayInfluence)` — the producer's value, never rescaled
     * here). The BAR is a different quantity: `magnitude / strongest` over the
     * rows that SURVIVED filtering, so the leader's bar is full width whatever
     * its figure says.
     *
     * ⭐ THE PRODUCER'S INVARIANT IS REAL AND IS NOT THE DEFECT. Re-derived
     * over every JSON in `src/`: 21 of 22 files carrying `influence_score` max
     * at exactly 1.0. What breaks it is `buildDrivers` dropping rows
     * (`zeroReason != null`) AFTER the producer normalised — so the surviving
     * top row is no longer the producer's max, and the sentence promises an
     * invariant over a set the reader is not being shown.
     *
     * ⛔ WITNESSED BY PAUL on the deployed Reasoning tab, and reproduced at the
     * builder: with one suppressed row at 1.0 and survivors at 0.67 / 0.33 the
     * panel rendered a FULL-WIDTH TOP BAR, LABELLED 67%, under a sentence
     * promising 100%. Three statements about one row, no two agreeing — while
     * the same caveat had already disclosed the cause one clause earlier:
     * "2 factors are not ranked here: controlled by your options."
     *
     * ⚠⚠ AND NO GUARD COULD SEE IT. `driversScaleDisclosesTheGuaranteed100`
     * anchors on `influenceRows[0].fraction === 1` — the quantity that is 1 by
     * construction and can therefore never fail — and asserts the 100% promise
     * on two fixtures whose top rows measure 60 and NO FIGURE AT ALL. An
     * invariant written with the same asymmetry as the code it tests is a guard
     * agreeing with itself, and a corpus sharing the code's blind spot cannot
     * see the code's defect (CLAUDE.md trap 13d).
     *
     * ⛔ THE FIX IS NOT TO RESCALE THE FIGURE. Re-normalising `displayInfluence`
     * over the surviving rows would make the top read 100% and turn every
     * figure into a share of the DISPLAYED set — the exact reading the first
     * clause exists to deny, and what `analysisMetricPercent` means by "without
     * rescaling its value". The number is the producer's and stays; the
     * SENTENCE stops promising what the display does not hold.
     *
     * ⚠ THE ELSE-ARM ASSERTS ONLY WHAT IS DERIVABLE. A non-100 figure has more
     * than one possible cause and the client cannot tell them apart, so the
     * clause explains the BAR — the thing on screen that puzzles — and names no
     * cause it has not measured.
     *
     * ⚠ AND IT SAYS NOTHING WHEN THERE IS NO FIGURE. On a basis other than
     * `influence_score` the rows carry a rank claim and no percentage, so a
     * clause about "100%" would describe a number that never appears.
     */
    guaranteedHundredClause: (topFigurePercent: number | null): string | null =>
      topFigurePercent === null
        ? null
        : topFigurePercent === 100
          ? 'The top driver always shows 100%.'
          : 'The top bar is full width because it is the strongest factor shown, not because it reached 100%.',
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
      `${n} ${n === 1 ? 'factor is' : 'factors are'} not ranked here: ${reasons.map(clauseCase).join('; ')}.`,
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
    leader_present: { label: 'In this model, one option is most likely' },
    /**
     * The one licensed DENIAL, and it is licensed by `separation === 'tied'`
     * alone (`decisionVerdict.ts:166-168`).
     */
    leader_tied: { label: 'In this model, no option is clearly most likely' },
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
      /**
       * ⭐⭐ SPLIT BY QUESTION, because ONE SENTENCE WAS ANSWERING TWO — and the
       * two sections that rendered it answer two.
       *
       * ⛔ THE DEFECT, READ OFF THE DEPLOYED SURFACE (Paul's manual test,
       * 20 Sep 2026, served `fd992149`). The same paragraph appeared twice in
       * one scroll: once under "How the options compare" and once under "What
       * we checked", byte for byte. The comment on the second site called that
       * a virtue — *"one wording covers one fact and the two cannot drift"* —
       * and it was half right. The wording could not drift. **It was not one
       * fact.**
       *
       * `WhatWeChecked`'s own header states the division and this follows it:
       * that section answers WHAT THE RUN CHECKED; the comparison answers HOW
       * TO READ THIS LIST. Two questions named apart (CLAUDE.md trap 21) — and
       * a compound sentence served to both is how a correctly-divided surface
       * still reads as a repetition.
       *
       * ⚠ NOTHING IS DROPPED — AND THE FIRST ATTEMPT AT THIS SPLIT DID DROP
       * SOMETHING, ON A POPULATION IT NEVER CONSIDERED. It moved BOTH denials
       * out of `meaning`, leaving the row reading only "could not confirm".
       * `withheldIsNotUnassessed.spec.ts` REDed and was right to: `meaning` is
       * the ONLY one of these two strings that renders on a run whose options
       * DO carry figures, because `orderingCaveat`'s render site is gated on
       * `noneNumbered`. So on a withheld run with four bars on screen — capture
       * `0db2eb0a`, separation established, constraint verdict withheld — the
       * panel would have drawn the ordering and said nothing about its standing.
       * Trap 23 exactly: the duplication metric would have read as fixed while
       * the honesty the sentence existed for was gone on the other half of the
       * domain.
       *
       * ⭐ SO THE CLAUSES ARE SPLIT BY WHICH RUN NEEDS THEM, NOT BY LENGTH:
       *   · "any ordering you see is unconfirmed" → `meaning`, because a run
       *     that DOES print figures is exactly the one that needs it, and
       *     `meaning` is the string that run renders.
       *   · the level-options denial → `orderingCaveat`, because only a list
       *     with NO figures can be misread as a tie, and that is the only run
       *     where it renders.
       * Both misreadings stay blocked on both populations, and the two strings
       * now share no clause — so neither run reads the same fact twice.
       *
       * ⚠ STILL TRUE IN BOTH POPULATIONS this state covers — a run that
       * assessed nothing, and a run that assessed and was withheld. "Could not
       * confirm" holds for both; "did not assess" would hold only for the first.
       *
       * ⭐ AND THE CENSUS SHOULD NOW SEE NO REPEAT. `firstViewportCensus`
       * exists to catch one claim stated twice; it could not see this pair
       * because `SectionShell` unmounts a closed section and the census never
       * opened one. With that blind spot closed the honest remedy is to stop
       * saying it twice, not to record an exemption for saying it twice.
       */
      meaning:
        'Olumi could not confirm which option is most likely on this run, so any ordering you see is unconfirmed.',
      /**
       * The comparison's half: how to read THIS list, not what was checked.
       * Rendered ONLY by `OptionsComparison`, and only where no row carries a
       * figure — which is why it names that condition itself rather than
       * relying on its position. A silent list invites the false reading that
       * the options came out level, and this denies it outright.
       *
       * ⚠ IT DOES NOT REPEAT `meaning`'s ordering clause. `meaning` renders on
       * every withheld run including this one; anything said in both would be
       * a fact stated twice in one scroll, which is the defect this split
       * exists to remove.
       */
      orderingCaveat:
        'A list with no figures beside it is not a finding that the options are level.',
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
    /**
     * ⛔ THE PRODUCER DID ASSESS — the admission forbids stating what it found.
     * Not `robustness_not_assessed` (which would say it was never tested) and
     * not `robustness_unknown`. Same words as the Analysis tab's twin row.
     */
    robustness_not_established: {
      label: 'Robustness not established',
      meaning:
        'A robustness check ran, but until at least one of the estimates it rests on is yours, its result cannot be called stable or sensitive.',
    },
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

/**
 * ⭐ THE WITHHELD LEADER'S CAUSE WHEN THE PRODUCER'S ADMISSION REFUSED IT.
 *
 * CEE emits `constraint_verdict_withheld` whenever its claim-safety verdict is
 * not entitled, for any reason (`composeLeaderClaim`, CEE `c673223`). On an
 * automatic first run that reason is the admission's own: every estimate is
 * Olumi's. `LEADER_WITHHOLD_CAUSE` reads the token as "the limits you set",
 * which was false on a brief that set none. This is said instead where the
 * admission refused the comparative claim. Pinned by
 * `theWithholdNamesNoLimitsTheUserNeverSet.spec.tsx`.
 */
export const LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS =
  'No option can be put forward until you set at least one of the estimates yourself.'

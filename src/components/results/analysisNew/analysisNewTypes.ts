/**
 * Analysis (New) — view-model types for the duplicate Analysis tab experiment.
 *
 * ⭐ THE ONE RULE THIS FILE EXISTS TO ENFORCE: this view model may SELECT,
 * RANK, GROUP and FORMAT what `useResultsSectionData()` already produced. It
 * may NOT create analytical truth. Every field below is traceable to a producer
 * field or to an existing UI authority, and the trace is written next to it.
 *
 * The experiment (Paul, 27 Aug 2026) is an INFORMATION-ARCHITECTURE comparison:
 * the existing Analysis tab is untouched, and this second surface renders THE
 * SAME analysis run through a reasoning-led IA:
 *
 *   Key insights · Strengthen the reasoning · Drivers and dynamics ·
 *   Uncertainty and gaps  (+ deeper material behind progressive disclosure)
 *
 * ⚠ WHY THE SECTIONS CARRY `groundedIn` STRINGS. Every row a user sees must be
 * able to say which producer signal put it there. That is not decoration — it
 * is the difference between this surface and a generated summary, and it is the
 * property that makes a wrong row diagnosable rather than merely wrong.
 */

import type { DriversSectionData, InferenceWarning } from '../types'
import type { CritiqueWarningEntry } from '../CritiqueWarningStrip'
import type { Recommendation } from '../strengthen/strengthenTypes'
import type { ComparisonScope } from '../utils/goalAnchorCopy'

/**
 * How confident the SURFACE is entitled to sound — never an "AI confidence".
 *
 * ⚠ THERE IS NO `'confident'` MEMBER AND THAT IS DELIBERATE. The absence of a
 * provisional marker is the confident case. Adding a positive token would
 * invite a surface to assert soundness it was never told about, which is the
 * fabrication class this experiment is forbidden from introducing.
 */
export type ProvisionalMarker =
  /** The producer disclosed the value is provisional/auto-derived. */
  | 'provisional'
  /** The displayed run predates the current model (freshness, not quality). */
  | 'stale'
  /** The producer declined to compute or to disclose. Absence, not zero. */
  | 'not_assessed'

/** A level-3 "inspect" payload: label/value pairs, rendered verbatim. */
export interface InspectRow {
  label: string
  /** Already formatted for display by the adapter. Components never compute. */
  value: string
}

/**
 * A contextual reasoning intervention attached to ONE finding.
 *
 * ⚠ Only ever populated from a Recommendation the strengthen ENGINE emitted for
 * the same entity. It is never authored here: a client-authored "why not try…"
 * beside a producer finding is exactly the fabricated-coaching defect the brief
 * forbids. `recommendationId` is the join, and it is what a test binds to.
 */
export interface ContextualIntervention {
  recommendationId: string
  label: string
  /** Present only when the engine supplied one. */
  targetId: string | null
}

/** Shared shape for a progressively-disclosed row across all four sections. */
export interface AnalysisNewFinding {
  /** Stable identity. Tests bind to this, never to a value predicate. */
  id: string
  /** Level 1 — scan. Short, specific, no hedging adverbs. */
  headline: string
  /** Level 1 — one concise implication sentence. */
  implication: string
  /** Level 2 — expanded rationale/relationship/evidence, when there is one. */
  detail?: string
  /** Which producer signal put this row here. Rendered at level 2. */
  groundedIn: string
  marker?: ProvisionalMarker
  /** Canvas focus target, when the producer named one. */
  targetId?: string
  /** Level 3 — inspect. Empty array renders no inspect affordance. */
  inspect: InspectRow[]
  intervention?: ContextualIntervention
}

/**
 * Key insights. NOT decision-centric by construction: a comparative insight is
 * one KIND among several and appears only when the single decision verdict
 * entitles it.
 *
 * ⚠ THE FULL ORDERED LIST, NEVER A CAPPED ONE. `KEY_INSIGHT_CAP` sliced the
 * DATA here until it was deleted; the preview length is applied at the mount,
 * where the section can disclose and REACH its own tail. See
 * `buildAnalysisNewViewModel.ts`'s header on that constant.
 */
export interface KeyInsightsSection {
  insights: AnalysisNewFinding[]
  /**
   * How many grounded candidates the RUN produced, before `dedupeAgainstGlance`
   * removes anything the glance is already saying one viewport above.
   *
   * ⚠ NOT A MIRROR OF `insights.length`, AND THE DIFFERENCE IS WHAT IT IS FOR:
   * an empty list with a non-zero count means "shown above", which is why the
   * mount uses it to suppress an empty-state sentence that would contradict the
   * surface directly above it. It is deliberately NOT a truncation disclosure
   * any more — there is no truncation left at this layer to disclose.
   */
  candidateCount: number
}

/**
 * The producer's DSK attestation for one intervention.
 *
 * ⚠ PRESENCE IS THE ATTESTATION. An intervention without a `claimId` is "not
 * grounded", never "unknown" and never a default — which is why this whole
 * object is absent rather than partially filled. `strength` is a closed
 * vocabulary carried verbatim; `claimId`/`protocolId` are IDS and ride as
 * `data-*` attributes only, never as user-facing copy.
 *
 * ⚠ AND WHAT THIS IS NOT: it is NOT a licence to label an intervention with a
 * technique name the producer did not send. §15 is explicit — a recommendation
 * is not "scientifically grounded" because it sounds like a recognised method.
 * This carries the producer's own attestation or nothing.
 */
export interface ScienceGrounding {
  claimId: string
  protocolId?: string
  strength?: string
}

/** Strengthen the reasoning — the prioritised interventions, in engine order. */
export interface StrengthenSection {
  /**
   * Engine output, already filtered against the strengthen lifecycle store.
   * The engine is `buildRecommendations` — this surface runs it and renders
   * it; it never adds a recommendation of its own.
   *
   * ⚠ NOT CAPPED, AND THE FIELD THAT USED TO SIT BELOW THIS ONE IS GONE.
   * `candidateCount` was documented "Disclosed, never silent" while NOTHING
   * rendered it — a promise the product never kept, pinned by a test that
   * only ever checked the number existed. The section now previews this list
   * and discloses its own remainder, so a second count would be a mirror of
   * `interventions.length` (trap 12) rather than a fact.
   */
  interventions: Recommendation[]
  /**
   * Producer DSK attestation, keyed by recommendation id. Sparse BY DESIGN: an
   * absent key means the producer attested nothing for that intervention.
   *
   * ⚠ WHY THIS EXISTS AT ALL. The carrier is wire-witnessed on guidance items
   * (`dsk_claim_id` / `dsk_protocol_id` / `evidence_strength`), but
   * `toStrengthenPhase3Item` maps nine fields and none of these — so a
   * genuinely grounded recommendation reached the Strengthen panel with its
   * grounding stripped. The join is re-made HERE, in the presentation adapter,
   * rather than by editing the shared mapper, because that mapper is on the
   * existing Analysis tab's path and this experiment may not touch it.
   */
  scienceGrounding: Record<string, ScienceGrounding>
}

/**
 * The producer's driver-analysis status. Structurally identical to
 * `DriversSectionData['driversStatus']` in `../types` and kept as an alias so
 * the tokens have ONE spelling: a hand-copied union is the mirror defect
 * (CLAUDE.md trap 12) and this one would drift silently.
 */
export type DriversStatus = DriversSectionData['driversStatus']

export interface DriversSection {
  findings: AnalysisNewFinding[]
  /**
   * TRUE when the influence figures on display are SET-RELATIVE
   * (`displayProvenance === 'normalised_elasticity'`), i.e. "largest in this
   * set", NOT a causal share of the outcome. Drives the caveat line.
   *
   * ⚠ This is the "do not conflate structurally different scientific
   * quantities" rule made mechanical: the caveat is a function of the
   * producer's own provenance token, not of the adapter's taste.
   */
  influenceIsSetRelative: boolean
  /** The option sensitivities were computed against, when disclosed. */
  referenceOptionLabel: string | null
  totalCount: number
  /**
   * The PRODUCER's own word for whether driver analysis happened at all —
   * `data.drivers.driversStatus`, passed through, never re-derived here.
   *
   * ⚠ THIS ANSWERS "DID WE GET DRIVERS", AND IT IS NOT THE SAME QUESTION AS
   * `suppressedZeroCount` BELOW (CLAUDE.md trap 21). Two authorities that look
   * like they disagree usually answer different questions, and collapsing them
   * is how one sentence came to cover two opposite states.
   *
   * ⚠ AND IT IS NOT SUFFICIENT ON ITS OWN. `useResultsSectionData.ts:3235`
   * DEFAULTS `drivers_status` to 'computed' when the field is absent on the V5
   * path, so 'computed' does NOT imply rows were returned. A zero claim keyed
   * on this alone would be false on exactly that run.
   */
  driversStatus: DriversStatus
  /**
   * How many returned rows THIS SURFACE dropped because the producer marked
   * them zero (`zeroReason != null`).
   *
   * ⚠ THIS ANSWERS "WERE THE ONES WE GOT ALL ZERO". It is this adapter's own
   * bookkeeping about its own filter — not a second status concept — and it is
   * what licenses saying the run measured influence and found none: a row
   * carries a `zero_reason` only when the producer scored it at zero
   * (`types.ts` — "explains why influence is ZERO for intervention factors").
   */
  suppressedZeroCount: number
}

export interface UncertaintySection {
  findings: AnalysisNewFinding[]
  /**
   * Did the producer ASSESS evidence on this run at all?
   *
   * ⚠ THE WHOLE POINT OF CARRYING THIS. An empty gap list answers two different
   * questions — "assessed, none found" and "never assessed" — and a surface
   * that turns the empty list into "No evidence gaps" makes a claim only the
   * first licenses. Sourced from `confidence.evidenceGapsAssessed`.
   */
  evidenceAssessed: boolean
  /**
   * Whole-decision value of information, as a VERDICT only. `'not_computed'`
   * renders nothing; `'measured_zero'` is a real result and says so.
   */
  decisionVoi: 'not_computed' | 'measured_zero' | 'measured_non_zero'
  /**
   * ⛔ `totalCount` DELETED. It was `findings.length` — a MIRROR of the array
   * beside it (CLAUDE.md trap 12) — with a doc comment promising disclosure and
   * ZERO render consumers repo-wide, while its structural sibling
   * `DriversSection.totalCount` is genuinely read (the glance shows at most
   * three drivers and needs the run's total, which it does not hold).
   *
   * There was nothing to render honestly: the one component that could use it
   * already receives `findings` and derives its own count and its own "Show N
   * more" from the actual list, on purpose — "a hand-passed count is a mirror,
   * and a truncation that misreports how much it hid reads as 'you have seen
   * everything' when you have not" (`AnalysisNewSection.tsx`). This is exactly
   * the `candidateCount` deletion `StrengthenSection` above records, and for
   * the same reason.
   */
}

/**
 * Level-3 material. One collapsed region, never a fifth top-level section.
 *
 * ⚠⚠ `groups` IS LEVEL 3. `critiques` AND `caveats` ARE NOT, AND THE SPLIT IS
 * THE WHOLE POINT OF THIS SHAPE.
 *
 * `groups` is provenance a curious reader goes looking for: run identity,
 * coverage, defaulting notices. Collapsing it is correct.
 *
 * `critiques` and `caveats` are things THE ENGINE RAISED about this run. On the
 * existing Analysis tab both render in ALWAYS-VISIBLE strips at the top of the
 * results body (`CritiqueWarningStrip`, `InferenceWarningStrip` — mounted in
 * `ResultsBody`'s unconditional current-view group). This tab is a separate
 * branch in `OutputsDock` and does not mount `ResultsBody`, so before this field
 * existed those warnings reached NO SCREEN HERE AT ALL — the product knowing
 * something and not saying it. They are carried separately so the component can
 * render them OUTSIDE the collapsed region; putting a warning behind a chevron
 * is a demotion, and a demotion the reader never opens is a deletion.
 */
export interface DeeperAnalysisSection {
  groups: Array<{ title: string; rows: InspectRow[] }>
  /**
   * WARNING-severity engine critiques, already selected by the rendering
   * surface's OWN selector (`selectRenderableCritiqueEntries`) rather than by a
   * second spelling of its predicate. Copy is CEE-owned `user_message` verbatim
   * for the S/U-bucket codes — never re-humanised here, never authored here.
   */
  critiques: CritiqueWarningEntry[]
  /**
   * WARNING-severity producer `inference_warnings` — the set
   * `InferenceWarningStrip` shows, selected by the shared `isStripEntry`
   * predicate. Carried as the PRODUCER entries, not as pre-rendered strings, so
   * the strip humanises them by `code` through the one sanctioned path
   * (`humaniseCritique`) and this adapter never touches `.message`.
   */
  caveats: InferenceWarning[]
}

/**
 * The truthful run status carried into this tab. Contextualises the content;
 * it must never dominate the surface (§20).
 *
 * ⚠ `coverage` IS NOT `readiness`. `RunAdmission` remains the sole authority on
 * whether analysis may run, and nothing here is derived from it or claims to
 * speak for it. Uneven coverage is provenance, not a verdict on validity.
 */
export interface AnalysisNewStatus {
  /** No completed analysis is being displayed. */
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model. */
  isStale: boolean
  /**
   * WHY the displayed report may not match the model — never a second boolean.
   * 'changed' is a claim about the world; 'unconfirmed' is a claim about our
   * evidence. `null` when `isStale` is false. See `analysisNewCopy.status`.
   */
  staleKind: 'changed' | 'unconfirmed' | null
  /** The producer disclosed the result as partial/incomplete. */
  isProvisional: boolean
  /** Producer-owned reason, verbatim, when there is one. Never authored here. */
  statusNote: string | null
  /**
   * WHICH results did not come back, already mapped to this surface's own
   * names. Empty when the producer named none, or named only keys this build
   * does not recognise — the generic sentence then stands rather than a raw
   * token being shown.
   */
  missingResults: readonly string[]
}

/**
 * ONE option, as this surface is entitled to render it.
 *
 * ⚠⚠ A DISCRIMINATED UNION RATHER THAN NULLABLE FIELDS, AND THAT IS THE WHOLE
 * "ABSENCE IS NOT ZERO" RULE MADE STRUCTURAL. An unanalysed option does not
 * have a `winReadout` of `null` that a renderer might coalesce to `'0%'` — it
 * is a DIFFERENT SHAPE with no such field, so the component cannot reach for a
 * number that was never measured. A nullable field puts the rule in every
 * renderer's hands; a union puts it in the compiler's.
 */
export type ComparisonOption =
  | {
      kind: 'analysed'
      /** Stable identity. Tests bind to this, never to a value predicate. */
      id: string
      /** `OptionResult.label`, verbatim. Never re-worded, never truncated here. */
      label: string
      /**
       * `formatProbabilityWithResolution(winProbability, nValidSamples)` — the
       * estate's display-honesty authority, NOT a local `Math.round`.
       *
       * ⚠ WHY THAT FUNCTION AND NOT `pctOrNull`. `pctOrNull` renders a measured
       * 5-in-10,000 probability as `'0%'`, which is the exact falsehood the
       * simulation-resolution floor exists to stop ("<0.01%"). The two
       * formatters are not interchangeable and the difference only shows up on
       * the long tail of a real run — i.e. on precisely the options this
       * section was built to surface.
       *
       * `null` when the producer sent no win probability for this option. The
       * renderer then shows NO number and NO bar.
       */
      winReadout: string | null
      /**
       * The same value, 0-1, FOR BAR GEOMETRY ONLY. Never rendered as a number:
       * formatting one quantity twice is how two roundings end up on screen
       * together. `null` in lockstep with `winReadout`, so the bar and the
       * number can never disagree about whether there is a share at all.
       */
      winFraction: number | null
      /**
       * ⭐ THE PRODUCER'S OWN SENTENCE ABOUT THIS OPTION —
       * `recommendation.storyHeadlines[option.id]`, sanitised at the data layer
       * and rendered VERBATIM. Never composed, never templated, never inferred
       * from the numbers beside it.
       *
       * This is what lets the section lead with meaning rather than with a
       * percentage. It is the producer's `m1_coaching.story_headlines` map
       * (`EnrichmentM1CoachingSchema`, `additionalProperties: string`, keyed by
       * option id), and it carries a sentence for NON-LEADING options too — a
       * live capture holds *"Status Quo could come out ahead if hiring speed in
       * remote mode is slower or retention drops."* against `opt_status_quo`.
       * That is precisely the material this section existed to be missing.
       *
       * `null` when the producer sent none for this option, or sent an empty
       * string: `useResultsSectionData` sanitises a non-string value to `''`,
       * so emptiness is a real state here and must not render an empty line.
       */
      why: string | null
    }
  | {
      kind: 'not_analysed'
      id: string
      label: string
      /**
       * `notAnalysedReasonCopy(reason)`, verbatim — the estate's single source
       * for what the results panel says about an unanalysed option. Carried as
       * a RESOLVED STRING rather than as a reason code so no component can
       * re-decide the wording, and so the two sentences (`no_interventions` vs
       * `not_returned`) cannot silently collapse into one at a new call site.
       */
      reasonCopy: string
    }
  | {
      /**
       * ⭐ THE OPTION THE ANALYSIS RAN ON AND COULD NOT COMPUTE — a THIRD
       * shape, beside `'not_analysed'` and never merged into it.
       *
       * ⚠ TWO NUMBERLESS ROWS THAT MEAN DIFFERENT THINGS (CLAUDE.md trap 21).
       * `'not_analysed'` says the option was NOT IN the comparison and is
       * derived from the producer's OMISSION; this says it WAS in the
       * comparison and the computation failed, and is STATED by the producer
       * (`'failed'` ⇔ `n_valid === 0`, zero finite Monte Carlo samples). An
       * option can be analysed and not computed, so collapsing them would lose
       * the only fact that tells a reader whose gap it is — and would attribute
       * an engine outcome to the user's configuration.
       *
       * ⛔ AND THE SHAPE IS THE ENFORCEMENT, exactly as the header above argues
       * for `'not_analysed'`: no `winReadout` and no `winFraction` exist on this
       * member, so no renderer can coalesce a failed option's finite `0` into a
       * `0%` or a zero-width bar. That `0%` is what this row shipped before —
       * a fabricated measurement in the slot that answers "how often did this
       * come out ahead". A nullable field would put the rule in every
       * renderer's hands; a union puts it in the compiler's.
       */
      kind: 'not_computed'
      id: string
      label: string
      /**
       * `notComputedReasonCopy(producerReason)`, verbatim — resolved here for
       * the same reason `'not_analysed'`'s is: so no component can re-word it,
       * and so the producer-reason and no-producer-reason sentences cannot
       * silently collapse into one at a new call site.
       *
       * ⚠ The producer's reason is ABSENT from all 12 live captures, so the
       * common value of this string is the sanctioned sentence alone.
       */
      reasonCopy: string
    }

/**
 * Every option the user has, each with what the run is entitled to say about it.
 *
 * ⭐ THE GAP THIS CLOSES. On a real completed staging run the surface rendered
 * the leading option and one win percentage and NOTHING AT ALL about the other
 * options — a run with four options showed one. For a decision tool that is the
 * largest content gap on the surface: the reader cannot see whether the leader
 * won by a mile or by a whisker, and cannot see that an option they care about
 * took no part in the comparison at all.
 *
 * ⚠⚠ ORDER IS INHERITED, NEVER RE-DERIVED. `rows` is `recommendation.allOptions`
 * in the order the hook already produced it, and that order is a DESIGNATION
 * (`utils/optionDisplayOrder.ts`, ROADMAP 1.267): `sortOptionsForDisplay` is
 * called ONCE, upstream, gated on `designationsWithheld`, and returns the
 * caller's canonical order untouched when the verdict withholds the leader
 * claim. Re-sorting here — by win probability, by rank, by anything — would be
 * a SECOND designation channel wearing a different number, and it would not
 * carry that gate. Rendering the array as given is what makes this section
 * honest on a withheld run for free.
 */
export interface OptionsComparisonSection {
  rows: ComparisonOption[]
  /**
   * How many options exist in total, INCLUDING any this list cannot name.
   *
   * ⚠ SO THE SECTION ADDS UP. `rows` drops an option whose label is blank or is
   * merely its own node id — inventing "Untitled option" is the fabrication
   * `deriveComparisonScope` exists to refuse — and without this a collapsed row
   * would promise a count the body does not deliver. The renderer discloses the
   * difference as a plain count rather than silently shortening the list.
   */
  totalCount: number
}

/**
 * One of the two readings, resolved to the sentence the surface prints and the
 * option it is ABOUT.
 *
 * ⚠ `optionId` IS NOT DECORATION. It is the identity a test binds to. An
 * assertion that finds a claim by its rendered VALUE ("the row showing 62%")
 * can be satisfied by a different option that happens to share the number —
 * CLAUDE.md trap 19, which cost this estate a deleted extractor under 23,832
 * green tests. Every assertion about these claims binds to `optionId`.
 */
export interface ImplicationClaim {
  optionId: string
  /** Composed by `analysisNewCopy`, which delegates to the hero's own wording. */
  sentence: string
}

/**
 * ⭐ WHAT YOUR MODEL IMPLIES — the two readings, and whether they agree.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * This surface could show only ONE reading of a run: the win probability, in
 * "How the options compare". A win probability answers "which option most often
 * comes out on top?" and nothing else. The old Analysis tab's hero carries a
 * second and a third — the highest EXPECTED OUTCOME, and the highest chance of
 * MEETING THE USER'S OWN TARGET — and its most valuable single sentence is the
 * one that fires when those two disagree:
 *
 *   "X has the highest expected outcome."
 *   "Y has the highest chance of meeting your goal and limits."
 *
 * That disagreement is the product's whole thesis in one place. It is not a
 * defect in the run and it is not noise: it is two defensible readings of the
 * same numbers pointing at different options, which is exactly the moment a
 * team has to supply judgement the model cannot. The Reasoning tab did not have
 * it, and "the other sections aren't that valuable" is the predictable result of
 * a reasoning surface that only ever states one reading.
 *
 * ── ⚠⚠ THE GOAL CROWN IS NOT RE-DERIVED ────────────────────────────────────
 * The second reading is `selectGoalLeader`'s own output — THE owner of the
 * goal-metric crown, called, never copied. It carries the rules that were
 * expensive to get right:
 *
 *   · AVAILABILITY vs ENTITLEMENT. "May I DISPLAY this?" is `.some`; "may I
 *     CLAIM a leader?" is `.every`. One revision of ROADMAP 2.233 merged them
 *     and had to be reverted. This section asks ONLY the entitlement question
 *     for its claims, because a sentence naming two options is a claim — never
 *     a display — and asks the availability question ONLY to decide whether an
 *     honest unlock exists to offer.
 *   · UI-SEM-071 (no user target, no goal claim), the complete-field gate, the
 *     unique maximum, and the sub-1% floor.
 *
 * WITHHELD DESIGNATIONS (ROADMAP 1.267) are applied first and unconditionally:
 * a sentence naming two options is the largest designation this surface makes.
 *
 * ⚠ THE OUTCOME ARGMAX IS WRITTEN LOCALLY, AND THE REASON IS RECORDED ON THE
 * BUILDER. In short: `selectGoalLeader` is a PROBABILITY selector (its floor and
 * its presence test both assume 0..1), an expected outcome is a signed quantity
 * in the run's own units, and pushing one through the other would be trap 21 —
 * one name answering two questions. The entitlement SHAPE is deliberately
 * identical, because the reasoning generalises even where the function cannot.
 */
export type ModelImplication =
  /**
   * The two readings name DIFFERENT options. The crown jewel.
   */
  | { kind: 'diverged'; outcome: ImplicationClaim; goal: ImplicationClaim }
  /**
   * The two readings name the SAME option. Agreement is informative — it is the
   * evidence that the choice is robust across two different questions — so it
   * is stated, not silently dropped.
   */
  | { kind: 'aligned'; label: string; outcome: ImplicationClaim; goal: ImplicationClaim }
  /**
   * ⭐ THE STATE THAT WILL FIRE MOST OFTEN, AND THE REASON IT IS NOT AN ERROR.
   *
   * The outcome reading is available on essentially any successful run. The goal
   * reading needs a SUCCESS TARGET, and a target is a USER ACTION — not a
   * producer gap. So on a run where nobody set one, the second reading does not
   * exist to be shown, and no honest surface can invent it.
   *
   * What it must NOT do is stay silent, and what it must not do is nag. The
   * surface states the reading it has, and names the target as the thing that
   * UNLOCKS A SECOND WAY OF READING THE RUN — reasoning the user cannot
   * currently do — rather than as a missing field to go and fill in.
   *
   * ⚠ GATED NARROWER THAN "no goal leader": the unlock is offered only when
   * `hasAnyGoalValue` is false AND no threshold exists — i.e. the goal reading
   * is absent BECAUSE no target exists. A run that HAS a target and merely lacks
   * goal probabilities is a producer gap, where "set a success target" would be
   * false advice — that case falls to `none`, as does a target-bearing run whose
   * crown is withheld for a tie, an incomplete field, or the sub-1% floor. In
   * every one of those we are not entitled to a second claim AND have no honest
   * unlock to offer, so we say nothing.
   */
  | { kind: 'needs_target'; outcome: ImplicationClaim }
  /** Nothing this run is entitled to say. Renders nothing at all. */
  | { kind: 'none' }

/**
 * The producer-classified sensitivity findings — "what would change your mind".
 *
 * ⚠ PRESENCE-GATED AT THE MOUNT, WITH NO EMPTY STATE, AND THAT IS DELIBERATE.
 * An empty list here cannot distinguish *"the run tested this and nothing would
 * flip it"* from *"the run did not test it"*, and only one of those is good
 * news. The panel already carries that exact trap once, in
 * `ChecksSection`/`evidenceAssessed`, where it needed a producer signal to
 * resolve. No such signal exists for sensitivity, so the honest move is to
 * render nothing rather than to author a reassurance the data cannot support.
 */
export interface SensitivitySection {
  findings: AnalysisNewFinding[]
}

export interface AnalysisNewViewModel {
  status: AnalysisNewStatus
  atAGlance: AtAGlance
  /** ⭐ The two readings and whether they agree. Sits with the glance. */
  modelImplication: ModelImplication
  optionsComparison: OptionsComparisonSection
  keyInsights: KeyInsightsSection
  strengthen: StrengthenSection
  drivers: DriversSection
  uncertainty: UncertaintySection
  /**
   * ⭐⭐ WHAT WOULD CHANGE YOUR MIND — split OUT of `uncertainty`, not copied.
   *
   * ⚠ WHY IT IS ITS OWN SECTION. The producer's `SENSITIVE_ASSUMPTION` rows
   * carry the single most decision-relevant sentence this product emits — *"If
   * X changes significantly, Y could become the better choice"* — which names
   * the ALTERNATIVE WINNER. Witnessed on staging `e685dafa`, that sentence
   * rendered as row 3 of 5 inside a COLLAPSED section titled "Uncertainty and
   * gaps", twelfth of fourteen elements on the panel. A heading that reads as a
   * list of caveats is where a reader files things they can safely skip, and
   * this is the one row they cannot.
   *
   * ⚠ THE SPLIT IS DECIDED ONCE, IN THE BUILDER, ON THE PRODUCER'S OWN `code`.
   * No consumer filters, and nothing matches on prose — the sentence's wording
   * is the producer's and may change; `code === 'SENSITIVE_ASSUMPTION'` is the
   * contract. A copy-matching predicate here would be the class of guess this
   * estate keeps paying for.
   *
   * ⚠ AND THE ROWS ARE MOVED, NEVER DUPLICATED. `uncertainty` keeps evidence
   * gaps, ledger assumptions and the resolve-next reading; a row appears in
   * exactly one of the two sections. The first-viewport census would catch a
   * copy, and a reader meeting the same sentence twice is the defect this
   * panel has already shipped three times.
   */
  sensitivity: SensitivitySection
  deeper: DeeperAnalysisSection
  /** ⭐ What the run CHECKED — including the checks it did not make. */
  checks: ChecksSection
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT WE CHECKED — the trust readout, and the only surface that speaks for
// the checks the run DID NOT make
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⭐⭐ WHY THIS SECTION EXISTS, AND WHY IT IS NOT A RESTATEMENT.
 *
 * "At a glance" answers WHAT THE RUN FOUND. This answers WHAT THE RUN CHECKED.
 * They are different questions and they are named apart deliberately
 * (CLAUDE.md trap 21) — aligning them would be the wrong fix.
 *
 * The gap is measurable, not theoretical. On this tab a check that was NOT
 * MADE currently renders as SILENCE, in all three cases:
 *   · leader      — `buildGlance` sets `headline = null` unless
 *                   `verdict.hasLeadingOption === true`, so an unassessed
 *                   comparison and a genuine tie both show nothing.
 *   · robustness  — `VERDICT_WORD` omits `'not_assessed'` DELIBERATELY (it
 *                   must not render a fourth word that reads as a
 *                   measurement), so `verdictBlock` is `null` and no chip
 *                   appears at all.
 *   · evidence    — an empty gap list renders an empty section whether or not
 *                   the producer ever looked.
 *
 * Silence reads as "fine". That is the defect: a reader cannot tell
 * "we looked and found nothing" from "we did not look", and only one of those
 * is reassurance. This section makes the distinction visible, and it is the
 * ONLY place on the surface that does.
 *
 * ⚠ IT ADDS NO ORACLE. Every state below is read from the same three
 * authorities the rest of the tab already quotes — `recommendation.verdict`
 * (`src/lib/decisionVerdict.ts`), `recommendation.robustnessVerdict`, and
 * `confidence.evidenceGaps` + `evidenceGapsAssessed`. There is no fourth
 * reading of anything here.
 */
export type ChecksCode =
  /** `verdict.hasLeadingOption === true`. */
  | 'leader_present'
  /**
   * `separation === 'tied'` — the ONLY state that licenses an affirmative
   * denial. `decisionVerdict.ts:166-168`: "`false` — surfaces must NOT badge,
   * and MAY say 'no clear leading option' (only when `separation === 'tied'`;
   * `'unknown'` licenses silence, never a denial)".
   */
  | 'leader_tied'
  /** `separation === 'unknown'`, or no verdict on the wire at all. */
  | 'leader_not_assessed'
  | 'robustness_robust'
  /** `'moderate'` or `'fragile'` — the producer made a claim and it is not clean. */
  | 'robustness_sensitive'
  /** The producer's EXPLICIT `'not_assessed'`. */
  | 'robustness_not_assessed'
  /** The field is absent — an older producer build said nothing at all. */
  | 'robustness_unknown'
  /** Gaps were found and every one is addressed. */
  | 'evidence_all_addressed'
  /** Gaps were found and some are outstanding. */
  | 'evidence_gaps'
  /** Assessed, none found — a real, licensed all-clear. */
  | 'evidence_none_flagged'
  /** Never assessed — an empty list that is NOT an all-clear. */
  | 'evidence_not_assessed'

/**
 * The glyph state. THREE values, and the third is the whole point.
 *
 * ⚠ `'not_assessed'` is NOT a failure and must never render as one — an
 * undetermined check is the absence of a verdict, not a negative one. It is
 * also NOT a pass, which is the direction the old tab blurred: it rendered the
 * muted glyph for BOTH "assessed, none found" and "never assessed", so the one
 * distinction the third state exists to preserve was carried by the label
 * alone. Here they are different states.
 */
export type ChecksState = 'pass' | 'finding' | 'not_assessed'

export interface ChecksItem {
  /** Which of the three checks this row is. Stable identity for tests. */
  id: 'leader' | 'robustness' | 'evidence'
  code: ChecksCode
  state: ChecksState
}

export interface ChecksSection {
  /**
   * Always the three checks, in a fixed order, or EMPTY pre-run.
   *
   * ⚠ A partial list would defeat the section: "which checks were not made"
   * cannot be read off a list that drops them. The rows are always present and
   * it is their STATE that varies.
   */
  items: readonly ChecksItem[]
}

// ═══════════════════════════════════════════════════════════════════════════
// AT A GLANCE — the 5-to-10-second strategic read
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The trust qualification, as a VISIBLE state plus a producer-authored reason.
 *
 * ⚠ THE SPLIT IS THE POINT. `tone`/`label` is essential analytical state and
 * stays visible; the SCOPE of the claim ("across the simulated range") is the
 * producer's own sentence and is rendered verbatim beneath, never composed
 * here. An earlier concept read "Robust across most tested uncertainty" — a
 * COVERAGE claim ("most") that nothing computes. The producer says what it
 * tested; this surface does not summarise it.
 */
export interface GlanceVerdict {
  tone: 'stable' | 'mixed' | 'sensitive'
  /** One word, user-facing. Content-strategy rename of the producer enum. */
  label: string
  /** `robustness.display_verdict_reason`, VERBATIM. Absent when not sent. */
  reason?: string
}

/** One driver row: a label, a comparable magnitude, and a focus target. */
export interface GlanceDriver {
  id: string
  label: string
  /** 0-1 against the STRONGEST driver in this run — a within-run comparison. */
  fraction: number
  /**
   * Focus target, or null when the producer named none / it is not on the
   * canvas. Null renders as text, never as a dead affordance — the
   * fail-closed pre-gate the analysis-hero prototype already established.
   */
  targetId: string | null
}

/**
 * "Could change if" — a TIPPING POINT, a different analytical dimension from
 * the influence ranking above it.
 *
 * ⚠ NEVER DERIVED FROM INFLUENCE. Influence ranks what moves the outcome;
 * this names the value at which the ORDERING changes. Conflating them would
 * put the same signal on screen twice under two names. Sourced from
 * `flipThresholds` and gated on `flipThresholdsStatus`.
 */
export interface GlanceCondition {
  text: string
  targetId: string | null
}

/**
 * One option the run did not analyse, ready to render with the SANCTIONED copy.
 *
 * ⚠ `reasonCopy` is `notAnalysedReasonCopy(...)` — the estate's single source
 * for what the results panel says about an unanalysed option. It is carried as
 * a resolved string rather than as a reason code so that no component can
 * re-decide the wording, and so the two sentences (`no_interventions` vs
 * `not_returned`) cannot silently collapse into one at a new call site.
 */
export interface GlanceExcludedOption {
  id: string
  label: string
  /** `notAnalysedReasonCopy(reason)`, verbatim. States "no rank and no probability". */
  reasonCopy: string
}

/**
 * Can the win share be read at all, and if so does it need qualifying?
 *
 * ⚠⚠ THIS TYPE EXISTS BECAUSE `deriveComparisonScope` RETURNS `null` FOR TWO
 * DIFFERENT QUESTIONS, AND ONLY ONE OF THEM LICENSES AN UNQUALIFIED NUMBER.
 * Its documented say-nothing states are: (1) nothing excluded, (2) nothing
 * analysed, (3) empty input. State 1 means *the share describes every option
 * you have* — show it bare. States 2 and 3 mean *we cannot establish what the
 * share ranges over* — and a percentage whose candidate set is unknown is the
 * ambiguous number this whole change exists to stop.
 *
 * Reading that one `null` as "no note needed" is CLAUDE.md trap 21 exactly:
 * two questions under one name, where the fail-open answer is right for one and
 * a falsehood for the other. Named apart here so a consumer must choose.
 */
/**
 * WHICH KIND of set-dependent claim this glance actually puts on screen — and
 * therefore how much of the scope register is true of it.
 *
 * ⚠⚠ DERIVED ONCE, IN THE BUILDER, BESIDE `comparisonScope`. The first attempt
 * gated the disclosure on the win share alone and INTRODUCED A REGRESSION: a
 * leader determined by expected outcome carries a null win probability, so the
 * surface named a leader among 2 of 3 options and asserted the ordering held,
 * with nothing anywhere about the third. Trap 21 one level up — the gate
 * answered "is the percentage present?" while the property is "is a
 * set-dependent claim present?". This surface makes THREE: the headline
 * superlative, the win share, and the robustness ordering verdict.
 *
 * The split follows `ComparisonScopeNote`'s OWN documented rule, not taste:
 * set-dependent VALUES take `COMPARISON_SCOPE_COPY.detail` ("ranks and
 * comparative percentages describe those N only"), while set-dependent ORDER
 * over invariant values takes the neutral sentence alone — `detail` there would
 * be an untruth in the opposite direction, describing a magnitude that is not
 * on screen as set-dependent.
 */
export type GlanceComparativeClaim =
  /** The win share RENDERS. `detail` is true of it. */
  | 'value'
  /** A superlative or an ordering verdict renders, but no percentage. Sentence only. */
  | 'order'
  /** Nothing set-dependent is on screen. Qualify nothing. */
  | 'none'

export type GlanceComparisonScope =
  /** Every option the user has was in the comparison. The share needs no qualifier. */
  | { kind: 'whole_set' }
  /** Some options were excluded. The share is TRUE ONLY alongside this scope. */
  | { kind: 'partial'; scope: ComparisonScope; excluded: GlanceExcludedOption[] }
  /** The candidate set cannot be established. The share is WITHHELD, not qualified. */
  | { kind: 'unresolved' }

export interface AtAGlance {
  /** The current read. Absent when no producer licenses a synthesis. */
  headline: string | null
  /**
   * The leading option's LABEL alone, so the surface can typeset the name as
   * the answer and choose its own framing verb. Same source as `headline`
   * (`recommendation.recommendedOption.label`) under the same entitlement — it
   * is that sentence's subject, not a second claim.
   *
   * ⚠ WHY THE SURFACE NEEDS THE SUBJECT SEPARATELY: `headline` is composed here
   * in the present tense ("currently scores higher"), and a present-tense claim
   * is false on a STALE run. Carrying the subject lets the renderer frame it as
   * "as last analysed" without this adapter having to know about freshness.
   */
  leaderLabel: string | null
  /**
   * The evidence behind the read, as a sentence. Gated on the SAME entitlement
   * as `headline` — a win share with no entitled leader is a number about an
   * option the producer declined to put forward.
   *
   * ⚠ AND GATED A SECOND TIME, ON SCOPE. Null when `comparisonScope.kind` is
   * `'unresolved'`: a percentage is a claim about a candidate set, so with no
   * establishable set there is no claim to make. Suppressing beats qualifying
   * here — "60%, of we-cannot-say-what" is not a smaller version of the truth.
   */
  winShare: string | null
  /**
   * The same value unformatted, 0-1, FOR BAR GEOMETRY ONLY. Never rendered as
   * a number: formatting it a second way is how two different roundings of one
   * quantity end up on screen together.
   */
  winFraction: number | null
  /**
   * What the win share ranges over. Rendered BESIDE the number, never behind
   * disclosure: it changes what the number means, so a reader who sees one
   * must see the other.
   */
  comparisonScope: GlanceComparisonScope
  /**
   * What kind of set-dependent claim is actually rendered. Gates the scope
   * disclosure AND chooses how much of the register is true of it.
   *
   * ⚠ Derived from the SAME model fields the components render from, so the
   * gate and the render cannot drift — an earlier version read the model's
   * `winShare` while the share additionally required `verdict`, and the two
   * disagreed on a reachable state.
   */
  comparativeClaim: GlanceComparativeClaim
  verdict: GlanceVerdict | null
  drivers: GlanceDriver[]
  /**
   * TRUE when the bars are set-relative (`normalised_elasticity`) rather than
   * the producer's absolute influence scale. Drives the basis caption, which
   * is a truth claim and therefore visible, not hover-only.
   */
  influenceIsSetRelative: boolean
  condition: GlanceCondition | null
  /**
   * ⭐ THE ANTECEDENT OF EVERY READING ABOVE IT — where the factor values this
   * run consumed came from. Null ONLY when there are no factor rows to
   * describe; a run whose rows the producer left unsettled is the
   * `undetermined` KIND, which renders, because a reading with no stated basis
   * is what this line exists to prevent.
   *
   * ⚠ NOT `condition`, AND THE DISTANCE MATTERS (CLAUDE.md trap 21). `condition`
   * is the TIPPING POINT — the value at which the ordering changes, from
   * `flipThresholds`. This is INPUT PROVENANCE — who authored the numbers that
   * went in, from `isDefaultedConfidence` / `valueDefaulted`. Different
   * producers, different questions; naming them alike is how one gets read as
   * the other.
   */
  inputProvenance: GlanceInputProvenance | null
}

/**
 * ⭐⭐ WHOSE NUMBERS THE RUN ACTUALLY USED — six kinds, and the split between
 * the universal and the "partly" forms is the entire honesty claim.
 *
 * Derived from the producer's THREE-STATE per-factor value provenance
 * (`HeroDriverValueProvenance`, adjudicated at live captures by the hero lane):
 * a factor is `estimated` when the producer said so, `not_estimated` when the
 * producer denied it BOTH WAYS, and `undetermined` when it asserted neither.
 * The third state is the majority case on real payloads, because PLoT omits
 * `value_defaulted` on rows whose value came from `cee_inference` — i.e. the
 * values the product invented. Reading that silence as "the user's" is the
 * precise lie this line exists to prevent.
 *
 * So the two directions are gated ASYMMETRICALLY, because they are not the same
 * harm. Claiming user authorship the product never had is the defect; declaring
 * Olumi's own estimate merely errs toward disclosure. Both unqualified forms
 * still require the producer to have settled EVERY factor.
 *
 *   · `estimated`            — every factor settled, all of them Olumi's.
 *   · `partly_estimated`     — at least one is Olumi's, none is the user's, and
 *                              the producer stayed silent on the rest.
 *   · `mixed`                — at least one of each is positively witnessed.
 *                              Silence on other factors cannot falsify it.
 *   · `user_supplied`        — every factor settled, all of them the user's.
 *   · `partly_user_supplied` — at least one is the user's, none is Olumi's, and
 *                              the producer stayed silent on the rest.
 *   · `undetermined`         — factor rows EXIST and the producer settled not
 *                              one of them. See below: this is a kind, not an
 *                              absence, and that distinction is the fix.
 *
 * ⭐⭐ WHY `undetermined` IS A KIND AND NOT `null` (added after measuring why
 * this line never reached a screen). The per-factor oracle is THREE-state, and
 * this set-level type used to have names for only two of them: the third was
 * folded into `null` alongside "there is nothing to describe". Two different
 * facts under one name is CLAUDE.md trap 21, and the cost was concrete —
 * replaying this oracle over every factor-bearing capture in the repo returns
 * `estimated` on 7 files, `partly_estimated` on 9, and NOTHING on 9 more whose
 * rows are all real and all unsettled. On those nine the panel printed "Ahead
 * in N% of simulated futures" and stated its basis in no place at all, which
 * is the precise condition Olumi's alignment principle forbids: the consequent
 * prominent, the antecedent nowhere.
 *
 * `undetermined` says only what is true — that the producer did not settle
 * where these figures came from. It is a claim about OUR knowledge, never
 * about the user, and so it cannot commit the authorship lie the other five
 * words risk.
 *
 * ⛔ AND IT IS STILL NOT A COUNT. The wire carries a per-factor flag. "Six of
 * nine inputs were unsettled" is a proportion nothing licenses.
 *
 * `null` now means exactly one thing: there are no factor rows to describe.
 * That is a DRIVERS-FEED condition, not a provenance one — the producer hook
 * downgrades `driversStatus` 'computed' → 'unavailable' whenever the row set
 * is empty, so zero rows always means the sensitivity feed was unavailable or
 * errored. Describing a transport failure as a provenance finding would be the
 * same two-questions-one-name defect in the other direction, so the surface
 * stays silent there and the spec pins it.
 */
export type GlanceInputProvenance =
  | 'estimated'
  | 'partly_estimated'
  | 'mixed'
  | 'user_supplied'
  | 'partly_user_supplied'
  | 'undetermined'

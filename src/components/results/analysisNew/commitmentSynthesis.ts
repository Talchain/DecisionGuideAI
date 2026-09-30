/**
 * ⭐ "MOVE TOWARDS COMMITMENT" — three short bullets, built from the view model
 * the panel already has. Reasoning V2, prototype `synthesisHTML()`.
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 * A SELECTION over sentences this panel already renders elsewhere. It computes
 * nothing, scores nothing and composes no new claim: every bullet is an
 * existing copy constant or a view-model string, verbatim. The three questions
 * are the prototype's; the answers are the run's own.
 *
 *   founded  — "What seems well-founded"
 *   open     — "What remains uncertain"
 *   before   — "Before committing"
 *
 * A bullet with no truthful content is `null` and does not render. Pre-run all
 * three are `null`: there is no run to synthesise.
 *
 * ── ⛔ WHAT IT REFUSES TO DO ───────────────────────────────────────────────
 * · No winner or recommendation wording. Nothing here names an option except
 *   through a sentence the view model already emits on this run.
 * · No "well-founded" claim about EVIDENCE. The first bullet is a model-relative
 *   reading ("In this model…", "…of this run…"), never a statement that the
 *   inputs are well supported.
 * · No robustness or stability word the view model's gated checks did not
 *   supply.
 * · No prose matching. Every choice is keyed on a VM kind, code or boolean.
 *
 * ── STALE ──────────────────────────────────────────────────────────────────
 * `describesLastRun` carries `status.isStale`; the component states it once with
 * the panel's existing marker (`markers.stale`, "From an earlier run"). The
 * bullets themselves are not re-tensed.
 */
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { AnalysisNewViewModel, ChecksCode } from './analysisNewTypes'
import type { RunDeltaInputRow, RunDeltaView } from './runDeltaView'

// ═══════════════════════════════════════════════════════════════════════════
// COPY — only the words this zone adds. Every bullet BODY is someone else's.
// ═══════════════════════════════════════════════════════════════════════════

export const COMMITMENT_COPY = {
  /** The zone heading. Names the section; asserts nothing about the run. */
  heading: 'Move towards commitment',
  /**
   * ⭐ V2 FIDELITY (24 Sep 2026, gap 18): SHORTENED to the prototype's own three
   * words (`commit-synthesis`'s `<b>` labels). "What seems well-founded" was the
   * longest label on the panel at the 280px dock floor — it alone filled most of
   * the first line — and "well-founded" made a claim about EVIDENCE the
   * docblock above already disclaims ("No 'well-founded' claim about EVIDENCE").
   * The BODY of each bullet, and every rule that selects it, is unchanged: only
   * the heading word shortens.
   */
  labels: {
    founded: 'What we have',
    /**
     * ⚠ "UNCERTAIN", NOT "UNCERTAIN OR DISPUTED". Every source this bullet reads
     * is a statement about the RUN (a withheld leader, a threshold, an unmade
     * check, an evidence gap). None is a record of disagreement, so the word
     * "disputed" would claim a dispute nothing measured.
     */
    open: 'Still open',
    before: 'Before acting',
    /** V2 `synthesisHTML()`: bullet 1's label on a stale run — it describes the LAST run. */
    lastRun: 'Last run',
  },
  /**
   * ⭐⭐ WAVE 2: bullet 1 on a withheld run — see `FoundedSource.withheld_count`.
   *
   * ⚠ COUNT ONLY, NOT THE GOAL. The prototype's own sentence names the goal
   * too ("...compared for productivity"), but that label
   * (`buildModelStrip.ts`'s `goalLabel`) is computed from canvas nodes in
   * `AnalysisNewTabBody.tsx` — outside `AnalysisNewViewModel`, and outside
   * this wave's file set — so it is not reachable from here without wiring a
   * second input through a file this change does not own. Reported in the PR
   * description; count-only is the truthful subset this module can state on
   * its own.
   */
  withheldFounded: (count: number): string =>
    `${count} option${count === 1 ? '' : 's'} compared.`,
  /**
   * The same bullet when the run left some options out: "2 of 3 options
   * compared." It matches the Analysis tab's "Comparing 2 of 3 options" for the
   * same run (served funding brief, 30 Sep 2026, where the plain count said 3).
   */
  withheldFoundedOf: (compared: number, total: number): string =>
    `${compared} of ${total} options compared.`,
  ask: {
    /** Tooltip and accessible name of the AI icon. */
    label: 'Ask Olumi what remains before committing',
    /** The editable draft the ask opens with. The user's question, not a claim. */
    draft: 'What remains open before I commit to a view on this decision?',
  },
  /**
   * ⭐ V2 prototype `commitHTML()`: the TITLE's ✦ is "help summarise your
   * reasoning"; "what remains" (`ask`, above) is the COMMIT ROW's, beside
   * compare. The user's request, not a claim about the run.
   */
  summarise: {
    label: 'Ask Olumi to help summarise your reasoning',
    draft: 'Help me summarise my reasoning on this decision so far.',
  },
  /**
   * ⭐ V2 `synthesisHTML()` (stale): bullet 3's own sentence. It used to reuse
   * the stale row's ACT label ("Re-run to be sure"), and since #2071 that act
   * sits directly below the bullets — the same three words twice, one as
   * advice and one as a button. The act keeps its words; the bullet says what
   * the re-run is for.
   */
  rerunBefore: 'Re-run before relying on this comparison.',
  /**
   * V2 `synthesisHTML()` (edited): bullet 2 on a run the model has moved past.
   * What is open is the change itself. Repeating the last run's withholding
   * reason here mixed an old run with a verdict re-read on the edit turn: on
   * Paul's MRR brief it changed wording with no new run (Panel's prototype
   * comparison, served 1a8afc11, 26 Sep 2026).
   */
  changeNotAnalysed: 'The effect of the latest change has not been analysed yet.',
  /** V2 `synthesisHTML()` bullet 2 at rest ("…lacks assessed evidence"): the evidence check's own state. */
  evidenceNotAssessed: 'The evidence behind the inputs has not been assessed.',
  /**
   * Bullet 2 when CEE withheld the leader because nobody asked for this run
   * (`unrequested_analysis_withheld`). "Could not confirm" read as a failed
   * check on Paul's test (27 Sep); the true cause is the policy. "Can", not
   * "will": a run the user starts may still withhold for another reason.
   */
  firstPassWithheld: "This is Olumi's automatic first pass, which does not put an option forward; a run you start can.",
  /** Bullet 3 on that run: the move that can change it. */
  firstPassBefore: "Check Olumi's estimates, then run the analysis.",
  /** V2 `synthesisHTML()` (re-run): the consequence leads. Producer noise verdicts only. */
  sinceLastRun: {
    noneMoved: 'Since the last run, no option moved beyond ordinary run-to-run variation.',
    oneMoved: (label: string, from: string, to: string) => `Since the last run, ${label} moved from ${from} to ${to}.`,
    someMoved: (n: number) =>
      n === 1
        ? 'Since the last run, one option moved beyond ordinary run-to-run variation.'
        : `Since the last run, ${n} options moved beyond ordinary run-to-run variation.`,
    /** CEE `unrequested_run_in_pair` (exact match): the previous run was the automatic first pass. Wording: DL #70 5852289012. */
    notComparedWithFirstPass: "This run is not compared with Olumi's automatic first pass; the next re-run will show what moved.",
    /**
     * ⭐ WHAT CHANGED, BEFORE WHAT MOVED (V2 prototype re-run state; Panel, 30 Sep 2026). The producer's exact
     * input change (CEE #2378 `input_changes`, through the one reader), stated as a sentence. Values are the
     * producer's, formatted by `buildRunDeltaView`; nothing is computed here. It says what changed, never
     * why an option moved: attribution is the producer's C1, and a pair it cannot attribute says so on the
     * Compare tab. Passive voice on purpose: the row does not say who made the change.
     */
    inputChanged: (subject: string, before: string, after: string) => `Since the last run, ${subject} changed from ${before} to ${after}.`,
    inputSet: (subject: string, after: string) => `Since the last run, ${subject} was set to ${after}.`,
    inputCleared: (subject: string) => `Since the last run, ${subject} was cleared.`,
    optionJoined: (subject: string) => `Since the last run, ${subject} joined the comparison.`,
    optionLeft: (subject: string) => `Since the last run, ${subject} left the comparison.`,
    linkAdded: (subject: string) => `Since the last run, ${subject} was added to the model.`,
    linkRemoved: (subject: string) => `Since the last run, ${subject} was removed from the model.`,
    /** More than one row. The count is stated only when the producer says its record is complete. */
    inputsChanged: (n: number, first: string) => `Since the last run, ${n} inputs changed, including ${first}.`,
    inputsChangedSome: (first: string) => `Since the last run, inputs changed, including ${first}.`,
    /**
     * What moved, when it FOLLOWS the input sentence: the same words without a second "Since the last run,"
     * (one lead per bullet; "Since the last run, … Since the last run, …" reads as a stutter).
     */
    after: {
      noneMoved: 'No option moved beyond ordinary run-to-run variation.',
      oneMoved: (label: string, from: string, to: string) => `${label} moved from ${from} to ${to}.`,
      someMoved: (n: number) =>
        n === 1 ? 'One option moved beyond ordinary run-to-run variation.' : `${n} options moved beyond ordinary run-to-run variation.`,
    },
  },
  /**
   * ⭐ V2 prototype, "Draft" state (28 Sep 2026, Panel): before any run the zone
   * still says what the reader has and what to do next, and carries the run act.
   * Both are true with no analysis: a count of the option nodes on the model, and
   * the move that the act beneath them performs. Nothing about any option's effect.
   */
  preRun: {
    founded: (count: number): string => `The draft sets out ${count} option${count === 1 ? '' : 's'}.`,
    before: 'Check the framing, then run the analysis.',
  },
  /** V2 `synthesisHTML()`: the inline ✦ after "Still open". */
  openAsk: {
    label: 'Ask Olumi about unresolved uncertainty',
    draft: 'What is still unresolved here, and how could I examine it?',
  },
  compare: {
    /** Only ever rendered with a route. There is no disabled state to name. */
    label: 'Compare with the last run',
  },
  record: {
    /** The door. The user's view, never an Olumi decision. */
    open: 'Record your view',
    /** The read-back heading. */
    recorded: 'Your recorded view',
    /** Label of the chosen-option row in the read-back. */
    optionLabel: 'Your view',
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Where bullet 1 came from. One value per `modelImplication.kind` that speaks. */
export type FoundedSource =
  /** `COPY.implications.alignedLead(vm.modelImplication.label)` */
  | 'implication_aligned_lead'
  /** `COPY.implications.divergedLead` */
  | 'implication_diverged_lead'
  /** `vm.modelImplication.outcome.sentence` (the `needs_target` state) */
  | 'implication_outcome_claim'
  /**
   * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): a withheld run still has a
   * TRUE first bullet — how many options this comparison actually holds
   * (`optionsComparison.rows.length`). Prototype `synthesisHTML()`'s own
   * `a` on this state: "Four options compared for productivity." — the count,
   * never a reading of which option leads.
   */
  | 'withheld_count'
  /** `COMMITMENT_COPY.sinceLastRun`, alone (no other first bullet). */
  | 'since_last_run'

/** Where bullet 2 came from, in priority order. */
export type OpenSource =
  /** (0) `COMMITMENT_COPY.changeNotAnalysed`, on a run the model has moved past (a re-run would change it). */
  | 'change_not_analysed'
  /** (a) `vm.checks.leaderWithholdCause`, when the leader was withheld and the cause is nameable. */
  | 'leader_withheld_cause'
  /** (a) `COPY.checks.leader_not_assessed.meaning`, when withheld and the cause is not nameable. */
  | 'leader_withheld'
  /** (a) `COMMITMENT_COPY.firstPassWithheld`, when withheld on Olumi's automatic first pass. */
  | 'first_pass'
  /** (b) `COPY.disclosure.tippingPoint(...)` over `vm.sensitivity.tippingPoints[0]`. */
  | 'tipping_point'
  /** (c) `COPY.checks[robustnessCode].meaning`. */
  | 'robustness'
  /** (d) the first `gap:` finding's `headline` in `vm.uncertainty.findings`. */
  | 'evidence_gap'
  /** (e) `COMMITMENT_COPY.evidenceNotAssessed`. */
  | 'evidence_not_assessed'

/** Where bullet 3 came from. */
export type BeforeSource =
  /** `COMMITMENT_COPY.rerunBefore` on a stale run a re-run could change. */
  | 'rerun'
  /** `vm.strengthen.interventions[0].title`, verbatim. */
  | 'intervention'
  /**
   * ⭐ V2 prototype ("Before acting: Test the belief or record why you accept
   * it."). The always-true next move when no other source applies and the
   * Challenge card already shows an item: answer it, or record the view.
   * Names no option and claims nothing about the run.
   */
  | 'respond_or_record'
  /** `COMMITMENT_COPY.firstPassBefore` on Olumi's automatic first pass (the leader withheld for that reason). */
  | 'first_pass'

export interface CommitmentBullet<S extends string> {
  text: string
  /** Stable identity for tests and `data-source`; never rendered as copy. */
  source: S
}

export interface CommitmentSynthesis {
  /** `vm.status.isStale`: the bullets describe a run that may not match the model. */
  describesLastRun: boolean
  /** Which staleness: 'changed' (the model moved) or 'unconfirmed' (we cannot tell). */
  staleKind: 'changed' | 'unconfirmed' | null
  founded: CommitmentBullet<FoundedSource> | null
  open: CommitmentBullet<OpenSource> | null
  before: CommitmentBullet<BeforeSource> | null
}

export type CommitmentSynthesisInput = Pick<
  AnalysisNewViewModel,
  | 'status'
  | 'leaderClaimPermitted'
  | 'modelImplication'
  | 'checks'
  | 'sensitivity'
  | 'uncertainty'
  | 'strengthen'
  /** ⭐ WAVE 2: `withheldFoundedBullet`'s count — see its own note. */
  | 'optionsComparison'
  | 'whatsChanged'
  | 'runDeltaAbsenceReason'
>

// ═══════════════════════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ THE BUILDER'S OWN ID SCHEME FOR AN EVIDENCE-GAP FINDING
 * (`buildAnalysisNewViewModel.ts`, `evidenceGapFinding`: `gap:${factorId}`).
 * Not exported there and that file is out of this change's scope, so it is
 * restated here and PINNED against the real builder by
 * `commitmentSynthesis.spec.ts` — a rename there reds this.
 */
export const EVIDENCE_GAP_ID_PREFIX = 'gap:'

/**
 * (c) The robustness codes that mean "robustness was not established on this
 * run", each of which already carries its own true sentence in
 * `COPY.checks[code].meaning`. `robustness_robust` and `robustness_sensitive`
 * are determinate, licensed verdicts and are deliberately NOT here.
 */
const ROBUSTNESS_NOT_ESTABLISHED = [
  'robustness_not_established',
  'robustness_not_assessed',
  'robustness_unknown',
] as const satisfies readonly ChecksCode[]
type RobustnessNotEstablished = (typeof ROBUSTNESS_NOT_ESTABLISHED)[number]

const isRobustnessNotEstablished = (code: ChecksCode): code is RobustnessNotEstablished =>
  (ROBUSTNESS_NOT_ESTABLISHED as readonly ChecksCode[]).includes(code)

/**
 * ⭐⭐ WAVE 2: BULLET 1 ON A WITHHELD RUN — the count, and NOTHING that reads
 * as a ranking. `rows.length` is `OptionsComparison`'s own population (every
 * row it renders, named options only — see `OptionsComparisonSection.rows`'s
 * own note on why `totalCount` over-counts), so this states exactly what the
 * chart beside it shows, never a second count computed here.
 *
 * `null` when there is nothing to count — pre-run already returns `EMPTY`
 * above this call, but a withheld run with zero rows is not impossible, and a
 * bullet naming zero options would be furniture over an empty chart.
 *
 * ⚠ "COMPARED" IS A CLAIM ABOUT THE RUN, so it counts only the rows the run
 * compared. `rows` also lists the options the run left out (`not_analysed`,
 * shown with a "Not analysed" badge); counting those said "3 options compared."
 * on Paul's funding brief while the Analysis tab said "Comparing 2 of 3"
 * (served `7bfe1b04`, 30 Sep 2026). When some were left out, the bullet says
 * "N of M". Spec: `whatWeHaveCountsOnlyComparedOptions.spec.ts`.
 */
function withheldFoundedBullet(vm: CommitmentSynthesisInput): CommitmentBullet<FoundedSource> | null {
  const total = vm.optionsComparison.rows.length
  // AIQ (PR #2367 5920918390): the POSITIVE predicate, so an option the run tried and could not compute
  // (`not_computed`), or any row kind added later, under-counts instead of reading as compared.
  const compared = vm.optionsComparison.rows.filter((row) => row.kind === 'analysed').length
  if (compared === 0) return null
  const text = compared === total ? COMMITMENT_COPY.withheldFounded(compared) : COMMITMENT_COPY.withheldFoundedOf(compared, total)
  return { text, source: 'withheld_count' }
}

/**
 * BULLET 1 — "What seems well-founded".
 *
 * The `modelImplication` block's LEAD where the lead is itself a reading
 * (aligned, diverged), else its FIRST statement (`needs_target`, whose lead is a
 * limitation, "Only one reading of this run is available", not a reading).
 * `none` says nothing, and neither does this.
 *
 * ⛔ NOT WHEN THE CHECKS SAY THE LEADER WAS NOT ASSESSED. The implication
 * withholds only on a verdict that arrived and refused (`rec.verdict != null`);
 * a run with NO verdict still yields `aligned` ("X is most likely…"), while
 * `checks` reads the same run as `leader_not_assessed`. Side by side those were
 * two bullets contradicting each other (witnessed on the Rich fixture: bullet 1
 * "most likely", bullet 2 "could not confirm which option is most likely"). The
 * checks' reading is the conservative one, so a withheld leader silences this
 * bullet whatever the implication says.
 *
 * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): "SILENCES" NO LONGER MEANS
 * `null`. Paul's manual test of the provisional PA-hire run showed only the
 * "Still open" bullet — "What we have" was blank on the one run a reader most
 * needs orientation on. The withheld gate above still forbids a READING
 * (aligned/diverged/outcome-claim all name or rank an option); what it does
 * NOT forbid is the one fact this bullet can state with no reading at all —
 * how many options this comparison holds. See `withheldFoundedBullet`.
 */
const pct = (v: number): string => `${Math.round(v * 100)}%`

/** What moved since the last run, from the producer's own noise verdicts; null when they license nothing. */
function movementSentence(view: RunDeltaView, leads: boolean): string | null {
  if (view.movementsUnavailable || view.movements.length === 0) return null
  const words = leads ? COMMITMENT_COPY.sinceLastRun : COMMITMENT_COPY.sinceLastRun.after
  const signal = view.movements.filter((m) => m.noiseVerdict === 'signal' && m.mayShowMagnitude)
  // ⛔ NO IMPLIED CAUSE (AIQ CR on #2368, rule 5920669246: C2–C5 never imply a cause). After the input sentence
  // (`leads === false`), a beyond-noise movement beside the change reads as "the edit moved it", which only a
  // C1 pair can say. So on any other pair the movement is left out here; the Compare tab states it with its
  // limit. AIQ's other option, appending the reader's limit, was not taken: its words say "explains anything
  // below", which is Compare's layout, and nothing sits below this sentence (PROMPT STRIKE 5920770514).
  // Within-noise needs no limit ("No option moved…" claims no cause), so that arm is unchanged.
  if (!leads && signal.length > 0 && !view.attributable) return null
  if (signal.length === 1 && signal[0].label) {
    return words.oneMoved(signal[0].label, pct(signal[0].prior), pct(signal[0].current))
  }
  if (signal.length > 0) return words.someMoved(signal.length)
  return view.movements.every((m) => m.noiseVerdict === 'within_noise') ? words.noneMoved : null
}

/** One input row as a sentence. The sentence names the change; the values are the producer's. */
function inputRowSentence(row: RunDeltaInputRow): string | null {
  const s = COMMITMENT_COPY.sinceLastRun
  // Same order as the Compare tab's row text (`WhatsChanged.tsx` `inputRowText`): a value change first, whatever its kind.
  if (row.change === 'changed') return row.before !== null && row.after !== null ? s.inputChanged(row.subject, row.before, row.after) : null
  if (row.kind === 'option') return row.change === 'added' ? s.optionJoined(row.subject) : s.optionLeft(row.subject)
  if (row.kind === 'link') return row.change === 'added' ? s.linkAdded(row.subject) : s.linkRemoved(row.subject)
  if (row.change === 'added' && row.after !== null) return s.inputSet(row.subject, row.after)
  if (row.change === 'removed') return s.inputCleared(row.subject)
  return null
}

/**
 * What changed since the last run: the producer's exact input change. `null` when the record is absent
 * (`not_recorded`) or has no rows. Several rows name the first; the count is said only when complete.
 */
function inputSentence(view: RunDeltaView): string | null {
  const inputs = view.inputs
  if (!inputs || inputs.coverage === 'not_recorded' || inputs.rows.length === 0) return null
  if (inputs.rows.length === 1) return inputRowSentence(inputs.rows[0])
  const first = inputs.rows[0].subject
  return inputs.coverage === 'complete'
    ? COMMITMENT_COPY.sinceLastRun.inputsChanged(inputs.rows.length, first)
    : COMMITMENT_COPY.sinceLastRun.inputsChangedSome(first)
}

/**
 * ⭐ THE ONE SENTENCE about the displayed Run against the Run before it, for every Panel surface that says it:
 * the Reasoning tab's "What we have" and the chat's analysis card (`V5AnalysisResultBlock`). Both call this with
 * the view from the one reader (`displayedRunDeltaView`), so they cannot word the same comparison differently.
 * What changed comes first, then what moved (V2 prototype re-run state).
 *
 * `isStale`: the Reasoning tab's bullet describes the model on screen, so a model edited after the run says
 * nothing here (the stale row speaks). The chat card is the record of its own run and passes `false`.
 */
export function runDeltaSentence(
  view: RunDeltaView | null,
  { isStale, absenceReason = null }: { isStale: boolean; absenceReason?: string | null },
): string | null {
  if (!isStale && !view && absenceReason === 'unrequested_run_in_pair') {
    return COMMITMENT_COPY.sinceLastRun.notComparedWithFirstPass
  }
  if (isStale || !view) return null
  const changed = inputSentence(view)
  const moved = movementSentence(view, changed === null)
  const parts = [changed, moved].filter((p): p is string => p !== null)
  return parts.length > 0 ? parts.join(' ') : null
}

function sinceLastRun(vm: CommitmentSynthesisInput): string | null {
  return runDeltaSentence(vm.whatsChanged, { isStale: vm.status.isStale, absenceReason: vm.runDeltaAbsenceReason })
}

function foundedBullet(vm: CommitmentSynthesisInput): CommitmentBullet<FoundedSource> | null {
  const base = readingBullet(vm)
  const since = sinceLastRun(vm)
  if (!since) return base
  return base ? { ...base, text: `${base.text} ${since}` } : { text: since, source: 'since_last_run' }
}

function readingBullet(vm: CommitmentSynthesisInput): CommitmentBullet<FoundedSource> | null {
  if (vm.checks.leaderWithheld) return withheldFoundedBullet(vm)
  const mi = vm.modelImplication
  switch (mi.kind) {
    case 'aligned':
      return { text: COPY.implications.alignedLead(mi.label), source: 'implication_aligned_lead' }
    case 'diverged':
      return { text: COPY.implications.divergedLead, source: 'implication_diverged_lead' }
    case 'needs_target':
      // Where the producer's leader is another option, naming the
      // highest-expected-value option alone would contradict the chart and the
      // chat; the two readings are stated as diverging instead.
      return mi.leaderIsAnotherOption === true
        ? { text: COPY.implications.divergedLead, source: 'implication_diverged_lead' }
        : { text: mi.outcome.sentence, source: 'implication_outcome_claim' }
    case 'none':
      // V2 always states what we have: the option count, never a reading.
      return withheldFoundedBullet(vm)
  }
}

/**
 * BULLET 2 — "What remains uncertain". The strongest open item, by a FIXED
 * priority; the first that has content wins and the rest are not shown.
 *
 *   (a) the leader was withheld (`checks.leaderWithheld`): the producer's cause
 *       (`checks.leaderWithholdCause`) where it is nameable, else the standing
 *       sentence for that state (`checks.leader_not_assessed.meaning`).
 *   (b) RETIRED. The tipping condition was restated here as well as in the
 *       Challenge zone's signals row, so the same sentence showed twice at rest
 *       (measured by the V2 spec re-point). It has one owner now: the signals
 *       row, where the brief places it.
 *   (c) robustness not established (`checks` robustness code in
 *       `ROBUSTNESS_NOT_ESTABLISHED`): that code's own `meaning`.
 *   (d) the top evidence gap: only when `checks` says gaps are OUTSTANDING
 *       (`evidence_gaps`, not `evidence_all_addressed`), the first `gap:`
 *       finding in producer order, its `headline` verbatim.
 *
 * ⚠ (a) FIRES ON THE WITHHOLD, NOT ONLY ON A NAMEABLE CAUSE. The cause is null
 * both when the reason cannot be named and when nothing was withheld; reading
 * it alone would let a withheld run fall through to (b), which is the rebuild
 * the gate on (b) exists to stop.
 *
 * ⚠ #1922's `checks.sharesExcludeLimits` IS NOT ON THIS BASE AND IS NOT READ.
 * Its case (`constraint_verdict_withheld`) is already a nameable cause, so (a)
 * states it through `leaderWithholdCause` either way.
 */
function openBullet(vm: CommitmentSynthesisInput): CommitmentBullet<OpenSource> | null {
  // (0) The same condition bullet 3 uses for its re-run advice, so the two can never disagree.
  if (vm.status.isStale && vm.status.staleKind === 'changed' && !vm.checks.rerunWouldNotHelp) {
    return { text: COMMITMENT_COPY.changeNotAnalysed, source: 'change_not_analysed' }
  }
  // (a)
  if (vm.checks.leaderWithheld) {
    const cause = vm.checks.leaderWithholdCause
    // ⭐ AND WHICH CHECK FAILED, WHERE THE PRODUCER TYPED IT (manual test
    // `1a298d6d`): the withheld sentence alone named no cause the reader could
    // act on. Appended, never substituted — see `checks.leaderWithholdDetail`.
    const detail = vm.checks.leaderWithholdDetail ?? null
    const withDetail = (text: string) => (detail !== null ? `${text} ${detail}` : text)
    if (cause === null && vm.checks.firstPassWithheld) {
      return { text: withDetail(COMMITMENT_COPY.firstPassWithheld), source: 'first_pass' }
    }
    return cause !== null
      ? { text: withDetail(cause), source: 'leader_withheld_cause' }
      : { text: withDetail(COPY.checks.leader_not_assessed.meaning), source: 'leader_withheld' }
  }

  // (b) RETIRED: the tipping condition has ONE owner on this tab, the
  // Challenge zone's signals row (same strict builder, same leader gate).
  // Restating it here put the same sentence on screen twice at rest.

  // (c)
  const robustness = vm.checks.items.find((i) => i.id === 'robustness')
  if (robustness && isRobustnessNotEstablished(robustness.code)) {
    return { text: COPY.checks[robustness.code].meaning, source: 'robustness' }
  }

  // (d)
  const evidence = vm.checks.items.find((i) => i.id === 'evidence')
  if (evidence?.code === 'evidence_gaps') {
    const gap = vm.uncertainty.findings.find((f) => f.id.startsWith(EVIDENCE_GAP_ID_PREFIX))
    if (gap && gap.headline.trim() !== '') return { text: gap.headline, source: 'evidence_gap' }
  }

  // (e) V2 bullet 2 at rest: evidence the run did not assess is still open.
  if (evidence?.code === 'evidence_not_assessed') {
    return { text: COMMITMENT_COPY.evidenceNotAssessed, source: 'evidence_not_assessed' }
  }

  return null
}

/**
 * BULLET 3 — "Before committing".
 *
 * On a stale run that a re-run could change: `COMMITMENT_COPY.rerunBefore` —
 * not the act's own label, which sits just below it. Otherwise the top open review item's title,
 * verbatim (`strengthen.interventions[0].title`). Nothing else.
 *
 * ⚠ `rerunWouldNotHelp` IS HONOURED. Where the view model knows a re-run
 * reaches the same withheld gate, the glance's ribbon offers the estimate route
 * instead of a re-run; saying "Re-run to be sure" here would be the act that
 * ribbon was fixed to stop offering.
 */
function beforeBullet(
  vm: CommitmentSynthesisInput,
  excluded: ReadonlySet<string>,
): CommitmentBullet<BeforeSource> | null {
  if (vm.status.isStale && !vm.checks.rerunWouldNotHelp) {
    return { text: COMMITMENT_COPY.rerunBefore, source: 'rerun' }
  }
  // The same condition bullet 2 uses, so the two can never disagree.
  if (vm.checks.leaderWithheld && vm.checks.leaderWithholdCause === null && vm.checks.firstPassWithheld) {
    return { text: COMMITMENT_COPY.firstPassBefore, source: 'first_pass' }
  }
  // ⛔ NOT THE CARD'S OWN ITEM. The Challenge card already shows the promoted
  // intervention's title at rest; repeating it here put the same sentence on
  // screen twice (V2 census, B1). Skip it, as the review queue does.
  const top = vm.strengthen.interventions.find((r) => !excluded.has(r.id))
  if (top && top.title.trim() !== '') return { text: top.title, source: 'intervention' }
  if (excluded.size > 0) return { text: RESPOND_OR_RECORD, source: 'respond_or_record' }
  return null
}

/** Bullet 3's fallback — the prototype's own sentence, adapted to this panel's acts. */
export const RESPOND_OR_RECORD = 'Answer the challenge above, or record your view and why you hold it.'

const EMPTY: CommitmentSynthesis = { describesLastRun: false, staleKind: null, founded: null, open: null, before: null }

/**
 * The three bullets for this view model. Pure and deterministic: the same view
 * model always yields the same bullets.
 */
export function buildCommitmentSynthesis(
  vm: CommitmentSynthesisInput,
  opts: { excludeInterventionIds?: ReadonlyArray<string | null | undefined> } = {},
): CommitmentSynthesis {
  if (vm.status.isPreRun) return EMPTY
  return {
    describesLastRun: vm.status.isStale,
    staleKind: vm.status.isStale ? vm.status.staleKind : null,
    founded: foundedBullet(vm),
    open: openBullet(vm),
    before: beforeBullet(
      vm,
      new Set((opts.excludeInterventionIds ?? []).filter((id): id is string => typeof id === 'string')),
    ),
  }
}

export type CommitmentBulletKey = 'founded' | 'open' | 'before'

/** The bullets that have content, in display order, with their labels. */
export function commitmentBullets(
  s: CommitmentSynthesis,
): Array<{ key: CommitmentBulletKey; label: string; text: string; source: string }> {
  const out: Array<{ key: CommitmentBulletKey; label: string; text: string; source: string }> = []
  for (const key of ['founded', 'open', 'before'] as const) {
    const b = s[key]
    if (b) {
      const label = key === 'founded' && s.describesLastRun ? COMMITMENT_COPY.labels.lastRun : COMMITMENT_COPY.labels[key]
      out.push({ key, label, text: b.text, source: b.source })
    }
  }
  return out
}

/**
 * ⭐ V2 "Draft": the pre-run bullets. `optionCount` is the model strip's own option
 * row; `canRun` is exactly the condition the pre-run act renders on, so "then run
 * the analysis" never sits above a refused, running or missing act.
 */
export function buildPreRunCommitmentBullets(input: {
  optionCount: number
  canRun: boolean
}): Array<{ key: CommitmentBulletKey; label: string; text: string; source: string }> {
  const out: Array<{ key: CommitmentBulletKey; label: string; text: string; source: string }> = []
  if (input.optionCount > 0) {
    out.push({
      key: 'founded',
      label: COMMITMENT_COPY.labels.founded,
      text: COMMITMENT_COPY.preRun.founded(input.optionCount),
      source: 'pre_run_draft',
    })
  }
  if (input.canRun) {
    out.push({ key: 'before', label: COMMITMENT_COPY.labels.before, text: COMMITMENT_COPY.preRun.before, source: 'pre_run_run' })
  }
  return out
}

/**
 * The ask's context: exactly the lines the reader is looking at, in order, so
 * the drawer shows what was on screen and nothing the panel did not say.
 */
export function commitmentAskContext(s: CommitmentSynthesis): string {
  const lines = commitmentBullets(s).map((b) => `${b.label}: ${b.text}`)
  // The context says which staleness it is, in the glance ribbon's own words:
  // 'changed' is a claim about the model, 'unconfirmed' only that we cannot tell.
  if (lines.length > 0 && s.describesLastRun) {
    lines.unshift(s.staleKind === 'changed' ? COPY.status.stale : COPY.status.freshnessUnknown)
  }
  return lines.join('\n')
}

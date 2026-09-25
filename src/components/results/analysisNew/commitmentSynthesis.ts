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
  ask: {
    /** Tooltip and accessible name of the AI icon. */
    label: 'Ask Olumi what remains before committing',
    /** The editable draft the ask opens with. The user's question, not a claim. */
    draft: 'What remains open before I commit to a view on this decision?',
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

/** Where bullet 2 came from, in priority order. */
export type OpenSource =
  /** (a) `vm.checks.leaderWithholdCause`, when the leader was withheld and the cause is nameable. */
  | 'leader_withheld_cause'
  /** (a) `COPY.checks.leader_not_assessed.meaning`, when withheld and the cause is not nameable. */
  | 'leader_withheld'
  /** (b) `COPY.disclosure.tippingPoint(...)` over `vm.sensitivity.tippingPoints[0]`. */
  | 'tipping_point'
  /** (c) `COPY.checks[robustnessCode].meaning`. */
  | 'robustness'
  /** (d) the first `gap:` finding's `headline` in `vm.uncertainty.findings`. */
  | 'evidence_gap'

/** Where bullet 3 came from. */
export type BeforeSource =
  /** `COPY.status.reanalyseToBeSure` on a stale run a re-run could change. */
  | 'rerun'
  /** `vm.strengthen.interventions[0].title`, verbatim. */
  | 'intervention'

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
 */
function withheldFoundedBullet(vm: CommitmentSynthesisInput): CommitmentBullet<FoundedSource> | null {
  const count = vm.optionsComparison.rows.length
  if (count === 0) return null
  return { text: COMMITMENT_COPY.withheldFounded(count), source: 'withheld_count' }
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
function foundedBullet(vm: CommitmentSynthesisInput): CommitmentBullet<FoundedSource> | null {
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
      return null
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
  // (a)
  if (vm.checks.leaderWithheld) {
    const cause = vm.checks.leaderWithholdCause
    return cause !== null
      ? { text: cause, source: 'leader_withheld_cause' }
      : { text: COPY.checks.leader_not_assessed.meaning, source: 'leader_withheld' }
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

  return null
}

/**
 * BULLET 3 — "Before committing".
 *
 * On a stale run that a re-run could change: the panel's existing re-run words
 * (`status.reanalyseToBeSure`). Otherwise the top open review item's title,
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
    return { text: COPY.status.reanalyseToBeSure, source: 'rerun' }
  }
  // ⛔ NOT THE CARD'S OWN ITEM. The Challenge card already shows the promoted
  // intervention's title at rest; repeating it here put the same sentence on
  // screen twice (V2 census, B1). Skip it, as the review queue does.
  const top = vm.strengthen.interventions.find((r) => !excluded.has(r.id))
  if (top && top.title.trim() !== '') return { text: top.title, source: 'intervention' }
  return null
}

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
    if (b) out.push({ key, label: COMMITMENT_COPY.labels[key], text: b.text, source: b.source })
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

/**
 * ⭐ THE DECISION BRIEF — ONE PURE FUNCTION FROM THE SAVED READ TO WHAT THE BRIEF SAYS.
 *
 * Input: the scenario-graph READ CEE answers for a saved scenario (`fetchScenarioGraph`'s `status: 'graph'` arm) —
 * the persisted model, the analysis verdict for it, and (only when that verdict is `complete_current`) the Run's
 * result block with its stored facts. Output: a plain model a view, a print page or a text copy can render without
 * deciding anything.
 *
 * ── IT COMPUTES NOTHING NEW ─────────────────────────────────────────────────
 * Every figure and every source word comes from an owner that already exists, called here rather than respelled:
 *   · the result block → `mapV5AnalysisToReport` (the turn/poll legs' mapper), with the read's stored goal-certainty
 *     and option-participation facts, exactly as `applyScenarioAnalysisRead` calls it;
 *   · an option's goal figure → `selectGoalProbability` (the ONE chooser, with its withholds) → `formatGoalProbability`;
 *   · goal target and its source → `resolveGoalTarget` / `goalTargetSourceMark` / `formatGoalTarget`;
 *   · a factor's level and its source → `factorValueSourceMark` (the card's rule chain);
 *   · limits → `selectStatedLimits` / `goalConstraintText`, and what the Run could say about them →
 *     `readLimitVerdicts` / `buildLimitVerdictView`;
 *   · withheld goal figures → `readGoalIdentityWithheld` and the goal-certainty `say` (the producer's words).
 *
 * ── IT STAYS HONEST ABOUT CURRENCY ──────────────────────────────────────────
 * The Run's figures (chances, drivers, limit checks) are carried ONLY when the read says the Run is current for
 * this saved version: `run_state.kind === 'complete_current'`, a result block present, no rerun asked for, the
 * analysis not marked unusable, and the read's own "held Run is not current" rule (`heldRunIsNotCurrentPerRead`)
 * silent. Anything else says why in words and carries no figure as current.
 */
import type { AnalysisResultBlock, AnalysisStateV1 } from '@talchain/schemas/boundary'

import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import { readGoalCertainty, GOAL_CERTAINTY_UNEARNED_FALLBACK } from '../state/storedGoalCertainty'
import { readOptionParticipation } from '../state/storedOptionParticipation'
import { readLimitVerdicts } from '../state/storedLimitVerdicts'
import { producerMarksAnalysisUnusable } from '../../lib/coherence/crossSurfaceCoherence'
import { heldRunIsNotCurrentPerRead } from '../hydrate/serverGraphHydration'
import { resolveGoalTarget, type GoalTargetSource } from '../domain/goalTarget'
import { heldTargetBoundWords } from '../domain/goalOwnTargetRow'
import { goalTargetSourceMark, factorValueSourceMark, type ValueSourceMarkKind } from '../nodes/shared/valueSourceMark'
import { goalConstraintText } from '../utils/goalConstraintText'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { selectStatedLimits } from '../../components/results/decision-overview/statedLimits'
import { buildLimitVerdictView } from '../../components/results/analysisNew/limitVerdictView'
import { selectGoalProbability, type GoalProbabilityInput } from '../../components/results/utils/selectGoalProbability'
import { formatGoalProbability } from '../../components/results/utils/displayFloors'
import { formatGoalTarget } from '../../components/results/utils/formatGoalTarget'
import { goalFitBaseCaveatCopy } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { readGoalIdentityWithheld } from '../../components/results/utils/goalIdentityWithheld'
import { isAnalysedOption, optionComputationFailed } from '../../components/results/utils/notAnalysedOptions'
import type { DecisionRecord } from '../../components/results/modals'
import {
  DECISION_POSITION_COPY,
  formatConfidence,
  formatRecordedOn,
  recordedOptionText,
  storageSentenceFor,
} from '../../components/results/analysisNew/sections/DecisionRecorded'
import { ANALYSIS_NEW_COPY } from '../../components/results/analysisNew/analysisNewCopy'
import type { OptionComputeStatus } from '../../adapters/plot/optionComputeStatus'

// ─── Input ──────────────────────────────────────────────────────────────────

/**
 * The saved read, as `fetchScenarioGraph` returns it on its `status: 'graph'` arm. Declared structurally (not as
 * `Extract<ScenarioGraphResult, …>`) so a test can hand in a served body's fields without a fetch.
 */
export interface SavedScenarioRead {
  readonly graph: unknown
  readonly briefText?: string | null
  readonly graphHash: string | null
  readonly identity?: { readonly value: string; readonly projectionVersion: string } | null
  readonly analysisState: AnalysisStateV1 | null
  readonly analysisResult: unknown
  readonly limitVerdicts?: unknown
  readonly goalCertainty?: unknown
  readonly optionParticipation?: unknown
}

// ─── Output ─────────────────────────────────────────────────────────────────

/** Where a figure came from, in the words every other surface uses (`VALUE_SOURCE_MARK_LABEL`). */
export interface BriefSource {
  readonly kind: ValueSourceMarkKind
  readonly label: string
}

export interface BriefGoal {
  readonly nodeId: string
  readonly label: string
  /** The target as the user states it, or null when the model holds none we can show. */
  readonly targetText: string | null
  readonly targetSource: BriefSource | null
}

export interface BriefLimit {
  readonly id: string
  readonly text: string
  readonly source: BriefSource
  /** The graph element the limit binds to, when it names one on this model. */
  readonly nodeId: string | null
}

/** A figure the model runs on, with whose it is — so an Olumi estimate is never read as the user's. */
export interface BriefFigure {
  readonly nodeId: string
  readonly label: string
  readonly valueText: string
  readonly source: BriefSource
}

export type BriefRunStatus = 'current' | 'not_current' | 'blocked' | 'refused' | 'never_run' | 'unknown'

export interface BriefRun {
  readonly status: BriefRunStatus
  /** One plain sentence about the latest Run and this saved version. */
  readonly statement: string
  /** The Run's `computed_at`, verbatim ISO, when the read states one. */
  readonly computedAt: string | null
  /** `computedAt` for a reader, fixed to UTC so the brief reads the same for everyone it is shared with. */
  readonly computedAtText: string | null
}

export interface BriefOptionChance {
  readonly optionId: string
  readonly optionLabel: string
  /** "Reaches your target in about 42% of model runs", or null when no figure may be shown. */
  readonly chanceText: string | null
  /** The caveat the chooser requires beside a shown figure (e.g. measured from Olumi's estimate). */
  readonly caveat: string | null
  /** Why no figure is shown, in words, when `chanceText` is null. */
  readonly withheldText: string | null
}

export interface BriefDriver {
  readonly nodeId: string
  readonly label: string
}

export interface BriefWithheld {
  readonly id: string
  readonly text: string
  /** The graph element this is about, for highlighting; null when it names none. */
  readonly nodeId: string | null
}

/**
 * The user's recorded decision, in the read-back card's own words (`DecisionRecorded`): the same position text, labels,
 * date and storage sentence, so the brief never says something about a record that the card does not.
 */
export interface BriefRecord {
  readonly heading: string
  readonly position: string
  readonly rows: readonly { readonly label: string; readonly text: string }[]
  readonly recordedOn: string | null
  readonly storage: string
  readonly yourView: string
}

export interface DecisionBriefModel {
  readonly decision: { readonly nodeId: string | null; readonly label: string | null }
  readonly options: readonly { readonly nodeId: string; readonly label: string }[]
  readonly goal: BriefGoal | null
  readonly limits: readonly BriefLimit[]
  readonly figures: readonly BriefFigure[]
  readonly run: BriefRun
  /** Per-option Run figures — EMPTY unless `run.status === 'current'`, and EMPTY when no option has a figure. */
  readonly chances: readonly BriefOptionChance[]
  /** On a current Run where no option has a figure: ONE line in place of a row per option (the reasons are in `withheld`). */
  readonly chancesNote: string | null
  /** Top drivers of the Run — EMPTY unless `run.status === 'current'`. */
  readonly drivers: readonly BriefDriver[]
  readonly withheld: readonly BriefWithheld[]
  /** The decision the user recorded for THIS Run, or null (none, or recorded against a different Run). */
  readonly record: BriefRecord | null
  readonly version: { readonly graphHash: string | null; readonly shortVersion: string | null; readonly identity: string | null }
}

// ─── Words ──────────────────────────────────────────────────────────────────

export const DECISION_BRIEF_COPY = {
  runCurrent: 'These figures come from the latest Run of this saved version.',
  runStale: 'The model has changed since the latest Run, so that Run’s figures are not shown here.',
  runStaleNeed: 'I need a fresh Run of this version before I can show its chances and drivers.',
  runRunning: 'A Run of this version has not finished yet.',
  runNeverRun: 'This version has not been run yet.',
  runNeverRunNeed: 'I need a Run of this version before I can show chances or drivers.',
  runBlocked: 'This version cannot be run as it stands.',
  runRefused: 'The latest Run of this version was declined.',
  runUnknown: 'I can’t tell whether a Run is current for this version, so no figures are shown as current.',
  runUnusable: 'The latest Run of this version can’t be relied on, so its figures are not shown.',
  goalTargetNeed: (goal: string) => `I need a target for ‘${goal}’ before I can say how often each option reaches it.`,
  chanceTail: 'of model runs',
  noFigure: 'No figure for this option on this Run.',
  noChances: 'No option has a figure for reaching your target on this Run. The reasons are below.',
} as const

// ─── Graph reading (allowlisted fields) ─────────────────────────────────────

interface ReadNode {
  readonly id: string
  readonly kind: string
  readonly label: string
  readonly raw: Record<string, unknown>
}

function readNodes(graph: unknown): ReadNode[] {
  const nodes = (graph as { nodes?: unknown } | null | undefined)?.nodes
  if (!Array.isArray(nodes)) return []
  const out: ReadNode[] = []
  for (const n of nodes) {
    if (n === null || typeof n !== 'object') continue
    const r = n as Record<string, unknown>
    if (typeof r.id !== 'string' || r.id === '') continue
    const kind = typeof r.kind === 'string' ? r.kind : typeof r.type === 'string' ? r.type : ''
    const label = typeof r.label === 'string' && r.label.trim() !== '' ? r.label.trim() : r.id
    out.push({ id: r.id, kind, label, raw: r })
  }
  return out
}

function readConstraints(graph: unknown): CEEGoalConstraint[] {
  const c = (graph as { goal_constraints?: unknown } | null | undefined)?.goal_constraints
  return Array.isArray(c) ? (c.filter((x) => x !== null && typeof x === 'object') as CEEGoalConstraint[]) : []
}

function formatRunTime(iso: string | null): string | null {
  if (iso === null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const text = d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
  return `${text} UTC`
}

/**
 * A limit's source. A verbatim span from the brief (`source_quote`) is CEE's evidence the brief stated it; an
 * `inferred` or `proxy` limit is Olumi's; anything else says nobody recorded where it came from (unknown stays unknown).
 */
function limitSource(c: CEEGoalConstraint): BriefSource {
  if (c.provenance === 'inferred' || c.provenance === 'proxy') return { kind: 'olumi', label: 'Olumi’s estimate' }
  if (typeof c.source_quote === 'string' && c.source_quote.trim() !== '') return { kind: 'brief', label: 'From your brief' }
  return { kind: 'unknown', label: 'Source not recorded' }
}

/** A factor's level in its own unit (`raw_value`), never the normalised `value`. */
function figureText(raw: Record<string, unknown>): string | null {
  const obs = (raw.observed_state ?? raw.observedState) as { raw_value?: unknown; unit?: unknown } | null | undefined
  if (!obs || typeof obs.raw_value !== 'number' || !Number.isFinite(obs.raw_value)) return null
  const unit = typeof obs.unit === 'string' ? obs.unit.trim() : ''
  if (unit === '') return null
  return formatGoalTarget(obs.raw_value, unit)
}

/**
 * The shared readout (`formatGoalProbability`: "42%", "< 1%", "> 99%") in words. A floored readout is a bound, so it
 * is said as one ("fewer than 1%"), never "about < 1%".
 */
function shareWords(figure: string): string {
  const bound = /^([<>])\s*(.+)$/.exec(figure.trim())
  if (bound) return `${bound[1] === '<' ? 'fewer than' : 'more than'} ${bound[2]}`
  return `about ${figure}`
}

/** Which label the source kind reads as in a brief. Olumi's is said in full so it is never mistaken for the user's. */
function briefSourceOf(mark: { kind: ValueSourceMarkKind; label: string }): BriefSource {
  return mark.kind === 'olumi' ? { kind: 'olumi', label: 'Olumi’s estimate' } : { kind: mark.kind, label: mark.label }
}

// ─── Run status ─────────────────────────────────────────────────────────────

function runOf(read: SavedScenarioRead): { run: BriefRun; withheld: BriefWithheld[] } {
  const state = read.analysisState
  const withheld: BriefWithheld[] = []
  const computedAt =
    state && 'computed_at' in state.run_state && typeof state.run_state.computed_at === 'string'
      ? state.run_state.computed_at
      : null
  const base = { computedAt, computedAtText: formatRunTime(computedAt) }

  if (state === null) {
    return { run: { status: 'unknown', statement: DECISION_BRIEF_COPY.runUnknown, ...base }, withheld }
  }
  const kind = state.run_state.kind
  if (kind === 'blocked') {
    const blockers = state.run_state.blockers.length > 0 ? state.run_state.blockers : state.readiness.blockers
    blockers.forEach((b, i) => {
      withheld.push({ id: `blocker:${i}:${b.code}`, text: b.message, nodeId: b.factor_id ?? b.option_id ?? null })
    })
    return { run: { status: 'blocked', statement: DECISION_BRIEF_COPY.runBlocked, ...base }, withheld }
  }
  if (kind === 'refused') {
    return { run: { status: 'refused', statement: DECISION_BRIEF_COPY.runRefused, ...base }, withheld }
  }
  if (kind === 'never_run') {
    withheld.push({ id: 'run:never', text: DECISION_BRIEF_COPY.runNeverRunNeed, nodeId: null })
    return { run: { status: 'never_run', statement: DECISION_BRIEF_COPY.runNeverRun, ...base }, withheld }
  }
  if (kind === 'running') {
    return { run: { status: 'not_current', statement: DECISION_BRIEF_COPY.runRunning, ...base }, withheld }
  }
  if (kind === 'unknown_degraded') {
    return { run: { status: 'unknown', statement: DECISION_BRIEF_COPY.runUnknown, ...base }, withheld }
  }
  if (producerMarksAnalysisUnusable(state)) {
    return { run: { status: 'not_current', statement: DECISION_BRIEF_COPY.runUnusable, ...base }, withheld }
  }
  const current =
    kind === 'complete_current' &&
    read.analysisResult != null &&
    state.requires_rerun !== true &&
    !heldRunIsNotCurrentPerRead(state, read.analysisResult)
  if (!current) {
    withheld.push({ id: 'run:stale', text: DECISION_BRIEF_COPY.runStaleNeed, nodeId: null })
    return { run: { status: 'not_current', statement: DECISION_BRIEF_COPY.runStale, ...base }, withheld }
  }
  return { run: { status: 'current', statement: DECISION_BRIEF_COPY.runCurrent, ...base }, withheld }
}

// ─── The builder ────────────────────────────────────────────────────────────

/**
 * ⛔ NO RUN FILTER BY RESULTS HASH: MEASURED, NOT ASSUMED (served D1, UI `919ba207`, record-diag 2 Oct 09:3xZ). A record
 * stores the IN-SESSION `results.hash`, the turn block's content hash (`v5:6b6d…`). The saved read of the SAME Run hashes to
 * `v5:c8c7…`: the stored block carries an empty `decision_brief.analysis_summary` and orders two tied options differently.
 * So a filter on that hash hid every record made in session (#2450's witness). Until a record carries a Run identity both
 * copies share (MG's later `run_id`), the brief shows the record as the read-back card does, with the date it was recorded.
 */
function briefRecordOf(record: DecisionRecord | null): BriefRecord | null {
  if (record == null) return null
  const copy = ANALYSIS_NEW_COPY.decisionRecord
  const rows: { label: string; text: string }[] = []
  const add = (label: string, text: string | null | undefined) => {
    if (typeof text === 'string' && text.trim() !== '') rows.push({ label, text: text.trim() })
  }
  if (record.position !== 'not_ready') {
    add(copy.confidenceLabel, formatConfidence(record.confidence))
    add(copy.expectationLabel, record.expectation)
  }
  add(copy.rationaleLabel, record.rationale)
  add(copy.assumptionLabel, record.assumptionToWatch)
  add(copy.revisitLabel, record.revisitTrigger)
  add(copy.nextActionLabel, record.nextAction)
  const on = formatRecordedOn(record.savedAt)
  return {
    heading: copy.recorded,
    position: recordedOptionText(record),
    rows,
    recordedOn: on ? `${copy.recordedOnPrefix} ${on}` : null,
    storage: storageSentenceFor(record),
    yourView: DECISION_POSITION_COPY.yourView,
  }
}

export function buildDecisionBrief(read: SavedScenarioRead, decisionRecord: DecisionRecord | null = null): DecisionBriefModel {
  const nodes = readNodes(read.graph)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const decisionNode = nodes.find((n) => n.kind === 'decision') ?? null
  const optionNodes = nodes.filter((n) => n.kind === 'option')
  const goalNodeId = (read.graph as { goal_node_id?: unknown } | null)?.goal_node_id
  const goalNode =
    (typeof goalNodeId === 'string' ? byId.get(goalNodeId) : undefined) ?? nodes.find((n) => n.kind === 'goal') ?? null

  // Goal and its target, through the card's own resolver.
  let goal: BriefGoal | null = null
  if (goalNode) {
    const data = goalNode.raw as GoalTargetSource
    const target = resolveGoalTarget(data)
    const targetText = (() => {
      if (target == null) return null
      const n = typeof target.raw === 'number' ? target.raw : Number(target.raw)
      const figure = Number.isNaN(n) ? String(target.raw) : formatGoalTarget(n, target.unit, target.frame) ?? String(target.raw)
      // SD-1: a goal that holds a ceiling says so, from its own `goal_direction` (the one source).
      const bound = heldTargetBoundWords(data)
      return bound === null ? figure : `${bound} ${figure}`
    })()
    goal = {
      nodeId: goalNode.id,
      label: goalNode.label,
      targetText,
      targetSource: targetText === null ? null : briefSourceOf(goalTargetSourceMark(data)),
    }
  }

  // Limits: the stated text (the one authority on a limit's wording) plus its source.
  const constraints = readConstraints(read.graph)
  const nodeViews = nodes.map((n) => ({ id: n.id, type: n.kind, data: n.raw }))
  const statedLimits = selectStatedLimits(constraints)
  const limits: BriefLimit[] = constraints.map((c, index) => {
    const id = String(c.constraint_id ?? c.id ?? index)
    const nodeId = typeof c.node_id === 'string' && byId.has(c.node_id) ? c.node_id : null
    return { id, text: goalConstraintText(c, nodeViews), source: limitSource(c), nodeId }
  })

  // Figures the model runs on (factor levels, and the goal's own level), each with whose it is.
  const figures: BriefFigure[] = []
  for (const n of nodes) {
    if (n.kind !== 'factor' && n.kind !== 'goal') continue
    const valueText = figureText(n.raw)
    const mark = factorValueSourceMark(n.raw)
    if (valueText === null || mark === null) continue
    // The goal's own level is where it stands today (the product's words: "where your goal stands today").
    const label = n.kind === 'goal' ? `${n.label} today` : n.label
    figures.push({ nodeId: n.id, label, valueText, source: briefSourceOf(mark) })
  }

  const { run, withheld } = runOf(read)
  const chances: BriefOptionChance[] = []
  let chancesNote: string | null = null
  const drivers: BriefDriver[] = []

  if (run.status === 'current') {
    const report = mapV5AnalysisToReport(read.analysisResult as AnalysisResultBlock, {
      goalCertainty: readGoalCertainty(read.goalCertainty),
      optionParticipation: readOptionParticipation(read.optionParticipation),
    })
    const widened = report as unknown as {
      option_probabilities?: Record<string, GoalProbabilityInput & { status?: OptionComputeStatus }>
      drivers?: { label?: unknown; nodeId?: unknown }[]
    }
    // The Reasoning tab's population for the complete-field rule (below): options the Run returned whose computation
    // produced a result. A taken-out option is not in it, so removing one never hides the others' figures.
    let fieldIncomplete = false

    // Goal figures withheld for the whole Run (PLoT #416): one reason, in the producer's words.
    const identityWithheld = readGoalIdentityWithheld(report)
    if (identityWithheld) {
      withheld.push({ id: 'goal:identity', text: identityWithheld.message, nodeId: goal?.nodeId ?? identityWithheld.nodeIds[0] ?? null })
    }
    if (goal && goal.targetText === null) {
      withheld.push({ id: 'goal:target', text: DECISION_BRIEF_COPY.goalTargetNeed(goal.label), nodeId: goal.nodeId })
    }

    for (const opt of optionNodes) {
      const selection = selectGoalProbability(widened.option_probabilities?.[opt.id])
      const p = selection.goalProbability
      if (p != null && Number.isFinite(p)) {
        chances.push({
          optionId: opt.id,
          optionLabel: opt.label,
          chanceText: `Reaches your target in ${shareWords(formatGoalProbability(p))} ${DECISION_BRIEF_COPY.chanceTail}`,
          caveat: goalFitBaseCaveatCopy(selection.goalFitBaseCaveat),
          withheldText: null,
        })
        continue
      }
      const entry = widened.option_probabilities?.[opt.id]
      if (isAnalysedOption(widened.option_probabilities, opt.id) && !optionComputationFailed(entry?.status)) {
        fieldIncomplete = true
      }
      const unearned = selection.goalCertaintyUnearned
      // A Run-wide withholding is said ONCE (in `withheld`, above); the option row only says it has no figure.
      const why = unearned ? (unearned.say ?? GOAL_CERTAINTY_UNEARNED_FALLBACK) : DECISION_BRIEF_COPY.noFigure
      chances.push({ optionId: opt.id, optionLabel: opt.label, chanceText: null, caveat: null, withheldText: why })
      if (unearned) withheld.push({ id: `goal:certainty:${opt.id}`, text: why, nodeId: opt.id })
    }
    // ⭐ THE COMPLETE-FIELD RULE, as the Reasoning tab applies it (`buildAnalysisNewViewModel`, optionsComparison): a
    // figure for SOME of the compared options is a ranking over a subset, read as one over the options. So when any
    // option in the population has no figure, none is shown; each withheld option keeps its own reason above.
    // And when no option has a figure, the brief says so ONCE (as the tab's single withheld message does), never a
    // row per option repeating "no figure" over the reasons below.
    if (fieldIncomplete || (chances.length > 0 && chances.every((c) => c.chanceText === null))) {
      chances.length = 0
      chancesNote = DECISION_BRIEF_COPY.noChances
    }

    for (const d of widened.drivers ?? []) {
      if (typeof d.nodeId !== 'string' || typeof d.label !== 'string') continue
      drivers.push({ nodeId: d.nodeId, label: byId.get(d.nodeId)?.label ?? d.label })
    }

    // What this Run could say about each limit — judged on the same read, so the limits at Run are the limits now.
    const verdictView = buildLimitVerdictView(readLimitVerdicts(read.limitVerdicts), statedLimits, statedLimits)
    for (const row of verdictView?.rows ?? []) {
      if (row.state === 'scored') continue
      const limit = limits.find((l) => l.id === row.id)
      withheld.push({ id: `limit:${row.id}`, text: `${limit?.text ?? row.limitText}: ${row.words}`, nodeId: limit?.nodeId ?? null })
    }
    if (verdictView?.jointWords) withheld.push({ id: 'limit:joint', text: verdictView.jointWords, nodeId: null })
  }

  const graphHash = read.graphHash ?? null
  return {
    decision: { nodeId: decisionNode?.id ?? null, label: decisionNode?.label ?? null },
    options: optionNodes.map((n) => ({ nodeId: n.id, label: n.label })),
    goal,
    limits,
    figures,
    run,
    chances,
    chancesNote,
    drivers,
    withheld,
    record: briefRecordOf(decisionRecord),
    version: {
      graphHash,
      shortVersion: graphHash ? graphHash.slice(0, 8) : null,
      identity: read.identity?.value ?? null,
    },
  }
}

// ─── A plain-text rendering, for copying into a message or document ─────────

export function decisionBriefToText(brief: DecisionBriefModel): string {
  const lines: string[] = []
  lines.push(`Decision brief${brief.decision.label ? `: ${brief.decision.label}` : ''}`)
  lines.push(
    `Saved model version ${brief.version.shortVersion ?? 'not stated'}` +
      (brief.run.computedAtText ? ` · latest Run ${brief.run.computedAtText}` : ''),
  )
  lines.push('')
  if (brief.options.length > 0) {
    lines.push('Options')
    for (const o of brief.options) lines.push(`- ${o.label}`)
    lines.push('')
  }
  if (brief.goal) {
    lines.push('Goal')
    lines.push(
      `- ${brief.goal.label}` +
        (brief.goal.targetText ? `: ${brief.goal.targetText} (${brief.goal.targetSource?.label ?? 'Source not recorded'})` : ''),
    )
    lines.push('')
  }
  if (brief.limits.length > 0) {
    lines.push('Limits')
    for (const l of brief.limits) lines.push(`- ${l.text} (${l.source.label})`)
    lines.push('')
  }
  lines.push('Latest Run')
  lines.push(`- ${brief.run.statement}`)
  for (const c of brief.chances) {
    lines.push(`- ${c.optionLabel}: ${c.chanceText ?? c.withheldText ?? DECISION_BRIEF_COPY.noFigure}${c.caveat ? ` (${c.caveat})` : ''}`)
  }
  if (brief.chancesNote) lines.push(`- ${brief.chancesNote}`)
  lines.push('')
  if (brief.record) {
    const r = brief.record
    lines.push(r.heading)
    lines.push(`- ${r.position}`)
    for (const row of r.rows) lines.push(`- ${row.label}: ${row.text}`)
    lines.push(`- ${[r.recordedOn ? `${r.recordedOn}.` : null, r.storage].filter(Boolean).join(' ')}`)
    lines.push(`- ${r.yourView}`)
    lines.push('')
  }
  if (brief.drivers.length > 0) {
    lines.push('What drives the result most')
    for (const d of brief.drivers) lines.push(`- ${d.label}`)
    lines.push('')
  }
  if (brief.figures.length > 0) {
    lines.push('Figures the model uses')
    for (const f of brief.figures) lines.push(`- ${f.label}: ${f.valueText} (${f.source.label})`)
    lines.push('')
  }
  if (brief.withheld.length > 0) {
    lines.push('Not shown, and what I need')
    for (const w of brief.withheld) lines.push(`- ${w.text}`)
  }
  return lines.join('\n').trimEnd()
}

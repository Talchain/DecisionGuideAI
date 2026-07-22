/**
 * Wave 1 + parity O — Decision overview card (brief §4, prototype
 * decision-overview v6): the orientation surface.
 *
 * Owns the decision title + classification pills, the collapsible framing-
 * quality bar, the four brief-dimension chips, the brief-actions row,
 * Olumi's framing question, and the persistent Actions menu. It shows no
 * analysis outcomes (§4.1).
 *
 * Every coaching ask (pills, chips, review-brief row, framing question)
 * routes through the Ask-Olumi drawer (openAskOlumi) with a prefilled
 * EDITABLE draft — never an invisible auto-send. The drawer owns the honest
 * no-conversation disabled state.
 *
 * State machine: ready / needs-input / unassessed live from the wire
 * (analysis_ready.status); thin and blocked are live-derived (UI-SEM-079);
 * contradictory / unverified (and fixture thin) render only via
 * stateOverride for the fixture gallery (plan review B3).
 *
 * DS v4/5: bg-panel card, panel typography tokens only, Lucide, sentence
 * case, en-GB, no em dashes in prose.
 */
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { useCanvasStore } from '../../../canvas/store'
import { useSuccessMeasureForScenario } from '../modals'
import { useGuidanceStore, compareGuidanceDisplayOrder, type GuidanceItem } from '../../../canvas/stores/guidanceStore'
import { isDecisionOverviewEnabled } from '../../../flags'
import { typography } from '../../../styles/typography'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { formatTargetValue } from '../utils/formatTargetValue'
import { ActionsMenu } from './ActionsMenu'
import { REVIEW_BRIEF_ASK } from './actionsCatalogue'

export type BriefStateOverride = 'thin' | 'contradictory' | 'unverified'

type BriefState = 'ready' | 'needs_input' | 'unassessed' | 'blocked' | BriefStateOverride

export const OVERVIEW_COPY = {
  metaLabel: 'Decision overview',
  titleFallback: 'Draft decision',
  ready: 'Framing has the basics',
  readyNote: 'Goal, context, constraints and options',
  needsInput: 'Olumi needs a little more from you',
  needsInputNote: 'Answer the questions below to sharpen the framing',
  needsInputNoQuestions: 'Work through the gaps with Olumi when you are ready',
  unassessed: 'Framing not yet assessed',
  unassessedNote: 'Draft with Olumi to get a framing assessment',
  thin: 'Framing needs one clarification',
  thinNote: 'The goal is broad or important context is missing',
  thinLiveNote: 'The goal has no success measure yet',
  blocked: 'The model has a blocking issue',
  blockedNote: 'Resolve it before relying on the read',
  contradictory: 'The brief contains a conflict',
  contradictoryNote: 'Resolve it before relying on the read',
  unverified: 'One claim in the brief is unverified',
  unverifiedNote: 'Add a source, correct it or confirm it',
  framingLabel: "Olumi's framing question",
  workThrough: 'Work through with Olumi',
  answerDirectly: 'Answer directly',
  answerDraftPrefix: 'My answer: ',
  reviewBrief: 'Review your decision brief',
  reviewBriefHelper: 'Olumi challenges one issue at a time.',
  pillContext:
    'Help me check whether this decision classification is right and how it should affect the process.',
  goalNoteMissing: 'Success measure missing',
  capturedInBrief: 'Captured in brief',
  notCaptured: 'Not captured yet',
  optionsNoteEmpty: 'No options mapped yet',
  // V6-RESPEC §4: empty classification fields fold into ONE muted aggregate
  // chip ("+N to set") — collapsed shows what IS, never a per-field inventory
  // of what ISN'T. The old per-field "not set" name labels are retired.
  classificationUnsetSuffix: 'to set',
} as const

const STATE_COPY: Record<BriefState, { line: string; note: string }> = {
  ready: { line: OVERVIEW_COPY.ready, note: OVERVIEW_COPY.readyNote },
  needs_input: { line: OVERVIEW_COPY.needsInput, note: OVERVIEW_COPY.needsInputNote },
  unassessed: { line: OVERVIEW_COPY.unassessed, note: OVERVIEW_COPY.unassessedNote },
  thin: { line: OVERVIEW_COPY.thin, note: OVERVIEW_COPY.thinNote },
  blocked: { line: OVERVIEW_COPY.blocked, note: OVERVIEW_COPY.blockedNote },
  contradictory: { line: OVERVIEW_COPY.contradictory, note: OVERVIEW_COPY.contradictoryNote },
  unverified: { line: OVERVIEW_COPY.unverified, note: OVERVIEW_COPY.unverifiedNote },
}

/** Prototype colour-only status-dot vocabulary (shape constant, colour = how it's doing). */
const STATE_DOT_TONE: Record<BriefState, string> = {
  ready: 'bg-success',
  needs_input: 'bg-warning',
  thin: 'bg-warning',
  unverified: 'bg-warning',
  blocked: 'bg-danger',
  contradictory: 'bg-danger',
  unassessed: 'bg-text-light',
}

/** The four canonical brief dimensions (chip order fixed by the prototype). */
type Dimension = 'Goal' | 'Context' | 'Constraints' | 'Options'

/** The four canonical classification dimensions (spec data-overview tokens). */
const CLASSIFICATION_DIMENSIONS = ['stakes', 'reversibility', 'horizon', 'risk'] as const
type ClassificationDimension = (typeof CLASSIFICATION_DIMENSIONS)[number]

/**
 * Map a raw outcome-unit string onto formatTargetValue's unit vocabulary.
 * Same classification useResultsSectionData applies (display formatting,
 * not a semantic transform — values pass through unchanged).
 */
function mapOutcomeUnit(raw: string | null): {
  unit?: 'currency' | 'percent' | 'count'
  symbol?: string
} {
  if (!raw) return {}
  const lower = raw.toLowerCase()
  if (lower === '%' || lower === 'percent' || lower === 'percentage') return { unit: 'percent' }
  if (['$', '£', '€', 'usd', 'gbp', 'eur', 'dollar', 'pound', 'euro'].some((c) => lower.includes(c))) {
    return { unit: 'currency', symbol: raw.match(/[$£€]/)?.[0] ?? '$' }
  }
  return { unit: 'count' }
}

/** Genuinely interrogative wire copy: title or detail ends in "?". */
function isInterrogative(item: Pick<GuidanceItem, 'title' | 'detail'>): boolean {
  return (
    (item.title?.trim() ?? '').endsWith('?') || (item.detail?.trim() ?? '').endsWith('?')
  )
}

/**
 * UI-SEM-078 (hardened): positive gate for the framing-question slot. An
 * item qualifies only when it is genuinely interrogative OR framing-scoped
 * (target_object.type === 'framing' — a real value in the GuidanceItem
 * target vocabulary; extractPhase3's legacy target-ref convention maps it
 * through). Everything else — rerun/staleness nudges, housekeeping review
 * cards — stays on its own guidance surfaces: every derived phase-3 block
 * carries a 'discuss' action, so the action type alone cannot discriminate.
 * In production the old filter promoted a rerun nudge and the old
 * derivation showed its detail VERBATIM under "Olumi's framing question".
 * Remove when CEE provides an explicit framing_question field.
 */
export function qualifiesForFramingSlot(
  item: Pick<GuidanceItem, 'title' | 'detail' | 'target_object'>,
): boolean {
  return isInterrogative(item) || item.target_object?.type === 'framing'
}

/**
 * UI-SEM-078: framing-question derivation. The promoted guidance item is
 * usually an imperative chip TITLE, not a question — never show a bare
 * imperative label (or any non-interrogative prose) verbatim as "Olumi's
 * framing question". Prefer genuine interrogative text (title, then detail,
 * either ending in "?"); compose a question mechanically from the title
 * ONLY for framing-scoped items; otherwise return null and render no slot.
 * Remove when CEE provides an explicit framing_question field.
 */
export function deriveFramingQuestion(
  item: Pick<GuidanceItem, 'title' | 'detail' | 'target_object'>,
): string | null {
  const title = item.title?.trim() ?? ''
  const detail = item.detail?.trim() ?? ''
  if (title.endsWith('?')) return title
  if (detail.endsWith('?')) return detail
  if (item.target_object?.type !== 'framing') return null
  const stem = title.replace(/[.?!]+$/, '')
  if (!stem) return null
  return `What would it take to ${stem.charAt(0).toLowerCase()}${stem.slice(1)}?`
}

export interface DecisionOverviewCardProps {
  title?: string | null
  /** Fixture-gallery-only states (plan review B3) — never set on product. */
  stateOverride?: BriefStateOverride
}

export function DecisionOverviewCard({ title, stateOverride }: DecisionOverviewCardProps) {
  const analysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  // All selectors below return primitives (Zustand inline-selector rule).
  const goalThreshold = useCanvasStore((s) => s.goalThreshold)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const optionCount = useCanvasStore((s) => s.nodes.filter((n) => n.type === 'option').length)
  const constraintCount = useCanvasStore((s) => s.goalConstraints?.length ?? 0)
  const briefPresent = useCanvasStore((s) => Boolean(s.currentBriefText?.trim()))
  // Mirrors ResultsBody's UI-SEM-065 blocker read (graphHealth is the
  // engine-critique carrier; blocker severity never reaches uncertainties).
  const hasBlockerCritique = useCanvasStore((s) =>
    (s.graphHealth?.issues ?? []).some((i: { severity?: string }) => i.severity === 'blocker'),
  )
  // UI-SEM-077 (horizon input): a timeframe captured on the decision node's
  // brief block (the same field DecisionPanel displays). Free text from the
  // brief — shown verbatim, never normalised.
  const horizonText = useCanvasStore((s) => {
    for (const n of s.nodes) {
      if (n.type !== 'decision') continue
      const brief = (n.data as Record<string, unknown> | undefined)?.brief as
        | Record<string, string>
        | undefined
      const t = brief?.timeframe
      if (typeof t === 'string' && t.trim()) return t.trim()
    }
    return null
  })
  const goalUnitRaw = useCanvasStore((s) => {
    const goal = s.nodes.find((n) => n.type === 'goal')
    const d = goal?.data as Record<string, unknown> | undefined
    const observed = (d?.observedState ?? d?.observed_state) as { unit?: string } | undefined
    return (
      observed?.unit ??
      (typeof d?.goal_threshold_unit === 'string' ? d.goal_threshold_unit : undefined) ??
      s.ceeAnalysisReady?.goal_threshold_unit ??
      null
    )
  })
  // Review S3: promote only DISCUSSION challenges (never mechanical-fix
  // items like approve_patch/open_inspector) — closest honest v1 to the
  // brief's "highest-value framing challenge"; an explicit producer
  // framing-question signal is a routed ask.
  // UI-SEM-078 (hardened): additionally gate on framing relevance
  // (qualifiesForFramingSlot) — every derived phase-3 block carries a
  // 'discuss' action, so without the positive gate a max-priority rerun
  // nudge wins the slot (the production leak).
  const topGuidance = useGuidanceStore((s) => {
    const items = s.guidanceItems.filter(
      (i) => i.primary_action.type === 'discuss' && qualifiesForFramingSlot(i),
    )
    if (items.length === 0) return null
    // Display-order doctrine (UI-SEM-085): producer rank ascending via the
    // shared comparator — never a hand-rolled priority reduce.
    return items.reduce((best, i) => (compareGuidanceDisplayOrder(i, best) < 0 ? i : best), items[0])
  })

  // UI-SEM-079: framing-quality derivation. Only ready / needs-input arrive
  // from the wire (analysis_ready.status); the two non-ready qualities are
  // derived from the honest signals that exist today: a blocker-severity
  // engine critique -> blocked (danger; "resolve before relying on the
  // read"), a missing success measure -> thin (warning; the one
  // clarification is named, never the prototype's broader claim). With NO
  // CEE assessment the card stays in the quiet no-claim unassessed state.
  // Remove when CEE/PLoT provide a producer framing_quality signal.
  const liveState: BriefState = !analysisReady
    ? 'unassessed'
    : hasBlockerCritique
      ? 'blocked'
      : analysisReady.status !== 'ready'
        ? 'needs_input'
        : goalThreshold == null
          ? 'thin'
          : 'ready'
  const state: BriefState = stateOverride ?? liveState
  // Unassessed is a QUIET no-claim state — collapsed like ready (review S2).
  const autoExpand = state !== 'ready' && state !== 'unassessed'

  const [expanded, setExpanded] = useState(autoExpand)
  useEffect(() => setExpanded(autoExpand), [autoExpand])

  if (!isDecisionOverviewEnabled()) return null

  const questions = (analysisReady?.user_questions ?? []).slice(0, 3)
  // Review S1: never promise "questions below" when the producer sent none
  // (needs_encoding / needs_user_mapping often carry no user_questions).
  const copy =
    state === 'needs_input' && questions.length === 0
      ? { line: OVERVIEW_COPY.needsInput, note: OVERVIEW_COPY.needsInputNoQuestions }
      : stateOverride == null && state === 'thin'
        ? { line: OVERVIEW_COPY.thin, note: OVERVIEW_COPY.thinLiveNote }
        : STATE_COPY[state]

  // UI-SEM-077 (+ V7 L2, values-not-labels): decision-classification pill
  // inference. No producer classification contract exists; the only honest
  // client-side input today is the decision node's brief timeframe
  // (-> horizon). Stakes, reversibility and risk appetite have NO live
  // signal, so those fields fail closed to EMPTY (value null) — values are
  // NEVER fabricated. Collapsed doctrine (V6-RESPEC §4): a FILLED field
  // renders as its value chip; every EMPTY field folds into ONE muted
  // "+N to set" aggregate — the card shows what IS, never an inventory of
  // hidden field names. Remove the null fallbacks when CEE provides
  // decision_classification.
  const pillValues: Record<ClassificationDimension, string | null> = {
    stakes: null,
    reversibility: null,
    horizon: horizonText ? `Horizon: ${horizonText}` : null,
    risk: null,
  }
  const filledDims = CLASSIFICATION_DIMENSIONS.filter((dim) => pillValues[dim] != null)
  const unsetCount = CLASSIFICATION_DIMENSIONS.length - filledDims.length

  const reviewClassification = (dim: ClassificationDimension) =>
    openAskOlumi({
      context: OVERVIEW_COPY.pillContext,
      draft: `Help me work through: Review ${dim}`,
      label: `Review ${dim}`,
      source: 'chip',
    })

  const reviewDimension = (dim: Dimension) =>
    openAskOlumi({
      context: `Help me strengthen the ${dim.toLowerCase()} in my decision brief.`,
      draft: `Help me work through: Review ${dim}`,
      label: `Review ${dim}`,
      source: 'chip',
    })

  // Chip status notes — honest, store-derived, fail-closed:
  // Goal: the persisted success target (same slice SuccessTargetRow edits).
  // Context: brief presence only. Constraints: structured goal-constraint
  // count. Options: canvas option count. No diversity/quality claims — the
  // producer option-similarity signal does not exist yet.
  const { unit, symbol } = mapOutcomeUnit(goalUnitRaw)
  // Round-2 wiring: prefer the FULL saved success measure (Define-success
  // modal, scenario-keyed) — metric + direction + threshold+unit + timeframe.
  // Falls back to the bare committed threshold, then to 'missing'.
  const savedMeasure = useSuccessMeasureForScenario(currentScenarioId)
  const goalNote =
    savedMeasure != null
      ? `${savedMeasure.metric}: ${savedMeasure.direction === 'decrease_below' ? '≤' : '≥'} ${savedMeasure.threshold}${savedMeasure.unit === 'none' ? '' : savedMeasure.unit}, ${savedMeasure.timeframe}`
      : goalThreshold == null
        ? OVERVIEW_COPY.goalNoteMissing
        : `Success target ≥ ${formatTargetValue(goalThreshold, unit, symbol)}`
  const contextNote = briefPresent ? OVERVIEW_COPY.capturedInBrief : OVERVIEW_COPY.notCaptured
  const constraintsNote =
    constraintCount > 0
      ? `${constraintCount} ${constraintCount === 1 ? 'limit' : 'limits'} captured`
      : OVERVIEW_COPY.notCaptured
  const optionsNote =
    optionCount > 0
      ? `${optionCount} ${optionCount === 1 ? 'option' : 'options'} mapped`
      : OVERVIEW_COPY.optionsNoteEmpty
  const chips: Array<{ dim: Dimension; note: string; dotTone: string }> = [
    // Dot borders track brief QUALITY per the prototype (Goal warns only in
    // thin, Options flags only in the fixture conflict state) — success-
    // outlined otherwise.
    { dim: 'Goal', note: goalNote, dotTone: state === 'thin' ? 'border-warning' : 'border-success' },
    { dim: 'Context', note: contextNote, dotTone: 'border-success' },
    { dim: 'Constraints', note: constraintsNote, dotTone: 'border-success' },
    {
      dim: 'Options',
      note: optionsNote,
      dotTone: state === 'contradictory' ? 'border-danger' : 'border-success',
    },
  ]

  const framingQuestion = topGuidance ? deriveFramingQuestion(topGuidance) : null

  return (
    <section
      data-testid="decision-overview"
      className="rounded-md border border-panel-border bg-panel shadow-1"
    >
      <div className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className={`${typography.panelMeta} text-text-light`}>{OVERVIEW_COPY.metaLabel}</p>
          <h2 className={`${typography.panelHeader} text-text-header truncate`}>
            {title || OVERVIEW_COPY.titleFallback}
          </h2>
          <div aria-label="Decision classification" className="mt-1.5 flex flex-wrap gap-1.5">
            {filledDims.map((dim) => (
              <button
                key={dim}
                type="button"
                data-testid={`decision-pill-${dim}`}
                onClick={() => reviewClassification(dim)}
                className={`${typography.panelMeta} max-w-full truncate rounded-pill border border-panel-border bg-transparent px-2 py-0.5 text-text-body hover:bg-panel-hover`}
              >
                {pillValues[dim]}
              </button>
            ))}
            {/* One muted aggregate for every empty field (V6-RESPEC §4).
                Clicking it expands the card — the existing boolean expand
                behaviour, no new focus plumbing. Complete (dashed) border. */}
            {unsetCount > 0 && (
              <button
                type="button"
                data-testid="decision-pills-unset"
                onClick={() => setExpanded(true)}
                className={`${typography.panelMeta} max-w-full truncate rounded-pill border border-dashed border-panel-border bg-transparent px-2 py-0.5 text-text-light hover:bg-panel-hover`}
              >
                +{unsetCount} {OVERVIEW_COPY.classificationUnsetSuffix}
              </button>
            )}
          </div>
        </div>
        <ActionsMenu />
      </div>

      <button
        type="button"
        data-testid="brief-bar"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 flex w-full items-center gap-2 border-t border-panel-border px-3 py-2 text-left hover:bg-panel-hover"
      >
        <span
          data-testid="overview-status-dot"
          aria-hidden="true"
          className={`h-2 w-2 flex-none rounded-full ${STATE_DOT_TONE[state]}`}
        />
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelBody} block font-semibold text-text-header`}>{copy.line}</span>
          <span className={`${typography.panelMeta} block text-text-light`}>{copy.note}</span>
        </span>
        <ChevronDown
          size={16}
          className={`flex-none text-text-light transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-panel-border px-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            {chips.map(({ dim, note, dotTone }) => (
              <button
                key={dim}
                type="button"
                data-testid={`brief-dim-${dim.toLowerCase()}`}
                onClick={() => reviewDimension(dim)}
                className="flex min-w-0 items-center gap-1.5 rounded-md border border-panel-border bg-transparent px-2 py-1.5 text-left hover:bg-panel-hover"
              >
                <span
                  aria-hidden="true"
                  className={`h-[7px] w-[7px] flex-none rounded-full border bg-transparent ${dotTone}`}
                />
                <span className="min-w-0">
                  <span className={`${typography.panelBody} block font-semibold text-text-header`}>{dim}</span>
                  <span className={`${typography.panelMeta} block truncate text-text-light`}>{note}</span>
                </span>
              </button>
            ))}
          </div>

          {state === 'needs_input' && questions.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="brief-questions">
              {questions.map((q, i) => (
                <li key={`${i}-${q}`} className={`${typography.panelBody} text-text-body`}>
                  {q}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="brief-actions">
            <button
              type="button"
              onClick={() => openAskOlumi({ ...REVIEW_BRIEF_ASK, source: 'chip' })}
              className={`${typography.panelBody} text-info hover:underline`}
            >
              {OVERVIEW_COPY.reviewBrief}
            </button>
            <span className={`${typography.panelMeta} text-text-light`}>
              {OVERVIEW_COPY.reviewBriefHelper}
            </span>
          </div>

          {topGuidance && framingQuestion && (
            <div
              className="mt-2 flex flex-wrap items-start gap-2 border-t border-panel-border pt-2"
              data-testid="framing-question"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className={`${typography.panelMeta} text-text-light`}>{OVERVIEW_COPY.framingLabel}</p>
                <p className={`${typography.panelBody} mt-0.5 text-text-header`}>{framingQuestion}</p>
              </div>
              <div className="flex flex-none items-center gap-2">
                {/* No direct brief editor exists yet — Answer directly primes
                    the drawer draft for a straight answer instead (honest
                    interim; see the lane report). */}
                <button
                  type="button"
                  onClick={() =>
                    openAskOlumi({
                      context: framingQuestion,
                      draft: OVERVIEW_COPY.answerDraftPrefix,
                      label: 'Answer the framing question',
                      targetId: topGuidance.target_object?.id,
                      source: 'chip',
                    })
                  }
                  className={`${typography.panelBody} rounded-pill border border-panel-border bg-transparent px-2.5 py-1 text-text-body hover:bg-panel-hover`}
                >
                  {OVERVIEW_COPY.answerDirectly}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openAskOlumi({
                      context: framingQuestion,
                      draft:
                        topGuidance.primary_action.type === 'discuss'
                          ? topGuidance.primary_action.prompt
                          : `Help me work through: ${framingQuestion}`,
                      label: 'Work through the framing question',
                      targetId: topGuidance.target_object?.id,
                      source: 'chip',
                    })
                  }
                  className={`${typography.panelBody} text-info hover:underline`}
                >
                  {OVERVIEW_COPY.workThrough}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

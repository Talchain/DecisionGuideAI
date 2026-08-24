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
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { useCanvasStore } from '../../../canvas/store'
import { useSuccessMeasureForScenario } from '../modals'
import { useGuidanceStore, compareGuidanceDisplayOrder, type GuidanceItem } from '../../../canvas/stores/guidanceStore'
import { isDecisionOverviewEnabled } from '../../../flags'
import { typography } from '../../../styles/typography'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { computeSuccessState } from '../../../canvas/components/pre-analysis-v3/selectors/computeSuccessState'
import { computeGraphFacts } from '../../../canvas/components/pre-analysis-v3/selectors/graphFacts'
import { ActionsMenu } from './ActionsMenu'
import { REVIEW_BRIEF_ASK } from './actionsCatalogue'
import { parseStatedLimitsKey, selectStatedLimitsKey } from './statedLimits'

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
  // 'Not captured yet' is RETIRED — it was rendered by both the Context and
  // the Constraints chip and was wrong on each, in opposite ways. See the
  // chip-note derivation below. Its absence is pinned by
  // DecisionOverviewCard.spec.tsx, which asserts the literal sentence.
  // ⚠ THIS SENTENCE HAS NOW BEEN WRONG TWICE, IN TWO DIFFERENT WAYS, AND THE
  // SECOND CORRECTION IS THE ONE TO KEEP IN MIND.
  //
  // v1 "Not captured yet" was a FALSE DENIAL of the user's own input, and was
  // retired for that. v2 "No limits on record" fixed the denial and left an
  // ambiguity: "on record" reads as easily as "on YOUR record" as "in my
  // model". L3 measured a reader taking it the first way, on a brief stating
  // three constraints — two of them prefixed with the literal word
  // "constraint" — that the product demonstrably read and re-typed as soft
  // risks (L3-BROWSER-TRUTH §9 C7). The sentence must be unambiguously about
  // what the MODEL has set, which is the only thing `constraintCount` knows.
  constraintsNoteEmpty: 'Nothing set as a hard limit',
  // ⭐ STEP 6. The possessive is load-bearing and earned: every limit under
  // this heading is one the USER stated and CEE recorded verbatim, never a
  // value Olumi derived. The heading makes NO claim about whether a limit is
  // met — that verdict does not reach this surface (see the render site).
  statedLimitsHeading: 'Your stated limits',
  optionsNoteEmpty: 'No options mapped yet',
  // V6-RESPEC §4: empty classification fields fold into ONE muted aggregate
  // chip ("+N to set") — collapsed shows what IS, never a per-field inventory
  // of what ISN'T. The old per-field "not set" name labels are retired.
  classificationUnsetSuffix: 'to set',
  /**
   * L-58: what the compact "+N to set" chip COUNTS, and what clicking it does.
   *
   * ⚠ TWO PLAIN STRINGS, NOT A FORMATTER FUNCTION, AND THAT IS DELIBERATE.
   * `copyHygiene.spec.ts` scans `Object.values(OVERVIEW_COPY)` for em dashes,
   * shouting caps, American spellings and internal vocabulary. A function
   * value is invisible to that scan: the copy would ship UNCHECKED while the
   * guard stayed green — a guard that cannot see the string it is guarding.
   * Two constants keep every user-visible word inside the scan; the singular
   * arm exists so the chip never reads "1 more things".
   */
  classificationUnsetHintOne:
    'One more thing to say about this decision (stakes, reversibility, horizon or risk). Open the overview to set it.',
  classificationUnsetHintMany:
    'more things to say about this decision (stakes, reversibility, horizon and risk). Open the overview to set them.',
} as const

/** Composes the two hygiene-scanned arms above. */
export function classificationUnsetHint(n: number): string {
  return n === 1
    ? OVERVIEW_COPY.classificationUnsetHintOne
    : `${n} ${OVERVIEW_COPY.classificationUnsetHintMany}`
}

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

/**
 * The card's success-measure read, as a MODULE-SCOPE selector returning a
 * PRIMITIVE (`string | null`) — see the U1 note at its call site for why the
 * `s.nodes` subscription it replaced was a re-render regression.
 *
 * Module scope (rather than an inline arrow) is deliberate: a stable function
 * identity means Zustand does not have to re-establish the subscription on every
 * render, and it is testable on its own.
 *
 * Typed against the store's own state — DERIVED from `useCanvasStore.getState`
 * rather than mirroring a field list — so a rename of any field it reads is a
 * COMPILE error here, not a silent `undefined`. (`CanvasState` itself is not
 * exported from canvas/store.ts; deriving avoids widening this change into that
 * file to obtain a type it already publishes through its own getter.)
 */
type CanvasStoreState = ReturnType<typeof useCanvasStore.getState>

export function selectSuccessMeasureDisplayText(
  s: Pick<CanvasStoreState, 'nodes' | 'ceeAnalysisReady' | 'goalConstraints'>,
): string | null {
  return computeSuccessState(
    computeGraphFacts(s.nodes as never).goalNode,
    (s.ceeAnalysisReady as Record<string, unknown> | null) ?? null,
    null,
    s.goalConstraints,
  ).displayText
}

export function DecisionOverviewCard({ title, stateOverride }: DecisionOverviewCardProps) {
  const analysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  // All selectors below return primitives (Zustand inline-selector rule).
  /**
   * SUCCESS MEASURE — one reader of one fact (C2), read through ONE PRIMITIVE
   * selector (U1).
   *
   * C2 (why this reads the wire at all): this used to read
   * `store.goalThreshold`, which `deriveGoalThresholdFromNode`
   * (canvas/store.ts) populates ONLY when `data.threshold_source === 'user'`.
   * A CEE-DERIVED threshold (`goal_threshold_raw`, the drafting path's normal
   * output) therefore never reached this card, and it rendered "Success
   * measure missing" — and fell to the derived `thin` state — for a decision
   * that demonstrably had a measure. Meanwhile `computeSuccessState`, reading
   * the same fact off the wire two panels away, returned `isSet: true` and
   * rendered the value. One fact, two selectors, opposite answers; the one the
   * user saw was the wrong one. Fixed by REUSING the existing pair rather than
   * adding a third read: `computeGraphFacts` for goal-node selection and
   * `computeSuccessState` for the measure — exactly what `usePreAnalysisModel`
   * does. A local goal-node finder here would have minted precisely the kind of
   * mirror that change exists to retire.
   *
   * U1 (why it is ONE primitive selector and not `s.nodes` + a useMemo): C2
   * subscribed to `s.nodes` and `s.goalConstraints` directly, on the stated
   * grounds that the `nodes` array reference "is stable in the store". It is
   * not. `onNodesChange` does `applyNodeChanges(changes, s.nodes)`, which
   * returns a NEW array for every change including `position` — once per drag
   * frame — so `Object.is` stopped suppressing anything and this card
   * re-rendered its whole subtree while the user dragged. That is the normal
   * case, not an edge case: OutputsDock mounts the card exactly when a
   * completed analysis sits beside the canvas, which is when the user drags
   * nodes to revise.
   *
   * Computing INSIDE the selector is strictly less work than the subscription
   * it replaces: `computeGraphFacts` is one O(nodes) pass and
   * `computeSuccessState` is O(constraints), against a full subtree re-render
   * per frame.
   *
   * `isSet` is NOT a second subscription: `computeSuccessState` returns a
   * non-null `displayText` on exactly the branches where `isSet` is true, on
   * all six return sites. That coupling is pinned by
   * `__tests__/DecisionOverviewCard.primitiveSelectors.spec.tsx` ("INVARIANT"),
   * so it cannot drift silently into the card claiming a measure is missing
   * beside a rendered value.
   */
  const successDisplayText = useCanvasStore(selectSuccessMeasureDisplayText)
  const successIsSet = successDisplayText !== null
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const optionCount = useCanvasStore((s) => s.nodes.filter((n) => n.type === 'option').length)
  const constraintCount = useCanvasStore((s) => s.goalConstraints?.length ?? 0)
  // ⭐ STEP 6 of the hard-constraint chain — the user sees the limit they
  // stated, not merely a count of how many were captured.
  //
  // This reads the SAME store slice `constraintCount` already counts, so there
  // is no second constraint vocabulary and no second producer. What it shows is
  // strictly the TRUSTWORTHY half of a constraint — label, operator, value,
  // unit, all of them things the user said and CEE recorded. The DISTRUSTED
  // half (`probability`, and PLoT's per-option `constraint_analysis`, still
  // gated by `PLOT_PER_OPTION_CONSTRAINTS_SUSPECT`) is never read here.
  // Selected as a PRIMITIVE string, never the array identity: this card is
  // under a primitive-selector contract (primitiveSelectors.spec) so that a
  // store write which rebuilds an equal-content constraints array — a node
  // drag, a producer re-sync — does not re-commit the whole card.
  const statedLimitsKey = useCanvasStore((s) => selectStatedLimitsKey(s.goalConstraints))
  const statedLimits = useMemo(() => parseStatedLimitsKey(statedLimitsKey), [statedLimitsKey])
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
        : !successIsSet
          ? 'thin'
          : 'ready'
  const state: BriefState = stateOverride ?? liveState
  // ⭐ ANSWER FIRST (UX gate point 3, 18 Aug 2026 — measured on deployed
  // `4d1e650b`, fresh guest, 1280x800).
  //
  // This card auto-expanded on every non-ready framing quality, INCLUDING
  // after a completed analysis. Measured on staging: the verdict sentence sat
  // 573px down a 515px-tall visible region — 111% of a panel height — and the
  // four Goal/Context/Constraints/Options sub-cards plus the brief actions and
  // the framing question were the bulk of what pushed it there. A fresh user
  // who had just clicked "Analyse first pass" saw no answer at all without
  // scrolling.
  //
  // ORDERING, NOT DELETION. Nothing is removed: the same four dimensions, the
  // same "Review your decision brief" action and the same framing question all
  // still render, one click away behind the disclosure control this card
  // already owns (`aria-expanded`, below). Paul's constraint on every
  // simplification is "less interface, not less intelligence" — so the
  // framing prompt keeps its full content and loses only its claim on the
  // first screenful once there is a result to read.
  //
  // `blocked` is deliberately EXEMPT. It is the danger-severity state ("resolve
  // before relying on the read"): a framing problem serious enough to undermine
  // the result must not be folded away behind the result it undermines.
  //
  // Derived from the report, not from the caller's mount gate. `OutputsDock`
  // only mounts this card post-analysis today, which would make `hasResult`
  // structurally true and this condition invisible — but a card that reads its
  // own precondition cannot be silently re-pointed by a future mount site
  // (CLAUDE.md trap 3b), and pre-analysis mounts keep the historic behaviour.
  const hasResult = useCanvasStore((s) => s.results?.report != null)
  const autoExpand =
    state === 'blocked' || (!hasResult && state !== 'ready' && state !== 'unassessed')

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
  // Round-2 wiring: prefer the FULL saved success measure (Define-success
  // modal, scenario-keyed) — metric + direction + threshold+unit + timeframe.
  // Falls back to the bare committed threshold, then to 'missing'.
  const savedMeasure = useSuccessMeasureForScenario(currentScenarioId)
  const goalNote =
    savedMeasure != null
      ? `${savedMeasure.metric}: ${savedMeasure.direction === 'decrease_below' ? '≤' : '≥'} ${savedMeasure.threshold}${savedMeasure.unit === 'none' ? '' : savedMeasure.unit}, ${savedMeasure.timeframe}`
      : !successIsSet
        ? OVERVIEW_COPY.goalNoteMissing
        : `Success target ≥ ${successDisplayText}`
  // CONTEXT — no claim, rather than a false denial.
  //
  // `currentBriefText` has exactly ONE non-null writer in the whole of src/:
  // ChatComposer.tsx, mirroring the AI-panel composer's own textarea on a
  // 500 ms debounce (so it also reverts to null the moment that composer
  // clears on send). The live first-draft surface is FirstUseComposer →
  // AIInputBar, which contains ZERO references to the field. Live-confirmed
  // on deployed staging: the store read `currentBriefText: null` with a
  // 470-character brief on screen and a drafted graph behind it.
  //
  // So a falsy read carries no information about whether the user gave any
  // context — it is a dead read on the path that matters, and rendering
  // "Not captured yet" denied something the user plainly did. When the field
  // IS populated the claim is truthful and stays; otherwise the chip makes no
  // factual claim at all and remains a "Review Context" affordance. A capture
  // signal is deliberately NOT synthesised from the transcript: transcriptStore
  // is scenario-scoped, so the chip would flip on reload.
  const contextNote = briefPresent ? OVERVIEW_COPY.capturedInBrief : null
  // CONSTRAINTS — the read is right; only the sentence was wrong.
  //
  // `goalConstraints` is genuinely producer-fed (applyDraftResult writes CEE's
  // `draft_graph.goal_constraints`; applyV5State writes add_constraint
  // patches), so a zero count is TRUE — about STRUCTURED goal constraints.
  // What it never licensed was "Not captured yet", a claim about the user's
  // own input: CEE demonstrably reads soft constraints out of the brief and
  // says so in its coaching while deliberately not encoding them as limits.
  // The note therefore describes the record, not the user.
  const constraintsNote =
    constraintCount > 0
      ? `${constraintCount} ${constraintCount === 1 ? 'limit' : 'limits'} captured`
      : OVERVIEW_COPY.constraintsNoteEmpty
  const optionsNote =
    optionCount > 0
      ? `${optionCount} ${optionCount === 1 ? 'option' : 'options'} mapped`
      : OVERVIEW_COPY.optionsNoteEmpty
  const chips: Array<{ dim: Dimension; note: string | null; dotTone: string }> = [
    // Dot borders track brief QUALITY per the prototype (Goal warns only in
    // thin, Options flags only in the fixture conflict state) — success-
    // outlined otherwise.
    { dim: 'Goal', note: goalNote, dotTone: state === 'thin' ? 'border-warning' : 'border-success' },
    { dim: 'Context', note: contextNote, dotTone: 'border-success' },
    {
      dim: 'Constraints',
      note: constraintsNote,
      // The NOTE was corrected before and the DOT was not, so the card went on
      // rendering a zero-constraint record in the tone that means "all good"
      // — the same claim the sentence had just stopped making, in the other
      // channel (link-track R1 / C7). A zero is either a real gap or a
      // silent loss; the chip may report it, it may not approve of it.
      dotTone: constraintCount > 0 ? 'border-success' : 'border-text-light',
    },
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
            {/* ⭐ L-58: the visible chip read "+4 to set" — four of WHAT, set
                WHERE, and by whom? It sits beside value pills like "High
                stakes", so the reader has no way to infer that the four are
                the UNFILLED members of that same set. The visible text is
                unchanged (it is a compact aggregate by design, V6-RESPEC §4)
                but it is no longer the only thing on offer: the accessible
                name and the tooltip now say what the number counts and what
                clicking does. */}
            {unsetCount > 0 && (
              <button
                type="button"
                data-testid="decision-pills-unset"
                onClick={() => setExpanded(true)}
                title={classificationUnsetHint(unsetCount)}
                aria-label={classificationUnsetHint(unsetCount)}
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
          <span className={`${typography.panelHeader} block text-text-header`}>{copy.line}</span>
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
                  data-dim-dot={dim.toLowerCase()}
                  className={`h-[7px] w-[7px] flex-none rounded-full border bg-transparent ${dotTone}`}
                />
                <span className="min-w-0">
                  <span className={`${typography.panelHeader} block text-text-header`}>{dim}</span>
                  {/* A null note renders NOTHING — not an empty line. Silence is
                      the honest state for a dimension we cannot speak to. */}
                  {note !== null && (
                    <span className={`${typography.panelMeta} block truncate text-text-light`}>{note}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* ⭐ The limits the user actually stated.
              Renders NOTHING when there are none, so a model with no hard
              limit is byte-identical to before this shipped.

              Deliberately silent about COMPLIANCE. Whether an option breaches
              a limit is not derivable here: the browser holds no per-option
              value on the constrained node, and PLoT's run-level
              `constraints_status` is stripped on the CEE→UI hop (absent from
              CEE compose.ts `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP`). Saying
              "not evaluated" would be just as false as saying "met" —
              evaluation DOES happen upstream, its verdict simply does not
              reach this surface. So this states the limit and claims nothing
              else. See the lane report's CEE dependency. */}
          {statedLimits.length > 0 && (
            <div className="mt-2" data-testid="stated-limits">
              <p className={`${typography.panelMeta} text-text-light`}>
                {OVERVIEW_COPY.statedLimitsHeading}
              </p>
              <ul className="mt-1 space-y-0.5">
                {statedLimits.map((limit) => (
                  <li
                    key={limit.id}
                    data-testid={`stated-limit-${limit.id}`}
                    className={`${typography.panelBody} truncate text-text-body`}
                    title={limit.text}
                  >
                    {limit.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

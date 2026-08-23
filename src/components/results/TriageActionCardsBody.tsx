/**
 * TriageActionCardsBody — extracted from DecisionConfidencePanel.
 *
 * Holds the action-card body of the post-analysis triage panel:
 * - Result checks (target probability bars)
 * - T1 flip-risk callout
 * - Conditional scenarios (when present)
 * - Stability narrative + unified EVPI-ranked triage queue (top 3 + quick-fix 4-6)
 * - Dominant-factor nudge
 * - T1 checks footer (Winner / Robust / Evidence glyphs + MissingKnowledgePrompt)
 *
 * Extraction is an identity refactor — see docs/brief-analysis-hero-v17-implementation.md §3 step 1.
 * The new v17 hero (AnalysisHeroV17) will compose the same body with a different top header.
 *
 * Do not change behaviour here. Behaviour changes belong upstream in
 * DecisionConfidencePanel or downstream in AnalysisHeroV17.
 */

import { useMemo, memo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react'
import { ConditionalWinnerCards } from './ConditionalWinnerCards'
import { resolveTriageBodyText } from '@/components/shared/resolveTriageBodyText'
import {
  resolveEvidenceGapConfidenceDisplay,
  evidenceGapGenericText,
  evidenceGapSourcePill,
  isEvidenceGapAddressed,
} from './utils/evidenceGapConfidenceDisplay'
import { dedupTriageItems } from './utils/dedupTriageItems'
import { TriageCard } from '@/components/shared/TriageCard'
import type { TriageCardCategory, TriageCardAction } from '@/components/shared/TriageCard'
// The canonical "open the editor for this node" seam. Imported here for the
// same reason `AnalysisHeroPanel` imports `openEdgeStrengthEditor`: a surface
// in the OutputsDock cannot reach the inspector any other way. See
// `openValueEditor` below.
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '@/canvas/mutations/mutationAuthority'
import { openNodeInspector } from '@/canvas/nodes/shared/openNodeInspector'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { TargetProbabilityBars } from './TargetProbabilityBars'
import { stripEncodingNotation, cleanFactorLabel } from './utils/cleanFactorLabel'
import {
  INFLUENCE_TIE_EPSILON,
  resolveAnalysisMetric,
  resolveDriverClaimBasis,
  type ResolvedAnalysisMetric,
} from './driverDisplayModel'
import { analysisMetricPredicate } from './influenceScaleCopy'
// Canonical glossary check shared with the v17 hero row builders. Used in
// v17 mode (`useV17Copy === true`) to sanitise user-supplied labels before
// they are interpolated into GENERATED prose, aria-labels, or titles. The
// raw label is still preserved verbatim in visible identity fields (the
// bolded factor-name span) — only the generated text around it is gated.
// See utils/glossaryCheck.ts header for the dependency rationale.
import { safeInterpolatedLabel } from './utils/glossaryCheck'
import { typography } from '@/styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { useCanvasStore } from '@/canvas/store'
import { attestsNoFactorFlip } from './utils/fragileEdgeCopy'
import {
  buildStrengthenOverlayMap,
  findStrengthenOverlay,
  type StrengthenOverlay,
} from '@/canvas/components/pre-analysis/utils/applyStrengthenOverlay'

// ── Types ───────────────────────────────────────────────────────────────────

interface TriageActionCardsBodyProps {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** Handler for setting a factor value via inline editor */
  onSetValue?: (nodeId: string, rawValue: number) => void
  /** Handler for confirming a factor value */
  onConfirm?: (nodeId: string) => void
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Brief 5.8B D2c: AI affordance rendered inside the T1 checks-footer MissingKnowledgePrompt. */
  aiAffordance?: ReactNode
  /**
   * When true, the EVPI-ranked triage queue, stability narrative, and
   * `AlsoConsiderDisclosure` are suppressed — the v17 hero composes this
   * body and renders its own `HeroInputRows` for the same data, so we
   * must not duplicate the queue. The flip-risk callout, conditional
   * scenarios, dominant nudge, and T1 checks footer all still render —
   * those are contextual signals the v17 top section does not duplicate.
   *
   * Default: false (legacy DecisionConfidencePanel rendering — queue on).
   */
  suppressTriageQueue?: boolean
  /**
   * v17 hero opt-in for glossary-safe copy across the body sub-components.
   * When true, applies in FOUR distinct places:
   *   1. `T1ChecksFooter` literals: "Winner" / "No winner" →
   *      "Has leading option" / "No clear leader".
   *   2. `T1DominantNudge`: rewrites the trailing tooltip sentence
   *      ("the recommendation could change" → "the leading option could
   *      change") AND sanitises the `dominantLabel` interpolation in
   *      `aria-label` + `title` via `safeInterpolatedLabel`.
   *   3. `T1FlipRiskCallout`: sanitises `fragile.fromLabel` and
   *      `alternativeWinnerLabel` interpolations in the generated prose
   *      and Validate-button text via `safeInterpolatedLabel`.
   *   4. `ConditionalWinnerCards`: rewrites the header help text
   *      ("…change the recommendation…" → "…change which option leads…")
   *      and gates four user-supplied label interpolations
   *      (`factor_label`, the chosen `alt`, plus the Above/Below bucket
   *      `winner_label`s) via `safeInterpolatedLabel`. (Round-7 P1.1.)
   *
   * The dominant nudge's visible identity span still renders the raw
   * user label — only generated wrapping copy is gated. Default false —
   * legacy `DecisionConfidencePanel` rendering keeps its existing copy
   * and tests untouched.
   */
  useV17Copy?: boolean
}

// ── Action item mapping ─────────────────────────────────────────────────────

interface MappedActionItem {
  key: string
  title: string
  detail: string
  subtitle: string | undefined
  category: TriageCardCategory
  analysisMetric: ResolvedAnalysisMetric | null
  action: TriageCardAction | undefined
  targetNodeId: string | undefined
  editorConfig: ScientificEditorProps | null
  sourcePill: { label: string; borderClass: string } | null
  /** Brief 5.8B D2b — passive labels overlaid from CEE strengthen_items.actionType */
  passiveLabels: string[] | undefined
}

function applyOverlayToItem(
  item: MappedActionItem,
  overlay: StrengthenOverlay | null,
): MappedActionItem {
  if (!overlay) return item
  return {
    ...item,
    subtitle: overlay.detail,
    passiveLabels: overlay.actionTypeLabel ? [overlay.actionTypeLabel] : item.passiveLabels,
  }
}



function mapEvidenceGapsToActions(
  data: ResultsSectionDataReturn,
  onSetValue?: (nodeId: string, rawValue: number) => void,
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>,
): MappedActionItem[] {
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  return gaps.map((gap, i) => {
    const targetId = gap.targetNodeId ?? gap.factorId
    const nodeMeta = nodeValueLookup?.[targetId] ?? nodeValueLookup?.[gap.factorId] ?? null
    const currentValue = nodeMeta?.value ?? null
    const currentUnit = nodeMeta?.unit ?? null
    const currentCap = nodeMeta?.cap ?? null
    // Post-analysis body precedence (coaching → generic fallback) goes
    // through the shared resolver so pre- and post-analysis agree.
    // ⛔ F6 gate. `gap.confidence` was fabricated as `?? 0` upstream and this
    // sentence asserted it: "This factor has 0% confidence."
    const confidenceDisplay = resolveEvidenceGapConfidenceDisplay(gap.confidence)
    const { text: detail } = resolveTriageBodyText({
      coaching: gap.suggestion,
      generic: evidenceGapGenericText(confidenceDisplay),
    })
    return {
      key: `gap-${gap.factorId}-${i}`,
      title: gap.factorLabel,
      detail,
      subtitle: undefined,
      category: 'add_evidence' as const,
      analysisMetric: resolveAnalysisMetric({
        value: gap.voi,
        basis: 'value_of_information',
      }),
      action: {
        kind: 'set_value' as const,
        label: 'Set value',
        targetId,
        targetType: 'node' as const,
      },
      targetNodeId: targetId,
      editorConfig: onSetValue ? {
        kind: 'factor' as const,
        rawValue: currentValue,
        cap: currentCap,
        unit: currentUnit,
        onSave: (rawValue: number) => onSetValue(targetId, rawValue),
        onCancel: () => {},
      } : null,
      sourcePill: evidenceGapSourcePill(confidenceDisplay),
      passiveLabels: undefined,
    }
  })
}

function mapNextActionsToCards(data: ResultsSectionDataReturn): MappedActionItem[] {
  const actions = data.confidence.topNextActions ?? data.confidence.nextActions ?? []
  return actions.map((action, i) => ({
    key: `action-${i}`,
    title: action.action,
    detail: action.rationale,
    subtitle: undefined,
    category: 'strengthen' as const,
    analysisMetric: null,
    action: action.targetId ? {
      kind: 'edit' as const,
      label: 'Edit',
      targetId: action.targetId,
      targetType: (action.targetType ?? 'node') as 'node' | 'edge',
    } : undefined,
    targetNodeId: action.targetId,
    editorConfig: null,
    sourcePill: null,
    passiveLabels: undefined,
  }))
}

// ── The "Edit value" affordance: one rule, named ────────────────────────────

/**
 * THE CANONICAL RULE: a control labelled "Edit value" opens the node's
 * inspector — the only surface in the product that can edit a factor's value.
 * It never merely moves the camera.
 *
 * ## What this replaces, and why it was a lie
 *
 * These call sites passed `onEdit={onFocusNode}`. `onFocusNode` resolves to
 * `useFocusCamera`'s `handleFocusNode`, which selects the node, sets a
 * transient focus dim and conditionally fits the camera. It opens nothing:
 * `InspectorModal` is gated on `showFullInspector`, LOCAL React state in
 * `ReactFlowGraph` raised only by the `olumi:open-full-inspector` window
 * event, and `handleFocusNode` never dispatches it. So the pencil promised an
 * edit and delivered a pan, leaving the user to find the node and click it.
 *
 * This is the panel-side twin of the R5 defect already fixed on the canvas,
 * where the on-node Edit pencil wrote `showInspectorPanel` — a store field
 * with zero render consumers. Same promise, different dead end.
 *
 * ## Why the handler lives here and not in `TriageCard`
 *
 * `TriageCard` is shared UI and deliberately carries no canvas dependency (see
 * the `aiDiscussSlot` prop comment: consumers construct canvas-coupled
 * elements and pass them in). So the rule is applied at the SEAM — explicitly,
 * by name — rather than being an accident of whichever handler a consumer
 * happened to inject. `PreAnalysisPanel`, the other consumer of this
 * component, injects this same helper for the same control.
 *
 * Fail-closed and silent on a node that is not on the canvas, inherited from
 * `openNodeInspector`: a stale target must never open an empty inspector.
 *
 * Module-level so the reference is stable across renders of a memoised tree.
 */
const POST_RUN_VALUE_EDIT_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.postRunFactorValue,
)
const POST_RUN_FACTOR_CONFIRMATION_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.postRunFactorConfirmation,
)
const openValueEditor = (nodeId: string): void => {
  openNodeInspector(nodeId)
}

// ── Section 2: Result checks (Brief 5.8B D2c — flip-risk extracted) ─────────

function ResultChecks({ data }: { data: ResultsSectionDataReturn }) {
  const rec = data.recommendation
  const winnerConstraints = rec.recommendedOption?.constraintAnalysis
  const goalThreshold = rec.goalThreshold
  return (
    <div className="space-y-2">
      <TargetProbabilityBars
        constraintAnalysis={winnerConstraints}
        goalThreshold={goalThreshold}
      />
    </div>
  )
}

/**
 * T1 flip-risk callout — moved from inside ResultChecks per Brief 5.8B D2c
 * step 1. Copy is preserved verbatim ("LOCKED — placement only"). Renders as
 * an inline `.nudge`-shaped row inside the T1 stack.
 */
function T1FlipRiskCallout({
  data,
  onFocusNode,
  useV17Copy = false,
}: {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  /**
   * v17 hero mode — sanitise user-supplied labels before interpolating them
   * into the generated prose. Legacy callers (`DecisionConfidencePanel`)
   * pass labels through unchanged (default false). (Round-5 P1.1 + P1.2.)
   */
  useV17Copy?: boolean
}) {
  const fragile = data.confidence.topFragileEdge ?? data.confidence.m1CoachingTopFragileEdge
  if (!fragile) return null
  // ⚠ CONSULT THE FLIP AUTHORITY — this callout renders the LITERAL second line
  // of the witnessed contradiction ("{alt} could overtake (57% probability)")
  // beside a footer stating that no probed factor changes the leader on its own.
  // `switch_probability` is an EDGE statistic observed under JOINT sampling; the
  // footer speaks for a SOLO sweep of root factors. Same fix as the fragile card:
  // the presupposing verb goes, ALL data stays (see `fragileEdgeCopy`).
  const attestsNoFlip = attestsNoFactorFlip(data.recommendation.flipThresholds)
  const switchPct = fragile.switchProbability != null
    ? Math.round(fragile.switchProbability * 100)
    : null
  // (Round-5 P1.1) In v17 mode, swap a banned-term label for a generic
  // phrase BEFORE interpolating into the visible prose, aria text, and
  // button copy. The raw label still appears in the legacy panel verbatim.
  const fromLabelDisplay = useV17Copy
    ? safeInterpolatedLabel(fragile.fromLabel, 'this factor')
    : fragile.fromLabel
  const altWinnerLabelDisplay = useV17Copy
    ? safeInterpolatedLabel(fragile.alternativeWinnerLabel, 'the next option')
    : fragile.alternativeWinnerLabel
  const validateLabel = useV17Copy
    ? safeInterpolatedLabel(stripEncodingNotation(fragile.fromLabel), 'this factor')
    : stripEncodingNotation(fragile.fromLabel)
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-warning/30 bg-panel"
      data-testid="t1-flip-risk-callout"
    >
      <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className={`${typography.panelBody} text-text-body`}>
        If <strong>{fromLabelDisplay}</strong> shifts,{' '}
        <strong>{altWinnerLabelDisplay}</strong>{' '}
        {attestsNoFlip ? 'could gain ground' : 'could overtake'}
        {/* ⚠ THE PERCENTAGE GOES WITH THE VERB, and the reason is not the
            authority's rule alone — it is that the NUMBER WOULD SAY MORE THAN
            THE SENTENCE IT SITS IN. `switch_probability` means P(the
            alternative OVERTAKES). Printed beside a deliberately weakened verb
            it reads "55% chance it gains ground", which is not what the number
            measures — a hedged verb carrying an unhedged number. The only
            honest label for it ("55% chance it overtakes") is precisely the
            claim this whole change removes, so there is no wording that keeps
            it. It is a CLAIM, not data, and it goes.

            This is not the product saying less: it is declining to say
            something false. The finding survives in full on the fragile card
            (count, labels, E-values, alt-winner, Stability pill). */}
        {!attestsNoFlip && switchPct != null && ` (${switchPct}% probability)`}.
        {onFocusNode && fragile.fromId && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => onFocusNode(fragile.fromId)}
              className="text-info hover:underline cursor-pointer"
            >
              Validate {validateLabel}
            </button>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * T1 dominant-factor nudge — Brief 5.8B D2c step 2 + follow-up polish.
 * Now a true single-line `.nudge` row: warning icon + bolded
 * "Dominant factor:" + truncated detail + the inline Validate chip.
 * The full explanation surfaces via the row's `title` tooltip rather than
 * a wrapped paragraph; consumers who need the long form should look at the
 * Drivers section. Locked copy fragments preserved.
 *
 * ⛔ THE "Research <factor>" CHIP WAS REMOVED HERE (ROADMAP 2.816).
 * It opened the Ask-Olumi drawer prefilled with "Can you research <factor>
 * and suggest a reasonable estimate with sources?", and Send dispatched an
 * ORDINARY chat turn — there is no typed research action, no research-tool
 * transport and no producer anywhere in the estate, so the service answers
 * "I can't fetch external sources". The register's ruling on this surface is
 * explicit: "Two honest fixes: remove the CTA, or build the producer. There
 * is no third option that leaves the button where it is." Building the
 * producer is a real capability with six unsettled design questions
 * (docs-designs/RESEARCH-RESTORE-ASSESSMENT-2026-07-25.md §7); until it
 * exists, the surface must not advertise it. `researchCtaRetired.spec.tsx`
 * holds this closed on both deployed arms — do not re-add a research
 * affordance here without a producer behind it.
 */
function T1DominantNudge({
  data,
  onFocusNode,
  useV17Copy = false,
}: {
  data: ResultsSectionDataReturn
  onFocusNode?: (nodeId: string) => void
  /**
   * v17 hero mode — apply glossary-safe copy. The "recommendation could
   * change" sentence is rewritten to glossary-safe language.
   */
  useV17Copy?: boolean
}) {
  const drivers = data.drivers
  // ⚠ ONE list, so "the top" and "the runner-up" cannot come from different
  // orderings. Same fallback the single-driver read used before.
  const rankedDrivers = (drivers.topDrivers?.length ? drivers.topDrivers : drivers.drivers) ?? []
  const topDriver = rankedDrivers[0]
  const runnerUp = rankedDrivers[1]
  // Value, basis, and permitted language come from one policy read. Missing
  // or contradictory fields fail closed; neither state becomes a numeric 0.
  const topMetric = resolveDriverClaimBasis(topDriver)
  const runnerUpMetric = resolveDriverClaimBasis(runnerUp)
  // ⚠ DOMINANCE REQUIRES A RUNNER-UP TO BE DOMINANT OVER (2026-08-19). The
  // gate tested only the top's own magnitude, so it still asserted a dominant
  // factor on a run where three factors tied at 100%. "Dominant" is a
  // COMPARATIVE claim; a tie cannot support one. Same
  // `INFLUENCE_TIE_EPSILON` the panel's badges and its equal-influence note
  // use, so all three surfaces agree on what counts as a tie.
  const comparableAbsolutePair =
    topMetric?.basis === 'influence_score' && runnerUpMetric?.basis === 'influence_score'
  const topIsClearOfRunnerUp = comparableAbsolutePair
    ? topMetric.value - runnerUpMetric.value > INFLUENCE_TIE_EPSILON
    : false
  const showNudge = comparableAbsolutePair && topMetric.value >= 0.8 && topIsClearOfRunnerUp
  const rawLabel = drivers.dominantFactorLabel ?? topDriver?.factorLabel ?? ''
  const dominantLabel = cleanFactorLabel(rawLabel).label
  if (!showNudge || !dominantLabel) return null
  const dominantFocusId = drivers.dominantFactorId
    ?? topDriver?.matchedNodeId
    ?? topDriver?.factorKey
    ?? null
  const explanation = `${analysisMetricPredicate(topMetric)}.`
  // (Round-5 P1.2, P0 follow-up) Both v17 and legacy modes use glossary-
  // safe copy. The legacy branch previously contained "the recommendation
  // could change"; the P0 surface-copy cleanup retired that. The two
  // branches diverge only in noun choice — v17 hero says "the leading
  // option", legacy panel says "the result".
  const trailingClause = useV17Copy
    ? 'If your assumptions about this factor are wrong, the leading option could change.'
    : 'If your assumptions about this factor are wrong, the result could change.'
  // (Round-5 P1.1) v17 mode: the dominant factor's label is user data and
  // still appears VERBATIM in the visible identity span. But when the same
  // label gets interpolated into generated text (aria-label, title), gate
  // it through the canonical glossary check so a user-named factor like
  // "Best choice analysis" cannot smuggle a banned term into accessibility
  // output. Legacy panel keeps the raw label in both places.
  const labelForGeneratedCopy = useV17Copy
    ? safeInterpolatedLabel(dominantLabel, 'this factor')
    : dominantLabel
  const fullExplanation = `Dominant factor: ${labelForGeneratedCopy} ${explanation} ${trailingClause}`

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 border border-panel-border rounded-lg"
      role="status"
      aria-label={`Dominant factor warning. ${fullExplanation}`}
      data-testid="t1-dominant-nudge"
      title={fullExplanation}
    >
      <AlertTriangle size={14} className="text-warning flex-shrink-0" aria-hidden="true" />
      {/* Factor name never truncates; explanation text takes remaining space and clips. */}
      <p className={`${typography.panelMeta} text-text-body min-w-0 flex-1 flex items-baseline gap-1 overflow-hidden`}>
        <span className="whitespace-nowrap"><strong>Dominant factor:</strong></span>
        {/* Visible identity span — always renders the raw user label, even in v17 mode. */}
        <strong className="whitespace-nowrap">{dominantLabel}</strong>
        <span className={`truncate min-w-0 flex-1 text-text-light`}>{explanation}</span>
      </p>
      {dominantFocusId && onFocusNode && (
        <button
          type="button"
          onClick={() => onFocusNode(dominantFocusId)}
          className={`flex-shrink-0 px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
          aria-label={`Validate ${labelForGeneratedCopy} on canvas`}
        >
          Validate
        </button>
      )}
      {/* ROADMAP 2.816: the "Research <factor>" chip stood here. Removed —
          see the component header. Validate above is the surviving action,
          and it is honest: it focuses the factor on the canvas, which the
          product can actually do. */}
    </div>
  )
}

/**
 * T1 checks footer — Brief 5.8B D2c step 3. Compact row at the bottom of the
 * T1 stack: ✓/✗ Winner · ✓/✗ Robust · ✓/✗ Evidence gaps + addressed counter
 * + the shared `MissingKnowledgePrompt`. Each glyph + label uses panelMeta
 * (10px text-light) for visual demotion below the queue.
 */
function T1ChecksFooter({
  data,
  aiAffordance,
}: {
  data: ResultsSectionDataReturn
  aiAffordance?: ReactNode
}) {
  // SINGLE VERDICT (2026-07-25): this check used to be presence-only
  // (`!!recommendedOption`), and `determineWinnerSelection` always returns a
  // winner when any option exists — so the footer could tick "Winner" in the
  // same panel whose headline said "no clear leading option". It now quotes
  // the shared verdict (src/lib/decisionVerdict.ts), the same one the
  // headline and the canvas badge use. Absent verdict (older fixtures) falls
  // back to the historic presence check rather than silently reading false.
  const verdict = data.recommendation.verdict
  const hasWinner = verdict
    ? verdict.hasLeadingOption
    : !!data.recommendation.recommendedOption
  // ⭐ NO DENIAL WITHOUT AUTHORITY (Analysis convergence, 18 Aug 2026).
  //
  // `hasLeadingOption === false` covers TWO different states and this is the
  // one consumer for which they differ. Every other consumer in the tree
  // (`OptionNode`, `DecisionNode`, `OptionPanel`, `OptionCards`,
  // `V5AnalysisResultBlock`, `deriveRunPairComparison`) uses the boolean to
  // WITHHOLD — correct for both states, so none of them had to read
  // `separation`. This one turns it into an affirmative DENIAL, and
  // `decisionVerdict.ts` licenses that for `'tied'` ONLY:
  //
  //   "`false` — surfaces must NOT badge, and MAY say 'no clear leading
  //    option' (only when `separation === 'tied'`; `'unknown'` licenses
  //    silence, never a denial)"
  //
  // Measured on deployed staging `c71ea7e0`: a run whose producer sent no
  // near-tie block and no `headline_banded` rendered "No clear leader" here
  // while `results-analysis-footer` three screens below said "Stable ranking —
  // this result held up under the changes we tested". Two authorities, two
  // questions (CLAUDE.md trap 21) — and one of them claiming what it does not
  // hold. Reconciling the DEFAULTS would have been the wrong fix; withdrawing
  // the unlicensed claim is the right one, and it leaves the tie denial intact.
  //
  // `unknown` therefore renders the neutral third state — the same idiom the
  // robustness check beside it already uses for 'Robustness not assessed'.
  const winnerUndetermined = verdict != null && verdict.separation === 'unknown'
  // Robustness glyph: driven ONLY by the display-safe robustness verdict
  // (`robustnessVerdict`) — never PLoT `report.robustness.level`, never the
  // UI-SEM-005 stability fallback, never a recommendationStability threshold.
  // The verdict is the producer's own robustness.display_verdict (PLoT #202,
  // consumed lane 35 fix 3), normalised fail-closed upstream. 'not_assessed'
  // is the producer's stated absence and renders the neutral glyph with the
  // producer's meaning; a missing field (older PLoT builds) keeps the
  // "Robustness unknown" state. See ROBUSTNESS-VERDICT-CONTRACT.
  const robustnessVerdict = data.recommendation.robustnessVerdict
  const robustOk = robustnessVerdict === 'robust'
  // Determinate = a real robust/sensitive claim exists. Explicit allowlist —
  // 'not_assessed' and unknown values must never render as "Sensitive".
  const robustKnown =
    robustnessVerdict === 'robust' ||
    robustnessVerdict === 'moderate' ||
    robustnessVerdict === 'fragile'
  const gaps = data.confidence.topEvidenceGaps ?? data.confidence.evidenceGaps ?? []
  // ⭐ NO DENIAL WITHOUT AUTHORITY — THE EVIDENCE TWIN (UX gate point 8,
  // 18 Aug 2026). This is the SAME ruling applied 24 lines above to the leader
  // verdict, applied to the check it missed on the same day.
  //
  // The previous note (kept below in spirit) was right that "assessed, none
  // found" and "not assessed" were indistinguishable here — and then drew the
  // wrong conclusion from it. It chose to state "the ONE thing we hold"
  // ("No evidence gaps flagged") on a value that, when the producer is silent,
  // holds NOTHING. That is a denial minted by the UI out of a producer's
  // silence, and it is exactly what the leader-verdict ruling forbids:
  //
  //   "`unknown` licenses silence, never a denial"
  //   "Reconciling the DEFAULTS would have been the wrong fix; withdrawing
  //    the unlicensed claim is the right one."
  //
  // MEASURED, and this is why it matters rather than being a nicety: on the
  // deployed build the producer is ALWAYS silent (see the derivation comment
  // in `useResultsSectionData`), so this glyph rendered "No evidence gaps
  // flagged" on EVERY completed analysis — 12 of 12 real-browser runs across
  // 6 captured turns and 2 graphs — while the same screen carried four live
  // evidence-weakness flags from the fields the producer DOES populate.
  // A constant string is not a check; it is furniture that reads as one.
  //
  // ⚠ THE FIX IS NOT "MAKE TWO READERS AGREE". The assumed-strength card, the
  // Strengthen queue and the canvas science icons answer DIFFERENT questions
  // (edge-strength provenance, recommendation lifecycle, factor extraction
  // provenance) — they are not second opinions about this one, and aligning
  // them would be reconciling defaults across concepts (CLAUDE.md trap 21).
  // What is deleted is this surface's licence to speak when its own authority
  // said nothing. The remaining wider divergence is reported, not patched here.
  //
  // The distinction now arrives explicitly rather than being inferred from an
  // emptiness that two different states produce.
  const evidenceAssessed = data.confidence.evidenceGapsAssessed === true
  const evidenceKnown = gaps.length > 0
  const addressed = gaps.filter(g => isEvidenceGapAddressed(g.confidence)).length
  const total = gaps.length
  // ⭐ NO ALL-CLEAR WITHOUT AUTHORITY — THE UNKNOWN-CONFIDENCE FACE OF IT.
  //
  // This used to be `!evidenceWeak && evidenceKnown`, with
  // `evidenceWeak = gaps.some(g => typeof g.confidence === 'number' && g.confidence < 50)`
  // — a TWO-valued predicate over a THREE-valued input. `useResultsSectionData`
  // maps a gap with no stated `confidence` to `null` DELIBERATELY, and
  // `evidenceGapConfidenceDisplay`'s contract is explicit that "Callers must
  // SUPPRESS the figure and anything derived from it". `evidenceWeak` derived
  // from it anyway, so "the producer never said" came out as "not weak", which
  // came out as a green tick and "Evidence covered".
  //
  // Concrete input, and it is one payload producing two contradicting
  // sentences ONE ROW APART:
  //   `[{ factor_id: 'f1', factor_label: 'Supplier lead time', voi_score: 0.9 }]`
  // (no `confidence`) rendered ✓ "Evidence covered" while `checks-addressed`
  // beside it rendered "0 of 1 evidence gaps addressed".
  //
  // The tick is now DERIVED FROM THE SAME `addressed` COUNT that span renders,
  // so the two cannot disagree by construction — a stronger guarantee than two
  // predicates that merely happen to agree today (CLAUDE.md trap 21: the fix
  // for two authorities is to make them one, not to align their defaults).
  const evidenceAllAddressed = evidenceKnown && addressed === total

  // §6.2g: the legacy arm ("Winner" / "No winner") is DELETED, not
  // re-anchored. `useV17Copy` already selected the glossary-compliant labels
  // on every live path; the legacy strings survived only as the false arm of
  // a ternary, and dead copy beside a live selector is an invitation to
  // re-wire it. `useV17Copy` itself is left in place — it gates more than
  // these two labels.
  const winnerOkLabel = 'Has leading option'
  const winnerNotOkLabel = 'No clear leader'
  // States the check could not be determined. It is NOT a third verdict about
  // the options — it is the absence of one, which is why it must not read like
  // "No clear leader" (a finding) nor like "Has leading option".
  const winnerUndeterminedLabel = 'Leading option not assessed'

  return (
    <div className="border-t border-panel-border pt-3" data-testid="t1-checks-footer">
      {/* ⭐ L-58/L-57: the row used to be three bare glyph+word chips
          ("✓ Has leading option × Sensitive × Evidence unknown"), which reads
          as QA chrome rather than as a statement to the user — Paul filed it
          from a `?diag=1` session and it turned out to be USER-DEFAULT.
          It keeps its three checks (they are the results side of the
          cross-surface single-verdict guard, `singleVerdict.crossSurface.spec`)
          and gains the heading that says what it IS, plus a plain-language
          reading of each. Nothing is removed. */}
      <p className={`${typography.panelMeta} text-text-light mb-1`} data-testid="checks-heading">
        What we checked
      </p>
      <div className={`flex items-center flex-wrap gap-x-3 gap-y-1 ${typography.panelMeta} text-text-light`}>
        <ChecksGlyph
          ok={hasWinner}
          unknown={winnerUndetermined}
          okLabel={winnerOkLabel}
          notOkLabel={winnerUndetermined ? winnerUndeterminedLabel : winnerNotOkLabel}
          title={
            winnerUndetermined
              ? 'This run did not carry a leader verdict, so the analysis makes no claim either way.'
              : undefined
          }
          dataTestid="checks-winner"
        />
        <ChecksGlyph
          ok={robustOk}
          unknown={!robustKnown}
          okLabel="Robust"
          // "Sensitive" alone names no subject. Sensitive to WHAT is the whole
          // content of the verdict, and the producer's own reason phrase (the
          // tooltip below) has always said "to assumptions".
          notOkLabel={
            robustKnown
              ? 'Sensitive to assumptions'
              : robustnessVerdict === 'not_assessed'
                ? 'Robustness not assessed'
                : 'Robustness unknown'
          }
          // Producer-owned reason phrase, verbatim (native tooltip) — never
          // authored in the UI, never shown without its verdict.
          title={data.recommendation.robustnessVerdictReason}
          dataTestid="checks-robust"
        />
        <ChecksGlyph
          ok={evidenceAllAddressed}
          // Two states render the muted help glyph rather than the red X, for
          // two different reasons: the producer assessed and found nothing (a
          // real, licensed all-clear) and the producer never assessed (no
          // claim available). Neither is a failure; only one is a finding.
          unknown={!evidenceKnown}
          okLabel="Evidence covered"
          notOkLabel={
            evidenceKnown
              ? 'Evidence gaps'
              : evidenceAssessed
                ? 'No evidence gaps flagged'
                : // States that the check could not be made. It is NOT a
                  // verdict about the model's evidence — it is the absence of
                  // one, which is why it must not read like "No evidence gaps
                  // flagged" (a finding). Same idiom as the two checks beside
                  // it: 'Leading option not assessed', 'Robustness not assessed'.
                  'Evidence not assessed'
          }
          title={
            evidenceKnown
              ? undefined
              : evidenceAssessed
                ? 'The analysis returned no evidence gaps for this run.'
                : 'This run did not return an evidence assessment, so the analysis makes no claim either way.'
          }
          dataTestid="checks-evidence"
        />
        {total > 0 && (
          <span className="ml-auto" data-testid="checks-addressed">
            {addressed} of {total} evidence gaps addressed
          </span>
        )}
      </div>
      <MissingKnowledgePrompt context="results" aiAffordance={aiAffordance} />
    </div>
  )
}

function ChecksGlyph({
  ok,
  okLabel,
  notOkLabel,
  unknown = false,
  title,
  dataTestid,
}: {
  ok: boolean
  okLabel: string
  notOkLabel: string
  /**
   * Neutral third state: the check could not be determined (e.g. no
   * display-safe robustness verdict). Renders a muted help glyph, NOT the red
   * "X" — an unknown is not a failure.
   */
  unknown?: boolean
  /** Optional native tooltip — producer-supplied text rendered verbatim. */
  title?: string
  dataTestid: string
}) {
  const Icon = unknown ? HelpCircle : ok ? Check : X
  // Neutral muted colour for unknown (NOT the red danger used for not-ok) — an
  // undetermined check is not a failure. Class-based so snapshot guards that strip
  // classes are unaffected.
  const colour = unknown ? 'text-text-light' : ok ? 'text-success' : 'text-danger'
  const label = unknown ? notOkLabel : ok ? okLabel : notOkLabel
  return (
    <span className="inline-flex items-center gap-1" data-testid={dataTestid} title={title}>
      <Icon size={12} className={`${colour} flex-shrink-0`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

// ── Section 3: Stability narrative (Brief 5.8B D2b) ─────────────────────────

/**
 * Stability narrative — a single line above the unified triage queue. Mirrors
 * the pre-analysis 5.8A pattern (narrative bridge above T1 cards). Suppressed
 * when there are no triage items to introduce. Stability percent suffix is
 * dropped when recommendation_stability is null/NaN.
 */
function StabilityNarrative({
  itemCount,
  stabilityScore,
}: {
  itemCount: number
  stabilityScore: number | undefined
}) {
  if (itemCount === 0) return null
  const stabilityPct =
    typeof stabilityScore === 'number' && Number.isFinite(stabilityScore)
      ? Math.round(stabilityScore * 100)
      : null
  // ⛔ Two claims removed here, both of which the queue can no longer support.
  //
  // "Ranked by evidence value" was a VISIBLE ordering claim, and the only thing
  // that ever ordered this queue by value was `evpi_percentage_points` — a
  // figure ISL measures at 0.0 for the factors PLoT scores at 12.3 / 10.2 /
  // 6.6, produced by multiplying BY the top-two win-probability gap, which
  // inverts decision theory. The queue is now in the producer's emission order
  // and asserts no ranking, so the label would be false.
  //
  // "These items would most improve confidence" was a SUPERLATIVE resting on
  // the same figure. What the product can still defend is membership, not rank:
  // these are the factors the engine judged important and is not confident
  // about. So the copy states that, and nothing more.
  const lede = stabilityPct != null
    ? `Stability: ${stabilityPct}%. Inputs worth confirming:`
    : 'Inputs worth confirming:'
  return (
    <div className="flex flex-col gap-0.5" data-testid="stability-narrative">
      <p className={`${typography.panelBody} text-text-body`}>{lede}</p>
    </div>
  )
}

// ── Section 5: Also Consider disclosure ────────────────────────────────────

function AlsoConsiderDisclosure({
  items,
  startOrdinal,
  onHoverEnter,
  onHoverLeave,
  onConfirm,
  onEdit,
}: {
  items: MappedActionItem[]
  startOrdinal: number
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onConfirm?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`flex items-center gap-1 ${typography.panelMeta} text-text-light hover:text-text-body cursor-pointer`}
      >
        {expanded
          ? <><ChevronDown className="w-3 h-3" aria-hidden="true" /> Show fewer</>
          : <><ChevronRight className="w-3 h-3" aria-hidden="true" /> Show {items.length} more</>}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 mt-1.5" data-testid="also-consider-rows">
          {items.map((item, i) => (
            <TriageCard
              key={item.key}
              cardKey={item.key}
              ordinal={startOrdinal + i}
              title={item.title}
              detail={item.detail}
              subtitle={item.subtitle}
              category={item.category}
              analysisMetric={item.analysisMetric}
              action={item.action}
              variant="compact"
              editorConfig={item.editorConfig}
              sourcePill={item.sourcePill}
              passiveLabels={item.passiveLabels}
              onConfirm={onConfirm}
              onEdit={onEdit}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export const TriageActionCardsBody = memo(function TriageActionCardsBody({
  data,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  nodeValueLookup,
  aiAffordance,
  suppressTriageQueue = false,
  useV17Copy = false,
}: TriageActionCardsBodyProps) {
  // Brief 5.8B D2b — strengthen overlay map. CEE coaching.strengthen_items
  // (sourced from the canvas store; persisted across pre→post analysis) are
  // matched against post-analysis triage card titles via normalised exact
  // match (case-insensitive trim). Reuses the pre-analysis utility verbatim
  // so the matching contract stays in lockstep. When the queue is
  // suppressed (v17 mode), this work is skipped — no need to compute an
  // overlay map for a queue that won't render.
  const draftCoachingStrengthenItems = useCanvasStore(s => s.draftCoaching?.strengthenItems ?? null)
  const strengthenOverlayMap = useMemo(
    () => (suppressTriageQueue ? null : buildStrengthenOverlayMap(draftCoachingStrengthenItems)),
    [draftCoachingStrengthenItems, suppressTriageQueue],
  )

  // Brief 5.8B D2b — single EVPI-ranked queue. The earlier split (evidence
  // gaps under one header, next actions under another) is gone. Top 3 render
  // as one stack with the first item visually emphasised; remainder roll
  // under "Also consider".
  //
  // When the queue is suppressed (v17 mode), bail early — the mapping +
  // sort + dedup is pure waste if the result never reaches the DOM.
  const allActions = useMemo(() => {
    if (suppressTriageQueue) return []
    const gaps = mapEvidenceGapsToActions(
      data,
      POST_RUN_VALUE_EDIT_CONNECTED ? onSetValue : undefined,
      nodeValueLookup,
    )
    const next = mapNextActionsToCards(data)
    const merged = [...gaps, ...next].map(item =>
      applyOverlayToItem(item, findStrengthenOverlay(item, strengthenOverlayMap)),
    )
    // The primary sort key here was the EVPI percentage-point figure.
    // Removed: our own compute layer contradicts it (ISL measures 0.0pp for
    // the factors PLoT scores at 12.3 / 10.2 / 6.6) and the ordering it
    // induces is inverted against ISL. Gaps now arrive in the producer's own
    // order; the surviving metric tie-break retains the producer value and
    // keeps value of information explicitly distinct from influence.
    merged.sort((a, b) => (b.analysisMetric?.value ?? -1) - (a.analysisMetric?.value ?? -1))
    // Dedup by canonical factor identity (targetNodeId) after sort so the
    // highest-ranked occurrence survives. See `dedupTriageItems` for the rule
    // (targetNodeId first, normalised-title fallback).
    return dedupTriageItems(merged)
  }, [data, onSetValue, nodeValueLookup, strengthenOverlayMap, suppressTriageQueue])

  const top3 = allActions.slice(0, 3)
  const quickFix = allActions.slice(3, 6)

  // Result-checks slot gate: must mirror BOTH null-return paths in
  // TargetProbabilityBars — (1) no constraints array AND (2) no constraint
  // carries a numeric `prob_satisfied`. Otherwise a bundle with shaped-but-
  // empty constraints would still emit an empty bordered slot.
  // See TargetProbabilityBars.tsx:26-32.
  const hasResultChecks = (
    data.recommendation.recommendedOption?.constraintAnalysis?.constraints
      ?.some(c => typeof c.prob_satisfied === 'number')
  ) ?? false

  const stabilityScore = data.recommendation.recommendationStability

  return (
    <>
      {/* 2. Result checks — target probabilities only. Gate the divider on
          the same condition TargetProbabilityBars uses (constraint data
          present) so sparse states don't emit an empty bordered slot. */}
      {hasResultChecks && (
        <div className="border-t border-panel-border pt-3" data-testid="t1-result-checks-slot">
          <ResultChecks data={data} />
        </div>
      )}

      {/* 2a. Flip-risk callout (moved out of ResultChecks per D2c step 1). */}
      {(data.confidence.topFragileEdge || data.confidence.m1CoachingTopFragileEdge) && (
        <div className="border-t border-panel-border pt-3">
          <T1FlipRiskCallout data={data} onFocusNode={onFocusNode} useV17Copy={useV17Copy} />
        </div>
      )}

      {/* 2b. Conditional scenarios (Brief 4 Task 10) — between flip-risk and queue. */}
      {data.confidence.conditionalWinners && data.confidence.conditionalWinners.length > 0 && (
        <div className="border-t border-panel-border pt-3">
          <ConditionalWinnerCards
            winners={data.confidence.conditionalWinners}
            recommendedOptionId={data.confidence.recommendedOptionId}
            onFocusNode={onFocusNode}
            useV17Copy={useV17Copy}
          />
        </div>
      )}

      {/* 3. Stability narrative + unified EVPI-ranked queue.
          Card #1 gets the .ac.em info-bordered treatment.
          Suppressed when nested in AnalysisHeroV17 — that hero renders its
          own HeroInputRows for the same `topEvidenceGaps`, so the queue
          here would duplicate the surface. The other body blocks
          (flip-risk, conditional scenarios, dominant nudge, T1 checks
          footer) are contextual signals and stay rendered. */}
      {!suppressTriageQueue && top3.length > 0 && (
        <div className="border-t border-panel-border pt-3 space-y-2">
          <StabilityNarrative
            itemCount={top3.length}
            stabilityScore={stabilityScore}
          />

          {/* ⛔ REMOVED: the "No high-value evidence gaps. Your current
              uncertainties have minimal impact on the result." empty state.
              It was reachable ONLY via `topEvidenceGapsEmpty`, which was set
              when every gap failed the `evpiPp > 0` filter — including on a
              perfect tie, where PLoT emits no figure at all and information is
              MOST valuable. The copy asserted "minimal impact" on the strength
              of a number ISL measures at zero for the same factors. Both the
              flag and the claim are gone. */}
          {top3.length > 0 && (
            <div className="flex flex-col gap-1.5" data-testid="unified-triage-queue">
              {top3.map((item, i) => {
                const emphasised = i === 0
                return (
                  <div
                    key={item.key}
                    className={emphasised ? 'rounded-[10px] border border-info/50 bg-info/[0.02]' : ''}
                    data-testid={emphasised ? 'unified-triage-emphasised' : undefined}
                  >
                    <TriageCard
                      cardKey={item.key}
                      ordinal={i + 1}
                      title={item.title}
                      detail={item.detail}
                      subtitle={item.subtitle}
                      category={item.category}
                      analysisMetric={item.analysisMetric}
                      action={item.action}
                      editorConfig={item.editorConfig}
                      sourcePill={item.sourcePill}
                      passiveLabels={item.passiveLabels}
                      onConfirm={POST_RUN_FACTOR_CONFIRMATION_CONNECTED ? onConfirm : undefined}
                      onEdit={POST_RUN_VALUE_EDIT_CONNECTED ? openValueEditor : undefined}
                      onHoverEnter={onHoverEnter}
                      onHoverLeave={onHoverLeave}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {quickFix.length > 0 && (
            <AlsoConsiderDisclosure
              items={quickFix}
              startOrdinal={4}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onConfirm={POST_RUN_FACTOR_CONFIRMATION_CONNECTED ? onConfirm : undefined}
              onEdit={POST_RUN_VALUE_EDIT_CONNECTED ? openValueEditor : undefined}
            />
          )}
        </div>
      )}

      {/* 3a. Dominant-factor nudge — Brief 5.8B D2c step 2 placement: AFTER
          the triage queue (corrects an earlier ordering bug surfaced by
          external review). Suppresses when top influence < 0.8. */}
      <T1DominantNudge
        data={data}
        onFocusNode={onFocusNode}
        useV17Copy={useV17Copy}
      />

      {/* 4. T1 checks footer — Brief 5.8B D2c step 3. */}
      {/* §6.2g: the footer no longer takes `useV17Copy` — its only use was
          selecting between the v17 labels and the legacy "Winner" / "No
          winner" pair, and the legacy arm is deleted. The prop is dropped
          rather than left unread: an unused gate is the next reader's
          invitation to re-wire the dead branch. */}
      <T1ChecksFooter data={data} aiAffordance={aiAffordance} />
    </>
  )
})

export default TriageActionCardsBody

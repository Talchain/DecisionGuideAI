import { memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useCanvasStore } from '../store'
import { focusExistingTarget } from '../utils/focusHelpers'
import { selectDriverDisplayModel, compareByDisplayModel, extractPolicyRow } from '../../components/results/driverDisplayModel'
import { typography } from '../../styles/typography'
import { cleanFactorLabel, compactFactorLabel, formatInterventionValue, denormaliseInterventionValue, inferInterventionScaleBase, isSuppressedUnit, unwrapInterventionValue, classifyUnit, formatWinProbability, isTierLabel } from '../utils/labelUtils'
import {
  describeInterventionDirection,
  formatInterventionChange,
  formatInterventionTargetText,
  isInterventionNoChange,
} from '../utils/interventionDisplay'
import { readFactorDisplayValue } from '../../utils/formatFactorDisplayValue'
import { detectBaseline } from '../utils/baselineDetection'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { NodeChip, ActionIcons, BriefIcon, NodePopover, ScienceIcon } from './shared'
import {
  selectGoalProbability,
  basisWithholdsPossessive,
} from '../../components/results/utils/selectGoalProbability'
import { COMPARATIVE_COPY, GOAL_ANCHOR_COPY } from '../../components/results/utils/goalAnchorCopy'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../../lib/decisionVerdict'

/** Truncate text at word boundary to avoid mid-word cuts. */
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '...'
}

/** Strip known suffixes from factor labels for contextual display. */
const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i
function stripFactorSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

/**
 * Pure "Behind:" reason for a non-leading option. Extracted from the memo so
 * the same computation can run for sibling options: when the reason string is
 * identical across multiple non-leading options it differentiates nothing and
 * is suppressed on all of them (audit §8 P1 — "Behind: fewer key changes"
 * rendered verbatim on every loser).
 */
interface BehindReasonContext {
  recommendedOptionId: string | undefined
  hasSensitivity: boolean
  topFactorId: string | undefined
  strippedLabel: string | null
  winnerInterventions: Record<string, unknown>
  /** cee identity the context was built against — revalidated on read */
  ceeRef: unknown
}

/**
 * Report-level invariants for the "Behind:" reasons, computed ONCE per
 * analysis report (WeakMap-cached on report identity) instead of per option
 * per render: the sensitivity sort, top-factor label resolution and winner
 * lookup are identical for every option card, and each card's memo also
 * scans its siblings — without this cache that was O(options² · factors
 * log factors) per drag frame. Factor labels are resolved at first build;
 * a post-analysis rename shows the prior label until the next run, which
 * the stale-decoration treatment already flags.
 */
const behindContextCache = new WeakMap<object, BehindReasonContext>()

function getBehindReasonContext(
  report: any,
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null,
  nodes: readonly { id: string; type?: string; data?: any }[],
): BehindReasonContext {
  const cached = behindContextCache.get(report)
  if (cached && cached.ceeRef === ceeAnalysisReady) return cached

  const recommendedOptionId = report?.robustness?.recommended_option_id as string | undefined
  // P0-2 (external review 2026-07-14): certified factor_sensitivity FIRST
  // (matching winsVia + the graph badge), the untyped enrichment passthrough
  // only as fallback — never the reverse.
  const sensitivity = report?.factor_sensitivity ?? report?.enrichment?.sensitivity_analysis?.factors ?? []
  const hasSensitivity = Array.isArray(sensitivity) && sensitivity.length > 0

  let topFactorId: string | undefined
  let strippedLabel: string | null = null
  if (hasSensitivity) {
    // Rank via the SHARED driver policy (extractPolicyRow + selectDriverDisplayModel
    // + compareByDisplayModel) so the loser's "Behind:" top factor is chosen on
    // the SAME basis as winsVia / the Drivers panel. The prior chain ranked by
    // raw |importance_score ?? elasticity ?? sensitivity_score| — OMITTING
    // `sensitivity` (the V5 magnitude key) and preferring importance — so it
    // could crown a different driver than the panel under partial coverage.
    const rows = (sensitivity as unknown[])
      .map((f: unknown) => extractPolicyRow(f))
      .filter((r: ReturnType<typeof extractPolicyRow>): r is NonNullable<ReturnType<typeof extractPolicyRow>> => r != null)
    const model = selectDriverDisplayModel(rows)
    const ranked = rows
      .map((r) => ({ key: r.key, elasticity: r.rawElasticity, value: model.get(r.key)?.value ?? 0 }))
      .sort(compareByDisplayModel)
    topFactorId = ranked[0] && ranked[0].value > 0 ? ranked[0].key : undefined
    if (topFactorId) {
      const topFactorRaw = (sensitivity as any[]).find(
        f => (f.factor_id || f.factorId || f.node_id || f.nodeId) === topFactorId,
      )
      const rawLabel = (topFactorRaw?.label ?? topFactorRaw?.node_label) as string | undefined
      const factorNode = nodes.find(n => n.id === topFactorId)
      const factorLabel = rawLabel
        ?? (factorNode ? (cleanFactorLabel((factorNode.data?.label as string) ?? '') || (factorNode.data?.label as string)) : null)
        ?? null
      strippedLabel = factorLabel ? (stripFactorSuffixes(factorLabel) || factorLabel) : null
    }
  }

  const winnerCee = ceeAnalysisReady?.options?.find(opt => opt.id === recommendedOptionId)
  const context: BehindReasonContext = {
    recommendedOptionId,
    hasSensitivity,
    topFactorId,
    strippedLabel,
    winnerInterventions: winnerCee?.interventions ?? {},
    ceeRef: ceeAnalysisReady,
  }
  if (report && typeof report === 'object') behindContextCache.set(report, context)
  return context
}

function computeBehindReason(
  optionId: string,
  isBaseline: boolean,
  report: any,
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null,
  nodes: readonly { id: string; type?: string; data?: any }[],
): string | null {
  if (isBaseline) return 'no changes from current state'
  if (!report) return null

  const ctx = getBehindReasonContext(report, ceeAnalysisReady, nodes)
  if (!ctx.recommendedOptionId) return null
  if (!ctx.hasSensitivity) return 'fewer key changes'
  if (!ctx.topFactorId || !ctx.strippedLabel) return 'fewer key changes'

  const thisCee = ceeAnalysisReady?.options?.find(opt => opt.id === optionId)
  const thisInterventions = thisCee?.interventions ?? {}

  const winnerHasFactor = ctx.topFactorId in ctx.winnerInterventions
  const thisHasFactor = ctx.topFactorId in thisInterventions

  if (winnerHasFactor && !thisHasFactor) {
    return `no ${ctx.strippedLabel.toLowerCase()} added`
  }

  if (winnerHasFactor && thisHasFactor) {
    // unwrapInterventionValue returns null for malformed entries; treat
    // those as "no comparable value" and skip the lower-than message.
    const { value: winnerVal } = unwrapInterventionValue(ctx.winnerInterventions[ctx.topFactorId])
    const { value: thisVal } = unwrapInterventionValue(thisInterventions[ctx.topFactorId])
    if (winnerVal != null && thisVal != null && Math.abs(winnerVal - thisVal) >= 1e-6) {
      return `${ctx.strippedLabel.toLowerCase()} lower`
    }
  }

  return 'fewer key changes'
}

/**
 * Compute differentiator labels for ALL non-baseline options in one pass.
 * Returns a Map<optionId, string | null> where the string is the complete
 * sentence to render (e.g. "Tech lead hired is the key difference" or
 * "Tech lead hired → 90%").
 *
 * When two options share the same top-differentiating factor, values are
 * appended to disambiguate. If the values are also identical (or both
 * produce empty formatted text), the differentiator is suppressed for both.
 */
function computeAllDifferentiators(
  nodes: readonly { id: string; type?: string; data?: any }[],
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null,
): Map<string, { label: string; factorId: string } | null> {
  const result = new Map<string, { label: string; factorId: string } | null>()

  const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
  if (optionNodes.length < 2) return result

  // Build option id → factorId → { value, displayValue }. The displayValue
  // field carries CEE's `display_value` through to Phase 3 so the
  // disambiguation sentence ("X → {value}") can render the CEE string
  // verbatim instead of re-formatting the numeric value.
  type InterventionEntry = { value: number; displayValue?: string }
  const optionInterventions = new Map<string, Map<string, InterventionEntry>>()
  for (const optNode of optionNodes) {
    // Explicit flag wins; regex fallback only fires when flag is null/undefined.
    // Explicit `false` must suppress the regex (prevents "Status Quo" labels on
    // non-baseline options from being treated as baseline).
    const explicit = (optNode.data as any)?.is_baseline as boolean | null | undefined
    const isBaseline = explicit ?? detectBaseline((optNode.data?.label as string) ?? '').isBaseline
    if (isBaseline) continue
    const ceeOpt = ceeAnalysisReady?.options?.find(o => o.id === optNode.id)
    const interventions = ceeOpt?.interventions ?? (optNode.data as any)?.interventions
    if (!interventions || typeof interventions !== 'object') continue
    const map = new Map<string, InterventionEntry>()
    for (const [fid, raw] of Object.entries(interventions)) {
      const { value, displayValue } = unwrapInterventionValue(raw)
      if (value != null) map.set(fid, { value, displayValue: displayValue ?? undefined })
    }
    optionInterventions.set(optNode.id, map)
  }

  if (optionInterventions.size < 2) return result

  // Observed baseline resolver
  const observedBaselineFor = (factorId: string): number => {
    const factorNode = nodes.find(n => n.id === factorId)
    const obs = (factorNode?.data as any)?.observedState as { value?: number } | undefined
    return typeof obs?.value === 'number' ? obs.value : 0
  }

  // Phase 1: find each option's best differentiating factor
  const bestFactors = new Map<string, { factorId: string; diff: number; myValue: number; myDisplayValue?: string }>()
  for (const [optionId, myValues] of optionInterventions.entries()) {
    if (myValues.size === 0) continue
    let bestFactorId: string | null = null
    let bestDiff = 0
    let bestMyValue = 0
    let bestMyDisplayValue: string | undefined
    for (const [factorId, entry] of myValues.entries()) {
      const myValue = entry.value
      const baseline = observedBaselineFor(factorId)
      let sum = 0
      let count = 0
      for (const [otherId, otherValues] of optionInterventions.entries()) {
        if (otherId === optionId) continue
        const other = otherValues.get(factorId)
        sum += other !== undefined ? other.value : baseline
        count += 1
      }
      if (count === 0) continue
      const avgOthers = sum / count
      const diff = Math.abs(myValue - avgOthers)
      if (diff > bestDiff) {
        bestDiff = diff
        bestFactorId = factorId
        bestMyValue = myValue
        bestMyDisplayValue = entry.displayValue
      }
    }
    if (bestFactorId == null || bestDiff < 0.1) continue
    bestFactors.set(optionId, { factorId: bestFactorId, diff: bestDiff, myValue: bestMyValue, myDisplayValue: bestMyDisplayValue })
  }

  // Phase 2: count how many options claim each factor as their top differentiator
  const factorClaimCount = new Map<string, number>()
  for (const { factorId } of bestFactors.values()) {
    factorClaimCount.set(factorId, (factorClaimCount.get(factorId) ?? 0) + 1)
  }

  // Phase 3: build label for each option
  const candidateLabels = new Map<string, string>()
  for (const [optionId, { factorId, myValue, myDisplayValue }] of bestFactors.entries()) {
    const factorNode = nodes.find(n => n.id === factorId)
    const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
    const compactLabel = compactFactorLabel(cleanFactorLabel(rawLabel), 20)

    if ((factorClaimCount.get(factorId) ?? 0) <= 1) {
      // Unique factor — simple sentence
      candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} is the key difference`)
    } else if (myDisplayValue) {
      // Shared factor with CEE display_value — render verbatim, skip unit/tier inference.
      candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} \u2192 ${myDisplayValue}`)
    } else {
      // Shared factor — disambiguate. Placeholder-unit factors (scale, index, score, …)
      // have no real-world anchor, so tier labels like "Very high" are meaningless.
      // For those, skip formatting entirely and use directional language against
      // the observed baseline. For units with genuine anchors, format the value.
      const obs = (factorNode?.data as any)?.observedState as {
        unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
      } | undefined
      const unit = (factorNode?.data?.unit as string | undefined) ?? obs?.unit
      const effectiveUnit = unit && !isSuppressedUnit(unit) ? unit : undefined
      const unitKind = classifyUnit(effectiveUnit).kind
      // Audit §8 P0-4: "Does not change" fires ONLY on exact equality with the
      // baseline (shared formatter semantics) — never a ±0.1 display epsilon.
      const directional = (): string =>
        describeInterventionDirection(observedBaselineFor(factorId), myValue, compactLabel)
      if (unitKind === 'placeholder') {
        candidateLabels.set(optionId, directional())
      } else {
        const formatted = formatInterventionValue(
          myValue,
          effectiveUnit,
          obs?.factor_type,
          obs?.cap,
          obs?.value,
          obs?.raw_value,
        )
        // A unitless qualitative factor (e.g. factor_type="quality", no unit)
        // still reaches formatInterventionValue's qualitativeTierLabel branch
        // and returns "Very high" / "High" / …. These tier labels are just as
        // meaningless in differentiator text as the placeholder-unit ones,
        // so force directional phrasing whenever the formatter returned one.
        if (formatted && !isTierLabel(formatted)) {
          candidateLabels.set(optionId, `${compactLabel.charAt(0).toUpperCase()}${compactLabel.slice(1)} \u2192 ${formatted}`)
        } else {
          candidateLabels.set(optionId, directional())
        }
      }
    }
  }

  // Phase 4: suppress any labels that are still identical across options
  const labelCount = new Map<string, number>()
  for (const label of candidateLabels.values()) {
    labelCount.set(label, (labelCount.get(label) ?? 0) + 1)
  }

  for (const [optionId, label] of candidateLabels.entries()) {
    if ((labelCount.get(label) ?? 0) > 1) {
      result.set(optionId, null)
    } else {
      const factorId = bestFactors.get(optionId)?.factorId
      // Carry the factorId so the option card can drop this footer line when
      // the same factor is already shown as a visible "from → to" chip.
      result.set(optionId, factorId ? { label, factorId } : null)
    }
  }

  return result
}

/**
 * Strip echo — if displayValue starts with (or contains) the factor label, remove the overlap.
 * Example: label="Technical leadership", value="Technical leadership active" → "active"
 */
function stripEcho(label: string, displayValue: string): string {
  const normalLabel = label.trim().toLowerCase()
  const normalValue = displayValue.trim().toLowerCase()
  if (normalValue.startsWith(normalLabel)) {
    const remainder = displayValue.trim().slice(label.trim().length).trimStart()
    return remainder || displayValue
  }
  return displayValue
}

// Value formatting for intervention chips lives in the shared single
// formatter (src/canvas/utils/interventionDisplay.ts — audit §8 P0-4).
// The former local formatChipValue moved there as formatInterventionTargetText
// so every option-intervention surface renders identical statements.

interface InterventionChip {
  factorId: string
  label: string
  value: number
  /** CEE-provided display_value for the INTERVENTION (target) value, if present.
   * Rendered verbatim in preference to numeric formatting (see formatChipValue). */
  displayValue?: string
  /** The FACTOR's own CEE display_value — labels its observed (baseline) state.
   * Scope A: used as the "from" label for binary chips when both payload labels
   * exist. Never derived/invented. */
  baselineDisplayValue?: string
  unit?: string
  factorType?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
}

/** Structured delta for spec Section 13 pre-analysis display. */
interface StructuredDelta {
  factorId: string
  label: string
  direction: 'up' | 'down'
  /** Formatted "baseline → intervention" — real-world where the payload
   * supports it, else normalised percentages (brief scope 7). */
  fromTo: string
}

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')
  const scienceIcons = useScienceIcons(props.id, 'option')

  const nodes = useCanvasStore(state => state.nodes)
  const resultsReport = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)
  // Wave 4 / §6.4: the identity-anchored option number (Wave F-A store),
  // rendered on the canvas node so it matches the Analysis panel's "Option N"
  // chip. Subscribed (not the outside-React snapshot) so it re-renders when the
  // numbering registers. undefined until analysis registers this option.
  const stableOptionNumber = useCanvasStore(state => state.optionNumbering?.[props.id])
  const isPostAnalysis = resultsStatus === 'complete'
  // Canvas result decorations carry no freshness treatment of their own:
  // the graph-hash stale guard that once drove a dim + "Model changed" title
  // here was deleted on 2026-07-16 (its hash keys had zero write sites, so
  // it could never fire). Freshness verdicts render on the panel surfaces
  // via the composed trust semantic (useAnalysisTrust).

  // SINGLE VERDICT (2026-07-25): the canvas no longer decides for itself
  // whether a leading option exists. It quotes `deriveDecisionVerdict` — the
  // one module entitled to answer that — computed from the SAME PLoT report
  // the results panel reads. Before this, the badge asked only "WHO leads?"
  // (producer recommendation, else win-probability argmax) with no gate for
  // "is there a leader at all", so it fired on 100% of completed runs while
  // the panel independently printed "no clear leading option" beside it. See
  // src/lib/decisionVerdict.ts for the full diagnosis.
  const verdict = useMemo(() => {
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    return deriveDecisionVerdict(resultsReport as DecisionVerdictReportLike | null, {
      visibleOptionIds: new Set(optionNodes.map(n => n.id)),
    })
  }, [nodes, resultsReport])

  /** True only when this node is the leader AND a leading option exists at all. */
  const isRecommended = useMemo(() => {
    if (!displayMetadata.isResultsMode || displayMetadata.winRate === null) return false
    return verdict.hasLeadingOption && verdict.leaderId === props.id
  }, [displayMetadata.isResultsMode, displayMetadata.winRate, verdict, props.id])

  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  // UI-SEM-082 (Lane 4): the "chance of target" badge is a goal-fit claim, so it
  // gates on the USER target (store goalThreshold) — never on producer value
  // presence. The producer returns a joint/goal probability even with no user
  // target (auto_goal_threshold, UI-SEM-071 class); the panel twin OptionCards
  // already suppresses via hasGoalThreshold, and the GoalNode beside this option
  // suppresses its own "chance of reaching target" when no target is set. This
  // keeps the canvas node consistent with both.
  const goalThreshold = useCanvasStore(state => state.goalThreshold)
  const setHoveredOption = useCanvasStore(state => state.setHoveredOption)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isDetailed = viewMode === 'expert'

  // Graph v2 Task 4: close-call gap in percentage points. Non-zero only when
  // this option is a non-leader within 5pp of the leader's win probability.
  // Prefers report.robustness.recommended_option_id; falls back to max scan if
  // missing. Returns null when not in close-call territory or pre-analysis.
  const closeCallGapPp = useMemo<number | null>(() => {
    if (!isPostAnalysis || isRecommended) return null
    // ROADMAP 1.239: "Close call: within N percentage points" measures a
    // distance to `verdict.leaderId`, and identity SURVIVES a withheld turn by
    // design (decisionVerdict.ts returns leaderId and gapPp; only the
    // entitlement is withheld). So the line would print a gap to a leader the
    // producer declined to name — the same inverse-form claim as "Behind:".
    //
    // The render probe scored this SILENT on its withheld runs, which is not
    // evidence of a gate: that run's gap was 0.346, far outside the 5pp
    // window below. Empirically silent, never gated — a withheld run with a
    // close race fires it. Found while verifying the "Behind:" line at the
    // bytes rather than dispatched, and gated here as defence in depth.
    if (!verdict.hasLeadingOption) return null
    // SINGLE VERDICT: `isRecommended` is now false for the front-runner too
    // when no leading option exists (a tied run). Without this guard the
    // front-runner would compute a zero gap against itself and render
    // "Close call: within 1 percentage point" on its own card.
    if (verdict.leaderId === props.id) return null
    const report = resultsReport as any
    const probs: Record<string, { win_probability?: number }> | undefined = report?.option_probabilities
    if (!probs) return null
    const thisWin = probs[props.id]?.win_probability
    if (typeof thisWin !== 'number') return null
    // SINGLE VERDICT: leader identity comes from the shared verdict, not a
    // second local resolution of `recommended_option_id`-else-argmax.
    const leaderId = verdict.leaderId
    const leaderWin = leaderId != null ? probs[leaderId]?.win_probability : undefined
    if (typeof leaderWin !== 'number') return null
    const gap = leaderWin - thisWin
    if (gap < 0 || gap > 0.05) return null
    // Floor to at least 1pp so the line never reads "within 0 percentage
    // points". A truly zero gap is already filtered by the isRecommended
    // early return (within-0.0001 tolerance), but rounding can still produce
    // 0 from a small positive gap like 0.004.
    return Math.max(1, Math.round(gap * 100))
  }, [isPostAnalysis, isRecommended, verdict, resultsReport, props.id])

  const allInterventionChips = useMemo<InterventionChip[]>(() => {
    // Primary: ceeAnalysisReady.options[optionId].interventions
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    let interventionEntries: [string, unknown][] = []

    if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
      interventionEntries = Object.entries(ceeOption.interventions)
    } else {
      // Fallback: option node data.interventions (pre-CEE state)
      const optionNode = nodes.find(n => n.id === props.id)
      const nodeInterventions = (optionNode?.data as any)?.interventions
      if (nodeInterventions && typeof nodeInterventions === 'object') {
        interventionEntries = Object.entries(nodeInterventions)
      }
    }

    if (interventionEntries.length === 0) return []

    return interventionEntries
      .flatMap(([factorId, rawValue]) => {
        // Drop entries that fail to unwrap. Prior to this fix, malformed
        // entries (e.g. { value: null }) were coerced to 0 via Number(...)
        // and rendered as deliberate-looking zero chips.
        const { value, displayValue } = unwrapInterventionValue(rawValue)
        if (value == null) return []
        const factorNode = nodes.find(n => n.id === factorId)
        const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
        // Graph v1.1 Task 6: do NOT strip suffixes here. The popover / Detailed
        // intervention list wants the readable form ("Technical leadership"),
        // and compactFactorLabel needs the full phrase ("Technical leadership
        // presence") to look up wireframe v4 short forms. Each render path
        // applies its own truncation.
        const cleaned = cleanFactorLabel(rawLabel)
        const cleanedLabel = cleaned.length > 0
          ? cleaned.charAt(0).toUpperCase() +
            cleaned.slice(1).replace(/\b([A-Za-z]+)\b/g, (word) =>
              /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()
            )
          : cleaned
        const observedState = factorNode?.data?.observedState as {
          unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
        } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        // Scope A: the factor's OWN display_value labels its observed (baseline)
        // state (e.g. "No tech lead in place"). Payload-only, via the shared
        // readFactorDisplayValue (top-level → observedState priority).
        const baselineDisplayValue = readFactorDisplayValue(factorNode?.data as Record<string, unknown> | undefined)
        return [{
          factorId, label: cleanedLabel, value, displayValue: displayValue ?? undefined, unit,
          factorType: observedState?.factor_type, cap: observedState?.cap,
          observedValue: observedState?.value, observedRawValue: observedState?.raw_value,
          baselineDisplayValue,
        }]
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }, [ceeAnalysisReady, props.id, nodes])

  // Brief scope 7: Layer-1 pills cap visible chips at 4. The post-analysis
  // "What this option changes:" block needs the FULL built list so its
  // "+N more in inspector" count reflects every renderable change — counting
  // from the raw key total advertised hidden no-change/malformed entries as
  // "more", and counting from this sliced list under-reported N.
  const interventionChips = useMemo<InterventionChip[]>(
    () => allInterventionChips.slice(0, 4),
    [allInterventionChips],
  )

  const hasInterventions = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    if (ceeOption?.interventions && Object.keys(ceeOption.interventions).length > 0) return true
    // Fallback: option node data.interventions
    const optionNode = nodes.find(n => n.id === props.id)
    const nodeInterventions = (optionNode?.data as any)?.interventions
    return !!(nodeInterventions && typeof nodeInterventions === 'object' && Object.keys(nodeInterventions).length > 0)
  }, [ceeAnalysisReady, props.id, nodes])

  /** Total intervention count (all factors, not capped at 3). */
  const totalInterventionCount = useMemo(() => {
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
      return Object.keys(ceeOption.interventions).length
    }
    const optionNode = nodes.find(n => n.id === props.id)
    const nodeInterventions = (optionNode?.data as any)?.interventions
    if (nodeInterventions && typeof nodeInterventions === 'object') {
      return Object.keys(nodeInterventions).length
    }
    return 0
  }, [ceeAnalysisReady, props.id, nodes])

  const isBaselineOption = useMemo(() => {
    // Explicit flag wins; regex only fires when flag absent (null/undefined).
    const explicit = (props.data as any)?.is_baseline as boolean | null | undefined
    if (typeof explicit === 'boolean') return explicit
    const label = (props.data?.label as string | undefined) ?? ''
    return detectBaseline(label).isBaseline
  }, [props.data])

  const baselineOptionInterventions = useMemo<Record<string, number> | null>(() => {
    if (isBaselineOption) return null
    const options = ceeAnalysisReady?.options
    if (!options) return null
    const baselineNode = nodes.find(n => {
      if (n.id === props.id) return false
      if (n.type !== 'option' && n.data?.type !== 'option') return false
      const explicit = (n.data as any)?.is_baseline as boolean | null | undefined
      if (typeof explicit === 'boolean') return explicit
      const lbl = (n.data?.label as string | undefined) ?? ''
      return detectBaseline(lbl).isBaseline
    })
    if (!baselineNode) return null
    const baseCeeOption = options.find(opt => opt.id === baselineNode.id)
    if (!baseCeeOption?.interventions) return null
    // Drop entries that fail to unwrap. Downstream lookup
    // (`baselineOptionInterventions?.[c.factorId] ?? c.observedValue`) will
    // fall back to the observed value, which is a more honest baseline than
    // a Number()-coerced 0.
    return Object.fromEntries(
      Object.entries(baseCeeOption.interventions).flatMap(([fid, rv]) => {
        const { value: v } = unwrapInterventionValue(rv)
        return v != null ? [[fid, v] as const] : []
      })
    )
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  // Structured deltas per spec Section 13 — rendered as guarded "from → to" chips.
  const structuredDeltas = useMemo<StructuredDelta[]>(() => {
    if (interventionChips.length === 0) return []
    return interventionChips
      .map(c => {
        const baseline = baselineOptionInterventions?.[c.factorId] ?? c.observedValue
        // Graph v1.1 Task 6: compaction for pre-analysis pills. Bumped from 15
        // to 22 so multi-word factor labels (e.g. "Senior technical leadership")
        // read more meaningfully before truncation. Sized against the NODE_CARD_MAX_W
        // card; revisit if the card width changes materially.
        const shortLabel = compactFactorLabel(c.label, 22)

        // Brief scope 7 guard (+ A2): both the baseline and the intervention
        // value must already exist. A missing baseline ⇒ omit the chip — never
        // a one-sided or fabricated value, and never a throw.
        if (baseline === undefined) return null

        // Single-formatter no-change semantics (audit §8 P0-4): a chip is
        // omitted as "no change" ONLY on exact equality with the baseline.
        const change = formatInterventionChange({
          baselineValue: baseline,
          targetValue: c.value,
          label: shortLabel,
          unit: c.unit,
          factorType: c.factorType,
          cap: c.cap,
          observedValue: c.observedValue,
          observedRawValue: c.observedRawValue,
          targetDisplayValue: c.displayValue,
        })
        if (!change.changed) return null // no change
        const direction: 'up' | 'down' = change.arrow ?? 'up'

        // Scope A — binary/encoded factor with payload display labels on BOTH
        // sides. Fires ONLY when: the pair is strictly {0,1}; the intervention
        // carries a CEE display_value (target label); AND the factor's own
        // display_value (baseline label) is present and corresponds to the
        // baseline value (baseline === observed value). Both labels come from
        // the payload — none is derived or invented. When labels are absent the
        // numeric path below is used unchanged (no "0% → 100%" → label guess).
        // Conservative limitation: when the baseline comes from a baseline
        // OPTION's intervention (baseline !== observed value) we do NOT use the
        // factor's observed display_value (it labels a different value), and we
        // do not yet read the baseline option's own intervention display_value
        // (baselineOptionInterventions is values-only) — those cases fall to the
        // numeric path. Tracked as a follow-up; never shows a mismatched label.
        const isBinaryPair = (c.value === 0 || c.value === 1) && (baseline === 0 || baseline === 1)
        const baselineLabel = baseline === c.observedValue ? c.baselineDisplayValue : undefined
        if (isBinaryPair && c.displayValue && baselineLabel) {
          return { factorId: c.factorId, label: shortLabel, direction, fromTo: `${baselineLabel} → ${c.displayValue}` }
        }

        // Both sides come from the shared formatter (real-world display units
        // where the payload supports it — same chain the post-analysis list
        // uses). When either side can't be formatted to real-world, fall back
        // to normalised percentages for BOTH sides — the only safe shared
        // scale. No new denormalisation logic is introduced.
        const fromTo = change.baselineText && change.targetText
          ? `${change.baselineText} → ${change.targetText}`
          : `${Math.round(baseline * 100)}% → ${Math.round(c.value * 100)}%`

        return { factorId: c.factorId, label: shortLabel, direction, fromTo }
      })
      .filter((d): d is StructuredDelta => d !== null)
  }, [interventionChips, baselineOptionInterventions])

  /**
   * Differentiator line — a complete sentence describing what's strategically
   * unique about this option (Standard pre-analysis only).
   *
   * Delegates to computeAllDifferentiators() which computes all options in
   * one pass. See that helper's docblock for the algorithm, thresholds, and
   * deduplication logic. Returns null for baseline/post-analysis.
   */
  const differentiator = useMemo<{ label: string; factorId: string } | null>(() => {
    if (isPostAnalysis) return null
    if (isBaselineOption) return null
    const allDiffs = computeAllDifferentiators(nodes, ceeAnalysisReady)
    return allDiffs.get(props.id) ?? null
  }, [isPostAnalysis, isBaselineOption, ceeAnalysisReady, nodes, props.id])

  // Brief scope 7: drop the differentiator footer only when it repeats a value
  // already shown in a visible from→to chip — same factor AND the same value
  // text. A differentiator carrying a value the chip doesn't show (e.g. a CEE
  // display_value where the chip fell back to "%") is kept, so no info is lost.
  const differentiatorDuplicatesChip = !!differentiator
    && differentiator.label.includes('→')
    && structuredDeltas.some(d => {
      if (d.factorId !== differentiator.factorId) return false
      const diffValue = (differentiator.label.split('→')[1] ?? '').trim()
      return diffValue.length > 0 && d.fromTo.includes(diffValue)
    })

  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) setHoveredOption(props.id)
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  const isOptionFromCee = useMemo(() =>
    ceeAnalysisReady?.options?.some(opt => opt.id === props.id) ?? false,
  [ceeAnalysisReady, props.id])

  // "Wins via" -- top-ranked sensitivity factor that this option intervenes on
  const winsVia = useMemo(() => {
    if (!isPostAnalysis || !isRecommended || !resultsReport) return null
    const report = resultsReport as any
    // Source precedence matches the graph badge (useNodeDisplayMetadata):
    // certified factor_sensitivity FIRST, the untyped enrichment passthrough
    // as fallback — so this card can never rank a different row-set than the
    // badge on the same canvas (Lane 2 review fold).
    const sensitivity = report?.factor_sensitivity ?? report?.enrichment?.sensitivity_analysis?.factors ?? []
    if (!Array.isArray(sensitivity) || sensitivity.length === 0) return null

    // Lane 2 (policy + honesty): rank via the SHARED driver display policy —
    // this previously ranked by raw |elasticity| (option-scoped) and then
    // asserted a GLOBAL "#1 driver", crowning a factor the same screen's
    // drivers panel ranked 4th at 17% (live 2026-07-13). Rows come from the
    // SHARED extractor so the coverage verdict cannot skew per surface. The
    // copy may claim "#1 driver" ONLY when the chosen lever IS the policy's
    // global #1 (shared tie-break, non-zero); otherwise it is honestly the
    // option's biggest lever.
    const rows = sensitivity
      .map((f: unknown) => extractPolicyRow(f))
      .filter((r: ReturnType<typeof extractPolicyRow>): r is NonNullable<ReturnType<typeof extractPolicyRow>> => r != null)
    if (rows.length === 0) return null

    const displayModel = selectDriverDisplayModel(rows)
    const ranked = rows
      .map((r) => ({
        id: r.key,
        value: displayModel.get(r.key)?.value ?? 0,
        elasticity: r.rawElasticity,
        key: r.key,
      }))
      .sort(compareByDisplayModel)
    const globalTopId = ranked[0] && ranked[0].value > 0 ? ranked[0].id : null

    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    const interventionKeys = new Set(Object.keys(ceeOption?.interventions ?? {}))

    for (const f of ranked) {
      if (interventionKeys.has(f.id)) {
        const factorNode = nodes.find(n => n.id === f.id)
        if (factorNode) {
          return {
            id: f.id,
            label: cleanFactorLabel((factorNode.data?.label as string) ?? '') || ((factorNode.data?.label as string) ?? ''),
            isGlobalTop: globalTopId !== null && f.id === globalTopId,
          }
        }
      }
    }
    return null
  }, [isPostAnalysis, isRecommended, resultsReport, ceeAnalysisReady, props.id, nodes])

  // Goal probability for warning.
  // ROADMAP 1.49: uses the shared selectGoalProbability fallback chain (same
  // one useResultsSectionData applies for OptionCards/hero/GoalNode) so this
  // badge can't show a different number than those surfaces on a
  // constrained-goal run.
  //
  // Goal-probability IDENTITY: the WHOLE decision is kept, not just the
  // number. This site previously took `.goalProbability` and discarded the
  // provenance, so the badge rendered a joint-basis figure with no caveat
  // while OptionCards, the hero and GoalNode rendered the same figure WITH
  // one. The caveat now travels with the number to every surface showing it.
  const goalDecision = useMemo(() => {
    if (!isPostAnalysis || !resultsReport) return null
    const report = resultsReport as any
    const optionProbs = report?.option_probabilities?.[props.id]
    return selectGoalProbability(optionProbs)
  }, [isPostAnalysis, resultsReport, props.id])
  const goalProbability = goalDecision?.goalProbability ?? null

  // THE POSSESSIVE GATE (ROADMAP 2.282). `basis === 'joint_goal_substituted'`
  // means this number is P(all constraints jointly satisfied) STANDING IN for
  // an absent `probability_of_goal`, so the possessive "chance of target"
  // names a question it does not answer. Read off the owner's own published
  // decision — the same expression `useResultsSectionData` uses to set
  // `OptionResult.goalFitIsSubstitutedJoint` — never re-derived here.
  //
  // ⚠ SCOPED TO `joint_goal_substituted`, NOT to "the figure is joint".
  // `joint_goal_constrained` is the user's own goal AND the user's own
  // limits, where the possessive is EARNED and stays. `OptionNode.spec.tsx`'s
  // ROADMAP 1.49 positive control is exactly that constrained case and must
  // keep rendering "chance of target."
  //
  // ⭐ L62 (2026-08-04) — THIS IS NOW ALWAYS FALSE, AND THAT IS THE FIX.
  // `selectGoalProbability` no longer substitutes: on that basis it returns NO
  // number (`'joint_goal_withheld'`, `goalProbability: null`), so a badge is
  // never rendered in the withheld state and there is nothing left to re-voice.
  // The bases that still carry a number — `'goal_probability'` and
  // `'joint_goal_constrained'` — both EARN the possessive, which is why this
  // reads the owner's own published permission rather than re-testing a basis
  // literal: if the owner ever re-permits a number it forbids the possessive
  // for, this lights up again without an edit here.
  const goalFitSubstituted =
    goalDecision?.goalProbability != null && basisWithholdsPossessive(goalDecision.basis)
  // The badge readout, built ONCE above both arms so the withheld and
  // permitted wordings cannot show different numbers for the same option.
  // Byte-identical to the literal it replaces (`'< '` + digits + `%`).
  const goalBadgeReadout =
    goalProbability !== null && goalProbability < 0.10
      ? `< ${goalProbability < 0.01 ? '1' : Math.round(goalProbability * 100)}%`
      : null

  // "Behind:" reason for non-winner options (including status quo).
  // Computed via the pure helper so this option's reason can be compared
  // against its non-leading siblings: an identical reason on multiple losers
  // differentiates nothing, so it renders on none of them (audit §8 P1).
  const behindReason = useMemo<string | null>(() => {
    if (!isPostAnalysis || isRecommended) return null
    // ROADMAP 1.239: "Behind:" is an explicit comparative designation, and on a
    // withheld turn it was rendering on EVERY option — including the one the
    // numbers put on top. `isRecommended` is `hasLeadingOption && leaderId ===
    // id`, so with the claim withheld no option is the leader and the only
    // gate this line had (`!isRecommended`) is satisfied by all of them. The
    // probe measured exactly that: 30 occurrences withheld against 20
    // permitted, i.e. 3 options rather than 2 non-leaders. Everything behind,
    // nothing ahead.
    //
    // A1's ruling is why it is in scope at all: a comparative designation is a
    // leader claim in inverse form. Gating (rather than reordering, the
    // instrument this arc prefers) because there is no branch order that
    // expresses it — the entitlement is a property of the run, not of this
    // node's position in a chain. `verdict.hasLeadingOption` is a required
    // boolean computed in this component, never an optional prop, so it
    // carries none of the omitted-input risk that made #491 choose ordering.
    if (!verdict.hasLeadingOption) return null
    const report = resultsReport as any
    const myReason = computeBehindReason(props.id, isBaselineOption, report, ceeAnalysisReady, nodes)
    if (!myReason) return null

    const probs: Record<string, { win_probability?: number }> = report?.option_probabilities ?? {}
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    const rates = optionNodes
      .map(n => probs[n.id]?.win_probability)
      .filter((v): v is number => typeof v === 'number')
    const maxRate = rates.length > 0 ? Math.max(...rates) : null
    // Mirrors isRecommended: a sibling is the leader when its win probability
    // is within tolerance of the maximum. Missing win probability ⇒ non-leader
    // (such options also render "Behind:" copy).
    // UI-SEM-067: leader tolerance + identical-reason suppression (display gate).
    const isLeader = (id: string): boolean => {
      const w = probs[id]?.win_probability
      return maxRate != null && typeof w === 'number' && w >= maxRate - 0.0001
    }
    const hasDuplicate = optionNodes.some(n => {
      if (n.id === props.id || isLeader(n.id)) return false
      const explicit = (n.data as any)?.is_baseline as boolean | null | undefined
      const siblingIsBaseline = explicit ?? detectBaseline((n.data?.label as string) ?? '').isBaseline
      return computeBehindReason(n.id, siblingIsBaseline, report, ceeAnalysisReady, nodes) === myReason
    })
    return hasDuplicate ? null : myReason
  }, [isPostAnalysis, isRecommended, verdict, isBaselineOption, resultsReport, ceeAnalysisReady, props.id, nodes])

  const handleWinsViaClick = useCallback(() => {
    if (!winsVia) return
    // AI-to-graph convergence: same fail-closed focus + transient ring as
    // the panel affordances — centre the driver and highlight it; stale or
    // unknown ids do nothing (recovered sessions can carry result ids that
    // no longer exist on this canvas).
    if (!focusExistingTarget(winsVia.id, 'node')) return
    const store = useCanvasStore.getState()
    store.setHighlightedNodes([winsVia.id])
    setTimeout(() => store.setHighlightedNodes([]), 3000)
  }, [winsVia])

  const handleGoalReviewClick = useCallback(() => {
    const store = useCanvasStore.getState()
    const goalNode = store.nodes.find(n => n.type === 'goal' || n.data?.type === 'goal')
    if (goalNode) {
      store.onSelectionChange({ nodes: [goalNode as any], edges: [] })
      store.setShowInspectorPanel(true)
    }
  }, [])

  // "View parameters" handler (Detailed view)
  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.onSelectionChange({ nodes: [{ id: props.id } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [props.id])

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Whether to show Layer 2 content inline (Detailed view)
  const showLayer2Inline = isDetailed

  // Total factor count for completeness assessment (Detailed pre-analysis)
  const totalFactorCount = useMemo(() => {
    return nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor').length
  }, [nodes])

  // ----- Coaching chip cluster (shared between Standard popover and Detailed inline) -----
  // All option AI chips live here. Body never renders chips directly.
  const optionChips = useMemo(() => {
    const optionLabel = (props.data?.label as string) ?? 'this option'
    if (isPostAnalysis) {
      if (isBaselineOption) {
        // Baseline chips already pre-existed inside layer2Content; keep them.
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip chipId="option_why_win_lose" actionType="explain_results" label="Why is this ahead or behind on your goal?" message={`Why does the status quo (${optionLabel}) do better or worse against my goal than the other options?`} />
            <NodeChip chipId="option_risks_of_inaction" actionType={null} label="Risks of inaction" message="What are the risks of choosing to do nothing?" />
          </div>
        )
      }
      if (isRecommended) {
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            <NodeChip chipId="option_what_would_change" actionType="what_would_flip" label="What would change this?" message={`What would need to change for ${optionLabel} to no longer be the best choice?`} />
            <NodeChip chipId="option_why_lead" actionType="explain_results" label="Why does this lead?" message={`Why does ${optionLabel} lead over the other options?`} />
          </div>
        )
      }
      // Non-winner, non-baseline
      if (displayMetadata.winRate !== null) {
        return (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {closeCallGapPp != null && (
              <NodeChip
                chipId="option_what_would_change_close_call"
                actionType="what_would_flip"
                label="What would change this?"
                message={`What would need to change for ${optionLabel} to become the leader?`}
              />
            )}
            <NodeChip chipId="option_what_would_make_lead" actionType="what_would_flip" label="What would make this lead?" message={`What would need to change for ${optionLabel} to lead?`} />
          </div>
        )
      }
      return null
    }
    // Pre-analysis: only non-baseline gets a chip
    if (!isBaselineOption) {
      return (
        <div className="flex gap-1 flex-wrap mt-1.5">
          <NodeChip chipId="option_what_could_go_wrong" actionType={null} label="What could go wrong?" message={`What could go wrong if we choose ${optionLabel}?`} />
        </div>
      )
    }
    return null
  }, [isPostAnalysis, isBaselineOption, isRecommended, displayMetadata.winRate, closeCallGapPp, props.data])

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = useMemo(() => (
    <>
      {/* Goal probability warning (< 10%) -- post-analysis only.
          UI-SEM-082: gated on a USER target (goalThreshold != null) so it never
          crowns a target the user never set, matching GoalNode + OptionCards. */}
      {goalThreshold != null && isPostAnalysis && goalBadgeReadout != null && (
        <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
          {/* ROADMAP 2.282: the withheld arm is the shared register's SENTENCE
              form verbatim (phrase + full stop) — the same wording the results
              panel, the hero and the V7 goal lens render for this basis. The
              permitted arm is byte-identical to the string it replaced. */}
          {goalFitSubstituted
            ? GOAL_ANCHOR_COPY.sentence(goalBadgeReadout, goalFitSubstituted)
            : `${goalBadgeReadout} chance of target.`}{' '}
          <button
            type="button"
            className={`${typography.edgeLabel} text-danger underline cursor-pointer nodrag nopan`}
            onClick={handleGoalReviewClick}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Review
          </button>
        </p>
      )}

      {/* Display-honesty (ROADMAP 1.6b, claim-integrity): the number above is
          scored from a MODELLED forward-propagated outcome distribution, not
          a directly-set base. Same gate and same shared wording as
          OptionCards / GoalNode / OutcomeNode / NodeInspector — the flag is
          read off the shared selector, never re-derived, so no surface can
          show this number with the caveat while another shows it bare. */}
      {goalThreshold != null && isPostAnalysis && goalProbability !== null && goalProbability < 0.10 &&
        goalDecision?.goalFitIsModelledBasis === true && (
        <p
          className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}
          data-testid={`goal-fit-basis-caveat-option-node-${props.id}`}
        >
          {GOAL_FIT_BASIS_CAVEAT_COPY}
        </p>
      )}

      {/* "What this option changes:" intervention list (never for baseline) */}
      {!isBaselineOption && allInterventionChips.length > 0 && (() => {
        const chipsWithMeta = allInterventionChips.map(chip => {
          const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
          // Shared no-change semantics: exact equality only (audit §8 P0-4).
          const isNoChange = isInterventionNoChange(baselineNorm, chip.value)
          return { chip, isNoChange }
        })
        const allNoChange = chipsWithMeta.length > 0 && chipsWithMeta.every(c => c.isNoChange)
        if (allNoChange) return <p className={`${typography.edgeLabel} text-text-light m-0`}>No changes from current state</p>

        // Card containment (audit §8 P0-5): max 3 rows inline; the remainder
        // is disclosed via a plain "+N more in inspector" line — rows stay
        // whole, no CSS clipping.
        const renderableChips = chipsWithMeta.filter(c => !c.isNoChange)
        const visibleChips = renderableChips.slice(0, 3)
        // N counts only chips that WOULD render — hidden no-change chips and
        // dropped malformed entries are not "more" changes to see.
        const moreInInspector = Math.max(0, renderableChips.length - visibleChips.length)

        return (
          <>
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>What this option changes:</p>
            <div className="flex flex-col gap-0.5">
              {visibleChips.map(({ chip }) => {
                const targetFormatted = formatInterventionTargetText(chip)
                let deltaDisplay: string | null = null
                // Skip delta arithmetic when CEE provided a qualitative displayValue
                // for the target — pairing "Doubled capacity" with "(+70%)" produces
                // scale mismatch (numeric delta on a non-numeric framing). The
                // verbatim target string already conveys the change.
                if (!isBaselineOption && !chip.displayValue) {
                  const baselineNorm = baselineOptionInterventions?.[chip.factorId] ?? chip.observedValue
                  if (baselineNorm !== undefined) {
                    const scaleBase = inferInterventionScaleBase(chip.cap, chip.observedValue, chip.observedRawValue)
                    const hasUnit = !!chip.unit && chip.unit !== 'fraction' && chip.unit !== 'proportion'
                    const isQualitative = !chip.factorType || ['quality', 'demand', 'other'].includes(chip.factorType.toLowerCase())
                    if ((hasUnit || !isQualitative) && scaleBase != null) {
                      const denormedBaseline = denormaliseInterventionValue(baselineNorm, chip.cap, chip.observedValue, chip.observedRawValue)
                      const denormedTarget = denormaliseInterventionValue(chip.value, chip.cap, chip.observedValue, chip.observedRawValue)
                      if (Math.abs(denormedBaseline) > 0.01) {
                        const pct = ((denormedTarget - denormedBaseline) / Math.abs(denormedBaseline)) * 100
                        const sign = pct >= 0 ? '+' : ''
                        // Strip displayValue — it describes the target intervention, not the baseline.
                        const baselineFormatted = formatInterventionTargetText({ ...chip, value: baselineNorm, displayValue: undefined })
                        // Polish 4 review fix: only build the delta string when
                        // both formatter calls produced meaningful output.
                        // Otherwise we'd render " → ()" for scale-unit factors
                        // (empty baselineFormatted + empty targetFormatted).
                        if (baselineFormatted && targetFormatted) {
                          deltaDisplay = `${baselineFormatted} \u2192 ${targetFormatted} (${sign}${pct.toFixed(1)}%)`
                        }
                      }
                    }
                  }
                }
                const displayVal = deltaDisplay ?? targetFormatted
                // Polish 4 review: when the intervention value is empty
                // (scale-unit factor with no raw_value anchor), suppress the
                // "→" separator and show only the label so the row reads as
                // a discovery cue rather than misleading "→ 0.1 scale".
                // F.6 passthrough: skip echo stripping for CEE display_value so
                // the string renders exactly as authored (e.g. "Engineers added 5"
                // must not be rewritten to "added 5" when the factor label is
                // "Engineers"). Echo strip only applies to UI-formatted text.
                const echoStripped = chip.displayValue
                  ? chip.displayValue
                  : (displayVal ? stripEcho(chip.label, displayVal) : '')
                return (
                  <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                    <span className="text-text-body">{truncateAtWord(chip.label, 30)}</span>
                    {echoStripped && (
                      <>
                        <span className="text-text-light"> → </span>
                        <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {moreInInspector > 0 && (
              <p className={`${typography.edgeLabel} text-text-light m-0 mt-0.5`}>
                +{moreInInspector} more in inspector
              </p>
            )}
          </>
        )
      })()}

      {/* Status quo fallback — current baseline, no interventions.
          Audit §8 P1: the "{X}% win rate across simulations" line duplicated
          the shared "{X}% win probability" body line with different phrasing
          for the same datum — removed; the body line is the single rendering. */}
      {isBaselineOption && (
        <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p>
      )}

      {isOptionFromCee && !isBaselineOption && (
        <div className="mt-0.5">
          <BriefIcon />
        </div>
      )}

      {/* Coaching chips — Standard view: live in popover; Detailed view: live
          in this inline layer-2 block. Body never renders chips directly. */}
      {optionChips}
    </>
  ), [isPostAnalysis, goalThreshold, goalProbability, goalBadgeReadout, goalFitSubstituted, goalDecision, props.id, handleGoalReviewClick, allInterventionChips, isBaselineOption, baselineOptionInterventions, isOptionFromCee, props.data, totalInterventionCount, optionChips])

  // ----- Pre-analysis popover content -----
  const preAnalysisPopoverContent = useMemo(() => {
    if (isPostAnalysis) return null
    // Polish 4 review: pre-analysis status quo popover used to carry a
    // "Risks of inaction" chip. The audit table says status quo gets no chip
    // pre-analysis (the EyeOff bias icon handles coaching). The "Is this
    // option complete?" chip on the no-interventions branch was likewise
    // outside the audit. Both removed.
    if (isBaselineOption) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>Current baseline. No changes to factors.</p>
      </>
    )
    if (totalInterventionCount === 0) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>No interventions specified for this option.</p>
        {optionChips}
      </>
    )

    return (
      <>
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>
          This option changes {totalInterventionCount} factor{totalInterventionCount !== 1 ? 's' : ''}.
        </p>
        {interventionChips.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {interventionChips.map(chip => {
              const targetFormatted = formatInterventionTargetText(chip)
              // F.6 passthrough: skip echo stripping for CEE display_value.
              const echoStripped = chip.displayValue
                ? chip.displayValue
                : (targetFormatted ? stripEcho(chip.label, targetFormatted) : '')
              return (
                <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                  <span className="text-text-body">{truncateAtWord(chip.label, 30)}</span>
                  {echoStripped && (
                    <>
                      <span className="text-text-light"> → </span>
                      <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {optionChips}
      </>
    )
  }, [isPostAnalysis, isBaselineOption, totalInterventionCount, interventionChips, props.data, optionChips])

  // Completeness assessment for Detailed pre-analysis view
  const completenessText = useMemo(() => {
    if (isPostAnalysis || totalInterventionCount === 0 || totalFactorCount === 0) return null
    return `[${totalInterventionCount} of ${totalFactorCount}] factors specified`
  }, [isPostAnalysis, totalInterventionCount, totalFactorCount])

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      onMouseEnter={() => {
        handleMouseEnter()
        nodeHandlers.onMouseEnter()
      }}
      onMouseLeave={() => {
        handleMouseLeave()
        nodeHandlers.onMouseLeave()
      }}
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      {/* Winner badge -- top-right */}
      {isRecommended && (
        <span
          className={`absolute -top-2 -right-2 z-10 ${typography.edgeLabel} font-medium bg-panel border-2 border-option text-text-body rounded-full px-1.5 py-0.5`}
        >
          Leading option
        </span>
      )}
      <BaseNode
        {...props}
        nodeType="option"
        icon={metadata.icon}
        lodKeepLabel={isRecommended}
        headerSlot={(stableOptionNumber != null || scienceIcons.length > 0) ? (
          <span className="inline-flex items-center gap-1">
            {stableOptionNumber != null && (
              <span
                data-testid={`option-stable-number-${props.id}`}
                aria-label={`Option ${stableOptionNumber}`}
                className={`${typography.panelMeta} inline-flex h-4 min-w-[16px] items-center justify-center rounded border border-panel-border px-1 text-text-light`}
              >
                {stableOptionNumber}
              </span>
            )}
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* Win probability bar (post-analysis, both views) */}
        {displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
          <div
            className={`mt-1.5 mb-1`}
          >
            <div className={`${typography.nodeLabel} text-text-body`}>
              {COMPARATIVE_COPY.phrase(formatWinProbability(displayMetadata.winRate))}
            </div>
            <div className="h-1 bg-panel-border rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-option rounded-full transition-all duration-300"
                style={{ width: displayMetadata.winRate > 0 ? `max(4px, ${Math.round(displayMetadata.winRate * 100)}%)` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* "Wins via [factor]" link (winner, post-analysis) */}
        {isPostAnalysis && isRecommended && winsVia && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Leads via{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={handleWinsViaClick}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {winsVia.label.length > 22 ? `${winsVia.label.slice(0, 22)}...` : winsVia.label}
            </button>
            {winsVia.isGlobalTop ? ', the #1 driver' : ', its biggest lever'}
          </p>
        )}

        {/* Graph v2 Task 4: close-call line — only when within 5pp of leader.
            Renders ABOVE the existing "Behind:" reason so users see both the
            closeness signal and the causal explanation. */}
        {closeCallGapPp != null && (
          <p className={`${typography.nodeLabel} text-warning mt-0.5 m-0`}>
            Close call: within {closeCallGapPp} percentage point{closeCallGapPp !== 1 ? 's' : ''}
          </p>
        )}

        {/* "Behind:" reason (non-winner, post-analysis -- includes status quo) */}
        {isPostAnalysis && !isRecommended && behindReason && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Behind: {behindReason}
          </p>
        )}

        {/* Pre-analysis: structured deltas — Graph v1.1 Task 6 wireframe v4
            OptionWinnerPre. Outlined pills (10px, panel-border, rounded-full)
            laid out horizontally so several fit per row. Labels are compacted
            via compactFactorLabel before reaching here. */}
        {!isPostAnalysis && !isBaselineOption && structuredDeltas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {structuredDeltas.map(d => (
              <span
                key={d.factorId}
                className="inline-flex items-center gap-0.5 font-sans leading-tight px-[5px] py-[1px] rounded-full border border-panel-border bg-transparent text-text-body"
                style={{ fontSize: 11, borderWidth: '0.5px' }}
              >
                {d.direction === 'up' ? (
                  <ArrowUp size={10} className="text-success flex-shrink-0" />
                ) : (
                  <ArrowDown size={10} className="text-danger flex-shrink-0" />
                )}
                <span>{d.label}</span>
                <span className="text-text-light">{d.fromTo}</span>
              </span>
            ))}
          </div>
        )}

        {/* Polish 4 Task 5: differentiator line — what's strategically unique
            about this option vs the others. Standard view only (Detailed
            already shows the full intervention list). */}
        {!isPostAnalysis && !isBaselineOption && !isDetailed && differentiator
          && !differentiatorDuplicatesChip && (
          <p className={`${typography.edgeLabel} text-text-light mt-1 m-0`}>
            {differentiator.label}
          </p>
        )}

        {/* Pre-analysis: status quo "No changes" */}
        {!isPostAnalysis && isBaselineOption && (
          <div className={`${typography.edgeLabel} mt-1 text-text-light`}>
            No changes to factors
          </div>
        )}

        {/* Status-quo bias coaching lives on the header ScienceIcon now — one
            bias-coaching surface per node (bias-coaching slice, proposal
            2026-07-16 §1.5(2)). useScienceIcons emits `status-quo-bias` for
            baseline options (pre- and post-analysis), and the ScienceIcon
            popover carries the "discuss with AI" turn the retired node-level
            BiasIcon twin used to provide. No second bias surface is mounted. */}

        {/* Coaching chips moved into popover (Standard) / Detailed inline
            layer-2. See `optionChips` useMemo above and the popover branches
            at the bottom of this file. */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) ===== */}
        {showLayer2Inline && !isPostAnalysis && !isBaselineOption && (
          <>
            {/* Audit §8 P1: the Detailed pre-analysis "Interventions:" list
                duplicated the delta pills above (identical from→to data on
                one card) — removed. The pills are the single pre-analysis
                rendering; the full list remains in the inspector and in the
                post-analysis "What this option changes:" section. */}
            {/* Unknown-baseline fallback: delta pills need a known baseline,
                so without one this card would show NOTHING about its
                interventions in Detailed view. Surface the count + where to
                look instead of going silent. */}
            {structuredDeltas.length === 0 && hasInterventions && (
              <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
                Changes {totalInterventionCount} factor{totalInterventionCount === 1 ? '' : 's'} — open the inspector for targets
              </p>
            )}
            {completenessText && (
              <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>{completenessText}</p>
            )}
            {/* Coaching chips inline (Detailed pre-analysis) — Standard renders
                them in the popover instead. */}
            {optionChips}
          </>
        )}

        {showLayer2Inline && isPostAnalysis && layer2Content}

        {/* "View parameters" link (Detailed, post-analysis) */}
        {isDetailed && isPostAnalysis && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1.5 nodrag nopan`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            View parameters
          </button>
        )}

        {/* Action icons: edit (bottom-right) */}
        <ActionIcons nodeId={props.id} showEdit />
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {layer2Content}
        </NodePopover>
      )}

      {/* Pre-analysis popover (Standard view, hover) */}
      {!isDetailed && !isPostAnalysis && preAnalysisPopoverContent && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {preAnalysisPopoverContent}
        </NodePopover>
      )}
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

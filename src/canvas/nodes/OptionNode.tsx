import { Fragment, memo, useMemo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Pencil } from 'lucide-react'
import Tooltip from '../../components/Tooltip'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useSupportShareRunWideAbsent } from '../hooks/useSupportShareRunWideAbsent'
import { useOptionLeftOutOfRun } from '../hooks/useOptionLeftOutOfRun'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useCanvasStore } from '../store'
import { selectRestingGlyphsShown } from './shared/restingGlyphRung'
import { useAnchorRailFloorStore, selectAtOrAboveIconLegibleZoom } from './shared/anchorRailFloor'
import { collapseEstimateDisplay } from './shared/collapseEstimateDisplay'
import { focusExistingTarget } from '../utils/focusHelpers'
import { selectDriverDisplayModel, compareByDisplayModel, extractPolicyRow } from '../../components/results/driverDisplayModel'
import { typography } from '../../styles/typography'
import { optionOrdinalBadgeAccessibleName } from './shared/metricVocabulary'
import { cleanFactorLabel, compactFactorLabel, sentenceCaseFactorLabel, formatInterventionValue, isSuppressedUnit, unwrapInterventionValue, joinInterventionDetails, classifyUnit, formatWinProbability, isTierLabel } from '../utils/labelUtils'
import { NODE_ROW_LABEL_MAX_CHARS } from '../utils/nodeLayoutConstants'
import {
  describeInterventionDirection,
  formatInterventionChange,
  formatInterventionTargetText,
} from '../utils/interventionDisplay'
import { resolveOptionIsBaseline } from '../utils/baselineDetection'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { NodePopover, ScienceIcon } from './shared'
import { CoachingChipRow } from './coaching/CoachingChipRow'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { openNodeInspector } from './shared/openNodeInspector'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../mutations/mutationAuthority'

/**
 * ⭐⭐⭐ THE ONE OPTION FIELD WITH A REAL WIRE CARRIER, AND THE CARD NAMED THE
 * DESTINATION WITHOUT OFFERING A WAY THERE.
 *
 * Measured on served `1f77130d`, canonical pricing board, a geometry-free
 * destination probe (`locator.click()` per node, `factorContrast` fired):
 * **option 0/4 reach a live editor**, while the card's own line already read
 * *"3 factor targets. Open the inspector to see which ones."* — a `<p>`. It
 * named the room and locked the door.
 *
 * ⛔ AND THIS ONE IS NOT A CONSOLATION ROUTE. `option` IS a member of
 * `AUTHORITY_OWNING_PANELS`, so `OptionPanel` is not behind the blanket
 * `<fieldset disabled>`, and `proposeOptionIntervention` carries a real
 * `option_intervention_edit` — one of only seven model-changing wire verbs.
 * The authority table says so in its own words (`modelOptionIntervention:
 * 'server_graph'`), which is what the stronger sentence is COMPOSED from
 * rather than asserted: regress that key and the card goes back to saying
 * only *see*, which is still true.
 *
 * ⚠ "CHANGE THEM", NOT "EDIT THIS OPTION". The carrier sets the ACTIVE
 * OPTION'S TARGET VALUE FOR ONE FACTOR — `proposeOptionIntervention`'s own
 * header — so the sentence names the factor targets, which is what the count
 * beside it is counting. A sentence about editing "the option" would promise
 * its description and its label too, and neither is what this carrier writes.
 */
export const OPTION_TARGETS_ROUTE_IS_LIVE = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.modelOptionIntervention,
)

/**
 * The two carriers this line has always had — the sighted reader's count and
 * the full sentence — composed once so they cannot drift apart.
 *
 * ⚠ `routeIsLive` IS INJECTABLE FOR THE ONE REASON THE GOAL CHIP'S IS: so both
 * branches are reached BY EXECUTION. Asserting them behind
 * `if (OPTION_TARGETS_ROUTE_IS_LIVE)` is a tautology that passes whichever way
 * the key falls, and a mutant regressing a key survived exactly that once.
 */
/**
 * ⭐⭐⭐ THE CARD THAT SHOWS THE MOST EDITABLE CONTENT ADVERTISED NOTHING.
 *
 * The factor-targets line was gated `structuredDeltas.length === 0 && hasInterventions`
 * — a FALLBACK: show the count only when we cannot show the changes themselves.
 * `OptionNode.factorTargetsAreReachable.spec.tsx` says so in its own fixture
 * docblock, and pins exactly that branch.
 *
 * ⛔ MEASURED ON THE SERVED BUILD `db758d83`, canonical pricing board, guest:
 * all four option cards carry `interventions=3`, all four render the DELTAS,
 * and an affordance census over every `title` and `aria-label` on each card
 * (controls: a fabricated phrase matched nothing; the status string "Edited
 * since…" excluded by name and reported) found:
 *
 *     cardsWhoseONLYAffordanceIsRename = [... option:opt_full_switch,
 *       option:opt_hybrid, option:opt_new_logos, option:opt_status_quo ...]
 *
 * So the branch I strengthened is the branch the real board does not take.
 * A fix landed on one surface while its twin kept the defect — and the twin is
 * the one the user is looking at.
 *
 * ⚠ AND THE COUNT IS NOT REDUNDANT BESIDE THE DELTAS. A delta row renders only
 * for an intervention with a DECLARED REFERENCE that actually CHANGED (four
 * `return null` arms above), while this count is `totalInterventionCount` —
 * every target this option sets. "3 factor targets" beside two visible rows is
 * the honest statement that one target is not being shown, which the fallback
 * gate was hiding precisely when it mattered.
 *
 * ⛔ IT IS ALSO THE BASELINE OPTION'S ONLY ROUTE. `structuredDeltaChipsRender`
 * carries `!isBaselineOption`, so a baseline option with deltas rendered
 * NEITHER list NOR count under the old gate.
 */
export function optionTargetsLineShows({
  hasInterventions,
  deltasRendered,
}: {
  hasInterventions: boolean
  /** Kept in the signature deliberately: it is what the old gate keyed on, so
   *  a regression to the fallback rule is expressible — and REDs. */
  deltasRendered: boolean
}): boolean {
  void deltasRendered
  return hasInterventions
}

export function optionTargetsChannels({
  count,
  routeIsLive = OPTION_TARGETS_ROUTE_IS_LIVE,
}: {
  count: number
  routeIsLive?: boolean
}): { short: string; full: string } {
  const short = `${count} factor target${count === 1 ? '' : 's'}`
  return {
    short,
    full: routeIsLive
      ? `${short}. Open the inspector to change them.`
      : `${short}. Open the inspector to see which ones.`,
  }
}

import {
  selectGoalProbability,
  basisWithholdsPossessive,
} from '../../components/results/utils/selectGoalProbability'
import { COMPARATIVE_COPY, GOAL_ANCHOR_COPY } from '../../components/results/utils/goalAnchorCopy'
import {
  NOT_ANALYSED_BADGE,
  NOT_COMPUTED_BADGE,
  notAnalysedReasonCopy,
  notComputedReasonCopy,
} from '../../components/results/utils/notAnalysedCopy'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../../lib/decisionVerdict'
import { licensesComparativeLeaderClaim, useAnalysisAdmission } from '../hooks/useAnalysisReady'
import { resolveOptionInterventionCount } from './shared/optionInterventionCount'
import { NODE_TOOLTIP_DELAY_MS } from './shared/nodeTooltip'
import {
  fitRowsToBudget,
  isConcreteChangeRow,
  moreCount,
  OPTION_CARD_ROW_LIMIT,
  OPTION_ROW_SOURCE_MARK_SEPARATOR,
  optionAmountSegmentNoWrap,
  rowFactorIdsFor,
  sharedChangeOrder,
  type OptionChangeRow,
  type OptionSetLike,
} from './shared/optionChangeRows'
import {
  buildOptionNeedsInputTargetRow,
  buildOptionTargetRow,
  optionFactorContext,
  resolveBaselineOptionReference,
  resolveOptionTargets,
  resolveUnsetOptionTargets,
  type CeeOptionTargetsLike,
  type TargetNodeLike,
} from './shared/optionTargetDisplay'
import { NodeRailIcon } from './shared/NodeRailIcons'
import { OPTION_BASELINE_REFERENCE, OPTION_RESULT_COPY } from './shared/metricVocabulary'
import { STATE_WORD_CLASSES, STATE_WORD_STYLE } from './shared/StatusPill'
import { useRunCurrency, optionResultCaption } from './shared/runCurrency'
import { leaderWithholdCause } from '../../components/results/analysisNew/analysisNewCopy'
import { ValueSourceMark } from './shared/valueSourceMark'
import { parseDraftingNotes } from '../ui/inspector-v2/draftingNote'

/**
 * ⭐ THE ONE-LINE OPTION BODY IS RETIRED — Paul, 25 Sep 2026, from live
 * screenshots: the canvas must match the PROTOTYPE, which shows one ROW per
 * concrete change at rest. That supersedes ED #63 5809278282's "title + ONE
 * primary line" for option cards (its `OPTION_PRIMARY_LINE_BUDGET_CHARS` and
 * `optionRestingChangeValue`, which chose between `from → to` and `→ to` for
 * that one line, are deleted with it: a constant nothing reads is a claim
 * nothing checks). The rows themselves are `renderChangeRows` below; the height
 * they add is reserved by measurement (`measureNodeHeightsAtLabelBound`).
 */

/** The existing `est.` mark hover on a change row — one spelling for the row and the card line. */
const OPTION_ROW_ESTIMATE_NOTE = 'Olumi chose this target; it is not yet confirmed.'
const OPTION_ROW_ESTIMATE_TITLE = `${OPTION_ROW_ESTIMATE_NOTE} Open the details to set or confirm it.`

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

/** One option's differentiator sentence (see `computeAllDifferentiators`). */
export interface OptionDifferentiator {
  label: string
  fullLabel: string
  factorId: string
  /**
   * `key` — "<X> is the key difference" (X is this option's alone);
   * `value` — "<X> → <value>" or a direction (X is shared with another option).
   */
  kind: 'key' | 'value'
}

/**
 * ⭐ DOES THE DIFFERENTIATOR SAY SOMETHING THE CHANGE ROWS DON'T? —
 * NODE-ANATOMY v3.2 row "Option": "ONE differentiator line, only if it adds
 * something the rows don't (not '<only row> is the key difference')"; ED #63
 * 5806266691: "differentiator only when additive".
 *
 *   · its factor is NOT a shown row (it sits behind `+N more`) → it names a
 *     change the card does not show: ADDS;
 *   · "<X> is the key difference" with X shown, among SEVERAL changes → it says
 *     which change matters: ADDS;
 *   · "<X> is the key difference" with X the option's ONLY change → the one
 *     row already is the difference: repeats;
 *   · "<X> → <value>" / a direction with X shown → the row already states the
 *     value: repeats.
 *
 * ⚠ This narrows Paul's 10 Sep "both stay" to the cases where the second
 * carrier ADDS; where it only repeats the row, the v3.2 anatomy (24 Sep) wins.
 * Pure — the card's `differentiatorRenders` is its one reader, so the footer
 * and its popover recovery line decide together.
 */
export function differentiatorAddsBeyondRows(
  differentiator: Pick<OptionDifferentiator, 'factorId' | 'kind'>,
  shownRowFactorIds: readonly string[],
  totalChanges: number,
): boolean {
  if (!shownRowFactorIds.includes(differentiator.factorId)) return true
  return differentiator.kind === 'key' && totalChanges > 1
}

/**
 * Compute differentiator labels for ALL non-baseline options in one pass.
 * Returns a Map<optionId, { label, fullLabel, factorId } | null> where
 * `label` is the complete sentence to render (e.g. "Tech lead hired is the
 * key difference" or "Tech lead hired → 90%") and `fullLabel` is THAT SAME
 * SENTENCE built from the untruncated factor label.
 *
 * ⭐ WHY `fullLabel` EXISTS — ellipsis-with-recovery, not
 * ellipsis-with-nowhere-to-go. It is the standard this file already applies
 * to the intervention chips below ("so the full string was recoverable").
 * Witnessed on deployed staging `16336b13`: this footer rendered "Account
 * Executive… is the key difference" and "Platform Engineer… → Low (0)" with
 * the elided words present NOWHERE in the DOM. `compactFactorLabel` shortens
 * in JS, so there is no CSS overflow for a browser tooltip to recover, and
 * the node-level aria-label does not contain the truncated text — the user
 * is told something is the key difference and not told what.
 *
 * ⚠ THE LABEL STILL TRUNCATES, DELIBERATELY. The card is width-constrained
 * and the standing rule is "label truncates, value NEVER truncates"
 * (PR #1220, merged and deployed). `fullLabel` changes only what HOVER can
 * recover; the visible text, the width and the truncation length are
 * untouched.
 *
 * When two options share the same top-differentiating factor, values are
 * appended to disambiguate. If the values are also identical (or both
 * produce empty formatted text), the differentiator is suppressed for both.
 * That de-duplication reads the VISIBLE `label` — two options whose footers
 * read the same on screen are indistinguishable to a user however their
 * hover text differs.
 */
function computeAllDifferentiators(
  nodes: readonly { id: string; type?: string; data?: any }[],
  ceeAnalysisReady: { options?: { id: string; interventions?: Record<string, unknown> }[] } | null,
): Map<string, OptionDifferentiator | null> {
  const result = new Map<string, OptionDifferentiator | null>()

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
    // Explicit `false` must suppress the regex (prevents "Baseline" labels on
    // non-baseline options from being treated as baseline).
    const ceeOpt = ceeAnalysisReady?.options?.find(o => o.id === optNode.id)
    if (resolveOptionIsBaseline(optNode.data as any, ceeOpt)) continue
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
  const candidateLabels = new Map<string, { label: string; fullLabel: string }>()
  for (const [optionId, { factorId, myValue, myDisplayValue }] of bestFactors.entries()) {
    const factorNode = nodes.find(n => n.id === factorId)
    const rawLabel = (factorNode?.data?.label as string | undefined) ?? factorId
    // ⭐ THE SAME CASING RULE THE INTERVENTION ROWS USE, and it was missing
    // here. Measured on the `pricing-model` starter at 1600×1000: every
    // non-baseline option card named one factor twice — "Usage-based pricing…"
    // in its row and "Usage-Based Pricing…" in this sentence, three lines
    // apart. Paul's 10 Sep ruling is that both carriers stay; a reader can only
    // benefit from both if they agree on what the factor is called.
    //
    // ⚠ NORMALISE, THEN COMPACT — the chip path's order, and the one
    // `COMPACT_LABEL_SUFFIXES` (`/i`) and `COMPACT_LABEL_LOOKUP` (`/i`) are
    // both indifferent to. Compacting first would hand this a string that has
    // already lost the words the lookup matches on.
    const fullFactorLabel = sentenceCaseFactorLabel(cleanFactorLabel(rawLabel))
    // ⭐ DERIVED, not a hand-set 20. Measured in real Chromium: the row holds 25
    // characters at the worst-case counter-scale, and this sentence was cutting
    // at 20 — five characters of the factor's name thrown away on every option
    // card. `NODE_ROW_LABEL_MAX_CHARS` carries the derivation and the evidence.
    const compactLabel = compactFactorLabel(fullFactorLabel, NODE_ROW_LABEL_MAX_CHARS)

    // ⭐ ONE code path, evaluated TWICE — once with the compacted label token
    // (at rest) and once with the untruncated one (the hover). The branches below are deliberately
    // NOT duplicated: a second hand-maintained copy of this sentence-building
    // logic is the drift this estate pays for most often, and the two
    // sentences must stay identical apart from the label token or the hover
    // stops recovering the very thing it is hovering over.
    const buildSentence = (labelToken: string, atRest: boolean): string => {
      const leading = `${labelToken.charAt(0).toUpperCase()}${labelToken.slice(1)}`

      if ((factorClaimCount.get(factorId) ?? 0) <= 1) {
        // Unique factor — simple sentence
        return `${leading} is the key difference`
      }
      if (myDisplayValue) {
        // Shared factor with CEE display_value — the producer's reading, no
        // unit/tier inference. At rest it sheds its parenthesised internal-scale
        // number exactly as every change row does (R6, `collapseEstimateDisplay`:
        // "Very high (1)" → "Very high"); the hover sentence keeps it whole.
        const shown = atRest ? (collapseEstimateDisplay(myDisplayValue) ?? myDisplayValue) : myDisplayValue
        return `${leading} \u2192 ${shown}`
      }
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
        describeInterventionDirection(observedBaselineFor(factorId), myValue, labelToken)
      if (unitKind === 'placeholder') return directional()

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
      if (formatted && !isTierLabel(formatted)) return `${leading} \u2192 ${formatted}`
      return directional()
    }

    candidateLabels.set(optionId, {
      label: buildSentence(compactLabel, true),
      fullLabel: buildSentence(fullFactorLabel, false),
    })
  }

  // Phase 4: suppress any labels that are still identical across options.
  // Counted on the VISIBLE sentence — what a user can actually compare.
  const labelCount = new Map<string, number>()
  for (const { label } of candidateLabels.values()) {
    labelCount.set(label, (labelCount.get(label) ?? 0) + 1)
  }

  for (const [optionId, { label, fullLabel }] of candidateLabels.entries()) {
    if ((labelCount.get(label) ?? 0) > 1) {
      result.set(optionId, null)
    } else {
      const factorId = bestFactors.get(optionId)?.factorId
      // Carry the factorId so the option card can drop this footer line when
      // the same factor is already shown as a visible "from → to" chip.
      // `kind` is WHICH sentence Phase 3 built — the unique-factor "… is the
      // key difference", or the shared-factor value/direction form — which is
      // what `differentiatorAddsBeyondRows` needs to know (NODE-ANATOMY v3.2).
      const kind: OptionDifferentiator['kind'] =
        factorId && (factorClaimCount.get(factorId) ?? 0) <= 1 ? 'key' : 'value'
      result.set(optionId, factorId ? { label, fullLabel, factorId, kind } : null)
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
  unit?: string
  factorType?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
}

/** Structured delta for spec Section 13 pre-analysis display. */
interface StructuredDelta {
  factorId: string
  /** Compacted for the card. The card is the ONLY place this is shortened. */
  label: string
  /** Uncompacted, for the `title` recovery affordance. Never rendered raw on
   * the card — `compactFactorLabel` owns what the card shows. */
  fullLabel: string
  direction: 'up' | 'down' | null
  /** Named-reference value → target, using the shared value formatter. */
  fromTo: string
}

export const OptionNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.option
  const displayMetadata = useNodeDisplayMetadata(props.id, 'option')
  const supportShareRunWideAbsent = useSupportShareRunWideAbsent()
  /* ⭐ THE FOURTH ABSENCE — did the run that HAS happened leave this option out?
     Distinct from `winComputationFailed` (it ran and could not compute) and
     from the `excluded-from-analysis-pill` (CEE predicting the NEXT run will
     hold it out). Read through the shared predicates, never re-derived here —
     see `useOptionLeftOutOfRun` for the domain guard that makes it safe. */
  const leftOutOfRunReason = useOptionLeftOutOfRun(props.id)
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
  // The run's currency is read ONCE, below, through `useRunCurrency` — the same
  // composed authority as the panels (`useAnalysisTrust`), never a node-local
  // hash — and it keeps the previous result visible with `Last run ·` only when
  // the model is known to have changed.

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

  // Q1 OF TWO — THE MODEL'S LICENCE. "Does the model, as CEE admitted it THIS
  // TURN, license a comparative-leader claim at all?" A property of the GRAPH,
  // decided before the run: strong separation between two machine-invented
  // estimates is a perfectly good run and still not a licence to crown.
  //
  // ⚠ THE CANVAS ASKED ONLY Q2 UNTIL NOW, AND THE RESULTS PANEL HAS ASKED BOTH
  // SINCE ROADMAP 1.267. `useResultsSectionData` composes exactly these two and
  // publishes `leaderDesignationPermitted`; every designation site on the panel
  // reads it, and this file read `verdict.hasLeadingOption` alone. So a run CEE
  // admitted at `exploratory` put a crown on a card inches from a panel that
  // was withholding every designation on the same run.
  //
  // ONE READER, IMPORTED — never re-spelled. `licensesComparativeLeaderClaim`
  // lives in `hooks/useAnalysisReady` and the results panel imports it from
  // there too. A second local expression of the same question is how two
  // authorities drift apart.
  //
  // ABSENCE => OLDER PRODUCER => EXACTLY TODAY'S BEHAVIOUR. Q1's absence arm is
  // `true` and Q2's is `false`, and they are opposite ON PURPOSE — a shared
  // default would blank the canvas on every legacy payload, or license a claim
  // on every one. Neither term is folded into the other's default.
  const modelLicensesComparativeClaim = licensesComparativeLeaderClaim(useAnalysisAdmission())

  /**
   * True only when this node is the leader, a leading option exists at all, AND
   * the model was admitted to name one.
   */
  const isRecommended = useMemo(() => {
    if (!displayMetadata.isResultsMode || displayMetadata.winRate === null) return false
    if (!modelLicensesComparativeClaim) return false
    return verdict.hasLeadingOption && verdict.leaderId === props.id
  }, [displayMetadata.isResultsMode, displayMetadata.winRate, modelLicensesComparativeClaim, verdict, props.id])

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

  // Graph v2 Task 4: close-call gap in percentage points.
  //
  // ⭐ PREDICATE ONLY SINCE 2026-08-10 — the number is NEVER RENDERED. It
  // decides two things: whether the qualitative "Close call" marker shows, and
  // whether the extra "What would change this?" chip is offered. The 5pp
  // window and the 1pp floor are kept exactly as they were, so the set of runs
  // that qualify is provably unchanged by this retirement; only the sentence
  // moved. Do not reintroduce it into copy.
  //
  // Non-zero only when
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
    // Q1, ON ITS OWN LINE BESIDE Q2. "Within N points of the leading option" is
    // a distance to a leader, so a model CEE did not admit to naming one on
    // cannot carry it either — the same claim as the crown, in measured form.
    if (!modelLicensesComparativeClaim) return null
    // SINGLE VERDICT: `isRecommended` is now false for the front-runner too
    // when no leading option exists (a tied run). Without this guard the
    // front-runner would compute a zero gap against itself and render
    // "Close call: within 1 percentage point" on its own card.
    if (verdict.leaderId === props.id) return null
    // ⭐ AND THE SAME NON-MEASUREMENT CANNOT BE COMPARED EITHER.
    //
    // This is the SECOND surface on this card built from
    // `option_probabilities[id].win_probability`, and the readout is not the
    // only place a fabricated number reaches the user. When the producer says
    // `status === 'failed'` (`n_valid === 0`) there is no distribution behind
    // this option's share — but it still arrives as a finite `0`, which passes
    // the `typeof === 'number'` test below and yields a perfectly well-formed
    // gap inside the 5pp window. The card would then read "Close call with the
    // leading option" about an option that was never scored: a comparative
    // claim with nothing measured on one side of the comparison, and a worse
    // falsehood than the bare `0%` this change removes, because it asserts a
    // RELATIONSHIP rather than a value. The copy carries no number, which makes
    // it read as a considered judgement rather than an arithmetic slip.
    //
    // Suppressing the readout while leaving this line is the trap of fixing one
    // reader of a value and not the others (CLAUDE.md hazard 1 in miniature).
    //
    // ⚠ THIS SENTENCE PREVIOUSLY ASSERTED HOW MANY READERS WERE GATED HERE,
    // AND THE REVIEW THAT FOUND THE ONE IT OMITTED QUOTED IT AS THE EVIDENCE.
    // The code was then fixed and this line was not, so the file went on
    // shipping the finding's own exhibit — true of the prose, false of the
    // code. The tally is the defect, not the number that was in it: the set
    // grows, and the next reader falsifies whatever figure is written here.
    //
    // The invariant instead, which does not go stale: EVERY expression on this
    // card that places the option relative to the others gates on the one
    // authority the hook derives from the one producer field — this flag, or
    // `winRate`, which the hook leaves `null` on the same branch.
    // `OptionNode.comparativeReaderManifest.spec.ts` derives that set from this
    // file and REDs on a reader that arrives without a gate, so the counting is
    // done by something that cannot forget to update itself (CLAUDE.md trap 12).
    if (displayMetadata.winComputationFailed === true) return null
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
  }, [isPostAnalysis, isRecommended, modelLicensesComparativeClaim, verdict, resultsReport, props.id, displayMetadata.winComputationFailed])

  const allInterventionChips = useMemo<InterventionChip[]>(() => {
    // Primary: ceeAnalysisReady.options[optionId].interventions
    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    let interventionEntries: [string, unknown][] = []

    if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
      // ⭐ CEE authors the display string for every intervention; print it.
      // See `joinInterventionDetails` for the measured defects this closes and
      // why BOTH sides of a comparison must be joined the same way.
      interventionEntries = joinInterventionDetails(
        ceeOption.interventions as Record<string, unknown>,
        (ceeOption as { intervention_details?: Record<string, unknown> }).intervention_details,
      )
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
        // ⭐ ONE OWNER for the casing rule. This block used to hold the only
        // copy of it, which is why the differentiator sentence below — the
        // other place this card names a factor — rendered a different casing
        // for the same factor. See `sentenceCaseFactorLabel`.
        const cleanedLabel = sentenceCaseFactorLabel(cleaned)
        const observedState = factorNode?.data?.observedState as {
          unit?: string; factor_type?: string; cap?: number; value?: number; raw_value?: string | number
        } | undefined
        const unit = (factorNode?.data?.unit as string | undefined) ?? observedState?.unit
        return [{
          factorId, label: cleanedLabel, value, displayValue: displayValue ?? undefined, unit,
          factorType: observedState?.factor_type, cap: observedState?.cap,
          observedValue: observedState?.value, observedRawValue: observedState?.raw_value,
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
  // ⭐ ONE OWNER (shared/optionInterventionCount.ts). The reduced line a node
  // renders below the legibility floor needs this same count — it is all that
  // fits — and a second copy of the cee-then-node priority is how two surfaces
  // come to disagree about how many changes one option makes.
  const totalInterventionCount = useMemo(
    () => resolveOptionInterventionCount(props.id, {
      ceeOptions: ceeAnalysisReady?.options,
      nodeInterventions: (nodes.find(n => n.id === props.id)?.data as any)?.interventions,
    }),
    [ceeAnalysisReady, props.id, nodes],
  )

  const isBaselineOption = useMemo(() => {
    // Node flag, then CEE's typed options entry, then the label heuristic.
    return resolveOptionIsBaseline(props.data as any, ceeAnalysisReady?.options?.find(o => o.id === props.id))
  }, [props.data, props.id, ceeAnalysisReady])

  // A before-reference must identify an actual option. A factor's observed
  // value may be a proposal, and a label containing "status quo" is not a
  // reference declaration. Multiple declared baselines are ambiguous here.
  // ⭐ Moved to `optionTargetDisplay.ts` verbatim so the inspector can build
  // the SAME row (DEFECT 5); this card still decides that the baseline option
  // itself has no reference.
  const baselineOptionReference = useMemo(() => {
    if (isBaselineOption) return null
    return resolveBaselineOptionReference(
      nodes as ReadonlyArray<TargetNodeLike>,
      ceeAnalysisReady?.options as ReadonlyArray<CeeOptionTargetsLike> | undefined,
      props.id,
    )
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  // Structured deltas per spec Section 13 — rendered as guarded "from → to" chips.
  const structuredDeltas = useMemo<StructuredDelta[]>(() => {
    if (interventionChips.length === 0) return []
    return interventionChips
      .map(c => {
        const reference = baselineOptionReference?.values[c.factorId]
        const baseline = reference?.value ?? undefined
        // Graph v1.1 Task 6: compaction for pre-analysis pills, originally 15,
        // then a hand-set 22 whose own comment said "revisit if the card width
        // changes materially". The card width DID change — `NODE_CARD_MAX_W`
        // 320 -> 336 at #1527 — and nobody revisited, which is precisely what a
        // hand-maintained mirror does. It is now derived from the card and the
        // type, so the next width change moves it without anyone remembering.
        const shortLabel = compactFactorLabel(c.label, NODE_ROW_LABEL_MAX_CHARS)

        // The compact card only shows a before/after pair for a declared
        // reference. Target-only details remain in the preview and inspector.
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
        if (!change.changed) return null
        const direction = change.arrow

        // A supplied label belongs to the reference option's own value,
        // never the factor's observed display string or this option's target.
        const baselineLabel = reference?.displayValue
        // A labelled target and an unlabelled reference may use different
        // frames. Preserve the supplied target in details without a pair.
        if (Boolean(c.displayValue) !== Boolean(baselineLabel)) return null
        if (c.displayValue && baselineLabel) {
          return { factorId: c.factorId, label: shortLabel, fullLabel: c.label, direction, fromTo: `${baselineLabel} → ${c.displayValue}` }
        }

        // Same formatter/context on both sides; do not fabricate percentages
        // when the formatter cannot express this pair. Keep target-only detail.
        if (!change.baselineText || !change.targetText) return null
        const fromTo = `${change.baselineText} → ${change.targetText}`

        return { factorId: c.factorId, label: shortLabel, fullLabel: c.label, direction, fromTo }
      })
      .filter((d): d is StructuredDelta => d !== null)
  }, [interventionChips, baselineOptionReference])

  /**
   * Differentiator line — a complete sentence describing what's strategically
   * unique about this option. Standard view; baseline excluded.
   *
   * Delegates to computeAllDifferentiators() which computes all options in
   * one pass. See that helper's docblock for the algorithm, thresholds, and
   * deduplication logic.
   *
   * ⭐⭐ IT NO LONGER STOPS AT THE RUN, AND THAT WAS THE DEFECT. This memo used
   * to open `if (isPostAnalysis) return null`, so running the analysis DELETED
   * the only sentence saying which factor makes this option different.
   *
   * WITNESSED on deployed `e2016182` with a completed analysis: all three
   * option cards rendered their name and an ordinal and NOTHING ELSE —
   * "Open a Second Roastery in Leeds | 1". No differentiator, no "Behind:"
   * line. The user is handed a ranking with no reasons at the exact moment
   * they are choosing.
   *
   * ⚠ WHY THE "Behind:" LINE DOES NOT COVER THIS. It names the key factor
   * ("no X added" / "X lower") but renders ONLY for a non-recommended option,
   * and `computeBehindReason` returns null outright when there is no
   * recommended option — which is precisely what a WITHHELD LEADER produces.
   * So on the honest-withholding path, which this estate has invested heavily
   * in, every card loses its reason at once. That is the state witnessed
   * above.
   *
   * ⚠ AND IT IS STRUCTURAL, so nothing here goes stale. The sentence is
   * derived from `nodes` + `ceeAnalysisReady.options[].interventions` — the
   * MODEL, not the result. A run does not change which factor differentiates
   * an option; it only ranks the options. Hiding it after a run withheld
   * information the run never touched.
   *
   * This file already argued the point, two thousand lines down, about not
   * deleting this line to stop it repeating a label: "the differentiator — its
   * sentence frame IS the caption for the factor name it carries... Deleting
   * the line would remove the only statement of WHICH factor is key."
   */
  const differentiator = useMemo<OptionDifferentiator | null>(() => {
    if (isBaselineOption) return null
    const allDiffs = computeAllDifferentiators(nodes, ceeAnalysisReady)
    return allDiffs.get(props.id) ?? null
  }, [isBaselineOption, ceeAnalysisReady, nodes, props.id])

  /**
   * Do the from→to chips actually render? ONE spelling, consumed by both the
   * chip block below and the duplicate-suppression beside it.
   *
   * ⚠⚠ THIS IS THE FIX FOR A DEFECT THIS PR ITSELF CREATED, and it is the same
   * shape as the one it set out to fix — one line further up.
   *
   * `differentiatorDuplicatesChip` says "drop the footer when it repeats a
   * value already shown in a VISIBLE chip". The word visible was always the
   * intent and the code never checked it: it asked whether a matching delta
   * EXISTS, not whether a chip is on screen. That was harmless only while the
   * differentiator was itself suppressed post-analysis. Now that it survives
   * the run, the suppression fires POST-analysis against a chip that renders
   * PRE-analysis only — so on an option whose top factor is shared with
   * another (the `X → value` form), the card lost its last line and rendered
   * ZERO paragraphs. Measured by an independent seat at `92da8e7`:
   *
   *     distinct factors, POST → "Hiring is the key difference"   ✓ fixed
   *     shared factor,    POST → (no differentiator, no Behind)   ✗ still bare
   *
   * That is the exact witnessed state this PR exists to end, so half the fix
   * was no fix. Suppressing against something that is not on screen is the
   * same error as gating on a re-derived condition instead of the real render
   * one — which is precisely what the Behind-line gate below gets right.
   */
  /**
   * ⭐⭐ THE RUN NO LONGER DELETES WHAT EACH OPTION CHANGES.
   *
   * This read `!isPostAnalysis && …`, so the moment results arrived the
   * "£49 → £54" / "Low → High" chips vanished from the card. **Measured on a
   * real user's model** (served `fdbaa4e4`): pre-analysis the option cards
   * carried their interventions and their baseline reference; post-analysis
   * they carried "Support percentage unavailable" and nothing else.
   *
   * ⚠ THE DATA WAS NEVER LOST — ONLY THE RENDER. The same session's debug
   * bundle still holds every one of them post-analysis
   * (`cee_options[].intervention_details[].display_value` = `"£54"`,
   * `"High (0.75)"`), and `full_graph.options[].interventions[]` carries a
   * RICHER form than the card ever showed, with per-intervention provenance.
   * So this deletes a suppression; it adds no new claim and needs no new data.
   *
   * ⭐ AND THE FILE ALREADY ARGUES IT, twenty lines above, for the neighbouring
   * differentiator line: *"derived from … the MODEL, not the result. A run does
   * not change which factor differentiates an option."* An intervention is the
   * same kind of fact — it is what the user asked the analysis to consider, not
   * something the analysis produced. It is also what makes the result legible:
   * "ranked #3" says little; "£49 → £54, against Status Quo, ranked #3" is a
   * reasoning artefact.
   *
   * `!isBaselineOption` stays: the baseline states no delta because it IS the
   * reference, which the line below now says on the card in both phases.
   */
  /**
   * ⭐ THE LOCKED OPTION FACE — "what this option changes" (spec §4; ED 11:52Z
   * point 4; ED 02:31Z D2). At most `OPTION_CARD_ROW_LIMIT` CONCRETE change
   * rows (contract v3.1 #9: a target equal to its reference is not a change),
   * chosen in ONE order for the whole option row so options compare like with
   * like (`optionChangeRows.ts`), then `+N more` from the one total. Olumi-chosen
   * targets stay marked `est.`. Nothing here grows on selection.
   */
  const optionSet = useMemo<Array<OptionSetLike & { unsetSources: ReadonlyMap<string, string | null> }>>(() => {
    const out: Array<OptionSetLike & { unsetSources: ReadonlyMap<string, string | null> }> = []
    for (const n of nodes) {
      if (n.type !== 'option' && n.data?.type !== 'option') continue
      const ceeOpt = ceeAnalysisReady?.options?.find(o => o.id === n.id)
      const isBaseline = resolveOptionIsBaseline(n.data as any, ceeOpt)
      // ⭐ The card's target resolution — CEE map joined with its details, and
      // a bare producer number never erasing the node's own receipt-stamped
      // `source` — now lives in `resolveOptionTargets`, moved verbatim, so the
      // inspector reads targets the SAME way (DEFECT 5).
      const targets = resolveOptionTargets(
        n.data as Record<string, unknown> | undefined,
        ceeOpt as CeeOptionTargetsLike | undefined,
      )
      // Row 22: the targets it NAMES with no value — kept, as `Needs input` rows.
      const unset = resolveUnsetOptionTargets(
        n.data as Record<string, unknown> | undefined,
        ceeOpt as CeeOptionTargetsLike | undefined,
      )
      out.push({ id: n.id, isBaseline, targets, unsetTargets: new Set(unset.keys()), unsetSources: unset })
    }
    return out
  }, [nodes, ceeAnalysisReady])

  const changeRows = useMemo(() => {
    if (isBaselineOption) return []
    const me = optionSet.find(o => o.id === props.id)
    if (!me || (me.targets.size === 0 && me.unsetSources.size === 0)) return []
    const modelOrder = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor').map(n => n.id)
    const order = sharedChangeOrder(optionSet, modelOrder)
    // Contract v3.1 #9: CONCRETE changes only. Every named factor in the shared
    // order, the non-changes skipped (`isConcreteChangeRow`), then the card's
    // row limit — so a target equal to the baseline's never spends a resting
    // row while a real change waits behind `+N more`.
    const concrete = rowFactorIdsFor(me, order, Number.POSITIVE_INFINITY).flatMap(fid => {
      const factorNode = nodes.find(n => n.id === fid) as TargetNodeLike | undefined
      const target = me.targets.get(fid)
      const row = target
        ? buildOptionTargetRow({ factorId: fid, target, factorNode, baselineReference: baselineOptionReference })
        : buildOptionNeedsInputTargetRow({ factorId: fid, factorNode, source: me.unsetSources.get(fid) ?? null })
      return isConcreteChangeRow(row, target, optionFactorContext(factorNode, fid)) ? [row] : []
    })
    return fitRowsToBudget(concrete.slice(0, OPTION_CARD_ROW_LIMIT))
  }, [isBaselineOption, optionSet, props.id, nodes, baselineOptionReference])
  const changeRowsMore = moreCount(totalInterventionCount, changeRows.length)
  // Below Normal zoom (`quiet` / `line`) the change rows stack — see the render.
  // The same rung predicate the resting glyphs read, so one zoom boundary
  // decides both, never two.
  // ⚠ BOUNDED ANATOMY (ED #63 5809278282): this now governs ONLY the rows the
  // DETAILED view keeps inline on the card. In Standard view the rows live in
  // the popover, which is portalled outside the React Flow transform
  // (`--canvas-label-scale` resolves to 1 there at every rung), so it is always
  // the contract grid — a rung-dependent stack would be moot.
  //
  // ⛔ NOT THE RUNG ALONE ANY MORE (24 Sep 2026). Paul's ruling "the landing view
  // counts as Normal zoom" (gap-audit row 3) moved the `full` floor to 0.5, so
  // landing is now `full` and the resting ICONS show there. It did not rule on
  // row layout, and the grid at landing is the MEASURED defect this switch exists
  // for: at scale 2 the label column is ~45px and "Germany market…" wraps to four
  // lines (OptionNode.landingRowsStack.spec header). So the rows keep the grid
  // only at or above the OLD Normal floor (`ICON_LEGIBLE_ZOOM`), exactly as
  // before the ruling; below it they stack.
  const atNormalRung = useCanvasStore(selectRestingGlyphsShown)
  const atOrAboveIconLegibleZoom = useAnchorRailFloorStore(selectAtOrAboveIconLegibleZoom)
  const rowsStacked = !(atNormalRung && atOrAboveIconLegibleZoom)

  /**
   * ⭐⭐ THE DIFFERENTIATOR DE-DUPLICATION IS RETIRED — Paul, 10 Sep 2026:
   * "both stay".
   *
   * Brief scope 7 dropped the differentiator footer when it repeated a value
   * already shown in a VISIBLE from-to chip. That rule was written when the
   * chip was PRE-ANALYSIS ONLY, so it only ever fired before a run — and the
   * moment the chip was restored post-analysis (this change) it began eating
   * the sentence #1247 exists to guarantee.
   *
   * ⚠ THE RULING IS PHASE-FREE AND SO IS THIS. Suppressing post-analysis and
   * not pre- would have left a third `isPostAnalysis` conditional on this card,
   * which is the defect class this change removes. Both elements render in both
   * phases: the chip states the CHANGE ("49 to 59"), the footer states the
   * REASON it matters (which factor differentiates this option).
   *
   * The predicate itself is deleted rather than left unused — an unread
   * constant is a claim nothing checks. Density is a STYLE question and Paul
   * has it flagged for a user-experience pass; if it comes back it comes back
   * as a rendering decision, not as a silent suppression.
   */
  const handleMouseEnter = useMemo(() => () => {
    if (hasInterventions) setHoveredOption(props.id)
  }, [props.id, hasInterventions, setHoveredOption])

  const handleMouseLeave = useMemo(() => () => {
    setHoveredOption(null)
  }, [setHoveredOption])

  // A factor to investigate, selected by shared influence policy among this option's inputs.
  const winsVia = useMemo(() => {
    if (!isPostAnalysis || !isRecommended || !resultsReport) return null
    const report = resultsReport as any
    // Source precedence matches the graph badge (useNodeDisplayMetadata):
    // certified factor_sensitivity FIRST, the untyped enrichment passthrough
    // as fallback — so this card can never rank a different row-set than the
    // badge on the same canvas (Lane 2 review fold).
    const sensitivity = report?.factor_sensitivity ?? report?.enrichment?.sensitivity_analysis?.factors ?? []
    if (!Array.isArray(sensitivity) || sensitivity.length === 0) return null

    // Shared ordering keeps navigation consistent with the drivers panel.
    // Intervening on a globally influential factor does not establish its
    // signed contribution to this option's result, so no causal claim follows.
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

    const ceeOption = ceeAnalysisReady?.options?.find(opt => opt.id === props.id)
    const interventionKeys = new Set(Object.keys(ceeOption?.interventions ?? {}))
    const nodeById = new Map(nodes.map(n => [n.id, n]))

    const optionLevers = ranked.filter(f => interventionKeys.has(f.id) && nodeById.has(f.id))
    const chosen = optionLevers[0]
    if (!chosen) return null
    const factorNode = nodeById.get(chosen.id)

    return {
      id: chosen.id,
      label: cleanFactorLabel((factorNode?.data?.label as string) ?? '') || ((factorNode?.data?.label as string) ?? ''),
    }
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
    // ⭐ THE THIRD READER OF A NON-MEASUREMENT, and the worst of them.
    //
    // A review found the card reading, in one vertical stack:
    //
    //     Hold the current plan · Not computed
    //     …so it has no rank and no probability. This is not a verdict on the
    //     option.
    //     < 1% chance of target
    //
    // The card denies having a probability and then prints one. That is worse
    // than the bare `0%` this change set removes, because the denial and the
    // number are three lines apart and the number wins — a reader takes the
    // figure and treats the sentence as boilerplate.
    //
    // `selectGoalProbability` is correct and is not the problem: it answers
    // "what goal figure does this option's block carry, and on what basis",
    // and it has no business knowing about compute status. The defect was that
    // NOTHING asked the prior question — whether this option has a measurement
    // at all — before handing it that block. Gated here, at the reader, for the
    // same reason the other two are.
    //
    // ⚠ AND IT RESTORES THE PARITY THAT IS THE WHOLE REASON FOR SHARING THE
    // PREDICATE: the results panel forks a failed option to
    // `NotComputedOptionCard`, which prints NO goal figure. Without this gate
    // the canvas and the panel disagreed about one option in one run, which is
    // precisely the two-authorities defect the shared predicate exists to
    // prevent (CLAUDE.md trap 21).
    //
    // ⛔⛔ AND THE NUMBER IT SUPPRESSES IS WORSE THAN "SMALL" — established by a
    // producer derivation, not assumed here. ISL computes
    // `probability_of_goal` over the RAW unfiltered sample array with no
    // finiteness gate. On the very shape that produces `status: 'failed'`
    // (`n_valid === 0`, i.e. every draw non-finite), `inf >= threshold` holds
    // for every draw, so the option ships **`probability_of_goal: 1.0`**.
    //
    // A failed option can therefore arrive carrying a 0.0 chance of winning AND
    // a 1.0 chance of hitting the goal — both fabricated, both from the
    // producer. Without this gate the card would print the most confident
    // possible statement about the one option nothing was measured for.
    //
    // ⚠ SO THIS FIX IS NECESSARY AND NOT SUFFICIENT. The producer defect is
    // real, is outside this repo, and has its own lane. Suppressing the render
    // stops the UI repeating a fabrication; it does not stop the fabrication.
    if (displayMetadata.winComputationFailed === true) return null
    const report = resultsReport as any
    const optionProbs = report?.option_probabilities?.[props.id]
    return selectGoalProbability(optionProbs)
  }, [isPostAnalysis, resultsReport, props.id, displayMetadata.winComputationFailed])
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
    // ⭐ THE THIRD READER — and my own PR comment said there were two.
    //
    // "Behind: <reason>" is a comparative designation: it places this option
    // relative to the others. On an option the producer could not compute
    // (`status === 'failed'`, `n_valid === 0`) there is nothing to be behind
    // WITH — the comparison has no measurement on one side. It rendered
    // directly beside the "Not computed" disclosure, so the card said the
    // analysis produced no usable result and then explained where the option
    // came in the ranking.
    //
    // `computeBehindReason` and `deriveDecisionVerdict` are both status-blind
    // by design and should stay that way: they answer "how does this option
    // compare", not "is there anything to compare". The prior question belongs
    // at the reader, which is here.
    //
    // ⚠ THE GATE IS ON THIS OPTION'S OWN STATUS ONLY. A failed SIBLING still
    // participates in the identical-reason suppression below, which can only
    // ever remove a line — it fails toward saying less, and re-deriving that
    // scan per sibling would need a second authority on the same question.
    //
    // This memo carried a SECOND copy of this gate, sixty lines below, from a
    // rebase that kept both lanes' fixes for one defect. The compiler proved it
    // dead (TS2367: `false | undefined` never equals `true`) — the suite could
    // not, because a redundant guard changes no behaviour. One reader, one gate.
    if (displayMetadata.winComputationFailed === true) return null
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
    // ⭐ Q1, AND WITHOUT IT GATING THE CROWN ALONE WOULD MAKE THIS WORSE.
    // `isRecommended` now also answers Q1, so on a model CEE did not admit for
    // a comparative claim NO option is the leader — and the only gate this line
    // ever had (`!isRecommended`) is then satisfied by every option, including
    // the front-runner. That is precisely the 30-vs-20 measurement recorded in
    // `residualComparative.optionNode.spec.ts`: everything behind, nothing
    // ahead. Suppressing the crown without suppressing its inverse does not
    // withhold the claim, it inverts it.
    if (!modelLicensesComparativeClaim) return null
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
      const siblingIsBaseline = resolveOptionIsBaseline(n.data as any, ceeAnalysisReady?.options?.find(o => o.id === n.id))
      return computeBehindReason(n.id, siblingIsBaseline, report, ceeAnalysisReady, nodes) === myReason
    })
    return hasDuplicate ? null : myReason
  }, [isPostAnalysis, isRecommended, modelLicensesComparativeClaim, verdict, isBaselineOption, resultsReport, ceeAnalysisReady, props.id, nodes, displayMetadata.winComputationFailed])

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
      openNodeInspector(goalNode.id)
    }
  }, [])

  // "View parameters" handler (Detailed view)
  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openNodeInspector(props.id)
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
  // ⚠ ALL FOUR ARMS, THEIR PRECEDENCE AND BOTH `null` RETURNS now live in
  // `resolveNodeCoaching`, unchanged: baseline is still tested before
  // recommended (so a baseline that also leads gets baseline copy), the
  // pre-analysis arm is still empty by design because its one question was
  // promoted to the card face, and an option whose win rate the producer could
  // not compute still asks no comparative question. The reasons are carried in
  // the resolver's docblock.
  const clusterCoaching = useMemo(() => resolveNodeCoaching({
    kind: 'option',
    surface: 'cluster',
    state: {
      isPostAnalysis,
      isBaselineOption,
      isRecommended,
      winRateIsKnown: displayMetadata.winRate !== null,
      closeCallGapIsSet: closeCallGapPp != null,
    },
    context: { label: (props.data?.label as string) ?? 'this option' },
  }), [isPostAnalysis, isBaselineOption, isRecommended, displayMetadata.winRate, closeCallGapPp, props.data])
  const optionChips = useMemo(() => (
    <CoachingChipRow
      className="flex gap-1 flex-wrap mt-1.5"
      chips={clusterCoaching}
    />
  ), [clusterCoaching])

  /**
   * ⭐⭐ THE QUESTION THE CARD ASKS ON ITS OWN FACE.
   *
   * Every other kind on this canvas carries one at rest — Risk asks *"What
   * would we see first?"*, Outcome *"What would falsify this?"*, Goal *"Is this
   * the real goal?"*, and Factor gained one in #1591. **Option did not**,
   * measured on deployed `79866c44`: 4 of 4 option cards asked nothing.
   *
   * ⚠ NOT NEW COACHING. This is the chip that already existed
   * (`option_what_could_go_wrong`), with its existing label and its existing
   * message, moved out of a hover popover onto the surface. Codex ruled
   * per-node coaching EXPANSION lower priority; relocating a built affordance
   * so a reader who never hovers can reach it is not expansion.
   *
   * ⚠ PRE-ANALYSIS ONLY, AND DELIBERATELY NARROWER THAN FACTOR'S. Post-analysis
   * this card carries win rates, goal-fit, deltas and up to three chips; the
   * popover is the right home for that cluster and the card is dense. Before a
   * run the card is sparse and the reader is AUTHORING — which is when a
   * question is worth most and when nothing was being asked at all.
   *
   * ⛔ THE BASELINE STILL GETS NOTHING, unchanged. "What could go wrong if we
   * choose staying as we are" is a question about a choice nobody is proposing
   * to make; the baseline's own coaching is its status-quo ScienceIcon.
   */
  // ⚠ Pre-analysis only, and the baseline still gets nothing — both preserved
  // in the resolver with their reasons.
  const cardQuestion = useMemo(
    () =>
      resolveNodeCoaching({
        kind: 'option',
        surface: 'card',
        state: {
          isPostAnalysis,
          isBaselineOption,
          isRecommended: false,
          winRateIsKnown: true,
          closeCallGapIsSet: false,
        },
        context: { label: (props.data?.label as string) ?? 'this option' },
      }),
    [isPostAnalysis, isBaselineOption, props.data],
  )

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
            className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
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

      {/* A baseline flag identifies the reference; it does not erase its values. */}
      {allInterventionChips.length > 0 && (() => {
        // Every explicit target remains inspectable, even when it happens to
        // equal an observed value whose current/reference role is unknown.
        const visibleChips = allInterventionChips.slice(0, 3)
        const moreInInspector = allInterventionChips.length - visibleChips.length
        const rows = visibleChips.map(chip => {
          const targetFormatted = formatInterventionTargetText(chip)
          const reference = baselineOptionReference?.values[chip.factorId]
          const baselineFormatted = reference?.value != null && Boolean(reference.displayValue) === Boolean(chip.displayValue)
            ? formatInterventionTargetText({ ...chip, value: reference.value, displayValue: reference.displayValue ?? undefined })
            : ''
          // Preserve supplied text verbatim. Strip UI-generated label echoes
          // on each end separately, before composing a reference pair.
          const targetText = chip.displayValue ? targetFormatted : stripEcho(chip.label, targetFormatted)
          const referenceText = reference?.displayValue ? baselineFormatted : stripEcho(chip.label, baselineFormatted)
          const hasReference = Boolean(referenceText && targetText)
          return {
            chip,
            hasReference,
            sameAsReference: hasReference && reference?.value === chip.value,
            text: hasReference && reference?.value !== chip.value
              ? `${referenceText} → ${targetText}` : targetText,
          }
        })

        return (
          <>
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5 mt-1`}>{isBaselineOption ? 'Baseline factor values:' : 'What this option sets:'}</p>
            {baselineOptionReference && rows.some(row => row.hasReference) && (
              <p className={`${typography.edgeLabel} text-text-light m-0`}>Reference: {baselineOptionReference.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {rows.map(({ chip, text, sameAsReference }) => {
                // No relative percentage: a model-level ratio does not prove
                // a real-world relative change (for example on an offset scale).
                return (
                  <div key={chip.factorId} className={`${typography.edgeLabel} text-text-body`}>
                    <span className="text-text-body">{chip.label}</span>
                    {text && (
                      <>
                        <span className="text-text-light">: </span>
                        <span className={`${typography.nodeLabel} font-semibold`}>{text}</span>
                        {sameAsReference && <span className="text-text-light"> (same as reference)</span>}
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

      {/* Baseline identity, without asserting that its values are unchanged.
          Audit §8 P1: the "{X}% win rate across simulations" line duplicated
          the shared "{X}% win probability" body line with different phrasing
          for the same datum — removed; the body line is the single rendering. */}
      {isBaselineOption && (
        <p className={`${typography.nodeLabel} text-text-body m-0`}>Baseline option.</p>
      )}

      {/* ⛔ NO CARD-LEVEL "From your brief" ICON — contract v3.1 pts 1/7 (gap
          U8): each change row carries its own source mark, and the card-level
          source icon is removed. It was also not a brief fact: it fired for
          any option listed in `analysis_ready.options`, whoever authored it. */}
      {/* Coaching chips — Standard view: live in popover; Detailed view: live
          in this inline layer-2 block. Body never renders chips directly. */}
      {optionChips}
    </>
  ), [isPostAnalysis, goalThreshold, goalProbability, goalBadgeReadout, goalFitSubstituted, goalDecision, props.id, handleGoalReviewClick, allInterventionChips, isBaselineOption, baselineOptionReference, props.data, totalInterventionCount, optionChips])

  // ----- Pre-analysis popover content -----
  const preAnalysisPopoverContent = useMemo(() => {
    if (isPostAnalysis) return null
    // Polish 4 review: pre-analysis status quo popover used to carry a
    // "Risks of inaction" chip. The audit table says status quo gets no chip
    // pre-analysis (the EyeOff bias icon handles coaching). The "Is this
    // option complete?" chip on the no-interventions branch was likewise
    // outside the audit. Both removed.
    if (isBaselineOption && totalInterventionCount === 0) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>Baseline option.</p>
      </>
    )
    if (totalInterventionCount === 0) return (
      <>
        <p className={`${typography.nodeLabel} text-text-body m-0`}>No interventions specified for this option.</p>
        {!isDetailed && optionChips}
      </>
    )

    return (
      <>
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>
          {isBaselineOption ? 'Baseline values for' : 'This option sets'} {totalInterventionCount} factor{totalInterventionCount !== 1 ? 's' : ''}.
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
                  {/* FULL label, deliberately. This popover is the recovery
                      surface for the card's 22-char compaction, and it
                      truncated at 30 — so the full string was recoverable
                      nowhere short of the inspector. It is portalled to
                      document.body (`NodePopover.tsx`), therefore outside the
                      React Flow transform, so `var(--canvas-label-scale, 1)`
                      resolves to 1 and it renders at the declared size in a
                      260px wrapping box. It has the room. */}
                  <span className="text-text-body">{chip.label}</span>
                  {echoStripped && (
                    <>
                      <span className="text-text-light">: </span>
                      <span className={`${typography.nodeLabel} font-semibold`}>{echoStripped}</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {allInterventionChips.length > interventionChips.length && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline nodrag nopan mt-1`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            +{allInterventionChips.length - interventionChips.length} more in inspector
          </button>
        )}
        {/* Detailed mode already has these actions on the card. Its recovery
            preview adds target information without repeating the coaching. */}
        {!isDetailed && optionChips}
      </>
    )
  }, [isPostAnalysis, isDetailed, isBaselineOption, totalInterventionCount, interventionChips, allInterventionChips.length, handleViewParams, optionChips])

  /**
   * Completeness assessment for Detailed pre-analysis view.
   *
   * ⭐ TWO STRINGS, BECAUSE THE LINE HAS TWO JOBS (Paul, 31 Aug 2026: "saying
   * the same copy on every node is a waste of space… it should show the bar
   * with the percentage next to it to save space").
   *
   * ⚠ AND THE MEASUREMENT, NOT THE INTUITION — the census in
   * `cardCopyCensus.canvas.spec.tsx` mounts three option siblings that
   * intervene on 1, 2 and 3 of a six-factor board, and this position read
   *
   *     [1 of 6] factors specified
   *     [2 of 6] factors specified
   *     [3 of 6] factors specified
   *
   * ⛔ THE DENOMINATOR IS THE POINT, AND IT IS TRUE OF EVERY BOARD, NOT JUST
   * THIS FIXTURE: `totalFactorCount` counts the factors on the GRAPH, so it is
   * identical on every option card BY CONSTRUCTION — only the numerator can
   * ever differ. (The spec pins the `3 of 6` card by testid; the other two are
   * quoted here to show the shape, and the invariance is a property of the
   * expression above, not of the three numbers.) The
   * brackets and the participle carry nothing at all. `2 of 3 factors` states
   * both quantities and the noun; `specified for this option` is the sentence
   * frame and goes to the hover, which is where this card already puts every
   * other recoverable sentence (`d.fullLabel`, the node title's clamp).
   *
   * ⛔ WHAT IS DELIBERATELY *NOT* MOVED, and the rule it follows: the noun
   * `factors` stays on the card. A hover is unreachable on touch and by
   * keyboard on a non-focusable row (`NodeMetricRow`'s header states this and
   * UI-SEM-089 is the ruling behind it), so anything that is the ONLY statement
   * of what a number counts stays visible. `2 of 3` alone is not a fact about
   * anything.
   *
   * ⛔⛔ AND `full` IS NOT MERELY A TOOLTIP — see the render site. It is
   * carried BOTH on the `title` and in an out-of-flow span, because the first
   * cut of this change put it on the `title` alone and that is an
   * ACCESSIBILITY REGRESSION: the participle was previously ordinary rendered
   * text and was announced; a bare `title` on a non-focusable `<p>` announces
   * to nobody. Compaction buys space for a sighted reader; it does not license
   * saying less to everyone else.
   */
  const completeness = useMemo(() => {
    if (isPostAnalysis || totalInterventionCount === 0 || totalFactorCount === 0) return null
    return {
      short: `${totalInterventionCount} of ${totalFactorCount} factors`,
      full: `${totalInterventionCount} of ${totalFactorCount} factors specified for this option`,
    }
  }, [isPostAnalysis, totalInterventionCount, totalFactorCount])

  /**
   * ⭐⭐⭐ DOES THE DIFFERENTIATOR FOOTER RENDER? ONE SPELLING, THREE READERS.
   *
   * The card's own comment at the render site already warns that this
   * condition must "MATCH that render exactly rather than [be] re-derived —
   * two spellings of one question is how these two lines would drift into
   * contradicting each other". It said that about the Behind clause and then
   * left the whole predicate inline, where a second reader had nowhere to read
   * it from. This change adds two more readers (the recovery line, below, and
   * its spec), so the predicate is hoisted rather than copied three times.
   *
   * ⚠ `differentiator &&` STAYS AT THE JSX SITE. This is a `boolean`, so it
   * cannot narrow `differentiator` from `T | null` for the type checker. The
   * duplication is a narrowing artefact, not a second authority: the boolean
   * decides, the null-check only tells TypeScript what the boolean already
   * guarantees.
   */
  const differentiatorRenders =
    !isBaselineOption &&
    !isDetailed &&
    differentiator !== null &&
    // NODE-ANATOMY v3.2: only when it adds something the shown rows don't.
    differentiatorAddsBeyondRows(differentiator, changeRows.map((r) => r.factorId), totalInterventionCount) &&
    !(isPostAnalysis && !isRecommended && behindReason)

  /**
   * ⭐ THE RECOVERY LINE IS RETIRED BECAUSE THE SENTENCE NOW LIVES WHOLE IN THE
   * POPOVER (bounded anatomy, ED #63 5809278282: "The fuller S3 reasoning detail
   * … can move to the existing hover/focus popover and inspector").
   *
   * It existed because the footer's factor name was shortened in JavaScript on
   * the card (`compactFactorLabel`), so the "…" was IN THE TEXT and a touch user
   * could not recover the subject of the claim — measured at 23/34 starter
   * labels cut. The popover was already the declared recovery surface and gained
   * `option-differentiator-full-*` to carry the full sentence.
   *
   * ⭐ The footer itself is now OFF the card and IN that popover, where it renders
   * `differentiator.fullLabel` — the untruncated sentence — under its own id
   * (`option-differentiator-*`). A second line restating it would be the
   * "recovery that merely repeats what is on screen" this file has always
   * refused. The popover is portalled outside the React Flow transform into a
   * 260px wrapping box, so the sentence needs no budget there; it opens on
   * hover, tap and keyboard focus (`usePopoverHover`).
   */

  // Win-probability readout, derived ONCE.
  //
  // The visible number, the hover text and the text announced to assistive
  // technology are now three renderings of one statistic, so they are built
  // from a single `formatWinProbability` call rather than three. Two calls
  // could not disagree today — the function is pure — but a later change to
  // one call site and not the others is exactly how a card comes to show a
  // number its own sentence contradicts.
  //
  // `rate` is carried alongside because the bar width needs the raw value and
  // a non-null `winReadout` does not narrow `displayMetadata.winRate` for the
  // type checker.
  const winReadout = useMemo(() => {
    if (!displayMetadata.isResultsMode || displayMetadata.winRate === null) return null
    const formatted = formatWinProbability(displayMetadata.winRate)
    return {
      rate: displayMetadata.winRate,
      formatted,
      phrase: COMPARATIVE_COPY.phrase(formatted),
    }
  }, [displayMetadata.isResultsMode, displayMetadata.winRate])
  const runCurrency = useRunCurrency()
  const resultCaption = optionResultCaption(runCurrency) ?? OPTION_RESULT_COPY.unconfirmed
  /**
   * ⭐ THE SHARE IS GOAL-ONLY — SAID WHEN THE LIMIT VERDICT WITHHELD THE LEADER
   * CLAIM (RC P0 #3(c)). The producer's own `leader_claim.withheld_reason`,
   * carried with the result it qualifies (`producer_cause`), by exact token; any
   * other reason (or none) adds nothing, so nothing is inferred. A boolean
   * selector keeps the React-185 guard satisfied.
   */
  const shareIsGoalOnly = useCanvasStore(s => {
    // Read from the RESULT (its persisted stamp), never the session-local
    // `analysisStateV1` envelope: that is not persisted and a later turn without
    // it would strip the qualification from a still-displayed result (Codex
    // #1921 5804215687).
    const permission = s.results.report?.producer_leader_permission
    return permission?.permitted === false && permission.producer_cause === 'constraint_verdict_withheld'
  })
  /*
   * ED #63 5806207128 / 5806266691 choice 3: the short `Goal only` is VISIBLE on
   * the share line; its full meaning comes straight after the visible string
   * in the name AND the hover/focus tooltip (this one string feeds both), so
   * the spoken form opens with what is on screen (label in name, WCAG 2.5.3)
   * and the limitation is never hover-only.
   */
  const winReadoutDescription = winReadout
    ? [
        shareIsGoalOnly
          ? `${resultCaption} · ${OPTION_RESULT_COPY.share(winReadout.formatted)} · ${OPTION_RESULT_COPY.goalOnly}. ${OPTION_RESULT_COPY.goalOnlyNote}`
          : `${resultCaption} · ${OPTION_RESULT_COPY.share(winReadout.formatted)}.`,
        OPTION_RESULT_COPY.sentence(winReadout.formatted),
        shareIsGoalOnly ? leaderWithholdCause('constraint_verdict_withheld') : null,
        runCurrency === 'changed'
          ? `${OPTION_RESULT_COPY.changedNote} ${OPTION_RESULT_COPY.noNewComparisonNote}`
          : runCurrency === 'current'
            ? null
            : OPTION_RESULT_COPY.unconfirmedNote,
      ].filter(Boolean).join(' ')
    : ''

  /**
   * ⭐ WHICH RUN-DERIVED LINE THE CARD CARRIES — ONE SPELLING, READ BY THE RENDER.
   * Hoisted from the JSX gates verbatim (each gate's reasoning stays at its
   * render site). The change rows no longer read it: they stay on the card in
   * both phases and the run adds its line below them (prototype, Paul 25 Sep).
   */
  const notAnalysedRenders = displayMetadata.isResultsMode && leftOutOfRunReason !== null
  /**
   * CEE's TYPED reason this option was left out: its `analysis_ready.blockers[]`
   * entry naming THIS option with `blocker_type: 'missing_value'`. Read, never
   * derived: no entry means no visible reason is added (the badge and its
   * hover/SR sentence stay as they were).
   */
  const missingValueBlocker = useMemo(
    () => ceeAnalysisReady?.blockers?.find(b => b.option_id === props.id && b.blocker_type === 'missing_value') ?? null,
    [ceeAnalysisReady, props.id],
  )
  const notComputedRenders = displayMetadata.isResultsMode && displayMetadata.winComputationFailed === true
  const resultUnavailableRenders =
    displayMetadata.isResultsMode && displayMetadata.winRate === null &&
    displayMetadata.winComputationFailed !== true &&
    leftOutOfRunReason === null &&
    !supportShareRunWideAbsent

  /**
   * A change row's whole sentence — the row's hover and accessible name (the
   * `dd`'s `title`). The `est.` mark carries its own note
   * (`OPTION_ROW_ESTIMATE_TITLE`), so the sentence does not repeat it. A Row 22
   * row (a target the option names with no value) says only the gap: there is
   * no target to describe, attribute or compare.
   */
  const changeRowSentence = (r: OptionChangeRow): string => r.needsInput
    ? `${r.fullLabel}: ${r.fullChange}. This option names this factor but sets no target value yet.`
    : [
    `${r.fullLabel}: ${r.fullChange}.`,
    r.reference === 'baseline_option' && baselineOptionReference
      ? `From ${baselineOptionReference.label} (the baseline option).`
      : r.reference === 'current_value'
        ? 'From the factor’s current value in the model.'
        : null,
    // Point 7 (Paul 23 Sep): where the TARGET came from, in words.
    r.estimated ? null : `Target: ${r.targetSource.label.toLowerCase()}.`,
  ].filter(Boolean).join(' ')

  /**
   * ⭐ THE CHANGE ROWS — ONE BLOCK, RENDERED IN EXACTLY ONE PLACE, ON THE CARD, so
   * its test ids stay unique. DETAILED view keeps its inline detail (the S5
   * landing stack, JS-compacted wrapping labels). STANDARD view is the
   * contract v3.1 resting rows (DESIGN-GAP-v31 #9; Paul 25 Sep, supersedes ED
   * 5809278282's popover placement): each row is the factor's FULL name
   * (muted, never cut — it wraps inside its own column) and the amount
   * `from → to · mark` (`.delta-rows .amount{white-space:nowrap}`).
   *
   * ⭐ ONE ROW = ONE WRAPPING FLEX LINE, NOT A SHARED GRID, AND THAT IS WHAT
   * KEEPS THE AMOUNT ON ONE LINE AT EVERY ZOOM. The contract's
   * `minmax(0,1fr) auto` grid holds only while the amount fits beside a label:
   * at the landing counter-scale (`--canvas-label-scale` 2) "Very high →
   * Moderate · brief" is wider than the whole card, and an `auto` track would
   * then push the amount out of the card. Here the label asks for `8em` (em of
   * its own counter-scaled type, so the rule is zoom-invariant) and grows into
   * whatever the amount leaves; when the two do not fit side by side the amount
   * takes the next line whole, right-aligned, and the label gets the full width.
   * Measured before (served `eec722ab`): labels CSS-clipped ("Bottom-up ado…"),
   * amounts wrapped mid-value ("Very high → Moderate / · brief").
   *
   * The value and its mark are separate segments: when even the amount alone
   * is wider than the card, the MARK drops below the value. A value that fits
   * one line of the row budget is held whole; a longer one breaks only BEFORE
   * ITS ARROW (each half unbroken while it fits) — never cut, and never past
   * the card's right edge (served `cd6a82e4`: "49 GBP per month → 59 GBP per
   * month · brief" overflowed, the value was one no-wrap run). Same rows, same order, same marks, same
   * `+N more` → inspector. No rung term: byte-identical at Normal and landing
   * (no rung-triggered re-layout).
   */
  const renderChangeAmount = (r: OptionChangeRow, align: 'left' | 'right', resting: boolean) => (
    <dd
      className={resting
        ? `${typography.edgeLabel} !leading-tight m-0 ml-auto max-w-full text-right text-text-body`
        : `${typography.edgeLabel} !leading-tight m-0 min-w-0 break-words ${align === 'left' ? 'text-left' : 'text-right'} text-text-body`}
      data-testid={`option-change-row-${props.id}-${r.factorId}`}
      title={changeRowSentence(r)}
    >
      {/* Contract v3.1 OPT-03: `<span class="before">…</span> → target`
          — the value it starts FROM is muted; the arrow and the
          target stay ink (the contract keeps both outside
          `.before`), so the eye lands on what the option sets.
          Only a `from → to` row splits. A target-only row ("→ 80%")
          and a direction-only row render `r.change` whole. The dd's
          value text is byte-identical to `r.change` either way. */}
      {r.needsInput ? (
        /* Row 22 (contract v3 §02): the amount cell of a target the
           option names with no value is the state word — no mark,
           because there is no target to attribute. */
        <span
          className={STATE_WORD_CLASSES}
          style={STATE_WORD_STYLE}
          data-testid={`option-change-row-needs-input-${props.id}-${r.factorId}`}
        >
          {r.change}
        </span>
      ) : (
        <span
          className={resting ? (optionAmountSegmentNoWrap(r.change) ? 'whitespace-nowrap' : 'break-words') : undefined}
          data-testid={`option-change-row-value-${props.id}-${r.factorId}`}
        >
          {/* ⭐ NEVER PAST THE CARD'S EDGE, AT ANY RUNG (served cd6a82e4: "49
              GBP per month → 59 GBP per month · brief" overflowed the right
              border). An amount that fits one line of the row budget is held
              whole (contract .delta-rows .amount nowrap); a longer one may
              break in ONE place, before the arrow, each half unbroken while it
              fits (optionAmountSegmentNoWrap). ED 02:31Z D2: a wrapped from → to
              is accepted; a cut value is not. The text is byte-identical to
              r.change either way. */}
          {r.before !== undefined && r.after !== undefined ? (
            <>
              <span className={resting && optionAmountSegmentNoWrap(r.before) ? 'whitespace-nowrap' : undefined}>
                <span
                  className="text-text-light"
                  data-testid={`option-change-row-before-${props.id}-${r.factorId}`}
                >
                  {r.before}
                </span>
              </span>
              {' '}
              <span className={resting && optionAmountSegmentNoWrap(`→ ${r.after}`) ? 'whitespace-nowrap' : undefined}>
                {'→ '}
                {r.after}
              </span>
            </>
          ) : (
            <span className={resting && optionAmountSegmentNoWrap(r.change) ? 'whitespace-nowrap' : undefined}>
              {r.change}
            </span>
          )}
        </span>
      )}
      {/* ⭐ Paul 23 Sep contract feedback point 7: `8% → 7%` must say
          whether 7% came from you / Olumi / brief. Olumi keeps the
          served `est.` (and its test id); every OTHER source carries
          its own mark instead of silence, so an unmarked target is
          never left to be read as Olumi's.
          Contract v3.1 pt 7 + pt 1 (gap U12, "→ 1 brief" read as a
          unit): a muted separator sets the mark apart from the value,
          the cluster never wraps apart, and every mark — `est.`
          included — is the contract's `.prov` mark: focusable, named,
          and it opens this option's source detail (the inspector). */}
      {!r.needsInput && (<>{' '}
      <span
        className="whitespace-nowrap"
        data-testid={`option-change-row-mark-${props.id}-${r.factorId}`}
      >
        <span aria-hidden="true" className={`${typography.edgeLabel} text-text-light`}>
          {OPTION_ROW_SOURCE_MARK_SEPARATOR}{' '}
        </span>
        <ValueSourceMark
          mark={r.targetSource}
          testId={r.estimated
            ? `option-change-row-estimate-${props.id}-${r.factorId}`
            : `option-change-row-source-${props.id}-${r.factorId}`}
          title={r.estimated ? OPTION_ROW_ESTIMATE_TITLE : undefined}
          subject={`${r.fullLabel} target`}
          onOpenSource={() => openNodeInspector(props.id)}
        />
      </span></>)}
    </dd>
  )

  const renderChangeRows = (layout: 'grid' | 'stacked', restingLabels = false) => {
    const stacked = layout === 'stacked'
    return (
    <div className="mt-1" data-testid={`option-change-rows-${props.id}`} data-row-layout={restingLabels ? 'rows' : stacked ? 'stacked' : 'grid'}>
      {restingLabels ? (
        <dl className="m-0 flex flex-col gap-y-1">
          {changeRows.map((r) => (
            <div
              key={r.factorId}
              className="flex flex-wrap items-baseline gap-x-2"
              data-testid={`option-change-row-line-${props.id}-${r.factorId}`}
            >
              {/* Contract v3.1 `.delta-rows .label`: muted, the FULL name,
                  never cut — it wraps inside its own share of the line. */}
              <dt className={`${typography.edgeLabel} !leading-tight min-w-0 flex-[1_1_8em] break-words text-text-light`}>
                {r.fullLabel}
              </dt>
              {renderChangeAmount(r, 'right', true)}
            </div>
          ))}
        </dl>
      ) : (
      <dl className={stacked
        ? 'm-0 flex flex-col'
        : 'm-0 grid grid-cols-[minmax(0,1fr)_fit-content(calc((100%_-_8px)*0.6))] items-baseline gap-x-2 gap-y-1'}>
        {changeRows.map((r, i) => (
          <Fragment key={r.factorId}>
            <dt
              className={`${typography.edgeLabel} !leading-tight min-w-0 break-words text-text-light${stacked && i > 0 ? ' mt-1' : ''}`}
              title={r.fullLabel !== r.label ? r.fullLabel : undefined}
            >
              <span aria-hidden={r.fullLabel !== r.label ? true : undefined}>{r.label}</span>
              {r.fullLabel !== r.label && <span className={typography.screenReaderOnly}>{r.fullLabel}</span>}
            </dt>
            {renderChangeAmount(r, stacked ? 'left' : 'right', false)}
          </Fragment>
        ))}
      </dl>
      )}
      {changeRowsMore > 0 && (
        <button
          type="button"
          /* Contract v3.1 OPT-10 (`.node .inline-more{color:var(--info)}`)
             + DS v5 §8.7 links: an action reads as a link — `text-info`,
             no resting underline, underline on hover/focus — like every
             other link on this card. RHY-04: 4px above it, the body's
             one rhythm. */
          className={`nodrag nopan ${typography.edgeLabel} mt-1 block text-left text-info no-underline underline-offset-2 hover:underline focus-visible:underline`}
          data-testid={`option-change-more-${props.id}`}
          aria-label={`${optionTargetsChannels({ count: totalInterventionCount }).full} ${changeRowsMore} more not shown on the card.`}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            openNodeInspector(props.id)
          }}
        >
          +{changeRowsMore} more
        </button>
      )}
    </div>
    )
  }

  /**
   * ⭐ THE OPTION'S OWN DIFFERENTIATOR LINE — the prototype's muted sentence under
   * the rows ("Price changes without a feature release."), rendered ONLY from a
   * field the option node carries: its description (the user's body, with any
   * drafter's `Also drafted as:` note removed — `parseDraftingNotes`, the
   * inspector's own reader) or, failing that, its `rationale`. Verbatim. Never a
   * UI-composed sentence: the computed "X is the key difference" stays in the
   * popover (`restingDetailInPreview`), and with neither field the card shows no
   * line at all (Paul 25 Sep: "never invent one").
   */
  const ownDifferentiator = (() => {
    const body = parseDraftingNotes(typeof props.data?.description === 'string' ? props.data.description : null).body.trim()
    if (body) return body
    const rationale = (props.data as { rationale?: unknown } | undefined)?.rationale
    return typeof rationale === 'string' && rationale.trim() ? rationale.trim() : null
  })()
  const ownDifferentiatorLine = ownDifferentiator ? (
    <p
      // Contract v3.1 `.node .differentiator{font-size:10.5px;line-height:1.3;
      // color:var(--muted)}` — counter-scaled like every canvas token.
      className={`text-[length:calc(10.5px*var(--canvas-label-scale,1))] font-sans leading-[1.3] mt-1 m-0 line-clamp-2 text-text-light`}
      data-testid={`option-card-differentiator-${props.id}`}
      title={ownDifferentiator}
    >
      {ownDifferentiator}
    </p>
  ) : null

  /**
   * ⭐ THE BASELINE'S SECOND LINE — ROW 22 (contract v3 §02) and the prototype:
   * "Reference for the other alternatives." (`OPTION_BASELINE_REFERENCE`), on
   * the card at rest under "Baseline · no changes", in both views and both
   * phases. Stated only when it is TRUE OF THE DATA:
   *   · this option is the ONE DECLARED baseline (`is_baseline === true`, and no
   *     other option declares it — `resolveBaselineOptionReference`'s rule: a
   *     label like "Status quo" declares nothing, and two declared baselines
   *     leave no single reference);
   *   · at least one other option exists for it to be the reference of.
   * The option's own description, when it carries one, is the line instead —
   * one differentiator line, never two.
   */
  const isDeclaredReference =
    props.data?.is_baseline === true &&
    nodes.filter(n => (n.type === 'option' || n.data?.type === 'option') && n.data?.is_baseline === true).length === 1 &&
    nodes.some(n => n.id !== props.id && (n.type === 'option' || n.data?.type === 'option'))
  const baselineReferenceLine = isDeclaredReference && !ownDifferentiator ? (
    <p
      className={`${typography.edgeLabel} !leading-tight mt-1 m-0 text-text-light`}
      data-testid={`option-baseline-reference-${props.id}`}
    >
      {OPTION_BASELINE_REFERENCE}
    </p>
  ) : null

  /**
   * The baseline's meta line (contract v3.1 OPT-12). On the card in both phases
   * and both views (prototype, Paul 25 Sep): a run adds its line BELOW it, never
   * in place of it — the option's own facts first (OPT-09).
   */
  const baselineMeta = (
    <div
      className={`${typography.edgeLabel} mt-1 text-text-light`}
      data-testid={`option-baseline-meta-${props.id}`}
    >
      {totalInterventionCount === 0 ? 'Baseline · no changes' : 'Baseline option'}
    </div>
  )
  const baselineMetaOnCard = isBaselineOption

  /**
   * ⭐ ROW 22 (contract v3 §02): the stale option state, "Last run · no new
   * comparison yet". Only on the composed `'changed'` verdict (the same
   * `useRunCurrency` the share caption reads) — never on cannot-confirm, where
   * no "last run" may be manufactured (ED 02:31Z). The last run's result is NOT
   * replaced: the card keeps `Last run` + share (ED 11:52Z point 8); this line
   * adds that no comparison of the current model exists yet. Inline in
   * Detailed; in the popover in Standard, and in the share line's accessible
   * name and tooltip. (The prototype ruling of 25 Sep moved the change rows and
   * the baseline lines onto the card; it did not rule on this line, so its
   * placement is unchanged.)
   */
  const staleStateShown = isPostAnalysis && runCurrency === 'changed'
  const staleStateLine = staleStateShown ? (
    <p
      className={`${typography.edgeLabel} text-text-light mt-1 m-0`}
      data-testid={`option-stale-state-${props.id}`}
    >
      {OPTION_RESULT_COPY.lastRunNoNewComparison}
    </p>
  ) : null

  /**
   * The computed differentiator's full sentence, and — after a run whose model
   * has since changed — the stale state line, at the top of the option's
   * popover in BOTH phases (Standard view). The change rows and the baseline
   * lines are back ON the card (prototype, Paul 25 Sep), so they are not
   * repeated here. Placed at the popover call sites rather than inside
   * `preAnalysisPopoverContent` / `layer2Content`, whose several return branches
   * would each need a copy.
   */
  const restingDetailInPreview = !isDetailed && (differentiatorRenders || staleStateLine !== null) ? (
    <div className="mb-1" data-testid={`option-preview-detail-${props.id}`}>
      {staleStateLine}
      {differentiatorRenders && differentiator && (
        <p
          className={`${typography.edgeLabel} text-text-body mt-1 m-0`}
          data-testid={`option-differentiator-${props.id}`}
        >
          {differentiator.fullLabel}
        </p>
      )}
    </div>
  ) : null

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
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all — and on THIS card the preview is where the full
         differentiator sentence lives. It does not stopPropagation, so the tap
         still selects the node. */
      onClick={nodeHandlers.onClick}
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      <BaseNode
        {...props}
        nodeType="option"
        icon={metadata.icon}
        lodKeepLabel={isRecommended}
        coaching={cardQuestion ?? clusterCoaching}
        resultCaption={resultCaption}
        railIcons={
          /* ⭐ spec §4: "Standard view must indicate that real editable targets
             can be changed." A pencil where a durable carrier exists
             (`OPTION_TARGETS_ROUTE_IS_LIVE`), routed to the existing option
             editor in the inspector — never Expert-only.
             ⭐ REVEALED, NOT PERSISTENT — contract v3.1 `.icon-btn.revealed
             {opacity:0}` / `.node:hover .icon-btn.revealed,
             .node:focus-within .icon-btn.revealed{opacity:1}` (DESIGN-GAP-v31
             #19): at rest the rail shows the coaching icon only; the pencil
             appears on hover, on keyboard focus inside the card and on touch
             (`NODE_RAIL_REVEAL_CLASSES`). Measured before: opacity 1 at rest
             on every non-baseline option, two rail icons where v3.1 has one. */
          !isBaselineOption && OPTION_TARGETS_ROUTE_IS_LIVE ? (
            <NodeRailIcon
              testId={`option-edit-targets-${props.id}`}
              label={hasInterventions
                ? optionTargetsChannels({ count: totalInterventionCount }).full
                : 'No factor targets yet. Open the inspector to set what this option changes.'}
              icon={Pencil}
              tone="muted"
              reveal
              onActivate={() => openNodeInspector(props.id)}
            />
          ) : undefined
        }
        /* ⭐ NO LEADING-OPTION PILL (ED #63 5799353114, decision 1): "Most supported"
           read as a recommendation, so the canvas never names a leader on a card.
           The comparative figures stay model-relative ("Current model · N% of
           runs"); the panel owns any comparative claim and its robustness caveat. */
        /* ⭐ MT-18: NO BARE NUMERAL AT REST. The option ordinal ("the order the
           options were first laid out in, not a ranking") read as a RANK beside
           the factors' driver ranks on the served board. It — and the
           UI-computed science hints — are Detailed information now; the rail
           carries only grounded icons at rest. */
        headerSlot={isDetailed && (stableOptionNumber != null || scienceIcons.length > 0) ? (
          <span className="inline-flex items-center gap-1">
            {stableOptionNumber != null && (
              <span
                data-testid={`option-stable-number-${props.id}`}
                /* ⚠ WAS `Option N`, WHICH READS AS A RANK. Two numbering
                   systems share this canvas — `#1/#2/#3` on factors IS an
                   ordering (by sensitivity), and this one is NOT. A bare
                   "Option 3" is indistinguishable from the ranking badge to
                   anyone using a screen reader, and that is the confusion the
                   legend exists to prevent.

                   Wording DERIVED from the legend's own gloss
                   (`metricVocabulary.ts:373`) rather than written afresh, so the
                   two cannot drift into saying different things about the same
                   badge.

                   ⚠⚠ THE SENTENCE ABOVE WAS FALSE WHEN IT WAS WRITTEN, AND IS
                   KEPT RATHER THAN OVERWRITTEN BECAUSE IT IS THE RECORD OF HOW
                   THIS SHIPPED. There was no import: the `aria-label` was a
                   template literal that merely REPEATED the legend's wording,
                   and this comment asserted the derivation that would have made
                   that safe. A claim in a comment is not a coupling — it is the
                   hand-maintained mirror this estate keeps paying for
                   (CLAUDE.md trap 12), wearing the language of the fix.

                   Nothing could have caught it: `ORDINAL_ROW_MUST_STATE_MINT`
                   is applied only to `row.gloss`, so a legend rewrite would
                   keep the mint guard green, leave this badge on the old
                   words, and tell a screen-reader user something different
                   from what a sighted reader sees in the popover.

                   ⭐ IT IS TRUE NOW, AND BY IMPORT: the name comes from
                   `optionOrdinalBadgeAccessibleName`, which is built from
                   `ORDINAL_MINT_CLAUSE` — the same constant the legend row is
                   built from. Two guards hold it, and they are not redundant:
                   `metricVocabulary.spec.ts` asserts the builder's output
                   carries the legend row's own clause (agreement), and the
                   render specs assert THIS element's accessible name equals
                   the builder's output (so re-inlining a literal here REDs).
                   The rendered string is unchanged.

                   ⭐⭐ AND `title` FROM THE SAME BUILDER, BECAUSE THE SENTENCE
                   WAS REACHING ONLY HALF ITS AUDIENCE. Measured on the deployed
                   board: of 358 `aria-label`s, 9 carry an explanatory
                   disclosure and 5 of those had no hover text — four of them
                   THIS badge, one per option. So the one reader who is told
                   this is not a ranking was the one using a screen reader, and
                   the sighted reader hovering the badge got nothing.
                   ⚠ The comment above already names the harm in exactly those
                   terms ("indistinguishable from the ranking badge to anyone
                   using a screen reader") — it simply stopped one audience
                   short.

                   ⚠ AND THE BOARD MAKES IT CONCRETE. On `usage-based-billing`
                   the badge reading `1` sits on the option with 24% support and
                   the badge reading `3` on the option with 56%, so a reader who
                   takes it for a placing reads the order backwards. The
                   Reasoning tab for the same run says in terms that "no option
                   can be called the leader" — the badge must not imply one.

                   ⭐ THE PATTERN IS THE ESTATE'S OWN, EIGHT LINES UP: the
                   robustness badge at :1773 carries `title` and `aria-label`
                   built from ONE string for exactly this reason. This is that
                   pattern applied, not a new convention — and it is the same
                   builder, so the two audiences cannot be told different
                   things. ⛔ NOT a second string, and NOT a new tooltip
                   component: a `title` is unreachable by keyboard and absent on
                   touch (`EstimateMarker`'s own ruling), which is why the
                   `aria-label` stays and is not replaced by it. Both, or the
                   disclosure keeps missing somebody. */
                title={optionOrdinalBadgeAccessibleName(stableOptionNumber)}
                aria-label={optionOrdinalBadgeAccessibleName(stableOptionNumber)}
                className={`${typography.nodeLabel} inline-flex h-4 min-w-[16px] items-center justify-center rounded border border-panel-border px-1 text-text-light`}
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

        {/* ⭐⭐ MOVED ABOVE THE SUPPORT SCORE, 17 Sep 2026 — RULE 2.
           Node design system: *"The node's own unit comes before any score."*
           And the anatomy: *"The node's own value in its own unit comes first…
           A run adds relative scores BELOW that — never in place of it."*

           ⛔ THESE TWO BLOCKS SAT ~270 LINES APART IN THE SAME RENDER, WHICH IS
           WHY THE INVERSION SURVIVED EVERY READING OF EITHER ONE. The run's
           normalised `Support 48%` rendered at the top of the body; the option's
           own change rows — *"Pro plan price · £49 → £79"*, the option's value in
           the TARGET FACTOR'S unit — rendered far below it. A reader met the
           score before the thing the score is about.

           ⛔ I CLAIMED THIS WAS HEIGHT-NEUTRAL. IT IS NOT. MEASURED: **+2px.**
           The claim was read off the class strings — both blocks carry `mt-1.5`,
           so swapping them "obviously" cannot move anything — and a two-minute
           browser probe refuted it. Before the swap the two blocks sat ~270
           lines apart with other content between them; after it they are
           ADJACENT, so a different pair of vertical margins collapses (`mb-1` on
           the win readout now meets the next block instead of the deltas' own
           `mt-1.5`). Margin collapse is a function of ADJACENCY, which is
           exactly what a reorder changes.

           ⚠ A GREEN SUITE CANNOT SEE A PIXEL, and neither can reading the
           classes. This lane shipped a +30% density regression on 16 Sep from
           precisely this reasoning, under a fully green suite. Two pixels is not
           that — but "+2px, measured" and "height-neutral, asserted" are
           different kinds of statement and only one of them is evidence.

           ⚠ BOUNDED: the delta applies only to a card that renders BOTH blocks.
           On the deployed board today that is **0 of 3 options** — every one
           carries `interventions: {}`, so no structured deltas render and the
           reorder is inert. It becomes live when the producer starts sending
           interventions, which is a CEE-side gap already routed.

           ⚠ AND IT IS A REORDER, NOT A PROMOTION: `structuredDeltaChipsRender`
           keeps its own gate, so a card with no structured deltas renders
           exactly what it renders today, in the order it renders it. */}
        {/* ⭐ CONTRACT v3.1 ROW GRAMMAR (OPT-04/05, RHY-04, T08 b+c) —
            `.node .delta-rows{grid-template-columns:minmax(0,1fr) auto;
            gap:4px 8px;font-size:11px;line-height:1.2}`, kept inside the
            served card's bounds:
              · LABEL takes whatever the amount does not need (`minmax(0,1fr)`),
                so a short target ("→ 1 brief") hands its width back and the
                label stops wrapping at 40%.
              · AMOUNT hugs its content but is CAPPED at the old 3fr share,
                `(100% − gap) × 0.6`, so it never gets narrower than it was and
                the label never gets narrower than its old 2fr — neither cell
                can wrap more than before. `min-w-0` lets `break-words` keep
                wrapping a long value (ED 02:31Z D2: values wrap, never cut)
                instead of a long word widening the column past the cap.
              · Both halves at the 11px label size, `!leading-tight` (the
                token carries `leading-snug`, which sorts later), 4px row gap.
                Net height per card can only fall: −2px top margin, and each
                line saves more than the extra 2px row gap. */}
        {/* ⭐ S5 (24 Sep), DETAILED VIEW ONLY since Paul's 25 Sep prototype
            ruling: Standard view always renders the contract grid below
            (`renderChangeRows('grid', true)`), at every rung. In Detailed,
            BELOW NORMAL ZOOM THE ROWS STACK — label line, then
            value + mark line, each full width. MEASURED at the landing zoom
            (counter-scale 2) the grid above left the label column 45px on
            screen, so "Germany market…" took four lines and the option card
            171–222px; the layout reserves that height at the bound, so the
            whole graph paid for it. At Normal zoom it is the contract grid,
            unchanged. Same rows, same order, same bytes. Height safety is
            argued in `OptionNode.landingRowsStack.spec.tsx`. */}
        {changeRows.length > 0 && (isDetailed
          ? renderChangeRows(rowsStacked ? 'stacked' : 'grid')
          : renderChangeRows('grid', true))}
        {baselineMetaOnCard && baselineMeta}
        {ownDifferentiatorLine}
        {/* Row 22 + prototype: the declared baseline's reference sentence, on the card in both views. */}
        {baselineReferenceLine}

        {/* Pre-analysis: structured deltas — one ROW per change.
            ⭐ THIS REPLACED WRAPPING PILLS, AND THE MEASUREMENT IS THE REASON.
            Captured in Chromium at 1280x800 on the five shipped starters
            (30 Aug 2026), where every starter's auto-fit clamps at the 0.50
            legibility floor, so `--canvas-label-scale` is 2 and an 11px label
            renders at 22px inside a 244px card — roughly 19 characters a line.

            Each delta was an `inline-flex` pill sized to the card's content
            box, so its text wrapped INSIDE a rounded border: measured pill
            heights of 59/87/114/142/169px are 2/3/4/5/SIX wrapped lines. A
            six-line rounded pill is not a pill; it reads as a broken box. And
            `gap-0.5` put 2px between the label and its value at 22px type, so
            "Germany market entry" and "Low (0) → Very high (1)" ran together
            as "market entryLow (0)".

            ⚠ WHAT THIS DELIBERATELY DOES NOT DO, because the same measurement
            ruled it out: the approved brief was "one line per change, label
            truncates, value NEVER truncates". At 19 characters a line, values
            like "No in-house build pursued → Very high (1)" exceed a whole
            line BEFORE any label. One line per change is therefore unbuildable
            without truncating values, which the brief forbids — so the value
            keeps as many lines as it needs and the LABEL gets its own line.

            ⚠ AND THE HONEST SIZE OF THE WIN: removing the chrome recovers
            about 3px of padding and border per row, ~5% of the block. This is
            a LEGIBILITY change, not a density one. First-view legibility is
            height-bound at the GRAPH level (build-vs-buy lays out 2693 units
            against ~1600 showable) and no card change reaches that. */}

        {/* ⭐ WHERE THE OPTION'S OWN LINES RENDER (Paul 25 Sep, the prototype —
            superseding ED #63 5809278282's bounded anatomy, which had moved the
            differentiator and, after a run, the baseline meta into the popover):
              · the COMPUTED differentiator ("X is the key difference") stays in
                the option's popover (`restingDetailInPreview`) in Standard view,
                with every gate it had (`differentiatorRenders`: not the baseline,
                not Detailed, only when it ADDS beyond the rows — NODE-ANATOMY
                v3.2 — and not where the "Behind" reason renders), full sentence;
              · the baseline meta ("Baseline · no changes" / "Baseline option",
                contract v3.1 OPT-12) is ON THE CARD in both phases and both views
                (`baselineMetaOnCard = isBaselineOption`); a run adds its share
                line BELOW it, never in place of it;
              · under the rows, ONE muted line at most: the option's own
                description or rationale (`ownDifferentiatorLine`), else — on a
                declared baseline with another option to be the reference of —
                "Reference for the other alternatives." (`baselineReferenceLine`). */}

        {/* ⭐ CONTRACT v3.1 OPT-09 — THE OPTION'S OWN FACTS FIRST, THE RUN BELOW.
            The result and absence rows used to sit BETWEEN the change rows
            and the differentiator, so the run split the option's own model
            facts in two. They now follow ALL of them (rows, differentiator,
            baseline meta), which is the factor card's order (own value →
            driver → turning point) and the anatomy rule quoted above: "A run
            adds relative scores BELOW that — never in place of it." Pure
            reorder: every gate below is unchanged. Height: with the trailing
            `mb-1`s gone (OPT-06), every body block carries a TOP margin only
            (`mt-1`, or `mt-0.5` on the Detailed-only lines), so each gap is
            that block's own top margin and the new adjacency can keep or
            shrink a gap, never widen one. */}
        {/* Win probability — bar and percentage on ONE line (post-analysis, both views).
            ⭐ WHY THIS IS ONE LINE AND NOT TWO (Paul, 31 Aug 2026): "Saying the
            same copy on every node is a waste of space… It should show the bar
            with the percentage next to it to save space." Five option cards
            each carried the identical ratified sentence and only the number
            varied, so four fifths of that block was repetition — and on a
            canvas card the sentence wraps to two or three lines at the
            legibility floor.

            THE SENTENCE IS NOT DROPPED, because the number alone does not say
            what it measures. It survives twice:
              · in the positioned tooltip on hover or keyboard focus;
              · in the row's accessible name, including any currentness caveat.
            The bar is deliberately a focusable graphic for keyboard disclosure.
            Its role makes descendants presentational, so aria-label is the
            single accessible name; an additional screen-reader-only child
            would not provide another announcement.

            The copy is never re-typed here: it comes from
            `COMPARATIVE_COPY.phrase` (components/results/utils/goalAnchorCopy),
            which is the ratified wording and the one owner of it. */}
        {/* ⭐⭐ THE SHARE LINE HAS ONE RESERVED SLOT, PRE-RUN AND POST-RUN — A RUN
            NEVER GROWS THE CARD (ED #63 5809278282: "Option = … current-model
            share post-run", "no rung-triggered re-layout"; ED 5810951997: no
            card grows). MEASURED on served 853feeb7 (pricing, 1280x800, design
            audit 26 Sep #4): each option grew +49.4px on screen after the Run,
            because this row did not exist pre-run and then wrapped to THREE
            lines ("Current model ▬" / "34% of runs" / "· Goal only"). The
            layout reserves the height it measured before the run, so the taller
            cards pushed 7 edges under non-endpoint cards and 2 more cards off
            screen.
              · The slot is ONE `edgeLabel` line (`h-[1lh]`) with identical
                classes in both phases, so the layout reserves the post-run
                height before the run. Empty and aria-hidden before a run.
              · The row never wraps. What does not fit gives way in a fixed
                order, whole-text in the existing tooltip and the row's name:
                the bar first, then the default `Current model` caption, then
                `· Goal only` (ellipsis). The share itself never shrinks.
                A non-default caption (`Last run`, `Model result`) is a
                qualifier that must stay on the card, so it does not give way
                ahead of `Goal only`.
            Pinned in `__tests__/OptionNode.noGrowthAfterRun.spec.tsx`. */}
        {/* Rendered in EVERY phase (MG, #2123 review B1): an option the Run does not score keeps this slot too,
            empty and aria-hidden, or it would shrink after the Run and re-lay the board. */}
        {(
        <div
          data-testid={`option-share-slot-${props.id}`}
          className={`${typography.edgeLabel} mt-1 h-[1lh] min-w-0 overflow-hidden`}
          aria-hidden={winReadout === null ? true : undefined}
        >
        {winReadout !== null && (
          <Tooltip asChild content={winReadoutDescription} delay={NODE_TOOLTIP_DELAY_MS}>
          <div
            className="flex h-full min-w-0 flex-nowrap items-center gap-1.5 whitespace-nowrap cursor-help"
            role="img"
            aria-label={winReadoutDescription}
            tabIndex={0}
            data-node-tooltip="true"
            data-testid={`option-analysis-currency-${props.id}`}
          >
            {/* ⭐⭐ `max(4px, N%)` IS THE ONLY THING PREVENTING A 0px FILL HERE.
                DO NOT REMOVE IT AS REDUNDANT — it is not.

                MEASURED on deployed `ce32426c`, all four option nodes, by
                `getBoundingClientRect` (a peer lane, driving the live canvas):
                the "< 1%" option's computed style reads literally
                `width: max(4px, 0%)`. So `Math.round(rate * 100)` DOES produce
                `0` on this surface for a genuine, measured, non-zero share —
                the same rounding defect that is an open P0 on the results
                panel's own bar. This floor is what stops it landing here, and
                deleting it re-opens that P0 on the canvas.

                ⚠ AND THE TRADE IT BUYS, STATED RATHER THAN LEFT SILENT. On the
                54px track (below), 4px is 7.4%. A genuine 7% share therefore
                renders `max(4px, 3.78px)` = 4px — IDENTICAL to a 0.4% share
                beside it. So ordering collapses below about 7%: the floor that
                prevents "a measured value looks like nothing" creates "two
                different measurements look the same". That is the smaller harm
                and it is deliberate, because anything thinner is invisible at
                canvas zoom — and the exact share is printed beside the bar.

                The results panel keeps 2px on a 371px track (0.54%) for the
                same reason at a different scale. If the two ever have to agree,
                the honest form is a floor expressed as a FRACTION of the track
                rather than a pixel count — not needed today.

                ⭐ CONTRACT v3.1 OPT-01/OPT-08 (Paul point 9: "make the driver bar
                neutral, so it does not compete with attention"). The track WAS
                `flex-1` (~190px on a 336 card) with an option-purple fill, so a
                long bar dominated the card and one kind of element wore two
                colours on one board. It is now the factor run bar's own anatomy
                (`FactorDriverLine`: `w-[54px]` track, `bg-text-light` fill on
                `bg-panel-border`) — short, fixed, neutral, secondary. `shrink`
                + `min-w-0` let it give way on the narrowest card. */}
            {/* ⭐ THE ANCHOR, VISIBLE — restored 31 Aug 2026.
                The density change put `phrase()` behind a `title` and left the
                number bare. At that time the row was not focusable, so its
                `title` was unreachable by KEYBOARD and absent on TOUCH, and
                two input classes got a number with no statement of what it
                measures — on the only unlabelled percentage on a canvas where
                every other one is anchored, and beside the rank badge, which is
                already a bare numeral.
                The word comes from the register, never re-typed here. The
                `w-14` column matches `FactorNode`'s "Influence" / "Confidence"
                rows exactly, so this is the canvas's existing anchored-row
                pattern rather than a second one. */}
            {/* ⭐⭐ MODEL-RELATIVE, NEVER `Support` (ED 11:52Z point 4: "Do not use
                `Support` as the result label. It reads as endorsement. Any result
                shown at rest must be explicitly model-relative, e.g. `Current
                model · 55% of runs`"). The caption follows the run's currency:
                `Current model`; `Last run` only when the model is KNOWN to have
                changed (ED 02:31Z Q2); `Model result` when currency cannot be
                confirmed — it claims neither. */}
            {/* Caption + bar give way TOGETHER, as one clipped unit.
                · Default `Current model`: the unit yields FIRST and strictly
                  (a shrink weight that leaves `· Goal only` no sub-pixel share),
                  and its parts are whole-or-nothing — a part that does not fit
                  wraps onto the unit's clipped second line (the zero-width
                  spacer keeps line 1 open), so a squeezed caption leaves no
                  sliver of a glyph. The bar goes before the caption.
                · `Last run` / `Model result` is a qualifier that stays on the
                  card: the unit yields only alongside `· Goal only`, and the
                  caption truncates rather than disappearing. */}
            <span
              className={`flex h-full min-w-0 items-center gap-x-1.5 overflow-hidden ${runCurrency === 'current' ? 'shrink-[1000000] flex-wrap content-start' : 'shrink'}`}
              aria-hidden="true"
            >
            <span className="h-full w-0 -mr-1.5" />
            <span
              data-testid={`option-win-anchor-${props.id}`}
              className={`${typography.edgeLabel} text-text-light ${runCurrency === 'current' ? 'shrink-0 whitespace-nowrap' : 'min-w-0 truncate shrink'}`}
              aria-hidden="true"
            >
              {resultCaption}
            </span>
            <div
              className={`h-1 w-[54px] bg-panel-border rounded-full overflow-hidden ${runCurrency === 'current' ? 'shrink-0' : 'min-w-0 shrink-[100000]'}`}
              aria-hidden="true"
            >
              <div
                className="h-full bg-text-light rounded-full transition-all duration-300"
                style={{ width: winReadout.rate > 0 ? `max(4px, ${Math.round(winReadout.rate * 100)}%)` : '0%' }}
              />
            </div>
            </span>
            <span
              data-testid={`option-win-readout-${props.id}`}
              className={`${typography.edgeLabel} text-text-body shrink-0 tabular-nums`}
              aria-hidden="true"
            >
              {OPTION_RESULT_COPY.share(winReadout.formatted)}
            </span>
            {/* ⭐ `Goal only` ON THE SHARE LINE (ED #63 5806207128 / 5806266691
                choice 3; NODE-ANATOMY v3.2 Option: "a short `Goal only`
                qualifier on the same line, with the full sentence in the hover
                and aria (it keeps #1921's per-card fact without the two-line
                wrap)"). Gated exactly as #1921 gated its second line — the
                producer's own `constraint_verdict_withheld`, read from the
                RESULT's persisted stamp, so it survives a reload. Muted
                `text-light`, regular weight, no colour: a limitation, never
                styled as a verdict or an endorsement. Its meaning rides the
                row's name and tooltip (`winReadoutDescription`), which this
                row's hover AND keyboard focus open. */}
            {shareIsGoalOnly && (
              // The separator and the words never wrap apart; on a narrow card
              // the qualifier ends in an ellipsis (whole in the tooltip + name).
              <span className={`${typography.edgeLabel} text-text-light min-w-0 truncate whitespace-nowrap`} aria-hidden="true">
                {'· '}
                <span
                  data-testid={`option-share-goal-only-${props.id}`}
                  className={`${typography.edgeLabel} text-text-light`}
                >
                  {OPTION_RESULT_COPY.goalOnly}
                </span>
              </span>
            )}
          </div>
          </Tooltip>
        )}
        </div>
        )}
        {/* Row 22: Detailed carries the stale state inline (Standard: popover). */}
        {isDetailed && staleStateLine}

        {/* ⭐ THE OPTION THE ANALYSIS RAN ON AND COULD NOT COMPUTE.
            Mutually exclusive with the readout above by construction, not by a
            second condition: `winComputationFailed` is the branch on which the
            hook leaves `winRate` null, so `winReadout` is already null here.

            ## What it deliberately does NOT render

            No bar, no track, no percentage, no rank contribution. Not "rendered
            as 0%", not "rendered as —": ABSENT. A zero-width fill in a row of
            fill bars is a measured claim, and a dash in that slot still asserts
            membership in the comparison. The state this replaces rendered a
            hard `0%` with a zero-width bar, in the one position on the card
            that answers how often this option came out ahead.

            ⚠ CORRECTED (#1048 review). This said a GENUINE measured zero
            "renders `"<0.01%"` two nodes along". FALSE **for this surface**,
            and the harm it described was therefore MILDER than the real one.
            `formatWinProbability` hardcodes
            `formatProbabilityWithResolution(rawProb, undefined)`
            (`labelUtils.ts:183`), so the resolution arm is UNREACHABLE from the
            canvas and `value <= 0` returns `'0%'` (`formatPercent.ts:114`,
            pinned by `labelUtils.spec.ts`'s "0 renders 0%"). `<0.01%` needs an
            `nSamples` count, which only the RESULTS PANEL supplies — where the
            sentence is true, and where `OptionCards.notComputed.spec.tsx:236`
            asserts it. So on the canvas, pre-fix, a failed option and a genuine
            measured zero rendered the IDENTICAL `0%`: indistinguishable, with
            no accident of a fallback arm to tell them apart. The gate is what
            distinguishes them, not the formatter.

            ## Why a WORD and not simply nothing

            Dropping the row would have been honest about the number and silent
            about the reason, and silence in a row of bars reads as a rendering
            gap or as "it came last". `n_valid === 0` is a fact about the
            simulation and carries no information about the option's merit
            either way — which is exactly what the sanctioned sentence says, and
            why it is worth the two lines of space.

            ## The copy has ONE owner and it is not this file

            `NOT_COMPUTED_BADGE` and `notComputedReasonCopy` come from
            `components/results/utils/notAnalysedCopy` — the same strings the
            results panel's `NotComputedOptionCard` renders. Re-typing the
            sentence here would let the canvas and the panel drift into saying
            two different things about one run (CLAUDE.md trap 12).

            ## Reachability, following the anchor row above

            The sentence is given to assistive technology directly rather than
            only through `title`, because a `title` is unreachable by KEYBOARD
            (this row is not focusable) and absent on TOUCH — the same reason
            the win anchor was restored as visible text on 31 Aug. */}
        {/* ⭐⭐ THE OPTION THE RUN LEFT OUT — THE FOURTH ABSENCE, AND THE ONE
            THIS CARD DID NOT DRAW.

            ## What was on screen before, and why it was not enough

            An option with no `option_probabilities` entry left
            `winComputationFailed` false and `winRate` null, so it fell through
            to `option-result-unavailable-*` below: *"On the data so far, no
            support percentage for this option"*. That sentence is TRUE and it
            POOLS two states whose next steps point in opposite directions —
            the engine scored this option and could not resolve a share (wait,
            or re-run) and the engine never scored it at all (say what it
            changes). A reader who cannot tell them apart takes the wrong
            action or none, which is the whole reason the ratified design draws
            four absences rather than one.

            ## It is READ, not derived here

            `useOptionLeftOutOfRun` calls the same three functions the results
            panel calls (`useResultsSectionData.ts:2056/2085/2272`) on the same
            inputs, including the DOMAIN GUARD that refuses to mark anything
            when the run produced no per-option output at all. A second
            spelling of "was this option in the analysis" is how the canvas and
            the panel come to contradict each other about one run.

            ## Mutually exclusive with the not-computed row below, by construction

            `winComputationFailed` requires an ENTRY; this requires the ENTRY to
            be absent. Neither needs a second condition to exclude the other,
            and the two sentences are deliberately different: "the analysis ran
            on this option and could not produce a usable result" is a fact
            about the simulation, "it was left out" is a fact about the
            submission. Re-badging either as the other is a lie about whose
            fault it is — the argument `notAnalysedCopy.ts` makes at
            `NOT_COMPUTED_BADGE`.

            ⛔ IT IS NOT THE `excluded-from-analysis-pill`, AND MUST NOT BE
            RECONCILED WITH IT. That pill reads CEE's readiness stamp
            `waived_by_exclusion` — *"the run WILL hold this option out"*, a
            claim about a run that has not happened, suppressed while the
            verdict is stale. This row reports what a run that HAS happened
            did. Different producer, different tense, different question; named
            apart rather than aligned (CLAUDE.md trap 21).

            ## No action offered, deliberately

            The results panel already carries the resolve route
            (`notAnalysedActionLabel` / `resolveOptionPrompt`), which reproduces
            the sentence CEE itself tells users to say. Minting a second route
            to one capability on the canvas would give the assistant two strings
            to be trained on and only one of them would be the documented one —
            the argument `notAnalysedCopy.ts` makes in its own header. The row
            discloses; the panel acts. Same division the not-computed row keeps.

            ## ⭐⭐ AND THE ROW SAYS NOTHING AT ALL WHEN THE RESULT CANNOT BE
            VOUCHED FOR

            `results.status` survives a graph edit and survives a reload, so an
            option added once a run has finished — or simply looked at after a
            restore — reaches this card with no entry and, if it is wired, the
            derived reason `not_returned`, whose sentence says the analysis
            RETURNED nothing for it. It returned nothing because it was never
            asked. `useOptionLeftOutOfRun` therefore WITHHOLDS that arm unless
            `useAnalysisResultsAreCurrent` can vouch for the result on screen,
            and it withholds by returning `null` rather than by substituting a
            fourth sentence: the currency signal's `false` pools "the graph
            changed" with "cannot confirm", so no sentence naming a change is
            licensed by it. The card then falls back to the pooled-but-true line
            below. `no_interventions` is ungated — it reports the graph as it is
            now. See the hook's docblock for the measurement.

            ⭐ THE PILL IS DELIBERATELY THE SAME ONE. `NOT_ANALYSED_BADGE` is
            the GENUS — "this card carries no rank and no probability" — and it
            already serves two reasons whose next steps differ; the four-absence
            ruling draws its lines in the SENTENCE, which is where a reader
            finds the action. A third visible string would also have to dodge
            "Not in this analysis", which `BaseNode.tsx:1394` already owns for
            CEE's prediction about the NEXT run — minting a near-synonym beside
            it is the two-things-under-one-name defect this row exists to avoid.

            The sentence is given to assistive technology directly rather than
            only through `title`, because a `title` is unreachable by KEYBOARD
            (this row is not focusable) and absent on TOUCH. */}
        {notAnalysedRenders && leftOutOfRunReason !== null && (
          <div
            className="mt-1 flex items-center gap-1.5"
            title={notAnalysedReasonCopy(leftOutOfRunReason)}
            data-testid={`option-not-analysed-${props.id}`}
          >
            <span
              className={`${typography.edgeLabel} text-text-light shrink-0`}
              aria-hidden="true"
            >
              {NOT_ANALYSED_BADGE}
            </span>
            {missingValueBlocker && (
              <span
                className={`${typography.edgeLabel} text-text-light min-w-0`}
                aria-hidden="true"
                data-testid={`option-not-analysed-reason-${props.id}`}
              >
                · {OPTION_RESULT_COPY.notAnalysedNeedsValue}
              </span>
            )}
            <span className={typography.screenReaderOnly}>
              {notAnalysedReasonCopy(leftOutOfRunReason)}
            </span>
          </div>
        )}

        {notComputedRenders && (
          <div
            className="mt-1 flex items-center gap-1.5"
            title={notComputedReasonCopy(displayMetadata.winComputationFailedReason)}
            data-testid={`option-not-computed-${props.id}`}
          >
            <span
              className={`${typography.edgeLabel} text-text-light shrink-0`}
              aria-hidden="true"
            >
              {NOT_COMPUTED_BADGE}
            </span>
            <span className={typography.screenReaderOnly}>
              {notComputedReasonCopy(displayMetadata.winComputationFailedReason)}
            </span>
          </div>
        )}

        {/* Missing win share is distinct from measured zero and a reported
            failure. Outcome ranges may still exist: name only the missing
            percentage, without claiming the whole result is unavailable.

            ⭐⭐ AND IT IS ALSO DISTINCT FROM *EVERY* OPTION MISSING ONE, which is
            what this gate adds. Measured on the deployed build `08a3724d`
            (`staging--olumi.netlify.app`): a three-option model rendered
            "Support percentage unavailable" on all three cards, identically, in
            the position where the comparison belongs. Stated three times it is
            not three facts about three options. It is one fact about the RUN,
            and repeating it per card tells the reader nothing while occupying
            the row they came to compare.

            `supportShareRunWideAbsent` separates the two:

              - PARTIAL (some cards resolved a share, this one did not) → the
                line renders, and now EARNS its place: it is the only thing
                telling the reader why this card differs from its siblings.
                PLoT's `IDENTICAL_OPTIONS_DEDUPED` produces exactly this shape.

              - RUN-WIDE (no card resolved one) → the cards YIELD this position.
                The Question node states it ONCE instead (`DecisionNode`), which
                is where a fact about the whole run belongs.

            ⚠ YIELDING IS NOT SILENCE, AND THAT DISTINCTION IS LOAD-BEARING —
            the sibling `n_valid === 0` block twenty lines above argues,
            correctly, that "silence in a row of bars reads as a rendering gap".
            It is not silenced here; it is MOVED to the one surface that can say
            it once. Delete the DecisionNode statement and this becomes the
            rendering gap that comment warns about.

            ⛔ The copy no longer opens with the missing quantity's name. It
            conditions on the data ("On the data so far…"), because what this
            run produced is a fact about this run and not a property of the
            option.

            ⭐⭐ AND IT NOW YIELDS TO `leftOutOfRunReason` TOO — a THIRD conjunct,
            stated here rather than left to be inferred from the gate.

            This line's own subject is an option the run HAD and could not
            resolve a share for. An option the run never had is a different
            state with a different next step, and before the row above existed
            this line was the only thing said about it: one sentence pooling
            two absences, which is the defect the four-absence ruling exists to
            prevent. So the yield is not silence and it is not a move either —
            the sibling row above states the MORE SPECIFIC true sentence in the
            same position on the same card, and names the ground it rests on.

            ⚠ Deleting the row above turns this into the pooled sentence again,
            not into a rendering gap — which is why this conjunct must be read
            WITH it and never tidied away on its own. */}
        {resultUnavailableRenders && (
          <p
            className={`${typography.edgeLabel} text-text-light mt-1`}
            data-testid={`option-result-unavailable-${props.id}`}
          >
            On the data so far, the model gave no share of runs for this option
          </p>
        )}

        {/* Global influence identifies a factor to inspect, not why an option won. */}
        {isDetailed && isPostAnalysis && isRecommended && winsVia && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Factor to examine:{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={handleWinsViaClick}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {winsVia.label}
            </button>
          </p>
        )}

        {/* Graph v2 Task 4: close-call line — only when within 5pp of leader.
            Renders ABOVE the existing "Behind:" reason so users see both the
            closeness signal and the causal explanation.

            ⭐⭐ THE QUANTITY IS RETIRED (2026-08-10); THE SIGNAL IS NOT.
            This read "Close call: within N percentage points" — the
            percentage-point difference between two Monte-Carlo win
            frequencies, which is the banned statistic: less reliable than
            either estimate it is built from, yet printed as a bare integer
            with no interval. The tie-ness signal it carried is genuinely
            useful and stays, as a QUALITATIVE marker with no number.

            Naming the leading option is entitled here and nowhere borrowed:
            `closeCallGapPp` returns null unless `verdict.hasLeadingOption`,
            so this line cannot render on a turn where the producer withheld
            the designation. And the reader is not left without a number — the
            node states this option's OWN win probability directly above
            (`COMPARATIVE_COPY.phrase`), which is the statistic the ratified
            rule licenses. */}
        {isDetailed && closeCallGapPp != null && (
          <p className={`${typography.nodeLabel} text-text-body mt-0.5 m-0`}>
            {/* Model-relative, never a leader title (Codex #63 5801910965; ED 5799353114 decision 1). */}
            Close to the option most runs favour in this model
          </p>
        )}

        {/* "Held back by:" reason (not the most-supported option, post-analysis
            -- includes status quo) */}
        {isDetailed && isPostAnalysis && !isRecommended && behindReason && (
          <p className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}>
            Held back by: {behindReason}
          </p>
        )}

        {/* Status-quo bias coaching lives on the header ScienceIcon now — one
            bias-coaching surface per node (bias-coaching slice, proposal
            2026-07-16 §1.5(2)). useScienceIcons emits `status-quo-bias` for
            baseline options (pre- and post-analysis), and the ScienceIcon
            popover carries the "discuss with AI" turn the retired node-level
            BiasIcon twin used to provide. No second bias surface is mounted. */}

        {/* ⭐ THE ONE QUESTION, ON THE FACE OF THE CARD — the same treatment
            Risk, Outcome, Goal and (since #1591) Factor already get. The
            richer post-analysis cluster stays in the popover; this is the one
            that must be reachable without hovering.

            ⚠ It renders in BOTH views. The Detailed view's layer-2 carries the
            post-analysis chips, and `cardQuestion` is null there, so nothing
            doubles. */}
        {/* ⛔ NO COACHING CHIP ROW AT REST — the card's one question is the
            rail's coaching icon (`coaching` on BaseNode), costing no height
            (ED 02:31Z D4; ED 11:52Z point 4: "multiple rows … coaching text").
            Pre-analysis it asks this card's question; after a run it asks the
            cluster's first question and keeps its TYPED route
            (`what_would_flip`), never demoted to a generic discuss. */}

        {/* Post-analysis coaching chips live in the popover (Standard) /
            Detailed inline layer-2. See `optionChips` useMemo above and the
            popover branches at the bottom of this file. */}

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
            {/* ⭐ THE INSTRUCTION IS THE INVARIANT HALF, AND IT IS THE HALF
                THAT MOVED (Paul, 31 Aug 2026). Measured across three option
                siblings whose counts differ, this position read

                    Changes 1 factor  — open the inspector for targets
                    Changes 2 factors — open the inspector for targets
                    Changes 3 factors — open the inspector for targets

                — thirty-three characters of identical navigation guidance on
                every card in this state, on the narrowest card the starters
                produce, at a counter-scaled label size. The count is the only
                thing a reader learns here from the card.

                ⛔⛔ THE SENTENCE SURVIVES TWICE, AND THE FIRST CUT OF THIS
                CHANGE GOT IT WRONG — the identical mistake this file already
                records being found and fixed on 31 Aug, 250 lines up. Moving a
                clause to a bare `title` on a NON-FOCUSABLE `<p>` does not
                "move" it: a `title` is unreachable by keyboard here and absent
                on touch, so a clause that WAS announced (it was ordinary
                rendered text) simply stops being announced. Compaction may cost
                a sighted reader nothing and still be an accessibility
                REGRESSION, and nothing in the census can see it — the census
                excludes `title` and `sr-only` as "the destination", so it
                cannot tell *moved and kept for AT* from *moved only*.

                So this follows the win-anchor row above and the not-computed
                badge below, which is the settled pattern on this card:
                  · the `title`, for a pointer user on hover;
                  · an out-of-flow span, for keyboard and screen-reader users;
                  · the visible short form `aria-hidden`, so the line is
                    announced ONCE in full rather than as a compacted form
                    followed by a sentence repeating it.

                What compaction buys is SPACE for a sighted reader. It is not a
                licence to say less.

                ⚠⚠ AND A CLAIM I MADE ABOUT THIS CHANGE WAS FALSE: "no card
                changes height or width". Card height is MEASURED FROM THE DOM
                (`store.ts` → `measureNodeHeightsAtLabelBound()` →
                `layoutGraph`), and the comment 300 lines up records that a
                comparable sentence "wraps to two or three lines at the
                legibility floor". At the 230px minimum card width with
                `edgeLabel` counter-scaled to 20px, 49 characters occupy lines
                that 17 do not — so these edits CAN un-wrap a line and the card
                CAN get shorter.

                The DIRECTION is benign (cards shrink, ELK re-flows a shorter
                row) and nothing here grows a card. But the false version of the
                claim was doing work: it was the stated reason for deferring two
                other findings, and "it would change card height" is not a
                reason available to a change that already does. Both were
                re-adjudicated on their real grounds, which were never about
                height:

                  · `{Severity} Risk` — NOT this class. Only the noun ` Risk` is
                    invariant, and it is the word that says what "High" is high
                    ON. That is the CAPTION shape (`Ahead 47%`) written
                    backwards, and captions stay — the same rule that keeps
                    `Strength` on the card two lines above it.
                  · the differentiator — its sentence frame IS the caption for
                    the factor name it carries, and the frame is what makes the
                    name mean "the key one" rather than "another factor".
                    Deleting the line to stop it repeating a label would remove
                    the only statement of WHICH factor is key.

                Neither deferral rested on height once the reason was written
                down properly, which is the tell that the height claim was
                doing rhetorical rather than load-bearing work. */}
            {completeness && (
              <p
                className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}
                title={completeness.full}
                data-testid={`option-completeness-${props.id}`}
              >
                {/* Same two-carrier shape as the line above. `N of M factors`
                    is what a sighted reader needs; "specified for this option"
                    is what makes it a sentence, and it is not dropped. */}
                <span aria-hidden="true">{completeness.short}</span>
                <span className={typography.screenReaderOnly}>{completeness.full}</span>
              </p>
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
        
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view — hover, tap or keyboard focus) =====
          ⚠ THE PARENTHETICAL USED TO READ "(Standard view, hover)" AND THAT WAS
          THE WHOLE DEFECT IN FOUR WORDS. `usePopoverHover` now opens this on a
          tap and on keyboard focus as well; the comment is corrected here
          rather than left to teach the next reader that hover is the only
          door. */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {restingDetailInPreview}
          {layer2Content}
        </NodePopover>
      )}

      {/* Pre-analysis preview. Without a reference pair, Detailed mode also needs target recovery.
          It must not lose its preview merely because no before-value is known. */}
      {!isPostAnalysis && (!isDetailed || structuredDeltas.length === 0) && preAnalysisPopoverContent && (
        <NodePopover
          visible={showPopover}
          width={260}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {restingDetailInPreview}
          {preAnalysisPopoverContent}
        </NodePopover>
      )}
    </div>
  )
})

OptionNode.displayName = 'OptionNode'

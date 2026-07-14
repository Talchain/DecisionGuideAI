/**
 * PreAnalysisPanel - Pre-Analysis Results Tab Right Panel (Phase 2)
 *
 * Three-tier hierarchy structure:
 * 1. Header (with tier counts)
 * 2. Success Target section
 * 3. Must address tier
 * 4. Review assumptions tier
 * 5. Optional improvements tier (collapsed by default)
 * 6. Model Snapshot accordion
 * 7. Analysis Settings accordion
 * 8. Sticky Footer (pinned)
 *
 * Scrollable content area between header and sticky footer.
 * All data derives from existing graph state — no new backend endpoints.
 */

import { useCallback, useMemo, useRef, useEffect, memo } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { ModelHealthCard } from './ModelHealthCard'
import { SuccessTarget } from './SuccessTarget'
import { BlockersSection } from './BlockersSection'
import { OptionPreview } from './OptionPreview'
import { SharpenYourThinking } from './SharpenYourThinking'
import { AnalysisSettings } from './AnalysisSettings'
import { deriveExpertiseGroups } from './hooks/deriveExpertiseGroups'
import { StickyFooter } from './StickyFooter'
import { focusNodeById } from '../../utils/focusHelpers'
import { withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useRetryDraft } from '../../hooks/useRetryDraft'
import { SOFT_BYPASS_STATUSES } from '../../hooks/usePreRunValidation'
import { useShowToast } from '../../ToastContext'
import { copyTextToClipboard } from '../../../utils/clipboard'
import { RefreshCw, Copy, Pencil, AlertTriangle, Check, X, Frame, ShieldAlert, Gauge, Anchor, EyeOff, Link as LinkIcon } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { getCausalEdges } from '../../domain/edgeUtils'
import type { EdgeData } from '../../domain/edges'
import type { Edge } from '@xyflow/react'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { mapImprovementToTriageCard } from './mapImprovementToTriageCard'
import type { TriageCardItem } from './mapImprovementToTriageCard'
import { filterRedundantBlockers } from './filterRedundantBlockers'
import type { AiDiscussElement } from './buildAiDiscussPrompt'
import { DiscussWithAiButton } from './DiscussWithAiButton'
import {
  pickStartHere,
  BIAS_SEVERITY_SCORE,
  OPTION_QUALITY_SEVERITY,
  type ReviewNextSignal,
  type TriageSignal,
} from './pickStartHere'
import { useResolvedSignals } from './useResolvedSignals'
import { usePrefersReducedMotion } from '@/canvas/hooks/usePrefersReducedMotion'
import { typography } from '@/styles/typography'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { resolveEditorRawValue, resolveCapHintSubtitle } from './utils/resolveEditorRawValue'
import { decisionShapeScore } from './utils/decisionShapeScore'
import {
  buildStrengthenOverlayMap,
  findStrengthenOverlay,
  type StrengthenOverlay,
} from './utils/applyStrengthenOverlay'
import { buildPriorityProgress, type PriorityProgress } from './utils/buildPriorityProgress'
import { formatValueWithUnit } from '../../utils/formatValueWithUnit'
import { hasFeasibilityWarning } from './utils/hasFeasibilityWarning'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import { WhatOlumiAddedSection } from './WhatOlumiAddedSection'
// ValidationMetadata / UserAction / ResolvedValue were consumed by the
// removed handleResolveContestedEdge handler (Brief 4 Task 6).

/** AI source provenance labels */
const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred', 'ai_estimate', 'engine'])

/**
 * Icon + title lookup for CEE bias type strings.
 * Defined at module scope so the biasTriggers useMemo dependency array stays stable.
 *
 * Two key spaces are supported because CEE has two field conventions in flight:
 *   1. Lowercase `type` (existing CEEBiasFinding.type field) — anchoring,
 *      framing, confidence, confirmation, blind_spots
 *   2. Uppercase `code` (newer schema variant — AUTHORITY_BIAS, etc.) — these
 *      need explicit mapping per the brief.
 *
 * Any unrecognised key falls back to BIAS_FALLBACK (EyeOff) per the brief.
 */
const BIAS_TYPE_ICON: Record<string, { icon: typeof Frame; title: string }> = {
  // Lowercase type values (existing field convention)
  framing:           { icon: Frame,  title: 'Narrow framing' },
  framing_bias:      { icon: Frame,  title: 'Narrow framing' },
  narrow_framing:    { icon: Frame,  title: 'Narrow framing' },
  anchoring:         { icon: Anchor, title: 'Anchoring' },
  anchoring_bias:    { icon: Anchor, title: 'Anchoring' },
  confidence:        { icon: Gauge,  title: 'Overconfidence' },
  overconfidence:    { icon: Gauge,  title: 'Overconfidence' },
  optimism_bias:     { icon: Gauge,  title: 'Optimism bias' },
  blind_spots:       { icon: EyeOff, title: 'Blind spots' },
  status_quo_bias:   { icon: EyeOff, title: 'Status quo bias' },
  confirmation:      { icon: Frame,  title: 'Confirmation bias' },
  confirmation_bias: { icon: Frame,  title: 'Confirmation bias' },
  authority_bias:    { icon: Anchor, title: 'Authority bias' },
  availability_bias: { icon: Frame,  title: 'Availability bias' },
  sunk_cost:         { icon: Anchor, title: 'Sunk cost' },
  // Uppercase code values (newer schema)
  AUTHORITY_BIAS:    { icon: Anchor, title: 'Authority bias' },
  CONFIRMATION_BIAS: { icon: Gauge,  title: 'Confirmation bias' },
  SUNK_COST:         { icon: Anchor, title: 'Sunk cost' },
  NARROW_FRAMING:    { icon: Frame,  title: 'Narrow framing' },
  STATUS_QUO_BIAS:   { icon: EyeOff, title: 'Status quo bias' },
}

/**
 * Entity-ID prefixes that must NEVER appear in user-facing copy. If a CEE bug
 * passes a raw entity ID as a bias type token, fall through to BIAS_FALLBACK
 * rather than echoing it as a sentence-case label.
 *
 * Replicates the canonical CEE-side ENTITY_ID_RE pattern in
 *   olumi-assistants-service:src/orchestrator/shared/entity-id-pattern.ts
 *   (also mirrored at olumi-assistants-service:tools/v5-journey-replay/output-safety.ts
 *    as `\b(?:fac|opt|goal|dec|out|risk|con|factor|option|decision|outcome|constraint)[_:-]…/i`).
 *
 * The two sources are intentionally NOT cross-imported: the UI repo and CEE
 * service repo share no package boundary, and the CEE-side mirror file already
 * documents the same lockstep-replication pattern. Update both in lockstep
 * when the canonical pattern changes.
 *
 * `safeBiasTitle` already restricts the input character set to
 * [A-Za-z0-9_], so we only need the underscore-suffix variant here — the
 * canonical pattern's `[_:-]` separator is fully covered because `:` and `-`
 * are rejected by the character-class guard before this list is consulted.
 *
 * Plus two defensive UI-side prefixes (node_, edge_) for graph entities the
 * canvas owns directly; not in the CEE canonical list but worth guarding.
 */
export const FORBIDDEN_TYPE_PREFIXES = [
  // Canonical CEE entity-ID prefixes (lockstep with ENTITY_ID_RE)
  'fac_', 'opt_', 'goal_', 'dec_', 'out_', 'risk_',
  'con_', 'factor_', 'option_', 'decision_', 'outcome_', 'constraint_',
  // UI-side defensive prefixes
  'node_', 'edge_',
] as const

/**
 * Convert an unknown but safe-looking bias type token into a sentence-case label.
 * Returns null for empty / unsafe inputs so callers fall through to BIAS_FALLBACK.
 * Only allows alphanumerics + underscores, and rejects known entity-ID prefixes
 * so a malformed `type: "fac_price"` never renders as "Fac price".
 */
export function safeBiasTitle(token: string): string | null {
  if (!token) return null
  const safe = token.trim()
  if (!/^[A-Za-z0-9_]{1,40}$/.test(safe)) return null
  const lower = safe.toLowerCase()
  for (const prefix of FORBIDDEN_TYPE_PREFIXES) {
    if (lower.startsWith(prefix)) return null
  }
  const cleaned = lower.replace(/_/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/** Generic fallback for unrecognised bias codes per the brief. */
const BIAS_FALLBACK: { icon: typeof Frame; title: string } = {
  icon: EyeOff,
  title: 'Bias detected',
}

/** Truncate a long bias explanation to 80 chars; the full text remains in the title attribute. */
const BIAS_EXPLANATION_MAX = 80
function truncateExplanation(s: string): string {
  if (s.length <= BIAS_EXPLANATION_MAX) return s
  return s.slice(0, BIAS_EXPLANATION_MAX - 1).trimEnd() + '…'
}

/**
 * Build mouseEnter/mouseLeave handlers for a bias card whose target id has
 * already been resolved against the live graph. When `targetId` is null
 * (no target supplied, or the target did not resolve), returns no handlers
 * so hover is silently a no-op. Both handlers also clear edge highlights
 * to match the convention in the rest of PreAnalysisPanel — leaving any
 * card returns the canvas to a fully cleared highlight state.
 */
export function buildBiasHoverHandlers(
  targetId: string | null,
  setHighlightedNodes: (ids: string[]) => void,
  setHighlightedEdges: (ids: string[]) => void,
): { onMouseEnter?: () => void; onMouseLeave?: () => void } {
  if (!targetId) return {}
  return {
    onMouseEnter: () => {
      setHighlightedNodes([targetId])
      setHighlightedEdges([])
    },
    onMouseLeave: () => {
      setHighlightedNodes([])
      setHighlightedEdges([])
    },
  }
}

/**
 * Map a single CEE coaching.bias_signals[] entry to a NormalisedBiasTrigger.
 * Pure (no React dependencies) so it can be unit-tested independently of the
 * panel render tree. Returns null when the entry would not produce a useful
 * card (empty detail).
 */
export function mapDraftBiasSignalToTrigger(
  signal: { type: string; detail: string; target?: string },
  index: number,
  resolveLabel: (id: string) => string | null,
): NormalisedBiasTrigger | null {
  const explanation = signal.detail.trim()
  if (!explanation) return null
  const lookupKey = signal.type.toLowerCase()
  const matched = BIAS_TYPE_ICON[lookupKey] ?? BIAS_TYPE_ICON[signal.type]
  const safeTitle = matched ? null : safeBiasTitle(signal.type)
  const config = matched ?? (safeTitle ? { icon: BIAS_FALLBACK.icon, title: safeTitle } : BIAS_FALLBACK)
  const targetId = signal.target ?? null
  const targetLabel = targetId ? resolveLabel(targetId) : null
  return {
    id: `cee_signal_${index}`,
    icon: config.icon,
    title: config.title,
    subtitle: truncateExplanation(explanation),
    fullExplanation: explanation,
    severity: 'medium',
    microInterventionStep: null,
    targetFactorId: targetLabel ? targetId : null,
    targetFactorLabel: targetLabel ?? null,
  }
}

/** Severity rank for sorting CEE findings. Lower = higher priority. */
const BIAS_SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Brief 5.3 Task 5 / 5.7 D5: AUTHORITY_BIAS without a concrete `target_factor_id`
 * is meta-commentary, not an actionable signal. Suppress at the trigger builder
 * so neither the start-here variant nor the Review-next variant ever renders
 * this case. Other bias kinds remain unaffected — they may legitimately fire
 * without a target factor.
 *
 * Exported for unit testing.
 */
export function shouldSuppressBiasFinding(
  finding: { code?: string; type?: string; target_factor_id?: string },
): boolean {
  const code = (finding.code ?? finding.type ?? '').toString().toLowerCase()
  const isAuthority = code === 'authority_bias' || code === 'authoritybias'
  // Trim before existence check so whitespace-only ids (e.g. "   ") are
  // treated as absent. Without this, `normaliseCeeBiasFinding` would still
  // catch the case via its own resolver/trim, but the predicate's contract
  // would disagree with the downstream behaviour.
  const hasTarget = (finding.target_factor_id ?? '').trim().length > 0
  return isAuthority && !hasTarget
}

/**
 * Brief 5.8A D2: single normalisation gate applied to LLM-sourced bias entries
 * before they enter the rendered trigger list. Both shapes flow through the
 * same predicate so D3c (T1 nudge rows) and D5 (T2 Sharpen accordion) consume
 * one already-filtered list — no per-consumer refilter.
 *
 * Accepts the raw target field from either shape:
 *   - CEE bias_findings → `target_factor_id`
 *   - CEE coaching bias_signals → `target`
 *
 * Returns true iff the target is non-blank AND resolves to a real graph node
 * via the supplied resolver. The resolver returns null when no node matches,
 * so we treat both null and blank-label results as "unresolvable".
 *
 * Behaviour change vs prior behaviour: bias_findings without a target (or with
 * an unresolvable one) used to render generically. After D2 they are dropped,
 * matching the brief's intent that on-screen bias copy must always anchor to
 * an actionable factor. The deterministic graph-level fallback (narrow_framing,
 * missing_risks, etc.) is intentionally outside this gate — it runs only when
 * no LLM source produced anything and surfaces graph-derived nudges that have
 * no target node by design.
 *
 * Exported for unit testing.
 */
export function hasResolvableBiasTarget(
  rawTarget: string | null | undefined,
  resolveLabel: (id: string) => string | null,
): boolean {
  const trimmed = (rawTarget ?? '').toString().trim()
  if (!trimmed) return false
  const label = resolveLabel(trimmed)
  return typeof label === 'string' && label.trim().length > 0
}

/**
 * Brief 5.7 D7: AI-estimated improvement items should already carry a confirm
 * action from `usePreAnalysisData` (the cee_inference branch attaches one).
 * Augment defensively — symmetric with the missing-data path — so any item
 * that arrives without an action still renders the Confirm chip plus the
 * inline editor (mapItem attaches editorConfig when action.kind === 'confirm'
 * and focus.id is present).
 *
 * Items already carrying an `action` pass through unchanged. Items lacking a
 * focus.id pass through unchanged (no valid target to confirm against).
 *
 * Exported for unit testing.
 */
export function augmentAiEstimatedItemWithConfirm<
  T extends { action?: unknown; focus?: { id?: string; type?: string; label?: string } | null },
>(item: T): T {
  if (item.action) return item
  if (!item.focus?.id) return item
  return {
    ...item,
    action: { kind: 'confirm' as const, label: 'Confirm', targetId: item.focus.id, targetType: 'node' as const },
  }
}

/**
 * Permissive shape for CEE bias findings. The CEEBiasFinding TypeScript type
 * lags the runtime shape — newer CEE responses include `code`, `explanation`,
 * `category`, and `micro_intervention` fields that are not in the type. We
 * read both old and new field names so the panel works whether or not CEE
 * has migrated.
 */
type RawBiasFinding = {
  id?: string
  type?: string
  code?: string
  category?: string
  severity?: string
  description?: string
  explanation?: string
  citation?: string
  target_factor_id?: string
  interventions?: Array<{ description?: string; [k: string]: unknown }>
  micro_intervention?: { steps?: Array<{ text?: string; [k: string]: unknown }>; [k: string]: unknown }
}

export interface NormalisedBiasTrigger {
  id: string
  icon: typeof Frame
  title: string
  subtitle: string
  fullExplanation: string
  severity: string
  /** First step text from micro_intervention.steps, when present. Enriches the sparkle prompt
   *  with a specific debiasing technique (unified spec §3.3: sparkle only, no text pills). */
  microInterventionStep: string | null
  /** Brief 5.7 D5 follow-up: when the finding carried a `target_factor_id`
   *  AND the id resolved to a graph node, propagate both the id and the
   *  resolved label so the render layer can name the target factor. When the
   *  id is present but does not resolve to any graph node, the trigger is
   *  suppressed (returns null) — a target we cannot name is no better than
   *  the original generic meta-commentary. */
  targetFactorId: string | null
  targetFactorLabel: string | null
}

/**
 * Resolves a CEE bias finding into a render-ready trigger.
 *
 * Brief 5.7 follow-up: takes a `resolveLabel(id) → label | null` resolver so
 * the target_factor_id can be looked up against the live graph. The resolver
 * lives in component scope and reads the current `nodes` array.
 *
 * Suppression rules:
 *   - finding has neither `explanation` nor `description` → null
 *   - finding has a `target_factor_id` BUT the resolver returns null → null
 *     (we cannot honestly name the target, so do not render the card)
 */
export function normaliseCeeBiasFinding(
  raw: RawBiasFinding,
  idx: number,
  resolveLabel: (id: string) => string | null,
): NormalisedBiasTrigger | null {
  // Lookup key: prefer uppercase `code`, fall back to lowercase `type`.
  const lookupKey = raw.code || raw.type || ''
  const config = BIAS_TYPE_ICON[lookupKey] ?? BIAS_FALLBACK

  // Subtitle text: prefer `explanation` (newer schema), fall back to `description`.
  const fullExplanation = (raw.explanation || raw.description || '').trim()
  if (!fullExplanation) return null

  // Resolve the target factor when the finding identifies one. An unresolvable
  // id, or a resolver that returns a blank label, is treated as "no target"
  // and the card is suppressed below — we never want to render targeting copy
  // that points at nothing.
  const rawTargetId = (raw.target_factor_id ?? '').trim()
  const resolvedLabelRaw = rawTargetId ? resolveLabel(rawTargetId) : null
  const targetFactorLabel = resolvedLabelRaw && resolvedLabelRaw.trim()
    ? resolvedLabelRaw.trim()
    : null
  if (rawTargetId && !targetFactorLabel) return null

  // micro_intervention.steps[0].text is the new schema; fall back to first
  // entry in `interventions[].description` (existing schema).
  const microStep =
    raw.micro_intervention?.steps?.[0]?.text
    ?? raw.interventions?.[0]?.description
    ?? null

  // Stable id: prefer raw.id, then the lookup key, then the array index.
  // Parenthesised explicitly because mixing ?? and || in the same expression
  // is a TypeScript syntax error.
  const stableId = raw.id ?? (lookupKey || String(idx))

  // When a resolved target is available, the factor name lives in the
  // subtitle's targeting sentence rather than being folded into the title
  // as well. This mirrors the brief D5 example copy ("Watch for authority
  // bias on [Factor Name]. <reason>") and avoids the visual redundancy of
  // showing the factor name twice in the same card. Title stays as the
  // canonical bias type so sparkle prompts and other consumers see a clean
  // category label rather than a sentence fragment.
  const subtitleBase = truncateExplanation(fullExplanation)
  const subtitle = targetFactorLabel
    ? `Watch for ${config.title.toLowerCase()} on ${targetFactorLabel}. ${subtitleBase}`
    : subtitleBase

  return {
    id: `cee_bias_${stableId}`,
    icon: config.icon,
    title: config.title,
    subtitle,
    fullExplanation,
    severity: raw.severity ?? 'medium',
    microInterventionStep: microStep ?? null,
    targetFactorId: rawTargetId || null,
    targetFactorLabel: targetFactorLabel ?? null,
  }
}

// Brief 5.8A holistic-review pass: legacy TriageCheckRow deleted. The
// T1FailingCheckRow function above now owns the same icon + label + action
// pattern inside the T1 card.

interface PreAnalysisPanelProps {
  /** Callback when user clicks the primary action button */
  onAnalyse: () => void
  /** Whether analysis is currently running */
  isAnalysing?: boolean
  /** Shared blocked reason for the Analyse CTA */
  blockedReason?: string
  /** Callback to send a message in the conversation panel */
  onSendMessage?: (text: string) => void
  /**
   * Expert mode toggle from OutputsDock (`</>` button in the tab bar).
   * When true, developer-facing diagnostics (correlation IDs, copy-diagnostics
   * button, raw error payloads) render in the panel. Off by default so the
   * failure state stays user-friendly.
   */
  expertMode?: boolean
}


/**
 * Top status banner — single source of truth for panel state.
 *
 * Two render paths:
 *   1. failed — analysis failure (lastDraftError). Renders unchanged with
 *      retry affordance. This is a separate concern from the canonical
 *      `deriveAnalysisDisplayState` mapping (which models pre-run / done
 *      / stale states) and is preserved here.
 *   2. helper-driven — every other case consumes `useAnalysisDisplayState`
 *      so the headline + icon + colour exactly match the rest of the UI
 *      (InputsDock empty-state, debug bundle, etc.). Bucket counts from
 *      `usePreAnalysisData` (mustFix / reviewNext) flow in as a sub-line
 *      below the headline so the user still sees the specific number of
 *      items to address.
 *
 * In failed state, content below is de-emphasised by the parent (opacity 0.6)
 * except the error detail/retry. The banner does not show "Ready" alongside
 * a failure.
 */
type BannerState =
  | { kind: 'failed'; canRetry: boolean }
  | { kind: 'derived'; mustFixCount: number; reviewNextCount: number }

// Brief 5.8B D0 #1: HELPER_ICON_MAP, bucketSubLine, useAnalysisDisplayState,
// AnalysisDisplayStateView, and the Play/AlertCircle lucide imports were
// all dead after the non-failed StatusBanner branch was removed. Deleted.

function StatusBanner({
  state,
  onRetry,
  isRetrying,
}: {
  state: BannerState
  onRetry?: () => void
  isRetrying?: boolean
}) {
  // Brief 5.8B D0 #1 — non-failed StatusBanner removed. The readiness ring
  // (T1 ModelHealthCard), failing-check rows, and unified triage queue
  // already convey ready/blocked/etc. state inside the T1 card. The orphan
  // banner above T1 was duplicative. Only the failed-state recovery
  // affordance survives — it carries unique information (retry action) the
  // rest of the panel does not.
  if (state.kind !== 'failed') return null

  const text = state.canRetry
    ? 'Analysis failed. Your model is intact. Retry or review the issue below.'
    : 'Analysis failed. Your model is intact. Review the issue below.'
  return (
    <div
      className="flex items-start gap-2 py-2"
      role="status"
      data-testid="pre-analysis-status-banner"
    >
      <AlertTriangle
        size={16}
        className="mt-0.5 text-danger flex-shrink-0"
        aria-hidden="true"
      />
      <p className={`${typography.panelBody} text-text-body flex-1`}>{text}</p>
      {state.canRetry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover disabled:opacity-50 cursor-pointer`}
          data-testid="status-banner-retry"
        >
          <RefreshCw size={11} className={isRetrying ? 'animate-spin' : ''} />
          {isRetrying ? 'Retrying' : 'Retry'}
        </button>
      )}
    </div>
  )
}

// SectionHeader is imported from @/components/results/SectionHeader (shared component, unified spec §2.1).

/**
 * Brief 5.8A D3c — single bias .nudge row inside the T1 card.
 *
 * Inline single-line pattern: warning icon + bolded category + detail + an
 * Explore chip that routes the bias context to chat. Hover hooks highlight
 * the target node when a resolvable target exists (always true for D2-
 * filtered triggers).
 */
function T1BiasNudgeRow({
  trigger,
  index,
  onHoverEnter,
  onHoverLeave,
}: {
  trigger: NormalisedBiasTrigger
  /**
   * Local visible index used for the data-testid. We deliberately do NOT
   * use trigger.id because CEE can stamp raw.id with values that contain
   * factor / option / node prefixes — which would leak into the DOM via
   * the testid attribute. Using a local 0-based index keeps the testid
   * stable and prefix-free.
   */
  index: number
  onHoverEnter?: () => void
  onHoverLeave?: () => void
}) {
  const Icon = trigger.icon
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 border border-panel-border rounded-lg hover:bg-panel-hover"
      data-testid={`t1-bias-nudge-${index}`}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <Icon className="w-3.5 h-3.5 text-warning flex-shrink-0" aria-hidden="true" />
      <p className={`${typography.panelMeta} text-text-body flex-1 min-w-0 truncate`}>
        <strong className="text-text-header font-semibold">{trigger.title}:</strong>{' '}
        {trigger.subtitle}
      </p>
      <DiscussWithAiButton
        element={{ kind: 'bias', biasType: trigger.title, microInterventionStep: trigger.microInterventionStep }}
      />
    </div>
  )
}

/**
 * Pre-analysis-power-v1 Task 5 — single-segment priority-confirmation row.
 *
 * REPLACES (does not supplement) the previous three-segment contribution bar
 * that ran over ALL factor nodes via `buildContributionBreakdown`. The new
 * derivation reflects ONLY the top-3 priority-list confirmation state, so
 * the visible denominator matches the visible item list and the two
 * counters in the panel can no longer disagree.
 *
 * Confirmation predicate: `isReviewedByUser` from
 * `./utils/isReviewedByUser`, the same predicate that powers the existing
 * `reviewedFactorsCount` derivation in `usePreAnalysisData`.
 */
function T1ContributionRow({ progress }: { progress: PriorityProgress }) {
  const { confirmed, total } = progress
  const confirmedPct = total === 0 ? 0 : (confirmed / total) * 100
  return (
    <div className="flex flex-col gap-1" data-testid="t1-contribution-row">
      <div className="flex items-center gap-2">
        <span className={`${typography.panelMeta} text-text-light flex-1`}>
          First pass confidence: <strong className="text-text-body font-medium">{confirmed}</strong> of{' '}
          <strong className="text-text-body font-medium">{total}</strong> priority assumptions confirmed.
        </span>
      </div>
      {/* Single-segment bar — empty at zero (no misleading partial fill), fills
          as the user confirms priority items. Track uses the
          `bg-track-neutral` design-system token (defined in
          `src/styles/brand.css` as `--track-neutral`), which reads as a
          clearly neutral container outline against light panels. */}
      <div
        className="flex h-1.5 w-full rounded-full overflow-hidden bg-track-neutral"
        role="img"
        aria-label={`${confirmed} of ${total} priority assumptions confirmed`}
        data-testid="t1-contribution-spectrum"
      >
        {confirmed > 0 && <span className="bg-success" style={{ width: `${confirmedPct}%` }} />}
      </div>
    </div>
  )
}

/**
 * Brief 5.8A D3a (post-D7 holistic-review pass) — single failing-check row
 * inside the T1 card.
 *
 * Pattern: 12px danger X icon + label + right-aligned action link. Used for
 * the goal-target-unset check, the "Fewer than 2 options" structural check,
 * the "No baseline set" structural check, and any other binary-failure
 * structural rows. Each consumer supplies its own action handler.
 *
 * Action button is keyboard-focusable with the standard info ring; aria-label
 * mirrors the actionLabel so screen readers receive the action context.
 */
function T1FailingCheckRow({
  label,
  actionLabel,
  onAction,
  testId,
}: {
  label: string
  actionLabel: string
  onAction: () => void
  testId?: string
}) {
  return (
    <div className="flex items-center gap-2 py-0.5" data-testid={testId}>
      <X className="w-3 h-3 text-danger flex-shrink-0" aria-hidden="true" />
      <span className={`${typography.panelBody} text-text-body flex-1`}>{label}</span>
      <button
        type="button"
        onClick={onAction}
        className={`${typography.panelMeta} text-info hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
        aria-label={actionLabel}
      >
        {actionLabel}
      </button>
    </div>
  )
}

/**
 * Brief 5.8A holistic-review pass — failing-check row entry shape consumed
 * by T1DecisionReadinessCard. Source-agnostic so the consumer can compose
 * goal-target rows, structural-check rows, and any future failure rows
 * through the same render.
 */
interface T1FailingCheckEntry {
  id: string
  label: string
  actionLabel: string
  onAction: () => void
  testId: string
}

/**
 * Brief 5.8A D3a/D3b — T1 "Decision readiness" card wrapper.
 *
 * Hosts the ring + 4 dimension bars (ModelHealthCard compact), failing checks
 * (currently no_target), the narrative bridge with strong-bolded counts, and
 * the unified triage queue (top 3 + Also consider). D3c will add bias
 * nudges, widening_log, contribution, and checks footer below.
 *
 * Memoised — the parent re-renders on hover/highlight changes; this card's
 * inputs are stable across those.
 */
/**
 * Card shape after mapItem augmentation — adds the editorConfig (inline editor
 * config from Brief 5.7 D7, locked) and the aiDiscuss element (the per-card
 * Discuss-with-AI affordance). Local to the T1 panel because mapItem is a
 * render-local function in the consumer.
 */
type MappedTriageCard = TriageCardItem & {
  editorConfig?: ScientificEditorProps | null
  aiDiscuss?: AiDiscussElement
}

type UnifiedQueueEntryProp = { card: MappedTriageCard; overlay: StrengthenOverlay | null }

interface T1Handlers {
  onConfirm: (targetId: string) => void
  onEdit: (targetId: string) => void
  onUpdateEdgeStrength: (edgeId: string, value: number) => void
  onHoverEnter: (type: 'node' | 'edge', id: string) => void
  onHoverLeave: () => void
  buildAiDiscuss: (entry: UnifiedQueueEntryProp) => React.ReactNode
  /** Brief 5.8A D3c — wraps the bias node-id hover into the panel hover system */
  onBiasHoverEnter: (targetFactorId: string | null) => void
  onBiasHoverLeave: () => void
}

// Pre-analysis-power-v1 Task 6 — disclosure verb override for the pre-analysis
// panel's TriageCard call-sites. ExpandableCoachingText's default
// ("More" / "Less") is preserved for the post-analysis DriversSection.
const PRE_ANALYSIS_DISCLOSURE_LABELS = { more: 'Show more', less: 'Show less' } as const

const BIAS_NUDGE_VISIBLE_LIMIT = 2

const T1DecisionReadinessCard = memo(function T1DecisionReadinessCard({
  completeness,
  evidence,
  balance,
  calibration,
  optionCount,
  goalLabel,
  coachingSummary,
  dynamicHeadline,
  isLoading,
  hasGoalNode,
  hasGoalTarget,
  failingChecks,
  topThree,
  alsoConsider,
  handlers,
  biasNudges,
  priorityProgress,
  onShowAllBias,
  wideningSlot,
  missingKnowledgeSlot,
}: {
  completeness: number
  evidence: number
  balance: number
  calibration: number
  optionCount: number
  goalLabel: string | null
  coachingSummary: string | null
  dynamicHeadline: string | null
  isLoading: boolean
  hasGoalNode: boolean
  hasGoalTarget: boolean
  /**
   * All currently-failing structural checks: goal target unset, "Fewer than 2
   * options", "No baseline set", etc. The brief D3a consolidates these into
   * the T1 failing-checks block. Order is consumer-controlled.
   */
  failingChecks: T1FailingCheckEntry[]
  topThree: UnifiedQueueEntryProp[]
  alsoConsider: UnifiedQueueEntryProp[]
  handlers: T1Handlers
  /** Brief 5.8A D3c — bias triggers from the D2-filtered list (single source) */
  biasNudges: NormalisedBiasTrigger[]
  /** Pre-analysis-power-v1 Task 5 — top-3 priority confirmation counter (replaces the legacy three-bucket contribution breakdown). */
  priorityProgress: PriorityProgress
  /** Action when the "+N more" link is clicked (expand or scroll) */
  onShowAllBias?: () => void
  /** Brief 5.8A D3c — WhatOlumiAddedSection rendered as a slot so the card stays composable */
  wideningSlot: React.ReactNode
  /** Brief 5.8A D3c — MissingKnowledgePrompt slot for the checks footer */
  missingKnowledgeSlot: React.ReactNode
}) {
  // Narrative-bridge derivation removed in pre-analysis-power-v1: the
  // priority-list header is now a static reframe ("Strengthen this model
  // before analysis") gated on showTopThree only. buildNarrativeBridge is
  // retained as a util in case a future workstream reuses it.
  const showFailingChecks = failingChecks.length > 0
  const showTopThree = topThree.length > 0
  const showAlsoConsider = alsoConsider.length > 0
  const visibleBias = biasNudges.slice(0, BIAS_NUDGE_VISIBLE_LIMIT)
  const overflowBias = Math.max(0, biasNudges.length - BIAS_NUDGE_VISIBLE_LIMIT)
  const showBiasBlock = visibleBias.length > 0
  const showContribution = priorityProgress.total > 0
  // Pre-analysis-power-v1 out-of-brief decision: the legacy "0/N verified"
  // counter inside the checks footer is a duplicate of the top
  // priority-progress counter (same trust-leak family the brief targets).
  // The footer now only renders when a missingKnowledgeSlot is supplied.
  const showChecksFooter = missingKnowledgeSlot != null

  return (
    <div
      className="bg-panel border border-panel-border rounded-[12px] p-3 flex flex-col gap-1.5"
      data-testid="t1-decision-readiness-card"
    >
      <ModelHealthCard
        compact
        completeness={completeness}
        evidence={evidence}
        balance={balance}
        calibration={calibration}
        optionCount={optionCount}
        goalLabel={goalLabel}
        coachingSummary={coachingSummary}
        dynamicHeadline={dynamicHeadline}
        isLoading={isLoading}
        hasGoalNode={hasGoalNode}
      />
      {showFailingChecks && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          <div className="flex flex-col" data-testid="t1-failing-checks">
            {failingChecks.map(check => (
              <T1FailingCheckRow
                key={check.id}
                label={check.label}
                actionLabel={check.actionLabel}
                onAction={check.onAction}
                testId={check.testId}
              />
            ))}
          </div>
        </>
      )}
      {showTopThree && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          <div className="flex flex-col gap-0.5" data-testid="t1-narrative-bridge">
            <p className={`${typography.panelHeader} text-text-header`}>
              Strengthen this model before analysis
            </p>
            <p className={`${typography.panelBody} text-text-light`}>
              You can run a first pass now, but confirming the priority assumptions below will make the result more trustworthy.
            </p>
          </div>
        </>
      )}
      {showTopThree && (
        <div className="flex flex-col gap-2" data-testid="t1-triage-top-three">
          {topThree.map((entry, i) => {
            const passiveLabels = entry.overlay?.actionTypeLabel ? [entry.overlay.actionTypeLabel] : undefined
            const subtitle = entry.overlay?.detail ?? entry.card.subtitle
            // Card #1 gets the .ac.em emphasis treatment: info-bordered + info-tinted background.
            const emphasised = i === 0
            return (
              <div
                key={entry.card.key}
                className={emphasised ? 'rounded-[10px] border border-info/50 border-l-[3px] border-l-info bg-info/[0.02]' : ''}
                data-testid={emphasised ? 't1-triage-emphasised' : undefined}
              >
                <TriageCard
                  cardKey={entry.card.key}
                  ordinal={i + 1}
                  badgeColor="bg-info"
                  title={entry.card.title}
                  detail={entry.card.detail}
                  subtitle={subtitle}
                  category={entry.card.category}
                  influence={entry.card.influence}
                  action={entry.card.action}
                  editorConfig={entry.card.editorConfig ?? null}
                  sourcePill={entry.card.sourcePill}
                  passiveLabels={passiveLabels}
                  aiDiscussSlot={handlers.buildAiDiscuss(entry)}
                  disclosureLabels={PRE_ANALYSIS_DISCLOSURE_LABELS}
                  onConfirm={handlers.onConfirm}
                  onEdit={handlers.onEdit}
                  onUpdateEdgeStrength={handlers.onUpdateEdgeStrength}
                  onHoverEnter={handlers.onHoverEnter}
                  onHoverLeave={handlers.onHoverLeave}
                />
              </div>
            )
          })}
        </div>
      )}
      {showAlsoConsider && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          <div className="flex flex-col gap-1" data-testid="t1-also-consider">
            <p className={`text-[10px] font-semibold text-text-light`}>Also consider</p>
            <div className="flex flex-col">
              {alsoConsider.map((entry) => {
                const subtitle = entry.overlay?.detail ?? entry.card.subtitle
                return (
                  <TriageCard
                    key={entry.card.key}
                    cardKey={entry.card.key}
                    title={entry.card.title}
                    detail={entry.card.detail}
                    subtitle={subtitle}
                    category={entry.card.category}
                    influence={entry.card.influence}
                    action={entry.card.action}
                    editorConfig={entry.card.editorConfig ?? null}
                    sourcePill={entry.card.sourcePill}
                    aiDiscussSlot={handlers.buildAiDiscuss(entry)}
                    disclosureLabels={PRE_ANALYSIS_DISCLOSURE_LABELS}
                    variant="compact"
                    onConfirm={handlers.onConfirm}
                    onEdit={handlers.onEdit}
                    onUpdateEdgeStrength={handlers.onUpdateEdgeStrength}
                    onHoverEnter={handlers.onHoverEnter}
                    onHoverLeave={handlers.onHoverLeave}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
      {showBiasBlock && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          <div className="flex flex-col gap-1" data-testid="t1-bias-block">
            {visibleBias.map((trigger, i) => (
              <T1BiasNudgeRow
                key={trigger.id}
                trigger={trigger}
                index={i}
                onHoverEnter={() => handlers.onBiasHoverEnter(trigger.targetFactorId)}
                onHoverLeave={handlers.onBiasHoverLeave}
              />
            ))}
            {overflowBias > 0 && onShowAllBias && (
              <button
                type="button"
                onClick={onShowAllBias}
                className={`${typography.panelMeta} text-info hover:underline self-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
                data-testid="t1-bias-show-more"
              >
                +{overflowBias} more
              </button>
            )}
          </div>
        </>
      )}
      {wideningSlot && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          {wideningSlot}
        </>
      )}
      {showContribution && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          <T1ContributionRow progress={priorityProgress} />
        </>
      )}
      {showChecksFooter && (
        <>
          <div className="border-t border-panel-border" role="separator" aria-hidden="true" />
          {/* Post-deploy fix: the prior `flex justify-end` + `flex-shrink-0`
              wrapper pushed the missing-knowledge prompt (≈450px of copy)
              off the left edge of the 353-wide panel. With only one child
              now (legacy "N/M verified" counter removed) the wrapper is
              unnecessary — let the slot fill the panel width and wrap. */}
          <div className="min-w-0" data-testid="t1-checks-footer">
            {missingKnowledgeSlot}
          </div>
        </>
      )}
    </div>
  )
})

// Brief 5.8A holistic-review pass: ImproveConfidenceAccordion deleted.
// SuccessTarget moved into T3 Advanced; MissingKnowledgePrompt is rendered
// inside the T1 checks footer via the missingKnowledgeSlot prop. The panel
// hierarchy is now exactly T1 → T2 → T3 with no orphan accordion.

export function PreAnalysisPanel({
  onAnalyse,
  isAnalysing = false,
  blockedReason,
  onSendMessage,
  expertMode = false,
}: PreAnalysisPanelProps) {
  // Get all panel data from hook (includes derived progress counts)
  const data = usePreAnalysisData()

  // P1-8: local toggle for review-tier "Show more". Overflow stays inside
  // review-tier (does not migrate to improve-confidence-tier); this controls
  // visibility within the section.

  // P1-5: prefers-reduced-motion flag — used to skip the fade transition on
  // resolved-state rows for users who requested reduced motion.
  const prefersReducedMotion = usePrefersReducedMotion()

  // Task P.3.2: Get node and edge counts for minimal graph coaching
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const isMinimalGraph = (nodes?.length ?? 0) < 3 || (edges?.length ?? 0) < 2

  // Retry draft hook — for re-running CEE when blocked due to LLM omission
  const { retryDraft, canRetry, isRetrying } = useRetryDraft()
  const showToast = useShowToast()

  // Detect retry-eligible state: blocked + CEE status indicates LLM omission
  const ceeStatus = useCanvasStore(s => s.ceeAnalysisReady?.status)
  const canRetryDraft = canRetry && !data.isReady && !!ceeStatus && SOFT_BYPASS_STATUSES.has(ceeStatus)

  // Draft error state for error card
  const lastDraftError = useDraftStore(s => s.lastDraftError)

  // Run error code (e.g. MISSING_INTERVENTIONS from V2 run) — surfaced by
  // OutputsDock's coached-recovery banner. Used to suppress Must fix blockers
  // whose message is already carried by that banner (UI-BUG-2).
  const runErrorCode = useCanvasStore(s => s.results?.error?.code ?? null)

  // CEE analysis ready for feasibility + constraints
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // CEE coaching payload (build a555cf7b+) — strengthen items, bias signals, etc.
  const draftCoachingBiasSignals = useCanvasStore(s => s.draftCoaching?.biasSignals ?? null)

  // Constraint feasibility warning — from CEE model_critiques (shared helper)
  const hasConstraintFeasibilityWarning = useMemo(
    () => hasFeasibilityWarning(ceeAnalysisReady?.model_critiques),
    [ceeAnalysisReady],
  )


  // Phase 2B: One-click fix — "Set value" opens the inspector for a factor (non-destructive)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const handleSetValueForGap = useCallback((factorId: string) => {
    // Note: FIX_CLICKED is also fired in GapRow.handleClick; PreAnalysisPanel is the
    // logical orchestrator so we skip double-firing here.
    // Select the factor node to open inspector — non-destructive, no undo needed
    selectNodeWithoutHistory(factorId)
    focusNodeById(factorId)
  }, [selectNodeWithoutHistory])

  // Retry handler with toast feedback
  const handleRetryDraft = useCallback(async () => {
    const result = await retryDraft()
    if (result.success) {
      showToast('Draft refreshed. Check readiness.', 'success')
    } else {
      showToast(result.error || 'Draft retry failed', 'error')
    }
  }, [retryDraft, showToast])

  // Edit brief handler — opens DraftChat for re-phrasing
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const handleEditBrief = useCallback(() => {
    setShowDraftChat(true)
  }, [setShowDraftChat])

  // Focus handlers - wire to canvas focus helpers
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)

  const handleFocusNode = useCallback((nodeId: string) => {
    selectNodeWithoutHistory(nodeId)
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes, selectNodeWithoutHistory])

  // Brief 5.8A D3a — failing-check action for "Goal target not set". Focuses
  // the goal node so the user can set its threshold via the inspector. Reuses
  // the existing focus helper rather than introducing a new dispatcher.
  const handleSetTargetFocus = useCallback(() => {
    const goalId = data.goalNode?.id
    if (!goalId) return
    selectNodeWithoutHistory(goalId)
    focusNodeById(goalId)
  }, [data.goalNode, selectNodeWithoutHistory])

  // Brief 5.8A D3b — bundle of handlers passed into T1DecisionReadinessCard.
  // Stable reference (the underlying callbacks are useCallback'd or stable
  // store references) so the memoised T1 component does not re-render on
  // unrelated parent renders. Exposed as one object to keep the prop list
  // manageable.
  // Forward-declared because the handler implementations are defined later
  // in this file; we wire them into the bundle via a useMemo so React only
  // creates the object when one of the inputs changes.

  // Hover handlers - highlight graph elements on panel item hover
  const handleHoverElement = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'node') {
      setHighlightedNodes([id])
      setHighlightedEdges([])
    } else {
      setHighlightedEdges([id])
      setHighlightedNodes([])
    }
  }, [setHighlightedNodes, setHighlightedEdges])

  const handleHoverClear = useCallback(() => {
    setHighlightedNodes([])
    setHighlightedEdges([])
  }, [setHighlightedNodes, setHighlightedEdges])

  // Goal change handler - update both ceeAnalysisReady AND outcomeNodeId for run pipeline
  const handleGoalChange = useCallback((goalId: string) => {
    const { ceeAnalysisReady, setCeeAnalysisReady, setOutcomeNode } = useCanvasStore.getState()

    // P0-1 (external review 2026-07-14): switching the selected goal must not let
    // the previous goal's target or normalisation cap ride the new goal.
    // Rebuild readiness for the new goal WITHOUT the previous goal's
    // goal_threshold_cap (undefined → the run path re-derives the cap from the
    // new goal's own node). Do this BEFORE the threshold re-derive below: the
    // readiness write's bare-sync only fires when the store scalar is null, so
    // running it while the stale scalar is still non-null stops it re-adopting
    // the previous goal's value.
    if (ceeAnalysisReady) {
      setCeeAnalysisReady({ ...ceeAnalysisReady, goal_node_id: goalId, goal_threshold_cap: undefined })
    } else {
      // Create minimal ceeAnalysisReady with the selected goal
      // options: [] is required by type - run pipeline uses outcomeNodeId anyway
      setCeeAnalysisReady({
        status: undefined,
        goal_node_id: goalId,
        options: [],
      })
    }

    // Update outcomeNodeId for the run pipeline (useV2Run reads this) AND
    // re-derive the global threshold scalar from the newly-selected goal node —
    // adopts B's own user target, or clears A's stale one.
    setOutcomeNode(goalId, { rederiveThreshold: true })
  }, [])

  // Threshold change handler - update both goal node data AND goalThreshold store field
  const handleThresholdChange = useCallback((value: number | null) => {
    const { setGoalThresholdAndUpdateNode, setGoalThreshold } = useCanvasStore.getState()
    const goalNode = data.goalNode
    if (goalNode) {
      setGoalThresholdAndUpdateNode(goalNode.id, value)
    } else {
      setGoalThreshold(value)
    }
  }, [data.goalNode])

  // Threshold confirm handler - mark threshold as confirmed in goal node
  const handleThresholdConfirm = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: true,
        },
      })
    }
  }, [data.goalNode])

  // Threshold edit handler - clear confirmed status
  const handleThresholdEdit = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: false,
        },
      })
    }
  }, [data.goalNode])

  // Contested-edge resolve handler removed in Brief 4 Task 6 dead-code sweep.

  // === SENSITIVITY MAPS (Task 4) ===
  const preAnalysisSensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const factorInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.factor_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.factor_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Composite influence map: VoI takes precedence when available (post-analysis).
  // Used by expertise triage cards and triage sort so they reflect
  // the best available signal: VoI when present, factor_influence otherwise.
  const compositeInfluenceMap = useMemo(() => {
    if (data.voiMap && data.voiMap.size > 0) return data.voiMap
    return factorInfluenceMap
  }, [data.voiMap, factorInfluenceMap])
  const edgeInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.edge_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.edge_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Pre-analysis-power-v1 Task 5: weightedInfluenceReviewed derivation
  // removed alongside the StickyFooter "N/M addressed" counter that was
  // its sole consumer.

  // === INTERACTIVE ACTION HANDLERS ===

  // P1-5: Refs holding the current triage signals + markResolved callback
  // so handleConfirm can look up the signal_id by nodeId and mark resolved
  // without creating a circular declaration (useResolvedSignals is declared
  // later in the function body because it depends on allReviewNextSignals).
  const triageSignalsRef = useRef<TriageSignal[]>([])
  const markResolvedRef = useRef<((e: { signalId: string; label: string; kind: 'confirm' | 'setValue'; undoSnapshot: unknown }) => void) | null>(null)
  const undoResolvedRef = useRef<((signalId: string) => unknown | null) | null>(null)

  // Confirm action - mark factor source as user_confirmed. P1-5: snapshots
  // the previous node.data so useResolvedSignals can hold an undo payload.
  const handleConfirm = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Snapshot before mutation so Undo can restore the exact previous state.
    const undoSnapshot = { nodeId, previousData: node.data }

    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_confirmed', extractionType: 'explicit' }),
    })

    const match = triageSignalsRef.current.find((s: TriageSignal) => s.focusId === nodeId)
    if (match && markResolvedRef.current) {
      markResolvedRef.current({
        signalId: match.id,
        label: match.card.title,
        kind: 'confirm',
        undoSnapshot,
      })
    }
  }, [])

  // P1-5: Undo a resolved signal — restores the snapshot node.data via
  // updateNode and removes the resolved entry so the original card renders
  // again. No-op when the signal has no snapshot.
  const handleUndoResolved = useCallback((signalId: string) => {
    if (!undoResolvedRef.current) return
    const snapshot = undoResolvedRef.current(signalId) as { nodeId: string; previousData: unknown } | null
    if (!snapshot) return
    const { updateNode } = useCanvasStore.getState()
    updateNode(snapshot.nodeId, { data: snapshot.previousData as Record<string, unknown> })
    // UI-BUG-8: clear draft error so the Analyse button re-enables after undo.
    // The value change that triggered the error has been reverted.
    useDraftStore.getState().setLastDraftError(null)
  }, [])

  // Inline value edit — update factor observed state with user-provided raw value
  const handleInlineEditValue = useCallback((nodeId: string, rawValue: number, cap: number | null) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const normalised = cap != null && cap > 0 ? rawValue / cap : rawValue
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, {
        raw_value: rawValue,
        value: normalised,
        source: 'user_override',
      }),
    })
    // Parametric edit — observed state is read from graph nodes at request build time,
    // not from ceeAnalysisReady. Option intervention mappings remain valid.
  }, [])

  // Edge strength quick-select — update edge weight via canonical updateEdgeData (clamps [0,2])
  const handleUpdateEdgeStrength = useCallback((edgeId: string, value: number) => {
    const { updateEdgeData } = useCanvasStore.getState()
    // Write weight through updateEdgeData (clamped). Clear strength_mean so
    // computeSignedMean falls through to weight + direction (the canvas schema path).
    // Mark `userReviewedStrength: true` so `buildPriorityProgress` recognises
    // the edge as confirmed in the top-3 priority counter (pre-analysis-power-v2).
    updateEdgeData(edgeId, { weight: value, strength_mean: undefined, userReviewedStrength: true })
  }, [])

  // Brief 5.8A D3b/D3c — bundle of T1 handlers. Stable identity so the
  // memoised T1DecisionReadinessCard does not re-render on unrelated parent
  // state. The buildAiDiscuss factory mirrors the legacy mapping (each
  // card.aiDiscuss is wrapped in a DiscussWithAiButton). The bias hover
  // handlers route through the same setHighlightedNodes/Edges store calls
  // as the legacy bias trigger render.
  const t1Handlers = useMemo<T1Handlers>(() => ({
    onConfirm: handleConfirm,
    onEdit: handleSetValueForGap,
    onUpdateEdgeStrength: handleUpdateEdgeStrength,
    onHoverEnter: handleHoverElement,
    onHoverLeave: handleHoverClear,
    buildAiDiscuss: (entry) => entry.card.aiDiscuss
      ? <DiscussWithAiButton element={entry.card.aiDiscuss} />
      : undefined,
    onBiasHoverEnter: (targetFactorId) => {
      if (targetFactorId) {
        setHighlightedNodes([targetFactorId])
        setHighlightedEdges([])
      }
    },
    onBiasHoverLeave: () => {
      setHighlightedNodes([])
      setHighlightedEdges([])
    },
  }), [handleConfirm, handleSetValueForGap, handleUpdateEdgeStrength, handleHoverElement, handleHoverClear, setHighlightedNodes, setHighlightedEdges])

  // Action handlers passed to TriageCard and expertise triage cards

  // Don't show panel if canvas is empty AND not loading
  // When loading, show the "Generating..." placeholder via ModelHealthCard
  //
  // The early-return for this empty state has moved to *after* the
  // remaining hooks below so the panel's hook order stays stable across
  // renders (Rules of Hooks). Previously, returning null here while later
  // renders fell through to ~17 additional hooks caused React to throw
  // "Rendered more hooks than during the previous render" on the
  // empty → non-empty canvas transition. We instead set a boolean here
  // and consult it just before the JSX return. The hooks below are pure
  // useMemo / useCallback / one debug useEffect — running them on the
  // empty path is cheap (most inputs are empty arrays) and has no side
  // effect on the empty-state user experience.
  const isEmptyState =
    !data.isLoading &&
    data.nodesByKind.goal.length === 0 &&
    data.nodesByKind.option.length === 0 &&
    data.nodesByKind.factor.length === 0

  // === READINESS SCORE (for adaptive footer CTA) ===
  // D11: Decision shape — smooth 0–1 score from graph state (replaces completeness heuristic).
  // Constraint node IDs excluded from edge count (structural scaffolding, not causal links).
  const constraintNodeIds = useMemo(
    () => new Set(nodes.filter(n => n.type === 'constraint').map(n => n.id)),
    [nodes],
  )
  const completeness = useMemo(() => decisionShapeScore({
    optionCount: data.nodesByKind.option.length,
    outcomeCount: data.nodesByKind.goal.length + data.nodesByKind.outcome.length,
    factorCount: data.nodesByKind.factor.length,
    edgeCount: edges.filter(e => !constraintNodeIds.has(e.source) && !constraintNodeIds.has(e.target)).length,
  }), [data.nodesByKind, edges, constraintNodeIds])
  const evidence = data.evidenceQuality.ratio
  // D12: "Your contribution" replaces "Coverage" slot. Uses the same non-AI ratio
  // as `evidence` (documented duplication until D13 provides a distinct grounding signal).
  const balance = data.evidenceQuality.ratio
  const calibration = data.totalReviewableFactorsCount > 0
    ? data.reviewedFactorsCount / data.totalReviewableFactorsCount
    : 0
  // readinessScore was previously surfaced in the footer (now driven by
  // bannerState + data.isReady). Removed in v2 panel regroup.

  // === TRIAGE CONTENT ===

  // Map improvement items to TriageCard props (diversified top3 + quickFix)
  // Build editorConfig for factor items that need "Set value" inline editing
  type MappedCard = TriageCardItem & { editorConfig?: ScientificEditorProps | null; aiDiscuss?: AiDiscussElement }
  const mapItem = (item: typeof data.triageActions.top3[number]): MappedCard => {
    const influence = item.focus?.type === 'edge'
      ? edgeInfluenceMap?.get(item.focus.id)
      : compositeInfluenceMap?.get(item.focus?.id ?? '')
    const mapped = mapImprovementToTriageCard(item, influence)

    // P1-2: build the discuss-with-AI element from the item shape so the
    // sparkle button can pre-fill chat with a contextual prompt.
    let aiDiscuss: AiDiscussElement | undefined
    if (item.focus?.type === 'edge') {
      const arrow = item.label.indexOf(' → ')
      if (arrow > 0) {
        aiDiscuss = { kind: 'edge', from: item.label.slice(0, arrow), to: item.label.slice(arrow + 3) }
      }
    } else if (item.focus?.type === 'node') {
      aiDiscuss = { kind: 'factor', label: item.label }
    }

    // Attach editorConfig for every factor item with set_value or confirm action,
    // regardless of whether rawValue/value is present. When both are null (including
    // inferred-zero "Not set" items) rawValue is passed as null so the input renders
    // empty with placeholder text rather than pre-filling with a misleading value.
    //
    // Inferred-zero items: rawValue is 0 in the data but semantically "not set".
    // Using `??` would pass 0 through (0 is not null/undefined). When the item's
    // detail is 'Not set' we force null so the inline editor starts empty.
    const targetId = item.action?.targetId
    // Brief 4 hotfix Task 3: priority chain extracted into resolveEditorRawValue
    // so the brief-extraction cap-fallback is unit-testable in isolation.
    const resolverInput = {
      detail: item.detail,
      rawValue: item.rawValue ?? null,
      cap: item.cap ?? null,
      unit: item.unit ?? null,
      sourceBadge: item.sourceBadge,
    }
    const numericValue = resolveEditorRawValue(resolverInput)
    // Follow-up to the P0 #1 narrowing: when the editor is left empty in the
    // brief-extracted-with-cap case, surface the extracted ceiling as a
    // subtitle hint so the card body doesn't fall back to "$0" via the
    // upstream formatObservedStateDetail. `mapped.subtitle` is overridden
    // only when the predicate fires; other items keep their existing subtitle
    // (CEE hint / deterministic derived context / generic fallback).
    const capHintSubtitle = resolveCapHintSubtitle(resolverInput, formatValueWithUnit)
    const subtitle = capHintSubtitle ?? mapped.subtitle
    if (targetId && item.focus?.type === 'node' && (mapped.action?.kind === 'set_value' || mapped.action?.kind === 'confirm')) {
      return {
        ...mapped,
        subtitle,
        editorConfig: {
          kind: 'factor' as const,
          rawValue: numericValue,
          cap: item.cap ?? null,
          unit: item.unit ?? null,
          onSave: (rawValue: number) => handleInlineEditValue(targetId, rawValue, item.cap ?? null),
          onCancel: () => {},
        },
        aiDiscuss,
      }
    }
    return { ...mapped, aiDiscuss }
  }
  const triageTop3 = data.triageActions.top3.map(mapItem)
  const triageQuickFix = data.triageActions.quickFix.map(mapItem)
  const triageCards = [...triageTop3, ...triageQuickFix]

  // Bias trigger cards — CEE findings take precedence when available.
  // Falls back to UI-side deterministic checks when CEE provides no findings.
  // Max 2 cards. Trigger shape is shared across both paths so the render layer
  // can treat them uniformly. The CEE path includes micro_intervention.steps[0]
  // when present, which enriches the sparkle prompt with a debiasing technique.
  const biasTriggers = useMemo<NormalisedBiasTrigger[]>(() => {
    const triggers: NormalisedBiasTrigger[] = []

    const ceeBiasFindings = (ceeAnalysisReady?.bias_findings ?? []) as RawBiasFinding[]

    // Brief 5.7 D5 follow-up: resolver lookup against the live graph so a
    // CEE-supplied target_factor_id can be turned into a render-ready label.
    // Returns null when the id does not resolve to any node — the trigger is
    // then suppressed in normaliseCeeBiasFinding.
    const resolveLabel = (id: string): string | null => {
      const node = nodes.find(n => n.id === id)
      if (!node) return null
      const label = (node.data as Record<string, unknown>)?.label
      return typeof label === 'string' && label.trim() ? label : null
    }

    if (ceeBiasFindings.length > 0) {
      // Sort CEE findings by severity: high → medium → low (BIAS_SEVERITY_RANK)
      const sorted = [...ceeBiasFindings].sort(
        (a, b) => (BIAS_SEVERITY_RANK[a.severity ?? ''] ?? 9) - (BIAS_SEVERITY_RANK[b.severity ?? ''] ?? 9),
      )
      for (let i = 0; i < sorted.length; i++) {
        const finding = sorted[i]
        if (shouldSuppressBiasFinding(finding)) continue
        // Brief 5.8A D2: require a resolvable target on every LLM-sourced
        // bias entry. Drops entries with blank/missing or unresolvable
        // target_factor_id before normalisation.
        if (!hasResolvableBiasTarget(finding.target_factor_id, resolveLabel)) continue
        const normalised = normaliseCeeBiasFinding(finding, i, resolveLabel)
        if (normalised) triggers.push(normalised)
        if (triggers.length >= 2) break
      }
    }

    // CEE coaching.bias_signals (build a555cf7b+) — second LLM source. Each
    // signal carries a free-form `type` and `detail`; `target` is used only
    // for hover-highlight and is never rendered as text. Mapping is delegated
    // to the pure mapDraftBiasSignalToTrigger helper for test isolation.
    if (triggers.length < 2 && draftCoachingBiasSignals && draftCoachingBiasSignals.length > 0) {
      for (let i = 0; i < draftCoachingBiasSignals.length && triggers.length < 2; i++) {
        const signal = draftCoachingBiasSignals[i]
        // Brief 5.8A D2: same resolvable-target requirement as bias_findings.
        // Closes the gap where coaching signals previously rendered without
        // any target check.
        if (!hasResolvableBiasTarget(signal.target, resolveLabel)) continue
        const trigger = mapDraftBiasSignalToTrigger(signal, i, resolveLabel)
        if (trigger) triggers.push(trigger)
      }
    }

    if (triggers.length > 0) return triggers
    // If no LLM source produced a usable trigger, fall through to deterministic

    // Deterministic fallback — graph-signal-only checks. Each check produces
    // a trigger in the shared NormalisedBiasTrigger shape (no micro_intervention,
    // no target factor — these are graph-level signals that do not anchor to
    // a single node).

    const pushDeterministic = (
      id: string,
      icon: typeof Frame,
      title: string,
      explanation: string,
    ) => {
      triggers.push({
        id,
        icon,
        title,
        subtitle: truncateExplanation(explanation),
        fullExplanation: explanation,
        severity: 'medium',
        microInterventionStep: null,
        targetFactorId: null,
        targetFactorLabel: null,
      })
    }

    // 1. Narrow framing: fewer than 2 non-baseline options
    const nonBaselineOptions = data.optionPreviews.filter(o => !o.isBaseline)
    if (nonBaselineOptions.length < 2) {
      pushDeterministic(
        'narrow_framing',
        Frame,
        'Narrow framing',
        'Consider structurally different approaches. What would a competitor do?',
      )
    }

    // 2. Missing risks: 0 or 1 risk nodes
    if (data.nodesByKind.risk.length <= 1) {
      pushDeterministic(
        'missing_risks',
        ShieldAlert,
        'Missing risks',
        'Your model has few risks. Consider what could go wrong with each option.',
      )
    }

    // 3. Overconfidence: top factor by influence is AI-sourced with no uncertainty_drivers
    // Uses compositeInfluenceMap so VoI takes precedence over sensitivity when available.
    if (compositeInfluenceMap && compositeInfluenceMap.size > 0) {
      let topFactorId: string | null = null
      let topInfluence = -1
      for (const [id, inf] of compositeInfluenceMap) {
        if (inf > topInfluence) { topInfluence = inf; topFactorId = id }
      }
      if (topFactorId) {
        const topNode = nodes.find(n => n.id === topFactorId)
        if (topNode) {
          const nd = topNode.data as Record<string, unknown>
          const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
          const source = os?.source as string | undefined
          const rawDrivers = os?.uncertainty_drivers
          const drivers = Array.isArray(rawDrivers) ? rawDrivers : undefined
          if (source && AI_SOURCES.has(source) && (!drivers || drivers.length === 0)) {
            const label = (nd.label as string) ?? topFactorId
            pushDeterministic(
              'overconfidence',
              Gauge,
              'Overconfidence',
              `${label} drives most of the outcome but has no supporting evidence. Validate it before relying on it.`,
            )
          }
        }
      }
    }

    // 4. Anchoring: all non-baseline options affect same factors with narrow intervention spread
    if (data.optionPreviews.length >= 2) {
      const optionMaps: Map<string, number>[] = []
      let allValid = true
      for (const opt of data.optionPreviews.filter(o => !o.isBaseline)) {
        if (!opt.interventions || opt.interventions.length === 0) { allValid = false; break }
        const m = new Map<string, number>()
        for (const iv of opt.interventions) {
          if (iv.factorId && iv.interventionValue != null) m.set(iv.factorId, iv.interventionValue)
        }
        if (m.size === 0) { allValid = false; break }
        optionMaps.push(m)
      }
      if (allValid && optionMaps.length >= 2) {
        const allFactorIds = new Set(optionMaps.flatMap(m => [...m.keys()]))
        const sharedFactors = [...allFactorIds].filter(fId => optionMaps.every(m => m.has(fId)))
        if (sharedFactors.length === allFactorIds.size && sharedFactors.length > 0) {
          let allNarrow = true
          let hasValidFactor = false
          for (const fId of sharedFactors) {
            const fNode = nodes.find(n => n.id === fId)
            if (!fNode) continue
            const fOs = ((fNode.data as Record<string, unknown>).observedState ?? (fNode.data as Record<string, unknown>).observed_state) as Record<string, unknown> | undefined
            const baseline = fOs?.value as number | undefined
            if (baseline == null || baseline === 0) continue
            hasValidFactor = true
            const values = optionMaps.map(m => m.get(fId)).filter((v): v is number => v != null)
            if (values.length < 2) continue
            const spread = Math.max(...values) - Math.min(...values)
            if (spread >= Math.abs(baseline) * 0.2) { allNarrow = false; break }
          }
          if (allNarrow && hasValidFactor) {
            pushDeterministic(
              'anchoring',
              Anchor,
              'Anchoring',
              'Your options are similar. Try a wider range of approaches.',
            )
          }
        }
      }
    }

    return triggers.slice(0, 2)
  }, [ceeAnalysisReady?.bias_findings, draftCoachingBiasSignals, data.optionPreviews, data.nodesByKind.risk, compositeInfluenceMap, nodes])

  // === V2 PANEL BUCKETS ===
  // Three-bucket regroup: Must fix → review-tier → improve-confidence-tier.
  // Deduplication rule: any item that appears in Must fix is excluded from
  // the other two buckets. Filter on item key (which carries through the
  // mapper unchanged).

  // Must fix: critical 'fix' category triage cards (filtered on category from
  // the mapper output) plus enriched blockers. Triage cards are already
  // ordered by priority; cards with category === 'fix' represent blockers.
  // Dedup key: signal_id (Signal Registry v3 §7) when populated, else item key.
  // signal_id population is deferred — see ImprovementItem.signal_id comment.
  const mustFixCardKeys = new Set<string>()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mustFixCards is populated via for-loop; stable deps would require memoising triageCards (which is itself spread-composed on every render). Pre-existing pattern; acceptable re-run cost.
  const mustFixCards: typeof triageCards = []
  for (const c of triageCards) {
    if (c.category === 'fix') {
      mustFixCardKeys.add(c.signal_id ?? c.key)
      mustFixCards.push(c)
    }
  }

  // Structural check rows. Two dedup rules:
  //   1. Only fire when CEE has run and the data is real (not empty
  //      optionPreviews from a loading/mock state). Avoids spurious checks.
  //   2. Suppress a structural row when an equivalent fix-category triage
  //      card already covers the issue. e.g. usePreAnalysisData emits a
  //      'fewer_than_2_options' fix card whenever optionNodes.length < 2;
  //      we don't want to render the same blocker twice in Must fix.
  const noBaselineCheck = !data.isLoading && data.qualityChecks.some(c => c.id === 'no_baseline')
  const fewerThanTwoOptionsCheck = !data.isLoading
    && data.optionPreviews.length > 0
    && data.optionPreviews.length < 2
    && !mustFixCardKeys.has('fewer_than_2_options')

  // P0-2: filter blockers that the Draft failed card already covers, so the
  // user does not see "Options need configuration" twice (once in the error
  // card, once in Must fix). Pure render-time transform; does not mutate
  // validation state. Lifted above mustFixCount so the count and the rendered
  // list stay consistent.
  const visibleEnrichedBlockers = useMemo(
    () => filterRedundantBlockers(data.enrichedBlockers, lastDraftError, runErrorCode),
    [data.enrichedBlockers, lastDraftError, runErrorCode],
  )

  const enrichedBlockerCount = !data.isReady ? visibleEnrichedBlockers.length : 0
  const structuralCheckCount = (noBaselineCheck ? 1 : 0) + (fewerThanTwoOptionsCheck ? 1 : 0)
  const mustFixCount = mustFixCards.length + enrichedBlockerCount + structuralCheckCount

  // review-tier: top-3 triage cards (excluding any in Must fix), bias triggers,
  // and option quality card. The card surfaces when:
  //   - same_levers quality check fires (options too similar), OR
  //   - the model has fewer than 3 options (encourage broader framing).
  // Note: < 2 options is also a Must fix structural blocker, but the review-tier
  // card still appears with coaching to explore alternatives.
  //
  // P1-8: hard budget — max 1 option-quality + 2 bias + 3 triage = 6 visible
  // (plus 1 Start here slot added by P1-4). Anything beyond the budget stays
  // Brief 5.8A holistic-review pass: legacy review-tier budget constants
  // deleted — the T1 unified queue (top 3 + Also consider) now owns the
  // visible cap, and bias rows have their own internal limit
  // (BIAS_NUDGE_VISIBLE_LIMIT inside T1DecisionReadinessCard).
  const reviewNextTriageAll = triageTop3.filter(c => !mustFixCardKeys.has(c.signal_id ?? c.key))
  const showOptionQualityCard = data.optionPreviews.length > 0
    && (data.qualityChecks.some(c => c.id === 'same_levers') || data.optionPreviews.length < 3)

  // P1-4: build the unified signal list across ALL review-tier kinds and pick
  // the highest-priority item as "Start here". Re-evaluated on every render so
  // a newly important item promotes automatically when state changes.
  //
  // Scoring:
  //   - triage: VoI > factor_influence > 0 (via TriageCardItem.influence which is
  //     the composite map value). Defaulted when no influence map exists.
  //   - option_quality: 0.9 (intervention overlap via same_levers) else 0.7
  //   - bias: CEE severity or fallback 'medium' (0.65)
  const hasIntervestionOverlap = data.qualityChecks.some(c => c.id === 'same_levers')
  // Keep the ref in sync with the latest signals so handleConfirm sees the
  // current set on its next invocation. Assigned outside useMemo because
  // ref writes during render are safe as long as they don't affect other
  // reads within the same render.
  const triageSignals: TriageSignal[] = reviewNextTriageAll.map((card, idx) => {
    const improvement = data.triageActions.top3[idx]
    const influence = card.influence
    const score = typeof influence === 'number' ? influence : -1
    return {
      kind: 'triage',
      id: `triage:${card.key}`,
      score: score < 0 ? 0.3 : score,
      defaultedScore: score < 0 || !compositeInfluenceMap || compositeInfluenceMap.size === 0,
      focusId: improvement?.focus?.id,
      card,
    }
  })
  const biasSignals: ReviewNextSignal[] = biasTriggers.map(trigger => ({
    kind: 'bias',
    id: `bias:${trigger.id}`,
    score: BIAS_SEVERITY_SCORE[trigger.severity ?? 'medium'] ?? 0.65,
    defaultedScore: false,
    biasType: trigger.title,
    subtitle: trigger.subtitle,
    targetFactorLabel: trigger.targetFactorLabel ?? undefined,
    targetFactorId: trigger.targetFactorId ?? undefined,
  }))
  const optionQualitySignal: ReviewNextSignal | null = showOptionQualityCard
    ? {
        kind: 'option_quality',
        id: 'option_quality',
        score: hasIntervestionOverlap
          ? OPTION_QUALITY_SEVERITY.intervention_overlap
          : OPTION_QUALITY_SEVERITY.few_options,
        defaultedScore: false,
        optionLabels: data.optionPreviews.map(o => o.label),
        hasInterventionOverlap: hasIntervestionOverlap,
      }
    : null
  const allReviewNextSignals: ReviewNextSignal[] = [
    ...triageSignals,
    ...biasSignals,
    ...(optionQualitySignal ? [optionQualitySignal] : []),
  ]
  // P1-5: keep the triage signals ref in sync so handleConfirm can look up
  // the signal_id for a given nodeId on its next invocation.
  triageSignalsRef.current = triageSignals

  // P1-5: parent-managed resolved state. Hook takes the set of live signal
  // ids so the reaper can remove entries whose underlying signal has been
  // filtered out of the panel (e.g. the triage item disappeared after confirm
  // propagated through the store).
  const liveSignalIds = useMemo(
    () => new Set(allReviewNextSignals.map(s => s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReviewNextSignals.map(s => s.id).join('|')],
  )
  const { resolved: resolvedSignals, markResolved, undo: undoResolved } = useResolvedSignals(liveSignalIds)
  // Publish the latest callbacks to the refs used by handleConfirm /
  // handleUndoResolved so those stable callbacks don't need to re-bind.
  markResolvedRef.current = markResolved
  undoResolvedRef.current = undoResolved

  // Dominant factor override (CEE) — falls back to undefined when not present.
  const dominantFactorId =
    (ceeAnalysisReady as { review?: { dominant_factor_low_confidence?: { factor_id?: string } } } | undefined)
      ?.review?.dominant_factor_low_confidence?.factor_id

  const startHereSignal = pickStartHere(allReviewNextSignals, {
    dominantFactorId,
  })
  const pickedKey = startHereSignal ? `${startHereSignal.kind}:${startHereSignal.id}` : null
  const signalCount = allReviewNextSignals.length
  useEffect(() => {
    if (import.meta.env.VITE_DEBUG_PREANALYSIS !== '1') return
    // eslint-disable-next-line no-console
    console.debug('[PreAnalysis] pickStartHere', {
      signalCount,
      mustFixCount,
      picked: pickedKey,
    })
  }, [signalCount, mustFixCount, pickedKey])

  // Brief 5.8A holistic-review pass: the legacy "review-tier" surface is
  // gone; reviewNextCount remains as a derived total consumed by the
  // status banner sub-line ("X items to review next").
  const reviewNextCount =
    reviewNextTriageAll.length
    + biasTriggers.length
    + (showOptionQualityCard ? 1 : 0)

  // improve-confidence-tier: SuccessTarget (always present), remaining (quickFix)
  // triage cards, Your expertise, missing knowledge prompt.
  // The accordion always renders so users can adjust the goal target and review
  // their expertise — even when nothing else is pending.
  const improveConfidenceCards = triageQuickFix.filter(c => !mustFixCardKeys.has(c.signal_id ?? c.key))

  // D7: AI-estimated and missing-data items that are NOT already in the triage
  // list. Threaded into improve-confidence-tier as TriageCards so they remain
  // accessible after YourExpertise is removed.
  const expertiseTriageCards = useMemo(() => {
    const groups = deriveExpertiseGroups(
      data.improvementsByCategory,
      data.contestedEdges,
      nodes,
      edges,
      compositeInfluenceMap,
      edgeInfluenceMap,
    )
    // Deduplicate: skip items whose focus node ID is already in the triage list
    const existingIds = new Set(
      triageCards
        .filter(c => c.action?.targetId)
        .map(c => c.action!.targetId!),
    )
    const extras: ReturnType<typeof mapItem>[] = []
    for (const item of groups.aiEstimated) {
      if (item.focus?.id && existingIds.has(item.focus.id)) continue
      // Brief 5.7 D7: defensive augmentation. See augmentAiEstimatedItemWithConfirm.
      extras.push(mapItem(augmentAiEstimatedItemWithConfirm(item)))
    }
    for (const item of groups.missingData) {
      if (item.focus?.id && existingIds.has(item.focus.id)) continue
      // Augment synthetic missing-data items with a Set value action so mapItem
      // attaches the inline editor (editorConfig fires on action.kind === 'confirm').
      const augmented = {
        ...item,
        action: { kind: 'confirm' as const, label: 'Set value', targetId: item.focus!.id, targetType: 'node' as const },
      }
      extras.push(mapItem(augmented))
    }
    return extras
  // mapItem is a render-local function; its captured deps (compositeInfluenceMap,
  // edgeInfluenceMap, handleInlineEditValue) are tracked in the array below.
  // Adding mapItem itself would recreate the memo on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.improvementsByCategory, data.contestedEdges, nodes, edges, compositeInfluenceMap, edgeInfluenceMap, triageCards])

  // Brief 5.8A D3b — strengthen overlay map. CEE coaching.strengthen_items
  // are matched onto triage cards by normalised exact label match (case-
  // insensitive trim). When matched, `detail` overlays as the card subtitle
  // and `actionType` becomes a passive 9px pill. Built once per render from
  // the live store value.
  const draftCoachingStrengthenItems = useCanvasStore(s => s.draftCoaching?.strengthenItems ?? null)
  const strengthenOverlayMap = useMemo(
    () => buildStrengthenOverlayMap(draftCoachingStrengthenItems),
    [draftCoachingStrengthenItems],
  )

  // Brief 5.8A D3b — unified triage queue inside the T1 card. Combines the
  // legacy review-tier triage cards, improve-confidence-tier quick-fix cards, and
  // the threaded expertise triage cards into a single ordered list. Order is
  // preserved from the existing severity → diversification sort in Hook B
  // (no new ordering field). Cards already in Must fix are excluded
  // (mustFixCardKeys). Cards whose signal id is in resolvedSignals are also
  // excluded so a freshly-confirmed item disappears from the queue on the
  // very next render rather than briefly remaining visible until Hook B
  // re-derives. Duplicate keys are deduped — first-write-wins so the
  // ordering is preserved deterministically.
  type UnifiedQueueEntry = UnifiedQueueEntryProp
  const unifiedTriageQueue = useMemo<UnifiedQueueEntry[]>(() => {
    const seen = new Set<string>()
    const queue: UnifiedQueueEntry[] = []
    // Order matters: Must fix triage cards (fix-category) come first because
    // they're analysis-blocking; then review-tier; then improve-confidence-tier
    // overflow; then expertise items. Within each source the existing
    // severity → diversification ordering from Hook B is preserved.
    const sources = [...mustFixCards, ...reviewNextTriageAll, ...improveConfidenceCards, ...expertiseTriageCards]
    for (const card of sources) {
      const dedupKey = card.signal_id ?? card.key
      if (seen.has(dedupKey)) continue
      // Brief 5.8A holistic-review pass: respect the resolvedSignals overlay
      // so confirm clicks don't leave the card visible for a render frame.
      if (resolvedSignals.has(`triage:${card.key}`)) continue
      seen.add(dedupKey)
      const overlay = findStrengthenOverlay({ title: card.title }, strengthenOverlayMap)
      queue.push({ card, overlay })
    }
    return queue
  }, [mustFixCards, reviewNextTriageAll, improveConfidenceCards, expertiseTriageCards, strengthenOverlayMap, resolvedSignals])

  const unifiedTopThree = useMemo(() => unifiedTriageQueue.slice(0, 3), [unifiedTriageQueue])
  const unifiedAlsoConsider = useMemo(() => unifiedTriageQueue.slice(3), [unifiedTriageQueue])

  // Pre-analysis-power-v1 Task 5 — single-segment priority-confirmation
  // counter. Counts how many of the visible top-3 priority items have been
  // confirmed by the user (replaces the previous three-bucket
  // contribution breakdown that ran over ALL factor nodes).
  const priorityProgress = useMemo<PriorityProgress>(
    () => buildPriorityProgress(unifiedTopThree, data.nodesByKind.factor, edges),
    [unifiedTopThree, data.nodesByKind.factor, edges],
  )

  // Brief 5.8A holistic-review pass: stable slot ReactNodes for the memoised
  // T1 card. Without these, every parent re-render constructs new ReactElement
  // refs that defeat T1DecisionReadinessCard's React.memo. The slots only
  // change when their internal state (store reads) changes — the slot
  // *components* themselves manage that via their own subscriptions.
  //
  // Post-D7 follow-up: the widening slot is gated on actual wideningLog
  // presence so the surrounding .sep divider in the T1 card disappears too
  // when there's nothing to add. Without this gate the separator would
  // render above an empty slot.
  const wideningLogCount = useCanvasStore(s => s.draftCoaching?.wideningLog?.length ?? 0)
  const wideningSlot = useMemo(
    () => (wideningLogCount > 0 ? <WhatOlumiAddedSection /> : null),
    [wideningLogCount],
  )
  const missingKnowledgeSlot = useMemo(
    () => (
      <MissingKnowledgePrompt
        context="model"
        aiAffordance={
          <DiscussWithAiButton
            element={{ kind: 'missing' }}
            ariaLabel="Tell AI about something missing from the model"
          />
        }
      />
    ),
    [],
  )

  // Brief 5.8A holistic-review pass — consolidate ALL failing structural
  // checks into a single list passed to the T1 card. Sources:
  //   1. no_target qualityCheck (goal target unset) — high-priority because
  //      analysis cannot show probability of success without it.
  //   2. structural fewer-than-2-options check (was rendered separately in
  //      legacy Must fix).
  //   3. structural no-baseline check (was rendered separately in legacy
  //      Must fix).
  //
  // Each entry carries its own action handler so the T1 row pattern stays
  // dumb. Order: no_target first (analysis-blocking), then options, then
  // baseline. Empty list naturally suppresses the failing-checks block.
  const failingChecks = useMemo<T1FailingCheckEntry[]>(() => {
    const checks: T1FailingCheckEntry[] = []
    if (data.qualityChecks.some(c => c.id === 'no_target')) {
      checks.push({
        id: 'no_target',
        label: 'Goal target not set',
        actionLabel: 'Set target',
        onAction: () => {
          const goalId = data.goalNode?.id
          if (goalId) {
            selectNodeWithoutHistory(goalId)
            focusNodeById(goalId)
          }
        },
        testId: 't1-check-no-target',
      })
    }
    if (fewerThanTwoOptionsCheck) {
      checks.push({
        id: 'fewer_than_2_options',
        label: 'Fewer than 2 options',
        actionLabel: 'Add option',
        onAction: () => onSendMessage?.('Add another option to compare'),
        testId: 't1-check-fewer-than-2-options',
      })
    }
    if (noBaselineCheck) {
      checks.push({
        id: 'no_baseline',
        label: 'No baseline set',
        actionLabel: 'Add baseline',
        onAction: () => onSendMessage?.('Add a status quo option to compare against'),
        testId: 't1-check-no-baseline',
      })
    }
    return checks
  }, [data.qualityChecks, data.goalNode, fewerThanTwoOptionsCheck, noBaselineCheck, onSendMessage, selectNodeWithoutHistory])

  // Stable goalLabel + hasGoalNode primitives — pure derivations from
  // data.goalNode, don't change unless the goal node identity does.
  const goalLabel = useMemo(
    () => data.goalNode ? ((data.goalNode.data as { label?: string })?.label ?? null) : null,
    [data.goalNode],
  )
  const hasGoalNode = data.nodesByKind.goal.length > 0
  const hasGoalTarget = data.successThreshold !== null

  // Brief 4 hotfix Task 5: the goal target is only an improvement item when
  // the user hasn't confirmed the threshold yet. Once confirmed, drop it from
  // the count so header and subtitle stop over-reporting. Apply the same
  // include-goal rule to the subtitle at the accordion render below.
  // Brief 5.8A D3b: improveConfidenceCount + highestValueLabel were removed
  // when the improve-confidence-tier accordion lost its visible heading + count
  // pill. The accordion now self-renders with a generic "Show additional
  // controls" toggle and only suppresses itself when there is no content at
  // all — handled inline via the `count` prop.

  // Dynamic headline for the health card. Reads from the same bucket data
  // already computed above so there's no duplicate work. Precedence:
  //   1. CEE-provided coaching_summary (if/when CEE populates it)
  //   2. First Must fix item → "[label]. Address before analysis."
  //      Order matches the rendered Must fix section: enriched blockers first,
  //      then structural rows ("Fewer than 2 options", "No baseline set"),
  //      then critical fix triage cards.
  //   3. First review-tier item → subject-specific sentence (see branch
  //      comments). Plural-subject option card gets "Review your options
  //      before running."; singular bias triggers get "[Bias] may be shaping
  //      your choices. …"; singular triage cards get "[Factor] has the
  //      biggest impact. …". Order matches the rendered review-tier section.
  //   4. improve-confidence-tier has actionable cards → "Ready to run. [N] checks would improve results."
  //   5. Else → "Ready to run."
  // Returns null while loading (the card shows its own loading state).
  const dynamicHeadline = useMemo<string | null>(() => {
    if (data.isLoading) return null

    // 1. CEE override (always wins when present)
    const ceeSummary = ceeAnalysisReady?.coaching_summary
    if (ceeSummary && ceeSummary.trim().length > 0) return ceeSummary

    // 2. Must fix — match the rendered display order, not the data shape order
    if (mustFixCount > 0) {
      const firstFix =
        // 2a. Enriched blockers (rendered first in the section) — use the
        //     filtered list so the headline doesn't echo a blocker that the
        //     draft-error card already covers (P0-2 dedup).
        (!data.isReady ? visibleEnrichedBlockers[0]?.display?.title : null)
        // 2b. Structural rows (rendered second; "Fewer than 2 options" before "No baseline set")
        ?? (fewerThanTwoOptionsCheck ? 'Fewer than 2 options' : null)
        ?? (noBaselineCheck ? 'No baseline set' : null)
        // 2c. Critical fix triage cards (rendered last)
        ?? mustFixCards[0]?.title
      if (firstFix) return `${firstFix}. Address before analysis.`
      return 'Address before analysis.'
    }

    // 3. review-tier — Brief 5.8B D0 #2/#7: dropped the "before running"
    //    headline templates entirely. They duplicated the T1 narrative
    //    bridge ("{N} unverified estimates and {M} relationships worth
    //    reviewing.") which now sits inside the same card. Returning null
    //    lets ModelHealthCard fall through to its own ringless caption
    //    rather than echo the same count twice in different prose.
    if (reviewNextCount > 0) {
      return null
    }

    // 4 & 5. Ready states — suppress. The StatusBanner above the panel already
    // communicates "Ready to run" (and the reviewNextCount where applicable).
    // Section count badges on improve-confidence-tier and review-tier carry the
    // item counts — echoing them here duplicates the count badge information.
    return null
  }, [
    data.isLoading,
    data.isReady,
    ceeAnalysisReady?.coaching_summary,
    mustFixCount,
    mustFixCards,
    visibleEnrichedBlockers,
    fewerThanTwoOptionsCheck,
    noBaselineCheck,
    reviewNextCount,
  ])

  // Banner state — failure is the only case modelled separately; everything
  // else is derived from `useAnalysisDisplayState` inside the banner. The
  // bucket counts pass through as a sub-line. Loading does not produce a
  // banner; the panel content is hidden by ModelHealthCard.
  const bannerState: BannerState = lastDraftError
    ? { kind: 'failed', canRetry: canRetryDraft }
    : { kind: 'derived', mustFixCount, reviewNextCount }

  const isFailed = bannerState.kind === 'failed'

  // Deferred empty-state gate (see `isEmptyState` above). All hooks have now
  // executed in the same order they will on a populated render, so this
  // late return cannot trigger the "Rendered more hooks than during the
  // previous render" error.
  if (isEmptyState) return null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Scrollable content area
          Horizontal padding is owned by the scroll container (px-3 = 12px).
          Children MUST NOT add their own px-* / mx-* wrappers — this keeps
          every card, section header, triage row and accordion flush to the
          same 12px lane. DS v5 §4.1 spacing scale; sticky footer retains
          px-4 per §8.9. */}
      <div className="olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {/* Top status banner — strict precedence: failed > blocked > recommendations > ready */}
        <StatusBanner
          state={bannerState}
          onRetry={canRetryDraft ? handleRetryDraft : undefined}
          isRetrying={isRetrying}
        />

        {/* Draft error detail — only renders in failed state, full opacity above the
            de-emphasised content. Sits directly below the banner.
            Expert-mode gating: the correlation ID row is a developer-facing
            detail and is hidden from non-expert users. */}
        {isFailed && lastDraftError && (
          <div
            className="rounded-md bg-panel border border-panel-border border-t-[3px] border-t-danger px-4 py-2.5"
            data-testid="draft-error-card"
          >
            <p className={`${typography.panelHeader} text-danger`}>Draft failed</p>
            <p className={`${typography.panelBody} text-text-body mt-0.5`}>{lastDraftError.message}</p>
            {expertMode && lastDraftError.correlationId && (
              <p className={`${typography.panelMeta} text-text-light mt-0.5 font-mono`} data-testid="draft-error-correlation-id">
                ID: {lastDraftError.correlationId}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {lastDraftError.retryable === false ? (
                <button
                  type="button"
                  onClick={handleEditBrief}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success transition-colors`}
                  data-testid="draft-error-edit-brief"
                >
                  <Pencil size={12} />
                  Edit brief
                </button>
              ) : canRetryDraft ? (
                <button
                  type="button"
                  onClick={handleRetryDraft}
                  disabled={isRetrying}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  data-testid="draft-error-retry"
                >
                  <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                  {isRetrying ? 'Retrying…' : 'Retry Draft'}
                </button>
              ) : null}
              {expertMode && (
                <button
                  type="button"
                  onClick={() => {
                    const diagnostics = {
                      message: lastDraftError.message,
                      status: lastDraftError.status,
                      correlationId: lastDraftError.correlationId,
                      timestamp: new Date(lastDraftError.timestamp).toISOString(),
                    }
                    copyTextToClipboard(JSON.stringify(diagnostics, null, 2))
                    showToast('Diagnostics copied', 'success')
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-text-light bg-panel border border-panel-border rounded-full hover:bg-panel-hover transition-colors`}
                  data-testid="draft-error-copy-diagnostics"
                >
                  <Copy size={12} />
                  Copy diagnostics
                </button>
              )}
            </div>
            {lastDraftError.retryable === false && (
              <div className="mt-2 rounded-md bg-panel border border-panel-border px-2.5 py-2">
                <p className={`${typography.panelMeta} text-text-body mb-1`}>Tips for a clearer brief</p>
                <ul className={`${typography.panelMeta} text-text-light space-y-0.5 list-disc pl-3.5`}>
                  <li>State one clear goal</li>
                  <li>List 2–3 options you're considering</li>
                  <li>Mention key factors that matter to your decision</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Three-bucket content + health row. In failed state, de-emphasise everything
            (health, banners, sections) so only the banner and error detail above stay
            at full opacity. */}
        <div className={`space-y-4 ${isFailed ? 'opacity-60 pointer-events-none' : ''}`}>

          {/* Brief 5.8A post-D7 round 2: enriched draft-failure blockers
              (e.g. "Options need configuration") render at the TOP of the
              panel content, above the T1 card. They are recovery
              affordances (multi-action retry / edit brief / focus node)
              and burying them below coaching surfaces would leave the
              user unable to find the path forward. The comment block
              previously documented "ABOVE T1" placement but the JSX had
              drifted below — this corrects the position to match the
              documented intent. */}
          {!data.isReady && visibleEnrichedBlockers.length > 0 && (
            <SectionErrorBoundary section="Blockers">
              <BlockersSection
                blockers={visibleEnrichedBlockers}
                informationalBlockers={[]}
                canRetryDraft={canRetryDraft}
                isRetrying={isRetrying}
                lastDraftRetryable={lastDraftError?.retryable}
                onRetryDraft={handleRetryDraft}
                onEditBrief={handleEditBrief}
                onFocusNode={handleFocusNode}
              />
            </SectionErrorBoundary>
          )}

          {/* Brief 5.8A D3a: T1 "Decision readiness" card. The .sc wrapper
              hosts the ring + 4 dimension bars (ModelHealthCard compact mode),
              followed by failing-check rows and the narrative bridge. D3b
              will absorb the unified triage queue here; D3c will add the
              bias .nudge rows, WhatOlumiAddedSection, contribution row and
              checks footer. The wrapper is deliberately additive in D3a so
              the existing Must fix / review-tier / improve-confidence-tier
              sections continue to render unchanged below.

              Loading-state escape hatch: ModelHealthCard renders its own
              "Generating your decision model..." panel when isLoading and
              no goal node exists. In that case the T1 wrapper would just
              draw an empty extra border around it, so we drop the wrapper
              for that one render path and let ModelHealthCard own the
              panel chrome (matches its existing rounded-lg + border-panel-border). */}
          <SectionErrorBoundary section="Model health">
            {data.isLoading && data.nodesByKind.goal.length === 0 ? (
              <ModelHealthCard
                compact
                completeness={completeness}
                evidence={evidence}
                balance={balance}
                calibration={calibration}
                optionCount={data.optionPreviews.length}
                goalLabel={data.goalNode ? ((data.goalNode.data as { label?: string })?.label ?? null) : null}
                coachingSummary={data.coachingSummary}
                dynamicHeadline={dynamicHeadline}
                isLoading={data.isLoading}
                hasGoalNode={false}
              />
            ) : (
              <T1DecisionReadinessCard
                completeness={completeness}
                evidence={evidence}
                balance={balance}
                calibration={calibration}
                optionCount={data.optionPreviews.length}
                goalLabel={goalLabel}
                coachingSummary={data.coachingSummary}
                dynamicHeadline={dynamicHeadline}
                isLoading={data.isLoading}
                hasGoalNode={hasGoalNode}
                hasGoalTarget={hasGoalTarget}
                failingChecks={failingChecks}
                topThree={unifiedTopThree}
                alsoConsider={unifiedAlsoConsider}
                handlers={t1Handlers}
                biasNudges={biasTriggers}
                priorityProgress={priorityProgress}
                wideningSlot={wideningSlot}
                missingKnowledgeSlot={missingKnowledgeSlot}
              />
            )}
          </SectionErrorBoundary>

          {/* Brief 5.8A D4: T1 "Your options" card. Renders as its own .sc
              card directly after T1 Decision readiness. Always visible when
              the model has at least one option preview. The same_levers
              coaching line is still gated inside the component itself. */}
          {data.optionPreviews.length > 0 && (
            <SectionErrorBoundary section="Your options">
              {/* Post-deploy correction P0 #1: drop
                  `collapseInterventionsByDefault` so each option's
                  intervention deltas render under the option name on
                  first render (no per-option "Show N changes" click).
                  `opt.interventions` data is already in the payload —
                  this is a rendering toggle, not a contract change. */}
              <OptionPreview
                options={data.optionPreviews}
                onFocusNode={handleFocusNode}
                onHoverEnter={handleHoverElement}
                onHoverLeave={handleHoverClear}
                onSendMessage={onSendMessage}
                hasSameLeversCheck={data.qualityChecks.some(c => c.id === 'same_levers')}
              />
            </SectionErrorBoundary>
          )}

          {/* Brief 5.8A D5: T2 Sharpen your thinking accordion. Self-suppresses
              when no bias trigger or framing condition produces a card. The
              D2-filtered biasTriggers list flows in directly — no per-consumer
              refilter. Framing conditions read from the goal node observed
              state + successThreshold. */}
          <SectionErrorBoundary section="Sharpen your thinking">
            <SharpenYourThinking
              biasTriggers={biasTriggers}
              hasGoalBaseline={(() => {
                const observed = data.goalNode?.data && (
                  (data.goalNode.data as { observedState?: { value?: unknown } }).observedState
                  ?? (data.goalNode.data as { observed_state?: { value?: unknown } }).observed_state
                )
                return observed != null && (observed as { value?: unknown }).value != null
              })()}
              hasSuccessTarget={data.successThreshold !== null}
              goalHasQuantitativeHint={(() => {
                const goalData = data.goalNode?.data as { goal_threshold_unit?: string; goal_threshold_cap?: number } | undefined
                return goalData?.goal_threshold_unit != null || goalData?.goal_threshold_cap != null
              })()}
              onSetCurrentValue={handleSetTargetFocus}
              onSetTarget={handleSetTargetFocus}
            />
          </SectionErrorBoundary>

          {/* Brief 5.8A holistic-review pass: legacy Must fix section
              consolidated into T1.
                - Critical fix triage cards (mustFixCards) → unified queue
                  inside T1 (sorted first by source order so they remain
                  analysis-blocking and visually emphasised as card #1).
                - Structural check rows (Fewer than 2 options, No baseline)
                  → T1 failing-checks block via T1FailingCheckRow.
                - Enriched draft-failure blockers (BlockersSection) →
                  rendered at the TOP of the panel content above T1 so
                  the recovery affordances are not buried (see block
                  above). */}

          {/* Informational (non-blocking) blockers — surfaced regardless of bucket */}
          {data.informationalBlockers.length > 0 && (
            <SectionErrorBoundary section="Notes">
              <BlockersSection
                blockers={[]}
                informationalBlockers={data.informationalBlockers}
                canRetryDraft={false}
                isRetrying={false}
                lastDraftRetryable={undefined}
                onRetryDraft={handleRetryDraft}
                onEditBrief={handleEditBrief}
              />
            </SectionErrorBoundary>
          )}

          {/* Brief 5.8A holistic-review pass — legacy review-tier section
              removed entirely. Triage cards live in the T1 unified queue,
              bias rows live in the T1 nudge block, OptionPreview is its
              own .sc card, the option-quality card is gated inside
              OptionPreview itself, and the Start here render is gone.
              Two surfaces are preserved as small standalone fragments:
                1. Resolved-state rows (confirm-undo affordance) — short-
                   lived feedback rows that disappear once Hook B
                   re-derives. Surfaced inline so the user sees their
                   confirmation acknowledged.
                2. "See all relationships" link — opens the Model tab
                   focused on the relationships section. Anchored on the
                   presence of edge items in the unified queue. */}
          {resolvedSignals.size > 0 && (
            <div className="flex flex-col gap-1" data-testid="resolved-signals-block">
              {Array.from(resolvedSignals.values()).map(entry => (
                <div
                  key={`resolved-${entry.signalId}`}
                  className={`flex items-center gap-2 px-2 py-1 text-success ${prefersReducedMotion ? '' : 'transition-opacity duration-200'}`}
                  data-testid="resolved-signal-row"
                >
                  <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelMeta} flex-1 truncate`}>
                    {entry.label} confirmed
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUndoResolved(entry.signalId)}
                    className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
                    aria-label={`Undo confirmation of ${entry.label}`}
                    data-testid={`undo-${entry.signalId}`}
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
          {(() => {
            const causalEdgeCount = getCausalEdges(nodes, edges as Edge<EdgeData>[]).length
            if (causalEdgeCount === 0) return null
            const verifyItems = data.improvementsByCategory.verify ?? []
            const edgeItemKeys = new Set(
              verifyItems.filter(item => item.focus?.type === 'edge').map(item => item.key),
            )
            if (edgeItemKeys.size === 0) return null
            const hasVisibleEdgeCard = unifiedTriageQueue.some(entry => edgeItemKeys.has(entry.card.key))
            if (!hasVisibleEdgeCard) return null
            const handleClick = () => {
              useUIStore.getState().requestModelTabSection('relationships')
              useUIStore.getState().setActiveOutputTab('diagnostics')
            }
            return (
              <button
                type="button"
                onClick={handleClick}
                className={`${typography.panelMeta} text-info hover:underline self-start inline-flex items-center gap-1 mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
                data-testid="preanalysis-see-all-relationships"
              >
                <LinkIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                See all {causalEdgeCount} relationships in model tab ›
              </button>
            )
          })()}

          {/* Brief 5.8A holistic-review pass: ImproveConfidenceAccordion
              removed entirely. SuccessTarget moves into the T3 Advanced
              accordion below so the panel hierarchy is exactly T1 → T2 → T3
              with no orphan "additional controls" surface. The "Set target"
              affordance inside the T1 failing-checks block routes the user
              to the inspector when the goal target needs editing — the
              SuccessTarget editor stays available for power-users via T3. */}

          {/* Minimal graph coaching — pre-run guidance, not blocker */}
          {isMinimalGraph && (
            <div
              className="flex items-start gap-2 px-4 py-2.5 bg-panel border border-info/30 rounded-md"
              role="status"
              data-testid="minimal-graph-coaching"
            >
              <AlertTriangle className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className={`${typography.panelBody} text-info`}>
                Your model needs more detail for a meaningful analysis. Try adding factors that influence your outcome.
              </p>
            </div>
          )}

          {/* Brief 5.8A D3b: DraftStrengthenSection removed. Strengthen items
              now overlay onto matching unified-queue triage cards via the
              strengthenOverlayMap (case-insensitive trim match). Items that
              do not match a triage label are silently skipped — they have no
              actionable target on their own. */}

          {/* Brief 5.8A D6: T3 Advanced accordion — collapsed by default, no
              preview line. Inventory at land time:
                - Goal selector (only currently-mounted advanced control)
              Future surfaces (risk appetite, graph statistics, simulation
              settings) land in Brief 5.8B/5.9 when their data sources are
              wired. The accordion stays mounted now so the IA slot is
              reserved and hooks future expansion behind a single
              consistent surface. */}
          {data.nodesByKind.goal.length > 0 && (
            <SectionErrorBoundary section="Advanced">
              <AnalysisSettings
                goalNodes={data.nodesByKind.goal}
                selectedGoalNode={data.goalNode}
                onGoalChange={handleGoalChange}
              >
                <SuccessTarget
                  goalNode={data.goalNode}
                  goalNodes={data.nodesByKind.goal}
                  successThreshold={data.successThreshold}
                  isThresholdAutoDerived={data.isThresholdAutoDerived}
                  isThresholdConfirmed={data.isThresholdConfirmed}
                  thresholdProvenance={data.thresholdProvenance}
                  onThresholdChange={handleThresholdChange}
                  onThresholdConfirm={handleThresholdConfirm}
                  onThresholdEdit={handleThresholdEdit}
                  onGoalChange={handleGoalChange}
                  goalThresholdRaw={data.goalThresholdRaw}
                  goalThresholdUnit={data.goalThresholdUnit}
                  thresholdSourceBadge={data.thresholdSourceBadge}
                  onFocusNode={handleFocusNode}
                  onHoverEnter={(id) => handleHoverElement('node', id)}
                  onHoverLeave={handleHoverClear}
                  constraintFeasibilityWarning={hasConstraintFeasibilityWarning}
                  goalConstraints={ceeAnalysisReady?.goal_constraints}
                  onSendMessage={onSendMessage}
                />
              </AnalysisSettings>
            </SectionErrorBoundary>
          )}
        </div>
      </div>

      {/* 8. Sticky Footer (pinned to bottom)
          v2: status text mirrors top banner — Blocked when Must fix has items
          (covers structural checks + critical Fix cards + enriched blockers),
          Ready otherwise. Disable state stacks both signals so the button is
          disabled whenever the API says !isReady OR Must fix has items.
          The "0/N addressed" meta is removed (redundant with section counts). */}
      <StickyFooter
        isReady={data.isReady && mustFixCount === 0}
        hasBlockers={data.hasBlockers || mustFixCount > 0}
        blockerCount={Math.max(data.blockerCount, mustFixCount)}
        isAnalysing={isAnalysing}
        onAnalyse={onAnalyse}
        blockedReason={blockedReason}
        isLoading={data.isLoading}
        isRetrying={isRetrying}
      />
    </div>
  )
}

export default PreAnalysisPanel

/**
 * AdvancedSection — Phase 4 Task 5
 *
 * Collapsed-by-default accordion with:
 * - Risk tolerance slider (3 preset positions)
 * - Analysis details grid (stability, convergence, edges, graph size, identifiability, seed, hash)
 *
 * Wired to useRiskProfile hook for preset selection.
 * Hash row supports copy-to-clipboard.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Copy, Check, AlertTriangle, Gauge, Eye } from 'lucide-react'
import { typography } from '../../styles/typography'
import { evaluativeVar } from '../../styles/evaluative'
import { Accordion } from './Accordion'
import { selectHumanisedInferenceWarnings } from './utils/humaniseInferenceWarning'
import { useRiskProfile, RISK_PRESETS } from '../../canvas/hooks/useRiskProfile'
import { derivePostFooterStatus } from '../../canvas/components/utils/postAnalysisFooter'
import type { RobustnessDisplayVerdict } from './types'
import type { LensAppetite } from './utils/selectLensOption'
import { LENS_COPY } from './utils/goalAnchorCopy'

type RiskPresetKey = keyof typeof RISK_PRESETS

export type RiskAppetite = 'conservative' | 'neutral' | 'aggressive'

// ── D1 (ask #16): freshness_reason-as-receipt doctrine — UNRULED ────────────
// The freshness reason code (e.g. 'graph_hash_match') is doctrine-marked
// "debug only, never user copy". v6's receipt row would promote it. Both
// branches are built here so the ruling picks one with a ONE-LINE change and
// NO rebuild — and with NO runtime flag (per no-dark-launches):
//   'omit'      → the Freshness receipt row is never rendered (fail-closed
//                 interim default per the D1 ruling).
//   'translate' → the row renders a curated en-GB phrase for known reason
//                 codes only; unknown codes fail closed to omit.
// Flip THIS constant to 'translate' to activate branch (b). The compile-time
// union keeps both branches type-live and unit-testable (translateFreshness-
// Reason is exercised directly) without either becoming unreachable code.
export const FRESHNESS_RECEIPT_D1_MODE: 'omit' | 'translate' = 'omit'

// Curated code → en-GB copy. Unknown/absent codes fail closed to null (row
// omitted) — the raw wire string is NEVER surfaced (reason codes are
// debug-only per doctrine, analysisFreshness.ts:33).
const FRESHNESS_REASON_COPY: Readonly<Record<string, string>> = {
  graph_hash_match: 'Graph hash match',
  graph_hash_mismatch: 'Model changed since this analysis',
  no_prior_analysis: 'No prior analysis',
}

/**
 * Branch (b) translator for the D1 freshness receipt. Returns the curated
 * phrase for a known reason code, or null for any unknown/absent code (row
 * omitted). Never echoes the raw wire string. Exported for direct unit tests
 * so the un-mounted branch stays covered.
 */
export function translateFreshnessReason(
  reason: string | null | undefined,
): string | null {
  if (typeof reason !== 'string') return null
  return FRESHNESS_REASON_COPY[reason] ?? null
}

export interface AdvancedSectionProps {
  /**
   * @deprecated Do NOT render. `recommendation_stability` is DEPRECATED and no
   * longer emitted by the producer (vendored 0.15.0 enrichment.js:250-262 — it
   * was byte-identical to the leader's win_probability). The receipts
   * "Result stability" row keys on the display-safe `robustnessVerdict`
   * instead. This prop is accepted-but-ignored solely so the negative pin can
   * prove no recommendation_stability-sourced value is rendered.
   */
  stability?: number | null
  /**
   * Display-safe robustness verdict (producer `robustness.display_verdict`,
   * normalised fail-closed upstream). Drives the "Result stability" receipt
   * row via `derivePostFooterStatus` — the SAME verdict contract as the
   * (retired) post-analysis footer. Absent/undefined → "Robustness unknown".
   */
  robustnessVerdict?: RobustnessDisplayVerdict | null
  /**
   * Freshness reason code from the analysis-freshness slice (e.g.
   * 'graph_hash_match'). Consumed only by the D1 'translate' branch of the
   * Freshness receipt row; ignored while FRESHNESS_RECEIPT_D1_MODE is 'omit'.
   */
  freshnessReason?: string | null
  /**
   * True when `responseHash` is a device-derived local content hash (V5 path)
   * rather than a producer/engine hash. Labels the hash row so a local hash is
   * never read as an engine identity.
   */
  responseHashIsLocal?: boolean
  /** Number of simulations */
  nSamples?: number | null
  /** Seed used for reproducibility */
  seedUsed?: number | null
  /** Number of fragile edges */
  fragileEdgeCount?: number
  /** Number of robust/stable edges */
  robustEdgeCount?: number
  /** Graph node count */
  nodeCount?: number
  /** Graph edge count */
  edgeCount?: number
  /** Model identifiability tag */
  identifiability?: string | null
  /** Response hash */
  responseHash?: string | null
  /** Callback when risk profile changes (triggers re-weight) */
  onRiskProfileChange?: (preset: RiskPresetKey) => void
  /** Trust narrative: full M2 narrative summary */
  m2NarrativeSummary?: string
  /** Trust narrative: trust level label */
  trustLevel?: string
  /** Trust narrative: trust reason */
  trustReason?: string
  /** Readiness dimensions for trust section bars */
  coachingReadinessDimensions?: { evidence: number; robustness: number; clarity: number }
  /** Identifiability tag for trust advisory */
  identifiabilityTag?: string | null
  /** Winner win probability for stats */
  winnerWinProbability?: number | null
  /** Count of factors using default estimates */
  defaultEstimateCount?: number
  /** Total factor count */
  totalFactorCount?: number
  /** Robustness level for stats */
  robustnessLevel?: string
  /** Task 10: Show analysis details (expert mode gate) */
  expertMode?: boolean
  /** Brief 4 Task 12: inference warnings surfaced inside the trust narrative. */
  inferenceWarnings?: Array<{ code: string; message?: string }>
}

const PRESET_ORDER: RiskPresetKey[] = ['risk_averse', 'neutral', 'risk_seeking']

export function AdvancedSection({
  // `stability` (recommendation_stability) is intentionally NOT destructured —
  // it is accepted but never rendered (see the prop's @deprecated note). The
  // "Result stability" row uses `robustnessVerdict` below.
  robustnessVerdict,
  freshnessReason,
  responseHashIsLocal,
  nSamples,
  seedUsed,
  fragileEdgeCount,
  robustEdgeCount,
  nodeCount,
  edgeCount,
  identifiability,
  responseHash,
  onRiskProfileChange,
  m2NarrativeSummary,
  trustLevel,
  trustReason,
  coachingReadinessDimensions,
  identifiabilityTag,
  defaultEstimateCount,
  totalFactorCount,
  expertMode = false,
  inferenceWarnings,
}: AdvancedSectionProps) {
  const { profile, selectPreset, loading } = useRiskProfile()
  const [copiedHash, setCopiedHash] = useState(false)
  const [narrativeExpanded, setNarrativeExpanded] = useState(false)
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const narrativeRef = useRef<HTMLParagraphElement>(null)
  const [narrativeClamped, setNarrativeClamped] = useState(false)
  // Brief 4 Task 11: pre-analysis CEE may have applied model adjustments.
  // Detect if the narrative text overflows 3 lines
  useEffect(() => {
    const el = narrativeRef.current
    if (!el) return
    setNarrativeClamped(el.scrollHeight > el.clientHeight)
  }, [m2NarrativeSummary])

  const handlePresetClick = useCallback(async (preset: RiskPresetKey) => {
    await selectPreset(preset)
    onRiskProfileChange?.(preset)
  }, [selectPreset, onRiskProfileChange])

  const handleCopyHash = useCallback(async () => {
    if (!responseHash) return
    try {
      await navigator.clipboard.writeText(responseHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    } catch {
      // Fallback — no-op if clipboard unavailable
    }
  }, [responseHash])

  // Result-stability verdict for the receipts row — the display-safe
  // `robustnessVerdict` mapped through the shared verdict contract
  // (`derivePostFooterStatus`). NEVER the deprecated recommendation_stability.
  const resultStabilityLabel = derivePostFooterStatus(robustnessVerdict).label

  // D1 branch (b) copy — resolved once, consumed only when the mode is
  // 'translate'. Unknown/absent reason codes → null (row omitted).
  const freshnessReceiptCopy = translateFreshnessReason(freshnessReason)

  // Format identifiability for display
  const identifiabilityLabel = identifiability
    ? identifiability.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    : null

  // Phase 8 hotfix (Item 4): when the envelope includes inference warnings,
  // auto-expand so stability caveats aren't hidden inside a collapsed
  // accordion. Warnings live inside the trust narrative in this section
  // per brief Task 12, so the collapse default would otherwise suppress
  // them until the user clicks.
  const hasInferenceWarnings = selectHumanisedInferenceWarnings(inferenceWarnings).length > 0

  return (
    <Accordion
      title="Advanced and receipts"
      defaultExpanded={hasInferenceWarnings}
      testId="accordion-advanced"
    >
      <div className="space-y-4">
        {/* ── Risk profile ─────────────────────────────── */}
        {/* Brief 5 Task 6: persistent-profile control, distinct from the local
            display-filter "Show winner by" in ResultsBody. Helper disambiguates
            the two surfaces. */}
        <div data-testid="risk-profile-control">
          {/* Brief 5.1 Task 6: gauge icon signals "persistent profile"
              (a setting applied to every rerun), differentiating this
              from the transient "Show winner by" view filter in
              ResultsBody. No state change — visual only. */}
          <h4 className={`${typography.panelHeader} text-text-header mb-1 flex items-center gap-1.5`}>
            <Gauge size={14} className="text-text-light" aria-hidden="true" />
            <span>Risk profile</span>
          </h4>
          <p className={`${typography.panelMeta} text-text-light italic mb-2`}>
            Persistent profile: used when analysis is rerun.
          </p>
          <div className="flex gap-1" role="radiogroup" aria-label="Risk profile">
            {PRESET_ORDER.map(preset => {
              const info = RISK_PRESETS[preset]
              const isSelected = profile?.profile === preset
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={loading}
                  onClick={() => handlePresetClick(preset)}
                  className={`
                    flex-1 px-2 py-1.5 rounded-md border text-center transition-colors
                    ${typography.panelBody}
                    ${isSelected
                      ? 'border-info bg-panel text-text-header'
                      : 'border-panel-border text-text-light hover:border-info/50'
                    }
                    disabled:opacity-50
                  `}
                >
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Brief 5.8B follow-up (P1.5): "Show winner by" filter relocated
            to the Your options card so the option-level toggle sits with
            the option cards it reweights. AdvancedSection still owns the
            persistent Risk profile above. */}

        {/* ── Trust Narrative (scroll target for hero "more" link) ── */}
        <div id="trust-narrative">
          <h4 className={`${typography.panelHeader} text-text-header mb-1`}>
            Trust narrative
          </h4>
          <div className={`${typography.panelMeta} text-text-light space-y-2`} style={{ lineHeight: 1.5 }}>
            {/* Trust reason summary */}
            {(trustLevel || trustReason) && (
              <p>
                {trustLevel && <>{trustLevel.charAt(0).toUpperCase()}{trustLevel.slice(1)} confidence. </>}
                {trustReason && <>{trustReason.charAt(0).toUpperCase()}{trustReason.slice(1)}. </>}
              </p>
            )}

            {/* ⛔ F10. This sentence used to live INSIDE the paragraph above,
                so it rendered only when `trustLevel` or `trustReason` was
                supplied — and NO CALL SITE SUPPLIES EITHER. It was therefore
                dead twice over: its own two props were unwired, and the gate
                enclosing it was unsatisfiable. Wiring only the counts would
                have left it invisible, and a component-level test that passes
                `trustLevel` would not have noticed.
                It is an independent disclosure about the analysis's own
                defaults; it does not depend on unrelated trust copy, so it
                stands on its own condition. */}
            {defaultEstimateCount != null && totalFactorCount != null && defaultEstimateCount > 0 && (
              <p data-testid="default-estimate-disclosure">
                {defaultEstimateCount} of {totalFactorCount} factors use default confidence values.
              </p>
            )}

            {/* M2 full narrative — clamped to 3 lines with "Read more" (Task 10) */}
            {m2NarrativeSummary && (
              <div>
                <p
                  ref={narrativeRef}
                  className={narrativeExpanded ? '' : 'line-clamp-3'}
                >
                  {m2NarrativeSummary}
                </p>
                {(narrativeClamped || narrativeExpanded) && (
                  <button
                    type="button"
                    onClick={() => setNarrativeExpanded(e => !e)}
                    className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-0.5`}
                  >
                    {narrativeExpanded ? 'Read less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* Readiness bars */}
            {coachingReadinessDimensions && (
              <div className="mt-2" data-testid="advanced-readiness-bars">
                {(['evidence', 'robustness', 'clarity'] as const).map(dim => {
                  const value = coachingReadinessDimensions[dim]
                  if (value == null) return null
                  const pct = Math.round(value * 100)
                  const label = dim === 'clarity' ? 'Framing' : dim.charAt(0).toUpperCase() + dim.slice(1)
                  return (
                    <div key={dim} className="flex items-center gap-2 mb-1">
                      <span className={`${typography.panelMeta} text-text-light text-right`} style={{ width: 80 }}>
                        {label}
                      </span>
                      <div className="flex-1 rounded-sm overflow-hidden" style={{ height: 5, backgroundColor: 'var(--border-default, #EEE6D8)' }}>
                        <div
                          className="rounded-sm transition-all duration-300"
                          style={{ width: `${pct}%`, height: 5, backgroundColor: evaluativeVar(value) }}
                        />
                      </div>
                      <span className={`${typography.panelMeta} text-text-light`} style={{ width: 30 }}>
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Identifiability advisory */}
            {identifiabilityTag === 'partially_identifiable' && (
              <p>Structural validity: Some limitations detected.</p>
            )}
            {identifiabilityTag === 'not_backdoor_identifiable' && (
              <p className="text-warning">Structural validity: Treat results as directional only.</p>
            )}

            {/* Brief 4 Task 12: inference warnings, capped at 3 with Show-all
                overflow. One AlertTriangle per warning.
                P0-3 fold: humanised by `code` via the shared view model
                (selectHumanisedInferenceWarnings) — never the raw producer
                `message`, which carries internal identifiers. */}
            {(() => {
              const relevant = selectHumanisedInferenceWarnings(inferenceWarnings)
              if (relevant.length === 0) return null
              const visible = showAllWarnings ? relevant : relevant.slice(0, 3)
              const hidden = relevant.length - visible.length
              return (
                <div data-testid="trust-inference-warnings">
                  <ul className="space-y-1">
                    {visible.map((w, i) => (
                      <li
                        key={`${w.code}-${i}`}
                        className="flex items-start gap-2"
                      >
                        <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{w.title}</span>
                      </li>
                    ))}
                  </ul>
                  {hidden > 0 && !showAllWarnings && (
                    <button
                      type="button"
                      onClick={() => setShowAllWarnings(true)}
                      className={`${typography.panelMeta} text-info hover:underline mt-1`}
                    >
                      Show all ({relevant.length})
                    </button>
                  )}
                  {showAllWarnings && relevant.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllWarnings(false)}
                      className={`${typography.panelMeta} text-info hover:underline mt-1`}
                    >
                      Show fewer
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Science limitations line */}
            <p>
              This analysis uses a simplified structural causal model. Some uncertainty sources (intercepts, node-level noise) are not yet captured.
            </p>
          </div>
        </div>

        {/* ── Analysis details (receipts) ──────────────────────────────
            Parity audit: the prototype's receipts are for EVERYONE — the
            expert-mode gate hid simulations/stability/graph-size from
            normal users. Real values only; rows fail closed when absent. */}
        <div data-testid="analysis-receipts">
          <h4 className={`${typography.panelHeader} text-text-header mb-1`}>
            Analysis details
          </h4>
          <dl className={`grid grid-cols-2 gap-x-4 gap-y-1.5 ${typography.panelMeta}`}>
            {/* Result stability — display-safe verdict only (never the
                deprecated recommendation_stability %). Fail-closed: a real
                producer verdict ('robust'|'moderate'|'fragile'|'not_assessed')
                renders its mapped label; an ABSENT verdict renders NO row —
                never a "Robustness unknown" placeholder row (no row beats an
                empty-value row, per the receipts fail-closed doctrine). */}
            {robustnessVerdict != null && (
              <div className="contents" data-testid="receipt-result-stability">
                <dt className="text-text-light">Result stability</dt>
                <dd className="text-text-header">{resultStabilityLabel}</dd>
              </div>
            )}
            {/* Simulations — path-conditional honesty: the count renders ONLY
                when the current run actually carries it (V2 path). On a pure
                V5 turn `meta` is stripped upstream so nSamples is null and the
                row is omitted — never a per-option or stale-prior-run number. */}
            {nSamples != null && (
              <>
                {/* Row 12: label carries the real wire field name (`meta.n_samples`). */}
                <dt className="text-text-light" title="meta.n_samples">Simulation quality</dt>
                <dd className="text-text-header">{nSamples.toLocaleString()} simulations</dd>
              </>
            )}
            {/* Freshness receipt — D1 (ask #16), UNRULED. Mounted branch is
                selected by FRESHNESS_RECEIPT_D1_MODE; default 'omit' renders
                nothing. 'translate' renders a curated phrase for known reason
                codes only. */}
            {FRESHNESS_RECEIPT_D1_MODE === 'translate' && freshnessReceiptCopy && (
              <div className="contents" data-testid="receipt-freshness">
                <dt className="text-text-light">Freshness</dt>
                <dd className="text-text-header">{freshnessReceiptCopy}</dd>
              </div>
            )}
            {fragileEdgeCount != null && (
              <>
                <dt className="text-text-light">Sensitive assumptions</dt>
                <dd className="text-text-header">{fragileEdgeCount}</dd>
              </>
            )}
            {robustEdgeCount != null && (
              <>
                <dt className="text-text-light">Stable edges</dt>
                <dd className="text-text-header">{robustEdgeCount}</dd>
              </>
            )}
            {(nodeCount != null || edgeCount != null) && (
              <>
                <dt className="text-text-light">Graph size</dt>
                <dd className="text-text-header">
                  {nodeCount != null ? `${nodeCount} nodes` : ''}
                  {nodeCount != null && edgeCount != null ? ', ' : ''}
                  {edgeCount != null ? `${edgeCount} edges` : ''}
                </dd>
              </>
            )}
            {identifiabilityLabel && (
              <>
                <dt className="text-text-light">Identifiability</dt>
                <dd className="text-text-header">{identifiabilityLabel}</dd>
              </>
            )}
            {seedUsed != null && (
              <>
                {/* Row 12: label carries the real wire field name (`meta.seed`). */}
                <dt className="text-text-light" title="meta.seed">Seed</dt>
                <dd className="text-text-header font-mono">{seedUsed}</dd>
              </>
            )}
            {responseHash && (
              <div className="contents" data-testid="advanced-hash-row">
                {/* Local (V5-derived) hashes are labelled so they are never
                    read as a producer/engine identity (a local hash is a
                    non-crypto content digest, not an engine receipt). */}
                <dt className="text-text-light">{responseHashIsLocal ? 'Hash (local)' : 'Hash'}</dt>
                <dd className="text-text-header flex items-center gap-1">
                  <span
                    className="font-mono truncate"
                    title={responseHashIsLocal ? `${responseHash} (locally derived — not an engine hash)` : responseHash}
                  >
                    {responseHash.slice(0, 12)}…
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="text-text-light hover:text-info flex-shrink-0"
                    aria-label="Copy hash to clipboard"
                    title="Copy hash to clipboard"
                  >
                    {copiedHash ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </Accordion>
  )
}

// ── RiskAppetiteFilter ──────────────────────────────────────────────────────
// D3: Moved here from ResultsBody to avoid circular imports. Transient display
// filter over the OUTCOME DISTRIBUTION — p10 / p50 / p90.

export interface RiskAppetiteFilterProps {
  value: RiskAppetite
  onChange: (next: RiskAppetite) => void
  /**
   * F3: does this run carry a goal ranking at all? Defaults FALSE — the safe
   * direction. A caller that omits it gets the neutral wording rather than an
   * assertion that a goal ranking exists, so forgetting the prop under-claims
   * instead of over-claiming.
   */
  hasGoalNumbers?: boolean
}

/**
 * The stored arm values are unchanged (`conservative` / `neutral` /
 * `aggressive`) — renaming them would churn every consumer for nothing. This
 * maps each to the quantity it ranks, which is what the re-anchoring
 * actually changed: the middle arm used to rank the comparative quantity and
 * now ranks p50, so all three arms are one quantity family (§6.5 item 5).
 */
export const LENS_ARM = {
  conservative: 'cautious',
  neutral: 'middle',
  aggressive: 'optimistic',
} as const satisfies Record<RiskAppetite, LensAppetite>

/**
 * Arm labels NAME THE QUANTITY. "Conservative / Neutral / Aggressive"
 * described a mood; the control ranks percentiles of the outcome
 * distribution, and saying so is what lets a reader tell the arms apart.
 */
const LENS_ARM_LABEL: Record<RiskAppetite, string> = {
  conservative: 'Cautious (p10)',
  neutral: 'Middle (p50)',
  aggressive: 'Optimistic (p90)',
}

export function RiskAppetiteFilter({
  value,
  onChange,
  hasGoalNumbers = false,
}: RiskAppetiteFilterProps) {
  return (
    <div data-testid="winner-by-control">
      <div className="flex items-center gap-1.5">
        {/* Eye icon signals "view filter" (what you see right now), distinguishing
            this display-only control from the persistent "Risk profile" above. */}
        <Eye size={12} className="text-text-light flex-shrink-0" aria-hidden="true" />
        {/* Re-anchored (§6 map): "Winner by:" named an endorsement the control
            does not confer — it re-ranks a view, and now every arm re-ranks it
            on the same quantity. The label says which. */}
        {/*
          ⭐ RE-ANCHORED 2026-08-01 (ROADMAP 2.237, P1-1). "Rank by outcome:"
          replaced "Winner by:" — correctly retiring an endorsement noun — but
          substituted a second false claim: the control does NOT rank. It
          highlights one card; `sortOptionsForDisplay` takes no lens argument
          and the list order, its truncation and its ordinals are all
          winProbability's. The label now names what the control actually does.
        */}
        <span className={`${typography.panelMeta} text-text-light`}>Highlight by outcome:</span>
        {/* Driven off LENS_ARM's own keys — this was a THIRD hardcoded arm
            list beside LENS_ARM and LENS_ARM_LABEL, and a fourth arm added to
            those two would have rendered nowhere. `satisfies
            Record<RiskAppetite, LensAppetite>` on LENS_ARM makes the cast a
            derived fact rather than an assertion: the keys ARE RiskAppetite,
            Object.keys just loses that. */}
        {(Object.keys(LENS_ARM) as RiskAppetite[]).map(appetite => (
          <button
            key={appetite}
            type="button"
            onClick={() => onChange(appetite)}
            className={`px-2 py-0.5 rounded-full ${typography.panelMeta} border cursor-pointer ${
              value === appetite
                ? 'border-info/60 text-info bg-transparent'
                : 'border-panel-border text-text-light bg-transparent hover:border-info/30 hover:text-text-body'
            }`}
          >
            {LENS_ARM_LABEL[appetite]}
          </button>
        ))}
      </div>
      {/* Paul's ruling 2026-07-12: honest lens framing — this control is a
          view lens over the option cards only. Re-anchored 2026-07-31: the
          un-anchored noun "the overall recommendation" is replaced by the
          thing that is actually unchanged, named as a quantity. */}
      <p className={`${typography.panelMeta} text-text-light italic mt-1`}>
        A view lens over the outcome range. {LENS_COPY.unchanged(hasGoalNumbers)}
      </p>
    </div>
  )
}

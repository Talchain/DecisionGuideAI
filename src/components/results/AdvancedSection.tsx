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
import { Copy, Check, Info, AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { evaluativeVar } from '../../styles/evaluative'
import { Accordion } from './Accordion'
import { useRiskProfile, RISK_PRESETS } from '../../canvas/hooks/useRiskProfile'
import { ExpertBlock } from './ExpertBlock'
import { useCanvasStore } from '../../canvas/store'

type RiskPresetKey = keyof typeof RISK_PRESETS

export interface AdvancedSectionProps {
  /** Recommendation stability (0-1) */
  stability?: number | null
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
  stability,
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
  winnerWinProbability,
  defaultEstimateCount,
  totalFactorCount,
  robustnessLevel,
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
  // Surface the count as an inline trust-narrative note pointing to the
  // Model tab (pre-analysis ModelAdjustments card is the detailed surface).
  const modelAdjustmentsCount = useCanvasStore(
    s => Array.isArray(s.ceeAnalysisReady?.model_adjustments)
      ? (s.ceeAnalysisReady?.model_adjustments?.length ?? 0)
      : 0,
  )

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

  const stabilityPct = stability != null ? Math.round(stability * 100) : null

  // Format identifiability for display
  const identifiabilityLabel = identifiability
    ? identifiability.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    : null

  return (
    <Accordion
      title="Advanced"
      defaultExpanded={false}
      testId="accordion-advanced"
    >
      <div className="space-y-4">
        {/* ── Risk Tolerance ─────────────────────────────── */}
        <div>
          <h4 className={`${typography.panelHeader} text-text-header mb-1`}>
            Risk tolerance
          </h4>
          <p className={`${typography.panelMeta} text-text-light italic mb-2`}>
            Re-weights the existing simulation, no new run required.
          </p>
          <div className="flex gap-1" role="radiogroup" aria-label="Risk tolerance">
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
                {defaultEstimateCount != null && totalFactorCount != null && defaultEstimateCount > 0 && (
                  <>{defaultEstimateCount} of {totalFactorCount} factors use default confidence values. </>
                )}
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

            {/* Brief 4 Task 12: inference warnings surfaced verbatim, capped
                at 3 with Show-all overflow. One AlertTriangle per warning. */}
            {(() => {
              const relevant = (inferenceWarnings ?? []).filter(
                w => typeof w.message === 'string' && w.message.trim().length > 0,
              )
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
                        <span>{w.message}</span>
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

            {/* Brief 4 Task 11: model-adjustments pointer to Model tab */}
            {modelAdjustmentsCount > 0 && (
              <p className="flex items-start gap-1.5">
                <Info size={14} className="text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Olumi applied {modelAdjustmentsCount} model adjustment{modelAdjustmentsCount === 1 ? '' : 's'} before analysis. See Model tab for details.
                </span>
              </p>
            )}

            {/* Science limitations line */}
            <p>
              This analysis uses a simplified structural causal model. Some uncertainty sources (intercepts, node-level noise) are not yet captured.
            </p>
          </div>
        </div>

        {/* ── Analysis Details — expert mode only (Task 10) ──────────── */}
        {expertMode && (
        <ExpertBlock>
          <h4 className={`${typography.panelHeader} text-text-header mb-1`}>
            Analysis details
          </h4>
          <dl className={`grid grid-cols-2 gap-x-4 gap-y-1.5 ${typography.panelMeta}`}>
            {stabilityPct != null && (
              <>
                <dt className="text-text-light">Stability</dt>
                <dd className="text-text-header">{stabilityPct}%</dd>
              </>
            )}
            {nSamples != null && (
              <>
                <dt className="text-text-light">Simulation quality</dt>
                <dd className="text-text-header">{nSamples.toLocaleString()} simulations</dd>
              </>
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
                <dt className="text-text-light">Seed</dt>
                <dd className="text-text-header font-mono">{seedUsed}</dd>
              </>
            )}
            {responseHash && (
              <>
                <dt className="text-text-light">Hash</dt>
                <dd className="text-text-header flex items-center gap-1">
                  <span className="font-mono truncate" title={responseHash}>
                    {responseHash.slice(0, 12)}…
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    className="text-text-light hover:text-info flex-shrink-0"
                    aria-label="Copy hash to clipboard"
                  >
                    {copiedHash ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </dd>
              </>
            )}
          </dl>
        </ExpertBlock>
        )}
      </div>
    </Accordion>
  )
}

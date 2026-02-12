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

import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Accordion } from './Accordion'
import { useRiskProfile, RISK_PRESETS } from '../../canvas/hooks/useRiskProfile'

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
}: AdvancedSectionProps) {
  const { profile, selectPreset, loading } = useRiskProfile()
  const [copiedHash, setCopiedHash] = useState(false)

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
            Re-weights the existing simulation — no new run required.
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
                      ? 'border-info bg-info-light text-text-header'
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

        {/* ── Analysis Details ────────────────────────────── */}
        <div>
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
                <dt className="text-text-light">Convergence</dt>
                <dd className="text-text-header">{nSamples.toLocaleString()} simulations</dd>
              </>
            )}
            {fragileEdgeCount != null && (
              <>
                <dt className="text-text-light">Fragile edges</dt>
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
        </div>
      </div>
    </Accordion>
  )
}

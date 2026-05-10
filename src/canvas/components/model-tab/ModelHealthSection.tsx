/**
 * ModelHealthSection — "Audit" section, collapsed by default.
 *
 * Collapsed view: stability %, overall quality score.
 * Expanded view: root node warnings, CEE quality sub-scores, audit trail
 *   (seed, hash, simulations, stability, auto-noise, penalty, repairs, warnings).
 *
 * Connectivity and evidence health cards removed — live in Analysis tab.
 */

import { useContext, useMemo } from 'react'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import type { CeeQualityDimensions } from '../../store'
import { DetailToggleContext } from './DetailToggleContext'
import type { AutoNoiseProvenance } from '../../../components/results/types'

/** Audit trail data from PLoT response */
export interface AuditTrailData {
  seedUsed: string | null
  responseHash: string | null
  nSamples: number | null
  repairsApplied: Array<{ code?: string; type?: string; field_path?: string; reason?: string }> | null
  inferenceWarnings: Array<{ code?: string; severity?: string; message?: string }> | null
  recommendationStability: number | null
  autoNoiseApplied: boolean | null
  /**
   * Audit B3 (P0): structured disclosure metadata for the auto-noise
   * adjustment. Null when the response is from an older PLoT build that
   * does not emit the field, or when normalisation rejected a malformed
   * payload — the accordion falls back to the legacy `autoNoiseApplied`
   * boolean and the visible marker simply does not render.
   */
  autoNoiseProvenance: AutoNoiseProvenance | null
  stabilityPenaltyFactor: number | null
}

interface ModelHealthSectionProps {
  ceeQuality?: CeeQualityDimensions | null
  /** Audit trail from PLoT response metadata */
  auditTrail?: AuditTrailData
  /** Total factor count for pre-analysis summary */
  factorCount?: number
  /** Total edge count for pre-analysis summary */
  edgeCount?: number
  /** Number of factors needing verification */
  factorsToVerify?: number
  /** Controlled expansion state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void
  onSendMessage?: (message: string) => void
}

// ── Quality score row ──────────────────────────────────────────────────────────

function QualityRow({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100))
  const barColour = score >= 7 ? 'bg-success' : score >= 4 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="flex items-center gap-2" data-testid={`quality-row-${label.toLowerCase()}`}>
      <span className={`${typography.panelMeta} text-text-light w-20 shrink-0`}>{label}</span>
      <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${typography.panelMeta} text-text-body font-mono w-6 text-right tabular-nums`}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

// ── Section inner ──────────────────────────────────────────────────────────────

function ModelHealthSectionInner({
  ceeQuality,
  auditTrail,
  factorCount,
  edgeCount,
  factorsToVerify,
  isExpanded,
  onExpandChange,
  onSendMessage,
}: ModelHealthSectionProps) {
  const { showDetail } = useContext(DetailToggleContext)

  // Root node default value warnings from inference_warnings
  const rootNodeWarningCount = useMemo(() => {
    if (!auditTrail?.inferenceWarnings) return 0
    return auditTrail.inferenceWarnings.filter(
      w => w?.code === 'ROOT_NODE_DEFAULT_VALUE'
    ).length
  }, [auditTrail?.inferenceWarnings])

  // Repairs summary: aggregate by code
  const repairsSummary = useMemo(() => {
    if (!auditTrail?.repairsApplied || auditTrail.repairsApplied.length === 0) return null
    const counts = new Map<string, number>()
    for (const r of auditTrail.repairsApplied) {
      const code = r.code ?? 'UNKNOWN'
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([code, count]) =>
      `${code} (x${count})`
    ).join(', ')
  }, [auditTrail?.repairsApplied])

  const hasAuditSignal =
    auditTrail != null && (
      auditTrail.seedUsed != null ||
      auditTrail.responseHash != null ||
      auditTrail.nSamples != null ||
      auditTrail.recommendationStability != null ||
      auditTrail.autoNoiseApplied != null ||
      auditTrail.stabilityPenaltyFactor != null ||
      (auditTrail.repairsApplied != null && auditTrail.repairsApplied.length > 0) ||
      (auditTrail.inferenceWarnings != null && auditTrail.inferenceWarnings.length > 0)
    )
  const hasQualitySignal = ceeQuality != null && ceeQuality.overall != null
  const isPreAnalysis = !hasAuditSignal && !hasQualitySignal

  // Collapsed summary visible in accordion header via tierLabel
  const stabilityLabel = auditTrail?.recommendationStability != null
    ? `${Math.round(auditTrail.recommendationStability * 100)}% stability`
    : null
  const qualityLabel = ceeQuality?.overall != null
    ? `${ceeQuality.overall.toFixed(1)} / 10`
    : null
  // Combine into a single header summary: "71% stability · 7.2 / 10"
  const headerSummary = [stabilityLabel, qualityLabel].filter(Boolean).join(' · ') || undefined

  return (
    <Accordion
      title="Model card"
      tierLabel={headerSummary}
      tierVariant={headerSummary ? 'fair' : undefined}
      defaultExpanded={false}
      isExpanded={isExpanded}
      onExpandChange={onExpandChange}
      testId="model-health-section"
    >
      <div className="space-y-1.5">

        {/* Pre-analysis content */}
        {isPreAnalysis && (
          <div data-testid="model-card-pre-analysis">
            {(factorCount != null || edgeCount != null) && (
              <p className={`${typography.panelBody} text-text-body`}>
                Based on {factorCount ?? 0} factor{factorCount !== 1 ? 's' : ''} and {edgeCount ?? 0} relationship{edgeCount !== 1 ? 's' : ''}
              </p>
            )}
            {factorsToVerify != null && factorsToVerify > 0 && (
              <p className={`${typography.panelMeta} text-text-light mt-1`}>
                {factorsToVerify} factor{factorsToVerify !== 1 ? 's need' : ' needs'} your input
              </p>
            )}
            <p className={`${typography.panelMeta} text-text-light mt-1`}>
              Run analysis to see stability, confidence, and reproducibility data
            </p>
          </div>
        )}

        {/* Post-analysis: methodology one-liner */}
        {auditTrail?.nSamples != null && (
          <p className={`${typography.panelBody} text-text-body`} data-testid="model-card-methodology">
            Based on {auditTrail.nSamples.toLocaleString('en-GB')} Monte Carlo simulations
          </p>
        )}

        {/* Root node warnings */}
        {rootNodeWarningCount > 0 && (
          <div
            className="flex items-center gap-1.5"
            data-testid="root-node-warning"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden="true" />
            <span className={`${typography.panelMeta} text-danger`}>
              {rootNodeWarningCount} factor{rootNodeWarningCount !== 1 ? 's have' : ' has'} no value set. This reduces analysis reliability.
              {auditTrail?.stabilityPenaltyFactor != null && auditTrail.stabilityPenaltyFactor < 1.0 && (
                <> Penalty: {auditTrail.stabilityPenaltyFactor.toFixed(2)}x stability</>
              )}
            </span>
          </div>
        )}

        {/* CEE quality sub-scores (full detail — Overall is in the header) */}
        {showDetail && ceeQuality && (
          <div>
            <div className={`${typography.panelMeta} text-text-light font-mono mb-1.5`}>Quality sub-scores (1-10)</div>
            <div className="space-y-1.5">
              <QualityRow label="Structure" score={ceeQuality.structure} />
              <QualityRow label="Causality" score={ceeQuality.causality} />
              <QualityRow label="Coverage" score={ceeQuality.coverage} />
              <QualityRow label="Safety" score={ceeQuality.safety} />
            </div>
          </div>
        )}

        {/* Full audit trail (detail toggle) */}
        {showDetail && auditTrail && (
          <div className="pt-1 border-t border-panel-border" data-testid="model-health-audit">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {auditTrail.seedUsed != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Seed</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>{auditTrail.seedUsed}</span>
                </>
              )}
              {auditTrail.responseHash != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Response hash</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right truncate`}>
                    {auditTrail.responseHash.slice(0, 12)}
                  </span>
                </>
              )}
              {auditTrail.nSamples != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Simulations</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {auditTrail.nSamples.toLocaleString('en-GB')}
                  </span>
                </>
              )}
              {auditTrail.recommendationStability != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Stability</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {(auditTrail.recommendationStability * 100).toFixed(0)}%
                  </span>
                </>
              )}
              {(() => {
                // Audit B3: prefer the explicit boolean echo, but fall
                // back to the structured provenance's `applied` field
                // when the boolean is null and provenance is valid. This
                // keeps the accordion useful under payload drift where
                // PLoT might emit the structured block alone (a
                // future-state we don't expect today, but defending
                // against costs nothing).
                const applied =
                  auditTrail.autoNoiseApplied
                  ?? auditTrail.autoNoiseProvenance?.applied
                  ?? null
                if (applied == null) return null
                return (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Outcome uncertainty adjustment</span>
                    <span
                      className={`${typography.panelMeta} text-text-body text-right`}
                      data-testid="model-health-auto-noise-row"
                    >
                      {applied
                        ? 'Operational adjustment applied (calibration pending).'
                        : 'No additional uncertainty adjustment applied.'}
                    </span>
                  </>
                )
              })()}
              {auditTrail.stabilityPenaltyFactor != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Stability penalty</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {auditTrail.stabilityPenaltyFactor.toFixed(2)}x
                  </span>
                </>
              )}
            </div>
            {/* Repairs summary */}
            {repairsSummary && (
              <div className="mt-2">
                <span className={`${typography.panelMeta} text-text-light`}>Repairs applied: </span>
                <span className={`${typography.panelMeta} text-text-body`}>{repairsSummary}</span>
              </div>
            )}
            {/* Inference warnings */}
            {auditTrail.inferenceWarnings && auditTrail.inferenceWarnings.length > 0 && (
              <div className="mt-2">
                <span className={`${typography.panelMeta} text-text-light`}>Inference warnings: </span>
                <span className={`${typography.panelMeta} text-text-body`}>
                  {auditTrail.inferenceWarnings.map(w => w?.code ?? 'UNKNOWN').join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
        {onSendMessage && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={() => onSendMessage('Help me understand the reliability and limitations of my model')}
              className="text-text-light hover:text-info cursor-pointer transition-colors"
              title="Discuss this with the AI"
              data-testid="modelcard-discuss"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </Accordion>
  )
}

export function ModelHealthSection(props: ModelHealthSectionProps) {
  return (
    <SectionErrorBoundary section="model-health">
      <ModelHealthSectionInner {...props} />
    </SectionErrorBoundary>
  )
}

/**
 * ModelHealthSection — "Audit" section, collapsed by default.
 *
 * Collapsed view: overall quality score.
 * Expanded view: root node warnings, CEE quality sub-scores, audit trail
 *   (seed, hash, simulations, auto-noise, penalty, repairs, warnings).
 *
 * Connectivity and evidence health cards removed — live in Analysis tab.
 *
 * ⛔ NO STABILITY PERCENTAGE (ROADMAP 2.1273). This card used to carry TWO
 * renders of `robustness.recommendation_stability` — the collapsed header
 * summary (`"{N}% stability · 7.2 / 10"`) and an audit-trail `Stability` row.
 * PLoT withholds that field deliberately: ISL derives it as
 * `option_wins[winner] / n_samples`, i.e. the leading option's
 * `win_probability` relabelled, carrying zero independent information. An
 * audit surface printing it as a distinct measurement is the most credible
 * possible place to show a number that is not one. Both renders, the
 * `AuditTrailData` field and its `hasAuditSignal` limb are gone — a legacy
 * hydrated payload still CARRIES the value, so a null-guard could not have
 * defended this. Absence pinned in
 * `__tests__/withheldStabilitySurfaces.honesty.spec.tsx`.
 * REINSTATEMENT TRIGGER: PLoT supplies a genuine numeric robustness/stability
 * field distinct from the leader's win probability.
 */

import { useContext, useMemo } from 'react'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import type { CeeQualityDimensions } from '../../store'
import { DetailToggleContext } from './DetailToggleContext'
import { describeAuditInferenceWarnings } from './auditInferenceWarnings'
import type { AutoNoiseProvenance } from '../../../components/results/types'

/** Audit trail data from PLoT response */
export interface AuditTrailData {
  seedUsed: string | null
  responseHash: string | null
  nSamples: number | null
  repairsApplied: Array<{ code?: string; type?: string; field_path?: string; reason?: string }> | null
  inferenceWarnings: Array<{ code?: string; severity?: string; message?: string }> | null
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

  // Audit-trail inference warnings: one row per code, sentence + code reference.
  const inferenceWarningRows = useMemo(
    () => describeAuditInferenceWarnings(auditTrail?.inferenceWarnings),
    [auditTrail?.inferenceWarnings],
  )

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
      // NOTE (2.1273): `recommendationStability` was a limb here. Removing it
      // narrows `hasAuditSignal` by exactly one field. Every real PLoT payload
      // that carried it also carries `seedUsed` / `responseHash` / `nSamples`,
      // so no live run changes branch; a hypothetical payload bearing ONLY the
      // withdrawn statistic now reads as pre-analysis, which is the honest
      // answer for a payload whose sole "signal" is a refuted quantity.
      auditTrail.autoNoiseApplied != null ||
      // Audit B3 (P0): provenance counts as an audit signal in its own
      // right. Without this, a payload-drift case where the boolean is
      // null but valid provenance exists would treat the whole section
      // as pre-analysis, producing mixed pre-analysis copy alongside the
      // provenance-fallback row that the audit-trail render block emits.
      auditTrail.autoNoiseProvenance != null ||
      auditTrail.stabilityPenaltyFactor != null ||
      (auditTrail.repairsApplied != null && auditTrail.repairsApplied.length > 0) ||
      (auditTrail.inferenceWarnings != null && auditTrail.inferenceWarnings.length > 0)
    )
  const hasQualitySignal = ceeQuality != null && ceeQuality.overall != null
  const isPreAnalysis = !hasAuditSignal && !hasQualitySignal

  // Collapsed summary visible in accordion header via tierLabel.
  // ⛔ The `"{N}% stability"` half is REMOVED (2.1273) — see the file header.
  // The summary is the quality score alone; the `.filter(Boolean).join(' · ')`
  // combiner went with it, since there is nothing left to combine.
  const qualityLabel = ceeQuality?.overall != null
    ? `${ceeQuality.overall.toFixed(1)} / 10`
    : null
  const headerSummary = qualityLabel ?? undefined

  return (
    <Accordion
      title="Model card"
      tierLabel={headerSummary}
      tierVariant={headerSummary ? 'fair' : undefined}
      // ⭐ OPEN ON ARRIVAL (29 Aug 2026). The card carries the seed, the
      // sample count, the VOI method and an explicit "Not reported by this
      // run" for everything the engines did not report — the product's
      // honesty story about its own compute, and it shipped shut.
      //
      // ⚠ THIS LINE ALONE DOES NOT OPEN THE CARD. It governs only the
      // UNCONTROLLED path (expert mode, where `makeSectionProps` returns
      // `{}`). With expert mode off the host passes `isExpanded`, the
      // Accordion is CONTROLLED, and this prop is inert — the initial
      // `openSection` state in `ModelTabBody` decides. Both paths are
      // pinned separately by `ModelTabBody.modelCardOpen.spec.tsx`.
      defaultExpanded
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
            {/*
              ⛔ "stability," WAS REMOVED FROM THIS SENTENCE (2.1273), and it is
              the same defect as the renders this row deletes — one step earlier.
              PLoT DELIBERATELY WITHHOLDS `robustness.recommendation_stability`
              and never emitted `ranking_stability` at all, so promising the user
              "stability" data before the run advertises a field the run cannot
              return. Removing the six renders while leaving the promise in place
              would trade a fabricated number for a broken one.
              Reinstating "stability" here requires PLoT to start emitting an
              independent stability measure — not a relabelled win probability.
            */}
            <p className={`${typography.panelMeta} text-text-light mt-1`}>
              Run analysis to see confidence and reproducibility data
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
              {/* ⛔ REMOVED (2.1273): the `Stability  {N}%` audit row. See the
                  file header — the quantity is the leading option's win
                  probability relabelled, so an audit receipt presenting it as a
                  separate measurement was the least honest place in the product
                  to print it. Do not reinstate without the trigger named there. */}
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
            {/* Inference warnings.
                The CODE STAYS — `results/utils/humaniseCritique.ts`'s generic
                fallback routes readers here for exactly that ("the raw code is
                listed in the run's audit details"), and its own comment ratifies
                that a machine code is correct content for an audit trail. What
                this row used to be missing is the SENTENCE: it rendered the code
                and nothing else, so a reader sent here to understand a
                limitation arrived at a bare enum. `describeAuditInferenceWarnings`
                resolves the sentence through that same owner — no copy is
                authored here — and never echoes the producer's diagnostic
                `message`, which interpolates raw node ids. */}
            {inferenceWarningRows.length > 0 && (
              <div className="mt-2">
                <span className={`${typography.panelMeta} text-text-light`}>Inference warnings: </span>
                <ul className="mt-1 space-y-1" data-testid="audit-inference-warnings">
                  {inferenceWarningRows.map(row => (
                    <li
                      key={row.code ?? '__no_code__'}
                      className={`${typography.panelMeta} text-text-body`}
                      data-testid="audit-inference-warning-row"
                    >
                      {row.text}
                      {row.code && (
                        <span className="text-text-light">
                          {` (${row.code}${row.count > 1 ? ` x${row.count}` : ''})`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
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

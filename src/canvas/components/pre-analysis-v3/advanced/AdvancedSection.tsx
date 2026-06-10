/**
 * AdvancedSection — collapsed analysis set-up detail. Renders only rows with
 * real data: model size (counts), readiness detail (CEE score + availability)
 * and provenance counts. Risk appetite and simulation settings are deferred
 * until a live settings surface backs them (no invented values).
 */

import { memo } from 'react'
import { Accordion } from '../../../../components/results/Accordion'
import { typography } from '../../../../styles/typography'
import { PANEL_COPY } from '../constants'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-h-[28px] grid-cols-[1fr_auto] items-center gap-2">
      <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
      <span className={`${typography.panelBody} text-text-body`}>{value}</span>
    </div>
  )
}

export const AdvancedSection = memo(function AdvancedSection({
  advanced,
}: {
  advanced: PreAnalysisModel['advanced']
}) {
  return (
    <div className="border-t border-panel-border" data-testid="pre-analysis-v3-advanced">
      <Accordion title={PANEL_COPY.advancedTitle} subtitle={PANEL_COPY.advancedMeta}>
        <div className="px-1">
          <Row
            label="Model size"
            value={`${advanced.factorCount} ${advanced.factorCount === 1 ? 'factor' : 'factors'} · ${advanced.connectionCount} ${advanced.connectionCount === 1 ? 'connection' : 'connections'}`}
          />
          {advanced.readinessScore != null && (
            <Row
              label="Readiness detail"
              value={`score ${advanced.readinessScore}${advanced.canRun ? ' · analysis available' : ''}`}
            />
          )}
          <Row
            label="Provenance"
            value={`${advanced.aiEstimatedCount} Olumi ${advanced.aiEstimatedCount === 1 ? 'estimate' : 'estimates'} · ${advanced.reviewedCount} checked by you`}
          />
        </div>
      </Accordion>
    </div>
  )
})

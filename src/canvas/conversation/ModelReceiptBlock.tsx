/**
 * ModelReceiptBlock — structured summary block rendered in conversation after
 * graph generation.
 *
 * Consumes only the stable view-model from selectModelReceiptData.
 * No direct reads from guidance_items, envelope fields, or patch timing.
 *
 * Phase 2B: Pre-analysis enrichment.
 */

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Wrench } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ModelReceiptData } from '../adapters/modelCardAdapter'

// ---------------------------------------------------------------------------
// § 1 — Readiness pill
// ---------------------------------------------------------------------------

function readinessPill(readiness: ModelReceiptData['readiness']) {
  switch (readiness) {
    case 'ready':
      return { text: 'Ready', className: 'text-success border border-success/30 bg-transparent' }
    case 'blocked':
      return { text: 'Blocked', className: 'text-danger border border-danger/30 bg-transparent' }
    case 'incomplete':
      return { text: 'Needs review', className: 'text-warning border border-warning/30 bg-transparent' }
    default:
      return { text: 'Unknown', className: 'text-text-light border border-text-light/30 bg-transparent' }
  }
}

// ---------------------------------------------------------------------------
// § 2 — Main component
// ---------------------------------------------------------------------------

interface ModelReceiptBlockProps {
  data: ModelReceiptData
}

export const ModelReceiptBlock = memo(function ModelReceiptBlock({ data }: ModelReceiptBlockProps) {
  const [adjustmentsExpanded, setAdjustmentsExpanded] = useState(false)

  const pill = readinessPill(data.readiness)

  const modelLine = [
    data.factorCount > 0 ? `${data.factorCount} factor${data.factorCount !== 1 ? 's' : ''}` : null,
    `${data.edgeCount} relationship${data.edgeCount !== 1 ? 's' : ''}`,
    data.optionCount > 0 ? `${data.optionCount} option${data.optionCount !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ')

  const targetLine = data.goalLabel ? ` targeting ${data.goalLabel}` : ''

  return (
    <div
      className="bg-surface-secondary rounded-lg shadow-s1 p-3 space-y-1.5"
      data-testid="model-receipt-block"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" aria-hidden="true" />
        <span className={typography.panelHeader}>Model generated</span>
        <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full ${pill.className}`}>
          {pill.text}
        </span>
      </div>

      {/* Model size */}
      <p className={`${typography.panelBody} text-text-body`}>
        {modelLine}{targetLine}
      </p>

      {/* Top insight */}
      {data.topInsight && (
        <p className={`${typography.panelBody} text-text-body`}>
          {data.topInsight}
        </p>
      )}

      {/* Top evidence gap */}
      {data.topEvidenceGap && (
        <p className={`${typography.panelMeta} text-text-light`}>
          Evidence gap: {data.topEvidenceGap}
        </p>
      )}

      {/* Adjustments */}
      {data.adjustments.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setAdjustmentsExpanded(!adjustmentsExpanded)}
            className={`${typography.panelMeta} text-text-light inline-flex items-center gap-1 hover:text-text-body transition-colors`}
            aria-expanded={adjustmentsExpanded}
            aria-controls="receipt-adjustments"
          >
            <Wrench className="w-3 h-3" aria-hidden="true" />
            Olumi made {data.adjustments.length} adjustment{data.adjustments.length !== 1 ? 's' : ''} to keep the model valid
            {adjustmentsExpanded
              ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
              : <ChevronRight className="w-3 h-3" aria-hidden="true" />
            }
          </button>

          {adjustmentsExpanded && (
            <ul
              id="receipt-adjustments"
              className="mt-1 space-y-0.5 pl-4"
              role="list"
            >
              {data.adjustments.map((a, i) => (
                <li key={i} className={`${typography.panelMeta} text-text-light`}>
                  <span className="font-medium text-text-body">{a.action}</span> {a.label}
                  {a.before != null && a.after != null && (
                    <span> ({a.before} → {a.after})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
})

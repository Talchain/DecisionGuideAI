/**
 * ModelCardLite — compact trust/reproducibility card at the top of the Model tab.
 *
 * Always renders when graph exists. Post-analysis fields show "Pending analysis"
 * until results arrive. Graph hash is engine-produced only — never computed from
 * nodes/edges in the UI.
 *
 * Phase 2A: Model Card Lite.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import { Copy, Check, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ModelCardData, RepairDisplay } from '../adapters/modelCardAdapter'
import { formatNodeCounts } from '../adapters/modelCardAdapter'
import { trackEvent } from '../../lib/posthog'

// ---------------------------------------------------------------------------
// § 1 — Confidence styling (text + pill, not colour alone)
// ---------------------------------------------------------------------------

function confidencePill(label: string | null): { text: string; className: string } {
  if (!label) return { text: 'Pending analysis', className: 'text-text-light' }
  switch (label) {
    case 'Robust':
      return { text: 'Robust', className: 'text-success border border-success/30 bg-transparent px-1.5 py-0.5 rounded-full' }
    case 'Moderate':
      return { text: 'Moderate', className: 'text-warning border border-warning/30 bg-transparent px-1.5 py-0.5 rounded-full' }
    case 'Fragile':
      return { text: 'Fragile', className: 'text-danger border border-danger/30 bg-transparent px-1.5 py-0.5 rounded-full' }
    default:
      return { text: label, className: 'text-text-light' }
  }
}

// ---------------------------------------------------------------------------
// § 2 — Sub-components
// ---------------------------------------------------------------------------

function CopyHashButton({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [hash])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 hover:text-text-body transition-colors"
      aria-label="Copy graph hash"
    >
      <code className="font-mono text-[11px]">{hash.slice(0, 8)}</code>
      {copied
        ? <Check className="w-3 h-3 text-success" aria-hidden="true" />
        : <Copy className="w-3 h-3 text-text-light" aria-hidden="true" />
      }
    </button>
  )
}

// ---------------------------------------------------------------------------
// § 3 — Main component
// ---------------------------------------------------------------------------

interface ModelCardLiteProps {
  data: ModelCardData
}

export const ModelCardLite = memo(function ModelCardLite({ data }: ModelCardLiteProps) {
  const [adjustmentsExpanded, setAdjustmentsExpanded] = useState(false)

  const nodeCountStr = useMemo(() => formatNodeCounts(data.nodeCounts), [data.nodeCounts])

  const confidence = useMemo(() => confidencePill(data.confidenceLabel), [data.confidenceLabel])

  const handleViewDetails = useCallback(() => {
    trackEvent('model_details_viewed')
  }, [])

  const qualityModeDisplay = data.qualityMode
    ? data.qualityMode === 'deep' ? 'Detailed' : 'Summary'
    : null

  return (
    <section
      className="bg-panel border border-panel-border rounded-xl shadow-s1 p-3 mb-3"
      aria-label="Model card"
      onClick={handleViewDetails}
    >
      <h3 className={`${typography.panelHeader} mb-2`}>Model card</h3>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {/* Graph hash */}
        <dt className={`${typography.panelMeta} text-text-light`}>Graph hash</dt>
        <dd className={typography.panelMeta}>
          {data.graphHash
            ? <CopyHashButton hash={data.graphHash} />
            : <span className="text-text-light">Unavailable</span>
          }
        </dd>

        {/* Seed */}
        <dt className={`${typography.panelMeta} text-text-light`}>Seed</dt>
        <dd className={typography.panelMeta}>
          {data.hasResults && data.seed != null
            ? <span className="tabular-nums">{data.seed}</span>
            : <span className="text-text-light">Pending analysis</span>
          }
        </dd>

        {/* Quality mode */}
        <dt className={`${typography.panelMeta} text-text-light`}>Quality mode</dt>
        <dd className={typography.panelMeta}>
          {data.hasResults && qualityModeDisplay
            ? qualityModeDisplay
            : <span className="text-text-light">Pending analysis</span>
          }
        </dd>

        {/* Node counts */}
        <dt className={`${typography.panelMeta} text-text-light`}>Nodes</dt>
        <dd className={typography.panelMeta}>{nodeCountStr}</dd>

        {/* Edge count */}
        <dt className={`${typography.panelMeta} text-text-light`}>Edges</dt>
        <dd className={typography.panelMeta}>
          {data.edgeCount} relationship{data.edgeCount !== 1 ? 's' : ''}
        </dd>

        {/* Confidence */}
        <dt className={`${typography.panelMeta} text-text-light`}>Confidence</dt>
        <dd className={typography.panelMeta}>
          <span className={confidence.className}>{confidence.text}</span>
        </dd>

        {/* Linearity */}
        <dt className={`${typography.panelMeta} text-text-light`}>Linearity</dt>
        <dd className={`${typography.panelMeta} inline-flex items-center gap-1`}>
          Linear (PoC)
          <span
            className="cursor-help"
            title="The PoC uses linear causal models. Non-linear mechanisms are planned."
          >
            <Info className="w-3 h-3 text-text-light" aria-hidden="true" />
          </span>
        </dd>

        {/* Adjustments */}
        {data.repairsApplied.length > 0 && (
          <>
            <dt className={`${typography.panelMeta} text-text-light`}>Adjustments</dt>
            <dd className={typography.panelMeta}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setAdjustmentsExpanded(!adjustmentsExpanded)
                }}
                className="inline-flex items-center gap-1 hover:text-text-body transition-colors"
                aria-expanded={adjustmentsExpanded}
                aria-controls="model-card-adjustments"
              >
                {data.repairsApplied.length} adjustment{data.repairsApplied.length !== 1 ? 's' : ''} applied
                {adjustmentsExpanded
                  ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
                  : <ChevronRight className="w-3 h-3" aria-hidden="true" />
                }
              </button>
            </dd>
          </>
        )}
      </dl>

      {/* Adjustments detail — always mounted for short lists (≤3), lazy for longer */}
      {data.repairsApplied.length > 0 && (
        <div
          id="model-card-adjustments"
          className={adjustmentsExpanded ? 'mt-2' : 'sr-only'}
          aria-hidden={!adjustmentsExpanded}
          inert={!adjustmentsExpanded ? ('' as unknown as boolean) : undefined}
        >
          <AdjustmentsList repairs={data.repairsApplied} />
        </div>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// § 4 — Adjustments list
// ---------------------------------------------------------------------------

function AdjustmentsList({ repairs }: { repairs: RepairDisplay[] }) {
  // Always-mounted for ≤3 items; lazy mount for longer lists
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? repairs : repairs.slice(0, 3)
  const remaining = repairs.length - 3

  return (
    <ul className="space-y-1 text-text-light" role="list">
      {visible.map((r, i) => (
        <li key={i} className={typography.panelMeta}>
          <span className="font-medium text-text-body">{r.action}</span>{' '}
          {r.label}
          {r.before != null && r.after != null && (
            <span className="text-text-light"> ({r.before} → {r.after})</span>
          )}
        </li>
      ))}
      {remaining > 0 && !showAll && (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`${typography.panelMeta} text-info hover:underline`}
          >
            and {remaining} more
          </button>
        </li>
      )}
    </ul>
  )
}

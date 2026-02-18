/**
 * ModelAdjustments — Collapsible section showing CEE's automatic model repairs.
 *
 * Surfaces analysis_ready.model_adjustments for transparency.
 * Each adjustment describes what the STRP/repair pipeline changed.
 *
 * Hidden when model_adjustments is absent or empty.
 *
 * CEE sends adjustments with `code` + `reason` fields; legacy format used
 * `type` + `detail`. This component accepts both shapes defensively.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'

interface ModelAdjustment {
  /** Legacy type identifier */
  type?: string
  /** CEE code identifier (preferred over type) */
  code?: string
  field?: string
  /** Legacy detail text */
  detail?: string
  /** CEE reason text (preferred over detail) */
  reason?: string
  target?: string
  /** Extra CEE fields passed through */
  [key: string]: unknown
}

interface ModelAdjustmentsProps {
  adjustments: ModelAdjustment[]
  /** Repair actions from trace.pipeline.repair_summary (Task 6b) */
  repairActions?: string[]
}

/**
 * User-facing copy for known repair types.
 * `summary` is the headline; `{count}` and `{targets}` are replaced at render time.
 * `technical` is the raw engine text shown behind a "Details" toggle.
 *
 * Known types from CEE bundles:
 * - factor_reclassified / category_inferred / category_infer
 * - risk_coefficient_corrected / deterministic_repair / strp_repair
 * - edge_added / edge_removed / node_removed
 * - strength_defaulted / observed_state_defaulted / baseline_created
 */
const REPAIR_COPY: Record<string, string> = {
  'factor_reclassified': 'Reclassified {count} factor(s) to external — not directly controlled by your options',
  'category_inferred': 'Reclassified {count} factor(s) to external — not directly controlled by your options',
  'category_infer': 'Reclassified {count} factor(s) to external — not directly controlled by your options',
  'risk_coefficient_corrected': 'Corrected {count} relationship direction(s) where the sign didn\u2019t match the effect',
  'deterministic_repair': 'Repaired {count} structural issue(s) in your model',
  'strp_repair': 'Repaired {count} structural issue(s) in your model',
  'edge_added': 'Added {count} missing relationship(s)',
  'edge_removed': 'Removed {count} invalid relationship(s)',
  'node_removed': 'Removed {count} unused node(s)',
  'strength_defaulted': 'Set default strength for {count} relationship(s)',
  'observed_state_defaulted': 'Set default values for {count} factor(s)',
  'baseline_created': 'Created baseline option for comparison',
}

/** Get user-facing headline for a repair type, or null if unmapped */
function getRepairCopy(type: string, count: number): string | null {
  const template = REPAIR_COPY[type]
  if (!template) return null
  return template.replace('{count}', String(count))
}

/**
 * Strip internal engine language from raw detail/reason strings.
 * Removes field paths (strength.mean, effect_direction, nodes[...], edges[...])
 * and quoted field names that leak from CEE repair descriptions.
 */
function sanitiseDetail(detail: string): string {
  return detail
    // Remove quoted internal field names: "effect_direction", 'strength.mean'
    .replace(/["'][a-z_]+(\.[a-z_]+)*["']/g, '')
    // Remove nodes[fac_...] or edges[...] references
    .replace(/\b(nodes|edges)\[[^\]]*\]/g, '')
    // Remove bare field paths: strength.mean, effect_direction
    .replace(/\b(strength\.mean|effect_direction|observed_state\.\w+)\b/g, '')
    // Collapse double spaces and trim
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[—\-–]\s*/, '')
    .trim()
}

/** Humanise adjustment type/code for display (fallback for ungrouped items) */
function formatAdjustmentType(type: string | undefined): string {
  if (!type || typeof type !== 'string') return 'System adjustment'
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface GroupedAdjustment extends ModelAdjustment {
  /** User-facing headline from REPAIR_COPY map */
  headline?: string
  /** Raw technical detail (shown behind "Details" toggle) */
  technicalDetail?: string
}

/** Group adjustments by type/code. Grouped rows show user-facing copy + all target labels. */
function groupAdjustments(adjustments: ModelAdjustment[]): GroupedAdjustment[] {
  const groups = new Map<string, ModelAdjustment[]>()
  for (const adj of adjustments) {
    const key = adj.type ?? adj.code ?? ''
    const existing = groups.get(key)
    if (existing) existing.push(adj)
    else groups.set(key, [adj])
  }

  const result: GroupedAdjustment[] = []
  for (const [key, group] of groups) {
    const representative: GroupedAdjustment = { ...group[0] }
    const rawDetail = representative.detail ?? representative.reason ?? ''

    // Collect ALL target labels from the group (not just the first)
    const targets = group
      .map(a => a.target)
      .filter((t): t is string => !!t)
    representative.target = targets.length > 0 ? targets.join(', ') : undefined
    representative.field = undefined

    // Try the user-facing copy map
    const humanCopy = getRepairCopy(key, group.length)
    if (humanCopy) {
      representative.headline = humanCopy
      representative.technicalDetail = rawDetail ? sanitiseDetail(rawDetail) : undefined
      // Clear detail so the render path uses headline instead
      representative.detail = undefined
    } else if (group.length > 1) {
      // Unmapped type, grouped: "N × type — sanitised detail"
      const formatted = formatAdjustmentType(key).toLowerCase()
      const cleaned = rawDetail ? sanitiseDetail(rawDetail) : ''
      representative.headline = `${group.length} × ${formatted}${cleaned ? ` — ${cleaned}` : ''}`
      representative.technicalDetail = rawDetail || undefined
      representative.detail = undefined
    } else {
      // Unmapped type, single: sanitise the detail text
      if (rawDetail) {
        representative.detail = sanitiseDetail(rawDetail)
        representative.technicalDetail = rawDetail
      }
    }

    result.push(representative)
  }
  return result
}

function AdjustmentRow({ adj }: { adj: GroupedAdjustment }) {
  const [showDetail, setShowDetail] = useState(false)
  const displayType = adj.type ?? adj.code
  const displayDetail = adj.detail ?? adj.reason

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
      <div>
        {adj.headline ? (
          <>
            <span className="font-medium text-text-body">{adj.headline}</span>
            {adj.target && (
              <p className="text-text-light mt-0.5">{adj.target}</p>
            )}
            {adj.technicalDetail && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDetail(!showDetail)}
                  className="text-info hover:underline cursor-pointer mt-0.5 block"
                >
                  {showDetail ? 'Hide details' : 'Details'}
                </button>
                {showDetail && (
                  <p className="text-text-light mt-0.5 font-mono text-[10px] leading-tight">{adj.technicalDetail}</p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <span className="font-medium text-text-body">
              {formatAdjustmentType(displayType)}
            </span>
            {adj.target && (
              <span className="text-text-light"> on {adj.target}</span>
            )}
            {displayDetail && (
              <p className="text-text-light mt-0.5">{displayDetail}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function ModelAdjustments({ adjustments, repairActions = [] }: ModelAdjustmentsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (adjustments.length === 0 && repairActions.length === 0) return null

  const grouped = groupAdjustments(adjustments)
  const totalCount = grouped.length + repairActions.length

  return (
    <div className="rounded-md border border-panel-border bg-panel" data-testid="model-adjustments">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-panel-hover transition-colors rounded-md"
      >
        <Wrench size={14} className="text-text-light flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-body">
            Auto-fixes applied
          </span>
          <p className="text-xs text-text-light leading-tight">
            We fixed small issues without changing your intent.
          </p>
        </div>
        <span className="text-xs text-text-light">{totalCount}</span>
        {isExpanded ? (
          <ChevronDown size={14} className="text-text-light" />
        ) : (
          <ChevronRight size={14} className="text-text-light" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {grouped.map((adj, idx) => {
            const displayType = adj.type ?? adj.code
            return (
              <AdjustmentRow key={`${displayType ?? 'adj'}-${idx}`} adj={adj} />
            )
          })}

          {/* Repair actions from trace.pipeline.repair_summary (Task 6b) */}
          {repairActions.length > 0 && (
            <>
              {grouped.length > 0 && (
                <div className="border-t border-panel-border my-1" />
              )}
              {repairActions.map((action, idx) => (
                <div
                  key={`repair-${idx}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
                  <span className="text-text-body">{action}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ModelAdjustments

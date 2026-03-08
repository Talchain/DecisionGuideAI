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
import { typography } from '@/styles/typography'

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

/** Phase 2B: Post-run repair from PLoT repairs_applied */
export interface PostRunRepair {
  label: string
  action: string
  before?: string
  after?: string
  reason?: string
}

interface ModelAdjustmentsProps {
  adjustments: ModelAdjustment[]
  /** Repair actions from trace.pipeline.repair_summary (Task 6b) */
  repairActions?: string[]
  /** Phase 2B: Post-run repairs from PLoT repairs_applied, formatted via modelCardAdapter */
  postRunRepairs?: PostRunRepair[]
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
const REPAIR_COPY: Record<string, { singular: string; plural: string }> = {
  'factor_reclassified': { singular: 'Moved 1 factor outside your control \u2014 treated as an external condition', plural: 'Moved {count} factors outside your control \u2014 treated as external conditions' },
  'category_reclassified': { singular: 'Moved 1 factor outside your control \u2014 treated as an external condition', plural: 'Moved {count} factors outside your control \u2014 treated as external conditions' },
  'category_inferred': { singular: 'Moved 1 factor outside your control \u2014 treated as an external condition', plural: 'Moved {count} factors outside your control \u2014 treated as external conditions' },
  'category_infer': { singular: 'Moved 1 factor outside your control \u2014 treated as an external condition', plural: 'Moved {count} factors outside your control \u2014 treated as external conditions' },
  'risk_coefficient_corrected': { singular: 'Corrected 1 relationship direction where the sign didn\u2019t match the effect', plural: 'Corrected {count} relationship directions where the sign didn\u2019t match the effect' },
  'deterministic_repair': { singular: 'Repaired 1 structural issue in your model', plural: 'Repaired {count} structural issues in your model' },
  'strp_repair': { singular: 'Repaired 1 structural issue in your model', plural: 'Repaired {count} structural issues in your model' },
  'edge_added': { singular: 'Added 1 missing relationship', plural: 'Added {count} missing relationships' },
  'edge_removed': { singular: 'Removed 1 invalid relationship', plural: 'Removed {count} invalid relationships' },
  'node_removed': { singular: 'Removed 1 unused node', plural: 'Removed {count} unused nodes' },
  'strength_defaulted': { singular: 'Set default strength for 1 relationship', plural: 'Set default strength for {count} relationships' },
  'edge_strength_clamped': { singular: 'Adjusted 1 relationship strength to stay within valid range', plural: 'Adjusted {count} relationship strengths to stay within valid range' },
  'exists_probability_defaulted': { singular: 'Set a default confidence level for 1 relationship that was missing one', plural: 'Set a default confidence level for {count} relationships that were missing one' },
  'observed_state_defaulted': { singular: 'Set default values for 1 factor', plural: 'Set default values for {count} factors' },
  'baseline_created': { singular: 'Added a \u2018do nothing\u2019 baseline so results can show improvement over the status quo', plural: 'Added a \u2018do nothing\u2019 baseline so results can show improvement over the status quo' },
}

/** Generic fallback for unmapped repair codes */
const GENERIC_REPAIR_FALLBACK = 'We corrected an internal inconsistency. Your intent hasn\u2019t changed.'

/** Get user-facing headline for a repair type, or null if unmapped */
function getRepairCopy(type: string, count: number): string | null {
  const entry = REPAIR_COPY[type]
  if (!entry) return null
  const template = count === 1 ? entry.singular : entry.plural
  return template.replace('{count}', String(count))
}

/**
 * Strip internal engine language from raw detail/reason strings.
 * Removes field paths (strength.mean, effect_direction, nodes[...], edges[...]),
 * quoted field names, prior notation, and replaces engine terms with plain language.
 */
function sanitiseDetail(detail: string): string {
  // Replace the full sign-contradiction pattern before any other transforms
  const signCorrectionPattern = /effect_direction\s+["']?\w+["']?\s+contradicts\s+strength[_.]mean\s+sign\s*\([^)]*\)/gi
  if (signCorrectionPattern.test(detail)) {
    return "Relationship direction didn't match the stated effect \u2014 corrected automatically"
  }
  return detail
    // Humanise engine verbs before other transforms
    .replace(/\bReclassified unreachable factor\b/gi, 'Moved')
    // Strip prior notation: "with synthesised prior [X, Y]"
    .replace(/\s*with synthesised prior\s*\[[^\]]*\]/gi, '')
    // Remove quoted internal field names: "effect_direction", 'strength.mean'
    .replace(/["'][a-z_]+(\.[a-z_]+)*["']/g, '')
    // Remove nodes[fac_...] or edges[...] references
    .replace(/\b(nodes|edges)\[[^\]]*\]/g, '')
    // Remove bare field paths: strength.mean, effect_direction, strength_mean
    .replace(/\b(strength\.mean|strength_mean|effect_direction|observed_state\.\w+)\b/g, '')
    // Strip dangling numeric parameters like "(0.3)" at end
    .replace(/\s*\(\s*-?[\d.]+\s*\)/g, '')
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
    } else {
      // Unmapped type: use generic fallback headline, sanitised detail behind toggle
      representative.headline = group.length > 1
        ? `${GENERIC_REPAIR_FALLBACK} (${group.length} items)`
        : GENERIC_REPAIR_FALLBACK
      representative.technicalDetail = rawDetail ? sanitiseDetail(rawDetail) : undefined
      representative.detail = undefined
    }

    result.push(representative)
  }
  return result
}

function AdjustmentRow({ adj }: { adj: GroupedAdjustment }) {
  const [showDetail, setShowDetail] = useState(false)

  // headline is always set by groupAdjustments; fallback defensively
  const headline = adj.headline ?? GENERIC_REPAIR_FALLBACK

  return (
    <div className={`flex items-start gap-2 ${typography.panelMeta}`}>
      <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
      <div>
        <span className="text-text-body">{headline}</span>
        {adj.target && (
          <p className="text-text-light mt-0.5">{adj.target}</p>
        )}
        {adj.technicalDetail && (
          <>
            <button
              type="button"
              onClick={() => setShowDetail(!showDetail)}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-0.5 block`}
            >
              {showDetail ? 'Hide details' : 'Details'}
            </button>
            {showDetail && (
              <div className="mt-2 pl-3 border-l-2 border-panel-border">
                <p className={`${typography.panelBody} text-text-light`}>{adj.technicalDetail}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function ModelAdjustments({ adjustments, repairActions = [], postRunRepairs = [] }: ModelAdjustmentsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPostRun, setShowPostRun] = useState(false)

  if (adjustments.length === 0 && repairActions.length === 0 && postRunRepairs.length === 0) return null

  const grouped = groupAdjustments(adjustments)
  const totalCount = grouped.length + repairActions.length

  // Single fix: compact inline row — no collapsible wrapper
  if (totalCount === 1) {
    const singleAdj = grouped[0]
    const singleRepair = repairActions[0]
    return (
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-2" data-testid="model-adjustments">
        <div className="flex items-start gap-2">
          <Wrench size={14} className="text-text-light flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {singleAdj ? (
              <AdjustmentRow adj={singleAdj} />
            ) : (
              <span className={`${typography.panelMeta} text-text-body`}>{singleRepair}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Multiple fixes: collapsible section
  return (
    <div className="rounded-lg border border-panel-border bg-panel" data-testid="model-adjustments">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-panel-hover transition-colors rounded-lg"
      >
        <Wrench size={14} className="text-text-light flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className={`${typography.panelHeader} text-text-body`}>
            {totalCount} auto-fixes applied
          </span>
          <p className={`${typography.panelMeta} text-text-light leading-tight`}>
            We fixed small issues without changing your intent.
          </p>
        </div>
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

          {/* Repair actions from trace.pipeline.repair_summary */}
          {repairActions.length > 0 && (
            <>
              {grouped.length > 0 && (
                <div className="border-t border-panel-border my-1" />
              )}
              {repairActions.map((action, idx) => (
                <div
                  key={`repair-${idx}`}
                  className={`flex items-start gap-2 ${typography.panelMeta}`}
                >
                  <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
                  <span className="text-text-body">{action}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Phase 2B: Post-run repairs from PLoT repairs_applied */}
      {postRunRepairs.length > 0 && (
        <div className="border-t border-panel-border">
          <button
            type="button"
            onClick={() => setShowPostRun(!showPostRun)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-panel-hover transition-colors"
            aria-expanded={showPostRun}
            aria-controls="post-run-repairs-list"
            data-testid="post-run-repairs-toggle"
          >
            <span className={`${typography.panelMeta} text-text-light flex-1`}>
              {postRunRepairs.length} analysis-time {postRunRepairs.length === 1 ? 'adjustment' : 'adjustments'}
            </span>
            {showPostRun ? (
              <ChevronDown size={14} className="text-text-light" />
            ) : (
              <ChevronRight size={14} className="text-text-light" />
            )}
          </button>
          {showPostRun && (
            <div className="px-3 pb-2 space-y-1" id="post-run-repairs-list" data-testid="post-run-repairs-list">
              {postRunRepairs.map((repair) => (
                <div key={`${repair.label}-${repair.action}`} className={`flex items-start gap-2 ${typography.panelMeta} text-text-light`}>
                  <span className="mt-0.5 flex-shrink-0">&bull;</span>
                  <div>
                    <span>{repair.label}: {repair.action}</span>
                    {repair.before != null && repair.after != null && (
                      <span className="ml-1">({repair.before} → {repair.after})</span>
                    )}
                    {repair.reason && (
                      <p className="text-text-light mt-0.5">{repair.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ModelAdjustments

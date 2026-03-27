/**
 * TriageCard — Shared action card for pre-analysis and post-analysis triage panels.
 *
 * Displays: ordinal badge, title, detail text, action buttons, influence bar,
 * and optional inline ScientificEditor for progressive disclosure editing.
 *
 * Variants:
 * - 'default': Standard card with actions
 * - 'compact': Quick-fix row (single-line, rank 4-6 items)
 */

import { useState, useCallback } from 'react'
import { Check, Pencil } from 'lucide-react'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
import { ScientificEditor } from './ScientificEditor'
import type { ScientificEditorProps } from './ScientificEditor'

// ── Types ───────────────────────────────────────────────────────────────────

export type TriageCardCategory = 'fix' | 'verify' | 'add_evidence' | 'strengthen' | 'contested'

export interface TriageCardAction {
  kind: 'confirm' | 'edit' | 'set_value' | 'add_source'
  label: string
  targetId?: string
  targetType?: 'node' | 'edge'
}

export interface TriageCardProps {
  /** Unique key */
  cardKey: string
  /** Display index (1-based) */
  ordinal: number
  /** Card title */
  title: string
  /** Detail/explanation text */
  detail: string
  /** Category for badge colour */
  category: TriageCardCategory
  /** Optional influence score 0-1 for influence bar */
  influence?: number | null
  /** Optional EVOI impact (percentage points) */
  evoiImpact?: number | null
  /** Variant: 'default' for full card, 'compact' for quick-fix row */
  variant?: 'default' | 'compact'
  /** Action config */
  action?: TriageCardAction
  /** Editor config for inline editing (when null, no editor available) */
  editorConfig?: ScientificEditorProps | null
  /** Source provenance pill (e.g. "AI estimate", "Brief", "No data") */
  sourcePill?: { label: string; borderClass: string } | null
  /** Callbacks */
  onConfirm?: (targetId: string) => void
  onEdit?: (targetId: string) => void
  onSendMessage?: (text: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

// ── Badge colours ───────────────────────────────────────────────────────────

const BADGE_COLORS: Record<TriageCardCategory, string> = {
  fix: 'bg-danger',
  verify: 'bg-goal',
  add_evidence: 'bg-info',
  strengthen: 'bg-option',
  contested: 'bg-warning',
}

// ── Compact variant (quick-fix rows, ranks 4-6) ─────────────────────────────

function CompactTriageCard({ title, ordinal, category, influence, evoiImpact, onHoverEnter, onHoverLeave, action }: TriageCardProps) {
  const influencePct = influence != null ? Math.round(influence * 100) : null

  return (
    <div
      className="flex items-center gap-2 px-3 min-h-[44px] rounded-lg border border-panel-border hover:bg-panel-hover cursor-pointer"
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      <span className={`flex-shrink-0 w-4 h-4 rounded-full ${BADGE_COLORS[category]} text-white flex items-center justify-center ${typography.panelMeta}`}>
        {ordinal}
      </span>
      <span className={`flex-1 min-w-0 truncate ${typography.panelBody} text-text-body`}>{title}</span>
      {evoiImpact != null && (
        <span className={`shrink-0 ${typography.panelMeta} text-text-light`}>
          {evoiImpact.toFixed(1)}pp
        </span>
      )}
      {influencePct != null && (
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-8 h-[3px] rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}>
            <div
              className="h-full rounded-sm"
              style={{ width: `${Math.min(100, influencePct)}%`, backgroundColor: evaluativeVar(influence!) }}
            />
          </div>
          <span className={`${typography.panelMeta} text-text-light`}>{influencePct}%</span>
        </div>
      )}
    </div>
  )
}

// ── Main TriageCard component ───────────────────────────────────────────────

export function TriageCard(props: TriageCardProps) {
  const {
    cardKey,
    ordinal,
    title,
    detail,
    category,
    influence,
    evoiImpact,
    variant = 'default',
    action,
    editorConfig,
    sourcePill,
    onConfirm,
    onEdit,
    onSendMessage,
    onHoverEnter,
    onHoverLeave,
  } = props

  const [isEditing, setIsEditing] = useState(false)

  if (variant === 'compact') return <CompactTriageCard {...props} />

  const influencePct = influence != null ? Math.round(influence * 100) : null
  const badgeColor = BADGE_COLORS[category]

  const handleEditorCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div
      key={cardKey}
      className="relative flex flex-col gap-2 p-3 rounded-lg border border-panel-border hover:bg-panel-hover"
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      {/* Top row: ordinal + title */}
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-white ${typography.panelMeta} flex items-center justify-center`}>
          {ordinal}
        </span>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className={`${typography.panelHeader} text-text-header truncate`}>{title}</p>
            {sourcePill && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}>
                {sourcePill.label}
              </span>
            )}
          </div>
          {evoiImpact != null && (
            <span className={`shrink-0 px-1.5 py-0.5 rounded-full border border-info/30 ${typography.panelMeta} text-text-body`}>
              {evoiImpact.toFixed(1)}pp impact
            </span>
          )}
        </div>
      </div>

      {/* Body content */}
      <p className={`${typography.panelBody} text-text-light`}>{detail}</p>

      {/* Inline editor */}
      {isEditing && editorConfig && (
        <ScientificEditor
          {...editorConfig}
          onSave={(...args: any[]) => {
            (editorConfig.onSave as any)(...args)
            setIsEditing(false)
          }}
          onCancel={handleEditorCancel}
        />
      )}

      {/* Action buttons row */}
      {!isEditing && (
        <div className="flex items-center gap-1">
          {action?.kind === 'confirm' && onConfirm && action.targetId && (
            <button
              type="button"
              onClick={() => onConfirm(action.targetId!)}
              className={`min-h-[44px] px-3 rounded ${typography.panelMeta} text-success border border-success/30 hover:bg-panel-hover cursor-pointer`}
            >
              <span className="flex items-center gap-1"><Check size={12} /> Confirm</span>
            </button>
          )}
          {action?.kind === 'edit' && onEdit && action.targetId && (
            <button
              type="button"
              onClick={() => onEdit(action.targetId!)}
              className={`min-h-[44px] px-3 rounded ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              <span className="flex items-center gap-1"><Pencil size={12} /> Edit</span>
            </button>
          )}
          {action?.kind === 'set_value' && editorConfig && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`min-h-[44px] px-3 rounded ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              Set value
            </button>
          )}
          {onSendMessage && action?.targetId && (
            <button
              type="button"
              onClick={() => onSendMessage(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
              className={`min-h-[44px] px-3 rounded ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              Ask AI to research
            </button>
          )}
        </div>
      )}

      {/* Influence bar — separate row, right-aligned */}
      {influencePct != null && (
        <div className="flex items-center justify-end gap-1.5">
          <div className="w-12 h-[4px] rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}>
            <div
              className="h-full rounded-sm"
              style={{ width: `${Math.min(100, influencePct)}%`, backgroundColor: evaluativeVar(influence!) }}
            />
          </div>
          <span className={`${typography.panelMeta} text-text-light`}>{influencePct}%</span>
        </div>
      )}
    </div>
  )
}

export default TriageCard

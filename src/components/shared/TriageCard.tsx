/**
 * TriageCard — Shared action card for pre-analysis and post-analysis triage panels.
 *
 * Displays: ordinal badge, title, subtitle, action buttons, influence bar,
 * and optional inline ScientificEditor for progressive disclosure editing.
 *
 * Variants:
 * - 'default': Standard card with actions (p-2.5, rounded-[10px], influence bar absolute)
 * - 'compact': Quick-fix row (borderless, multi-row, rank 4-6 items)
 */

import { useState, useCallback, useRef } from 'react'
import { Check, Pencil } from 'lucide-react'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
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
  /** Action-oriented subtitle (one line, shown below title) */
  subtitle?: string
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
  /** Edge strength quick-select (edge cards only) */
  onUpdateEdgeStrength?: (edgeId: string, value: number) => void
}

// ── Badge colours ───────────────────────────────────────────────────────────

const BADGE_COLORS: Record<TriageCardCategory, string> = {
  fix: 'bg-danger',
  verify: 'bg-goal',
  add_evidence: 'bg-info',
  strengthen: 'bg-option',
  contested: 'bg-warning',
}

// ── Edge strength bands ────────────────────────────────────────────────────

const STRENGTH_BANDS = [
  { label: 'Weak', value: 0.3 },
  { label: 'Moderate', value: 0.7 },
  { label: 'Strong', value: 1.2 },
] as const

/** Inline edge-strength quick-select: three pill buttons */
function EdgeStrengthQuickSelect({
  edgeId,
  onUpdateEdgeStrength,
}: {
  edgeId: string
  onUpdateEdgeStrength: (edgeId: string, value: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {STRENGTH_BANDS.map(b => (
        <button
          key={b.label}
          type="button"
          onClick={() => onUpdateEdgeStrength(edgeId, b.value)}
          className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

/** Inline value editor for factor cards — shows current raw value with editable input */
function InlineValueEditor({
  editorConfig,
  onDone,
}: {
  editorConfig: ScientificEditorProps
  onDone: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(
    editorConfig.rawValue != null ? String(editorConfig.rawValue) : '',
  )

  const handleSave = useCallback(() => {
    const parsed = parseFloat(draft)
    if (!Number.isNaN(parsed)) {
      ;(editorConfig.onSave as (v: number) => void)(parsed)
      onDone()
    }
  }, [draft, editorConfig.onSave, onDone])

  const unitSuffix = editorConfig.unit === '%' ? '%' : editorConfig.unit ? ` ${editorConfig.unit}` : ''

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onDone()
          }}
          autoFocus
          className={`w-20 px-1.5 py-0.5 ${typography.panelMeta} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
        />
        {unitSuffix && (
          <span className={`${typography.panelMeta} text-text-light ml-0.5`}>{unitSuffix}</span>
        )}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-success border border-success/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
      >
        Save
      </button>
    </div>
  )
}

// ── Compact variant (quick-fix rows, ranks 4-6) ─────────────────────────────

function CompactTriageCard({ title, ordinal, category, influence, evoiImpact, onHoverEnter, onHoverLeave, action, onConfirm, onEdit, onSendMessage, onUpdateEdgeStrength, sourcePill, subtitle }: TriageCardProps) {
  const influencePct = influence != null ? Math.round(influence * 100) : null
  const isEdge = action?.targetType === 'edge'
  const isBrief = sourcePill?.label === 'From brief'

  return (
    <div
      className="flex flex-col gap-1 py-1.5 px-2 rounded-lg hover:bg-panel-hover cursor-pointer"
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      {/* Row 1: badge + title + meta */}
      <div className="flex items-center gap-2">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full ${BADGE_COLORS[category]} text-white flex items-center justify-center ${typography.panelMeta}`}>
          {ordinal}
        </span>
        <span className={`min-w-0 truncate ${typography.panelMeta} text-info font-medium`} title={title}>{title}</span>
        {sourcePill && (
          <span className={`shrink-0 px-1 py-0.5 rounded-full border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}>
            {sourcePill.label}
          </span>
        )}
        {subtitle && (
          <span className={`shrink-0 ${typography.panelMeta} text-text-light truncate max-w-[120px]`} title={subtitle}>{subtitle}</span>
        )}
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
      {/* Row 2: edge strength quick-select + Ask AI */}
      <div className="flex items-center gap-1.5 pl-7">
        {isEdge && action?.targetId && onUpdateEdgeStrength && (
          <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
        )}
        {!isEdge && action && (
          <div className="flex gap-1 shrink-0">
            {action.kind === 'confirm' && onConfirm && action.targetId && (
              <button type="button" onClick={() => onConfirm(action.targetId!)} className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-success border border-success/30 bg-transparent hover:bg-panel-hover cursor-pointer`}>
                Confirm
              </button>
            )}
            {(action.kind === 'edit' || action.kind === 'set_value') && onEdit && action.targetId && (
              <button type="button" onClick={() => onEdit(action.targetId!)} className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}>
                {action.kind === 'set_value' ? 'Set' : 'Edit'}
              </button>
            )}
          </div>
        )}
        {onSendMessage && action?.targetId && !isBrief && (
          <button
            type="button"
            onClick={() => onSendMessage(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
            className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 bg-transparent hover:bg-panel-hover cursor-pointer`}
          >
            Ask AI
          </button>
        )}
      </div>
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
    subtitle,
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
    onUpdateEdgeStrength,
  } = props

  const [isEditing, setIsEditing] = useState(false)

  if (variant === 'compact') return <CompactTriageCard {...props} />

  const influencePct = influence != null ? Math.round(influence * 100) : null
  const badgeColor = BADGE_COLORS[category]
  const isEdge = action?.targetType === 'edge'
  const isBrief = sourcePill?.label === 'From brief'

  // Display text: prefer subtitle over detail for the one-line description
  const displaySubtitle = subtitle || detail

  return (
    <div
      key={cardKey}
      className={`relative flex flex-col p-2.5 rounded-[10px] border hover:bg-panel-hover ${category === 'fix' ? 'border-danger/30' : 'border-panel-border'}`}
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      {/* Top row: ordinal + title — mb-0.5 (2px) gap to subtitle */}
      <div className="flex items-start gap-2.5 mb-0.5">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-white ${typography.panelMeta} flex items-center justify-center`}>
          {ordinal}
        </span>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className={`${typography.panelBody} font-semibold text-text-header truncate`} title={title}>{title}</p>
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

      {/* Subtitle / detail — one line, truncated */}
      <p className={`${typography.panelMeta} text-text-light truncate`} title={displaySubtitle}>{displaySubtitle}</p>

      {/* Inline value editor — always visible when editorConfig has a value */}
      {editorConfig && editorConfig.rawValue !== null && editorConfig.rawValue !== undefined && !isEdge && (
        <InlineValueEditor
          editorConfig={editorConfig}
          onDone={() => {}}
        />
      )}

      {/* Action buttons row — mt-1.5 (6px) gap from subtitle */}
      {!isEditing && (
        <div className="flex items-center gap-1 mt-1.5">
          {action?.kind === 'confirm' && onConfirm && action.targetId && (
            <button
              type="button"
              onClick={() => onConfirm(action.targetId!)}
              className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-success border border-success/30 hover:bg-panel-hover cursor-pointer`}
            >
              <span className="flex items-center gap-1"><Check size={12} /> Confirm</span>
            </button>
          )}
          {action?.kind === 'edit' && onEdit && action.targetId && (
            <button
              type="button"
              onClick={() => onEdit(action.targetId!)}
              className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              <span className="flex items-center gap-1"><Pencil size={12} /> Edit</span>
            </button>
          )}
          {action?.kind === 'set_value' && editorConfig && editorConfig.rawValue != null && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              Set value
            </button>
          )}
          {isEdge && action?.targetId && onUpdateEdgeStrength && (
            <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
          )}
          {onSendMessage && action?.targetId && !isBrief && (
            <button
              type="button"
              onClick={() => onSendMessage(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
              className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-info border border-info/30 hover:bg-panel-hover cursor-pointer`}
            >
              Ask AI to research
            </button>
          )}
        </div>
      )}

      {/* Influence bar — absolute, bottom-right of card */}
      {influencePct != null && (
        <div className="absolute bottom-2 right-2.5 flex items-center gap-1">
          <div className="w-[28px] h-[3px] rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}>
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

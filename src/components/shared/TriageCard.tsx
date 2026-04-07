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
import { Check, Pencil, Sparkles } from 'lucide-react'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
import type { ScientificEditorProps } from './ScientificEditor'
import Tooltip from '@/components/Tooltip'

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

// ── Icon action button (DS v5 §9.2 / §9.8) ────────────────────────────────

/**
 * Icon-only action button with mandatory tooltip.
 * 44×44px minimum touch target, icon renders at 14px.
 * Colour: text-text-light at rest, hoverClass on hover.
 */
function IconActionButton({
  icon: Icon,
  tooltip,
  hoverClass,
  onClick,
  'aria-label': ariaLabel,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  tooltip: string
  hoverClass: string
  onClick: () => void
  'aria-label': string
}) {
  return (
    <Tooltip content={tooltip} delay={400}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center w-11 h-11 rounded text-text-light ${hoverClass} cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
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

/**
 * InlineValueEditor — single-row: [input] [Update] [✓ Confirm] [Research]
 * Task 1d: all controls on one line with flex-wrap.
 */
function InlineValueEditor({
  editorConfig,
  onConfirm,
  onSendMessage,
  title,
}: {
  editorConfig: ScientificEditorProps
  onConfirm?: () => void
  onSendMessage?: (text: string) => void
  title: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(
    editorConfig.rawValue != null ? String(editorConfig.rawValue) : '',
  )

  const handleUpdate = useCallback(() => {
    const parsed = parseFloat(draft)
    if (!Number.isNaN(parsed)) {
      ;(editorConfig.onSave as (v: number) => void)(parsed)
    }
  }, [draft, editorConfig.onSave])

  const unitSuffix = editorConfig.unit === '%' ? '%' : editorConfig.unit ? ` ${editorConfig.unit}` : ''

  return (
    <div className="flex flex-wrap items-center gap-0.5 mt-1">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleUpdate()
          }}
          className={`w-16 px-1.5 py-0.5 ${typography.panelMeta} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
        />
        {unitSuffix && (
          <span className={`${typography.panelMeta} text-text-light ml-0.5`}>{unitSuffix}</span>
        )}
      </div>
      <IconActionButton
        icon={Pencil}
        tooltip="Edit value"
        hoverClass="hover:text-text-body"
        onClick={handleUpdate}
        aria-label="Edit value"
      />
      {onConfirm && (
        <IconActionButton
          icon={Check}
          tooltip="Confirm AI estimate"
          hoverClass="hover:text-success"
          onClick={onConfirm}
          aria-label="Confirm AI estimate"
        />
      )}
      {onSendMessage && (
        <IconActionButton
          icon={Sparkles}
          tooltip="Ask AI to research"
          hoverClass="hover:text-info"
          onClick={() => onSendMessage(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
          aria-label="Ask AI to research"
        />
      )}
    </div>
  )
}

// ── Compact variant (quick-fix rows, ranks 4-6) ─────────────────────────────

function CompactTriageCard({ title, ordinal, category, influence, evoiImpact, onHoverEnter, onHoverLeave, action, onConfirm, onEdit, onSendMessage, onUpdateEdgeStrength, sourcePill, subtitle }: TriageCardProps) {
  const influencePct = influence != null ? Math.round(influence * 100) : null
  const isEdge = action?.targetType === 'edge'
  const isBrief = sourcePill?.label === 'From brief'
  const isAiEstimate = sourcePill?.label === 'AI estimate'

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
      {/* Row 1: badge + title + source indicator pinned right + meta */}
      <div className="flex items-center gap-2">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full ${BADGE_COLORS[category]} text-white flex items-center justify-center ${typography.panelMeta}`}>
          {ordinal}
        </span>
        <span className={`flex-1 min-w-0 truncate ${typography.panelMeta} text-info font-medium`} title={title}>{title}</span>
        {isAiEstimate && (
          <Sparkles
            size={12}
            className="ml-auto text-info flex-shrink-0"
            title="Olumi estimated this value"
            aria-label="Olumi estimated this value"
          />
        )}
        {sourcePill && !isAiEstimate && (
          <span className={`ml-auto shrink-0 px-1 py-0.5 rounded-full border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}>
            {sourcePill.label}
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
      {/* Row 2: edge strength quick-select + icon action buttons */}
      <div className="flex items-center gap-0.5 pl-7">
        {isEdge && action?.targetId && onUpdateEdgeStrength && (
          <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
        )}
        {!isEdge && action && (
          <>
            {action.kind === 'confirm' && onConfirm && action.targetId && (
              <IconActionButton
                icon={Check}
                tooltip="Confirm AI estimate"
                hoverClass="hover:text-success"
                onClick={() => onConfirm!(action!.targetId!)}
                aria-label="Confirm AI estimate"
              />
            )}
            {(action.kind === 'edit' || action.kind === 'set_value') && onEdit && action.targetId && (
              <IconActionButton
                icon={Pencil}
                tooltip="Edit value"
                hoverClass="hover:text-text-body"
                onClick={() => onEdit!(action!.targetId!)}
                aria-label="Edit value"
              />
            )}
          </>
        )}
        {onSendMessage && action?.targetId && !isBrief && (
          <IconActionButton
            icon={Sparkles}
            tooltip="Ask AI to research"
            hoverClass="hover:text-info"
            onClick={() => onSendMessage!(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
            aria-label="Ask AI to research"
          />
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isEditing, _setIsEditing] = useState(false)

  if (variant === 'compact') return <CompactTriageCard {...props} />

  const influencePct = influence != null ? Math.round(influence * 100) : null
  const badgeColor = BADGE_COLORS[category]
  const isEdge = action?.targetType === 'edge'
  const isBrief = sourcePill?.label === 'From brief'
  // Task 1a: "AI estimate" pill → Sparkles icon
  const isAiEstimate = sourcePill?.label === 'AI estimate'

  // Display text: detail (subtitle is removed per Task 1b)
  const displayDetail = detail

  return (
    <div
      key={cardKey}
      className={`flex flex-col p-2.5 rounded-[10px] border hover:bg-panel-hover ${category === 'fix' ? 'border-danger/30' : 'border-panel-border'}`}
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      {/* Top row: ordinal + title ... source indicator pinned top-right */}
      <div className="flex items-start gap-2 mb-0.5">
        <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-white ${typography.panelMeta} flex items-center justify-center mt-0.5`}>
          {ordinal}
        </span>
        <p className={`${typography.panelBody} font-semibold text-text-header flex-1 min-w-0 truncate`} title={title}>{title}</p>
        {/* Source indicator — pinned top-right */}
        {isAiEstimate && (
          <Sparkles
            size={13}
            className="text-info flex-shrink-0 mt-0.5"
            title="Olumi estimated this value"
            aria-label="Olumi estimated this value"
          />
        )}
        {sourcePill && !isAiEstimate && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}>
            {sourcePill.label}
          </span>
        )}
        {/* Influence % top-right */}
        {influencePct != null && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            title={`Drives ${influencePct}% of the outcome`}
          >
            <div className="w-[28px] h-[3px] rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--border-default, #EEE6D8)' }}>
              <div
                className="h-full rounded-sm"
                style={{ width: `${Math.min(100, influencePct)}%`, backgroundColor: evaluativeVar(influence!) }}
              />
            </div>
            <span className={`${typography.panelMeta} text-text-light tabular-nums`}>{influencePct}%</span>
          </div>
        )}
        {/* EVOI impact pill — only when no influence% */}
        {evoiImpact != null && influencePct == null && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border border-info/30 ${typography.panelMeta} text-text-body`}>
            {evoiImpact.toFixed(1)}pp
          </span>
        )}
      </div>

      {/* Subtitle — coaching line when available; otherwise fall back to detail */}
      <p className={`${typography.panelMeta} text-text-light truncate pl-7`} title={subtitle || displayDetail}>{subtitle || displayDetail}</p>

      {/* Task 1d: Inline value editor row — input + Update + Confirm + Research on ONE line */}
      {editorConfig && !isEdge && (
        <div className="pl-7">
          <InlineValueEditor
            editorConfig={editorConfig}
            onConfirm={action?.targetId && onConfirm ? () => onConfirm!(action!.targetId!) : undefined}
            onSendMessage={!isBrief ? onSendMessage : undefined}
            title={title}
          />
        </div>
      )}

      {/* Action buttons row — only when no inline editor */}
      {!editorConfig && !isEdge && (
        <div className="flex items-center justify-end gap-1 mt-1.5 pl-7">
          {action?.kind === 'confirm' && onConfirm && action.targetId && (
            <IconActionButton
              icon={Check}
              tooltip="Confirm AI estimate"
              hoverClass="hover:text-success"
              onClick={() => onConfirm!(action!.targetId!)}
              aria-label="Confirm AI estimate"
            />
          )}
          {action?.kind === 'edit' && onEdit && action.targetId && (
            <IconActionButton
              icon={Pencil}
              tooltip="Edit value"
              hoverClass="hover:text-text-body"
              onClick={() => onEdit!(action!.targetId!)}
              aria-label="Edit value"
            />
          )}
          {onSendMessage && action?.targetId && !isBrief && (
            <IconActionButton
              icon={Sparkles}
              tooltip="Ask AI to research"
              hoverClass="hover:text-info"
              onClick={() => onSendMessage!(`Can you research ${title} and suggest a reasonable estimate with sources?`)}
              aria-label="Ask AI to research"
            />
          )}
        </div>
      )}

      {isEdge && action?.targetId && onUpdateEdgeStrength && (
        <div className="mt-1.5 pl-7">
          <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
        </div>
      )}
    </div>
  )
}

export default TriageCard

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

import { useState, useCallback, useRef, type ReactNode } from 'react'
import { Check, Pencil } from 'lucide-react'
import { typography } from '@/styles/typography'
import { evaluativeVar } from '@/styles/evaluative'
import type { ScientificEditorProps } from './ScientificEditor'
import { ExpandableCoachingText } from './ExpandableCoachingText'
import Tooltip from '@/components/Tooltip'
import { classifyUnit } from '@/utils/unitClassifier'

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
  /**
   * 1-indexed priority badge shown as a numeric circle at the card's top-left.
   * Omit (undefined) to hide the badge — used by the Start Here card, whose
   * green-left-border already signals primacy.
   */
  ordinal?: number
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
  /**
   * Brief 5.8A D3b: passive labels rendered as 9px outlined pills in the
   * top-right alongside sourcePill. Used today for strengthen_items.actionType
   * (e.g. "Set value") — non-interactive metadata. Each value renders as a
   * `<span>` (never a `<button>`), so screen readers see decorative
   * descriptors and keyboard focus does not stop on them.
   */
  passiveLabels?: string[]
  /** Callbacks */
  onConfirm?: (targetId: string) => void
  onEdit?: (targetId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** Edge strength quick-select (edge cards only) */
  onUpdateEdgeStrength?: (edgeId: string, value: number) => void
  /**
   * Optional "Discuss with AI" affordance. Brief 5.7 close-out follow-up:
   * the prop is now a `ReactNode` slot rather than an `AiDiscussElement`
   * so this shared component does not depend on the canvas-side
   * `DiscussWithAiButton`. Each consumer constructs its own button (or any
   * other affordance) and passes it in. Anchored bottom-right of the card,
   * only honoured by the default variant.
   */
  aiDiscussSlot?: ReactNode
  /**
   * Override the ordinal badge fill colour (e.g. "bg-info", "bg-factor").
   * Defaults to BADGE_COLORS[category] when omitted.
   * Use to apply section-based colouring (Task 9) instead of category colouring.
   */
  badgeColor?: string
}

// ── Badge colours ───────────────────────────────────────────────────────────

const BADGE_COLORS: Record<TriageCardCategory, string> = {
  fix: 'bg-danger',
  verify: 'bg-goal',
  add_evidence: 'bg-info',
  strengthen: 'bg-option',
  contested: 'bg-warning',
}

// ── Edge title rendering ────────────────────────────────────────────────────

/**
 * Render an edge title (`"Source → Target"`) so the source label is shown in
 * full and only the target truncates when the panel runs out of width. Also
 * returns a plain element for non-edge titles. The parent decides truncation
 * scope via `allowSourceShrink`: in the compact variant the source can shrink
 * too, but in the default variant the source stays full and the target owns
 * the overflow.
 */
function renderTriageTitle(title: string, className: string) {
  const arrowIdx = title.indexOf(' → ')
  if (arrowIdx < 0) {
    // Non-edge title: plain truncating paragraph.
    return (
      <p className={`${className} truncate`} title={title}>
        {title}
      </p>
    )
  }
  // For edge items, show only the target factor name. The full "Source → Target"
  // string is preserved in the title tooltip. Split on ' → ' to handle any
  // separator width safely.
  const parts = title.split(' → ')
  const target = parts[parts.length - 1]
  return (
    <p className={`${className} truncate`} title={title}>
      {target}
    </p>
  )
}

// ── Icon action button (DS v5 §9.2 / §9.8) ────────────────────────────────

/**
 * Icon-only action button with mandatory tooltip.
 * 28×28px visual size to keep the triage-card value row compact; the actual
 * hit rect stays generous via the card's parent padding (adjacent icons use
 * a gap of 8px per DS v5 §4.1 spacing). Icon renders at 14px.
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
        className={`inline-flex items-center justify-center w-7 h-7 rounded text-text-light ${hoverClass} cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
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

/** Inline edge-strength quick-select: three pill buttons with a "Strength:" lead-in. */
function EdgeStrengthQuickSelect({
  edgeId,
  onUpdateEdgeStrength,
}: {
  edgeId: string
  onUpdateEdgeStrength: (edgeId: string, value: number) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`${typography.panelMeta} text-text-light`}>Strength:</span>
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
    </div>
  )
}

/**
 * InlineValueControls — the input + icon group on the right side of a
 * collapsed triage card row. Input is compact (w-16), unit hugs the input,
 * and the three icon actions sit in a single shrink-free group with 8px gaps.
 *
 * Unlike the previous layout this does not own the outer flex row — the
 * parent places <SubtitleOrDetail/> on the left and <InlineValueControls/>
 * on the right inside the same 1-row container, so subtitle text and the
 * input controls share a single row instead of stacking.
 */
function InlineValueControls({
  editorConfig,
  onConfirm,
  title,
}: {
  editorConfig: ScientificEditorProps
  onConfirm?: () => void
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

  // Classify unit for currency-aware prefix/suffix rendering.
  // Suppress placeholder units (scale, score, index, norm…) — no real-world scale.
  const unitClassification = editorConfig.unit ? classifyUnit(editorConfig.unit) : null
  const unitKind = editorConfig.unit === '%' ? 'percent' as const : unitClassification?.kind ?? 'none'
  const unitDisplay = unitKind === 'percent' ? '%'
    : unitKind === 'symbol' || unitKind === 'iso' ? (unitClassification?.canonical ?? editorConfig.unit!)
    : unitKind === 'other' ? editorConfig.unit!
    : ''
  // Symbol (£/$) prefix with no gap; ISO code (GBP/USD) prefix with a small gap.
  // Both are prefixes; suffix applies to %, other units.
  const isSymbolPrefix = unitKind === 'symbol'
  const isIsoPrefix = unitKind === 'iso'
  const isCurrencyPrefix = isSymbolPrefix || isIsoPrefix

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* gap-0 for symbols (£49), gap-0.5 for ISO codes (GBP 49) */}
      <div className={`inline-flex items-center ${isSymbolPrefix ? 'gap-0' : 'gap-0.5'}`}>
        {isCurrencyPrefix && unitDisplay && (
          <span className={`${typography.panelMeta} text-text-light`}>{unitDisplay}</span>
        )}
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleUpdate()
          }}
          className={`w-16 px-1.5 py-0.5 ${typography.panelMeta} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
          aria-label={`Value for ${title}`}
          placeholder="Value"
        />
        {!isCurrencyPrefix && unitDisplay && (
          <span className={`${typography.panelMeta} text-text-light`}>{unitDisplay}</span>
        )}
      </div>
      <div className="inline-flex items-center gap-1.5" data-testid="triage-card-icon-group">
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
      </div>
    </div>
  )
}

// ── Compact variant (quick-fix rows, ranks 4-6) ─────────────────────────────

function CompactTriageCard({ title, ordinal, category, badgeColor, influence, evoiImpact, onHoverEnter, onHoverLeave, action, onConfirm, onEdit, onUpdateEdgeStrength, sourcePill, subtitle }: TriageCardProps) {
  const influencePct = influence != null ? Math.round(influence * 100) : null
  const resolvedBadgeColor = badgeColor ?? BADGE_COLORS[category]
  const isEdge = action?.targetType === 'edge'
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
      {/* Row 1: badge (optional) + title + source indicator pinned right + meta */}
      <div className="flex items-center gap-2">
        {ordinal != null && (
          <span className={`flex-shrink-0 w-5 h-5 rounded-full ${resolvedBadgeColor} text-text-on-color flex items-center justify-center ${typography.panelMeta}`}>
            {ordinal}
          </span>
        )}
        {renderTriageTitle(title, `flex-1 min-w-0 ${typography.panelMeta} text-info`)}
        {sourcePill && (
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
        {/* Brief 4 Phase 8 P1 #2 applied to compact variant too: surfaced
            evidence-gap cards ranked 4+ live in the compact AlsoConsider
            disclosure. They need the Npp pill for the same reason the
            default variant does — motivates the Set-value action. */}
        {evoiImpact != null && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border border-info/30 ${typography.panelMeta} text-text-body`}>
            {evoiImpact.toFixed(1)}pp
          </span>
        )}
      </div>
      {/* Row 2: subtitle (truncating) on the left, edge quick-select OR action
          icons on the right. The subtitle is new in this variant — it was
          previously dropped, losing the coaching line. Icons use a 8px gap
          to match the default variant and the brief. The whole row is gated
          on having at least one of subtitle / edge-strength / icon action so
          we don't render an empty placeholder row. */}
      {(subtitle || (isEdge && action?.targetId && onUpdateEdgeStrength) || (!isEdge && action)) && (
        <div className={`flex items-start gap-2 min-w-0 ${ordinal != null ? 'pl-7' : ''}`}>
          {/* Brief 4 hotfix Task 2: use ExpandableCoachingText so short 40-char
              subtitles like "Connects to 2 downstream relationships" render in
              full over two lines instead of single-line truncating with "...". */}
          {subtitle && (
            <ExpandableCoachingText
              text={subtitle}
              className="text-text-light"
            />
          )}
          {isEdge && action?.targetId && onUpdateEdgeStrength && (
            <div className="flex-shrink-0">
              <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
            </div>
          )}
          {!isEdge && action && (
            <div className="inline-flex items-center gap-2 flex-shrink-0" data-testid="triage-card-icon-group">
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
            </div>
          )}
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
    onHoverEnter,
    onHoverLeave,
    onUpdateEdgeStrength,
    aiDiscussSlot,
  } = props

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isEditing, _setIsEditing] = useState(false)

  if (variant === 'compact') return <CompactTriageCard {...props} />

  const influencePct = influence != null ? Math.round(influence * 100) : null
  const badgeColor = props.badgeColor ?? BADGE_COLORS[category]
  const isEdge = action?.targetType === 'edge'
  // Display text: detail (subtitle is removed per Task 1b)
  const displayDetail = detail

  return (
    <div
      key={cardKey}
      className={`relative flex flex-col p-2.5 pr-7 rounded-[10px] border hover:bg-panel-hover ${category === 'fix' ? 'border-danger/30' : 'border-panel-border'}`}
      onMouseEnter={() => {
        if (action?.targetId && onHoverEnter) {
          onHoverEnter(action.targetType ?? 'node', action.targetId)
        }
      }}
      onMouseLeave={() => onHoverLeave?.()}
    >
      {/* Top row: ordinal (optional) + title ... source indicator pinned top-right */}
      <div className="flex items-start gap-2 mb-0.5">
        {ordinal != null && (
          <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-text-on-color ${typography.panelMeta} flex items-center justify-center mt-0.5`}>
            {ordinal}
          </span>
        )}
        {renderTriageTitle(title, `${typography.panelBody} text-text-header flex-1 min-w-0`)}
        {/* Source indicator — pinned top-right */}
        {sourcePill && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border ${sourcePill.borderClass} ${typography.panelMeta} text-text-body bg-transparent`}>
            {sourcePill.label}
          </span>
        )}
        {/* Brief 5.8A D3b: passive metadata pills (e.g. strengthen actionType).
            Each renders as a non-focusable span; the wireframe shows these as
            9px outlined chips, which we approximate with text-[9px] (DS v5
            has no semantic 9px token). */}
        {props.passiveLabels?.map(label => (
          <span
            key={label}
            className="shrink-0 px-1.5 py-0.5 rounded-full border border-panel-border text-[9px] text-text-body bg-transparent leading-tight"
            data-testid="triage-card-passive-label"
          >
            {label}
          </span>
        ))}
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
        {/* EVPI percentage-point pill — always visible on surfaced gap cards
            (Brief 4 Task 9 + P1 #2). The prior gate suppressed the pill when
            an influence% existed, but evidence cards need the Npp signal to
            motivate the "Set value" action regardless of influence weight. */}
        {evoiImpact != null && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full border border-info/30 ${typography.panelMeta} text-text-body`}>
            {evoiImpact.toFixed(1)}pp
          </span>
        )}
      </div>

      {/* Coaching line + value controls — stacked.
          Subtitle takes its own full-width row on top so it can wrap naturally
          at narrow panel widths (280–480px). Value controls render on a
          right-aligned row below. Brings parity with the edge-card layout
          (see `isEdge` block below) and removes the horizontal squeeze that
          forced spurious More/Less toggles on short subtitles. */}
      {!isEdge && (subtitle || displayDetail) && (
        <div className={`flex flex-col gap-1 mt-0.5 min-w-0 ${ordinal != null ? 'pl-7' : ''}`}>
          <ExpandableCoachingText
            text={subtitle || displayDetail}
            className="text-text-light"
          />
          {editorConfig ? (
            <div className="flex justify-end">
              <InlineValueControls
                editorConfig={editorConfig}
                onConfirm={action?.targetId && onConfirm ? () => onConfirm!(action!.targetId!) : undefined}
                title={title}
              />
            </div>
          ) : action ? (
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-1.5 flex-shrink-0" data-testid="triage-card-icon-group">
                {action.kind === 'confirm' && onConfirm && action.targetId && (
                  <IconActionButton
                    icon={Check}
                    tooltip="Confirm AI estimate"
                    hoverClass="hover:text-success"
                    onClick={() => onConfirm!(action!.targetId!)}
                    aria-label="Confirm AI estimate"
                  />
                )}
                {action.kind === 'edit' && onEdit && action.targetId && (
                  <IconActionButton
                    icon={Pencil}
                    tooltip="Edit value"
                    hoverClass="hover:text-text-body"
                    onClick={() => onEdit!(action!.targetId!)}
                    aria-label="Edit value"
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Edge cards keep the two-row layout: coaching line, then strength quick-select */}
      {isEdge && (
        <>
          {(subtitle || displayDetail) && (
            <div className={ordinal != null ? 'pl-7' : ''}>
              <ExpandableCoachingText
                text={subtitle || displayDetail}
                className="text-text-light"
              />
            </div>
          )}
          {action?.targetId && onUpdateEdgeStrength && (
            <div className={`mt-1.5 ${ordinal != null ? 'pl-7' : ''}`}>
              <EdgeStrengthQuickSelect edgeId={action.targetId} onUpdateEdgeStrength={onUpdateEdgeStrength} />
            </div>
          )}
        </>
      )}

      {/* Discuss-with-AI affordance, anchored bottom-right of the card.
          Brief 5.7 close-out follow-up: now a slot — consumers pass the
          rendered element so this shared component does not depend on
          canvas's DiscussWithAiButton. */}
      {aiDiscussSlot && (
        <div className="absolute bottom-1 right-1">
          {aiDiscussSlot}
        </div>
      )}
    </div>
  )
}

export default TriageCard

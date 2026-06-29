/**
 * FocusRowCard — one Focus Now coaching row.
 *
 * Collapsed: a neutral topical icon (static rows) or the entity shape cue (server
 * rows that reference a real entity) + the primary line, clamped to one line.
 * Expanded: "what Olumi noticed" (server rows only — a static row never claims
 * detection), "why it matters", a "Try this" nudge, then the action bar: a primary
 * CTA plus an "Ask Olumi" icon affordance.
 *
 * Accessibility scaffold replicated from CoachingActionCard (a11y-proven): the
 * header is a native button carrying aria-expanded + aria-controls, named by the
 * primary line; the expanded region is mounted only when open and labelled by the
 * primary line. Controlled by the parent so the list keeps one row open at a time.
 *
 * Both action controls are PREFILL-ONLY and do the SAME thing: the card never
 * touches a store or sends — each calls the injected `onTryAction`, which prefills
 * the chat composer and opens the chat tab. Never auto-sends, never mutates the
 * graph, never runs analysis. The "Ask Olumi" icon is a native button with an
 * accessible label + tooltip, so it is keyboard-operable and not a dead control.
 * The whole action bar is omitted when no `onTryAction` is injected (e.g. the
 * container cannot reveal the chat because aiPanelV2 is off) — never a dead button.
 */
import { useId, type CSSProperties } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Sparkles,
  Target,
  Clock,
  Flag,
  ShieldAlert,
  Scale,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { typography } from '@/styles/typography'
import Tooltip from '@/components/Tooltip'
import { EntityTarget } from '../EntityTarget'
import { FOCUS_COPY } from './focusConstants'
import type { FocusRow } from './focusTypes'

const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  clock: Clock,
  flag: Flag,
  'shield-alert': ShieldAlert,
  scale: Scale,
  lightbulb: Lightbulb,
}

interface FocusRowCardProps {
  row: FocusRow
  isOpen: boolean
  onToggle: () => void
  onTryAction?: (row: FocusRow) => void
}

function RowMarker({ row }: { row: FocusRow }) {
  // Server rows that name an entity use the shape-first cue; static rows use a
  // neutral topical icon; anything else degrades to EntityTarget's neutral dot.
  if (row.targetKind) {
    return <EntityTarget targetKind={row.targetKind} />
  }
  const Icon = row.iconKey ? ICON_MAP[row.iconKey] : undefined
  if (Icon) {
    return <Icon className="h-[18px] w-[18px] text-text-light" aria-hidden="true" />
  }
  return <EntityTarget />
}

export function FocusRowCard({ row, isOpen, onToggle, onTryAction }: FocusRowCardProps) {
  const regionId = useId()
  const labelId = useId()
  const Chevron = isOpen ? ChevronDown : ChevronRight
  const primary = row.primary ?? ''
  const hasPrimary = primary.trim().length > 0

  const clampStyle: CSSProperties | undefined = isOpen
    ? undefined
    : {
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }

  return (
    <div
      data-testid="focus-card"
      data-row-id={row.id}
      data-ownership={row.ownership}
      data-source={row.source}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={regionId}
        aria-label={hasPrimary ? undefined : FOCUS_COPY.itemFallback}
        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-inset"
      >
        <span className="mt-0.5 flex-none">
          <RowMarker row={row} />
        </span>
        <span
          id={labelId}
          className={`${typography.panelBody} min-w-0 flex-1 text-text-header`}
          style={clampStyle}
        >
          {primary}
        </span>
        <Chevron className="mt-0.5 h-4 w-4 flex-none text-text-light" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={regionId}
          role="region"
          {...(hasPrimary ? { 'aria-labelledby': labelId } : { 'aria-label': FOCUS_COPY.itemFallback })}
          className="flex flex-col gap-2 pb-3 pl-[42px] pr-3.5 pt-1"
          data-testid="focus-card-body"
        >
          {/* Server rows only — a static row never claims a detection. */}
          {row.noticed && (
            <p className={`${typography.panelBody} text-text-body`} data-testid="focus-noticed">
              {row.noticed}
            </p>
          )}

          {row.whyItMatters && (
            <p className={`${typography.panelBody} text-text-light`} data-testid="focus-why">
              {row.whyItMatters}
            </p>
          )}

          {row.tryThis && (
            <p className={`${typography.panelBody} text-text-body`} data-testid="focus-try">
              <span className="text-primary">{FOCUS_COPY.tryThisLabel}</span>{' '}
              {row.tryThis}
            </p>
          )}

          {onTryAction && row.action?.kind === 'prefill' && row.action.prefillText && (
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTryAction?.(row)}
                data-testid="focus-action"
                className={`${typography.panelMeta} inline-flex flex-none items-center rounded-full bg-primary px-3 py-1.5 text-text-on-color outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-info`}
              >
                {row.action.label}
              </button>

              {/* Icon affordance — same prefill + open-chat action as the CTA
                  (never sends, never mutates the graph, never runs analysis). */}
              <Tooltip content={FOCUS_COPY.askOlumi}>
                <button
                  type="button"
                  onClick={() => onTryAction?.(row)}
                  aria-label={FOCUS_COPY.askOlumi}
                  data-testid="focus-ask-olumi"
                  className="ml-auto inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-panel-border text-info outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FocusRowCard

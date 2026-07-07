import { Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'

export interface AnalysisFooterProps {
  statusIcon: LucideIcon
  statusIconClassName?: string
  statusText: string
  metaText?: ReactNode
  actionLabel: string
  onAction: () => void
  actionDisabled?: boolean
  actionLoading?: boolean
  actionAriaLabel?: string
  actionTitle?: string
  /**
   * Visual treatment of the action button.
   *  - 'primary' (default): filled `bg-primary` per DS v5.
   *  - 'secondary': outlined transparent fill — used for "Rerun analysis"
   *    when results are stale, so a re-run reads as a refinement, not a
   *    fresh primary action.
   */
  actionVariant?: 'primary' | 'secondary'
  /**
   * Brief 5.8A D6: layout for the status + meta region on the left.
   *  - 'inline' (default): status text + meta text on a single row,
   *    separated by a middot. Matches the post-analysis footer.
   *  - 'stacked': status row above meta row in a flex-col block. Matches
   *    the pre-analysis wireframe.
   */
  metaPlacement?: 'inline' | 'stacked'
  testId?: string
}

export function AnalysisFooter({
  statusIcon: StatusIcon,
  statusIconClassName = 'text-text-light',
  statusText,
  metaText,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  actionAriaLabel,
  actionTitle,
  actionVariant = 'primary',
  metaPlacement = 'inline',
  testId = 'sticky-footer',
}: AnalysisFooterProps) {
  const variantClasses =
    actionVariant === 'secondary'
      ? 'bg-transparent text-info border border-info/30 hover:bg-panel-hover'
      : 'bg-primary text-text-on-color hover:bg-primary-hover'
  return (
    <div
      className="sticky bottom-0 z-10 flex-shrink-0 border-t border-panel-border bg-panel px-4 py-1.5"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3">
        {metaPlacement === 'stacked' ? (
          <div className={`flex min-w-0 flex-col ${typography.panelMeta}`}>
            <div className="flex items-center gap-1.5">
              <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusIconClassName}`} aria-hidden="true" />
              <span className={`font-medium ${statusIconClassName}`}>{statusText}</span>
            </div>
            {metaText ? (
              <span className="text-[10px] text-text-light leading-snug truncate" data-testid="sticky-footer-meta">
                {metaText}
              </span>
            ) : null}
          </div>
        ) : (
          <div className={`flex min-w-0 items-center gap-2 ${typography.panelMeta}`}>
            <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusIconClassName}`} aria-hidden="true" />
            <span className="text-text-body">{statusText}</span>
            {metaText ? (
              <>
                <span className="text-text-light" aria-hidden="true">·</span>
                <span className="truncate text-text-light">{metaText}</span>
              </>
            ) : null}
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            aria-disabled={actionDisabled ? 'true' : 'false'}
            aria-label={actionAriaLabel ?? actionLabel}
            title={actionTitle}
            data-action-variant={actionVariant}
            data-testid={`${testId}-action`}
            className={`
              min-h-8 rounded-full px-4 ${typography.panelBody}
              inline-flex items-center justify-center gap-2 transition-colors
              ${variantClasses}
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-info focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-40
            `}
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnalysisFooter

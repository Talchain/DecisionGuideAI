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
  testId = 'sticky-footer',
}: AnalysisFooterProps) {
  return (
    <div
      className="sticky bottom-0 z-10 flex-shrink-0 border-t border-panel-border bg-panel px-4 py-2"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`flex min-w-0 items-center gap-2 ${typography.panelMeta}`}>
          <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusIconClassName}`} aria-hidden="true" />
          <span className="truncate text-text-body">{statusText}</span>
          {metaText ? (
            <>
              <span className="text-text-light" aria-hidden="true">·</span>
              <span className="truncate text-text-light">{metaText}</span>
            </>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-disabled={actionDisabled ? 'true' : 'false'}
          aria-label={actionAriaLabel ?? actionLabel}
          title={actionTitle}
          className={`
            min-h-11 rounded-full px-4 ${typography.panelBody}
            inline-flex items-center justify-center gap-2
            bg-primary text-text-on-color transition-colors
            hover:bg-primary-hover focus:outline-none focus-visible:ring-2
            focus-visible:ring-info focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-40
          `}
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

export default AnalysisFooter

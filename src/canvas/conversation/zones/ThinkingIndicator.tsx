import { typography } from '../../../styles/typography'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export function ThinkingIndicator({ label }: { label?: string | null }) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <div className="ok-thinking-indicator" data-testid="thinking-indicator">
      <svg width="16" height="16" viewBox="0 0 12 12" aria-hidden="true">
        <path
          className={reducedMotion ? 'ok-thinking-mark ok-thinking-mark-static' : 'ok-thinking-mark ok-thinking-mark-morph'}
          d="M 6 1 L 11 6 L 6 11 L 1 6 Z"
        />
      </svg>
      {label && <span className={`text-text-light ${typography.chatMeta}`} data-testid="thinking-label">{label}</span>}
    </div>
  )
}

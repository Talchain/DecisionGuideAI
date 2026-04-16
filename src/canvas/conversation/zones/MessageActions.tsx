/**
 * MessageActions — hover/focus action bar on messages.
 *
 * User messages: Copy. AI messages: Copy, Retry.
 * 26px visual circle inside 44px touch target (DS v5 §8.11).
 * Hover: border transitions to info. Positioned absolute inside message card.
 * User: right-aligned. AI: left-aligned.
 */

import { Copy, RefreshCw } from 'lucide-react'

interface MessageActionsProps {
  role: 'user' | 'assistant'
  content: string
  onRetry?: () => void
  /** @deprecated No longer used — kept for caller compatibility. */
  isFirst?: boolean
}

export function MessageActions({ role, content, onRetry }: MessageActionsProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content).catch(() => {
      // Fallback silently
    })
  }

  return (
    <div
      className={`
        flex absolute z-10 pointer-events-auto
        ${role === 'user' ? 'right-0' : 'left-0'}
        top-0
      `}
      style={{ margin: '-9px' }}
      role="toolbar"
      aria-label="Message actions"
      data-testid="message-actions"
    >
      <ActionButton icon={Copy} label="Copy" onClick={handleCopy} />
      {role === 'assistant' && onRetry && (
        <ActionButton icon={RefreshCw} label="Retry" onClick={onRetry} />
      )}
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="
        group/action w-[44px] h-[44px] flex items-center justify-center
        cursor-pointer
        focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
        rounded-full
      "
    >
      {/* 26px visual circle inside 44px touch target (DS v5 §8.11) */}
      <span
        className="
          w-[26px] h-[26px] flex items-center justify-center rounded-full
          bg-panel text-text-light
          group-hover/action:border-info group-hover/action:text-info
          transition-all duration-100
        "
        style={{
          border: '1px solid var(--border-default, #EEE6D8)',
          boxShadow: '0 1px 2px rgba(38,38,38,0.06)',
        }}
        aria-hidden="true"
      >
        <Icon className="w-3 h-3" strokeWidth={1.8} />
      </span>
    </button>
  )
}

/**
 * MessageActions — hover/focus action bar on messages.
 *
 * User messages: Copy. AI messages: Copy, Retry.
 * Individual 26px circle buttons, bg-panel, border-default, shadow-s1.
 * Hover: border transitions to info. Positioned absolute above message.
 * User: right-aligned. AI: left-aligned.
 */

import { Copy, RefreshCw } from 'lucide-react'

interface MessageActionsProps {
  role: 'user' | 'assistant'
  content: string
  onRetry?: () => void
  isFirst?: boolean
}

export function MessageActions({ role, content, onRetry, isFirst = false }: MessageActionsProps) {
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
        ${isFirst ? 'top-2' : '-top-2.5'}
      `}
      style={{ gap: 3 }}
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
      className={`
        w-[26px] h-[26px] flex items-center justify-center rounded-full
        bg-panel text-text-light cursor-pointer
        hover:border-info hover:text-info
        transition-all duration-100
        focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
      `}
      style={{
        border: '1px solid var(--border-default, #EEE6D8)',
        boxShadow: '0 1px 2px rgba(38,38,38,0.06)',
      }}
    >
      <Icon className="w-3 h-3" strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
}

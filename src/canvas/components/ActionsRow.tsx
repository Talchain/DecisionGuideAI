/**
 * Actions Row Component
 *
 * Primary actions for the current analysis run:
 * - Run Again (with same seed or new)
 * - Compare (switch to compare tab)
 * - Share (copy link or export)
 */

import { Play, GitCompare, Share2 } from 'lucide-react'

interface ActionsRowProps {
  onRunAgain: () => void
  onCompare: () => void
  onShare: () => void
  disabled?: boolean
}

export function ActionsRow({ onRunAgain, onCompare, onShare, disabled = false }: ActionsRowProps) {
  return (
    <div
      className="actions-row"
      style={{
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1.5rem'
      }}
    >
      <ActionButton
        icon={<Play className="w-4 h-4" />}
        label="Analyze again"
        onClick={onRunAgain}
        disabled={disabled}
        variant="primary"
        shortcut="⌘↵"
      />
      <ActionButton
        icon={<GitCompare className="w-4 h-4" />}
        label="Compare"
        onClick={onCompare}
        disabled={disabled}
        variant="secondary"
      />
      <ActionButton
        icon={<Share2 className="w-4 h-4" />}
        label="Share"
        onClick={onShare}
        disabled={disabled}
        variant="secondary"
      />
    </div>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled: boolean
  variant: 'primary' | 'secondary'
  shortcut?: string
}

function ActionButton({ icon, label, onClick, disabled, variant, shortcut }: ActionButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="action-button"
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        flex: isPrimary ? '1 1 0' : '0 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        borderRadius: '0.375rem',
        border: isPrimary ? 'none' : '1px solid rgba(91, 108, 255, 0.3)',
        backgroundColor: isPrimary ? 'var(--olumi-primary)' : 'rgba(91, 108, 255, 0.1)',
        color: isPrimary ? 'white' : 'var(--olumi-primary)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {icon}
      <span>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: '0.75rem',
            opacity: 0.8,
            marginLeft: '0.25rem',
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem',
            backgroundColor: isPrimary ? 'rgba(255, 255, 255, 0.2)' : 'rgba(91, 108, 255, 0.15)',
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  )
}

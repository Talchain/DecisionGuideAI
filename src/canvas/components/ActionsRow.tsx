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
        label="Run Again"
        onClick={onRunAgain}
        disabled={disabled}
        variant="primary"
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
}

function ActionButton({ icon, label, onClick, disabled, variant }: ActionButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium
        transition-all duration-200
        ${isPrimary ? 'flex-1 bg-info-500 hover:bg-info-600 text-white border-none' : 'flex-none bg-info-50 hover:bg-info-100 text-info-600 border border-info-200'}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'}
      `}
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * Actions Row Component
 *
 * Primary actions for the current analysis run:
 * - Run Again (with same seed or new)
 * - Compare (switch to compare tab)
 * - Share (copy link or export)
 *
 * B7 P1 Polish: All disabled states have tooltips explaining why
 */

import { Play, GitCompare, Share2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

interface ActionsRowProps {
  onRunAgain: () => void
  onCompare: () => void
  onShare: () => void
  disabled?: boolean
  disabledReason?: string
}

export function ActionsRow({ onRunAgain, onCompare, onShare, disabled = false, disabledReason }: ActionsRowProps) {
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
        tooltip={disabled ? (disabledReason || 'Action unavailable') : 'Run analysis again with different seed'}
      />
      <ActionButton
        icon={<GitCompare className="w-4 h-4" />}
        label="Compare"
        onClick={onCompare}
        disabled={disabled}
        variant="secondary"
        tooltip={disabled ? (disabledReason || 'Action unavailable') : 'Compare with other runs'}
      />
      <ActionButton
        icon={<Share2 className="w-4 h-4" />}
        label="Share"
        onClick={onShare}
        disabled={disabled}
        variant="secondary"
        tooltip={disabled ? (disabledReason || 'Action unavailable') : 'Share this analysis'}
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
  tooltip?: string
}

function ActionButton({ icon, label, onClick, disabled, variant, tooltip }: ActionButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <Tooltip content={tooltip || label} position="bottom">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip || label}
        className={`
          flex items-center justify-center gap-2 px-4 py-2.5 rounded-md ${typography.body} font-medium
          transition-all duration-200
          ${isPrimary ? 'flex-1 bg-info hover:opacity-90 text-text-on-color border-none' : 'flex-none bg-panel hover:opacity-80 text-info border border-info/30'}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'}
        `}
      >
        {icon}
        {label}
      </button>
    </Tooltip>
  )
}

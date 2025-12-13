/**
 * ProvenanceBadge - Shows provenance status for AI-assisted values
 * Implements CEE Transparency Principle: clear attribution for all AI suggestions.
 */

import { memo } from 'react'
import { Sparkles, User, Check, RefreshCw } from 'lucide-react'
import { typography } from '../../styles/typography'

export type ProvenanceType = 'ai-suggested' | 'user-modified' | 'accepted' | 'template' | 'inferred'

export interface ProvenanceBadgeProps {
  /** The provenance type to display */
  type: ProvenanceType
  /** Optional: Show icon */
  showIcon?: boolean
  /** Optional: Compact mode (smaller) */
  compact?: boolean
  /** Optional: Additional className */
  className?: string
}

const provenanceConfig: Record<ProvenanceType, {
  label: string
  icon: typeof Sparkles
  bg: string
  text: string
  border: string
}> = {
  'ai-suggested': {
    label: 'AI Suggested',
    icon: Sparkles,
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
  'user-modified': {
    label: 'User Modified',
    icon: User,
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
  'accepted': {
    label: 'Accepted',
    icon: Check,
    bg: 'bg-mint-50',
    text: 'text-mint-700',
    border: 'border-mint-200',
  },
  'template': {
    label: 'From Template',
    icon: RefreshCw,
    bg: 'bg-info-50',
    text: 'text-info-700',
    border: 'border-info-200',
  },
  'inferred': {
    label: 'Inferred',
    icon: Sparkles,
    bg: 'bg-sand-50',
    text: 'text-sand-600',
    border: 'border-sand-200',
  },
}

export const ProvenanceBadge = memo(function ProvenanceBadge({
  type,
  showIcon = true,
  compact = false,
  className = '',
}: ProvenanceBadgeProps) {
  const config = provenanceConfig[type]
  const Icon = config.icon

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded border
        ${config.bg} ${config.text} ${config.border}
        ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
        ${compact ? typography.caption : typography.label}
        font-medium
        ${className}
      `}
      data-testid={`provenance-badge-${type}`}
    >
      {showIcon && (
        <Icon
          className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  )
})

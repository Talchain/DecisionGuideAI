/**
 * VerdictCard Component
 *
 * Displays objective-anchored verdict for analysis results.
 * Shows whether outcomes support, oppose, or have mixed impact on user's stated goal.
 */

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { VerdictResult } from '../utils/interpretOutcome'
import { typography } from '../../styles/typography'

interface VerdictCardProps {
  verdict: VerdictResult
  objectiveText: string
  outcomeValue: number
  units?: string
}

const verdictConfig = {
  supports: {
    icon: CheckCircle,
    title: 'Supports your objective',
    bgColor: 'bg-success-50',
    borderColor: 'border-success-200',
    iconColor: 'text-success-600',
    textColor: 'text-success-900',
  },
  mixed: {
    icon: AlertTriangle,
    title: 'Mixed outcome',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    iconColor: 'text-warning-600',
    textColor: 'text-warning-900',
  },
  opposes: {
    icon: XCircle,
    title: 'Works against your objective',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    iconColor: 'text-danger-600',
    textColor: 'text-danger-900',
  },
}

export function VerdictCard({ verdict, objectiveText, outcomeValue, units }: VerdictCardProps) {
  const config = verdictConfig[verdict.verdict]
  const Icon = config.icon

  const strengthText =
    verdict.strength === 'strongly' ? 'strongly ' : verdict.strength === 'moderately' ? '' : 'slightly '

  const bodyText = {
    supports: `This configuration ${strengthText}supports ${objectiveText}.`,
    mixed: `This configuration has mixed impact on ${objectiveText}. Trade-offs may apply.`,
    opposes: `This configuration ${strengthText}works against ${objectiveText}. Consider revising.`,
  }[verdict.verdict]

  const formattedValue = units ? `${outcomeValue.toFixed(2)} ${units}` : outcomeValue.toFixed(2)

  return (
    <div
      className={`
        rounded-lg border p-4 space-y-2
        ${config.bgColor} ${config.borderColor}
      `}
      role="status"
      aria-live="polite"
      data-testid="verdict-card"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${config.iconColor}`} aria-hidden="true" />
        <span className={`${typography.label} ${config.textColor}`}>{config.title}</span>
      </div>

      <p className={`${typography.body} ${config.textColor}`}>{bodyText}</p>

      {outcomeValue !== null && outcomeValue !== undefined && (
        <div className={`${typography.body} ${config.textColor} opacity-75 mt-1`}>
          Expected outcome: <span className="font-medium tabular-nums">{formattedValue}</span>
        </div>
      )}
    </div>
  )
}

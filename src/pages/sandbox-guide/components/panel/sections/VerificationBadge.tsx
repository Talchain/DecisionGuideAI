/**
 * Verification Badge
 *
 * Trust signal showing numerical grounding verification status.
 * Displays verification score with severity-based visual states:
 * - ✓ Verified (>=95%): All numbers verified against engine
 * - ⚠ Review Recommended (>=80%): Some unverified content
 * - ✗ Verification Issues (<80%): Significant unverified content
 *
 * Expandable to show critical issues when present.
 */

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { useState } from 'react'

interface VerificationIssue {
  stage: string
  severity: 'info' | 'warning' | 'error'
  code: string
  message?: string
}

interface VerificationBadgeProps {
  verification?: {
    numerical_grounding_score: number
    schema_valid: boolean
    engine_validated: boolean
    issues_detected?: VerificationIssue[]
  }
}

type VerificationVariant = 'verified' | 'review' | 'issues'

interface VariantConfig {
  icon: typeof CheckCircle
  label: string
  description: string
  colorClasses: string
}

export function VerificationBadge({ verification }: VerificationBadgeProps): JSX.Element | null {
  const [showDetail, setShowDetail] = useState(false)

  if (!verification) return null

  const score = verification.numerical_grounding_score

  // Determine state based on score
  let variant: VerificationVariant
  let config: VariantConfig

  if (score >= 0.95) {
    variant = 'verified'
    config = {
      icon: CheckCircle,
      label: 'Verified',
      description: 'All analysis numbers verified against engine',
      colorClasses: 'text-green-600 bg-green-50 border-green-200',
    }
  } else if (score >= 0.80) {
    variant = 'review'
    config = {
      icon: AlertTriangle,
      label: 'Review Recommended',
      description: 'Some unverified content detected',
      colorClasses: 'text-amber-600 bg-amber-50 border-amber-200',
    }
  } else {
    variant = 'issues'
    config = {
      icon: XCircle,
      label: 'Verification Issues',
      description: 'Significant unverified content',
      colorClasses: 'text-red-600 bg-red-50 border-red-200',
    }
  }

  const Icon = config.icon

  const criticalIssues =
    verification.issues_detected?.filter(
      (i) => i.severity === 'error' || i.severity === 'warning'
    ) || []

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowDetail(!showDetail)}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          border font-sans text-sm font-medium
          transition-all hover:shadow-sm
          ${config.colorClasses}
        `}
        aria-label={`Verification: ${config.label}`}
        {...(criticalIssues.length > 0 && { 'aria-expanded': showDetail ? 'true' : 'false' })}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span>{config.label}</span>
        {criticalIssues.length > 0 && (
          <span className="ml-1 text-xs opacity-75">({criticalIssues.length})</span>
        )}
      </button>

      {showDetail && criticalIssues.length > 0 && (
        <div className="pl-4 border-l-2 border-storm-200 space-y-1" role="region" aria-label="Verification details">
          <p className="text-xs text-storm-600 font-sans">{config.description}</p>
          <div className="space-y-1">
            {criticalIssues.slice(0, 3).map((issue, idx) => (
              <div key={idx} className="text-xs text-storm-700 font-sans">
                <span className="font-medium">{issue.stage}:</span>{' '}
                {issue.message || issue.code}
              </div>
            ))}
            {criticalIssues.length > 3 && (
              <button
                className="text-xs text-analytical-600 hover:underline font-sans"
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Implement show all issues modal
                  console.log('Show all issues:', criticalIssues)
                }}
              >
                Show all {criticalIssues.length} issues
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

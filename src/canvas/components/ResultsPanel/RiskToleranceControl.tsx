/**
 * RiskToleranceControl - User preference for risk level
 *
 * Brief H Task 12: Control for adjusting risk tolerance in analysis
 *
 * Features:
 * - Slider or segmented control for risk preference
 * - Shows how preference affects recommendations
 * - Persists preference in local state
 */

import { useState, useCallback } from 'react'
import { Shield, AlertTriangle, Zap, Info } from 'lucide-react'
import { typography } from '../../../styles/typography'

type RiskLevel = 'conservative' | 'balanced' | 'aggressive'

interface RiskToleranceControlProps {
  /** Current risk level */
  value?: RiskLevel
  /** Callback when risk level changes */
  onChange?: (level: RiskLevel) => void
  /** Show explanation of how risk affects analysis */
  showExplanation?: boolean
  /** Compact mode (inline buttons) */
  compact?: boolean
}

const RISK_CONFIG: Record<RiskLevel, {
  icon: typeof Shield
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  conservative: {
    icon: Shield,
    label: 'Conservative',
    description: 'Prioritize stability and downside protection',
    color: 'text-mint-700',
    bgColor: 'bg-mint-100',
    borderColor: 'border-mint-300',
  },
  balanced: {
    icon: Zap,
    label: 'Balanced',
    description: 'Balance risk and reward',
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-300',
  },
  aggressive: {
    icon: AlertTriangle,
    label: 'Aggressive',
    description: 'Maximize upside, accept more risk',
    color: 'text-carrot-700',
    bgColor: 'bg-carrot-100',
    borderColor: 'border-carrot-300',
  },
}

export function RiskToleranceControl({
  value = 'balanced',
  onChange,
  showExplanation = true,
  compact = false,
}: RiskToleranceControlProps) {
  const [selectedLevel, setSelectedLevel] = useState<RiskLevel>(value)

  const handleSelect = useCallback(
    (level: RiskLevel) => {
      setSelectedLevel(level)
      onChange?.(level)
    },
    [onChange]
  )

  const currentConfig = RISK_CONFIG[selectedLevel]

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 p-1 bg-sand-100 rounded-lg"
        data-testid="risk-tolerance-compact"
        role="radiogroup"
        aria-label="Risk tolerance"
      >
        {(Object.keys(RISK_CONFIG) as RiskLevel[]).map((level) => {
          const config = RISK_CONFIG[level]
          const isSelected = selectedLevel === level
          const Icon = config.icon

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(level)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                isSelected
                  ? `${config.bgColor} ${config.color}`
                  : 'text-ink-500 hover:bg-sand-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className={`${typography.caption} font-medium`}>
                {config.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="risk-tolerance-control">
      <div className="flex items-center gap-2">
        <span className={`${typography.label} text-ink-700`}>Risk Tolerance</span>
        {showExplanation && (
          <div className="relative group">
            <Info className="h-4 w-4 text-ink-400 cursor-help" aria-hidden="true" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-ink-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              Affects how we weigh upside vs downside scenarios
            </div>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Risk tolerance"
      >
        {(Object.keys(RISK_CONFIG) as RiskLevel[]).map((level) => {
          const config = RISK_CONFIG[level]
          const isSelected = selectedLevel === level
          const Icon = config.icon

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(level)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                isSelected
                  ? `${config.bgColor} ${config.borderColor}`
                  : 'bg-paper-50 border-sand-200 hover:border-sand-300'
              }`}
            >
              <Icon
                className={`h-5 w-5 mx-auto mb-1.5 ${
                  isSelected ? config.color : 'text-ink-400'
                }`}
                aria-hidden="true"
              />
              <span
                className={`${typography.caption} font-medium block ${
                  isSelected ? config.color : 'text-ink-600'
                }`}
              >
                {config.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Current selection explanation */}
      <div
        className={`flex items-start gap-2 p-2.5 rounded-lg ${currentConfig.bgColor}`}
      >
        <currentConfig.icon
          className={`h-4 w-4 ${currentConfig.color} flex-shrink-0 mt-0.5`}
          aria-hidden="true"
        />
        <p className={`${typography.caption} ${currentConfig.color}`}>
          {currentConfig.description}
        </p>
      </div>
    </div>
  )
}

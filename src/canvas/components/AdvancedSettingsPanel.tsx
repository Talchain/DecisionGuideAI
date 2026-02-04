/**
 * AdvancedSettingsPanel - Collapsible settings panel for Results tab
 *
 * Contains:
 * - Risk Tolerance: 3-position selector (functional, persists to localStorage)
 * - Structural Uncertainty: Coming Soon toggle (disabled)
 *
 * Located at the bottom of the Results tab, collapsed by default.
 */

import { useState, useCallback, useEffect, memo } from 'react'
import { ChevronRight, ChevronDown, Settings2, Info, Lock } from 'lucide-react'
import { typography } from '../../styles/typography'
import { RISK_PRESETS } from '../hooks/useRiskProfile'
import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

const STORAGE_KEY = 'canvas.riskProfile.v1'

interface AdvancedSettingsPanelProps {
  /** Start expanded (default: false) */
  defaultExpanded?: boolean
}

export const AdvancedSettingsPanel = memo(function AdvancedSettingsPanel({
  defaultExpanded = false,
}: AdvancedSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Risk profile state - load from localStorage
  const [profile, setProfile] = useState<RiskProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Persist profile changes to localStorage
  useEffect(() => {
    try {
      if (profile) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [profile])

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: RiskProfilePreset) => {
    const config = RISK_PRESETS[preset]
    const newProfile: RiskProfile = {
      profile: preset,
      label: config.label,
      score: config.score,
      confidence: 'medium',
      reasoning: config.description,
    }
    setProfile(newProfile)
  }, [])

  // Get current preset from profile
  const currentPreset = profile?.profile ?? 'neutral'

  return (
    <div
      className="rounded-lg border border-sand-200 bg-white"
      data-testid="advanced-settings-panel"
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-sand-50 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-controls="advanced-settings-content"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-ink-500" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ink-500" aria-hidden="true" />
          )}
          <Settings2 className="w-4 h-4 text-ink-500" aria-hidden="true" />
          <span className={`${typography.label} text-ink-800`}>
            Advanced settings
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          id="advanced-settings-content"
          className="px-4 pb-4 space-y-5 border-t border-sand-100"
        >
          {/* Risk Tolerance Section */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                id="risk-tolerance-label"
                className={`${typography.label} text-ink-800`}
              >
                Risk Tolerance
              </label>
            </div>

            {/* 3-position selector */}
            <div
              role="radiogroup"
              aria-labelledby="risk-tolerance-label"
              className="flex rounded-lg border border-sand-200 overflow-hidden"
            >
              {(['risk_averse', 'neutral', 'risk_seeking'] as RiskProfilePreset[]).map(
                (preset, index) => {
                  const config = RISK_PRESETS[preset]
                  const isSelected = currentPreset === preset
                  const isFirst = index === 0
                  const isLast = index === 2

                  return (
                    <button
                      key={preset}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handlePresetSelect(preset)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 transition-colors
                        ${isSelected
                          ? 'bg-sky-50 text-sky-700 font-medium'
                          : 'bg-white text-ink-600 hover:bg-sand-50'
                        }
                        ${!isFirst ? 'border-l border-sand-200' : ''}
                        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500
                      `}
                    >
                      <span className="text-base" aria-hidden="true">
                        {config.icon}
                      </span>
                      <span className={typography.caption}>
                        {preset === 'risk_averse'
                          ? 'Risk-averse'
                          : preset === 'neutral'
                          ? 'Neutral'
                          : 'Risk-seeking'}
                      </span>
                    </button>
                  )
                }
              )}
            </div>

            {/* Helper text */}
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className={`${typography.caption} text-ink-500`}>
                {currentPreset === 'risk_averse'
                  ? 'Emphasises downside scenarios in outcome estimates.'
                  : currentPreset === 'risk_seeking'
                  ? 'Emphasises upside potential in outcome estimates.'
                  : 'Balances conservative and optimistic scenarios equally.'}
              </p>
            </div>
          </div>

          {/* Structural Uncertainty Section - Coming Soon */}
          <div className="pt-4 border-t border-sand-100 space-y-3">
            <div className="flex items-center justify-between">
              <label
                id="structural-uncertainty-label"
                className={`${typography.label} text-ink-400`}
              >
                Structural Uncertainty
              </label>
              <span
                className={`${typography.caption} px-2 py-0.5 rounded-full bg-sand-100 text-ink-500 font-medium`}
              >
                Coming Soon
              </span>
            </div>

            {/* Disabled toggle */}
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>
                Consider edge confidence
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={false}
                aria-disabled="true"
                aria-labelledby="structural-uncertainty-label"
                disabled
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-sand-200 cursor-not-allowed opacity-60"
              >
                <span className="sr-only">Structural uncertainty (coming soon)</span>
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow translate-x-1 transition-transform"
                  aria-hidden="true"
                />
                <Lock
                  className="absolute right-1.5 h-3 w-3 text-ink-400"
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Helper text */}
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-ink-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className={`${typography.caption} text-ink-400`}>
                Will consider whether causal relationships exist based on edge confidence levels.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

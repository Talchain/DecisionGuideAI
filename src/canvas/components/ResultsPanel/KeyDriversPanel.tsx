/**
 * KeyDriversPanel - Panel 2: "Why this recommendation?"
 *
 * Brief H Task 4: Consolidated key drivers panel with sub-components
 *
 * Combines:
 * - Top drivers from PLoT analysis
 * - Sensitive parameters / Tipping points from ISL
 * - Value of Information suggestions from ISL
 * - CEE Synthesis narratives
 */

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  Lightbulb,
  FileText,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SensitivityList } from './SensitivityList'
import { TippingPointsList } from './TippingPointsList'
import { ValueOfInformationList } from './ValueOfInformationList'
import type { SensitiveParameter, ValueOfInformation } from '../RecommendationCard/types'
import type { SynthesisNarratives } from '../../hooks/useISLSynthesis'

interface Driver {
  label: string
  polarity: 'up' | 'down' | 'neutral'
  strength: 'low' | 'medium' | 'high'
  contribution?: number
  nodeId?: string
  edgeId?: string
}

/** Brief I Task 2: Factor node info for better empty state */
interface FactorNodeInfo {
  id: string
  label: string
}

interface KeyDriversPanelProps {
  /** Top drivers from PLoT */
  drivers: Driver[]
  /** Sensitive parameters from ISL */
  sensitiveParams: SensitiveParameter[]
  /** VoI suggestions from ISL */
  voiSuggestions: ValueOfInformation[]
  /** CEE synthesis narratives */
  synthesis: SynthesisNarratives | null
  /** Loading states */
  loading: {
    robustness: boolean
    synthesis: boolean
  }
  /** Callback when driver/parameter is clicked */
  onItemClick?: (nodeId: string, type: 'driver' | 'sensitivity' | 'voi') => void
  /** Brief I: Factor nodes from canvas for better empty state */
  factorNodes?: FactorNodeInfo[]
  /** Brief I: Error from ISL request */
  error?: string | null
  /** PLoT drivers_status for contextual empty state messages */
  driversStatus?: 'computed' | 'skipped' | 'unavailable' | 'error'
}

type SectionId = 'drivers' | 'sensitivity' | 'voi' | 'synthesis'

export function KeyDriversPanel({
  drivers,
  sensitiveParams,
  voiSuggestions,
  synthesis,
  loading,
  onItemClick,
  factorNodes = [],
  error,
  driversStatus,
}: KeyDriversPanelProps) {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(['drivers']) // Drivers expanded by default
  )

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleDriverClick = (nodeId: string) => {
    onItemClick?.(nodeId, 'driver')
  }

  const handleSensitivityClick = (nodeId: string) => {
    onItemClick?.(nodeId, 'sensitivity')
  }

  const handleVoiClick = (nodeId: string) => {
    onItemClick?.(nodeId, 'voi')
  }

  // Polarity icon mapping
  const getPolarityIcon = (polarity: 'up' | 'down' | 'neutral') => {
    if (polarity === 'up') return '+'
    if (polarity === 'down') return '-'
    return '~'
  }

  const hasDrivers = drivers.length > 0
  const hasSensitivity = sensitiveParams.length > 0
  const hasVoi = voiSuggestions.length > 0
  const hasSynthesis = synthesis && (synthesis.decision || synthesis.uncertainty || synthesis.recommendation)

  // Brief I Task 2: Improved empty state logic with context-aware messaging
  if (!hasDrivers && !hasSensitivity && !hasVoi && !hasSynthesis && !loading.robustness && !loading.synthesis) {
    // Case 1: Error from ISL
    if (error) {
      return (
        <div className="p-4 text-center" data-testid="key-drivers-error">
          <AlertCircle className="h-8 w-8 text-carrot-400 mx-auto mb-2" aria-hidden="true" />
          <p className={`${typography.body} text-ink-600`}>
            Unable to analyze sensitivity
          </p>
          <p className={`${typography.caption} text-ink-500 mt-1`}>
            {error}
          </p>
        </div>
      )
    }

    // Case 2: Contextual message based on drivers_status
    if (driversStatus) {
      const statusMessages: Record<string, { title: string; subtitle: string }> = {
        computed: {
          title: 'No significant drivers found',
          subtitle: 'Analysis completed but no factors significantly influence the outcome',
        },
        skipped: {
          title: 'Driver analysis skipped',
          subtitle: 'Analysis was skipped for this run',
        },
        unavailable: {
          title: 'Driver analysis unavailable',
          subtitle: 'This analysis type is not available for the current model',
        },
        error: {
          title: 'Driver analysis failed',
          subtitle: 'An error occurred during driver analysis',
        },
      }
      const msg = statusMessages[driversStatus] ?? statusMessages.computed
      return (
        <div className="p-4 text-center" data-testid="key-drivers-status">
          <Info className="h-8 w-8 text-sky-400 mx-auto mb-2" aria-hidden="true" />
          <p className={`${typography.body} text-ink-600`}>
            {msg.title}
          </p>
          <p className={`${typography.caption} text-ink-500 mt-1`}>
            {msg.subtitle}
          </p>
        </div>
      )
    }

    // Case 3: Factors exist but no sensitivity data returned
    if (factorNodes.length > 0) {
      return (
        <div className="p-4 text-center" data-testid="key-drivers-no-sensitivity">
          <Info className="h-8 w-8 text-sky-400 mx-auto mb-2" aria-hidden="true" />
          <p className={`${typography.body} text-ink-600`}>
            {factorNodes.length} factor{factorNodes.length !== 1 ? 's' : ''} detected
          </p>
          <p className={`${typography.caption} text-ink-500 mt-1`}>
            Sensitivity analysis pending. Run analysis to see which factors matter most.
          </p>
        </div>
      )
    }

    // Case 4: No factors on canvas
    return (
      <div className="p-4 text-center" data-testid="key-drivers-empty">
        <Zap className="h-8 w-8 text-sand-300 mx-auto mb-2" aria-hidden="true" />
        <p className={`${typography.body} text-ink-600`}>
          No key factors identified
        </p>
        <p className={`${typography.caption} text-ink-500 mt-1`}>
          Add quantitative factors to your model to see sensitivity analysis
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-sand-100" data-testid="key-drivers-panel">
      {/* Section 1: Top Drivers */}
      {(hasDrivers || loading.robustness) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('drivers')}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-sand-50 transition-colors"
            aria-expanded={expandedSections.has('drivers')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('drivers') ? (
                <ChevronDown className="h-4 w-4 text-ink-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-500" />
              )}
              <Zap className="h-4 w-4 text-sky-500" aria-hidden="true" />
              <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                Key factors
              </span>
            </div>
            <span className={`${typography.caption} text-ink-500`}>
              {drivers.length} factor{drivers.length !== 1 ? 's' : ''}
            </span>
          </button>

          {expandedSections.has('drivers') && (
            <div className="px-3 pb-3 space-y-2">
              {drivers.slice(0, 5).map((driver, index) => (
                <button
                  key={`${driver.label}-${index}`}
                  type="button"
                  onClick={() => driver.nodeId && handleDriverClick(driver.nodeId)}
                  disabled={!driver.nodeId}
                  className={`w-full px-3 py-2 rounded-lg text-left ${
                    driver.nodeId
                      ? 'hover:bg-sand-50 cursor-pointer'
                      : 'cursor-default'
                  } transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                          driver.polarity === 'up'
                            ? 'bg-mint-100 text-mint-700'
                            : driver.polarity === 'down'
                              ? 'bg-carrot-100 text-carrot-700'
                              : 'bg-sand-100 text-sand-600'
                        }`}
                      >
                        {getPolarityIcon(driver.polarity)}
                      </span>
                      <span className={`${typography.bodySmall} text-ink-800`}>
                        {driver.label}
                      </span>
                    </div>
                    {driver.contribution !== undefined && (
                      <span className={`${typography.caption} font-medium text-ink-600`}>
                        {Math.round(driver.contribution * 100)}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Sensitivity / Tipping Points */}
      {(hasSensitivity || loading.robustness) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('sensitivity')}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-sand-50 transition-colors"
            aria-expanded={expandedSections.has('sensitivity')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('sensitivity') ? (
                <ChevronDown className="h-4 w-4 text-ink-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-500" />
              )}
              <Target className="h-4 w-4 text-banana-500" aria-hidden="true" />
              <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                Sensitivity & Tipping Points
              </span>
              {loading.robustness && (
                <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" />
              )}
            </div>
            <span className={`${typography.caption} text-ink-500`}>
              {sensitiveParams.length} threshold{sensitiveParams.length !== 1 ? 's' : ''}
            </span>
          </button>

          {expandedSections.has('sensitivity') && (
            <div className="px-3 pb-3">
              {loading.robustness && sensitiveParams.length === 0 ? (
                <div className="py-4 text-center">
                  <Loader2 className="h-5 w-5 text-sky-500 animate-spin mx-auto mb-2" />
                  <p className={`${typography.caption} text-ink-500`}>
                    Analyzing sensitivity...
                  </p>
                </div>
              ) : (
                <>
                  <TippingPointsList
                    parameters={sensitiveParams}
                    onParameterClick={handleSensitivityClick}
                    maxItems={3}
                  />
                  {sensitiveParams.length > 3 && (
                    <SensitivityList
                      parameters={sensitiveParams.slice(3)}
                      onParameterClick={handleSensitivityClick}
                      compact
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Value of Information */}
      {(hasVoi || loading.robustness) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('voi')}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-sand-50 transition-colors"
            aria-expanded={expandedSections.has('voi')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('voi') ? (
                <ChevronDown className="h-4 w-4 text-ink-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-500" />
              )}
              <Lightbulb className="h-4 w-4 text-violet-500" aria-hidden="true" />
              <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                Worth Investigating
              </span>
            </div>
            <span className={`${typography.caption} text-violet-600`}>
              {voiSuggestions.length} suggestion{voiSuggestions.length !== 1 ? 's' : ''}
            </span>
          </button>

          {expandedSections.has('voi') && (
            <ValueOfInformationList
              suggestions={voiSuggestions}
              onSuggestionClick={handleVoiClick}
            />
          )}
        </div>
      )}

      {/* Section 4: CEE Synthesis Narratives */}
      {(hasSynthesis || loading.synthesis) && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('synthesis')}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-sand-50 transition-colors"
            aria-expanded={expandedSections.has('synthesis')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('synthesis') ? (
                <ChevronDown className="h-4 w-4 text-ink-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-500" />
              )}
              <FileText className="h-4 w-4 text-sky-500" aria-hidden="true" />
              <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                Analysis Narratives
              </span>
              {loading.synthesis && (
                <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" />
              )}
            </div>
          </button>

          {expandedSections.has('synthesis') && (
            <div className="px-3 pb-3">
              {loading.synthesis && !synthesis ? (
                <div className="py-4 text-center">
                  <Loader2 className="h-5 w-5 text-sky-500 animate-spin mx-auto mb-2" />
                  <p className={`${typography.caption} text-ink-500`}>
                    Generating narratives...
                  </p>
                </div>
              ) : synthesis && (
                <div className="space-y-3 bg-sky-50/50 rounded-lg p-3">
                  {synthesis.decision && (
                    <div>
                      <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                        Decision Context
                      </h4>
                      <p className={`${typography.bodySmall} text-ink-700`}>
                        {synthesis.decision}
                      </p>
                    </div>
                  )}

                  {synthesis.uncertainty && (
                    <div>
                      <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                        Key Uncertainties
                      </h4>
                      <p className={`${typography.bodySmall} text-ink-700`}>
                        {synthesis.uncertainty}
                      </p>
                    </div>
                  )}

                  {synthesis.recommendation && (
                    <div>
                      <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                        Recommendation
                      </h4>
                      <p className={`${typography.bodySmall} text-ink-700`}>
                        {synthesis.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

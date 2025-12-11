/**
 * DetailedAnalysisSection - Grouped collapsible detail panels
 *
 * Task 4: Redesign Information Hierarchy
 * Consolidates all detail components into a single expandable section:
 * - DriversSignal (top drivers)
 * - OutcomesSignal (outcome range details)
 * - RiskAdjustedDisplay (risk-adjusted outcomes)
 * - TrustSignal (model quality)
 * - ThresholdDisplay (critical thresholds)
 *
 * Benefits:
 * - Reduces accordion fatigue (single expansion point)
 * - Default collapsed view keeps focus on Recommendation + Validate
 * - All detail components expand together, not individually
 */

import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, BarChart2, Settings2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import { DriversSignal } from './DriversSignal'
import { OutcomesSignal } from './OutcomesSignal'
import { RiskAdjustedDisplay } from './RiskAdjustedDisplay'
import { TrustSignal } from './TrustSignal'
import { ThresholdDisplay } from './ThresholdDisplay'
import { RiskTolerancePanel, useStoredRiskProfile } from './RiskTolerancePanel'
import type { ScenarioFraming } from '../store'

interface DetailedAnalysisSectionProps {
  /** Baseline value for outcome comparison */
  baselineValue: number
  /** Goal direction for interpreting changes */
  goalDirection: 'maximize' | 'minimize'
  /** Objective text describing what we're measuring */
  objectiveText?: string
  /** Backend report data */
  report: any
  /** Scenario framing data */
  framing: ScenarioFraming | null
  /** Start expanded (default: false) */
  defaultExpanded?: boolean
}

export function DetailedAnalysisSection({
  baselineValue,
  goalDirection,
  objectiveText,
  report,
  framing,
  defaultExpanded = false,
}: DetailedAnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showRiskPanel, setShowRiskPanel] = useState(false)

  // Get stored risk profile to determine if we should show contextual prompt
  const storedRiskProfile = useStoredRiskProfile()

  // Extract outcome bands from report for RiskAdjustedDisplay
  const outcomeBands = useMemo(() => {
    if (!report?.results) return null
    return {
      p10: report.results.conservative,
      p50: report.results.likely,
      p90: report.results.optimistic,
    }
  }, [report])

  // Get units info from report
  const units = report?.results?.units || 'percent'
  const unitSymbol = report?.results?.unitSymbol

  // Handle risk panel toggle
  const handleRiskPanelToggle = useCallback(() => {
    setShowRiskPanel(prev => !prev)
  }, [])

  return (
    <div
      className="border border-sand-200 rounded-xl overflow-hidden bg-paper-50"
      data-testid="detailed-analysis-section"
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50/80 active:bg-sand-100 transition-all duration-150"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          <BarChart2 className="h-4 w-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-800`}>
            Detailed Analysis
          </span>
        </div>

        {/* Collapsed summary - fade out when expanding */}
        <span
          className={`${typography.caption} text-ink-500 transition-opacity duration-150 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}
        >
          Drivers, outcomes, model quality
        </span>
      </button>

      {/* Expanded content - all detail components with fade-in animation */}
      {isExpanded && (
        <div className="border-t border-sand-200 px-4 py-4 space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Top Drivers - shows factors with highest impact */}
          <DriversSignal
            maxCollapsed={5}
            defaultExpanded={true}
          />

          {/* Outcome Details - range, confidence, baseline comparison */}
          <OutcomesSignal
            baseline={baselineValue}
            baselineName={baselineValue === 0 ? '"do nothing"' : 'your baseline'}
            goalDirection={goalDirection}
            objectiveText={objectiveText}
            defaultExpanded={false}
          />

          {/* Risk-Adjusted Outcomes - contextual flow based on profile status */}
          {outcomeBands && storedRiskProfile ? (
            // Has profile: show risk-adjusted display
            <RiskAdjustedDisplay
              bands={outcomeBands}
              units={units}
              unitSymbol={unitSymbol}
              goalDirection={goalDirection}
            />
          ) : outcomeBands && showRiskPanel ? (
            // No profile but user requested panel: show full panel
            <RiskTolerancePanel defaultExpanded={true} />
          ) : outcomeBands ? (
            // No profile: show contextual prompt (not intrusive)
            <div className="p-3 bg-gradient-to-r from-sky-50 to-violet-50 border border-sky-100 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-sky-500" aria-hidden="true" />
                  <span className={`${typography.caption} text-ink-600`}>
                    Personalise results for your risk tolerance
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRiskPanelToggle}
                  className={`${typography.caption} font-medium px-3 py-1 rounded-md bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700 transition-colors`}
                >
                  Set up
                </button>
              </div>
            </div>
          ) : null}

          {/* Model Quality Assessment */}
          <TrustSignal defaultExpanded={false} />

          {/* Critical Thresholds */}
          <ThresholdDisplay defaultExpanded={false} />
        </div>
      )}
    </div>
  )
}

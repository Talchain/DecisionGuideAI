/**
 * MultiFormAnalysis - Test alternative functional forms
 *
 * Brief 11.7: Allows users to test how different form assumptions
 * affect the analysis outcome. Shows sensitivity to form choices.
 */

import { memo, useState } from 'react'
import { FlaskConical, AlertTriangle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { FORM_DISPLAY_NAMES, type EdgeFunctionType } from '../../domain/edges'
import type { MultiFormAnalysisProps, FormSensitivityResult } from './types'

/**
 * SensitivityResultItem - Single sensitivity result row
 */
interface SensitivityResultItemProps {
  result: FormSensitivityResult
  onApplyAlternative?: (edgeId: string, form: EdgeFunctionType) => void
}

const SensitivityResultItem = memo(function SensitivityResultItem({
  result,
  onApplyAlternative,
}: SensitivityResultItemProps) {
  const formUsedInfo = FORM_DISPLAY_NAMES[result.form_used]
  const alternativeInfo = FORM_DISPLAY_NAMES[result.alternative_form]

  // Impact classification
  const impactLevel =
    Math.abs(result.impact_pct) >= 20
      ? 'high'
      : Math.abs(result.impact_pct) >= 10
        ? 'medium'
        : 'low'

  const impactColors = {
    high: 'text-red-700 bg-red-100',
    medium: 'text-amber-700 bg-amber-100',
    low: 'text-green-700 bg-green-100',
  }

  return (
    <div
      data-testid={`sensitivity-result-${result.edge_id}`}
      className={`
        p-3 rounded-lg border
        ${result.causes_flip ? 'border-red-300 bg-red-50' : 'border-sand-200 bg-white'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`${typography.caption} font-medium text-ink-700`}>
            {result.source_label} → {result.target_label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`${typography.caption} text-ink-500`}>
              {formUsedInfo?.name || result.form_used}
            </span>
            <ArrowRight className="w-3 h-3 text-ink-400" />
            <span className={`${typography.caption} text-ink-600 font-medium`}>
              {alternativeInfo?.name || result.alternative_form}
            </span>
          </div>
        </div>

        {/* Impact badge */}
        <span
          className={`
            px-2 py-0.5 rounded-full text-xs font-medium
            ${impactColors[impactLevel]}
          `}
        >
          {result.impact_pct > 0 ? '+' : ''}
          {result.impact_pct.toFixed(1)}%
        </span>
      </div>

      {/* Flip warning */}
      {result.causes_flip && (
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded bg-red-100 text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className={`${typography.caption} font-medium`}>
            This alternative would change the recommended option
          </p>
        </div>
      )}

      {/* Description */}
      {result.impact_description && (
        <p className={`${typography.caption} text-ink-600 mt-2`}>
          {result.impact_description}
        </p>
      )}

      {/* Apply button */}
      {onApplyAlternative && (
        <button
          type="button"
          onClick={() => onApplyAlternative(result.edge_id, result.alternative_form)}
          className="mt-2 text-xs text-teal-700 hover:text-teal-800 font-medium hover:underline"
        >
          Apply {alternativeInfo?.name || result.alternative_form} to this edge
        </button>
      )}
    </div>
  )
})

/**
 * MultiFormAnalysis - Sensitivity analysis panel
 */
export const MultiFormAnalysis = memo(function MultiFormAnalysis({
  results,
  loading = false,
  error = null,
  onApplyAlternative,
  onRunAnalysis,
}: MultiFormAnalysisProps) {
  const [showAll, setShowAll] = useState(false)

  // Filter results by significance
  const significantResults = results.filter(
    (r) => Math.abs(r.impact_pct) >= 5 || r.causes_flip
  )
  const displayResults = showAll ? results : significantResults

  // Summary stats
  const flipCount = results.filter((r) => r.causes_flip).length
  const highImpactCount = results.filter((r) => Math.abs(r.impact_pct) >= 20).length

  return (
    <div
      data-testid="multi-form-analysis"
      className="rounded-lg border border-sand-200 bg-sand-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sand-200">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-violet-600" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-700`}>
            Form Sensitivity Analysis
          </span>
        </div>

        {onRunAnalysis && (
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-sm font-medium hover:bg-violet-200 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Analysing...' : 'Run Analysis'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className={`${typography.caption} text-red-700`}>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            <span className={`${typography.body} text-ink-500 ml-2`}>
              Testing alternative forms...
            </span>
          </div>
        )}

        {/* No results yet */}
        {!loading && !error && results.length === 0 && (
          <div className="text-center py-6">
            <FlaskConical className="w-8 h-8 text-sand-400 mx-auto mb-2" />
            <p className={`${typography.body} text-ink-500`}>
              Run analysis to test how different form assumptions affect results
            </p>
            <p className={`${typography.caption} text-ink-400 mt-1`}>
              This helps identify which relationships are most sensitive to modelling choices
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex items-center gap-4 mb-3">
              {flipCount > 0 && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {flipCount} potential flip{flipCount > 1 ? 's' : ''}
                </span>
              )}
              {highImpactCount > 0 && (
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-medium">
                  {highImpactCount} high impact
                </span>
              )}
              <span className={`${typography.caption} text-ink-500`}>
                {results.length} edge{results.length > 1 ? 's' : ''} tested
              </span>
            </div>

            {/* Results list */}
            <div className="space-y-2">
              {displayResults.map((result) => (
                <SensitivityResultItem
                  key={`${result.edge_id}-${result.alternative_form}`}
                  result={result}
                  onApplyAlternative={onApplyAlternative}
                />
              ))}
            </div>

            {/* Show more/less toggle */}
            {significantResults.length < results.length && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className={`${typography.caption} text-violet-600 hover:text-violet-700 mt-3`}
              >
                {showAll
                  ? `Show only significant (${significantResults.length})`
                  : `Show all ${results.length} results`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
})

export default MultiFormAnalysis

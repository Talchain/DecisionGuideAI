/**
 * RisksSection - Shows risks from PLoT insights
 *
 * Displays potential concerns and risks identified in the analysis
 */

import { ExpandableSection } from '../../shared/ExpandableSection'

export interface RisksSectionProps {
  risks: string[]
  limit?: number
}

export function RisksSection({ risks, limit = 3 }: RisksSectionProps): JSX.Element {
  if (!risks || risks.length === 0) {
    return <></>
  }

  const visibleRisks = risks.slice(0, limit)
  const hiddenRisks = risks.slice(limit)
  const hasMore = hiddenRisks.length > 0

  return (
    <div className="font-sans border-t border-storm-100">
      <ExpandableSection
        title={
          <div className="font-sans flex items-center gap-2">
            <span className="text-sm font-semibold text-charcoal-900">⚠️ Risks to Consider</span>
            <span className="text-xs text-storm-500">({risks.length})</span>
          </div>
        }
        defaultOpen={risks.length <= 3}
      >
        <div className="font-sans space-y-2">
          {visibleRisks.map((risk, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-3 rounded-lg bg-creative-50 border border-creative-200"
            >
              <span className="text-creative-600 mt-0.5">•</span>
              <span className="text-sm text-charcoal-900 flex-1">{risk}</span>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="font-sans mt-3 space-y-2">
            <div className="font-sans text-xs text-storm-600 font-medium">
              Additional risks ({hiddenRisks.length}):
            </div>
            {hiddenRisks.map((risk, idx) => (
              <div
                key={idx + limit}
                className="flex items-start gap-2 p-3 rounded-lg bg-creative-50 border border-creative-200"
              >
                <span className="text-creative-600 mt-0.5">•</span>
                <span className="text-sm text-charcoal-900 flex-1">{risk}</span>
              </div>
            ))}
          </div>
        )}
      </ExpandableSection>
    </div>
  )
}

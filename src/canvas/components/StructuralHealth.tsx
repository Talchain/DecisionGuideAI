import { CheckCircle } from 'lucide-react'
import { useCEEInsights } from '../../hooks/useCEEInsights'
import { typography } from '../../styles/typography'
import type { CEEInsightsResponse } from '../../adapters/cee/types'

interface StructuralHealthSectionProps {
  insights?: CEEInsightsResponse | null
}

export function StructuralHealthSection({ insights: insightsProp }: StructuralHealthSectionProps) {
  const { data: hookInsights } = useCEEInsights()
  const insights = insightsProp ?? hookInsights

  if (!insights) return null

  const { structural_health } = insights

  if (structural_health.warnings.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className={typography.h4}>Structural Health</h3>
        <div className="flex items-center gap-2 text-mint-600">
          <CheckCircle className="w-4 h-4" />
          <span className={typography.body}>All nodes properly connected</span>
        </div>
      </div>
    )
  }

  const orphans = structural_health.warnings.filter(w => w.type === 'orphan')
  const cycles = structural_health.warnings.filter(w => w.type === 'cycle')
  const logicIssues = structural_health.warnings.filter(w => w.type === 'decision_after_outcome')

  return (
    <div className="space-y-3">
      <h3 className={typography.h4}>Structural Health</h3>

      <div className="space-y-2">
        {orphans.length > 0 && (
          <WarningCard
            icon="⚠️"
            title="Orphan Nodes"
            description={`${orphans.length} node${orphans.length !== 1 ? 's' : ''} not connected to graph`}
            action="Highlight on graph"
          />
        )}

        {cycles.length > 0 && (
          <WarningCard
            icon="↻"
            title="Circular Dependencies"
            description={`${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} detected`}
            action="Show cycles"
          />
        )}

        {logicIssues.length > 0 && (
          <WarningCard
            icon="⚠️"
            title="Logic Issues"
            description="Decision nodes appear after outcome nodes"
            action="View details"
          />
        )}
      </div>
    </div>
  )
}

interface WarningCardProps {
  icon: string
  title: string
  description: string
  action: string
}

function WarningCard({ icon, title, description, action }: WarningCardProps) {
  return (
    <div className="flex items-start gap-2 p-2 bg-sun-50 rounded">
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <p className={`${typography.label} text-sun-800`}>{title}</p>
        <p className={`${typography.bodySmall} text-ink-900/70`}>{description}</p>
        <button className={`${typography.caption} text-sky-600 underline hover:text-sky-700 mt-1`}>
          {action}
        </button>
      </div>
    </div>
  )
}

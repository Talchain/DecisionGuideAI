import { TrendingUp } from 'lucide-react'
import { typography } from '../../styles/typography'

interface EmptyStateProps {
  onViewResults: () => void
}

export function EmptyState({ onViewResults }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <TrendingUp size={36} className="text-panel-border" />
      <div className={`${typography.panelHeader} text-text-body mt-3 mb-1.5`}>
        Refine your model and run the analysis again
      </div>
      <div className={`${typography.panelBody} text-text-light max-w-[260px] mb-4`}>
        This tab shows how your recommendation and model quality evolve with each refinement cycle.
      </div>
      <button
        onClick={onViewResults}
        className={`${typography.panelBody} font-medium inline-flex items-center px-3 py-1.5 rounded-full border border-panel-border bg-transparent text-text-body hover:bg-panel-hover transition-colors`}
      >
        View current results →
      </button>
    </div>
  )
}

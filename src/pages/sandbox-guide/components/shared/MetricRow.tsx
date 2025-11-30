/**
 * MetricRow - Display a labeled metric with optional badge/action
 *
 * Used for showing key metrics in a consistent format
 */

export interface MetricRowProps {
  label: string
  value: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function MetricRow({ label, value, badge, action, className = '' }: MetricRowProps): JSX.Element {
  return (
    <div className={`flex items-center justify-between py-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-storm-600">{label}</span>
        {badge}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-charcoal-900">{value}</span>
        {action}
      </div>
    </div>
  )
}

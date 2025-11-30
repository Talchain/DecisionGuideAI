/**
 * Empty State - Getting Started
 *
 * Shown when the user has no graph built yet.
 * Provides clear CTAs for different ways to begin.
 */
export function EmptyState() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎯</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Getting Started</h2>
      </div>

      {/* Main message */}
      <div className="space-y-3">
        <p className="text-storm-700 text-sm">Choose how to begin:</p>

        <div className="space-y-2">
          <ActionButton
            icon="✨"
            title="Describe your decision"
            subtitle="AI will draft a model for you"
            variant="primary"
          />

          <ActionButton
            icon="📋"
            title="Start from template"
            subtitle="Browse proven decision patterns"
          />

          <ActionButton
            icon="🔨"
            title="Build manually"
            subtitle="Add nodes and connections yourself"
          />
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  title,
  subtitle,
  variant = 'default',
}: {
  icon: string
  title: string
  subtitle: string
  variant?: 'primary' | 'default'
}) {
  return (
    <button
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all
        ${
          variant === 'primary'
            ? 'border-analytical-500 bg-analytical-50 hover:bg-analytical-100'
            : 'border-storm-200 hover:border-storm-300 hover:bg-mist-50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-charcoal-900">{title}</h3>
          <p className="text-sm text-storm-600 mt-1">{subtitle}</p>
        </div>
      </div>
    </button>
  )
}

/**
 * Empty State - Getting Started
 *
 * Shown when the user has no graph built yet.
 * Provides clear CTAs for different ways to begin with real actions.
 */

import { useCanvasStore } from '@/canvas/store'
import { Button } from '../../shared/Button'

export function EmptyState(): JSX.Element {
  const addNode = useCanvasStore((state) => state.addNode)
  const applyLayout = useCanvasStore((state) => state.applyLayout)

  const handleBuildManually = () => {
    // Add initial outcome node to get started
    addNode({ type: 'outcome', x: 400, y: 200 })
    applyLayout('LR')
  }

  const handleTemplate = () => {
    // TODO: Wire to templates panel when available (tracked in issue)
    // Placeholder - will open templates modal in future
  }

  const handleDraft = () => {
    // TODO: Wire to draft chat when available (tracked in issue)
    // Placeholder - will open AI chat interface in future
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎯</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Getting Started</h2>
      </div>

      {/* Welcome message */}
      <div className="text-storm-700 text-sm">
        <p>
          Welcome! Let's build a decision model to analyze your options and predict outcomes.
        </p>
      </div>

      {/* Main CTAs */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-storm-500 font-medium">
          Choose how to begin:
        </p>

        <ActionCard
          icon="✨"
          title="Describe your decision"
          subtitle="AI will draft a model for you"
          variant="primary"
          onClick={handleDraft}
          badge="Coming soon"
        />

        <ActionCard
          icon="📋"
          title="Start from template"
          subtitle="Browse proven decision patterns"
          onClick={handleTemplate}
          badge="Coming soon"
        />

        <ActionCard
          icon="🔨"
          title="Build manually"
          subtitle="Add nodes and connections yourself"
          onClick={handleBuildManually}
        />
      </div>

      {/* Quick guide */}
      <div className="p-4 bg-analytical-50 rounded-lg border border-analytical-200">
        <div className="text-xs font-semibold text-analytical-900 mb-2">
          🎓 Quick Start Guide
        </div>
        <div className="space-y-2 text-xs text-charcoal-900">
          <div className="flex items-start gap-2">
            <span className="text-analytical-600 font-bold">1.</span>
            <span>Define your <strong>outcome</strong> (what you want to achieve)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-analytical-600 font-bold">2.</span>
            <span>Add your <strong>decision</strong> (the choice you need to make)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-analytical-600 font-bold">3.</span>
            <span>Include <strong>factors</strong> (what influences the outcome)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-analytical-600 font-bold">4.</span>
            <span><strong>Connect</strong> them to show relationships</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-analytical-600 font-bold">5.</span>
            <span>Click <strong>Run Analysis</strong> to see predictions</span>
          </div>
        </div>
      </div>

      {/* Example prompts */}
      <div>
        <div className="text-xs uppercase tracking-wide text-storm-500 font-medium mb-2">
          Example decisions:
        </div>
        <div className="space-y-1.5">
          <ExamplePrompt text="Should we launch the new product feature?" />
          <ExamplePrompt text="Which marketing channel should we invest in?" />
          <ExamplePrompt text="Should we hire more engineers or contractors?" />
        </div>
      </div>
    </div>
  )
}

interface ActionCardProps {
  icon: string
  title: string
  subtitle: string
  onClick: () => void
  variant?: 'primary' | 'default'
  badge?: string
}

function ActionCard({
  icon,
  title,
  subtitle,
  onClick,
  variant = 'default',
  badge,
}: ActionCardProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all group
        ${
          variant === 'primary'
            ? 'border-analytical-500 bg-analytical-50 hover:bg-analytical-100 hover:border-analytical-600'
            : 'border-storm-200 hover:border-analytical-400 hover:bg-mist-50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-charcoal-900">{title}</h3>
            {badge && (
              <span className="text-xs px-2 py-0.5 bg-storm-200 text-storm-700 rounded">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-storm-600 mt-1">{subtitle}</p>
        </div>
      </div>
    </button>
  )
}

function ExamplePrompt({ text }: { text: string }): JSX.Element {
  return (
    <button className="w-full text-left px-3 py-2 text-xs text-storm-700 bg-white border border-storm-200 rounded hover:border-analytical-300 hover:bg-analytical-50 transition-colors">
      "{text}"
    </button>
  )
}

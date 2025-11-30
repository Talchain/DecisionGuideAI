/**
 * Building State
 *
 * Shown when the user is actively building their graph but it's not yet ready to run.
 * Shows progress and provides contextual suggestions for what to add next.
 */

import { useCanvasStore } from '@/canvas/store'
import { findBlockers } from '../../../utils/journeyDetection'
import { Button } from '../../shared/Button'
import { Card } from '../../shared/Card'

export function BuildingState(): JSX.Element {
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  const blockers = findBlockers({ nodes, edges })

  // Determine what the user has
  const hasOutcome = nodes.some((n) => n.data?.type === 'outcome' || n.type === 'outcome')
  const hasDecision = nodes.some((n) => n.data?.type === 'decision' || n.type === 'decision')
  const hasFactors = nodes.some((n) => n.data?.type === 'factor' || n.type === 'factor')
  const hasEdges = edges.length > 0

  // Determine progress
  const totalSteps = 4
  const completedSteps = [hasOutcome, hasDecision, hasFactors, hasEdges].filter(Boolean).length
  const progress = (completedSteps / totalSteps) * 100

  // Determine next suggestion
  const getNextSuggestion = (): { icon: string; title: string; description: string } => {
    if (!hasOutcome) {
      return {
        icon: '🎯',
        title: 'Add an Outcome',
        description: "What are you trying to achieve? This is your goal or target result.",
      }
    }
    if (!hasDecision) {
      return {
        icon: '🔀',
        title: 'Add a Decision',
        description: 'What choice do you need to make? This is the decision point.',
      }
    }
    if (!hasFactors) {
      return {
        icon: '⚙️',
        title: 'Add Factors',
        description: 'What influences your outcome? Add the key drivers or variables.',
      }
    }
    if (!hasEdges) {
      return {
        icon: '🔗',
        title: 'Connect Your Nodes',
        description: 'Draw connections to show how factors influence your outcome.',
      }
    }
    return {
      icon: '✨',
      title: 'Almost Ready!',
      description: 'Check the structure and add any missing pieces.',
    }
  }

  const nextSuggestion = getNextSuggestion()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔨</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Building Your Model</h2>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-storm-600">Progress</span>
          <span className="font-medium text-charcoal-900">
            {completedSteps} of {totalSteps} steps
          </span>
        </div>
        <div className="h-2 bg-storm-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-analytical-400 to-practical-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="bg-storm-50">
          <div className="text-xs text-storm-600 mb-1">Nodes</div>
          <div className="text-2xl font-bold text-charcoal-900">{nodes.length}</div>
        </Card>
        <Card padding="sm" className="bg-storm-50">
          <div className="text-xs text-storm-600 mb-1">Connections</div>
          <div className="text-2xl font-bold text-charcoal-900">{edges.length}</div>
        </Card>
      </div>

      {/* Next Suggestion */}
      <Card className="bg-analytical-50 border-analytical-200">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{nextSuggestion.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-charcoal-900 mb-1">{nextSuggestion.title}</div>
            <div className="text-sm text-storm-700">{nextSuggestion.description}</div>
          </div>
        </div>
      </Card>

      {/* Checklist */}
      <div>
        <div className="text-sm font-medium text-charcoal-900 mb-3">Requirements</div>
        <div className="space-y-2">
          <ChecklistItem label="Outcome node" completed={hasOutcome} />
          <ChecklistItem label="Decision node" completed={hasDecision} />
          <ChecklistItem label="Factor nodes" completed={hasFactors} />
          <ChecklistItem label="Connections" completed={hasEdges} />
        </div>
      </div>

      {/* Quick Actions */}
      {blockers.length > 0 && (
        <div className="space-y-2">
          <Button variant="outline" fullWidth>
            Add node
          </Button>
          <Button variant="outline" fullWidth>
            Use template
          </Button>
        </div>
      )}

      {/* Tip */}
      <div className="p-3 bg-mist-100 rounded-lg border border-storm-200">
        <div className="text-xs font-medium text-storm-800 mb-1">💡 Tip</div>
        <div className="text-xs text-storm-700">
          Start simple - you can always add more detail later. A basic model with clear connections
          is better than a complex one that's hard to understand.
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({ label, completed }: { label: string; completed: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          completed
            ? 'bg-practical-500 border-practical-500'
            : 'border-storm-300 bg-white'
        }`}
      >
        {completed && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span
        className={`text-sm ${completed ? 'text-charcoal-900 font-medium' : 'text-storm-600'}`}
      >
        {label}
      </span>
    </div>
  )
}

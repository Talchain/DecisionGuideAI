/**
 * Phase 3: Canvas Empty State
 * Welcoming experience for new users with quick action buttons and tips
 */

import { Sparkles, FileText } from 'lucide-react'
import { typography } from '../../styles/typography'

interface CanvasEmptyStateProps {
  onDraft: () => void
  onTemplate: () => void
}

export function CanvasEmptyState({ onDraft, onTemplate }: CanvasEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="max-w-md text-center space-y-6 pointer-events-auto">
        <div>
          <h3 className={`${typography.h3} text-ink-900 mb-2`}>
            Start Building Your Decision Model
          </h3>
          <p className={`${typography.body} text-ink-900/60`}>
            Use AI to draft a model from your description, or start from a template
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onDraft}
            className={`
              ${typography.button} flex items-center gap-2 px-4 py-2.5 rounded
              bg-sky-500 text-white hover:bg-sky-600
              transition-colors
            `}
          >
            <Sparkles className="w-4 h-4" />
            Draft with AI
          </button>

          <button
            onClick={onTemplate}
            className={`
              ${typography.button} flex items-center gap-2 px-4 py-2.5 rounded
              border border-sand-200 hover:bg-paper-50
              transition-colors
            `}
          >
            <FileText className="w-4 h-4" />
            Use Template
          </button>
        </div>

        <div className="pt-4 space-y-2 text-left">
          <p className={`${typography.label} text-ink-900/70`}>
            Quick tips:
          </p>
          <ul className={`${typography.bodySmall} text-ink-900/60 space-y-1`}>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-sand-200 rounded text-xs font-mono">T</kbd> for templates</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-sand-200 rounded text-xs font-mono">R</kbd> to run analysis</li>
            <li>• Press <kbd className="px-1.5 py-0.5 bg-sand-200 rounded text-xs font-mono">?</kbd> for help</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { DraftGuidance } from '../../hooks/useCEEDraft'

interface DraftGuidancePanelProps {
  guidance: DraftGuidance
  onQuestionClick: (question: string) => void
}

export function DraftGuidancePanel({ guidance, onQuestionClick }: DraftGuidancePanelProps) {
  const { level, questions, hint } = guidance

  const levelConfig = {
    ready: {
      bg: 'bg-mint-50',
      border: 'border-mint-200',
      text: 'text-mint-800',
      icon: Lightbulb,
    },
    needs_clarification: {
      bg: 'bg-sun-50',
      border: 'border-sun-200',
      text: 'text-sun-800',
      icon: AlertTriangle,
    },
    not_ready: {
      bg: 'bg-sun-50',
      border: 'border-sun-200',
      text: 'text-sun-800',
      icon: AlertTriangle,
    },
  } as const

  const config = levelConfig[level]
  const Icon = config.icon

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-4 space-y-3`}
      role="region"
      aria-label="Draft guidance"
      data-testid="draft-guidance-panel"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${config.text}`} aria-hidden="true" />
        <span className={`${typography.label} ${config.text}`}>
          Help us understand your decision
        </span>
      </div>

      {questions.length > 0 && (
        <div className="space-y-2">
          <p className={`${typography.bodySmall} ${config.text}`}>
            To create a better model, consider adding:
          </p>
          <ul className="space-y-1">
            {questions.map((question, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onQuestionClick(question)}
                  className={`${
                    typography.body
                  } text-left w-full px-3 py-2 rounded-md bg-white/60 hover:bg-white ${config.text} transition-colors`}
                >
                  + {question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hint && (
        <p className={`${typography.bodySmall} ${config.text} flex items-start gap-2`}>
          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * MissingKnowledgePrompt — "Something missing?" dismissible affordance.
 *
 * Shared by pre-analysis ("from the model?") and post-analysis ("from the
 * results?") surfaces. Context prop drives heading copy, helper copy, and
 * AI button aria-label. Visual shell is identical across both contexts.
 *
 * DS v5: border-panel-border card, panelBody heading, panelMeta helper,
 * Tooltip-wrapped dismiss (X 14px), focus-visible:ring-info, aria-hidden icon.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '@/styles/typography'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import Tooltip from '@/components/Tooltip'

const COPY = {
  model: {
    heading: 'Something missing from the model?',
    helper: "Describe what's missing and Olumi will suggest where it fits in your model.",
    aiLabel: 'Tell AI about something missing from the model',
  },
  results: {
    heading: 'Something missing from the results?',
    helper: "Describe what's missing and Olumi will update the analysis.",
    aiLabel: 'Tell AI about something missing from the results',
  },
} as const

interface MissingKnowledgePromptProps {
  context: 'model' | 'results'
  onSendMessage?: (text: string) => void
}

export function MissingKnowledgePrompt({ context }: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)
  const { heading, helper, aiLabel } = COPY[context]

  if (dismissed) return null

  return (
    <div
      className="rounded-lg border border-panel-border bg-panel px-4 py-2 flex items-start gap-2"
      data-testid="missing-knowledge-prompt"
    >
      <div className="flex-1 min-w-0">
        <p className={`${typography.panelBody} text-text-light`}>{heading}</p>
        <p className={`${typography.panelMeta} text-text-light`}>{helper}</p>
      </div>
      <DiscussWithAiButton element={{ kind: 'missing' }} ariaLabel={aiLabel} />
      <Tooltip delay={300} content="Dismiss">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-light hover:text-text-body shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded"
          aria-label="Dismiss"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  )
}

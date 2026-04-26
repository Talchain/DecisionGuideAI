/**
 * MissingKnowledgePrompt — "Something missing?" dismissible affordance.
 *
 * Shared by pre-analysis ("from the model?") and post-analysis ("from the
 * results?") surfaces. Context prop drives heading and helper copy. Visual
 * shell is identical across both contexts.
 *
 * AI affordance is injected via the optional `aiAffordance` prop so this
 * shared component has no direct dependency on canvas-area code.
 *
 * DS v5: quiet one-liner (no card frame), panelBody heading, panelMeta helper,
 * Tooltip-wrapped dismiss (X 14px), focus-visible:ring-info, aria-hidden icon.
 */

import { type ReactNode, useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '@/styles/typography'
import Tooltip from '@/components/Tooltip'

const COPY = {
  model: {
    heading: 'Something missing from the model?',
    helper: "Describe what's missing and Olumi will suggest where it fits in your model.",
  },
  results: {
    heading: 'Something missing from the results?',
    helper: "Describe what's missing and Olumi will update the analysis.",
  },
} as const

interface MissingKnowledgePromptProps {
  context: 'model' | 'results'
  /** Optional AI interaction affordance. Pass a DiscussWithAiButton from the caller
   *  to keep this shared component free of canvas-area imports. */
  aiAffordance?: ReactNode
}

export function MissingKnowledgePrompt({ context, aiAffordance }: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)
  const { heading, helper } = COPY[context]

  if (dismissed) return null

  return (
    <div
      className="flex items-start gap-2 py-1"
      data-testid="missing-knowledge-prompt"
    >
      <div className="flex-1 min-w-0">
        <p className={`${typography.panelBody} text-text-light`}>{heading}</p>
        <p className={`${typography.panelMeta} text-text-light`}>{helper}</p>
      </div>
      {aiAffordance}
      <Tooltip delay={300} content="Dismiss">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-light hover:text-text-body shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded p-1"
          aria-label="Dismiss"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  )
}

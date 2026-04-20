/**
 * MissingKnowledgePrompt — "Something missing from the model?" + sparkle icon.
 *
 * Compact card. Dismissible per session. On click of sparkle: sends pre-filled
 * message to conversation panel via the shared DiscussWithAiButton.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '@/styles/typography'
import { DiscussWithAiButton } from './DiscussWithAiButton'
import Tooltip from '@/components/Tooltip'

interface MissingKnowledgePromptProps {
  onSendMessage?: (text: string) => void
}

export function MissingKnowledgePrompt(_props: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-4 py-2 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <p className={`${typography.panelBody} text-text-light`}>
          Something missing from the model?
        </p>
        <p className={`${typography.panelMeta} text-text-light`}>
          Describe what's missing and Olumi will suggest where it fits in your model.
        </p>
      </div>
      <DiscussWithAiButton element={{ kind: 'missing' }} />
      <Tooltip delay={300} content="Dismiss">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-light hover:text-text-body shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded"
          aria-label="Dismiss"
        >
          <X size={12} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  )
}

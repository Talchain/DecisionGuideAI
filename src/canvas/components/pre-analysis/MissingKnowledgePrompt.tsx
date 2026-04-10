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

interface MissingKnowledgePromptProps {
  onSendMessage?: (text: string) => void
}

export function MissingKnowledgePrompt(_props: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2 flex items-center gap-2">
      <p className={`${typography.panelBody} text-text-light flex-1`}>
        Something missing from the model?
      </p>
      <DiscussWithAiButton element={{ kind: 'missing' }} />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-text-light hover:text-text-body shrink-0"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  )
}

/**
 * MissingKnowledgePrompt — "Something missing from the model?" + "◎ Tell the AI"
 *
 * Compact card. Dismissible per session. On click: sends pre-filled message
 * to conversation panel via onSendMessage.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '@/styles/typography'

interface MissingKnowledgePromptProps {
  onSendMessage?: (text: string) => void
}

export function MissingKnowledgePrompt({ onSendMessage }: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2 flex items-center gap-2">
      <p className={`${typography.panelBody} text-text-light flex-1`}>
        Something missing from the model?
      </p>
      <button
        type="button"
        onClick={() => onSendMessage?.("I'd like to add something to the model that's not currently captured: ")}
        className={`${typography.panelMeta} text-info hover:underline cursor-pointer shrink-0`}
      >
        ◎ Tell the AI
      </button>
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

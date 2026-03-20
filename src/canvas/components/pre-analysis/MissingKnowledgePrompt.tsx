/**
 * MissingKnowledgePrompt — "Know something the model doesn't capture?"
 *
 * Compact prompt at the bottom of the pre-analysis panel content.
 * Clicking "Tell the AI" pre-fills the conversation input.
 * Dismissible per session (local state, not persisted).
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
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2.5 relative">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-text-light hover:text-text-body"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <p className={`${typography.panelBody} text-text-light pr-4`}>
        Know something the model doesn't capture?
      </p>
      <button
        type="button"
        onClick={() => onSendMessage?.("I'd like to add something to the model that's not currently captured: ")}
        className={`${typography.panelMeta} text-info border border-info/30 bg-transparent px-2.5 py-0.5 rounded-full hover:bg-info/5 transition-colors mt-1.5 cursor-pointer`}
      >
        Tell the AI
      </button>
    </div>
  )
}

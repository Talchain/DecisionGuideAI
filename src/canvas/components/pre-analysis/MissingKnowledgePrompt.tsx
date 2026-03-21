/**
 * MissingKnowledgePrompt — "Know something the model doesn't capture?"
 *
 * Compact prompt at the bottom of the pre-analysis panel content.
 * Clicking "Tell the AI" expands an inline text input. The user types what
 * they know and sends it to the conversation panel.
 * Dismissible per session (local state, not persisted).
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { typography } from '@/styles/typography'

interface MissingKnowledgePromptProps {
  onSendMessage?: (text: string) => void
}

export function MissingKnowledgePrompt({ onSendMessage }: MissingKnowledgePromptProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onSendMessage?.(`I'd like to add something to the model that's not currently captured: ${trimmed}`)
    setInputValue('')
    setShowInput(false)
  }, [inputValue, onSendMessage])

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
        Know something the model doesn't capture? Your expertise could improve the analysis.
      </p>

      {!showInput ? (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className={`${typography.panelMeta} text-info border border-info/30 bg-transparent px-2.5 py-0.5 rounded-full hover:bg-info/5 transition-colors mt-1.5 cursor-pointer`}
        >
          Tell the AI
        </button>
      ) : (
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. We expect regulatory changes next quarter"
            className={`flex-1 px-2 py-1 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-1 focus:ring-info`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
              if (e.key === 'Escape') { setShowInput(false); setInputValue('') }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={`px-3 py-1 ${typography.panelMeta} bg-primary text-text-on-color rounded-full hover:opacity-90 disabled:opacity-40`}
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * CoachingPrompt — dismissible "Something missing?" prompt above Advanced section.
 *
 * CTA focuses the conversation input so the user can tell the AI
 * about factors, risks, or information the model might be missing.
 * Coaching one-liner — dismiss is allowed per dismissibility rules.
 */

import { useState } from 'react'
import { X, Target } from 'lucide-react'
import { typography } from '../../styles/typography'
import Tooltip from '../Tooltip'

export function CoachingPrompt() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const focusChatInput = () => {
    const input = document.querySelector<HTMLTextAreaElement | HTMLInputElement>('[data-testid="chat-input"]')
    if (input) {
      // Preload context so the user can continue the thought
      if (!input.value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value',
        )?.set ?? Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value',
        )?.set
        nativeInputValueSetter?.call(input, 'I think the model is missing ')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      input.focus()
    }
  }

  return (
    <div
      className="relative bg-panel-hover rounded-xl px-3 py-2.5 flex items-center gap-2.5"
      data-testid="coaching-prompt"
    >
      <span className={`${typography.panelBody} text-text-body flex-1`}>
        Something missing from the results?
      </span>
      <Tooltip content="Tell the AI about factors, risks, or information the model might be missing">
        <button
          type="button"
          onClick={focusChatInput}
          className={`${typography.panelMeta} text-info font-medium hover:underline flex items-center gap-1 flex-shrink-0`}
        >
          <Target className="w-3.5 h-3.5" />
          Tell the AI
        </button>
      </Tooltip>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-text-light hover:text-text-body flex-shrink-0"
        aria-label="Dismiss coaching prompt"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

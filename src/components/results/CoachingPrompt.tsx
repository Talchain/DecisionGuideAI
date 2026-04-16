/**
 * CoachingPrompt — dismissible "Something missing?" prompt above Advanced section.
 *
 * AI affordance is the standard DiscussWithAiButton sparkle (UI-BUG-7), matching
 * every other AI affordance across the Analysis tab. Coaching one-liner — dismiss
 * is allowed per dismissibility rules.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { typography } from '../../styles/typography'
import { DiscussWithAiButton } from '../../canvas/components/pre-analysis/DiscussWithAiButton'

export function CoachingPrompt() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div
      className="relative bg-panel-hover rounded-xl px-3 py-2.5 flex items-center gap-2.5"
      data-testid="coaching-prompt"
    >
      <span className={`${typography.panelBody} text-text-body flex-1`}>
        Something missing from the results?
      </span>
      <DiscussWithAiButton
        element={{ kind: 'missing' }}
        ariaLabel="Tell AI about something missing from the results"
      />
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

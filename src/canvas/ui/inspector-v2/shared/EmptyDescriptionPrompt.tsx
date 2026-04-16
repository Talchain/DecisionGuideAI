/**
 * EmptyDescriptionPrompt — unified empty state for description-less nodes.
 *
 * Outcome and Risk panels currently render nothing when a node has no
 * description; Option/Decision/Goal render editable textareas with
 * placeholders. This primitive standardises the empty case into a single
 * read-only prompt that can optionally open an editor on click.
 */

import type { MouseEvent } from 'react'
import { typography } from '../../../../styles/typography'

interface EmptyDescriptionPromptProps {
  placeholder: string
  onStartEditing?: () => void
}

export function EmptyDescriptionPrompt({
  placeholder,
  onStartEditing,
}: EmptyDescriptionPromptProps) {
  const interactive = typeof onStartEditing === 'function'

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    e.preventDefault()
    onStartEditing?.()
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={interactive
        ? e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onStartEditing?.()
            }
          }
        : undefined}
      className={`${typography.panelBody} text-text-light italic mt-1 ${
        interactive ? 'cursor-pointer hover:text-text-body transition-colors' : ''
      }`}
    >
      {placeholder}
    </div>
  )
}

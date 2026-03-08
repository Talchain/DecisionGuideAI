/**
 * SessionDivider -- Centred text divider for session boundaries and system event markers.
 *
 * Rendered instead of a chat bubble when ConversationMessage.sessionDivider is set.
 * Minimal spacing (8px above and below), panelMeta size, text-text-light.
 */

import { memo } from 'react'
import { typography } from '../../../styles/typography'

interface SessionDividerProps {
  text: string
}

export const SessionDivider = memo(function SessionDivider({ text }: SessionDividerProps) {
  return (
    <div
      className="flex items-center gap-3 py-2"
      role="separator"
      data-testid="session-divider"
    >
      <div className="flex-1 border-t border-panel-border" />
      <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`}>
        {text}
      </span>
      <div className="flex-1 border-t border-panel-border" />
    </div>
  )
})

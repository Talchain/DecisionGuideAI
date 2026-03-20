/**
 * ArtefactActions -- Action chips rendered below an artefact iframe.
 *
 * Each chip sends its `message` as a new user chat message on click.
 * Styled to match SuggestedChips (chipSecondary pattern). Max 3 actions.
 */

import { memo } from 'react'
import type { ArtefactAction } from '../../canvas/conversation/types'
import styles from './Artefact.module.css'

const MAX_ACTIONS = 3

interface ArtefactActionsProps {
  actions: ArtefactAction[]
  onSendMessage: (message: string) => void
}

export const ArtefactActions = memo(function ArtefactActions({
  actions,
  onSendMessage,
}: ArtefactActionsProps) {
  const visible = actions.slice(0, MAX_ACTIONS)

  return (
    <div className={styles.actionsRow} data-testid="artefact-actions">
      {visible.map((action) => (
        <button
          key={`${action.label}:${action.message}`}
          type="button"
          className={styles.actionChip}
          onClick={() => onSendMessage(action.message)}
          data-testid="artefact-action-chip"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
})

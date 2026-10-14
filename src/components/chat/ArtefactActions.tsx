/**
 * ArtefactActions -- Action chips rendered below an artefact iframe.
 *
 * Each chip sends its `message` as a new user chat message on click.
 * Styled to match SuggestedChips (chipSecondary pattern). Max 3 actions.
 */

import { memo } from 'react'
import type { ArtefactAction } from '../../canvas/conversation/types'
import { OLUMI_TEXT_CHIP_IDS, type OlumiTextSend } from '../../canvas/conversation/chipMeta'
import styles from './Artefact.module.css'

const MAX_ACTIONS = 3

interface ArtefactActionsProps {
  actions: ArtefactAction[]
  /** Olumi's action text; it carries its chip identity whoever receives it (T1H-2). */
  onSendMessage: OlumiTextSend
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
          onClick={() => onSendMessage(action.message, { chipMeta: { id: OLUMI_TEXT_CHIP_IDS.aiPanelArtefactAction } })}
          data-testid="artefact-action-chip"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
})

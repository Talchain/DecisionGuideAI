/**
 * In or out of the comparison, from the option's inspector (Paul, 1 Oct: "I can't remove it with the available tools").
 * A taken-out option stays in the model and on the board; the Run compares the rest and says this one was left out.
 * The model changes only when CEE applies it (no local write); a refusal arrives in the conversation in Olumi's words.
 */
import { useState } from 'react'

import { controls } from '../../../../styles/controls'
import { typography } from '../../../../styles/typography'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { settleSystemEventSend } from '../../../conversation/settleSystemEventSend'
import { clearPendingEditNotes } from '../../../editNotes/reportManualEditReceipt'
import { optionStatusToggleEvent, optionTakenOut } from '../../../domain/optionStatus'
import { useCanvasStore } from '../../../store'

export const OPTION_STATUS_COPY = {
  takeOut: 'Take out of comparison',
  putBack: 'Put back into comparison',
  saving: 'Saving…',
  notSent: 'Not saved: try again in a moment.',
} as const

export function OptionStatusControl({ optionId, data }: { optionId: string; data: unknown }) {
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent
  const baseGraphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const [note, setNote] = useState<string | null>(null)
  const event = optionStatusToggleEvent(optionId, data, baseGraphHash)
  if (!sendSystemEvent || event === null) return null
  const takenOut = optionTakenOut(data) !== null
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-testid={`option-status-toggle-${optionId}`}
        className={`${controls.actionChip} ${typography.panelMeta}`}
        disabled={note === OPTION_STATUS_COPY.saving}
        onClick={() => {
          // The change takes the latest Undo step, so an older note's Undo would reverse it instead. Cleared at the press,
          // not on the reply: a quiet acknowledgement can skip the receipt reporter (Codex R2 on #2890).
          clearPendingEditNotes()
          setNote(OPTION_STATUS_COPY.saving)
          settleSystemEventSend(sendSystemEvent(event, { deferIfBusy: false }), (settlement) => {
            setNote(settlement === 'blocked' || settlement === 'queued' ? OPTION_STATUS_COPY.notSent : null)
          })
        }}
      >
        {takenOut ? OPTION_STATUS_COPY.putBack : OPTION_STATUS_COPY.takeOut}
      </button>
      {note !== null && <span className={`${typography.panelMeta} text-text-light`} aria-live="polite">{note}</span>}
    </div>
  )
}

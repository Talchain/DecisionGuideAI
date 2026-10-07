/**
 * P48 slice 3 (audit #23) — "Undo this change" on the reply in which Olumi changed the model.
 *
 * Shown ONLY while the next ⌘Z is exactly this reply's change (`isNextUndoThisTurn`, bound by the turn id the journal
 * step was recorded under), so the button can never undo something other than what it sits beside. The press is the
 * SAME command as ⌘Z (`runCanvasUndo`): a saved restore through the server's door, with its notices
 * ("Undone: Olumi's change.", or why it can't). Guests never see it: their models hold no versions.
 */
import { memo, useState } from 'react'
import { useCanvasStore } from '../store'
import { useUndoJournalStore } from './captureUndoReceipt'
import { isNextUndoThisTurn } from './captureAgentTurnForUndo'

export const AI_CHANGE_UNDO_WORDS = { button: 'Undo this change', aria: "Undo Olumi's change to the model" } as const

export const AiChangeUndoButton = memo(function AiChangeUndoButton({ turnId }: { turnId: string | undefined }) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const visible = useUndoJournalStore((s) => isNextUndoThisTurn(s.journal, scenarioId, turnId))
  const [pending, setPending] = useState(false)
  if (!visible) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
      <button
        type="button"
        data-testid="ai-change-undo"
        aria-label={AI_CHANGE_UNDO_WORDS.aria}
        disabled={pending}
        onClick={() => {
          setPending(true)
          // Loaded on press: the command imports the session client, which throws at import where no Supabase env
          // exists (every spec that renders a message bubble).
          void import('./undoCommand').then((m) => m.runCanvasUndo('undo')).finally(() => setPending(false))
        }}
        className="text-sm text-text-body underline underline-offset-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2"
        style={{ minHeight: '44px', background: 'none', border: 'none', padding: '0 4px', cursor: pending ? 'default' : 'pointer' }}
      >
        {AI_CHANGE_UNDO_WORDS.button}
      </button>
    </div>
  )
})

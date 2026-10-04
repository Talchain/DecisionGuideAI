import { useRef, useState } from 'react'
import { useCanvasStore } from '../../../../canvas/store'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { useOptionalConversationContext } from '../../../../canvas/conversation/ConversationContext'
import type { SourceKeyedMessage } from '../../../../canvas/conversation/utils/transcriptStore'
import { revealOlumiSurface } from '../../../../canvas/conversation/revealOlumi'
import { isTestWithoutLinkEnabled } from '../../../../flags'
import { typography } from '../../../../styles/typography'
import { action } from '../panelSurfaces'

/** Dark UI for the supplied future typed press. Replies stay in the existing conversation. */
export function TestWithoutLinkButton({ edgeId }: { edgeId: string }) {
  const edge = useCanvasStore(s => s.edges.find(e => e.id === edgeId))
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const current = useCanvasStore(selectRunAffirmedCurrent)
  const conversation = useOptionalConversationContext()
  const [pending, setPending] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const inFlight = useRef(false)

  if (!isTestWithoutLinkEnabled() || !edge || !current || !conversation?.sendChip) return null

  const id = `agent-test-without-link:${edge.source}::${edge.target}`
  // Existing UI-only correlation key, never a wire field or a science result.
  const sourceBlockKey = `test-without-link:${scenarioId ?? ''}:${edge.source}::${edge.target}`
  const ownSend = [...conversation.messages as SourceKeyedMessage[]].reverse().find(m => m.role === 'user' && m.sourceBlockKey === sourceBlockKey)
  const failed = sendFailed || (!pending && ownSend?.deliveryState === 'failed')

  const testLink = async () => {
    if (inFlight.current || conversation.isThinking) return
    inFlight.current = true
    setPending(true)
    setSendFailed(false)
    try {
      const send = conversation.sendChip({
        id, label: 'Test without this link', message: 'Test without this link',
        intent: 'primary', sourceBlockKey,
      })
      // Revealing is best effort. A display failure cannot make a delivered press a failed send.
      try { revealOlumiSurface() } catch { /* The existing reply surface still owns the outcome. */ }
      await send
    } catch {
      setSendFailed(true)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <div className="mt-1" data-testid="challenge-test-without-link">
      <button
        type="button"
        onClick={() => void testLink()}
        disabled={pending || conversation.isThinking}
        aria-busy={pending || undefined}
        className={`${typography.panelBody} ${action('secondary')}`}
      >
        {pending ? 'Testing without this link…' : 'Test without this link'}
      </button>
      {pending ? <p role="status" className={`${typography.panelMeta} text-text-light`}>Waiting for Olumi.</p> : null}
      {failed ? <p role="alert" className={`${typography.panelMeta} text-danger`}>This test could not be sent. Try again.</p> : null}
    </div>
  )
}

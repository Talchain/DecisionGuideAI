import { useRef, useState } from 'react'
import { useCanvasStore } from '../../../../canvas/store'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { useOptionalConversationContext } from '../../../../canvas/conversation/ConversationContext'
import type { SourceKeyedMessage } from '../../../../canvas/conversation/utils/transcriptStore'
import { revealOlumiSurface } from '../../../../canvas/conversation/revealOlumi'
import { isTestWithoutLinkEnabled } from '../../../../flags'
import { resolveEffectiveAdmission } from '../../../../canvas/hooks/useAnalysisReady'
import { selectBootReadPermittedMode, useBootReadAdmissionStore } from '../../../../canvas/hydrate/bootReadAdmission'
import { TEST_WITHOUT_LINK_HOLD_COPY, testWithoutLinkEligibility } from '../testWithoutLinkEligibility'
import { typography } from '../../../../styles/typography'
import { action } from '../panelSurfaces'

export interface TestWithoutLinkButtonProps {
  edgeId: string
  /** Host surface's own hook; the Reasoning mount keeps the default. */
  testId?: string
  /** Host surface's button and wrapper styling; the Reasoning mount keeps the defaults. */
  buttonClassName?: string
  className?: string
}

/**
 * The typed "Test without this link" press. Replies stay in the existing conversation.
 *
 * Two mounts, one sender: the Reasoning tab's Challenge signal (only when the Run named a
 * sensitive, Olumi-estimated link) and the link inspector (any link on a current Run).
 * The service answers the press only for a link on a current Run, so both mounts share
 * the gate below rather than each restating it.
 */
export function TestWithoutLinkButton({
  edgeId,
  testId = 'challenge-test-without-link',
  buttonClassName = `${typography.panelBody} ${action('secondary')}`,
  className = 'mt-1',
}: TestWithoutLinkButtonProps) {
  const edge = useCanvasStore(s => s.edges.find(e => e.id === edgeId))
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const current = useCanvasStore(selectRunAffirmedCurrent)
  const conversation = useOptionalConversationContext()
  // The offer gate's producer fields (see `testWithoutLinkEligibility`), each read as a primitive.
  // A turn's admission (live, else retained) wins; on a cold load before any turn, the graph read's mode, only
  // while the canvas is still that read (`bootReadAdmission.ts`). Absent all three, absence stays "not loaded".
  const bootRecord = useBootReadAdmissionStore(s => s.record)
  const permittedAnalysisMode = useCanvasStore(s =>
    resolveEffectiveAdmission(s.ceeAnalysisReady?.analysis_admission, s.retainedAnalysisAdmission)?.permitted_analysis_mode
    ?? selectBootReadPermittedMode(s, bootRecord))
  const analysisState = useCanvasStore(s => s.analysisStateV1)
  const hasResult = useCanvasStore(s => s.results?.report != null)
  const sourceType = useCanvasStore(s => s.nodes.find(n => n.id === edge?.source)?.type)
  const targetType = useCanvasStore(s => s.nodes.find(n => n.id === edge?.target)?.type)
  const [pending, setPending] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const inFlight = useRef(false)

  if (!isTestWithoutLinkEnabled() || !edge || !current || !conversation?.sendChip) return null

  // Offer the press only when the service can answer it; otherwise say why, in one plain sentence.
  const eligibility = testWithoutLinkEligibility({
    permittedAnalysisMode, analysisState, hasResult, sourceType, targetType,
    edgeType: typeof edge.data?.edge_type === 'string' ? edge.data.edge_type : undefined,
  })
  if (!eligibility.eligible) {
    return (
      <div className={className} data-testid={testId}>
        <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-hold`} data-hold={eligibility.hold}>
          {TEST_WITHOUT_LINK_HOLD_COPY[eligibility.hold]}
        </p>
      </div>
    )
  }

  // CEE's canonical press (`structuralChallengePressId`): a JSON pair, because node ids may contain ':'.
  const id = `agent-test-without-link:${JSON.stringify([edge.source, edge.target])}`
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
    <div className={className} data-testid={testId}>
      <button
        type="button"
        onClick={() => void testLink()}
        disabled={pending || conversation.isThinking}
        aria-busy={pending || undefined}
        className={buttonClassName}
      >
        {pending ? 'Testing without this link…' : 'Test without this link'}
      </button>
      {pending ? <p role="status" className={`${typography.panelMeta} text-text-light`}>Waiting for Olumi.</p> : null}
      {/* Neutral body text, like this surface's other alerts: `text-danger` fails 4.5:1 on panel grounds
          (tests/ci-guards/reasoning-model-text-contrast-per-site). The role and the words carry the meaning. */}
      {failed ? <p role="alert" className={`${typography.panelMeta} text-text-body`}>This test could not be sent. Try again.</p> : null}
    </div>
  )
}

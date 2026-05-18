import { useCallback, useMemo, useState } from 'react'
import { useCanvasStore } from '../../store'
import type { UseConversationReturn } from '../../conversation/useConversation'
import type { AIPanelDisplay, AIPanelState, AIPanelView } from '../constants'

// Derives the panel view from canvas state + conversation state + user
// display preference. This is the source of truth for "what does the
// panel render right now" — AIPanelV2Layout consumes the returned view
// and switches on `view.kind`.
//
// State derivation (matches the brief):
//   • welcome        — no messages AND no nodes on canvas
//   • pre-analysis   — nodes exist but no analysis result (results.status !== 'complete')
//   • post-analysis  — analysis result exists (results.status === 'complete' + hash present)
//
// Display:
//   • docked      — default
//   • minimised   — user-set via AIHeaderStrip minus button
//   • floating    — user-set via AIHeaderStrip float button
//
// Welcome state ignores display: there's no chat to minimise or float
// when the user hasn't sent their first message yet.

interface UsePanelViewOptions {
  conversation: UseConversationReturn
}

interface UsePanelViewResult {
  view: AIPanelView
  state: AIPanelState
  display: AIPanelDisplay
  setDisplay: (next: AIPanelDisplay) => void
}

function deriveState(nodeCount: number, edgeCount: number, hasMessages: boolean, hasAnalysis: boolean): AIPanelState {
  if (!hasMessages && nodeCount === 0 && edgeCount === 0) return 'welcome'
  if (hasAnalysis) return 'post-analysis'
  return 'pre-analysis'
}

export function usePanelView({ conversation }: UsePanelViewOptions): UsePanelViewResult {
  const nodeCount = useCanvasStore(s => s.nodes.length)
  const edgeCount = useCanvasStore(s => s.edges.length)
  const resultsStatus = useCanvasStore(s => s.results.status)
  const resultsHash = useCanvasStore(s => s.results.hash)

  const hasMessages = conversation.messages.length > 0
  const hasAnalysis = resultsStatus === 'complete' && Boolean(resultsHash)

  const state = useMemo<AIPanelState>(
    () => deriveState(nodeCount, edgeCount, hasMessages, hasAnalysis),
    [nodeCount, edgeCount, hasMessages, hasAnalysis],
  )

  const [display, setDisplayInternal] = useState<AIPanelDisplay>('docked')
  const setDisplay = useCallback((next: AIPanelDisplay) => setDisplayInternal(next), [])

  const view = useMemo<AIPanelView>(() => {
    if (state === 'welcome') return { kind: 'welcome' }
    // pre-analysis / post-analysis with a display preference
    if (display === 'minimised') return { kind: 'minimised', previousState: state }
    if (display === 'floating') return { kind: 'floating', previousState: state }
    return { kind: 'docked', state }
  }, [state, display])

  return { view, state, display, setDisplay }
}

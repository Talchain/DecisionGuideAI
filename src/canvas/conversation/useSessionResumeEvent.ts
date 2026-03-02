/**
 * useSessionResumeEvent — Sends `session_resume` system event when the user
 * returns to an existing scenario that already has a graph.
 *
 * Deduplication: only sends once per scenario ID (tracked via ref). Page
 * refreshes within the same scenario do NOT produce duplicate resume messages.
 * Resets on scenario switch so a different scenario gets its own resume.
 *
 * Only active when `VITE_ENABLE_ORCHESTRATOR_V2` is ON.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import type { ConversationMessage, SystemEvent } from './types'

/**
 * Hook that detects scenario loads and sends a session_resume event.
 *
 * @param sendSystemEvent - The sendSystemEvent function from useConversation
 * @param messages - Current conversation messages (for deduplication)
 */
export function useSessionResumeEvent(
  sendSystemEvent: (event: SystemEvent) => Promise<void>,
  messages: ConversationMessage[],
): void {
  const lastResumeScenarioIdRef = useRef<string | null>(null)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodeCount = useCanvasStore((s) => s.nodes.length)

  useEffect(() => {
    if (!isOrchestratorV2Enabled()) return
    if (!scenarioId) return

    // Only send resume for scenarios that have a graph (not brand-new empty)
    if (nodeCount === 0) return

    // Deduplication: don't send again for the same scenario
    if (lastResumeScenarioIdRef.current === scenarioId) return

    // Check if the conversation already has a single assistant message
    // (from a previous resume). If so, skip to prevent double-resume on reload.
    if (messages.length === 1 && messages[0].role === 'assistant' && !messages[0].synthetic) {
      lastResumeScenarioIdRef.current = scenarioId
      return
    }

    // Mark this scenario as having received a resume
    lastResumeScenarioIdRef.current = scenarioId

    sendSystemEvent({
      type: 'session_resume',
      payload: {},
    })
  }, [scenarioId, nodeCount, sendSystemEvent, messages])
}

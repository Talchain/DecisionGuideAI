/**
 * V5 eligibility predicate — UI edge gate.
 *
 * A1 only handles `direct_answer` / `frame`-stage turns. The CEE side hard-rejects
 * anything else as UNHANDLED, which would surface a typed error to the user even
 * for turns V5 was never meant to handle in this slice. This predicate routes
 * such turns to V4 silently (no V5 artefact, no loading UX).
 *
 * On any fail → caller should fall through to V4 and NOT fire any V5 side
 * effects. The predicate is pure + side-effect-free so it can be called before
 * the V5 branch's allow-list.
 *
 * A2+ will widen the predicate as additional turn classes and stages land.
 *
 * Conditions (all must hold for V5 eligibility):
 *
 *   1. Flag on                 — VITE_ENABLE_V5_ORCHESTRATOR === 'true'
 *   2. User-typed free text    — no chipMeta, no turnType hint, source is not
 *                                a chip/retry click
 *   3. Frame stage              — analysisStateReady === false AND
 *                                results.status !== 'complete'
 *   4. No prior tool calls      — no prior assistant message has blocks.length > 0
 *                                (blocks are emitted by V4 tool paths like
 *                                graph_patch, exercise, premortem — the UI's
 *                                observable trace of "a tool ran")
 */

import type { ConversationMessage } from '../canvas/conversation/types'

export interface V5EligibilityInput {
  /** VITE_ENABLE_V5_ORCHESTRATOR raw string value */
  flag: string | undefined
  /** sendTurn opts.chipMeta */
  chipMeta: { action_type: string; parameters?: Record<string, unknown> } | undefined
  /** sendTurn opts.turnType (when set, indicates a non-default tool hint) */
  turnType: string | undefined
  /** sendTurn opts.source (e.g. 'chip', 'chip_click', 'retry') */
  source: string | undefined
  /** sendTurn opts.mode — only 'user' turns are ever eligible */
  mode: 'user' | 'system'
  /** Current conversation history */
  messages: ConversationMessage[]
  /** Canvas store: analysisStateReady (true after resultsComplete) */
  analysisStateReady: boolean
  /** Canvas store: results.status */
  resultsStatus: string | undefined
}

export type V5EligibilityReason =
  | 'flag_off'
  | 'system_mode'
  | 'chip_metadata'
  | 'turn_type_hint'
  | 'chip_source'
  | 'retry_source'
  | 'analysis_ran'
  | 'prior_tool_calls'

export type V5EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: V5EligibilityReason }

export function isV5Eligible(input: V5EligibilityInput): V5EligibilityResult {
  if (input.flag !== 'true') {
    return { eligible: false, reason: 'flag_off' }
  }
  if (input.mode !== 'user') {
    return { eligible: false, reason: 'system_mode' }
  }
  if (input.chipMeta) {
    return { eligible: false, reason: 'chip_metadata' }
  }
  if (input.turnType) {
    return { eligible: false, reason: 'turn_type_hint' }
  }
  if (input.source === 'chip' || input.source === 'chip_click') {
    return { eligible: false, reason: 'chip_source' }
  }
  if (input.source === 'retry') {
    return { eligible: false, reason: 'retry_source' }
  }
  if (input.analysisStateReady || input.resultsStatus === 'complete') {
    return { eligible: false, reason: 'analysis_ran' }
  }
  const hasPriorToolCall = input.messages.some(
    (m) => m.role === 'assistant' && Array.isArray(m.blocks) && m.blocks.length > 0,
  )
  if (hasPriorToolCall) {
    return { eligible: false, reason: 'prior_tool_calls' }
  }
  return { eligible: true }
}

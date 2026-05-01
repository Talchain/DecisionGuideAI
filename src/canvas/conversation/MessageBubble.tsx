/**
 * MessageBubble — Single conversation message
 *
 * Renders user messages (right-aligned, info bg) and assistant messages
 * (left-aligned, panel bg) with optional inline blocks and action chips.
 *
 * Progressive disclosure: long assistant text (>300 chars, no blocks, not
 * synthetic) is clamped to ~6 lines with a "Show more" toggle.
 *
 * Streaming: when `message.isStreaming` is true, text renders incrementally
 * with a blinking cursor. Provisional tool-backed turns render at reduced
 * opacity until `turn_complete`.
 */

import { memo, useState, useMemo } from 'react'
import { typography } from '../../styles/typography'
import { safeRichText } from '../utils/safeRichText'
import { InlineBlocks } from './InlineBlocks'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { BaseRateChipRow } from './BaseRateChipRow'
import { FeedbackRow } from './FeedbackRow'
import { StalenessPill, type StalenessFreshness } from './StalenessPill'
import { isOrchestratorRenderingV2Enabled, isDeterministicCeeEnabled } from '../../flags'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { FALLBACK_TEXT } from './validateResponse'
import { SYSTEM_MESSAGE_SENTINEL, isNonConversationalContent } from './useConversation'
import type { ConversationMessage, ActionChip, GraphPatchBlock, Insight } from './types'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import styles from './Conversation.module.css'

/** Safety net: extract text from raw JSON blobs that CEE's fallback parser may produce. */
function extractFromRawJson(content: string): string {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') || !trimmed.includes('"text"')) return content
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed.text === 'string' && parsed.text.trim()) return parsed.text
  } catch { /* not valid JSON — fall through */ }
  return "I have a response but it didn't render correctly. Try asking again."
}

/** Replace internal factor IDs (fac_xxx) with human-readable labels. */
function sanitiseFactorIds(text: string, labelMap: Map<string, string>): string {
  return text.replace(/\bfac_[a-z_]+\b/g, (match) => {
    const label = labelMap.get(match)
    if (label) return label
    // Strip prefix, convert underscores to spaces, title-case
    return match.slice(4).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  })
}

/** Character threshold for applying progressive disclosure. */
const CLAMP_CHAR_THRESHOLD = 600
/** Minimum characters that must be hidden for truncation to be worthwhile. */
const MIN_HIDDEN_CHARS = 150
/**
 * Maximum distance a paragraph break can sit before CLAMP_CHAR_THRESHOLD and
 * still be used as the cut point. If the nearest \n\n is more than 100 chars
 * before the threshold we skip it (too aggressive) and fall through to the
 * sentence-end path instead.
 */
const MAX_PARA_BREAK_DISTANCE = 100

/**
 * Find the best truncation point in raw text at natural boundaries.
 * Returns the truncated text or null if truncation isn't worthwhile.
 * Only truncates when at least MIN_HIDDEN_CHARS (150) characters would be hidden.
 */
export function findNaturalTruncation(text: string): string | null {
  if (text.length <= CLAMP_CHAR_THRESHOLD) return null

  /** Check whether enough content would be hidden to justify truncation. */
  const isWorthHiding = (cutPoint: number) => text.slice(cutPoint).length >= MIN_HIDDEN_CHARS

  // 1. Try last paragraph break (\n\n) before limit, but only when it sits
  //    within MAX_PARA_BREAK_DISTANCE chars of the threshold. A break that is
  //    far before the threshold would truncate too aggressively; in that case
  //    fall through to the sentence-end path for a more accurate cut.
  const paraIdx = text.lastIndexOf('\n\n', CLAMP_CHAR_THRESHOLD)
  if (
    paraIdx > 0 &&
    CLAMP_CHAR_THRESHOLD - paraIdx <= MAX_PARA_BREAK_DISTANCE &&
    isWorthHiding(paraIdx)
  ) {
    return text.slice(0, paraIdx)
  }

  // 2. Try last sentence-ending punctuation followed by space
  const sentenceRe = /[.!?]\s/g
  let lastSentenceEnd = -1
  let m: RegExpExecArray | null
  while ((m = sentenceRe.exec(text)) !== null) {
    if (m.index + 1 > CLAMP_CHAR_THRESHOLD) break
    lastSentenceEnd = m.index + 1 // include the punctuation
  }
  if (lastSentenceEnd > 0 && isWorthHiding(lastSentenceEnd)) {
    return text.slice(0, lastSentenceEnd)
  }

  // 3. Not enough hidden content — show full text
  return null
}

interface MessageBubbleProps {
  message: ConversationMessage
  /** When true, suppress inline ActionChipRow (chips rendered externally by SuggestedChips) */
  hideChips?: boolean
  /** When true, inline ActionChipRow is visible but non-interactive (historical turn) */
  historicalChips?: boolean
  onChipClick: (chip: ActionChip) => Promise<void>
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
}

export const MessageBubble = memo(function MessageBubble({
  message,
  historicalChips = false,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onArtefactMessage,
  onProposalConfirm,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Defensive guard: never render the [system] sentinel as a user bubble
  if (isUser && message.content === SYSTEM_MESSAGE_SENTINEL) return null

  // Suppress stock acknowledgement messages (Task 5: DS v5 compliance)
  // Only suppress when there are no blocks to render — blocks (e.g. graph_patch)
  // must survive even when the accompanying text is non-conversational.
  // Never suppress streaming messages — empty content during streaming is normal.
  if (!isUser && !message.isStreaming && isNonConversationalContent(message.content) && (!message.blocks || message.blocks.length === 0)) return null

  // Chip-initiated user messages render as a compact pill, not a full bubble
  if (isUser && message.chipInitiated) {
    return (
      <div className={styles.chipActionIndicator} data-testid="chip-action-indicator">
        <span className={typography.caption}>{message.displayContent ?? message.content}</span>
      </div>
    )
  }

  const isStreaming = message.isStreaming === true
  const isProvisional = message.isProvisional === true
  const hasToolLoading = Boolean(message.toolLoadingState)

  // P0-1: Safety net — extract text from raw JSON blobs (CEE fallback parser).
  // Only apply after streaming completes — partial JSON during streaming would flash fallback.
  // N3 (T6): skip the JSON-extraction safety net on user-stopped messages. The
  // partial content may be an incomplete JSON fragment that JSON.parse would
  // reject, causing extractFromRawJson to return its "didn't render correctly"
  // placeholder — confusing alongside the "Response stopped." indicator. The
  // user chose to stop mid-stream; show whatever partial they had.
  const displayContent = (isUser || isStreaming || message.stoppedByUser)
    ? message.content
    : extractFromRawJson(message.content)

  // Progressive disclosure: truncate at natural boundaries (paragraph / sentence)
  const canTruncate = !isUser
    && !isStreaming
    && !message.synthetic
    && (!message.blocks || message.blocks.length === 0)
  const truncatedContent = canTruncate ? findNaturalTruncation(displayContent) : null
  const [expanded, setExpanded] = useState(false)

  // Freshness pill: derive from the first graph_patch block whose
  // analysis_ready.freshness is 'stale' or 'unknown'. Fresh/none/absent → no pill.
  // User messages and the streaming-thinking placeholder bypass this branch.
  const stalenessFreshness = useMemo<StalenessFreshness | null>(() => {
    if (isUser || !message.blocks) return null
    for (const block of message.blocks) {
      if (block.type !== 'graph_patch') continue
      const f = (block as GraphPatchBlock).analysis_ready?.freshness
      if (f === 'stale' || f === 'unknown') return f
    }
    return null
  }, [isUser, message.blocks])

  // Streaming with no text yet — show thinking indicator placeholder
  if (isStreaming && !message.content && !hasToolLoading) {
    return (
      <>
        {stalenessFreshness && <StalenessPill freshness={stalenessFreshness} />}
        <div
          className={styles.messageBubbleAssistant}
          data-testid="message-assistant"
        >
          <div className={styles.streamingThinking} data-testid="streaming-thinking">
            <span className={styles.streamingDot} />
            <span className={styles.streamingDot} />
            <span className={styles.streamingDot} />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
    {stalenessFreshness && <StalenessPill freshness={stalenessFreshness} />}
    <div
      className={isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`${typography.body} ${styles.markdownContent} ${
          isProvisional ? styles.provisionalText : ''
        } ${!isUser && isOrchestratorRenderingV2Enabled() ? styles.v2AssistantText : ''}`}
        data-streaming={isStreaming || undefined}
        // eslint-disable-next-line security/no-unsafe-innerhtml -- sanitised by safeRichText (allowlist: strong, br, ul, li; br.md-gap for rule degradation)
        dangerouslySetInnerHTML={{
          __html: safeRichText(
            truncatedContent && !expanded ? truncatedContent : displayContent,
          ) + (isStreaming ? '<span class="streaming-cursor" aria-hidden="true">|</span>' : ''),
        }}
      />
      {hasToolLoading && (
        <div className={styles.toolLoadingState} data-testid="tool-loading-state">
          <span className={styles.toolLoadingDot} />
          {message.toolLoadingState}
        </div>
      )}
      {/* T6: persistent "Response stopped." indicator on user-cancelled turns.
        * Set by useConversation.cancelTurn(); never cleared by late chunks. */}
      {message.stoppedByUser && (
        <div
          className={typography.panelMeta}
          style={{ color: 'var(--text-light, #908D8D)', marginTop: 4 }}
          data-testid="response-stopped-indicator"
        >
          Response stopped.
        </div>
      )}
      {truncatedContent && (
        <button
          type="button"
          className={styles.inlineDisclosureToggle}
          onClick={() => setExpanded(v => !v)}
          data-testid="message-show-more"
          aria-expanded={expanded}
          aria-label={expanded ? 'Show less of this message' : 'Show more of this message'}
        >
          {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
        </button>
      )}
      {message.insights && message.insights.length > 0 && isDeterministicCeeEnabled() && (
        <InsightsStrip insights={message.insights} onSendMessage={onArtefactMessage} />
      )}
      {message.blocks && message.blocks.length > 0 && (
        <InlineBlocks
          blocks={message.blocks}
          turnId={message.id}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
          onArtefactMessage={onArtefactMessage}
          onProposalConfirm={onProposalConfirm}
          assistantTextWordCount={displayContent.trim().split(/\s+/).filter(Boolean).length}
        />
      )}
      {!isUser && message.baseRateChips && !historicalChips && onArtefactMessage && (
        <BaseRateChipRow
          chipSet={message.baseRateChips}
          onSendMessage={onArtefactMessage}
          disabled={isStreaming}
        />
      )}
      {!isUser && !message.synthetic && displayContent !== FALLBACK_TEXT && onFeedback && (
        <FeedbackRow turnId={message.clientTurnId} onFeedback={onFeedback} />
      )}
    </div>
    </>
  )
})

/** Map insight type → action chip config with optional deterministic action routing. */
interface InsightAction {
  label: string
  message: string
  action_type?: string
}

function getInsightAction(type: string, entityLabel: string): InsightAction | null {
  switch (type) {
    case 'missing_perspective':
    case 'structural_gap':
      return { label: 'Explore more options', message: 'Suggest additional options for this decision', action_type: 'add_option' }
    case 'assumption_risk':
      return { label: `Investigate ${entityLabel}`, message: `Help me clarify ${entityLabel === 'this' ? 'this assumption' : `your ${entityLabel} estimate`}`, action_type: 'challenge_assumption' }
    case 'calibration_concern':
      return { label: `Calibrate ${entityLabel}`, message: `Help me calibrate ${entityLabel === 'this' ? 'this factor' : entityLabel}`, action_type: 'set_factor_value' }
    case 'bias_detected':
      return { label: `Challenge ${entityLabel}`, message: `Challenge my assumption about ${entityLabel === 'this' ? 'this' : entityLabel}`, action_type: 'challenge_assumption' }
    default:
      return null
  }
}

/** Deterministic CEE insights — rendered between assistant_text and blocks */
function InsightsStrip({ insights, onSendMessage }: { insights: Insight[]; onSendMessage?: (text: string) => void }) {
  // Resolve target_id → node label from the graph
  const nodes = useCanvasStore(s => s.nodes)
  const labelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes) {
      if (n.data?.label) m.set(n.id, n.data.label)
    }
    return m
  }, [nodes])

  return (
    <div className={styles.insightStrip} data-testid="insights-strip">
      {insights.map((insight, i) => {
        const severityClass =
          insight.severity === 'important' ? styles.insightItemImportant
          : insight.severity === 'warning' ? styles.insightItemWarning
          : styles.insightItemInfo
        const entityLabel = (insight.target_id && labelMap.get(insight.target_id)) || 'this'
        // DS v5: no action chip for info-severity insights (opportunity/informational)
        const action = insight.severity === 'info' ? null : getInsightAction(insight.type, entityLabel)
        return (
          <div key={i} className={`${styles.insightItem} ${severityClass}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <span className={typography.panelBody} style={{ color: 'var(--text-body)' }}>
                {sanitiseFactorIds(insight.description, labelMap)}
              </span>
              {insight.science_concept && (
                <span className={styles.scienceConceptBadge}>{insight.science_concept}</span>
              )}
              {action && (onSendMessage || useGuidanceStore.getState()._dispatchAction) && (
                <button
                  type="button"
                  className={`${typography.caption} ${styles.insightActionChip}`}
                  onClick={() => {
                    const dispatch = useGuidanceStore.getState()._dispatchAction
                    if (dispatch) {
                      dispatch({
                        action_type: action.action_type,
                        label: action.label,
                        message: action.message,
                        source: 'insight',
                        ...(insight.target_id ? { parameters: { target_id: insight.target_id } } : {}),
                      })
                    } else {
                      onSendMessage?.(action.message)
                    }
                  }}
                  style={{ marginTop: 8 }}
                  data-testid={`insight-action-${i}`}
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
